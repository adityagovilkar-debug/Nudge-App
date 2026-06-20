import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  parseISO,
} from "date-fns";
import type { Errand, Recurrence } from "./types";

// ---------------------------------------------------------------------
// Dates are stored as plain "YYYY-MM-DD" (no timezone). We treat them in
// the user's local day, which is what a person means by "due Tuesday".
// ---------------------------------------------------------------------

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** Calendar days from today. Negative = in the past. null if no date. */
export function daysUntil(due: string | null): number | null {
  if (!due) return null;
  return differenceInCalendarDays(parseISO(due), new Date());
}

export type DueStatus = "overdue" | "today" | "tomorrow" | "upcoming" | "someday";

export function dueStatus(e: Pick<Errand, "due_date">): DueStatus {
  const d = daysUntil(e.due_date);
  if (d === null) return "someday";
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  return "upcoming";
}

/** "3:00 PM" from a "HH:MM[:SS]" time string. */
export function formatTime(t: string | null): string | null {
  if (!t) return null;
  const [h, m] = t.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m), 0, 0);
  return format(d, "h:mm a");
}

/** Friendly due label, e.g. "Today, 3:00 PM" / "Overdue · Mon, Jun 16". */
export function dueLabel(e: Pick<Errand, "due_date" | "due_time">): string {
  const time = formatTime(e.due_time);
  if (!e.due_date) return "No date";
  const d = daysUntil(e.due_date);
  const dateObj = parseISO(e.due_date);
  let day: string;
  if (d === 0) day = "Today";
  else if (d === 1) day = "Tomorrow";
  else if (d === -1) day = "Yesterday";
  else if (d !== null && d > 1 && d < 7) day = format(dateObj, "EEEE"); // Tuesday
  else day = format(dateObj, "EEE, MMM d"); // Mon, Jun 16
  const base = time ? `${day}, ${time}` : day;
  if (d !== null && d < 0) return `Overdue · ${base}`;
  return base;
}

/** Sort within a list: by date (soonest first, no-date last), then time,
 *  then Important first, then title. */
export function compareErrands(a: Errand, b: Errand): number {
  const da = a.due_date ?? "9999-99-99";
  const db = b.due_date ?? "9999-99-99";
  if (da !== db) return da < db ? -1 : 1;
  const ta = a.due_time ?? "99:99";
  const tb = b.due_time ?? "99:99";
  if (ta !== tb) return ta < tb ? -1 : 1;
  if (a.important !== b.important) return a.important ? -1 : 1;
  return a.title.localeCompare(b.title);
}

export interface Views {
  today: Errand[]; // overdue + due today, not done
  upcoming: Errand[]; // future or no-date, not done
  done: Errand[]; // completed
  overdueCount: number;
}

export function splitViews(errands: Errand[]): Views {
  const today: Errand[] = [];
  const upcoming: Errand[] = [];
  const done: Errand[] = [];
  let overdueCount = 0;

  for (const e of errands) {
    if (e.done) {
      done.push(e);
      continue;
    }
    const d = daysUntil(e.due_date);
    if (d !== null && d <= 0) {
      today.push(e);
      if (d < 0) overdueCount++;
    } else {
      upcoming.push(e);
    }
  }

  today.sort(compareErrands);
  upcoming.sort(compareErrands);
  // Done: most recently completed first.
  done.sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));

  return { today, upcoming, done, overdueCount };
}

export interface ErrandGroup {
  key: string;
  label: string;
  items: Errand[];
}

/** Group the Upcoming list into friendly date sections. */
export function groupUpcoming(items: Errand[]): ErrandGroup[] {
  const groups = new Map<string, ErrandGroup>();
  const order: string[] = [];

  function bucket(e: Errand): { key: string; label: string } {
    const d = daysUntil(e.due_date);
    if (d === null) return { key: "someday", label: "Someday (no date)" };
    if (d === 1) return { key: "tomorrow", label: "Tomorrow" };
    if (d < 7) return { key: `wk-${e.due_date}`, label: format(parseISO(e.due_date!), "EEEE, MMM d") };
    if (d < 14) return { key: "nextweek", label: "Next week" };
    if (d < 31) return { key: "later", label: "Later this month" };
    return { key: "future", label: "Further ahead" };
  }

  for (const e of items) {
    const { key, label } = bucket(e);
    if (!groups.has(key)) {
      groups.set(key, { key, label, items: [] });
      order.push(key);
    }
    groups.get(key)!.items.push(e);
  }

  // someday always sinks to the bottom regardless of insertion order.
  order.sort((a, b) => {
    if (a === "someday") return 1;
    if (b === "someday") return -1;
    return 0;
  });
  return order.map((k) => groups.get(k)!);
}

// ---------------------------------------------------------------------
// Recurrence — "on completion" model.
// ---------------------------------------------------------------------
export const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
  { value: "yearly", label: "Every year" },
];

export function recurrenceLabel(r: Recurrence | null, interval = 1): string {
  if (!r) return "Does not repeat";
  const base = { daily: "day", weekly: "week", monthly: "month", yearly: "year" }[r];
  return interval > 1 ? `Every ${interval} ${base}s` : `Every ${base}`;
}

/** The due date for the next occurrence after completing a recurring errand.
 *  Advances from the errand's own due date if it has one, else from today. */
export function nextRecurrenceDate(
  recurrence: Recurrence,
  fromDate: string | null,
  interval = 1,
): string {
  const base = fromDate ? parseISO(fromDate) : new Date();
  let next: Date;
  switch (recurrence) {
    case "daily":
      next = addDays(base, interval);
      break;
    case "weekly":
      next = addWeeks(base, interval);
      break;
    case "monthly":
      next = addMonths(base, interval);
      break;
    case "yearly":
      next = addYears(base, interval);
      break;
  }
  // If advancing from a past date would still be in the past, roll forward
  // to the next future occurrence so the new errand is actually upcoming.
  while (differenceInCalendarDays(next, new Date()) < 0) {
    switch (recurrence) {
      case "daily":
        next = addDays(next, interval);
        break;
      case "weekly":
        next = addWeeks(next, interval);
        break;
      case "monthly":
        next = addMonths(next, interval);
        break;
      case "yearly":
        next = addYears(next, interval);
        break;
    }
  }
  return format(next, "yyyy-MM-dd");
}
