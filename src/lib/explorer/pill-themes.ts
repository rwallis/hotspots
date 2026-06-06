export type PillTheme = {
  sourceActive: string;
  sourceInactive: string;
  pilotActive: string;
  pilotInactive: string;
  sectionLabel: string;
  dot: string;
};

export const SOURCE_PILL_THEMES: PillTheme[] = [
  {
    sourceActive:
      "border-sky-400/70 bg-gradient-to-br from-sky-400 to-sky-600 text-slate-950 shadow-lg shadow-sky-500/30",
    sourceInactive:
      "border-slate-700 bg-slate-800/70 text-slate-300 hover:border-sky-500/40 hover:bg-slate-800 hover:text-sky-100",
    pilotActive:
      "border-sky-400/60 bg-sky-500/90 text-white shadow-md shadow-sky-500/20",
    pilotInactive:
      "border-slate-700/80 bg-slate-800/40 text-slate-400 hover:border-sky-500/30 hover:text-sky-100",
    sectionLabel: "text-sky-400",
    dot: "bg-sky-400",
  },
  {
    sourceActive:
      "border-violet-400/70 bg-gradient-to-br from-violet-400 to-violet-600 text-white shadow-lg shadow-violet-500/30",
    sourceInactive:
      "border-slate-700 bg-slate-800/70 text-slate-300 hover:border-violet-500/40 hover:bg-slate-800 hover:text-violet-100",
    pilotActive:
      "border-violet-400/60 bg-violet-500/90 text-white shadow-md shadow-violet-500/20",
    pilotInactive:
      "border-slate-700/80 bg-slate-800/40 text-slate-400 hover:border-violet-500/30 hover:text-violet-100",
    sectionLabel: "text-violet-400",
    dot: "bg-violet-400",
  },
  {
    sourceActive:
      "border-amber-400/70 bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/30",
    sourceInactive:
      "border-slate-700 bg-slate-800/70 text-slate-300 hover:border-amber-500/40 hover:bg-slate-800 hover:text-amber-100",
    pilotActive:
      "border-amber-400/60 bg-amber-500/90 text-slate-950 shadow-md shadow-amber-500/20",
    pilotInactive:
      "border-slate-700/80 bg-slate-800/40 text-slate-400 hover:border-amber-500/30 hover:text-amber-100",
    sectionLabel: "text-amber-400",
    dot: "bg-amber-400",
  },
  {
    sourceActive:
      "border-emerald-400/70 bg-gradient-to-br from-emerald-400 to-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/30",
    sourceInactive:
      "border-slate-700 bg-slate-800/70 text-slate-300 hover:border-emerald-500/40 hover:bg-slate-800 hover:text-emerald-100",
    pilotActive:
      "border-emerald-400/60 bg-emerald-500/90 text-slate-950 shadow-md shadow-emerald-500/20",
    pilotInactive:
      "border-slate-700/80 bg-slate-800/40 text-slate-400 hover:border-emerald-500/30 hover:text-emerald-100",
    sectionLabel: "text-emerald-400",
    dot: "bg-emerald-400",
  },
];

export function themeForSourceIndex(index: number): PillTheme {
  return SOURCE_PILL_THEMES[index % SOURCE_PILL_THEMES.length];
}

export function sourceTypeBadge(type: string): string {
  if (type === "club") return "Club";
  if (type === "airport") return "Airport";
  return "Upload";
}
