"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Check, X, Bell } from "lucide-react";
import { toast } from "sonner";
import {
  useWaterSettings,
  useUpdateWaterSettings,
  useWaterContainers,
  useUpsertWaterContainer,
  useDeleteWaterContainer,
} from "@/lib/waterQueries";
import { WATER_DEFAULTS, fmtVolume } from "@/lib/water";

function ContainerManager() {
  const { data: containers = [] } = useWaterContainers();
  const upsert = useUpsertWaterContainer();
  const del = useDeleteWaterContainer();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [vol, setVol] = useState("");
  const [unit, setUnit] = useState<"ml" | "L">("ml");

  function reset() {
    setEditingId(null);
    setName("");
    setVol("");
    setUnit("ml");
  }

  function toMl(): number {
    const v = parseFloat(vol);
    if (isNaN(v) || v <= 0) return 0;
    return Math.round(unit === "L" ? v * 1000 : v);
  }

  async function save() {
    const ml = toMl();
    if (!name.trim() || ml <= 0) {
      toast.error("Give the container a name and a size.");
      return;
    }
    try {
      await upsert.mutateAsync({ id: editingId ?? undefined, name: name.trim(), volume_ml: ml });
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {containers.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
          >
            <span className="flex-1 text-base font-medium">{c.name}</span>
            <span className="text-sm text-text-muted">{fmtVolume(c.volume_ml)}</span>
            <button
              aria-label={`Edit ${c.name}`}
              className="rounded-lg p-2 text-text-muted hover:bg-surface-2 hover:text-text"
              onClick={() => {
                setEditingId(c.id);
                setName(c.name);
                if (c.volume_ml % 1000 === 0 && c.volume_ml >= 1000) {
                  setVol(String(c.volume_ml / 1000));
                  setUnit("L");
                } else {
                  setVol(String(c.volume_ml));
                  setUnit("ml");
                }
              }}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              aria-label={`Delete ${c.name}`}
              className="rounded-lg p-2 text-text-muted hover:bg-surface-2 hover:text-rose-600"
              onClick={() => del.mutate(c.id)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-border bg-surface-2/50 p-3">
        <p className="label">{editingId ? "Edit container" : "Add a container"}</p>
        <div className="flex flex-wrap gap-2">
          <input
            className="input min-w-[8rem] flex-1"
            placeholder="Name (e.g. Glass)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input w-24"
            type="number"
            min="0"
            step="any"
            placeholder="Size"
            value={vol}
            onChange={(e) => setVol(e.target.value)}
          />
          <select
            className="select w-20"
            value={unit}
            onChange={(e) => setUnit(e.target.value as "ml" | "L")}
            aria-label="Unit"
          >
            <option value="ml">ml</option>
            <option value="L">L</option>
          </select>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          {editingId && (
            <button className="btn-ghost" onClick={reset}>
              <X className="h-4 w-4" /> Cancel
            </button>
          )}
          <button className="btn-primary" onClick={save} disabled={upsert.isPending}>
            {editingId ? <Check className="h-4 w-4" /> : <Plus className="h-5 w-5" />}
            {editingId ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WaterConfig() {
  const { data: settings } = useWaterSettings();
  const update = useUpdateWaterSettings();

  const [goal, setGoal] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [perDay, setPerDay] = useState(WATER_DEFAULTS.reminders_per_day);
  const [start, setStart] = useState(WATER_DEFAULTS.window_start);
  const [end, setEnd] = useState(WATER_DEFAULTS.window_end);

  useEffect(() => {
    if (!settings) return;
    setGoal(settings.daily_goal_ml ? String(settings.daily_goal_ml) : "");
    setEnabled(settings.reminders_enabled);
    setPerDay(settings.reminders_per_day);
    setStart(settings.window_start.slice(0, 5));
    setEnd(settings.window_end.slice(0, 5));
  }, [settings]);

  async function save() {
    try {
      await update.mutateAsync({
        daily_goal_ml: goal ? Math.max(0, parseInt(goal, 10)) || null : null,
        reminders_enabled: enabled,
        reminders_per_day: Math.min(16, Math.max(1, perDay)),
        window_start: start,
        window_end: end,
      });
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  return (
    <div className="space-y-6">
      {/* Goal */}
      <div>
        <label className="label" htmlFor="goal">
          Daily goal (optional)
        </label>
        <div className="flex items-center gap-2">
          <input
            id="goal"
            type="number"
            min="0"
            step="50"
            className="input w-40"
            placeholder="e.g. 2000"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
          <span className="text-base text-text-muted">ml</span>
        </div>
        <p className="mt-1.5 text-sm text-text-muted">Leave blank to just track the total.</p>
      </div>

      {/* Reminders */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="label mb-0 flex items-center gap-1.5">
            <Bell className="h-4 w-4" /> Water reminders
          </p>
          <button
            role="switch"
            aria-checked={enabled}
            aria-label="Water reminders"
            onClick={() => setEnabled((v) => !v)}
            className={`relative h-8 w-14 shrink-0 rounded-full transition ${
              enabled ? "bg-brand-600" : "border border-border bg-surface-2"
            }`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
                enabled ? "left-7" : "left-1"
              }`}
            />
          </button>
        </div>

        <div className={enabled ? "space-y-3" : "pointer-events-none space-y-3 opacity-50"}>
          <div>
            <label className="label" htmlFor="perday">
              How many reminders a day?
            </label>
            <div className="flex items-center gap-3">
              <button
                className="btn-outline h-11 w-11 !px-0"
                onClick={() => setPerDay((n) => Math.max(1, n - 1))}
                aria-label="Fewer"
              >
                −
              </button>
              <span className="w-10 text-center text-2xl font-bold tabular-nums">{perDay}</span>
              <button
                className="btn-outline h-11 w-11 !px-0"
                onClick={() => setPerDay((n) => Math.min(16, n + 1))}
                aria-label="More"
              >
                +
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="ws">From</label>
              <input id="ws" type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="we">Until</label>
              <input id="we" type="time" className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <p className="text-sm text-text-muted">
            Reminders are spread evenly between these times. You&apos;ll get them on any
            device where notifications are on.
          </p>
        </div>
      </div>

      <button className="btn-primary w-full" onClick={save} disabled={update.isPending}>
        {update.isPending ? "Saving…" : "Save settings"}
      </button>

      {/* Containers */}
      <div>
        <p className="label">Your containers</p>
        <ContainerManager />
      </div>
    </div>
  );
}
