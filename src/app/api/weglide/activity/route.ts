import { NextResponse } from "next/server";
import { fetchFlightsForSource } from "@/lib/weglide/client";
import { getDefaultClubSource, normalizeSyncSource } from "@/lib/sync/source";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const sourceType = searchParams.get("sourceType");
  const sourceId = Number(searchParams.get("sourceId"));
  const sourceLabel = searchParams.get("sourceLabel");

  if (!Number.isFinite(year)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const source = normalizeSyncSource(
    sourceType === "club" || sourceType === "airport"
      ? {
          type: sourceType,
          id: sourceId,
          label: sourceLabel ?? undefined,
        }
      : getDefaultClubSource(),
  );

  try {
    const flights = await fetchFlightsForSource(source, year);
    return NextResponse.json({ flights, totalFlights: flights.length, source });
  } catch (error) {
    const message = error instanceof Error ? error.message : "WeGlide request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
