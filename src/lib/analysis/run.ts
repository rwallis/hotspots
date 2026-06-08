import { prisma } from "@/lib/db";
import { parseIgcTrack } from "@/lib/igc/parser";
import {
  CLUSTER_RADIUS_M,
  clusterHotspots,
  haversineMeters,
  type ThermalInput,
} from "@/lib/analysis/hotspots";
import { detectThermals } from "@/lib/analysis/thermals";

type ThermalWithId = ThermalInput & {
  id: string;
  flightId: string;
};

type FlightMeta = {
  flightDate: Date;
  weglideId: number | null;
};

type ThermalSummary = {
  lat: number;
  lon: number;
  avgClimbKts: number;
  pilotName: string;
  year: number;
};

function flightLabel(meta: FlightMeta, pilotName: string): string {
  const date = meta.flightDate.toISOString().slice(0, 10);
  const idSuffix = meta.weglideId != null ? ` ${meta.weglideId}` : "";
  return `${date} ${pilotName}${idSuffix}`;
}

async function loadFlightMetaById(
  flightIds: string[],
): Promise<Map<string, FlightMeta>> {
  const meta = new Map<string, FlightMeta>();
  const chunkSize = 100;

  for (let offset = 0; offset < flightIds.length; offset += chunkSize) {
    const chunk = flightIds.slice(offset, offset + chunkSize);
    const flights = await prisma.flight.findMany({
      where: { id: { in: chunk } },
      select: {
        id: true,
        flightDate: true,
        weglideId: true,
      },
    });

    for (const flight of flights) {
      meta.set(flight.id, {
        flightDate: flight.flightDate,
        weglideId: flight.weglideId,
      });
    }
  }

  return meta;
}

async function reportAnalyzeProgress(
  year: number,
  data: {
    analyzedFlights?: number;
    totalFlights?: number;
    analysisPhase?: string | null;
    hotspotsProcessed?: number;
    hotspotsTotal?: number;
  },
) {
  await prisma.syncState.update({
    where: { year },
    data: {
      ...("analyzedFlights" in data && {
        analyzedFlights: data.analyzedFlights,
      }),
      ...("totalFlights" in data && { totalFlights: data.totalFlights }),
      ...("analysisPhase" in data && { analysisPhase: data.analysisPhase }),
      ...("hotspotsProcessed" in data && {
        hotspotsProcessed: data.hotspotsProcessed,
      }),
      ...("hotspotsTotal" in data && { hotspotsTotal: data.hotspotsTotal }),
      lastRunAt: new Date(),
    },
  });
}

function summarizeThermals(thermals: ThermalSummary[]) {
  const count = thermals.length;
  const lat = thermals.reduce((sum, thermal) => sum + thermal.lat, 0) / count;
  const lon = thermals.reduce((sum, thermal) => sum + thermal.lon, 0) / count;
  const avgClimbKts =
    thermals.reduce((sum, thermal) => sum + thermal.avgClimbKts, 0) / count;
  const years = Array.from(new Set(thermals.map((thermal) => thermal.year))).sort(
    (a, b) => a - b,
  );
  const pilotNames = Array.from(
    new Set(thermals.map((thermal) => thermal.pilotName)),
  ).sort();

  return { lat, lon, avgClimbKts, count, years, pilotNames };
}

async function recalculateHotspotFromThermals(hotspotId: string) {
  const thermals = await prisma.thermal.findMany({
    where: { hotspotId },
    select: {
      lat: true,
      lon: true,
      avgClimbKts: true,
      pilotName: true,
      year: true,
    },
  });

  if (thermals.length === 0) {
    await prisma.hotspot.delete({ where: { id: hotspotId } });
    return;
  }

  const summary = summarizeThermals(thermals);
  await prisma.hotspot.update({
    where: { id: hotspotId },
    data: summary,
  });
}

async function findNearbyHotspot(
  lat: number,
  lon: number,
): Promise<{ id: string } | null> {
  const latDelta = CLUSTER_RADIUS_M / 111_000;
  const lonDelta =
    CLUSTER_RADIUS_M / (111_000 * Math.cos((lat * Math.PI) / 180));

  const candidates = await prisma.hotspot.findMany({
    where: {
      lat: { gte: lat - latDelta, lte: lat + latDelta },
      lon: { gte: lon - lonDelta, lte: lon + lonDelta },
    },
    select: { id: true, lat: true, lon: true },
  });

  let best: { id: string } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const distance = haversineMeters(lat, lon, candidate.lat, candidate.lon);
    if (distance <= CLUSTER_RADIUS_M && distance < bestDistance) {
      best = { id: candidate.id };
      bestDistance = distance;
    }
  }

  return best;
}

