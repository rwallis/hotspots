import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { HotspotDto } from "@/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const pilot = searchParams.get("pilot");
    const year = yearParam ? Number(yearParam) : null;

    const hotspots = await prisma.hotspot.findMany({
      where: {
        ...(year ? { years: { has: year } } : {}),
        ...(pilot ? { pilotNames: { has: pilot } } : {}),
      },
      orderBy: [{ avgClimbKts: "desc" }, { count: "desc" }],
      select: {
        id: true,
        name: true,
        lat: true,
        lon: true,
        avgClimbKts: true,
        count: true,
        years: true,
        pilotNames: true,
      },
    });

    let yearCounts: Map<string, number> | null = null;
    if (year) {
      const groups = await prisma.thermal.groupBy({
        by: ["hotspotId"],
        where: { year, hotspotId: { not: null } },
        _count: { _all: true },
      });
      yearCounts = new Map(
        groups
          .filter((group) => group.hotspotId)
          .map((group) => [group.hotspotId!, group._count._all]),
      );
    }

    const hotspotIds = hotspots.map((hotspot) => hotspot.id);

    let topAltByHotspot = new Map<string, number>();
    if (hotspotIds.length > 0) {
      const altGroups = await prisma.thermal.groupBy({
        by: ["hotspotId"],
        where: {
          hotspotId: { in: hotspotIds },
          altFt: { not: null },
          ...(year ? { year } : {}),
        },
        _max: { altFt: true },
      });

      topAltByHotspot = new Map(
        altGroups
          .filter((group) => group.hotspotId && group._max.altFt != null)
          .map((group) => [group.hotspotId!, group._max.altFt!]),
      );
    }

    const filtered: HotspotDto[] = hotspots
      .map((hotspot) => {
        const count =
          year && yearCounts
            ? (yearCounts.get(hotspot.id) ?? 0)
            : hotspot.count;

        return {
          id: hotspot.id,
          name: hotspot.name,
          lat: hotspot.lat,
          lon: hotspot.lon,
          avgClimbKts: hotspot.avgClimbKts,
          topAltFt: topAltByHotspot.get(hotspot.id) ?? null,
          count,
          pilot: hotspot.pilotNames[0] ?? "Unknown",
          pilots: hotspot.pilotNames,
          years: hotspot.years,
        } satisfies HotspotDto;
      })
      .filter((hotspot) => !year || hotspot.count > 0);

    return NextResponse.json({ hotspots: filtered });
  } catch (error) {
    console.error("hotspots API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load hotspots",
      },
      { status: 500 },
    );
  }
}
