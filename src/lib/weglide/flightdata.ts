import type { TrackPoint } from "@/types";
import { WEGLIDE_BASE_URL } from "./shared";

export type WeGlideFlightData = {
  id: number;
  time: number[];
  alt: number[];
  ground_alt?: number[];
  geom: {
    type: string;
    coordinates: [number, number][];
  };
  engine_sensor?: number[];
};

function buildFlightDataUrl(weglideId: number): string {
  return `${WEGLIDE_BASE_URL}/v1/flightdata/${weglideId}`;
}

export async function fetchFlightData(
  weglideId: number,
): Promise<WeGlideFlightData | null> {
  const apiKey = process.env.WEGLIDE_API_KEY;
  const headers: Record<string, string> = {
    Accept: "application/json",
    Referer: "https://www.weglide.org/",
    Origin: "https://www.weglide.org",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(buildFlightDataUrl(weglideId), {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as WeGlideFlightData;
  if (
    !Array.isArray(payload.time) ||
    !Array.isArray(payload.alt) ||
    !payload.geom?.coordinates?.length
  ) {
    return null;
  }

  return payload;
}

export function flightDataToTrackPoints(data: WeGlideFlightData): TrackPoint[] {
  const { time, alt, geom } = data;
  const coordinates = geom.coordinates;
  const count = Math.min(time.length, alt.length);
  if (count < 3) return [];

  const points: TrackPoint[] = [];
  const baseTime = time[0];

  for (let index = 0; index < count; index += 1) {
    const coordIndex = Math.min(
      coordinates.length - 1,
      Math.round((index / Math.max(count - 1, 1)) * (coordinates.length - 1)),
    );
    const [lon, lat] = coordinates[coordIndex];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    points.push({
      timeSec: time[index] - baseTime,
      lat,
      lon,
      altM: alt[index],
    });
  }

  return points;
}
