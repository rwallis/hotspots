import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import { requireDatabaseUrl, databaseHostLabel } from "./load-env";

async function main() {
  const databaseUrl = requireDatabaseUrl();
  console.log(`Using database at ${databaseHostLabel(databaseUrl)}`);

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    const out: Record<string, unknown> = {};

    out.counts = {
      hotspots: await prisma.hotspot.count(),
      thermals: await prisma.thermal.count(),
      flights: await prisma.flight.count(),
    };

    const [hotspotDist] = await prisma.$queryRaw<
      Record<string, number>[]
    >`
      SELECT
        COUNT(*)::int AS n,
        ROUND(MIN("avgClimbKts")::numeric, 2)::float8 AS min_kts,
        ROUND(MAX("avgClimbKts")::numeric, 2)::float8 AS max_kts,
        ROUND(AVG("avgClimbKts")::numeric, 2)::float8 AS avg_kts,
        ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "avgClimbKts"))::numeric, 2)::float8 AS p50,
        ROUND((PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY "avgClimbKts"))::numeric, 2)::float8 AS p90,
        ROUND((PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY "avgClimbKts"))::numeric, 2)::float8 AS p99,
        COUNT(*) FILTER (WHERE "avgClimbKts" >= 6)::int AS ge_6_kts,
        COUNT(*) FILTER (WHERE "avgClimbKts" >= 10)::int AS ge_10_kts
      FROM "Hotspot"
    `;
    out.hotspotClimbDistribution = hotspotDist;

    out.topHotspots = await prisma.hotspot.findMany({
      orderBy: { avgClimbKts: "desc" },
      take: 15,
      select: {
        id: true,
        name: true,
        lat: true,
        lon: true,
        avgClimbKts: true,
        count: true,
        years: true,
        pilotNames: true,
      },
    });

    const [thermalDist] = await prisma.$queryRaw<
      Record<string, number>[]
    >`
      SELECT
        COUNT(*)::int AS n,
        ROUND(MAX("avgClimbKts")::numeric, 2)::float8 AS max_kts,
        COUNT(*) FILTER (WHERE "avgClimbKts" >= 6)::int AS ge_6_kts,
        COUNT(*) FILTER (WHERE "avgClimbKts" >= 10)::int AS ge_10_kts,
        COUNT(*) FILTER (WHERE "altFt" IS NULL)::int AS missing_alt_ft
      FROM "Thermal"
    `;
    out.thermalClimbDistribution = thermalDist;

    out.suspiciousThermals = await prisma.$queryRaw`
      SELECT t."avgClimbKts", t."altFt", t."durationSec", t."pilotName", t.year,
             f."flightDate", f."launchAirportIcao"
      FROM "Thermal" t
      JOIN "Flight" f ON f.id = t."flightId"
      WHERE t."avgClimbKts" >= 6
      ORDER BY t."avgClimbKts" DESC
      LIMIT 20
    `;

    out.topAltByHotspot = await prisma.$queryRaw`
      SELECT h.name, h."avgClimbKts", h.count,
             ROUND(MAX(t."altFt")::numeric, 0)::int AS max_top_alt_ft
      FROM "Hotspot" h
      JOIN "Thermal" t ON t."hotspotId" = h.id
      GROUP BY h.id, h.name, h."avgClimbKts", h.count
      ORDER BY h."avgClimbKts" DESC
      LIMIT 15
    `;

    writeFileSync("qa-db-results.json", JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
