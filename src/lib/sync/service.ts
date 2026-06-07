import { FlightSourceType, Prisma, SyncStatus } from "@prisma/client";
import { checkDbHealth } from "@/lib/db/health";
import { prisma } from "@/lib/db";
import { formatServiceError } from "@/lib/errors";
import {
  analyzeFlightsForYear,
  analyzeUploadedFlight,
} from "@/lib/analysis/run";
import {
  fetchFlightsForSource,
  getFlightDurationSeconds,
  getPilotName,
  getPilotUserId,
} from "@/lib/weglide/client";
import { fetchIgcContentForFlight } from "@/lib/weglide/igc";
import type { WeGlideFlight } from "@/lib/weglide/types";
import {
  buildSourceKey,
  getLaunchAirportFields,
  normalizeSyncSource,
  type SyncSource,
} from "@/lib/sync/source";

const BATCH_SIZE = 5;

export type SyncMode = "incremental" | "replace";

function toFlightSourceType(source: SyncSource): FlightSourceType {
  return source.type === "club" ? FlightSourceType.CLUB : FlightSourceType.AIRPORT;
}

async function ensureSyncState(year: number) {
  return prisma.syncState.upsert({
    where: { year },
    create: { year },
    update: {},
  });
}

function parseFlightDate(flight: WeGlideFlight, year: number): Date {
  for (const candidate of [
    flight.scoring_date,
    flight.date,
    flight.takeoff_time,
  ]) {
    if (!candidate) continue;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(`${year}-06-01T12:00:00Z`);
}

function getCachedFlights(state: { cachedFlights: unknown }): WeGlideFlight[] {
  if (!Array.isArray(state.cachedFlights)) return [];
  return normalizeFlightList(state.cachedFlights as WeGlideFlight[]);
}

function normalizeFlightList(flights: WeGlideFlight[]): WeGlideFlight[] {
  return flights
    .map((flight) => ({
      ...flight,
      id: Number(flight.id),
    }))
    .filter((flight) => Number.isFinite(flight.id) && flight.id > 0);
}

function normalizeWeGlideIds(ids: number[]): number[] {
  return [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
}

async function assertDbReady() {
  const health = await checkDbHealth();
  if (!health.ok) {
    throw new Error(health.message);
  }
}

async function getExistingWeGlideIds(ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set();

  const existing = await prisma.flight.findMany({
    where: { weglideId: { in: ids } },
    select: { weglideId: true },
  });

  return new Set(
    existing
      .map((flight) => flight.weglideId)
      .filter((id): id is number => id !== null),
  );
}

async function upsertFlightRecord(
  flight: WeGlideFlight,
  year: number,
  source: SyncSource,
  igcContent: string | null,
  options?: {
    igcfileIdOverride?: number;
    forceUpdate?: boolean;
    skipIfExists?: boolean;
  },
) {
  const weglideId = flight.id;
  const sourceKey = buildSourceKey(source.type, source.id);
  const airportFields = getLaunchAirportFields(flight);

  if (options?.skipIfExists) {
    const existing = await prisma.flight.findUnique({
      where: { weglideId },
      select: { id: true },
    });
    if (existing) {
      return { skipped: true as const };
    }
  }

  const igcfileId = options?.igcfileIdOverride ?? null;
  const data = {
    igcfileId,
    sourceType: toFlightSourceType(source),
    sourceKey,
    sourceLabel: source.label,
    pilotName: getPilotName(flight),
    pilotUserId: getPilotUserId(flight),
    flightDate: parseFlightDate(flight, year),
    durationSeconds: getFlightDurationSeconds(flight),
    distanceKm: typeof flight.distance === "number" ? flight.distance : null,
    score:
      typeof flight.points === "number"
        ? flight.points
        : typeof flight.score === "number"
          ? flight.score
          : null,
    launchAirport: airportFields.launchAirport,
    launchAirportIcao: airportFields.launchAirportIcao,
    year,
    igcContent,
    rawJson: flight as Prisma.InputJsonValue,
  };

  if (options?.forceUpdate) {
    await prisma.flight.upsert({
      where: { weglideId },
      create: {
        weglideId,
        ...data,
      },
      update: {
        ...data,
        analyzedAt: null,
      },
    });
    return { skipped: false as const };
  }

  await prisma.flight.upsert({
    where: { weglideId },
    create: {
      weglideId,
      ...data,
    },
    update: data,
  });

  return { skipped: false as const };
}

async function resolveDiscoveredWeGlideIds(
  year: number,
  source: SyncSource,
): Promise<number[]> {
  const state = await prisma.syncState.findUnique({ where: { year } });
  const cached = getCachedFlights(state ?? { cachedFlights: null });
  const sameSource =
    state?.sourceType === source.type &&
    state?.sourceId === String(source.id) &&
    cached.length > 0;

  if (sameSource) {
    return cached.map((flight) => flight.id);
  }

  const flights = await fetchFlightsForSource(source, year);
  return flights.map((flight) => flight.id);
}

async function pruneFlightsForSource(
  year: number,
  source: SyncSource,
  discoveredIds: number[],
) {
  const sourceKey = buildSourceKey(source.type, source.id);
  const keep = new Set(discoveredIds);

  const candidates = await prisma.flight.findMany({
    where: {
      year,
      sourceKey,
      weglideId: { not: null },
    },
    select: { id: true, weglideId: true },
  });

  const removeIds = candidates
    .filter((flight) => flight.weglideId && !keep.has(flight.weglideId))
    .map((flight) => flight.id);

  if (removeIds.length > 0) {
    await prisma.flight.deleteMany({
      where: { id: { in: removeIds } },
    });
  }

  return removeIds.length;
}

export async function discoverFlightsForYear(
  year: number,
  options?: {
    source?: Partial<SyncSource> | null;
    mode?: SyncMode;
    browserFlights?: WeGlideFlight[];
  },
) {
  await assertDbReady();

  const source = normalizeSyncSource(options?.source);
  const mode = options?.mode ?? "incremental";
  const sourceKey = buildSourceKey(source.type, source.id);

  await ensureSyncState(year);

  await prisma.syncState.update({
    where: { year },
    data: {
      status: SyncStatus.DISCOVERING,
      errorMessage: null,
      sourceType: source.type,
      sourceId: String(source.id),
      sourceLabel: source.label,
      lastRunAt: new Date(),
    },
  });

  try {
    const flights = normalizeFlightList(
      options?.browserFlights ??
        (await fetchFlightsForSource(source, year)),
    );

    let pendingFlights = flights;
    let skippedExisting = 0;

    if (mode === "incremental") {
      const existingIds = await getExistingWeGlideIds(
        flights.map((flight) => flight.id),
      );
      pendingFlights = flights.filter((flight) => !existingIds.has(flight.id));
      skippedExisting = flights.length - pendingFlights.length;
    }

    const pendingIds = normalizeWeGlideIds(
      pendingFlights.map((flight) => flight.id),
    );

    await prisma.syncState.update({
      where: { year },
      data: {
        status: SyncStatus.IMPORTING,
        totalFlights: pendingIds.length,
        importedFlights: 0,
        analyzedFlights: 0,
        pendingWeGlideIds: pendingIds,
        cachedFlights: flights as Prisma.InputJsonValue,
      },
    });

    return {
      year,
      source,
      sourceKey,
      mode,
      totalDiscovered: flights.length,
      totalFlights: pendingIds.length,
      skippedExisting,
      flights: pendingFlights,
    };
  } catch (error) {
    const message = formatServiceError(error);
    await prisma.syncState.update({
      where: { year },
      data: {
        status: SyncStatus.FAILED,
        errorMessage: message,
      },
    }).catch(() => undefined);
    throw new Error(message);
  }
}

export async function importNextBatch(
  year: number,
  options?: {
    source?: Partial<SyncSource> | null;
    mode?: SyncMode;
    browserItems?: Array<{ weglideId: number; igcContent: string | null }>;
  },
) {
  const source = normalizeSyncSource(options?.source);
  const mode = options?.mode ?? "incremental";
  const state = await ensureSyncState(year);
  const pending = state.pendingWeGlideIds;

  if (pending.length === 0) {
    return {
      done: true,
      importedThisBatch: 0,
      skippedThisBatch: 0,
      remaining: 0,
    };
  }

  const cachedFlights = getCachedFlights(state);
  const flightMap = new Map(cachedFlights.map((flight) => [flight.id, flight]));
  const batchIds = pending.slice(0, BATCH_SIZE);
  let importedThisBatch = 0;
  let skippedThisBatch = 0;
  const browserIgcMap = new Map(
    (options?.browserItems ?? []).map((item) => [item.weglideId, item.igcContent]),
  );

  for (const weglideId of batchIds) {
    const flight = flightMap.get(weglideId);
    if (!flight) {
      continue;
    }

    if (mode === "incremental") {
      const existing = await prisma.flight.findUnique({
        where: { weglideId },
        select: { id: true },
      });
      if (existing) {
        skippedThisBatch += 1;
        continue;
      }
    }

    let igcContent: string | null = null;
    let igcfileId: number | null = null;

    if (options?.browserItems) {
      igcContent = browserIgcMap.get(weglideId) ?? null;
    } else {
      const fetched = await fetchIgcContentForFlight(flight);
      igcContent = fetched.content;
      igcfileId = fetched.igcfileId;
    }

    const result = await upsertFlightRecord(
      flight,
      year,
      source,
      igcContent ?? null,
      {
        igcfileIdOverride: igcfileId ?? undefined,
        forceUpdate: mode === "replace",
        skipIfExists: mode === "incremental",
      },
    );

    if (result.skipped) {
      skippedThisBatch += 1;
    } else {
      importedThisBatch += 1;
    }
  }

  const remaining = pending.slice(batchIds.length);

  await prisma.syncState.update({
    where: { year },
    data: {
      pendingWeGlideIds: remaining,
      importedFlights: state.totalFlights - remaining.length,
      status: SyncStatus.IMPORTING,
      lastRunAt: new Date(),
    },
  });

  return {
    done: remaining.length === 0,
    importedThisBatch,
    skippedThisBatch,
    remaining: remaining.length,
  };
}

export async function analyzeYear(
  year: number,
  options?: {
    source?: Partial<SyncSource> | null;
    incremental?: boolean;
  },
) {
  const source = normalizeSyncSource(options?.source);
  const sourceKey = buildSourceKey(source.type, source.id);
  const incremental = options?.incremental ?? true;

  await prisma.syncState.update({
    where: { year },
    data: {
      status: SyncStatus.ANALYZING,
      errorMessage: null,
      sourceType: source.type,
      sourceId: String(source.id),
      sourceLabel: source.label,
      lastRunAt: new Date(),
    },
  });

  try {
    const discoveredIds = await resolveDiscoveredWeGlideIds(year, source);
    const result = await analyzeFlightsForYear(year, {
      weglideIds: discoveredIds,
      onlyUnanalyzed: incremental,
    });

    const importedFlights =
      discoveredIds.length > 0
        ? await prisma.flight.count({
            where: {
              year,
              weglideId: { in: discoveredIds },
            },
          })
        : 0;

    await prisma.syncState.update({
      where: { year },
      data: {
        status: SyncStatus.COMPLETED,
        analyzedFlights: result.flightsAnalyzed,
        importedFlights,
        analysisPhase: null,
        hotspotsProcessed: result.yearHotspotClusters,
        hotspotsTotal: result.yearHotspotClusters,
        errorMessage: null,
        lastRunAt: new Date(),
      },
    });

    return result;
  } catch (error) {
    const message = formatServiceError(error);
    await prisma.syncState.update({
      where: { year },
      data: {
        status: SyncStatus.FAILED,
        errorMessage: message,
      },
    }).catch(() => undefined);
    throw new Error(message);
  }
}

export async function getSyncStatus(year: number) {
  const state = await ensureSyncState(year);
  return state;
}

export async function refetchIgcForYear(
  year: number,
  options?: {
    source?: Partial<SyncSource> | null;
  },
) {
  const source = normalizeSyncSource(options?.source);
  const sourceKey = buildSourceKey(source.type, source.id);

  const discovered = await fetchFlightsForSource(source, year);
  const discoveredIds = discovered.map((flight) => flight.id);
  const flightMap = new Map(discovered.map((flight) => [flight.id, flight]));

  const removed = await pruneFlightsForSource(year, source, discoveredIds);

  let updated = 0;
  let withIgc = 0;
  let failed = 0;

  for (const weglideId of discoveredIds) {
    const flight = flightMap.get(weglideId);
    if (!flight) continue;

    const fetched = await fetchIgcContentForFlight(flight);

    if (fetched.content) {
      withIgc += 1;
      updated += 1;
      await upsertFlightRecord(flight, year, source, fetched.content, {
        igcfileIdOverride: fetched.igcfileId ?? undefined,
        forceUpdate: true,
      });
    } else {
      failed += 1;
      await upsertFlightRecord(flight, year, source, null, {
        forceUpdate: true,
      });
    }
  }

  return {
    source,
    sourceKey,
    totalDiscovered: discovered.length,
    removed,
    updated,
    withIgc,
    failed,
  };
}

export async function importUploadedIgcFile(input: {
  fileName: string;
  igcContent: string;
}) {
  const { parseIgcTrack, requireIgcMetadata } = await import("@/lib/igc/parser");

  const { pilotName, flightDate, year } = requireIgcMetadata(input.igcContent);
  const points = parseIgcTrack(input.igcContent);

  const durationSeconds =
    points.length >= 2
      ? Math.max(0, points[points.length - 1].timeSec - points[0].timeSec)
      : 0;

  const flight = await prisma.flight.create({
    data: {
      uploadId: crypto.randomUUID(),
      sourceType: FlightSourceType.UPLOAD,
      sourceKey: "upload:manual",
      sourceLabel: "Manual upload",
      pilotName,
      flightDate,
      durationSeconds,
      year,
      igcContent: input.igcContent,
      rawJson: {
        fileName: input.fileName,
        uploadedAt: new Date().toISOString(),
      },
    },
  });

  const analysis = await analyzeUploadedFlight(flight.id);

  return {
    flightId: flight.id,
    pilotName,
    year,
    trackPoints: points.length,
    ...analysis,
  };
}

export async function listSyncYears() {
  const [syncStates, flightYears] = await Promise.all([
    prisma.syncState.findMany({ orderBy: { year: "desc" } }),
    prisma.flight.groupBy({
      by: ["year"],
      _count: { _all: true },
    }),
  ]);

  const years = new Set<number>([
    ...syncStates.map((state) => state.year),
    ...flightYears.map((entry) => entry.year),
  ]);

  return Array.from(years).sort((a, b) => b - a);
}
