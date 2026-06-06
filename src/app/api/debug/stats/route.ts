import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseIgcTrack } from "@/lib/igc/parser";
import { detectThermals } from "@/lib/analysis/thermals";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year") ?? new Date().getFullYear());

  const flights = await prisma.flight.findMany({
    where: Number.isFinite(year) ? { year } : undefined,
    orderBy: { flightDate: "desc" },
    take: 200,
  });

  const withIgc = flights.filter(
    (flight) => (flight.igcContent?.length ?? 0) > 100,
  );
  const sample = withIgc[0] ?? flights[0];
  const samplePoints = sample?.igcContent
    ? parseIgcTrack(sample.igcContent).length
    : 0;
  const sampleThermals = sample?.igcContent
    ? detectThermals(parseIgcTrack(sample.igcContent)).length
    : 0;

  const [thermalCount, hotspotCount] = await Promise.all([
    prisma.thermal.count(Number.isFinite(year) ? { where: { year } } : undefined),
    prisma.hotspot.count(),
  ]);

  return NextResponse.json({
    year,
    totalFlights: flights.length,
    flightsWithIgc: withIgc.length,
    flightsMissingIgc: flights.length - withIgc.length,
    thermalCount,
    hotspotCount,
    sample: sample
      ? {
          weglideId: sample.weglideId,
          pilotName: sample.pilotName,
          igcLength: sample.igcContent?.length ?? 0,
          igcPreview: sample.igcContent?.slice(0, 120) ?? null,
          trackPoints: samplePoints,
          thermalsDetected: sampleThermals,
        }
      : null,
  });
}
