import type { OgnAircraftDto } from "@/types";

const MARKER_REGEX = /<m\s+[^>]*\ba="([^"]*)"[^>]*\/?>/g;

function metersToFeet(meters: number): number {
  return Math.round(meters * 3.28084);
}

function climbMpsToFpm(mps: number): number {
  return Math.round(mps * 196.850394);
}

export function parseLxmlMarkers(xml: string): OgnAircraftDto[] {
  const aircraft: OgnAircraftDto[] = [];

  for (const match of xml.matchAll(MARKER_REGEX)) {
    const raw = match[1];
    if (!raw.includes(",")) continue;

    const parts = raw.split(",");
    if (parts.length < 10) continue;

    const lat = Number(parts[0]);
    const lon = Number(parts[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const addrType = parts[2] ?? "";
    const deviceId = parts[3] ?? "";
    const altM = Number(parts[4]);
    const time = parts[5] ?? "";
    const groundSpeedKmh = Number(parts[7]);
    const trackDeg = Number(parts[8]);
    const climbMps = Number(parts[9]);
    const aircraftTypeCode = Number(parts[10]);
    const receiver = parts[11] ?? "";
    const trackId = parts[13] || deviceId;

    const anonymous =
      deviceId.startsWith("_") || addrType.startsWith("_") || deviceId === "";

    aircraft.push({
      id: trackId,
      lat,
      lon,
      callsign: anonymous ? "Anonymous" : deviceId,
      anonymous,
      addrType,
      altM: Number.isFinite(altM) ? altM : null,
      altFt: Number.isFinite(altM) ? metersToFeet(altM) : null,
      climbMps: Number.isFinite(climbMps) ? climbMps : null,
      climbFpm: Number.isFinite(climbMps) ? climbMpsToFpm(climbMps) : null,
      groundSpeedKmh: Number.isFinite(groundSpeedKmh) ? groundSpeedKmh : null,
      trackDeg: Number.isFinite(trackDeg) ? trackDeg : null,
      receiver,
      time,
      aircraftTypeCode: Number.isFinite(aircraftTypeCode)
        ? aircraftTypeCode
        : null,
    });
  }

  return aircraft;
}
