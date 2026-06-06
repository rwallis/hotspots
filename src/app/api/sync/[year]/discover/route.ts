import { NextResponse } from "next/server";
import { formatServiceError } from "@/lib/errors";
import { discoverFlightsForYear } from "@/lib/sync/service";
import type { SyncSourceDto } from "@/types";
import type { WeGlideFlight } from "@/lib/weglide/types";

type DiscoverBody = {
  flights?: WeGlideFlight[];
  source?: SyncSourceDto;
  mode?: "incremental" | "replace";
};

export async function POST(
  request: Request,
  context: { params: Promise<{ year: string }> },
) {
  const { year: yearParam } = await context.params;
  const year = Number(yearParam);

  if (!Number.isFinite(year)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  try {
    let body: DiscoverBody = {};
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      body = (await request.json()) as DiscoverBody;
    }

    const result = await discoverFlightsForYear(year, {
      browserFlights: body.flights,
      source: body.source,
      mode: body.mode ?? "incremental",
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = formatServiceError(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
