/**
 * Re-detect thermals from stored IGC and refresh hotspot stats without re-clustering.
 *
 *   npm run reanalyze-thermals
 *   npm run reanalyze-thermals -- --dry-run
 *   npm run reanalyze-thermals -- --database-url="postgresql://..."
 */
import { PrismaClient } from "@prisma/client";
import {
  CLUSTER_RADIUS_M,
  haversineMeters,
} from "../src/lib/analysis/hotspots";
import { detectThermals } from "../src/lib/analysis/thermals";
import { parseIgcTrack } from "../src/lib/igc/parser";
import { requireDatabaseUrl, databaseHostLabel } from "./load-env";

const databaseUrl = requireDatabaseUrl();
console.log(`Using database at ${databaseHostLabel(databaseUrl)}`);
const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
});
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

async function findNearbyHotspot(lat: number, lon: number) {
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

async function recalculateHotspot(hotspotId: string) {
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
  let recreated = 0;
  let skipped = 0;

  for (const flight of flights) {
    if (!flight.igcContent || flight.igcContent.length < 100) {
      skipped += 1;
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
        const nearby = await findNearbyHotspot(thermal.lat, thermal.lon);
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
        if (nearby?.id) affectedHotspotIds.add(nearby.id);
      }

      await prisma.flight.update({
        where: { id: flight.id },
        data: { analyzedAt: new Date() },
      });
    }

    recreated += 1;
  }

  let updatedHotspots = 0;
  let deletedHotspots = 0;
  for (const hotspotId of affectedHotspotIds) {
    const result = await recalculateHotspot(hotspotId);
    if (result === "updated") updatedHotspots += 1;
    if (result === "deleted") deletedHotspots += 1;
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
      n: number;
      max_kts: number;
      ge_6_kts: number;
      ge_10_kts: number;
    }[]
  >`
    SELECT
      COUNT(*)::int AS n,
      ROUND(MAX("avgClimbKts")::numeric, 2) AS max_kts,
      COUNT(*) FILTER (WHERE "avgClimbKts" >= 6)::int AS ge_6_kts,
      COUNT(*) FILTER (WHERE "avgClimbKts" >= 10)::int AS ge_10_kts
    FROM "Hotspot"
  `;

  console.log(
    JSON.stringify(
      {
        dryRun,
        flightsProcessed: recreated,
        flightsSkipped: skipped,
        hotspotsUpdated: updatedHotspots,
        hotspotsDeleted: deletedHotspots + orphans.length,
        orphanHotspotsRemoved: orphans.length,
        hotspotDistributionAfter: dist,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