async function rebuildHotspotsForYear(year: number): Promise<{
  yearClusters: number;
  totalHotspots: number;
}> {
  const orphans = await prisma.hotspot.findMany({
    where: { thermals: { none: {} } },
    select: { id: true },
  });
  if (orphans.length > 0) {
    await prisma.hotspot.deleteMany({
      where: { id: { in: orphans.map((hotspot) => hotspot.id) } },
    });
  }

  const affectedHotspots = await prisma.hotspot.findMany({
    where: { years: { has: year } },
    select: { id: true },
  });
  for (const hotspot of affectedHotspots) {
    await recalculateHotspotFromThermals(hotspot.id);
  }

  const thermals = await prisma.thermal.findMany({
    where: { year, hotspotId: null },
    select: {
      id: true,
      flightId: true,
      lat: true,
      lon: true,
      avgClimbKts: true,
      avgClimbFpm: true,
      altFt: true,
      durationSec: true,
      pilotName: true,
      year: true,
    },
  });

  const flightMeta = await loadFlightMetaById([
    ...new Set(thermals.map((thermal) => thermal.flightId)),
  ]);

  const inputs: ThermalWithId[] = [];
  for (const thermal of thermals) {
    const meta = flightMeta.get(thermal.flightId);
    if (!meta) continue;

    inputs.push({
      id: thermal.id,
      flightId: thermal.flightId,
      lat: thermal.lat,
      lon: thermal.lon,
      avgClimbKts: thermal.avgClimbKts,
      avgClimbFpm: thermal.avgClimbFpm ?? 0,
      altFt: thermal.altFt ?? 0,
      durationSec: thermal.durationSec,
      pilotName: thermal.pilotName,
      year: thermal.year,
      flightLabel: flightLabel(meta, thermal.pilotName),
    });
  }

  const clusters = clusterHotspots(inputs);
  const totalClusters = clusters.length;

  await reportAnalyzeProgress(year, {
    analysisPhase: "hotspots",
    hotspotsProcessed: 0,
    hotspotsTotal: totalClusters,
  });

  let processedClusters = 0;
  for (const cluster of clusters) {
    const thermalIds = (cluster.thermals as ThermalWithId[]).map(
      (thermal) => thermal.id,
    );

    const nearby = await findNearbyHotspot(cluster.lat, cluster.lon);
    if (nearby) {
      if (thermalIds.length > 0) {
        await prisma.thermal.updateMany({
          where: { id: { in: thermalIds } },
          data: { hotspotId: nearby.id },
        });
      }
      await recalculateHotspotFromThermals(nearby.id);
    } else {
      const hotspot = await prisma.hotspot.create({
        data: {
          name: cluster.name,
          lat: cluster.lat,
          lon: cluster.lon,
          avgClimbKts: cluster.avgClimbKts,
          count: cluster.count,
          years: cluster.years,
          pilotNames: cluster.pilotNames,
        },
      });

      if (thermalIds.length > 0) {
        await prisma.thermal.updateMany({
          where: { id: { in: thermalIds } },
          data: { hotspotId: hotspot.id },
        });
      }
    }

    processedClusters += 1;
    if (
      processedClusters % 25 === 0 ||
      processedClusters === totalClusters
    ) {
      await reportAnalyzeProgress(year, {
        hotspotsProcessed: processedClusters,
        hotspotsTotal: totalClusters,
      });
    }
  }

  const totalHotspots = await prisma.hotspot.count();
  return { yearClusters: totalClusters, totalHotspots };
}

async function analyzeSingleFlight(flight: {
  id: string;
  pilotName: string;
  year: number;
  igcContent: string | null;
}) {
  if (!flight.igcContent || flight.igcContent.length < 100) {
    return {
      thermalCount: 0,
      flightsAnalyzed: 0,
      flightsWithIgc: 0,
      flightsWithTrackPoints: 0,
    };
  }

  const points = parseIgcTrack(flight.igcContent);
  if (points.length < 3) {
    return {
      thermalCount: 0,
      flightsWithIgc: 1,
      flightsWithTrackPoints: 0,
      flightsAnalyzed: 0,
    };
  }

  const detected = detectThermals(points);
  if (detected.length > 0) {
    await prisma.thermal.createMany({
      data: detected.map((thermal) => ({
        flightId: flight.id,
        lat: thermal.lat,
        lon: thermal.lon,
        avgClimbKts: thermal.avgClimbKts,
        avgClimbFpm: thermal.avgClimbFpm,
        startAltFt: thermal.startAltFt,
        altFt: thermal.altFt,
        startTimeSec: thermal.startTimeSec,
        endTimeSec: thermal.endTimeSec,
        durationSec: thermal.durationSec,
        pilotName: flight.pilotName,
        year: flight.year,
      })),
    });
  }

  await prisma.flight.update({
    where: { id: flight.id },
    data: { analyzedAt: new Date() },
  });

  return {
    thermalCount: detected.length,
    flightsAnalyzed: 1,
    flightsWithIgc: 1,
    flightsWithTrackPoints: 1,
  };
}

