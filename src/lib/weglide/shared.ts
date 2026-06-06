import type { WeGlideFlight } from "./types";

export const WEGLIDE_BASE_URL = "https://api.weglide.org";
export const DEFAULT_CLUB_ID = 1006;
export const MIN_DURATION_SECONDS = 30 * 60;

export function normalizeFlights(payload: unknown): WeGlideFlight[] {
  if (Array.isArray(payload)) {
    return payload as WeGlideFlight[];
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["results", "items", "flights", "data", "rank_list"]) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value as WeGlideFlight[];
      }
    }
  }

  return [];
}

export function getFlightDurationSeconds(flight: WeGlideFlight): number {
  if (flight.takeoff_time && flight.landing_time) {
    const start = new Date(flight.takeoff_time).getTime();
    const end = new Date(flight.landing_time).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      return Math.round((end - start) / 1000);
    }
  }

  const raw = flight.duration ?? flight.time ?? flight.flight_time ?? 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value <= 600) return value * 60;
  return value;
}

function readIgcFileRefId(
  value: WeGlideFlight["igcfile"] | WeGlideFlight["igc_file"],
): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (value && typeof value === "object") {
    const id = Number(value.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  return null;
}

export function getFlightIgcFileId(flight: WeGlideFlight): number | null {
  const raw =
    flight.igcfile_id ??
    flight.igc_file_id ??
    readIgcFileRefId(flight.igc_file) ??
    readIgcFileRefId(flight.igcfile) ??
    null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function getFlightIgcDownloadPath(flight: WeGlideFlight): string | null {
  const refs = [flight.igc_file, flight.igcfile];
  for (const ref of refs) {
    if (ref && typeof ref === "object" && typeof ref.file === "string") {
      const trimmed = ref.file.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

export function getPilotName(flight: WeGlideFlight): string {
  return (
    flight.user?.name ??
    flight.pilot?.name ??
    (typeof flight.pilot_name === "string" ? flight.pilot_name : "Unknown pilot")
  );
}

export function getPilotUserId(flight: WeGlideFlight): number | null {
  const raw = flight.user?.id ?? flight.pilot?.id ?? null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function filterQualifyingFlights(flights: WeGlideFlight[]): WeGlideFlight[] {
  return flights.filter(
    (flight) => getFlightDurationSeconds(flight) >= MIN_DURATION_SECONDS,
  );
}

export function buildFlightListUrl(
  year: number,
  clubId: number = DEFAULT_CLUB_ID,
  skip = 0,
  limit = 100,
): string {
  const query = new URLSearchParams({
    club_id_in: String(clubId),
    season_in: String(year),
    scoring_date_start: `${year}-01-01`,
    scoring_date_end: `${year}-12-31`,
    limit: String(limit),
    skip: String(skip),
  });
  return `${WEGLIDE_BASE_URL}/v1/flight?${query.toString()}`;
}

export function buildFlightListUrlForSource(
  year: number,
  sourceType: "club" | "airport",
  sourceId: number,
  skip = 0,
  limit = 100,
): string {
  const query = new URLSearchParams({
    season_in: String(year),
    scoring_date_start: `${year}-01-01`,
    scoring_date_end: `${year}-12-31`,
    limit: String(limit),
    skip: String(skip),
  });

  if (sourceType === "club") {
    query.set("club_id_in", String(sourceId));
  } else {
    query.set("airport_id_in", String(sourceId));
  }

  return `${WEGLIDE_BASE_URL}/v1/flight?${query.toString()}`;
}

export function buildIgcFileUrl(igcfileId: number): string {
  return `${WEGLIDE_BASE_URL}/v1/igcfile/${igcfileId}`;
}

export function buildFlightByIdUrl(weglideId: number): string {
  const query = new URLSearchParams({
    id_in: String(weglideId),
    limit: "1",
  });
  return `${WEGLIDE_BASE_URL}/v1/flight?${query.toString()}`;
}

export function buildFlightDetailUrl(weglideId: number): string {
  return `${WEGLIDE_BASE_URL}/v1/flightdetail/${weglideId}`;
}
