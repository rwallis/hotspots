import { NextResponse } from "next/server";
import { fetchIgcContentForFlight } from "@/lib/weglide/igc";
import { fetchFlightDetail } from "@/lib/weglide/client";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: idParam } = await context.params;
  const weglideId = Number(idParam);

  if (!Number.isFinite(weglideId)) {
    return NextResponse.json({ error: "Invalid flight id" }, { status: 400 });
  }

  try {
    const flight = await fetchFlightDetail(weglideId);
    const result = await fetchIgcContentForFlight(flight);
    return NextResponse.json({
      ...result,
      igcFileId: result.igcfileId,
      protected: flight.protected ?? false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "IGC fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
