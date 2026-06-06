import type { TrackPoint } from "@/types";

function parseLatitude(raw: string): number | null {
  const deg = Number(raw.slice(0, 2));
  const min = Number(raw.slice(2, 7)) / 1000;
  const hemisphere = raw[7];
  if (!Number.isFinite(deg) || !Number.isFinite(min)) return null;
  const value = deg + min / 60;
  return hemisphere === "S" ? -value : value;
}

function parseLongitude(raw: string): number | null {
  const deg = Number(raw.slice(0, 3));
  const min = Number(raw.slice(3, 8)) / 1000;
  const hemisphere = raw[8];
  if (!Number.isFinite(deg) || !Number.isFinite(min)) return null;
  const value = deg + min / 60;
  return hemisphere === "W" ? -value : value;
}

function parseBRecord(line: string): TrackPoint | null {
  if (!line.startsWith("B") || line.length < 35) return null;

  const hh = Number(line.slice(1, 3));
  const mm = Number(line.slice(3, 5));
  const ss = Number(line.slice(5, 7));
  if (![hh, mm, ss].every(Number.isFinite)) return null;

  const lat = parseLatitude(line.slice(7, 15));
  const lon = parseLongitude(line.slice(15, 24));
  if (lat === null || lon === null) return null;

  const altPressure = Number(line.slice(25, 30));
  const altGps = Number(line.slice(30, 35));
  const altM = Number.isFinite(altGps) && altGps > 0 ? altGps : altPressure;

  return {
    timeSec: hh * 3600 + mm * 60 + ss,
    lat,
    lon,
    altM: Number.isFinite(altM) ? altM : 0,
  };
}

export function parseIgcTrack(igcContent: string): TrackPoint[] {
  const points: TrackPoint[] = [];
  let dayOffset = 0;
  let previousTime = -1;

  for (const rawLine of igcContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("B")) continue;

    const point = parseBRecord(line);
    if (!point) continue;

    if (previousTime >= 0 && point.timeSec < previousTime) {
      dayOffset += 24 * 3600;
    }

    points.push({
      ...point,
      timeSec: point.timeSec + dayOffset,
    });
    previousTime = point.timeSec;
  }

  return points;
}

export type IgcMetadata = {
  pilotName: string | null;
  flightDate: Date | null;
};

/** IGC date field: DDMMYY, e.g. HFDTE140521 or HFDTE:140521 */
function parseIgcDateField(raw: string): Date | null {
  if (!/^\d{6}$/.test(raw)) return null;

  const day = Number(raw.slice(0, 2));
  const month = Number(raw.slice(2, 4));
  const year = 2000 + Number(raw.slice(4, 6));
  const parsed = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  if (Number.isNaN(parsed.getTime())) return null;
  if (
    parsed.getUTCDate() !== day ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCFullYear() !== year
  ) {
    return null;
  }

  return parsed;
}

export function parseIgcMetadata(igcContent: string): IgcMetadata {
  let pilotName: string | null = null;
  let flightDate: Date | null = null;

  for (const rawLine of igcContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!pilotName) {
      const pilotMatch = line.match(/^H(?:F)?PLTPIL(?:OT)?(?::\s*)?(.+)$/i);
      if (pilotMatch?.[1]) {
        pilotName = pilotMatch[1].trim();
      }
    }

    if (!flightDate) {
      const dateMatch = line.match(/^HFDTE(?:DATE)?(?::\s*)?(\d{6})\b/i);
      if (dateMatch?.[1]) {
        flightDate = parseIgcDateField(dateMatch[1]);
      }
    }

    if (pilotName && flightDate) break;
  }

  return { pilotName, flightDate };
}

export type RequiredIgcMetadata = {
  pilotName: string;
  flightDate: Date;
  year: number;
};

export function requireIgcMetadata(igcContent: string): RequiredIgcMetadata {
  const metadata = parseIgcMetadata(igcContent);

  if (!metadata.pilotName?.trim()) {
    throw new Error(
      "Invalid IGC: missing pilot name (HPLTPILOT header required)",
    );
  }

  if (!metadata.flightDate) {
    throw new Error(
      "Invalid IGC: missing flight date (HFDTE header required)",
    );
  }

  return {
    pilotName: metadata.pilotName.trim(),
    flightDate: metadata.flightDate,
    year: metadata.flightDate.getUTCFullYear(),
  };
}
