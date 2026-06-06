import {
  buildFlightDetailUrl,
  buildFlightListUrl,
  buildFlightListUrlForSource,
  buildIgcFileUrl,
  filterQualifyingFlights,
  getFlightDurationSeconds,
  getFlightIgcFileId,
  getPilotName,
  getPilotUserId,
  normalizeFlights,
} from "./shared";
import type { SyncSource } from "@/lib/sync/source";
import type { WeGlideFlight, WeGlideIgcFile } from "./types";

export {
  getFlightDurationSeconds,
  getFlightIgcFileId,
  getPilotName,
  getPilotUserId,
  normalizeFlights,
  filterQualifyingFlights,
};

function getApiKey(): string | undefined {
  return process.env.WEGLIDE_API_KEY || undefined;
}

async function weglideFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Referer: "https://www.weglide.org/",
    Origin: "https://www.weglide.org",
    ...(init?.headers as Record<string, string> | undefined),
  };

  const apiKey = getApiKey();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `WeGlide API ${response.status} for ${url}${body ? `: ${body.slice(0, 200)}` : ""}`,
    );
  }

  return response.json() as Promise<T>;
}

export async function fetchClubFlightsForYear(
  clubId: number,
  year: number,
): Promise<WeGlideFlight[]> {
  const allFlights: WeGlideFlight[] = [];
  const limit = 100;
  let skip = 0;

  while (true) {
    const payload = await weglideFetch<unknown>(
      buildFlightListUrl(year, clubId, skip, limit),
    );
    const page = normalizeFlights(payload);

    if (page.length === 0) {
      break;
    }

    allFlights.push(...page);

    if (page.length < limit) {
      break;
    }

    skip += limit;
  }

  return filterQualifyingFlights(allFlights);
}

export async function fetchFlightsForSource(
  source: SyncSource,
  year: number,
): Promise<WeGlideFlight[]> {
  const allFlights: WeGlideFlight[] = [];
  const limit = 100;
  let skip = 0;

  while (true) {
    const payload = await weglideFetch<unknown>(
      buildFlightListUrlForSource(year, source.type, source.id, skip, limit),
    );
    const page = normalizeFlights(payload);

    if (page.length === 0) {
      break;
    }

    allFlights.push(...page);

    if (page.length < limit) {
      break;
    }

    skip += limit;
  }

  return filterQualifyingFlights(allFlights);
}

export async function fetchIgcFile(igcfileId: number): Promise<WeGlideIgcFile> {
  return weglideFetch<WeGlideIgcFile>(buildIgcFileUrl(igcfileId));
}

export async function weglideFetchText(url: string): Promise<string> {
  const apiKey = getApiKey();
  const headers: Record<string, string> = {
    Accept: "text/plain, application/octet-stream, application/json, */*",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Referer: "https://www.weglide.org/",
    Origin: "https://www.weglide.org",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, { headers, cache: "no-store" });
  if (!response.ok) {
    throw new Error(`WeGlide fetch failed (${response.status}) for ${url}`);
  }
  return response.text();
}

export async function fetchFlightDetail(
  weglideId: number,
): Promise<WeGlideFlight> {
  return weglideFetch<WeGlideFlight>(buildFlightDetailUrl(weglideId));
}

/** @deprecated Use fetchFlightDetail — the list endpoint ignores id_in without club/season filters. */
export async function fetchFlightByWeGlideId(
  weglideId: number,
): Promise<WeGlideFlight> {
  return fetchFlightDetail(weglideId);
}
