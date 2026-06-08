"use client";

import { useEffect, useState } from "react";
import type { ThermalDto } from "@/types";

type HotspotThermalsListProps = {
  hotspotId: string;
  year?: string;
  dark?: boolean;
};

function formatAlt(ft: number | null): string {
  if (ft == null || !Number.isFinite(ft)) return "—";
  return `${Math.round(ft).toLocaleString()} ft`;
}

export default function HotspotThermalsList({
  hotspotId,
  year,
  dark = false,
}: HotspotThermalsListProps) {
  const [thermals, setThermals] = useState<ThermalDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const yearQuery =
      year && year !== "all" ? `&year=${encodeURIComponent(year)}` : "";

    void fetch(`/api/hotspots/${hotspotId}/thermals?limit=8${yearQuery}`)
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? "Failed to load thermals");
        }
        return response.json() as Promise<{ thermals: ThermalDto[] }>;
      })
      .then((json) => {
        if (!cancelled) setThermals(json.thermals);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load thermals");
          setThermals([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hotspotId, year]);

  const label = dark ? "text-slate-300" : "text-slate-700";
  const muted = dark ? "text-slate-500" : "text-slate-500";
  const value = dark ? "text-slate-200" : "text-slate-800";
  const border = dark ? "border-slate-700" : "border-slate-200";

  if (loading) {
    return <p className={`text-xs ${muted}`}>Loading thermals…</p>;
  }
  if (error) {
    return <p className="text-xs text-red-500">{error}</p>;
  }
  if (thermals.length === 0) {
    return <p className={`text-xs ${muted}`}>No thermals for this hotspot.</p>;
  }

  return (
    <div className={`mt-2 space-y-2 border-t pt-2 ${border}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wide ${label}`}>
        Thermals at this spot
      </p>
      <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
        {thermals.map((thermal) => (
          <li
            key={thermal.id}
            className={`rounded-lg border px-2 py-1.5 text-[11px] leading-snug ${border} ${
              dark ? "bg-slate-950/40" : "bg-slate-50"
            }`}
          >
            <div className={`font-semibold ${value}`}>
              {thermal.pilot} · {thermal.avgClimbKts.toFixed(1)} kt
              {thermal.avgClimbFpm != null
                ? ` · ${Math.round(thermal.avgClimbFpm)} fpm`
                : ""}
            </div>
            <div className={muted}>
              <span className={label}>Start:</span>{" "}
              {thermal.startTime ?? "—"} · {formatAlt(thermal.startAltFt)}
            </div>
            <div className={muted}>
              <span className={label}>End:</span>{" "}
              {thermal.endTime ?? "—"} · {formatAlt(thermal.endAltFt)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
