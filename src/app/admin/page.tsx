"use client";

import { useCallback, useEffect, useState } from "react";
import SourcePicker from "@/components/SourcePicker";
import {
  fetchFlightsInBrowser,
  fetchIgcFilesForFlights,
} from "@/lib/weglide/browser";
import type { SyncSourceDto, SyncStatusDto } from "@/types";
import type { WeGlideFlight } from "@/lib/weglide/types";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - 2014 },
  (_, index) => CURRENT_YEAR - index,
);

type Step = "idle" | "discovering" | "importing" | "analyzing" | "completed" | "failed";
type RunningOp = "none" | "sync" | "analyze" | "refetch";

const DEFAULT_SOURCE: SyncSourceDto = {
  type: "club",
  id: 1006,
  label: "Fault Line Flyers",
};

function syncBody(
  source: SyncSourceDto,
  extra?: Record<string, unknown>,
) {
  return JSON.stringify({ source, ...extra });
}

function formatSyncError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Sync failed";
  const prismaLine = message
    .split("\n")
    .find((line) => line.includes("Invalid `prisma.") || line.includes("schema is out of date"));
  const firstLine =
    prismaLine ??
    message.split("\n").find((line) => line.trim()) ??
    message;
  if (firstLine.length > 320) {
    return `${firstLine.slice(0, 320)}…`;
  }
  return firstLine;
}