export async function analyzeUploadedFlight(flightId: string) {
  await prisma.thermal.deleteMany({ where: { flightId } });

  const flight = await prisma.flight.findUnique({
    where: { id: flightId },
    select: {
      id: true,
      pilotName: true,
      year: true,
      igcContent: true,
    },
  });

  if (!flight) {
    throw new Error("Uploaded flight not found");
  }

  const result = await analyzeSingleFlight(flight);
  const { yearClusters, totalHotspots } = await rebuildHotspotsForYear(flight.year);

  return {
    ...result,
    yearHotspotClusters: yearClusters,
    hotspotCount: totalHotspots,
  };
}

export async function analyzeFlightsForYear(
  year: number,
  options?: {
    sourceKey?: string;
    weglideIds?: number[];
    onlyUnanalyzed?: boolean;
  },
): Promise<{
  thermalCount: number;
  hotspotCount: number;
  yearHotspotClusters: number;
  flightsAnalyzed: number;
  flightsWithIgc: number;
  flightsWithTrackPoints: number;
}> {
  const scopedWeGlideIds =
    options?.weglideIds?.filter((id) => Number.isFinite(id) && id > 0) ?? [];

  const flightWhere = {
    year,
    excluded: false,
    ...(scopedWeGlideIds.length > 0
      ? { weglideId: { in: scopedWeGlideIds } }
      : options?.sourceKey
        ? { sourceKey: options.sourceKey }
        : {}),
    ...(options?.onlyUnanalyzed ? { analyzedAt: null } : {}),
  };

  const flightIds = await prisma.flight.findMany({
    where: flightWhere,
    orderBy: { flightDate: "asc" },
    select: { id: true },
  });

  const totalFlights = flightIds.length;
  const dbFlightIds = flightIds.map((flight) => flight.id);

  if (dbFlightIds.length > 0) {
    await prisma.thermal.deleteMany({
      where: { flightId: { in: dbFlightIds } },
    });
  }
  await reportAnalyzeProgress(year, {
    analyzedFlights: 0,
    totalFlights,
    analysisPhase: "flights",
    hotspotsProcessed: 0,
    hotspotsTotal: 0,
  });

  let thermalCount = 0;
  let flightsAnalyzed = 0;
  let flightsWithIgc = 0;
  let flightsWithTrackPoints = 0;
  let processedFlights = 0;

  if (totalFlights === 0) {
    await reportAnalyzeProgress(year, {
      analyzedFlights: 0,
      totalFlights: 0,
      analysisPhase: null,
      hotspotsProcessed: 0,
      hotspotsTotal: 0,
    });

    return {
      thermalCount: 0,
      hotspotCount: await prisma.hotspot.count(),
      yearHotspotClusters: 0,
      flightsAnalyzed: 0,
      flightsWithIgc: 0,
      flightsWithTrackPoints: 0,
    };
  }

  for (const { id } of flightIds) {
    processedFlights += 1;

    const flight = await prisma.flight.findUnique({
      where: { id },
      select: {
        id: true,
        pilotName: true,
        year: true,
        igcContent: true,
      },
    });

    if (flight) {
      const result = await analyzeSingleFlight(flight);
      thermalCount += result.thermalCount;
      flightsAnalyzed += result.flightsAnalyzed;
      flightsWithIgc += result.flightsWithIgc;
      flightsWithTrackPoints += result.flightsWithTrackPoints;
    }

    if (processedFlights % 5 === 0 || processedFlights === totalFlights) {
      await reportAnalyzeProgress(year, {
        analyzedFlights: processedFlights,
        totalFlights,
        analysisPhase: "flights",
      });
    }
  }

  const { yearClusters, totalHotspots } = await rebuildHotspotsForYear(year);

  await reportAnalyzeProgress(year, {
    analysisPhase: null,
    hotspotsProcessed: yearClusters,
    hotspotsTotal: yearClusters,
  });

  return {
    thermalCount,
    hotspotCount: totalHotspots,
    yearHotspotClusters: yearClusters,
    flightsAnalyzed,
    flightsWithIgc,
    flightsWithTrackPoints,
  };
}
