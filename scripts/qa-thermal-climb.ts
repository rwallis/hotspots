/**
 * QA: verify avgClimbKts = (endAlt - startAlt) / elapsed time.
 *
 *   npm run qa-thermal-climb
 */
import { PrismaClient } from "@prisma/client";
import { climbKtsMismatch, expectedClimbKts } from "../src/lib/analysis/climb";
import { requireDatabaseUrl, databaseHostLabel } from "./load-env";

async function main() {
  const databaseUrl = requireDatabaseUrl();
  console.log(`Connected to ${databaseHostLabel(databaseUrl)}`);

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    const [totals] = await prisma.$queryRaw<
      {
        total: number;
        missing_start: number;
        missing_end: number;
        missing_duration: number;
        ready: number;
      }[]
    >`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE "startAltFt" IS NULL)::int AS missing_start,
        COUNT(*) FILTER (WHERE "altFt" IS NULL)::int AS missing_end,
        COUNT(*) FILTER (WHERE "durationSec" IS NULL OR "durationSec" <= 0)::int AS missing_duration,
        COUNT(*) FILTER (
          WHERE "startAltFt" IS NOT NULL
            AND "altFt" IS NOT NULL
            AND "durationSec" > 0
        )::int AS ready
      FROM "Thermal"
    `;

    const mismatches = await prisma.$queryRaw<
      {
        id: string;
        avgClimbKts: number;
        startAltFt: number;
        altFt: number;
        durationSec: number;
        expected_kts: number;
        delta_kts: number;
      }[]
    >`
      SELECT
        id,
        "avgClimbKts",
        "startAltFt",
        "altFt",
        "durationSec",
        ROUND(
          (("altFt" - "startAltFt") / 3.28084 / "durationSec" * 1.94384)::numeric,
          3
        )::float8 AS expected_kts,
        ROUND(
          ABS(
            "avgClimbKts" -
            (("altFt" - "startAltFt") / 3.28084 / "durationSec" * 1.94384)
          )::numeric,
          3
        )::float8 AS delta_kts
      FROM "Thermal"
      WHERE "startAltFt" IS NOT NULL
        AND "altFt" IS NOT NULL
        AND "durationSec" > 0
        AND ABS(
          "avgClimbKts" -
          (("altFt" - "startAltFt") / 3.28084 / "durationSec" * 1.94384)
        ) > 0.05
      ORDER BY delta_kts DESC
      LIMIT 25
    `;

    const sample = await prisma.thermal.findMany({
      where: {
        startAltFt: { not: null },
        altFt: { not: null },
        durationSec: { gt: 0 },
      },
      take: 5,
      orderBy: { avgClimbKts: "desc" },
      select: {
        id: true,
        avgClimbKts: true,
        startAltFt: true,
        altFt: true,
        durationSec: true,
      },
    });

    const sampleChecked = sample.map((thermal) => {
      const startAltFt = thermal.startAltFt!;
      const endAltFt = thermal.altFt!;
      const expected = expectedClimbKts(
        startAltFt,
        endAltFt,
        thermal.durationSec,
      );
      return {
        ...thermal,
        expectedKts: expected,
        ok: !climbKtsMismatch(
          thermal.avgClimbKts,
          startAltFt,
          endAltFt,
          thermal.durationSec,
        ),
      };
    });

    const mismatchCount =
      totals.ready > 0
        ? (
            await prisma.$queryRaw<{ n: number }[]>`
              SELECT COUNT(*)::int AS n
              FROM "Thermal"
              WHERE "startAltFt" IS NOT NULL
                AND "altFt" IS NOT NULL
                AND "durationSec" > 0
                AND ABS(
                  "avgClimbKts" -
                  (("altFt" - "startAltFt") / 3.28084 / "durationSec" * 1.94384)
                ) > 0.05
            `
          )[0].n
        : 0;

    console.log(
      JSON.stringify(
        {
          formula:
            "avgClimbKts = ((endAltFt - startAltFt) / 3.28084) / durationSec * 1.94384",
          totals,
          mismatchCount,
          mismatchRate:
            totals.ready > 0 ? mismatchCount / totals.ready : null,
          topMismatches: mismatches,
          sampleChecked,
          recommendation:
            totals.missing_start > 0
              ? "Run npm run recalculate-climb-rates to backfill startAltFt and recalc climb."
              : mismatchCount > 0
                ? "Run npm run recalculate-climb-rates to fix mismatched climb rates."
                : "Climb rates match start/end altitude and duration.",
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
