import { PrismaClient } from "@prisma/client";
import { requireDatabaseUrl, databaseHostLabel } from "./load-env";

async function main() {
  const databaseUrl = requireDatabaseUrl();
  console.log(`Connected to ${databaseHostLabel(databaseUrl)}`);

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    const [counts] = await prisma.$queryRaw<
      {
        flights: number;
        thermals: number;
        hotspots: number;
        analyzed_last_10m: number;
        analyzed_last_1h: number;
        latest_analyzed: Date | null;
      }[]
    >`
      SELECT
        (SELECT COUNT(*)::int FROM "Flight" WHERE excluded = false) AS flights,
        (SELECT COUNT(*)::int FROM "Thermal") AS thermals,
        (SELECT COUNT(*)::int FROM "Hotspot") AS hotspots,
        (SELECT COUNT(*)::int FROM "Flight"
          WHERE excluded = false AND "analyzedAt" >= NOW() - INTERVAL '10 minutes') AS analyzed_last_10m,
        (SELECT COUNT(*)::int FROM "Flight"
          WHERE excluded = false AND "analyzedAt" >= NOW() - INTERVAL '1 hour') AS analyzed_last_1h,
        (SELECT MAX("analyzedAt") FROM "Flight" WHERE excluded = false) AS latest_analyzed
    `;

    const [dist] = await prisma.$queryRaw<
      {
        max_kts: number;
        ge_6_kts: number;
        ge_10_kts: number;
      }[]
    >`
      SELECT
        ROUND(MAX("avgClimbKts")::numeric, 2)::float8 AS max_kts,
        COUNT(*) FILTER (WHERE "avgClimbKts" >= 6)::int AS ge_6_kts,
        COUNT(*) FILTER (WHERE "avgClimbKts" >= 10)::int AS ge_10_kts
      FROM "Hotspot"
    `;

    console.log(JSON.stringify({ counts, hotspotClimb: dist }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
