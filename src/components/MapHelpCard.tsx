"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "hotspots.mapHelp.dismissed";

type MapHelpCardProps = {
  onDismiss: () => void;
};

export function readMapHelpDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function saveMapHelpDismissed(): void {
  localStorage.setItem(STORAGE_KEY, "1");
}

export default function MapHelpCard({ onDismiss }: MapHelpCardProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const dismiss = useCallback(() => {
    if (dontShowAgain) {
      saveMapHelpDismissed();
    }
    onDismiss();
  }, [dontShowAgain, onDismiss]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dismiss();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismiss]);

  return (
    <div
      className="absolute inset-0 z-[1100] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-help-title"
    >
      <div className="flex max-h-[min(90dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 shadow-2xl shadow-black/40 sm:rounded-3xl">
        <div className="border-b border-slate-800 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 text-xs font-bold text-slate-950 shadow-md shadow-sky-500/20">
              ?
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400">
                Quick guide
              </p>
              <h2
                id="map-help-title"
                className="text-lg font-bold tracking-tight text-slate-100"
              >
                How to use the map
              </h2>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
          <section className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
            <h3 className="text-sm font-bold text-sky-300">Reading the map</h3>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-300 sm:text-sm">
              <li>
                Colored circles are <strong className="text-slate-100">thermal hotspots</strong>{" "}
                where multiple flights found lift.
              </li>
              <li>
                <strong className="text-slate-100">Click a circle</strong> for climb rate, count,
                pilots, and years.
              </li>
              <li>
                Use map controls (bottom-right) for basemap and hotspot visibility.
              </li>
            </ul>
          </section>

          <section className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
            <h3 className="text-sm font-bold text-violet-300">Filters</h3>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-300 sm:text-sm">
              <li>
                <strong className="text-slate-100">Year</strong> limits hotspots to one calendar
                year or all years.
              </li>
              <li>
                <strong className="text-slate-100">Club / airport pills</strong> filter by source;
                pilot pills appear when a source is selected.
              </li>
              <li>
                Tap <strong className="text-slate-100">Clear</strong> to reset filters.
              </li>
            </ul>
          </section>

          <section className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
            <h3 className="text-sm font-bold text-emerald-300">Upload flights</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">
              Use <strong className="text-slate-100">Upload</strong> to add IGC files. Each file
              needs <strong className="text-slate-100">HPLTPILOT</strong> and{" "}
              <strong className="text-slate-100">HFDTE</strong> headers — pilot and date are read
              from the file automatically.
            </p>
          </section>
        </div>

        <div className="border-t border-slate-800 px-4 py-3 sm:px-5 sm:py-4">
          <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-400 sm:text-sm">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(event) => setDontShowAgain(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-950 text-sky-500 focus:ring-sky-500/40"
            />
            <span>Don&apos;t show this when I open the map</span>
          </label>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex flex-1 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-sky-600 px-4 py-2 text-sm font-semibold text-slate-950 shadow-md shadow-sky-500/20 transition hover:from-sky-300 hover:to-sky-500 sm:flex-none sm:px-6"
            >
              Got it
            </button>
            <a
              href="/help"
              className="inline-flex flex-1 items-center justify-center rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-600/50 hover:bg-slate-800 sm:flex-none sm:px-5"
            >
              Full guide
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
