import { NextResponse } from "next/server";
import { parseIgcTrack } from "@/lib/igc/parser";
import { resolveIgcDownloadUrl } from "@/lib/igc/resolve";
import {
  describeIgcDownloadUrl,
  fetchIgcContentForFlight,
} from "@/lib/weglide/igc";
import {
  fetchFlightDetail,
  fetchIgcFile,
  getFlightIgcFileId,
} from "@/lib/weglide/client";
import {
  fetchFlightData,
  flightDataToTrackPoints,
} from "@/lib/weglide/flightdata";
import { getFlightIgcDownloadPath } from "@/lib/weglide/shared";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weglideId = Number(searchParams.get("id") ?? "493991");

  if (!Number.isFinite(weglideId)) {
    return NextResponse.json({ error: "Invalid flight id" }, { status: 400 });
  }

  try {
    const detail = await fetchFlightDetail(weglideId);
    const igcfileId = getFlightIgcFileId(detail);
    const downloadPath = getFlightIgcDownloadPath(detail);

    let igcfileMeta: {
      id: number;
      file: string;
      resolvedUrl: string | null;
    } | null = null;
    let igcfileError: string | null = null;

    if (igcfileId) {
      try {
        const meta = await fetchIgcFile(igcfileId);
        igcfileMeta = {
          id: meta.id,
          file: meta.file,
          resolvedUrl: resolveIgcDownloadUrl(meta.file),
        };
      } catch (error) {
        igcfileError =
          error instanceof Error ? error.message : "igcfile metadata fetch failed";
      }
    }

    const flightData = await fetchFlightData(weglideId);
    const flightDataPoints = flightData ? flightDataToTrackPoints(flightData) : [];

    const fetched = await fetchIgcContentForFlight(detail);
    const parsedPoints = fetched.content ? parseIgcTrack(fetched.content).length : 0;

    return NextResponse.json({
      weglideId,
      protected: detail.protected ?? false,
      pilotName: detail.user?.name ?? null,
      igcFileId: igcfileId,
      downloadPathFromDetail: downloadPath,
      resolvedDownloadUrl: downloadPath
        ? describeIgcDownloadUrl(downloadPath)
        : null,
      igcfileMeta,
      igcfileError,
      flightDataAvailable: Boolean(flightData),
      flightDataPointCount: flightDataPoints.length,
      source: fetched.source,
      igcBytes: fetched.content?.length ?? 0,
      parsedTrackPoints: parsedPoints,
      igcPreview: fetched.content?.slice(0, 160) ?? null,
      note:
        fetched.source === "flightdata"
          ? "IGC API returned 404; track was built from /v1/flightdata instead."
          : fetched.source === "igcfile"
            ? "Track downloaded from WeGlide IGC/CDN."
            : "No track source succeeded.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Probe failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
