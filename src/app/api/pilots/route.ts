import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? Number(yearParam) : null;

  const flights = await prisma.flight.findMany({
    where: year ? { year } : undefined,
    select: { pilotName: true },
    distinct: ["pilotName"],
    orderBy: { pilotName: "asc" },
  });

  return NextResponse.json({
    pilots: flights.map((flight) => flight.pilotName),
  });
}
