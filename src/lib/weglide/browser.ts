"use client";

import type { SyncSourceDto } from "@/types";
import type { WeGlideFlight } from "./types";

async function localFetch<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed (${response.status})`);
  }

  return payload;
}

function buildActivityUrl(year: number, source: SyncSourceDto): string {
  const params = new URLSearchParams({
    year: String(year),
    sourceType: source.type,
    sourceId: String(source.id),
  });
  return `/api/weglide/activity?${params.toString()}`;
}

export async function fetchFlightsInBrowser(
  year: number,
  source: SyncSourceDto,
): Promise<WeGlideFlight[]> {
  const payload = await localFetch<{ flights: WeGlideFlight[] }>(
    buildActivityUrl(year, source),
  );
  return payload.flights;
}

/** @deprecated Use fetchFlightsInBrowser */
export async function fetchClubFlightsInBrowser(
  year: number,
): Promise<WeGlideFlight[]> {
  return fetchFlightsInBrowser(year, {
    type: "club",
    id: 1006,
    label: "Fault Line Flyers",
  });
}

export async function searchSourcesInBrowser(
  type: "club" | "airport",
  query: string,
): Promise<Array<{ id: number; label: string; subtitle: string | null }>> {
  const params = new URLSearchParams({ type, q: query });
  const payload = await localFetch<{ results: Array<{ id: number; label: string; subtitle: string | null }> }>(
    `/api/weglide/search?${params.toString()}`,
  );
  return payload.results;
}

export async function lookupSourceInBrowser(
  type: "club" | "airport",
  token: string,
): Promise<{ id: number; label: string; subtitle: string | null }> {
  const params = new URLSearchParams({ type, token });
  const payload = await localFetch<{
    result: { id: number; label: string; subtitle: string | null };
  }>(`/api/weglide/lookup?${params.toString()}`);
  return payload.result;
}

export async function fetchIgcFileInBrowser(
  weglideFlightId: number,
): Promise<string | null> {
  try {
    const payload = await localFetch<{ content: string | null }>(
      `/api/weglide/flight/${weglideFlightId}/igc`,
    );
    return payload.content ?? null;
  } catch {
    return null;
  }
}

export async function fetchIgcFilesForFlights(
  flights: WeGlideFlight[],
): Promise<Array<{ weglideId: number; igcContent: string | null }>> {
  const results: Array<{ weglideId: number; igcContent: string | null }> = [];

  for (const flight of flights) {
    const igcContent = await fetchIgcFileInBrowser(flight.id);
    results.push({ weglideId: flight.id, igcContent });
  }

  return results;
}
