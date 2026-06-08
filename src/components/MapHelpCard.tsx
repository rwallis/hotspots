"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "hotspots.mapHelp.dismissed.v2";

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
              ✦
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400">
                Hotspots map
              </p>
              <h2
                id="map-help-title"
                className="text-lg font-bold tracking-tight text-slate-100"
              >
                What&apos;s new &amp; how to use it
              </h2>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
          <section className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
            <h3 className="text-sm font-bold text-amber-300">What&apos;s new</h3>
            <ul className="mt-2 space-y-2 text-xs leading-relaxed text-slate-300 sm:text-sm">
              <li>
                <strong className="text-slate-100">Smarter filters</strong> — Min occurs, Min
                fpm, Min ToL, and Min gain (ft) in the header. Combine them to find repeatable,
                strong, high-base thermals.
              </li>
              <li>
                <strong className="text-slate-100">Richer hotspot popups</strong> — click a
                circle to see each thermal&apos;s start/end altitude, gain, duration (minutes),
                and climb rate.
              </li>
              <li>
                <strong className="text-slate-100">Better climb math</strong> — lift is
                calculated from start altitude, end altitude, and elapsed time (not GPS
                point spikes).
              </li>
              <li>
                <strong className="text-slate-100">Club data</strong> — Fault Line Flyers and
                Chicago Glider Club flights from WeGlide, filterable by club and pilot.
              </li>
            </ul>
          </section>

          <section className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
            <h3 className="text-sm font-bold text-sky-300">Help guide</h3>
            <div className="mt-2 space-y-3 text-xs leading-relaxed text-slate-300 sm:text-sm">
              <div>
                <p className="font-semibold text-slate-200">Reading the map</p>
                <ul className="mt-1.5 list-inside list-disc space-y-1 text-slate-400">
                  <li>Colored circles are thermal hotspots — places multiple flights found lift.</li>
                  <li>Bigger circles generally mean stronger average climb.</li>
                  <li>Use map controls (bottom-right) for basemap and hotspot visibility.</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-slate-200">Using filters</p>
                <ul className="mt-1.5 list-inside list-disc space-y-1 text-slate-400">
                  <li>
                    <strong className="text-slate-300">Year</strong> — one season or all years.
                  </li>
                  <li>
                    <strong className="text-slate-300">Min occurs</strong> — how many times the
                    spot was hit (try 3+).
                  </li>
                  <li>
                    <strong className="text-slate-300">Min fpm</strong> — minimum climb rate (try
                    200+).
                  </li>
                  <li>
                    <strong className="text-slate-300">Min ToL</strong> — minimum top-of-lift in
                    ft MSL.
                  </li>
                  <li>
                    <strong className="text-slate-300">Min gain</strong> — minimum ft climbed in
                    one thermal (try 1500+).
                  </li>
                  <li>
                    <strong className="text-slate-300">Club / pilot pills</strong> — narrow by
                    source or individual pilot.
                  </li>
                  <li>
                    Tap <strong className="text-slate-300">Clear</strong> to reset everything.
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-slate-200">List view &amp; uploads</p>
                <ul className="mt-1.5 list-inside list-disc space-y-1 text-slate-400">
                  <li>
                    Tap <strong className="text-slate-300">List</strong> for a scrollable hotspot
                    list beside the map.
                  </li>
                  <li>
                    Use <strong className="text-slate-300">Upload</strong> to add IGC files
                    (needs HPLTPILOT and HFDTE headers).
                  </li>
                </ul>
              </div>
            </div>
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
