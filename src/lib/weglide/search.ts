import { WEGLIDE_BASE_URL } from "./shared";
import type { WeGlideAirport, WeGlideClub } from "./types";

type SearchDocument = "airport" | "club";

type SearchQuery = {
  search_items: Array<{ key: "name"; value: string }>;
  documents: SearchDocument[];
  limit?: number;
};

type SearchHit = {
  id: number;
  name: string;
  icao?: string;
  region?: string;
  country_name?: string;
  country?: { name?: string };
};

export const US_CLUB_PRESETS: WeGlideClub[] = [
  { id: 1006, name: "Fault Line Flyers", country_name: "United States" },
  { id: 927, name: "Chicago Glider Club", country_name: "United States" },
];

export const US_AIRPORT_PRESETS: WeGlideAirport[] = [];

const NON_US_COUNTRY =
  /germany|deutschland|france|austria|switzerland|italy|spain|united kingdom|poland|czech|norway|sweden|finland|netherlands|belgium/i;

function getApiKey(): string | undefined {
  return process.env.WEGLIDE_API_KEY || undefined;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Referer: "https://www.weglide.org/",
    Origin: "https://www.weglide.org",
  };

  const apiKey = getApiKey();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

async function weglideGet<T>(path: string): Promise<T> {
  const response = await fetch(`${WEGLIDE_BASE_URL}${path}`, {
    headers: buildHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `WeGlide lookup failed (${response.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
    );
  }

  return response.json() as Promise<T>;
}

async function weglideSearchPost(query: SearchQuery): Promise<unknown> {
  const response = await fetch(`${WEGLIDE_BASE_URL}/v1/search`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(query),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `WeGlide search failed (${response.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
    );
  }

  return response.json();
}

export function parseSourceToken(
  input: string,
): { id: number; label?: string } | null {
  const trimmed = input.trim();
  const commaMatch = trimmed.match(/^(.+),\s*(\d+)\s*$/);
  if (commaMatch) {
    const id = Number(commaMatch[2]);
    if (Number.isFinite(id) && id > 0) {
      return { id, label: commaMatch[1].trim() };
    }
  }

  const id = Number(trimmed);
  if (Number.isFinite(id) && id > 0) {
    return { id };
  }

  return null;
}

function getCountryName(item: {
  country?: { name?: string };
  country_name?: string;
}): string {
  return item.country?.name ?? item.country_name ?? "";
}

export function isUsaAirport(airport: WeGlideAirport): boolean {
  const icao = (airport.icao ?? "").toUpperCase();
  if (/^K[A-Z0-9]{2}$/.test(icao)) return true;
  if (/^P[A-Z0-9]{2}$/.test(icao)) return true;

  const country = getCountryName(airport);
  if (!country) return true;
  return !NON_US_COUNTRY.test(country);
}

export function isUsaClub(club: WeGlideClub): boolean {
  const country = getCountryName(club);
  if (!country) return true;
  return !NON_US_COUNTRY.test(country);
}

function matchesQuery(name: string, query: string): boolean {
  const normalizedName = name.toLowerCase();
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) return true;
  return words.every((word) => normalizedName.includes(word));
}

function addHit(
  hits: SearchHit[],
  seen: Set<number>,
  candidate: Partial<SearchHit>,
) {
  const id = Number(candidate.id);
  const name = candidate.name?.trim();
  if (!Number.isFinite(id) || id <= 0 || !name) return;
  if (seen.has(id)) return;

  seen.add(id);
  hits.push({
    id,
    name,
    icao: candidate.icao,
    region: candidate.region,
    country_name: candidate.country_name,
    country: candidate.country,
  });
}

function collectSearchHits(
  payload: unknown,
  seen: Set<number>,
  hits: SearchHit[],
  depth = 0,
) {
  if (depth > 10 || payload == null) return;

  if (Array.isArray(payload)) {
    for (const item of payload) {
      collectSearchHits(item, seen, hits, depth + 1);
    }
    return;
  }

  if (typeof payload !== "object") return;

  const record = payload as Record<string, unknown>;

  if (typeof record.value === "string") {
    const commaMatch = record.value.match(/^(.+),\s*(\d+)\s*$/);
    if (commaMatch) {
      addHit(hits, seen, {
        id: Number(commaMatch[2]),
        name: commaMatch[1].trim(),
      });
    }
  }

  const id = Number(
    record.id ?? record.club_id ?? record.airport_id ?? record.document_id,
  );
  const name = String(
    record.name ??
      record.label ??
      record.display ??
      record.title ??
      record.text ??
      "",
  ).trim();

  if (Number.isFinite(id) && id > 0 && name.length > 1) {
    addHit(hits, seen, {
      id,
      name,
      icao: typeof record.icao === "string" ? record.icao : undefined,
      region: typeof record.region === "string" ? record.region : undefined,
      country_name:
        typeof record.country_name === "string" ? record.country_name : undefined,
      country:
        record.country && typeof record.country === "object"
          ? (record.country as { name?: string })
          : undefined,
    });
  }

  for (const value of Object.values(record)) {
    collectSearchHits(value, seen, hits, depth + 1);
  }
}

function filterPresets<T extends { id?: number; name?: string; icao?: string }>(
  presets: T[],
  query: string,
  usaFilter: (item: T) => boolean,
): T[] {
  const needle = query.trim();
  if (needle.length < 2) return [];

  return presets
    .filter(usaFilter)
    .filter((item) => matchesQuery(item.name ?? item.icao ?? "", needle));
}

export async function lookupClubById(id: number): Promise<WeGlideClub | null> {
  try {
    const club = await weglideGet<WeGlideClub>(`/v1/club/${id}`);
    if (!club?.id || !club.name) return null;
    return club;
  } catch {
    return null;
  }
}

export async function lookupAirportById(
  id: number,
): Promise<WeGlideAirport | null> {
  try {
    const airport = await weglideGet<WeGlideAirport>(`/v1/airport/${id}`);
    if (!airport?.id) return null;
    return airport;
  } catch {
    return null;
  }
}

async function runSearchVariants(
  document: SearchDocument,
  query: string,
  limit: number,
): Promise<SearchHit[]> {
  const variants: SearchQuery[] = [
    {
      search_items: [{ key: "name", value: query }],
      documents: [document],
      limit,
    },
    {
      search_items: [
        { key: "name", value: query },
        { key: "name", value: "United States" },
      ],
      documents: [document],
      limit,
    },
  ];

  const seen = new Set<number>();
  const hits: SearchHit[] = [];

  for (const variant of variants) {
    try {
      const payload = await weglideSearchPost(variant);
      collectSearchHits(payload, seen, hits);
    } catch {
      continue;
    }
  }

  return hits;
}

async function searchDocument<T extends WeGlideAirport | WeGlideClub>(
  document: SearchDocument,
  query: string,
  limit: number,
  presets: T[],
  usaFilter: (item: T) => boolean,
  lookupById: (id: number) => Promise<T | null>,
): Promise<T[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const merged: T[] = [];
  const seen = new Set<number>();

  const addItem = (item: T) => {
    const id = Number(item.id);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) return;
    if (!usaFilter(item)) return;
    seen.add(id);
    merged.push(item);
  };

  for (const preset of filterPresets(presets, trimmed, usaFilter)) {
    addItem(preset);
  }

  const token = parseSourceToken(trimmed);
  if (token) {
    const lookedUp = await lookupById(token.id);
    if (lookedUp) {
      addItem(lookedUp);
    } else if (token.label) {
      addItem({
        id: token.id,
        name: token.label,
      } as T);
    }
  }

  if (/^\d+$/.test(trimmed)) {
    const lookedUp = await lookupById(Number(trimmed));
    if (lookedUp) addItem(lookedUp);
  }

  const hits = await runSearchVariants(document, trimmed, limit);
  for (const hit of hits) {
    if (!matchesQuery(hit.name, trimmed)) continue;
    addItem({
      id: hit.id,
      name: hit.name,
      icao: hit.icao,
      region: hit.region,
      country_name: hit.country_name,
      country: hit.country,
    } as T);
    if (merged.length >= limit) break;
  }

  return merged.slice(0, limit);
}

export async function searchAirports(
  query: string,
  limit = 20,
): Promise<WeGlideAirport[]> {
  const results = await searchDocument<WeGlideAirport>(
    "airport",
    query,
    limit,
    US_AIRPORT_PRESETS,
    isUsaAirport,
    lookupAirportById,
  );

  return results.filter(
    (airport) => airport.id && (airport.name || airport.icao),
  );
}

export async function searchClubs(
  query: string,
  limit = 20,
): Promise<WeGlideClub[]> {
  const results = await searchDocument<WeGlideClub>(
    "club",
    query,
    limit,
    US_CLUB_PRESETS,
    isUsaClub,
    lookupClubById,
  );

  return results.filter((club) => club.id && club.name);
}
