"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import OgnGliderMarker from "@/components/OgnGliderMarker";
import { boundsFromLeaflet } from "@/lib/ogn/bounds";
import type { OgnAircraftDto } from "@/types";

const POLL_MS = 4_000;

type LiveStatus = {
  count: number;
  loading: boolean;
  error: string | null;
  fetchedAt: string | null;
};

type Props = {
  enabled: boolean;
  onStatusChange?: (status: LiveStatus) => void;
};

export default function OgnLiveLayer({ enabled, onStatusChange }: Props) {
  const map = useMap();
  const [aircraft, setAircraft] = useState<OgnAircraftDto[]>([]);
  const statusRef = useRef<LiveStatus>({
    count: 0,
    loading: false,
    error: null,
    fetchedAt: null,
  });

  const reportStatus = useCallback(
    (next: LiveStatus) => {
      statusRef.current = next;
      onStatusChange?.(next);
    },
    [onStatusChange],
  );

  const fetchLive = useCallback(async () => {
    const bounds = boundsFromLeaflet(map);
    if (!bounds) {
      return;
    }

    const params = new URLSearchParams({
      north: String(bounds.north),
      south: String(bounds.south),
      east: String(bounds.east),
      west: String(bounds.west),
    });

    reportStatus({
      count: statusRef.current.count,
      loading: true,
      error: null,
      fetchedAt: statusRef.current.fetchedAt,
    });

    try {
      const response = await fetch(`/api/ogn/live?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        aircraft?: OgnAircraftDto[];
        fetchedAt?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load live traffic");
      }

      const nextAircraft = payload.aircraft ?? [];
      const nextFetchedAt = payload.fetchedAt ?? new Date().toISOString();
      setAircraft(nextAircraft);
      reportStatus({
        count: nextAircraft.length,
        loading: false,
        error: null,
        fetchedAt: nextFetchedAt,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load live traffic";
      reportStatus({
        count: statusRef.current.count,
        loading: false,
        error: message,
        fetchedAt: statusRef.current.fetchedAt,
      });
    }
  }, [map, reportStatus]);

  useEffect(() => {
    if (!enabled) {
      setAircraft([]);
      reportStatus({ count: 0, loading: false, error: null, fetchedAt: null });
      return;
    }

    const onReady = () => {
      void fetchLive();
    };

    if (map.getSize().x > 0) {
      onReady();
    } else {
      map.whenReady(onReady);
    }

    const intervalId = window.setInterval(() => {
      void fetchLive();
    }, POLL_MS);

    map.on("moveend", fetchLive);

    return () => {
      window.clearInterval(intervalId);
      map.off("moveend", fetchLive);
    };
  }, [enabled, fetchLive, map, reportStatus]);

  if (!enabled) return null;

  return (
    <>
      {aircraft.map((item) => (
        <OgnGliderMarker key={item.id} aircraft={item} />
      ))}
    </>
  );
}
