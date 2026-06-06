import { NextResponse } from "next/server";
import { fetchIgcFile } from "@/lib/weglide/client";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: idParam } = await context.params;
  const id = Number(idParam);

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid IGC file id" }, { status: 400 });
  }

  try {
    const igc = await fetchIgcFile(id);
    return NextResponse.json(igc);
  } catch (error) {
    const message = error instanceof Error ? error.message : "WeGlide request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
