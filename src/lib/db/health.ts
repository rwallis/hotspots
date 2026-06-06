import { prisma } from "@/lib/db";

const SYNC_STATE_COLUMNS = [
  "sourceType",
  "sourceId",
  "sourceLabel",
  "cachedFlights",
  "analysisPhase",
  "hotspotsProcessed",
  "hotspotsTotal",
] as const;

const FLIGHT_COLUMNS = [
  "sourceType",
  "sourceKey",
  "sourceLabel",
  "uploadId",
  "launchAirportIcao",
  "rawJson",
] as const;

export type DbHealthResult = {
  ok: boolean;
  message: string;
  missingColumns?: string[];
};

async function findMissingColumns(
  table: string,
  columns: readonly string[],
): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${table}
  `;
  const present = new Set(rows.map((row) => row.column_name));
  return columns.filter((column) => !present.has(column));
}

export async function checkDbHealth(): Promise<DbHealthResult> {
  try {
    const syncMissing = await findMissingColumns("SyncState", SYNC_STATE_COLUMNS);
    const flightMissing = await findMissingColumns("Flight", FLIGHT_COLUMNS);
    const missingColumns = [
      ...syncMissing.map((column) => `SyncState.${column}`),
      ...flightMissing.map((column) => `Flight.${column}`),
    ];

    if (missingColumns.length > 0) {
      return {
        ok: false,
        missingColumns,
        message: `Database schema is out of date. Missing: ${missingColumns.join(", ")}. Run: node node_modules/prisma/build/index.js db push`,
      };
    }

    await prisma.syncState.findFirst({ select: { year: true } });
    return { ok: true, message: "Database schema is up to date." };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Database health check failed";
    return {
      ok: false,
      message: `Database unavailable: ${message}`,
    };
  }
}
