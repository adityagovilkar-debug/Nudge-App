// Shared water-tracker types + pure helpers. No "use client" — this module is
// imported by both the client hooks and the server push-send route.

export interface WaterSettings {
  user_id: string;
  daily_goal_ml: number | null;
  reminders_enabled: boolean;
  reminders_per_day: number;
  window_start: string; // "HH:MM[:SS]"
  window_end: string;
  last_water_reminder_key: string | null;
  created_at: string;
}

export interface WaterContainer {
  id: string;
  user_id: string;
  name: string;
  volume_ml: number;
  sort_order: number;
  created_at: string;
}

export interface WaterLog {
  id: string;
  user_id: string;
  amount_ml: number;
  container_id: string | null;
  logged_at: string;
  created_at: string;
}

export const DEFAULT_CONTAINERS: { name: string; volume_ml: number }[] = [
  { name: "Glass", volume_ml: 250 },
  { name: "Mug", volume_ml: 350 },
  { name: "Bottle", volume_ml: 750 },
];

export const WATER_DEFAULTS = {
  reminders_per_day: 8,
  window_start: "08:00",
  window_end: "21:00",
};

/** "HH:MM[:SS]" → minutes since midnight. */
export function toMinutes(t: string): number {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

/** minutes since midnight → "HH:MM". */
export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Evenly-spaced reminder times (minutes from midnight) across the window. */
export function reminderTimes(perDay: number, startMin: number, endMin: number): number[] {
  if (perDay <= 0 || endMin <= startMin) return [];
  if (perDay === 1) return [Math.round((startMin + endMin) / 2)];
  const step = (endMin - startMin) / (perDay - 1);
  return Array.from({ length: perDay }, (_, i) => Math.round(startMin + i * step));
}

/** "1,250 ml" (and "1.25 L" once it's a litre or more). */
export function fmtVolume(ml: number): string {
  if (ml >= 1000) {
    const l = ml / 1000;
    return `${l.toLocaleString(undefined, { maximumFractionDigits: 2 })} L`;
  }
  return `${ml.toLocaleString()} ml`;
}

/** Local calendar date "YYYY-MM-DD" for a timestamp (browser timezone). */
export function localDateKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
