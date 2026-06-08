export const METERS_TO_FEET = 3.28084;
export const MS_TO_KTS = 1.94384;

export function feetToMeters(ft: number): number {
  return ft / METERS_TO_FEET;
}

export function metersToFeet(m: number): number {
  return m * METERS_TO_FEET;
}

export function climbRateKts(deltaAltM: number, deltaSec: number): number {
  if (deltaSec <= 0) return 0;
  return (deltaAltM / deltaSec) * MS_TO_KTS;
}

export function climbRateFpm(deltaAltM: number, deltaSec: number): number {
  if (deltaSec <= 0) return 0;
  return (deltaAltM / deltaSec) * METERS_TO_FEET * 60;
}

export type ThermalSegmentMetrics = {
  startAltFt: number;
  endAltFt: number;
  durationSec: number;
  avgClimbKts: number;
  avgClimbFpm: number;
};

/** Climb from thermal start altitude, end altitude, and elapsed seconds. */
export function thermalMetricsFromMeters(
  startAltM: number,
  endAltM: number,
  durationSec: number,
): ThermalSegmentMetrics | null {
  if (durationSec <= 0) return null;
  const deltaAltM = endAltM - startAltM;
  return {
    startAltFt: metersToFeet(startAltM),
    endAltFt: metersToFeet(endAltM),
    durationSec,
    avgClimbKts: climbRateKts(deltaAltM, durationSec),
    avgClimbFpm: climbRateFpm(deltaAltM, durationSec),
  };
}

export function thermalMetricsFromFeet(
  startAltFt: number,
  endAltFt: number,
  durationSec: number,
): ThermalSegmentMetrics | null {
  if (durationSec <= 0) return null;
  const deltaAltM = feetToMeters(endAltFt - startAltFt);
  return {
    startAltFt,
    endAltFt,
    durationSec,
    avgClimbKts: climbRateKts(deltaAltM, durationSec),
    avgClimbFpm: climbRateFpm(deltaAltM, durationSec),
  };
}

export function expectedClimbKts(
  startAltFt: number,
  endAltFt: number,
  durationSec: number,
): number {
  return thermalMetricsFromFeet(startAltFt, endAltFt, durationSec)?.avgClimbKts ?? 0;
}

export function climbKtsMismatch(
  storedKts: number,
  startAltFt: number,
  endAltFt: number,
  durationSec: number,
  toleranceKts = 0.05,
): boolean {
  return (
    Math.abs(storedKts - expectedClimbKts(startAltFt, endAltFt, durationSec)) >
    toleranceKts
  );
}
