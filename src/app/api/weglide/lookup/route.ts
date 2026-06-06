import { NextResponse } from "next/server";
import {
  lookupAirportById,
  lookupClubById,
  parseSourceToken,
} from "@/lib/weglide/search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const token = searchParams.get("token") ?? "";

  if (type !== "club" && type !== "airport") {
    return NextResponse.json(
      { error: "type must be club or airport" },
      { status: 400 },
    );
  }

  const parsed = parseSourceToken(token);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid club or airport token" }, { status: 400 });
  }

  try {
    if (type === "club") {
      const club = await lookupClubById(parsed.id);
      if (!club) {
        return NextResponse.json(
          {
            result: {
              id: parsed.id,
              label: parsed.label ?? `Club ${parsed.id}`,
              subtitle: null,
            },
          },
          { status: 200 },
        );
      }

      return NextResponse.json({
        result: {
          id: club.id,
          label: club.name,
          subtitle: club.region ?? club.country?.name ?? club.country_name ?? null,
        },
      });
    }

    const airport = await lookupAirportById(parsed.id);
    if (!airport) {
      return NextResponse.json(
        {
          result: {
            id: parsed.id,
            label: parsed.label ?? `Airport ${parsed.id}`,
            subtitle: null,
          },
        },
        { status: 200 },
      );
    }

    return NextResponse.json({
      result: {
        id: airport.id!,
        label: airport.name ?? airport.icao ?? `Airport ${airport.id}`,
        subtitle: airport.icao ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lookup failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
