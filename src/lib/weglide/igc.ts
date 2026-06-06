import { trackPointsToIgc } from "@/lib/igc/synthetic";
import { resolveIgcFileField, resolveIgcDownloadUrl } from "@/lib/igc/resolve";
import {
  buildIgcFileUrl,
  getFlightIgcDownloadPath,
  getFlightIgcFileId,
} from "./shared";
import {
  fetchFlightDetail,
  fetchIgcFile,
  weglideFetchText,
} from "./client";
import { fetchFlightData, flightDataToTrackPoints } from "./flightdata";
import type { WeGlideFlight } from "./types";

export type IgcFetchSource = "igcfile" | "flightdata" | null;

function findIgcFileIdDeep(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findIgcFileIdDeep(item);
      if (found) return found;
    }
    return null;
  }

  for (const [key, child] of Object.entries(value)) {
    if (/igc.*file.*id/i.test(key) || key === "igcfile_id" || key === "igc_file_id") {
      const parsed = Number(child);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    const found = findIgcFileIdDeep(child);
    if (found) return found;
  }

  return null;
}

function findIgcDownloadPathDeep(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (
      trimmed.includes("weglidefiles") ||
      trimmed.includes("/igcfiles/") ||
      trimmed.endsWith(".igc")
    ) {
      return trimmed;
    }
    return null;
  }

  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findIgcDownloadPathDeep(item);
      if (found) return found;
    }
    return null;
  }

  for (const child of Object.values(value)) {
    const found = findIgcDownloadPathDeep(child);
    if (found) return found;
  }

  return null;
}

async function fetchIgcFromDownloadPath(path: string): Promise<string | null> {
  try {
    return await resolveIgcFileField(path, weglideFetchText);
  } catch {
    return null;
  }
}

async function tryFetchIgcById(igcfileId: number): Promise<string | null> {
  try {
    const igc = await fetchIgcFile(igcfileId);
    return resolveIgcFileField(igc.file, weglideFetchText);
  } catch {
    return null;
  }
}

async function tryFetchFromFlightData(
  weglideId: number,
): Promise<string | null> {
  const data = await fetchFlightData(weglideId);
  if (!data) return null;

  const points = flightDataToTrackPoints(data);
  if (points.length < 3) return null;

  return trackPointsToIgc(points);
}

async function resolveFlightDetail(
  flight: WeGlideFlight,
): Promise<WeGlideFlight> {
  if (getFlightIgcFileId(flight) || getFlightIgcDownloadPath(flight)) {
    return flight;
  }

  try {
    return await fetchFlightDetail(flight.id);
  } catch {
    return flight;
  }
}

export async function fetchIgcContentForFlight(
  flight: WeGlideFlight,
): Promise<{
  content: string | null;
  igcfileId: number | null;
  source: IgcFetchSource;
}> {
  const detail = await resolveFlightDetail(flight);

  const directPath =
    getFlightIgcDownloadPath(detail) ?? findIgcDownloadPathDeep(detail);
  if (directPath) {
    const content = await fetchIgcFromDownloadPath(directPath);
    if (content) {
      return {
        content,
        igcfileId: getFlightIgcFileId(detail) ?? findIgcFileIdDeep(detail),
        source: "igcfile",
      };
    }
  }

  const candidateIds = new Set<number>();
  const directId = getFlightIgcFileId(detail);
  if (directId) candidateIds.add(directId);

  const deepId = findIgcFileIdDeep(detail);
  if (deepId) candidateIds.add(deepId);

  for (const igcfileId of candidateIds) {
    const content = await tryFetchIgcById(igcfileId);
    if (content) {
      return { content, igcfileId, source: "igcfile" };
    }
  }

  const flightDataIgc = await tryFetchFromFlightData(flight.id);
  if (flightDataIgc) {
    return {
      content: flightDataIgc,
      igcfileId: directId ?? deepId ?? null,
      source: "flightdata",
    };
  }

  return { content: null, igcfileId: directId ?? deepId ?? null, source: null };
}

export function buildPublicIgcTestUrl(igcfileId: number): string {
  return buildIgcFileUrl(igcfileId);
}

export function describeIgcDownloadUrl(path: string): string | null {
  return resolveIgcDownloadUrl(path);
}
