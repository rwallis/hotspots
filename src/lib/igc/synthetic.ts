import type { TrackPoint } from "@/types";

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

function formatLatitude(lat: number): string {
  const hemisphere = lat >= 0 ? "N" : "S";
  const absolute = Math.abs(lat);
  const degrees = Math.floor(absolute);
  const minutes = (absolute - degrees) * 60;
  return `${pad(degrees)}${pad(Math.round(minutes * 1000), 5)}${hemisphere}`;
}

function formatLongitude(lon: number): string {
  const hemisphere = lon >= 0 ? "E" : "W";
  const absolute = Math.abs(lon);
  const degrees = Math.floor(absolute);
  const minutes = (absolute - degrees) * 60;
  return `${pad(degrees, 3)}${pad(Math.round(minutes * 1000), 5)}${hemisphere}`;
}

function formatUtcTime(timeSec: number): string {
  const total = Math.max(0, Math.round(timeSec));
  const hours = Math.floor(total / 3600) % 24;
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${pad(hours)}${pad(minutes)}${pad(seconds)}`;
}

function formatAltitudeMeters(altM: number): string {
  const value = Math.max(0, Math.round(altM));
  return pad(value, 5);
}

export function trackPointsToIgc(points: TrackPoint[]): string {
  const lines = [
    "HFDTESYNTHETIC",
    "HFFXAWeGlide-Flightdata",
    "HFPLTPILOT:WeGlide",
  ];

  for (const point of points) {
    lines.push(
      `B${formatUtcTime(point.timeSec)}${formatLatitude(point.lat)}${formatLongitude(point.lon)}A${formatAltitudeMeters(point.altM)}${formatAltitudeMeters(point.altM)}`,
    );
  }

  return `${lines.join("\n")}\n`;
}
