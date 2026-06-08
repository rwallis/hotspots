"use client";

import { useMemo } from "react";
import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import {
  buildGliderMarkerHtml,
  kmhToKts,
  ognFlightMode,
  ognMapLabel,
  ognMarkerColor,
} from "@/lib/ogn/display";
import type { OgnAircraftDto } from "@/types";

type Props = {
  aircraft: OgnAircraftDto;
};

export default function OgnGliderMarker({ aircraft }: Props) {
  const mode = ognFlightMode(aircraft);
  const color = ognMarkerColor(mode);

  const icon = useMemo(
    () =>
      L.divIcon({
        className: "ogn-glider-divicon",
        html: buildGliderMarkerHtml(aircraft),
        iconSize: [88, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -18],
      }),
    [
      aircraft.id,
      aircraft.trackDeg,
      aircraft.climbMps,
      aircraft.callsign,
      aircraft.addrType,
      aircraft.anonymous,
    ],
  );

  const speedKts =
    aircraft.groundSpeedKmh != null && aircraft.groundSpeedKmh > 0
      ? Math.round(kmhToKts(aircraft.groundSpeedKmh))
      : null;

  return (
    <Marker position={[aircraft.lat, aircraft.lon]} icon={icon}>
      <Popup className="ogn-popup">
        <div className="ogn-popup__card">
          <div
            className="ogn-popup__header"
            style={{ borderColor: `${color}55`, background: `${color}18` }}
          >
            <div>
              <div className="ogn-popup__title">{aircraft.callsign}</div>
              <div className="ogn-popup__subtitle">
                {aircraft.anonymous ? "Hidden identity" : ognMapLabel(aircraft)}
                {aircraft.addrType && !aircraft.anonymous
                  ? ` · ${aircraft.addrType}`
                  : ""}
              </div>
            </div>
            {aircraft.climbFpm != null && (
              <span
                className="ogn-popup__badge"
                style={{ color, borderColor: `${color}66`, background: `${color}22` }}
              >
                {aircraft.climbFpm > 0 ? "+" : ""}
                {aircraft.climbFpm} fpm
              </span>
            )}
          </div>

          <div className="ogn-popup__stats">
            {aircraft.altFt != null && (
              <div className="ogn-popup__stat">
                <span className="ogn-popup__stat-label">Altitude</span>
                <span className="ogn-popup__stat-value">
                  {aircraft.altFt.toLocaleString()} ft
                </span>
              </div>
            )}
            {speedKts != null && (
              <div className="ogn-popup__stat">
                <span className="ogn-popup__stat-label">Speed</span>
                <span className="ogn-popup__stat-value">{speedKts} kt</span>
              </div>
            )}
            {aircraft.trackDeg != null && aircraft.trackDeg > 0 && (
              <div className="ogn-popup__stat">
                <span className="ogn-popup__stat-label">Track</span>
                <span className="ogn-popup__stat-value">
                  {Math.round(aircraft.trackDeg)}°
                </span>
              </div>
            )}
          </div>

          {aircraft.receiver && (
            <div className="ogn-popup__meta">Receiver: {aircraft.receiver}</div>
          )}
          {aircraft.time && (
            <div className="ogn-popup__meta">Last update: {aircraft.time} UTC</div>
          )}
          <div className="ogn-popup__credit">Live data © Open Glider Network</div>
        </div>
      </Popup>
    </Marker>
  );
}
