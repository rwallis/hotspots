import { NextResponse } from "next/server";
import { listSyncYears } from "@/lib/sync/service";

export async function GET() {
  const years = await listSyncYears();
  return NextResponse.json({ years });
}
