"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Polyline, useMap } from "react-leaflet";
import OgnGliderMarker from "@/components/OgnGliderMarker";
import { ognMarkerColor, ognFlightMode } from "@/lib/ogn/display";
import type { OgnAircraftDto } from "@/types";

const POLL_MS = 10_000;
const TRAIL_MAX_POINTS = 10;

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

type LatLng = [number, number];

export default function OgnLiveLayer({ enabled, onStatusChange }: Props) {
  const map = useMap();
  const [aircraft, setAircraft] = useState<OgnAircraftDto[]>([]);
  const [trails, setTrails] = useState<Map<string, LatLng[]>>(new Map());
  const statusRef = useRef<LiveStatus>({
    count: 0,
    loading: false,
    error: null,
    fetchedAt: null,
  });
  const trailsRef = useRef<Map<string, LatLng[]>>(new Map());

  const reportStatus = useCallback(
    (next: LiveStatus) => {
      statusRef.current = next;
      onStatusChange?.(next);
    },
    [onStatusChange],
  );

  const updateTrails = useCallback((nextAircraft: OgnAircraftDto[]) => {
    const activeIds = new Set(nextAircraft.map((item) => item.id));
    const nextTrails = new Map(trailsRef.current);

    for (const id of [...nextTrails.keys()]) {
      if (!activeIds.has(id)) {
        nextTrails.delete(id);
      }
    }

    for (const item of nextAircraft) {
      const history = nextTrails.get(item.id) ?? [];
      const last = history[history.length - 1];
      const point: LatLng = [item.lat, item.lon];

      if (!last || last[0] !== point[0] || last[1] !== point[1]) {
        history.push(point);
      }

      if (history.length > TRAIL_MAX_POINTS) {
        history.splice(0, history.length - TRAIL_MAX_POINTS);
      }

      nextTrails.set(item.id, history);
    }

    trailsRef.current = nextTrails;
    setTrails(new Map(nextTrails));
  }, []);

  const fetchLive = useCallback(async () => {
    const bounds = map.getBounds();
    const params = new URLSearchParams({
      north: String(bounds.getNorth()),
      south: String(bounds.getSouth()),
      east: String(bounds.getEast()),
      west: String(bounds.getWest()),
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
      updateTrails(nextAircraft);
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
  }, [map, reportStatus, updateTrails]);

  useEffect(() => {
    if (!enabled) {
      setAircraft([]);
      trailsRef.current = new Map();
      setTrails(new Map());
      reportStatus({ count: 0, loading: false, error: null, fetchedAt: null });
      return;
    }

    void fetchLive();
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
      {[...trails.entries()].map(([id, positions]) => {
        if (positions.length < 2) return null;
        const item = aircraft.find((entry) => entry.id === id);
        if (!item) return null;
        const color = ognMarkerColor(ognFlightMode(item));
        return (
          <Polyline
            key={`trail-${id}`}
            positions={positions}
            pathOptions={{
              color,
              weight: 2.5,
              opacity: 0.55,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        );
      })}

      {aircraft.map((item) => (
        <OgnGliderMarker key={item.id} aircraft={item} />
      ))}
    </>
  );
}
