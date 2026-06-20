// Shared data types + the small fixed palette used for category colors.

export type Recurrence = "daily" | "weekly" | "monthly" | "yearly";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  email_reminders: boolean;
  timezone: string;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: CategoryColorKey;
  sort_order: number;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  errand_id: string;
  user_id: string;
  text: string;
  done: boolean;
  position: number;
  created_at: string;
}

export interface Errand {
  id: string;
  user_id: string;
  title: string;
  note: string | null;
  category_id: string | null;
  due_date: string | null; // YYYY-MM-DD
  due_time: string | null; // HH:MM[:SS]
  important: boolean;
  done: boolean;
  done_at: string | null;
  recurrence: Recurrence | null;
  recurrence_interval: number;
  created_at: string;
  updated_at: string;
  // joined / computed client-side
  category?: Category | null;
  checklist?: ChecklistItem[];
}

// What the Add/Edit form produces.
export interface ErrandInput {
  title: string;
  note: string | null;
  category_id: string | null;
  due_date: string | null;
  due_time: string | null;
  important: boolean;
  recurrence: Recurrence | null;
}

// A checklist row while being edited in the dialog. Missing id = new.
export interface ChecklistDraft {
  id?: string;
  text: string;
  done: boolean;
}

// ---------------------------------------------------------------------
// Category color palette. A category stores just the key; the UI maps it
// to Tailwind classes here so colors stay consistent and accessible in
// both light and dark mode.
// ---------------------------------------------------------------------
export type CategoryColorKey =
  | "indigo"
  | "emerald"
  | "rose"
  | "amber"
  | "sky"
  | "violet"
  | "teal"
  | "orange"
  | "pink"
  | "slate";

export const CATEGORY_COLORS: Record<
  CategoryColorKey,
  { label: string; chip: string; dot: string }
> = {
  indigo: {
    label: "Indigo",
    chip: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 ring-indigo-500/30",
    dot: "bg-indigo-500",
  },
  emerald: {
    label: "Green",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30",
    dot: "bg-emerald-500",
  },
  rose: {
    label: "Rose",
    chip: "bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-rose-500/30",
    dot: "bg-rose-500",
  },
  amber: {
    label: "Amber",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30",
    dot: "bg-amber-500",
  },
  sky: {
    label: "Sky",
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-500/30",
    dot: "bg-sky-500",
  },
  violet: {
    label: "Violet",
    chip: "bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-violet-500/30",
    dot: "bg-violet-500",
  },
  teal: {
    label: "Teal",
    chip: "bg-teal-500/15 text-teal-700 dark:text-teal-300 ring-teal-500/30",
    dot: "bg-teal-500",
  },
  orange: {
    label: "Orange",
    chip: "bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-orange-500/30",
    dot: "bg-orange-500",
  },
  pink: {
    label: "Pink",
    chip: "bg-pink-500/15 text-pink-700 dark:text-pink-300 ring-pink-500/30",
    dot: "bg-pink-500",
  },
  slate: {
    label: "Gray",
    chip: "bg-slate-400/15 text-slate-700 dark:text-slate-300 ring-slate-400/30",
    dot: "bg-slate-500",
  },
};

export const CATEGORY_COLOR_KEYS = Object.keys(
  CATEGORY_COLORS,
) as CategoryColorKey[];

export function categoryColor(key: string | null | undefined) {
  return CATEGORY_COLORS[(key as CategoryColorKey) ?? "slate"] ?? CATEGORY_COLORS.slate;
}
