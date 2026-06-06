"use client";

import { useEffect, useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";
import { Circle, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { HotspotDto } from "@/types";

type Props = {
  hotspots: HotspotDto[];
  initialView?: [number, number, number];
  fullHeight?: boolean;
  darkChrome?: boolean;
  selectedHotspotId?: string | null;
  onSelectHotspot?: (id: string | null) => void;
};

type BaseLayer = "street" | "satellite" | "topo" | "dark";

const LAYER_LABELS: Record<BaseLayer, string> = {
  street: "Street",
  satellite: "Sat",
  topo: "Topo",
  dark: "Dark",
};

function pilotColor(pilot: string): string {
  const hue = [...pilot].reduce((acc, char) => (acc + char.charCodeAt(0)) % 360, 0);
  return `hsl(${hue} 78% 44%)`;
}

export default function HotspotMap({
  hotspots,
  initialView,
  fullHeight,
  darkChrome = false,
  selectedHotspotId,
  onSelectHotspot,
}: Props) {
  const [base, setBase] = useState<BaseLayer>("topo");
  const [showHotspots, setShowHotspots] = useState(true);

  const selected = useMemo(
    () => hotspots.find((hotspot) => hotspot.id === selectedHotspotId) ?? null,
    [hotspots, selectedHotspotId],
  );

  const center = useMemo<[number, number, number]>(() => {
    if (initialView) return initialView;
    if (hotspots.length) {
      const lat =
        hotspots.reduce((sum, hotspot) => sum + hotspot.lat, 0) / hotspots.length;
      const lon =
        hotspots.reduce((sum, hotspot) => sum + hotspot.lon, 0) / hotspots.length;
      return [lat, lon, 9];
    }
    return [30.495, -97.996, 8];
  }, [hotspots, initialView]);

  useEffect(() => {
    if (selectedHotspotId && !selected) {
      onSelectHotspot?.(null);
    }
  }, [selected, selectedHotspotId, onSelectHotspot]);

  const tile = (() => {
    switch (base) {
      case "satellite":
        return {
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          attribution:
            "Tiles © Esri — Sources: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
          maxZoom: 19,
        };
      case "topo":
        return {
          url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
          attribution:
            "Map data: © OSM contributors, SRTM | Style: © OpenTopoMap (CC-BY-SA)",
          maxZoom: 17,
        };
      case "dark":
        return {
          url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
          attribution: "© OSM contributors © CARTO",
          maxZoom: 19,
        };
      case "street":
      default:
        return {
          url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19,
        };
    }
  })();

  return (
    <div
      className={
        fullHeight
          ? "relative h-full w-full"
          : "relative h-[70vh] w-full overflow-hidden rounded-2xl border"
      }
    >
      <MapContainer
        center={[center[0], center[1]]}
        zoom={center[2]}
        className="h-full w-full z-0"
        scrollWheelZoom
      >
        <TileLayer url={tile.url} attribution={tile.attribution} maxZoom={tile.maxZoom} />

        {showHotspots &&
          hotspots.map((hotspot) => {
            const radiusMeters = Math.max(180, 160 * hotspot.avgClimbKts);
            const color = pilotColor(hotspot.pilot);
            const isSelected = hotspot.id === selectedHotspotId;
            return (
              <Circle
                key={hotspot.id}
                center={[hotspot.lat, hotspot.lon]}
                radius={radiusMeters}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: isSelected ? 0.55 : 0.32,
                  weight: isSelected ? 3 : 2,
                }}
                eventHandlers={{
                  click: () => onSelectHotspot?.(hotspot.id),
                }}
              />
            );
          })}

        {selected && (
          <Popup
            position={[selected.lat, selected.lon]}
            eventHandlers={{ remove: () => onSelectHotspot?.(null) }}
          >
            <div className="min-w-[180px] space-y-1.5 text-sm">
              <div className="text-base font-bold text-slate-900">{selected.name}</div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800">
                  {selected.avgClimbKts.toFixed(1)} kt
                </span>
                <span className="text-xs text-slate-500">
                  {selected.count} occurrence{selected.count === 1 ? "" : "s"}
                </span>
              </div>
              <div className="text-xs text-slate-600">
                <span className="font-medium text-slate-700">Pilots:</span>{" "}
                {selected.pilots.join(", ")}
              </div>
              <div className="text-xs text-slate-600">
                <span className="font-medium text-slate-700">Years:</span>{" "}
                {selected.years.join(", ")}
              </div>
              {selected.flights?.length ? (
                <div className="max-w-[220px] border-t border-slate-100 pt-1.5 text-xs text-slate-500">
                  {selected.flights.slice(0, 3).join(", ")}
                  {selected.flights.length > 3 ? "…" : ""}
                </div>
              ) : null}
            </div>
          </Popup>
        )}
      </MapContainer>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-0 z-[1000]">
        <div className="pointer-events-auto absolute bottom-3 left-3 right-3 flex flex-col gap-2 sm:left-auto sm:right-3 sm:max-w-[220px]">
          <div
            className={[
              "rounded-2xl border p-2.5 shadow-xl backdrop-blur-md",
              darkChrome
                ? "border-slate-700/80 bg-slate-900/90 shadow-black/30"
                : "border-white/80 bg-white/95 shadow-slate-900/10",
            ].join(" ")}
          >
            <p
              className={[
                "mb-1.5 hidden text-[10px] font-bold uppercase tracking-wider sm:block",
                darkChrome ? "text-slate-500" : "text-slate-400",
              ].join(" ")}
            >
              Map style
            </p>
            <div className="grid grid-cols-4 gap-1 sm:grid-cols-2">
              {(["street", "satellite", "topo", "dark"] as BaseLayer[]).map((layer) => (
                <button
                  key={layer}
                  type="button"
                  onClick={() => setBase(layer)}
                  className={[
                    "rounded-lg px-2 py-2 text-[11px] font-semibold transition sm:py-1.5",
                    base === layer
                      ? darkChrome
                        ? "bg-sky-500 text-slate-950 shadow-sm"
                        : "bg-slate-900 text-white shadow-sm"
                      : darkChrome
                        ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  ].join(" ")}
                >
                  {LAYER_LABELS[layer]}
                </button>
              ))}
            </div>
            <label
              className={[
                "mt-2 flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-xs font-medium",
                darkChrome ? "text-slate-300" : "text-slate-700",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={showHotspots}
                onChange={(event) => setShowHotspots(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500/40"
              />
              Show hotspots
            </label>
          </div>

          {hotspots.length > 0 && (
            <div
              className={[
                "rounded-xl border px-3 py-2 text-center text-xs font-medium shadow-lg backdrop-blur-md sm:text-left",
                darkChrome
                  ? "border-slate-700/80 bg-slate-900/85 text-slate-400"
                  : "border-white/80 bg-white/90 text-slate-600",
              ].join(" ")}
            >
              {hotspots.length} hotspot{hotspots.length === 1 ? "" : "s"} on map
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
