"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import HotspotMapClient from "@/components/HotspotMapClient";
import MapHelpCard, { readMapHelpDismissed } from "@/components/MapHelpCard";
import {
  sourceTypeBadge,
  themeForSourceIndex,
} from "@/lib/explorer/pill-themes";
import type { HotspotDto, SourceWithPilotsDto } from "@/types";

const btnSecondary =
  "inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/60 px-3.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-sky-600/50 hover:bg-slate-800 sm:px-4 sm:py-2 sm:text-sm";

const btnPrimary =
  "inline-flex items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-sky-600 px-3.5 py-1.5 text-xs font-semibold text-slate-950 shadow-md shadow-sky-500/20 transition hover:from-sky-300 hover:to-sky-500 sm:px-4 sm:py-2 sm:text-sm";

export default function Explorer() {
  const [showList, setShowList] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedSourceKeys, setSelectedSourceKeys] = useState<string[]>([]);
  const [selectedPilots, setSelectedPilots] = useState<string[]>([]);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [hotspots, setHotspots] = useState<HotspotDto[]>([]);
  const [sources, setSources] = useState<SourceWithPilotsDto[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapHelpMounted, setMapHelpMounted] = useState(false);
  const [showMapHelp, setShowMapHelp] = useState(false);

  useEffect(() => {
    setMapHelpMounted(true);
    if (!readMapHelpDismissed()) {
      setShowMapHelp(true);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const yearQuery =
        selectedYear === "all" ? "" : `?year=${encodeURIComponent(selectedYear)}`;

      const [hotspotRes, sourceRes, yearRes] = await Promise.all([
        fetch(`/api/hotspots${yearQuery}`),
        fetch(`/api/sources${yearQuery}`),
        fetch("/api/years"),
      ]);

      const failures: string[] = [];
      if (!hotspotRes.ok) failures.push("hotspots");
      if (!sourceRes.ok) failures.push("sources");
      if (!yearRes.ok) failures.push("years");
      if (failures.length > 0) {
        const hotspotBody = hotspotRes.ok
          ? null
          : ((await hotspotRes.json().catch(() => null)) as {
              error?: string;
            } | null);
        const detail = hotspotBody?.error;
        throw new Error(
          detail
            ? `Failed to load ${failures.join(", ")}: ${detail}`
            : `Failed to load ${failures.join(", ")}`,
        );
      }

      const hotspotJson = (await hotspotRes.json()) as { hotspots: HotspotDto[] };
      const sourceJson = (await sourceRes.json()) as {
        sources: SourceWithPilotsDto[];
      };
      const yearJson = (await yearRes.json()) as { years: number[] };

      setHotspots(hotspotJson.hotspots);
      setSources(sourceJson.sources);
      setYears(yearJson.years);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sourceThemeMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof themeForSourceIndex>>();
    sources.forEach((source, index) => {
      map.set(source.sourceKey, themeForSourceIndex(index));
    });
    return map;
  }, [sources]);

  const expandedSourceGroups = useMemo(() => {
    if (selectedSourceKeys.length === 0) return [];
    const selected = new Set(selectedSourceKeys);
    return sources.filter((source) => selected.has(source.sourceKey));
  }, [sources, selectedSourceKeys]);

  const allowedPilotSet = useMemo(() => {
    if (selectedPilots.length > 0) {
      return new Set(selectedPilots);
    }
    if (selectedSourceKeys.length > 0) {
      return new Set(
        expandedSourceGroups.flatMap((source) => source.pilots),
      );
    }
    return null;
  }, [selectedPilots, selectedSourceKeys, expandedSourceGroups]);

  const filteredHotspots = useMemo(() => {
    if (!allowedPilotSet) return hotspots;
    return hotspots.filter((hotspot) =>
      hotspot.pilots.some((pilot) => allowedPilotSet.has(pilot)),
    );
  }, [hotspots, allowedPilotSet]);

  useEffect(() => {
    const validKeys = new Set(sources.map((source) => source.sourceKey));
    setSelectedSourceKeys((current) =>
      current.filter((key) => validKeys.has(key)),
    );

    const validPilots = new Set(sources.flatMap((source) => source.pilots));
    setSelectedPilots((current) =>
      current.filter((pilot) => validPilots.has(pilot)),
    );
  }, [sources]);

  function toggleSource(sourceKey: string) {
    setSelectedSourceKeys((current) => {
      const next = current.includes(sourceKey)
        ? current.filter((key) => key !== sourceKey)
        : [...current, sourceKey];

      const visiblePilots = new Set(
        sources
          .filter((source) => next.includes(source.sourceKey))
          .flatMap((source) => source.pilots),
      );

      setSelectedPilots((pilots) =>
        pilots.filter((pilot) => visiblePilots.has(pilot)),
      );
      return next;
    });
    setSelectedHotspotId(null);
  }

  function togglePilot(pilot: string) {
    setSelectedPilots((current) =>
      current.includes(pilot)
        ? current.filter((value) => value !== pilot)
        : [...current, pilot],
    );
    setSelectedHotspotId(null);
  }

  function clearFilters() {
    setSelectedSourceKeys([]);
    setSelectedPilots([]);
    setSelectedHotspotId(null);
  }

  const hasActiveFilters =
    selectedSourceKeys.length > 0 || selectedPilots.length > 0;

  const statusText = loading
    ? "Loading…"
    : error
      ? error
      : `${filteredHotspots.length} hotspot${filteredHotspots.length === 1 ? "" : "s"}`;

  const headerExpanded = expandedSourceGroups.length > 0;

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative flex flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 shadow-lg shadow-black/20 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-3 py-2 sm:px-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 text-[10px] font-bold text-slate-950 shadow-md shadow-sky-500/20">
                  FL
                </span>
                <div className="min-w-0 leading-tight">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                    <h1 className="text-base font-bold tracking-tight sm:text-lg">
                      Hotspots
                    </h1>
                    <span
                      className={[
                        "text-xs font-medium",
                        error
                          ? "text-red-400"
                          : loading
                            ? "text-slate-500"
                            : "text-slate-500",
                      ].join(" ")}
                    >
                      {loading && (
                        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-sky-400 pulse-soft align-middle" />
                      )}
                      {statusText}
                    </span>
                  </div>
                  <p className="hidden truncate text-[11px] text-slate-500 sm:block">
                    Thermal explorer powered by your flights
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowMapHelp(true)}
                  className={btnSecondary}
                >
                  Guide
                </button>
                <a href="/help" className={btnSecondary}>
                  Help
                </a>
                <a href="/upload" className={`hidden sm:inline-flex ${btnSecondary}`}>
                  Upload
                </a>
                <button
                  type="button"
                  onClick={() => setShowList((value) => !value)}
                  className={btnPrimary}
                >
                  {showList ? "Map" : "List"}
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800/60">
            <div className="mx-auto max-w-7xl px-3 sm:px-5">
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                className="flex w-full items-center justify-between py-2 text-left sm:hidden"
              >
                <span className="text-xs font-semibold text-slate-300">
                  Filters
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  {selectedYear !== "all" && (
                    <span className="rounded-full bg-sky-500/20 px-1.5 py-0.5 font-medium text-sky-300">
                      {selectedYear}
                    </span>
                  )}
                  {selectedSourceKeys.length > 0 && (
                    <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-slate-400">
                      {selectedSourceKeys.length} src
                    </span>
                  )}
                  <svg
                    className={`h-3.5 w-3.5 transition ${filtersOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              </button>

              <div
                className={[
                  "pb-2 sm:py-2",
                  filtersOpen ? "block" : "hidden sm:block",
                ].join(" ")}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    id="year-filter"
                    aria-label="Year"
                    value={selectedYear}
                    onChange={(event) => {
                      setSelectedYear(event.target.value);
                      setSelectedHotspotId(null);
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-100 outline-none transition focus:border-sky-500 sm:text-sm"
                  >
                    <option value="all">All years</option>
                    {years.map((year) => (
                      <option key={year} value={String(year)}>
                        {year}
                      </option>
                    ))}
                  </select>

                  <span className="hidden h-4 w-px bg-slate-700 sm:block" />

                  {sources.length === 0 ? (
                    <span className="text-xs text-slate-500">No sources loaded</span>
                  ) : (
                    sources.map((source, index) => {
                      const active = selectedSourceKeys.includes(source.sourceKey);
                      const theme = themeForSourceIndex(index);
                      return (
                        <button
                          key={source.sourceKey}
                          type="button"
                          onClick={() => toggleSource(source.sourceKey)}
                          className={[
                            "shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold transition sm:px-3 sm:py-1.5 sm:text-sm",
                            active ? theme.sourceActive : theme.sourceInactive,
                          ].join(" ")}
                        >
                          <span className="flex items-center gap-1.5">
                            <span
                              className={[
                                "inline-block h-1.5 w-1.5 rounded-full",
                                active ? "bg-white/90" : theme.dot,
                              ].join(" ")}
                            />
                            {source.label}
                            <span
                              className={[
                                "rounded px-1 py-px text-[9px] font-bold uppercase tracking-wide",
                                active
                                  ? "bg-black/15"
                                  : "bg-slate-900/80 text-slate-500",
                              ].join(" ")}
                            >
                              {sourceTypeBadge(source.type)}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  )}

                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-[11px] font-semibold text-sky-400 transition hover:text-sky-300 sm:text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {headerExpanded && (
                  <div
                    className={[
                      "mt-2 space-y-2 overflow-y-auto pr-1",
                      headerExpanded ? "max-h-[28vh] sm:max-h-[22vh]" : "",
                    ].join(" ")}
                  >
                    {expandedSourceGroups.map((source) => {
                      const sourceIndex = sources.findIndex(
                        (item) => item.sourceKey === source.sourceKey,
                      );
                      const theme = themeForSourceIndex(
                        sourceIndex >= 0 ? sourceIndex : 0,
                      );

                      return (
                        <div
                          key={source.sourceKey}
                          className="rounded-xl border border-slate-800/80 bg-slate-900/50 px-2.5 py-2"
                        >
                          <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span
                              className={[
                                "inline-block h-1.5 w-1.5 rounded-full",
                                theme.dot,
                              ].join(" ")}
                            />
                            <span
                              className={[
                                "text-xs font-bold",
                                theme.sectionLabel,
                              ].join(" ")}
                            >
                              {source.label}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {source.pilots.length} pilots · {source.flightCount}{" "}
                              flights
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {source.pilots.map((pilot) => {
                              const active = selectedPilots.includes(pilot);
                              return (
                                <button
                                  key={`${source.sourceKey}-${pilot}`}
                                  type="button"
                                  onClick={() => togglePilot(pilot)}
                                  className={[
                                    "rounded-full border px-2 py-0.5 text-xs font-medium transition",
                                    active
                                      ? theme.pilotActive
                                      : theme.pilotInactive,
                                  ].join(" ")}
                                >
                                  {pilot}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="relative flex flex-1 flex-col">
          {!showList ? (
            <div className="relative min-h-[calc(100dvh-5.5rem)] flex-1 sm:min-h-[calc(100dvh-6rem)]">
              <div className="absolute inset-0 p-1.5 sm:p-3">
                <div className="relative h-full overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/40 shadow-xl shadow-black/20 sm:rounded-3xl">
                  <HotspotMapClient
                    hotspots={filteredHotspots}
                    fullHeight
                    darkChrome
                    selectedHotspotId={selectedHotspotId}
                    onSelectHotspot={setSelectedHotspotId}
                  />
                </div>
              </div>
              {mapHelpMounted && showMapHelp && (
                <div className="absolute inset-0 z-[1100] p-1.5 sm:p-3">
                  <div className="relative h-full overflow-hidden rounded-2xl sm:rounded-3xl">
                    <MapHelpCard onDismiss={() => setShowMapHelp(false)} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 p-2 sm:grid sm:grid-cols-[minmax(260px,340px)_1fr] sm:gap-4 sm:p-3">
              <aside className="order-2 flex max-h-[45dvh] flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/70 shadow-xl sm:order-1 sm:max-h-[calc(100dvh-7rem)] sm:rounded-3xl">
                <div className="border-b border-slate-800 px-3 py-2">
                  <h2 className="text-xs font-bold text-slate-100 sm:text-sm">
                    Hotspot list
                  </h2>
                </div>
                <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
                  {filteredHotspots.map((hotspot) => {
                    const isSelected = hotspot.id === selectedHotspotId;
                    const theme = sourceThemeMap.get(
                      sources.find((source) =>
                        source.pilots.some((pilot) =>
                          hotspot.pilots.includes(pilot),
                        ),
                      )?.sourceKey ?? "",
                    );
                    return (
                      <button
                        key={hotspot.id}
                        type="button"
                        onClick={() => setSelectedHotspotId(hotspot.id)}
                        className={[
                          "w-full rounded-xl border p-2.5 text-left transition sm:p-3",
                          isSelected
                            ? "border-sky-500/50 bg-sky-500/10 ring-1 ring-sky-500/30"
                            : "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/60",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold text-slate-100">
                              {hotspot.name}
                            </h3>
                            <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:text-xs">
                              {hotspot.pilots.join(", ")}
                            </p>
                          </div>
                          <span
                            className={[
                              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold sm:text-xs",
                              theme
                                ? theme.pilotActive
                                : "bg-sky-500/20 text-sky-300",
                            ].join(" ")}
                          >
                            {hotspot.avgClimbKts.toFixed(1)} kt
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  {!loading && filteredHotspots.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center text-xs text-slate-500">
                      No hotspots match the current filters.
                    </div>
                  )}
                </div>
              </aside>

              <div className="order-1 min-h-[40dvh] flex-1 sm:order-2 sm:min-h-[calc(100dvh-7rem)]">
                <div className="h-full overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/40 shadow-xl sm:rounded-3xl">
                  <HotspotMapClient
                    hotspots={filteredHotspots}
                    fullHeight
                    darkChrome
                    selectedHotspotId={selectedHotspotId}
                    onSelectHotspot={setSelectedHotspotId}
                  />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
