"use client";

import dynamic from "next/dynamic";
import type { HotspotDto } from "@/types";

const HotspotMap = dynamic(() => import("@/components/HotspotMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 sm:min-h-[420px]">
      <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-sky-400 animate-spin" />
      <p className="text-sm font-medium text-slate-400">Loading map…</p>
    </div>
  ),
});

type Props = {
  hotspots: HotspotDto[];
  initialView?: [number, number, number];
  fullHeight?: boolean;
  darkChrome?: boolean;
  selectedHotspotId?: string | null;
  onSelectHotspot?: (id: string | null) => void;
  filterYear?: string;
};

export default function HotspotMapClient(props: Props) {
  return <HotspotMap {...props} />;
}
