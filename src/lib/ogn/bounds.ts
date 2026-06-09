import type { Map } from "leaflet";
import type { OgnBounds } from "@/lib/ogn/fetch";

export function boundsFromLeaflet(map: Map): OgnBounds | null {
  const bounds = map.getBounds();
  const north = bounds.getNorth();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const west = bounds.getWest();

  if (
    !Number.isFinite(north) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(west) ||
    north <= south ||
    east <= west
  ) {
    return null;
  }

  return { north, south, east, west };
}
