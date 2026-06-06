import { NextResponse } from "next/server";
import { formatServiceError } from "@/lib/errors";
import { importNextBatch } from "@/lib/sync/service";
import type { SyncSourceDto } from "@/types";

type ImportBody = {
  items?: Array<{ weglideId: number; igcContent: string | null }>;
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
    let body: ImportBody = {};
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      body = (await request.json()) as ImportBody;
    }

    const result = await importNextBatch(year, {
      browserItems: body.items,
      source: body.source,
      mode: body.mode ?? "incremental",
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = formatServiceError(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
