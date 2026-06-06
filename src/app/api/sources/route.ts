import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveSourceLabel } from "@/lib/sync/source";
import type { SourceWithPilotsDto } from "@/types";

function sourceTypeOrder(type: string): number {
  if (type === "club") return 0;
  if (type === "airport") return 1;
  return 2;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? Number(yearParam) : null;

  const flights = await prisma.flight.findMany({
    where: year ? { year } : undefined,
    select: {
      sourceKey: true,
      sourceLabel: true,
      sourceType: true,
      pilotName: true,
    },
    orderBy: [{ sourceLabel: "asc" }, { pilotName: "asc" }],
  });

  const grouped = new Map<
    string,
    SourceWithPilotsDto & { pilotSet: Set<string> }
  >();

  for (const flight of flights) {
    const label = resolveSourceLabel(flight.sourceKey, flight.sourceLabel);
    const existing = grouped.get(flight.sourceKey);
    if (existing) {
      existing.pilotSet.add(flight.pilotName);
      existing.flightCount += 1;
      if (existing.label === existing.sourceKey || existing.label.startsWith("club:")) {
        existing.label = label;
      }
      continue;
    }

    grouped.set(flight.sourceKey, {
      sourceKey: flight.sourceKey,
      label,
      type: flight.sourceType.toLowerCase() as SourceWithPilotsDto["type"],
      pilots: [],
      flightCount: 1,
      pilotSet: new Set([flight.pilotName]),
    });
  }

  const sources = [...grouped.values()]
    .map(({ pilotSet, ...source }) => ({
      ...source,
      pilots: [...pilotSet].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => {
      const typeDiff = sourceTypeOrder(a.type) - sourceTypeOrder(b.type);
      if (typeDiff !== 0) return typeDiff;
      return a.label.localeCompare(b.label);
    });

  return NextResponse.json({ sources });
}
