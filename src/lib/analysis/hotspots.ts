import type { DetectedThermal } from "@/types";

export type ThermalInput = DetectedThermal & {
  pilotName: string;
  year: number;
  flightLabel: string;
};

export type ClusteredHotspot = {
  name: string;
  lat: number;
  lon: number;
  avgClimbKts: number;
  count: number;
  years: number[];
  pilotNames: string[];
  flights: string[];
  thermals: ThermalInput[];
};

export const CLUSTER_RADIUS_M = 800;
const MIN_THERMALS_PER_HOTSPOT = 1;

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

export function clusterHotspots(thermals: ThermalInput[]): ClusteredHotspot[] {
  const clusters: ClusteredHotspot[] = [];

  for (const thermal of thermals) {
    let target: ClusteredHotspot | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const cluster of clusters) {
      const distance = haversineMeters(
        thermal.lat,
        thermal.lon,
        cluster.lat,
        cluster.lon,
      );
      if (distance <= CLUSTER_RADIUS_M && distance < bestDistance) {
        target = cluster;
        bestDistance = distance;
      }
    }

    if (!target) {
      clusters.push({
        name: `Hotspot ${clusters.length + 1}`,
        lat: thermal.lat,
        lon: thermal.lon,
        avgClimbKts: thermal.avgClimbKts,
        count: 1,
        years: [thermal.year],
        pilotNames: [thermal.pilotName],
        flights: [thermal.flightLabel],
        thermals: [thermal],
      });
      continue;
    }

    const nextCount = target.count + 1;
    target.lat =
      (target.lat * target.count + thermal.lat) / nextCount;
    target.lon =
      (target.lon * target.count + thermal.lon) / nextCount;
    target.avgClimbKts =
      (target.avgClimbKts * target.count + thermal.avgClimbKts) / nextCount;
    target.count = nextCount;
    if (!target.years.includes(thermal.year)) {
      target.years.push(thermal.year);
    }
    if (!target.pilotNames.includes(thermal.pilotName)) {
      target.pilotNames.push(thermal.pilotName);
    }
    if (!target.flights.includes(thermal.flightLabel)) {
      target.flights.push(thermal.flightLabel);
    }
    target.thermals.push(thermal);
  }

  return clusters
    .filter((cluster) => cluster.count >= MIN_THERMALS_PER_HOTSPOT)
    .sort((a, b) => b.avgClimbKts - a.avgClimbKts || b.count - a.count)
    .map((cluster, index) => ({
      ...cluster,
      name: `Hotspot ${index + 1}`,
    }));
}
