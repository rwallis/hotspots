/** Format IGC track time (seconds from midnight, may include day offset) as HH:MM:SS. */
export function formatTimeSec(timeSec: number): string {
  const daySeconds = ((timeSec % 86_400) + 86_400) % 86_400;
  const hours = Math.floor(daySeconds / 3600);
  const minutes = Math.floor((daySeconds % 3600) / 60);
  const seconds = daySeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function formatThermalDateTime(
  flightDate: Date,
  timeSec: number | null | undefined,
): string | null {
  if (timeSec == null || !Number.isFinite(timeSec)) return null;
  const date = flightDate.toISOString().slice(0, 10);
  return `${date} ${formatTimeSec(timeSec)}`;
}
