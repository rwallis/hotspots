import type { OgnAircraftDto } from "@/types";

export type OgnFlightMode = "climb" | "sink" | "cruise";

export function ognFlightMode(aircraft: OgnAircraftDto): OgnFlightMode {
  if (aircraft.climbMps != null && aircraft.climbMps > 0.5) return "climb";
  if (aircraft.climbMps != null && aircraft.climbMps < -0.5) return "sink";
  return "cruise";
}

/** Dark, high-contrast colors for map markers. */
export function ognMarkerColor(mode: OgnFlightMode): string {
  switch (mode) {
    case "climb":
      return "#047857";
    case "sink":
      return "#c2410c";
    default:
      return "#0369a1";
  }
}

/** Short callsign shown beside the glider (e.g. S2H, MG). */
export function ognMapLabel(aircraft: OgnAircraftDto): string {
  if (aircraft.anonymous) return "?";

  const type = aircraft.addrType.trim();
  if (type && !type.startsWith("_") && type.length <= 6) {
    return type.toUpperCase();
  }

  const callsign = aircraft.callsign.trim();
  if (callsign.length > 0) {
    return callsign.toUpperCase();
  }

  return "?";
}

/** @deprecated Use ognMapLabel */
export function ognShortLabel(aircraft: OgnAircraftDto): string {
  return ognMapLabel(aircraft);
}

export function ognHeadingDeg(aircraft: OgnAircraftDto): number {
  if (aircraft.trackDeg != null && Number.isFinite(aircraft.trackDeg)) {
    return aircraft.trackDeg;
  }
  return 0;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildGliderMarkerHtml(aircraft: OgnAircraftDto): string {
  const mode = ognFlightMode(aircraft);
  const color = ognMarkerColor(mode);
  const label = escapeHtml(ognMapLabel(aircraft));
  const heading = ognHeadingDeg(aircraft);
  const modeClass =
    mode === "climb"
      ? "ogn-marker--climb"
      : mode === "sink"
        ? "ogn-marker--sink"
        : "ogn-marker--cruise";

  return `
    <div class="ogn-marker ${modeClass}" style="--ogn-fill:${color}">
      <div class="ogn-marker__craft" style="transform:rotate(${heading}deg)">
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path class="ogn-marker__wing" d="M2 24.2C11 20.8 18.5 20.2 24 20.2s13 0.6 22 4v1.6c-9 3.2-15.5 3.8-22 3.8s-13-0.6-22-3.8v-1.6z" />
          <path class="ogn-marker__fuse" d="M24 5.5c1.2 2.8 1.8 7.2 1.6 12.2-.1 3.2-.6 6.8-1 10.2-.4 3.2-.9 6.2-1.4 8.8-.3 1.4-.6 2.4-.8 3.1 0 .2-.1.3-.1.3s-.1-.1-.1-.3c-.2-.7-.5-1.7-.8-3.1-.5-2.6-1-5.6-1.4-8.8-.4-3.4-.9-7-1-10.2-.2-5 .4-9.4 1.6-12.2z" />
          <ellipse class="ogn-marker__canopy" cx="24" cy="13.5" rx="1.6" ry="2.8" />
          <path class="ogn-marker__tail" d="M20.2 34.2 24 40.5 27.8 34.2" />
        </svg>
      </div>
      <div class="ogn-marker__label">${label}</div>
    </div>
  `;
}

export function kmhToKts(kmh: number): number {
  return kmh / 1.852;
}
