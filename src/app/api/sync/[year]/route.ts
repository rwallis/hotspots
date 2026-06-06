import { NextResponse } from "next/server";
import { getSyncStatus } from "@/lib/sync/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ year: string }> },
) {
  const { year: yearParam } = await context.params;
  const year = Number(yearParam);

  if (!Number.isFinite(year)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const status = await getSyncStatus(year);
  return NextResponse.json(status);
}
