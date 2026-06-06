import { NextResponse } from "next/server";
import { searchAirports, searchClubs } from "@/lib/weglide/search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const query = searchParams.get("q") ?? "";

  if (type !== "club" && type !== "airport") {
    return NextResponse.json(
      { error: "type must be club or airport" },
      { status: 400 },
    );
  }

  if (query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    if (type === "airport") {
      const airports = await searchAirports(query);
      return NextResponse.json({
        results: airports.map((airport) => ({
          id: airport.id!,
          label: airport.name ?? airport.icao ?? `Airport ${airport.id}`,
          subtitle: airport.icao ?? null,
        })),
      });
    }

    const clubs = await searchClubs(query);
    return NextResponse.json({
      results: clubs.map((club) => ({
        id: club.id,
        label: club.name,
        subtitle:
          club.region ?? club.country?.name ?? club.country_name ?? null,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