export default function AdminPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [source, setSource] = useState<SyncSourceDto>(DEFAULT_SOURCE);
  const [step, setStep] = useState<Step>("idle");
  const [status, setStatus] = useState<SyncStatusDto | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [runningOp, setRunningOp] = useState<RunningOp>("none");
  const [dbHealthMessage, setDbHealthMessage] = useState<string | null>(null);
  const running = runningOp !== "none";

  const appendLog = useCallback((message: string) => {
    setLog((current) => [
      `${new Date().toLocaleTimeString()} — ${message}`,
      ...current,
    ]);
  }, []);

  const refreshStatus = useCallback(async (targetYear: number) => {
    const response = await fetch(`/api/sync/${targetYear}`);
    if (!response.ok) return;
    const json = (await response.json()) as SyncStatusDto;
    setStatus(json);
  }, []);

  useEffect(() => {
    void refreshStatus(year);
  }, [year, refreshStatus]);

  useEffect(() => {
    void fetch("/api/health/db")
      .then(async (response) => {
        const json = (await response.json()) as {
          ok: boolean;
          message: string;
        };
        setDbHealthMessage(json.ok ? null : json.message);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (runningOp !== "analyze" && runningOp !== "refetch") {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshStatus(year);
    }, 2000);

    return () => window.clearInterval(interval);
  }, [runningOp, year, refreshStatus]);

  function ensureSourceSelected(): boolean {
    if (source.id <= 0) {
      appendLog(`Select a ${source.type} before running sync.`);
      setStep("failed");
      return false;
    }
    return true;
  }

  async function runAnalyzeOnly() {
    if (!ensureSourceSelected()) return;
    setRunningOp("analyze");
    setStep("analyzing");
    setStatus((current) =>
      current ? { ...current, errorMessage: null } : current,
    );
    appendLog(
      `Analyzing new/unanalyzed flights for ${year} — ${source.label}`,
    );

    try {
      const analyzeRes = await fetch(`/api/sync/${year}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: syncBody(source, { incremental: true }),
      });
      const analyzeJson = await analyzeRes.json();
      if (!analyzeRes.ok) {
        throw new Error(analyzeJson.error ?? "Analysis failed");
      }

      appendLog(
        `Analysis complete: ${analyzeJson.thermalCount} thermals, ${analyzeJson.yearHotspotClusters ?? analyzeJson.hotspotCount} clusters for ${year}, ${analyzeJson.hotspotCount} hotspots total`,
      );
      appendLog(
        `IGC coverage: ${analyzeJson.flightsWithIgc ?? 0} with IGC, ${analyzeJson.flightsWithTrackPoints ?? 0} with track points`,
      );
      setStep("completed");
      await refreshStatus(year);
    } catch (error) {
      appendLog(formatSyncError(error));
      setStep("failed");
    } finally {
      setRunningOp("none");
    }
  }

  async function refetchIgcAndAnalyze() {
    if (!ensureSourceSelected()) return;

    setRunningOp("refetch");
    setStep("importing");
    appendLog(`Replacing all flights for ${source.label} in ${year}`);

    try {
      const refetchRes = await fetch(`/api/sync/${year}/refetch-igc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: syncBody(source),
      });
      const refetchJson = await refetchRes.json();
      if (!refetchRes.ok) {
        throw new Error(refetchJson.error ?? "IGC refetch failed");
      }

      appendLog(
        `Replaced ${refetchJson.totalDiscovered} flights (${refetchJson.withIgc} with IGC, ${refetchJson.removed} removed)`,
      );

      setStep("analyzing");
      const analyzeRes = await fetch(`/api/sync/${year}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: syncBody(source, { incremental: false }),
      });
      const analyzeJson = await analyzeRes.json();
      if (!analyzeRes.ok) {
        throw new Error(analyzeJson.error ?? "Analysis failed");
      }

      appendLog(
        `Analysis complete: ${analyzeJson.thermalCount} thermals, ${analyzeJson.yearHotspotClusters ?? analyzeJson.hotspotCount} clusters for ${year}, ${analyzeJson.hotspotCount} hotspots total`,
      );
      appendLog(
        `IGC coverage: ${analyzeJson.flightsWithIgc ?? 0} with IGC, ${analyzeJson.flightsWithTrackPoints ?? 0} with track points`,
      );
      setStep("completed");
      await refreshStatus(year);
    } catch (error) {
      appendLog(formatSyncError(error));
      setStep("failed");
    } finally {
      setRunningOp("none");
    }
  }

  async function runFullSync() {
    if (!ensureSourceSelected()) return;

    setRunningOp("sync");
    setStep("discovering");
    setStatus((current) =>
      current ? { ...current, errorMessage: null } : current,
    );
    appendLog(`Starting incremental sync for ${year} — ${source.label}`);

    try {
      appendLog("Fetching flight list via local WeGlide proxy…");
      const flights = await fetchFlightsInBrowser(year, source);

      const discoverRes = await fetch(`/api/sync/${year}/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: syncBody(source, { flights, mode: "incremental" }),
      });
      const discoverJson = await discoverRes.json();
      if (!discoverRes.ok) {
        throw new Error(discoverJson.error ?? "Discovery failed");
      }

      appendLog(
        `Found ${discoverJson.totalDiscovered} qualifying flights (${discoverJson.skippedExisting ?? 0} already in database)`,
      );
      appendLog(`${discoverJson.totalFlights} new flights to import`);
      setStep("importing");

      if (discoverJson.totalFlights === 0) {
        appendLog("No new flights to download. Running analyze for unanalyzed flights.");
        setStep("analyzing");
        const analyzeRes = await fetch(`/api/sync/${year}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: syncBody(source, { incremental: true }),
        });
        const analyzeJson = await analyzeRes.json();
        if (!analyzeRes.ok) {
          throw new Error(analyzeJson.error ?? "Analysis failed");
        }
      appendLog(
        `Analysis complete: ${analyzeJson.thermalCount} thermals, ${analyzeJson.yearHotspotClusters ?? analyzeJson.hotspotCount} clusters for ${year}`,
      );
      if (analyzeJson.flightsAnalyzed === 0) {
        appendLog(
          "No matching flights in the database for this source/year. Run Download new first.",
        );
      }
      setStep("completed");
      await refreshStatus(year);
      return;
    }

      const flightMap = new Map(
        (discoverJson.flights as WeGlideFlight[]).map((flight) => [
          flight.id,
          flight,
        ]),
      );

      let pendingIds = (discoverJson.flights as WeGlideFlight[]).map(
        (flight) => flight.id,
      );
      while (pendingIds.length > 0) {
        const batchFlights = pendingIds
          .slice(0, 5)
          .map((id) => flightMap.get(id))
          .filter((flight): flight is WeGlideFlight => Boolean(flight));

        appendLog(`Downloading IGC files for ${batchFlights.length} flights…`);
        const igcItems = await fetchIgcFilesForFlights(batchFlights);

        const importRes = await fetch(`/api/sync/${year}/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: syncBody(source, { items: igcItems, mode: "incremental" }),
        });
        const importJson = await importRes.json();
        if (!importRes.ok) {
          throw new Error(importJson.error ?? "Import failed");
        }

        pendingIds = pendingIds.slice(batchFlights.length);
        appendLog(
          `Imported batch of ${importJson.importedThisBatch}. ${pendingIds.length} remaining.`,
        );
        await refreshStatus(year);
      }

      setStep("analyzing");
      appendLog("Analyzing thermals and rebuilding hotspots");

      const analyzeRes = await fetch(`/api/sync/${year}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: syncBody(source, { incremental: true }),
      });
      const analyzeJson = await analyzeRes.json();
      if (!analyzeRes.ok) {
        throw new Error(analyzeJson.error ?? "Analysis failed");
      }

      appendLog(
        `Analysis complete: ${analyzeJson.thermalCount} thermals, ${analyzeJson.yearHotspotClusters ?? analyzeJson.hotspotCount} clusters for ${year}, ${analyzeJson.hotspotCount} hotspots total`,
      );
      appendLog(
        `IGC coverage: ${analyzeJson.flightsWithIgc ?? 0} with IGC, ${analyzeJson.flightsWithTrackPoints ?? 0} with track points`,
      );
      setStep("completed");
      await refreshStatus(year);
    } catch (error) {
      const message = formatSyncError(error);
      appendLog(message);
      if (message.includes("403")) {
        appendLog(
          "WeGlide blocked the server request. Email info@weglide.org for an API key, then add WEGLIDE_API_KEY to .env and .env.local.",
        );
      }
      setStep("failed");
    } finally {
      setRunningOp("none");
    }
  }

  const flightProgress =
    step === "analyzing" && status?.analysisPhase === "flights"
      ? progressPercent(status.analyzedFlights, status.totalFlights)
      : null;

  const hotspotProgress =
    step === "analyzing" && status?.analysisPhase === "hotspots"
      ? progressPercent(status.hotspotsProcessed, status.hotspotsTotal)
      : null;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 text-sm font-bold text-slate-950 shadow-lg shadow-sky-500/20">
                ⚙
              </span>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-400">
                Admin
              </p>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Flight Sync
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
              Download WeGlide flights, store track data in Postgres, and rebuild
              thermal hotspots for the selected year.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <a
              href="/upload"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/60 px-5 py-2.5 text-sm font-medium text-slate-200 backdrop-blur transition hover:border-sky-600/50 hover:bg-slate-800"
            >
              Upload IGC
            </a>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/60 px-5 py-2.5 text-sm font-medium text-slate-200 backdrop-blur transition hover:border-sky-600/50 hover:bg-slate-800"
            >
              ← Map
            </a>
          </div>
        </div>

        {dbHealthMessage ? (
          <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {dbHealthMessage}
          </div>
        ) : null}

        <div className="mb-6 rounded-3xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-xl backdrop-blur-sm sm:p-7">
          <h2 className="text-lg font-bold">Flight source</h2>
          <p className="mt-1 text-sm text-slate-400">
            Choose a US club or airport. Download and Analyze only add new
            flights; Re-fetch replaces all flights for this source.
          </p>
          <div className="mt-4">
            <SourcePicker
              value={source}
              onChange={setSource}
              disabled={running}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-2xl shadow-black/30 backdrop-blur-sm sm:p-7">
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-semibold text-slate-400">Calendar year</span>
              <select
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
                disabled={running}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-slate-100 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 sm:max-w-[200px]"
              >
                {YEAR_OPTIONS.map((optionYear) => (
                  <option key={optionYear} value={optionYear}>
                    {optionYear}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-2 sm:grid-cols-3">
              <ActionButton
                primary
                disabled={running}
                loading={runningOp === "sync"}
                loadingLabel="Syncing…"
                onClick={() => void runFullSync()}
              >
                Download new {year}
              </ActionButton>
              <ActionButton
                disabled={running}
                loading={runningOp === "analyze"}
                loadingLabel="Analyzing…"
                onClick={() => void runAnalyzeOnly()}
              >
                Analyze new only
              </ActionButton>
              <ActionButton
                disabled={running}
                loading={runningOp === "refetch"}
                loadingLabel="Replacing…"
                onClick={() => void refetchIgcAndAnalyze()}
              >
                Replace all & analyze
              </ActionButton>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Download skips flights already in the database. Analyze new only
            processes flights without prior analysis. Replace all re-downloads
            every flight for the selected club or airport, removes stale ones,
            then re-analyzes the full set.
          </p>

          {(flightProgress !== null || hotspotProgress !== null) && (
            <div className="mt-5 space-y-3">
              {flightProgress !== null && (
                <ProgressBar
                  label="Processing flights"
                  value={flightProgress}
                  detail={
                    status
                      ? `${status.analyzedFlights} / ${status.totalFlights}`
                      : undefined
                  }
                />
              )}
              {hotspotProgress !== null && (
                <ProgressBar
                  label="Clustering hotspots"
                  value={hotspotProgress}
                  detail={
                    status
                      ? `${status.hotspotsProcessed} / ${status.hotspotsTotal}`
                      : undefined
                  }
                />
              )}
            </div>
          )}

          <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Status" value={step} accent={stepAccent(step)} />
            <Stat
              label="Flights found"
              value={String(status?.totalFlights ?? 0)}
            />
            <Stat
              label="Imported"
              value={String(status?.importedFlights ?? 0)}
            />
            <Stat
              label="Processed"
              value={
                step === "analyzing" && status?.analysisPhase === "flights"
                  ? `${status.analyzedFlights}/${status.totalFlights}`
                  : String(status?.analyzedFlights ?? 0)
              }
            />
            <Stat
              label="Hotspots"
              value={
                step === "analyzing" && status?.analysisPhase === "hotspots"
                  ? `${status.hotspotsProcessed}/${status.hotspotsTotal}`
                  : String(status?.hotspotsProcessed ?? 0)
              }
              className="col-span-2 sm:col-span-1"
            />
          </div>

          {status?.errorMessage && (
            <p className="mt-4 rounded-xl border border-red-800/60 bg-red-950/50 px-4 py-3 text-sm text-red-200">
              {status.errorMessage}
            </p>
          )}
        </div>

        <div className="mt-6 rounded-3xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-xl backdrop-blur-sm sm:p-7">
          <h2 className="text-lg font-bold">Activity log</h2>
          <p className="mt-1 text-sm text-slate-500">Most recent events first</p>
          <div className="mt-4 max-h-[40dvh] space-y-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:max-h-[320px]">
            {log.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                No sync activity yet.
              </p>
            ) : (
              log.map((entry, index) => (
                <p
                  key={`${entry}-${index}`}
                  className="rounded-lg bg-slate-900/80 px-3 py-2 font-mono text-xs leading-relaxed text-slate-300"
                >
                  {entry}
                </p>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function progressPercent(current: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((current / total) * 100));
}

function stepAccent(step: Step): string {
  switch (step) {
    case "completed":
      return "text-emerald-400";
    case "failed":
      return "text-red-400";
    case "analyzing":
    case "importing":
    case "discovering":
      return "text-sky-400";
    default:
      return "text-slate-200";
  }
}

function ActionButton({
  children,
  disabled,
  loading,
  loadingLabel,
  onClick,
  primary,
}: {
  children: React.ReactNode;
  disabled: boolean;
  loading: boolean;
  loadingLabel: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        primary
          ? "bg-gradient-to-r from-sky-400 to-sky-500 text-slate-950 shadow-lg shadow-sky-500/20 hover:from-sky-300 hover:to-sky-400"
          : "border border-slate-600 bg-slate-950/60 text-slate-200 hover:border-slate-500 hover:bg-slate-800",
      ].join(" ")}
    >
      {loading ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {loadingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

function ProgressBar({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-300">{label}</span>
        <span className="text-slate-500">{detail ?? `${value}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-400 transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  className,
}: {
  label: string;
  value: string;
  accent?: string;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3",
        className ?? "",
      ].join(" ")}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p
        className={[
          "mt-1 truncate text-lg font-bold capitalize",
          accent ?? "text-slate-100",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}
