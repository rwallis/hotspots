import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ThermalDto } from "@/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const pilot = searchParams.get("pilot");
    const year = yearParam ? Number(yearParam) : null;
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") ?? "12"), 1),
      50,
    );

    const hotspot = await prisma.hotspot.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!hotspot) {
      return NextResponse.json({ error: "Hotspot not found" }, { status: 404 });
    }

    const thermals = await prisma.thermal.findMany({
      where: {
        hotspotId: id,
        ...(year ? { year } : {}),
        ...(pilot ? { pilotName: pilot } : {}),
      },
      orderBy: [{ avgClimbKts: "desc" }, { durationSec: "desc" }],
      take: limit,
      select: {
        id: true,
        lat: true,
        lon: true,
        pilotName: true,
        avgClimbKts: true,
        avgClimbFpm: true,
        startAltFt: true,
        altFt: true,
        startTimeSec: true,
        endTimeSec: true,
        durationSec: true,
        year: true,
        flight: {
          select: {
            flightDate: true,
            weglideId: true,
          },
        },
      },
    });

    const items: ThermalDto[] = thermals.map((thermal) => {
      const flightDate = thermal.flight.flightDate;
      const dateLabel = flightDate.toISOString().slice(0, 10);
      const idSuffix =
        thermal.flight.weglideId != null ? ` ${thermal.flight.weglideId}` : "";

      return {
        id: thermal.id,
        lat: thermal.lat,
        lon: thermal.lon,
        pilot: thermal.pilotName,
        avgClimbKts: thermal.avgClimbKts,
        avgClimbFpm: thermal.avgClimbFpm,
        startAltFt: thermal.startAltFt,
        endAltFt: thermal.altFt,
        durationSec: thermal.durationSec,
        flightDate: dateLabel,
        flight: `${dateLabel} ${thermal.pilotName}${idSuffix}`,
        year: thermal.year,
      };
    });

    return NextResponse.json({ thermals: items });
  } catch (error) {
    console.error("hotspot thermals API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load thermals",
      },
      { status: 500 },
    );
  }
}
