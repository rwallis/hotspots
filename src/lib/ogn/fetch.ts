import { parseLxmlMarkers } from "@/lib/ogn/parse";
import type { OgnAircraftDto } from "@/types";

const OGN_LIVE_BASE = "http://live.glidernet.org";

export type OgnBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

function buildLxmlUrl(bounds: OgnBounds): string {
  const params = new URLSearchParams({
    a: "0",
    b: String(bounds.north),
    c: String(bounds.south),
    d: String(bounds.east),
    e: String(bounds.west),
    z: "2",
    // ICAO (0x1) + FLARM (0x2) + OGN (0x4) — y=6 alone misses ICAO-mode gliders
    y: "7",
  });

  return `${OGN_LIVE_BASE}/lxml.php?${params.toString()}`;
}

export async function fetchOgnLiveAircraft(
  bounds: OgnBounds,
): Promise<OgnAircraftDto[]> {
  const response = await fetch(buildLxmlUrl(bounds), {
    cache: "no-store",
    headers: {
      Accept: "application/xml, text/xml, */*",
      "User-Agent": "Hotspots/0.1 (OGN live overlay; +https://github.com/rwallis/hotspots)",
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`OGN live feed returned ${response.status}`);
  }

  const xml = await response.text();
  return parseLxmlMarkers(xml);
}
