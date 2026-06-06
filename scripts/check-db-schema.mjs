import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SYNC_STATE_COLUMNS = [
  "sourceType",
  "sourceId",
  "sourceLabel",
  "cachedFlights",
  "analysisPhase",
  "hotspotsProcessed",
  "hotspotsTotal",
];

const FLIGHT_COLUMNS = [
  "sourceType",
  "sourceKey",
  "sourceLabel",
  "uploadId",
  "launchAirportIcao",
  "rawJson",
];

async function findMissing(table, columns) {
  const rows = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${table}
  `;
  const present = new Set(rows.map((row) => row.column_name));
  return columns.filter((column) => !present.has(column));
}

try {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.includes("@") ? url.split("@")[1]?.split("/")[0] : "unknown";
  console.log(`DATABASE host: ${host}`);

  const syncMissing = await findMissing("SyncState", SYNC_STATE_COLUMNS);
  const flightMissing = await findMissing("Flight", FLIGHT_COLUMNS);
  console.log("SyncState missing:", syncMissing.length ? syncMissing.join(", ") : "none");
  console.log("Flight missing:", flightMissing.length ? flightMissing.join(", ") : "none");

  if (syncMissing.length === 0 && flightMissing.length === 0) {
    const state = await prisma.syncState.findUnique({ where: { year: 2022 } });
    console.log("SyncState 2022 status:", state?.status ?? "not found");
    console.log("SyncState 2022 error:", state?.errorMessage ?? "none");
  }
} catch (error) {
  console.error("Check failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
