import { NextResponse } from "next/server";
import { fetchOgnLiveAircraft, type OgnBounds } from "@/lib/ogn/fetch";

export const dynamic = "force-dynamic";

function parseBounds(searchParams: URLSearchParams): OgnBounds | null {
  const north = Number(searchParams.get("north"));
  const south = Number(searchParams.get("south"));
  const east = Number(searchParams.get("east"));
  const west = Number(searchParams.get("west"));

  if (
    !Number.isFinite(north) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(west)
  ) {
    return null;
  }

  if (north <= south || east <= west) {
    return null;
  }

  const latSpan = north - south;
  const lonSpan = east - west;
  if (latSpan > 25 || lonSpan > 25) {
    return null;
  }

  return { north, south, east, west };
}

export async function GET(request: Request) {
  const bounds = parseBounds(new URL(request.url).searchParams);
  if (!bounds) {
    return NextResponse.json(
      { error: "Invalid bounds. Provide north, south, east, and west." },
      { status: 400 },
    );
  }

  try {
    const aircraft = await fetchOgnLiveAircraft(bounds);
    return NextResponse.json({
      aircraft,
      fetchedAt: new Date().toISOString(),
      attribution: "Live data © Open Glider Network (ODbL)",
    });
  } catch (error) {
    console.error("OGN live API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load OGN live data",
      },
      { status: 502 },
    );
  }
}
