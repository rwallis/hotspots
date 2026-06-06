"use client";

import { useEffect, useState } from "react";
import {
  lookupSourceInBrowser,
  searchSourcesInBrowser,
} from "@/lib/weglide/browser";
import type { SyncSourceDto } from "@/types";

type Props = {
  value: SyncSourceDto;
  onChange: (source: SyncSourceDto) => void;
  disabled?: boolean;
};

const DEFAULT_CLUB: SyncSourceDto = {
  type: "club",
  id: 1006,
  label: "Fault Line Flyers",
};

function friendlySearchError(message: string): string {
  if (message.includes("422") && message.includes("int_parsing")) {
    return "Search is temporarily unavailable. Use a preset below or enter an ID manually.";
  }
  if (message.includes("404")) {
    return "No matches from WeGlide. Try a preset or enter the numeric ID manually.";
  }
  if (message.includes("403")) {
    return "WeGlide blocked the search. Use a preset or enter the ID manually.";
  }
  return "Search unavailable. Use a preset or enter the ID manually.";
}

export default function SourcePicker({ value, onChange, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [manualId, setManualId] = useState("");
  const [results, setResults] = useState<
    Array<{ id: number; label: string; subtitle: string | null }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const presets =
    value.type === "club"
      ? [
          { id: 1006, label: "Fault Line Flyers", subtitle: "Texas" },
          { id: 927, label: "Chicago Glider Club", subtitle: "Illinois" },
        ]
      : [];

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      void searchSourcesInBrowser(value.type, query)
        .then((items) => {
          setResults(items);
          if (items.length === 0) {
            setSearchError("No matches. Try a preset or enter the ID manually.");
          }
        })
        .catch((error) => {
          setResults([]);
          setSearchError(
            friendlySearchError(
              error instanceof Error ? error.message : "Search failed",
            ),
          );
        })
        .finally(() => setSearching(false));
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [query, value.type]);

  async function applyManualId() {
    const token = manualId.trim();
    if (!token) return;

    try {
      const resolved = await lookupSourceInBrowser(value.type, token);
      onChange({
        type: value.type,
        id: resolved.id,
        label: resolved.label,
      });
      setManualId("");
      setQuery("");
      setResults([]);
      setSearchError(null);
    } catch {
      setSearchError(
        `Could not resolve ${value.type}. Try "Name,123" from a WeGlide URL.`,
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["club", "airport"] as const).map((type) => (
          <button
            key={type}
            type="button"
            disabled={disabled}
            onClick={() => {
              onChange(
                type === "club"
                  ? DEFAULT_CLUB
                  : { type: "airport", id: 0, label: "Select an airport" },
              );
              setQuery("");
              setResults([]);
              setSearchError(null);
            }}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              value.type === type
                ? "bg-sky-500 text-slate-950"
                : "border border-slate-600 text-slate-300 hover:bg-slate-800",
            ].join(" ")}
          >
            {type === "club" ? "Club" : "Airport"}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Selected {value.type}
        </p>
        <p className="mt-1 text-lg font-semibold text-slate-100">{value.label}</p>
        {value.id > 0 && (
          <p className="text-sm text-slate-400">ID {value.id}</p>
        )}
      </div>

      {(presets.length > 0 || value.type === "airport") && (
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          {value.type === "club" ? "Quick picks" : "Airport IDs"}
        </p>
        {value.type === "airport" && presets.length === 0 && (
          <p className="mb-2 text-xs text-slate-500">
            Search by name or ICAO, or paste the numeric ID from a WeGlide
            airfield page URL.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange({
                  type: value.type,
                  id: preset.id,
                  label: preset.label,
                })
              }
              className={[
                "rounded-full border px-3 py-1.5 text-sm transition",
                value.id === preset.id
                  ? "border-sky-500 bg-sky-500/20 text-sky-200"
                  : "border-slate-600 text-slate-300 hover:border-slate-500 hover:bg-slate-800",
              ].join(" ")}
            >
              {preset.label}
              {preset.subtitle ? ` (${preset.subtitle})` : ""}
            </button>
          ))}
        </div>
      </div>
      )}

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-semibold text-slate-400">
          Search US {value.type === "club" ? "clubs" : "airports"}
        </span>
        <input
          type="search"
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            value.type === "club"
              ? "e.g. Fault Line Flyers"
              : "e.g. Llano or KLLA"
          }
          className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-slate-100 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
        />
      </label>

      {searching && <p className="text-sm text-slate-500">Searching…</p>}
      {searchError && (
        <p className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          {searchError}
        </p>
      )}

      {results.length > 0 && (
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-2">
          {results.map((result) => (
            <button
              key={`${value.type}-${result.id}`}
              type="button"
              disabled={disabled}
              onClick={() => {
                onChange({
                  type: value.type,
                  id: result.id,
                  label: result.label,
                });
                setQuery("");
                setResults([]);
                setSearchError(null);
              }}
              className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-slate-800"
            >
              <span>
                <span className="block font-medium text-slate-100">
                  {result.label}
                </span>
                {result.subtitle && (
                  <span className="text-xs text-slate-400">{result.subtitle}</span>
                )}
              </span>
              <span className="text-xs text-slate-500">#{result.id}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-2 text-sm">
          <span className="font-semibold text-slate-400">
            Or enter {value.type} ID
          </span>
          <input
            type="number"
            min={1}
            value={manualId}
            disabled={disabled}
            onChange={(event) => setManualId(event.target.value)}
            placeholder={
              value.type === "club" ? "927 or Chicago Glider Club,927" : "12345 or KLLA"
            }
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-slate-100 outline-none transition focus:border-sky-500"
          />
        </label>
        <button
          type="button"
          disabled={disabled || !manualId}
          onClick={() => void applyManualId()}
          className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          Use ID
        </button>
      </div>
    </div>
  );
}
