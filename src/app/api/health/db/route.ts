import { NextResponse } from "next/server";
import { checkDbHealth } from "@/lib/db/health";

export async function GET() {
  const health = await checkDbHealth();
  return NextResponse.json(health, { status: health.ok ? 200 : 503 });
}
