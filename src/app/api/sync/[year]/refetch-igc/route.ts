import { NextResponse } from "next/server";
import { formatServiceError } from "@/lib/errors";
import { refetchIgcForYear } from "@/lib/sync/service";
import type { SyncSourceDto } from "@/types";

type RefetchBody = {
  source?: SyncSourceDto;
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
    let body: RefetchBody = {};
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      body = (await request.json()) as RefetchBody;
    }

    const result = await refetchIgcForYear(year, {
      source: body.source,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = formatServiceError(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
