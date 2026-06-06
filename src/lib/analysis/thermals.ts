import type { DetectedThermal, TrackPoint } from "@/types";

const MIN_CLIMB_KTS = 1;
const MIN_DURATION_SEC = 30;
const MIN_GAIN_FT = 200;
const METERS_TO_FEET = 3.28084;
const MS_TO_KTS = 1.94384;

function climbRateKts(deltaAltM: number, deltaSec: number): number {
  if (deltaSec <= 0) return 0;
  return ((deltaAltM / deltaSec) * MS_TO_KTS);
}

function climbRateFpm(deltaAltM: number, deltaSec: number): number {
  if (deltaSec <= 0) return 0;
  return ((deltaAltM / deltaSec) * METERS_TO_FEET * 60);
}

export function detectThermals(points: TrackPoint[]): DetectedThermal[] {
  if (points.length < 3) return [];

  const thermals: DetectedThermal[] = [];
  let segmentStart = 0;

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const deltaSec = curr.timeSec - prev.timeSec;
    if (deltaSec <= 0 || deltaSec > 120) continue;

    const climbKts = climbRateKts(curr.altM - prev.altM, deltaSec);
    const inLift = climbKts >= MIN_CLIMB_KTS;

    const isLast = i === points.length - 1;
    if (!inLift || isLast) {
      const endIndex = inLift && isLast ? i : i - 1;
      if (endIndex > segmentStart) {
        const segment = points.slice(segmentStart, endIndex + 1);
        const start = segment[0];
        const end = segment[segment.length - 1];
        const durationSec = end.timeSec - start.timeSec;
        const gainFt = (end.altM - start.altM) * METERS_TO_FEET;

        if (durationSec >= MIN_DURATION_SEC && gainFt >= MIN_GAIN_FT) {
          const avgClimbKts =
            segment
              .slice(1)
              .reduce((sum, point, idx) => {
                const prior = segment[idx];
                const dt = point.timeSec - prior.timeSec;
                return sum + climbRateKts(point.altM - prior.altM, dt);
              }, 0) / Math.max(segment.length - 1, 1);

          const centroid = segment.reduce(
            (acc, point) => ({
              lat: acc.lat + point.lat,
              lon: acc.lon + point.lon,
            }),
            { lat: 0, lon: 0 },
          );

          thermals.push({
            lat: centroid.lat / segment.length,
            lon: centroid.lon / segment.length,
            avgClimbKts,
            avgClimbFpm: climbRateFpm(end.altM - start.altM, durationSec),
            altFt: end.altM * METERS_TO_FEET,
            durationSec,
          });
        }
      }

      segmentStart = inLift && isLast ? i : i;
    }
  }

  return thermals;
}
