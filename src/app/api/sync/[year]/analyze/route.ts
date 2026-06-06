import { NextResponse } from "next/server";
import { formatServiceError } from "@/lib/errors";
import { analyzeYear } from "@/lib/sync/service";
import type { SyncSourceDto } from "@/types";

type AnalyzeBody = {
  source?: SyncSourceDto;
  incremental?: boolean;
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
    let body: AnalyzeBody = {};
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      body = (await request.json()) as AnalyzeBody;
    }

    const result = await analyzeYear(year, {
      source: body.source,
      incremental: body.incremental ?? true,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = formatServiceError(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
