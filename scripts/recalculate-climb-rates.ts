/**
 * Re-detect thermals from stored IGC using start/end altitude + elapsed time,
 * then recalculate avgClimbKts and refresh hotspot averages.
 *
 *   npm run recalculate-climb-rates
 *   npm run recalculate-climb-rates -- --dry-run
 */
import { PrismaClient } from "@prisma/client";
import {
  CLUSTER_RADIUS_M,
  haversineMeters,
} from "../src/lib/analysis/hotspots";
import { detectThermals } from "../src/lib/analysis/thermals";
import { parseIgcTrack } from "../src/lib/igc/parser";
import { requireDatabaseUrl, databaseHostLabel } from "./load-env";

const dryRun = process.argv.includes("--dry-run");

function summarizeThermals(
  thermals: {
    lat: number;
    lon: number;
    avgClimbKts: number;
    pilotName: string;
    year: number;
  }[],
) {
  const count = thermals.length;
  const lat = thermals.reduce((sum, thermal) => sum + thermal.lat, 0) / count;
  const lon = thermals.reduce((sum, thermal) => sum + thermal.lon, 0) / count;
  const avgClimbKts =
    thermals.reduce((sum, thermal) => sum + thermal.avgClimbKts, 0) / count;
  const years = [...new Set(thermals.map((thermal) => thermal.year))].sort(
    (a, b) => a - b,
  );
  const pilotNames = [
    ...new Set(thermals.map((thermal) => thermal.pilotName)),
  ].sort();
  return { lat, lon, avgClimbKts, count, years, pilotNames };
}

async function findNearbyHotspot(
  prisma: PrismaClient,
  lat: number,
  lon: number,
) {
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

async function recalculateHotspot(prisma: PrismaClient, hotspotId: string) {
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
    if (!dryRun) {
      await prisma.hotspot.delete({ where: { id: hotspotId } });
    }
    return "deleted" as const;
  }

  if (!dryRun) {
    await prisma.hotspot.update({
      where: { id: hotspotId },
      data: summarizeThermals(thermals),
    });
  }
  return "updated" as const;
}

async function main() {
  const databaseUrl = requireDatabaseUrl();
  console.log(`Using database at ${databaseHostLabel(databaseUrl)}`);

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    const flights = await prisma.flight.findMany({
      where: { excluded: false, igcContent: { not: null } },
      select: {
        id: true,
        pilotName: true,
        year: true,
        igcContent: true,
        thermals: { select: { hotspotId: true } },
      },
      orderBy: { flightDate: "asc" },
    });

    const affectedHotspotIds = new Set<string>();
    let flightsProcessed = 0;
    let flightsSkipped = 0;
    let thermalsWritten = 0;

    const totalFlights = flights.length;
    console.log(`Processing ${totalFlights} flights (this is quiet — progress every 25 flights)...`);

    for (const flight of flights) {
      if (!flight.igcContent || flight.igcContent.length < 100) {
        flightsSkipped += 1;
        continue;
      }

      for (const thermal of flight.thermals) {
        if (thermal.hotspotId) affectedHotspotIds.add(thermal.hotspotId);
      }

      const points = parseIgcTrack(flight.igcContent);
      const detected = detectThermals(points);

      if (!dryRun) {
        await prisma.thermal.deleteMany({ where: { flightId: flight.id } });

        for (const thermal of detected) {
          const nearby = await findNearbyHotspot(
            prisma,
            thermal.lat,
            thermal.lon,
          );
          await prisma.thermal.create({
            data: {
              flightId: flight.id,
              hotspotId: nearby?.id ?? null,
              lat: thermal.lat,
              lon: thermal.lon,
              avgClimbKts: thermal.avgClimbKts,
              avgClimbFpm: thermal.avgClimbFpm,
              startAltFt: thermal.startAltFt,
              altFt: thermal.endAltFt,
              startTimeSec: thermal.startTimeSec,
              endTimeSec: thermal.endTimeSec,
              durationSec: thermal.durationSec,
              pilotName: flight.pilotName,
              year: flight.year,
            },
          });
          thermalsWritten += 1;
          if (nearby?.id) affectedHotspotIds.add(nearby.id);
        }

        await prisma.flight.update({
          where: { id: flight.id },
          data: { analyzedAt: new Date() },
        });
      }

      flightsProcessed += 1;
      if (
        flightsProcessed % 25 === 0 ||
        flightsProcessed === totalFlights
      ) {
        console.log(
          `  flights ${flightsProcessed}/${totalFlights} · thermals written ${thermalsWritten}`,
        );
      }
    }

    const hotspotIds = [...affectedHotspotIds];
    console.log(`Recalculating ${hotspotIds.length} hotspots...`);

    let hotspotsUpdated = 0;
    let hotspotsDeleted = 0;
    for (let index = 0; index < hotspotIds.length; index += 1) {
      const hotspotId = hotspotIds[index];
      const result = await recalculateHotspot(prisma, hotspotId);
      if (result === "updated") hotspotsUpdated += 1;
      if (result === "deleted") hotspotsDeleted += 1;
      if (
        (index + 1) % 200 === 0 ||
        index + 1 === hotspotIds.length
      ) {
        console.log(`  hotspots ${index + 1}/${hotspotIds.length}`);
      }
    }

    const orphans = await prisma.hotspot.findMany({
      where: { thermals: { none: {} } },
      select: { id: true },
    });
    if (!dryRun && orphans.length > 0) {
      await prisma.hotspot.deleteMany({
        where: { id: { in: orphans.map((hotspot) => hotspot.id) } },
      });
    }

    const [dist] = await prisma.$queryRaw<
      {
        max_kts: number;
        ge_6_kts: number;
        ge_10_kts: number;
        with_start_alt: number;
      }[]
    >`
      SELECT
        ROUND(MAX("avgClimbKts")::numeric, 2)::float8 AS max_kts,
        COUNT(*) FILTER (WHERE "avgClimbKts" >= 6)::int AS ge_6_kts,
        COUNT(*) FILTER (WHERE "avgClimbKts" >= 10)::int AS ge_10_kts,
        COUNT(*) FILTER (WHERE "startAltFt" IS NOT NULL)::int AS with_start_alt
      FROM "Thermal"
    `;

    console.log(
      JSON.stringify(
        {
          dryRun,
          flightsProcessed,
          flightsSkipped,
          thermalsWritten,
          hotspotsUpdated,
          hotspotsDeleted: hotspotsDeleted + orphans.length,
          thermalDistributionAfter: dist,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
