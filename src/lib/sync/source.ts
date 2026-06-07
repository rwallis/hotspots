export type SyncSourceType = "club" | "airport";

export type SyncSource = {
  type: SyncSourceType;
  id: number;
  label: string;
};

const KNOWN_SOURCE_LABELS: Record<string, string> = {
  "club:1006": "Fault Line Flyers",
  "club:927": "Chicago Glider Club",
};

export function buildSourceKey(type: SyncSourceType, id: number): string {
  return `${type}:${id}`;
}

export function resolveSourceLabel(
  sourceKey: string,
  sourceLabel?: string | null,
): string {
  const trimmed = sourceLabel?.trim();
  if (
    trimmed &&
    trimmed !== sourceKey &&
    !/^(club|airport):\d+$/i.test(trimmed)
  ) {
    return trimmed;
  }
  return KNOWN_SOURCE_LABELS[sourceKey] ?? trimmed ?? sourceKey;
}

export function parseSourceKey(
  sourceKey: string,
): { type: SyncSourceType; id: number } | null {
  const [type, idRaw] = sourceKey.split(":");
  const id = Number(idRaw);
  if ((type !== "club" && type !== "airport") || !Number.isFinite(id)) {
    return null;
  }
  return { type, id };
}

export function getDefaultClubSource(): SyncSource {
  const id = Number(process.env.WEGLIDE_CLUB_ID ?? "1006");
  return {
    type: "club",
    id,
    label: "Fault Line Flyers",
  };
}

export function normalizeSyncSource(
  input?: Partial<SyncSource> | null,
): SyncSource {
  const id = input?.id;
  if (
    input?.type &&
    (input.type === "club" || input.type === "airport") &&
    typeof id === "number" &&
    Number.isFinite(id) &&
    id > 0
  ) {
    return {
      type: input.type,
      id,
      label: input.label?.trim() || `${input.type} ${id}`,
    };
  }
  return getDefaultClubSource();
}

export function getLaunchAirportFields(flight: {
  launch_airport?: { name?: string; icao?: string };
  airport?: { name?: string; icao?: string };
  custom_takeoff_airport?: { name?: string; icao?: string };
}) {
  const airport =
    flight.launch_airport ?? flight.airport ?? flight.custom_takeoff_airport;
  return {
    launchAirport: airport?.name ?? airport?.icao ?? null,
    launchAirportIcao: airport?.icao ?? null,
  };
}
