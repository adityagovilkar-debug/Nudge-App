"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Droplets, Plus, Trash2, GlassWater, ChevronDown, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  useWaterSettings,
  useWaterContainers,
  useWaterLogs,
  useLogWater,
  useDeleteWaterLog,
  useEnsureWaterDefaults,
} from "@/lib/waterQueries";
import { fmtVolume, localDateKey } from "@/lib/water";
import { WaterConfig } from "@/components/WaterConfig";
import { SkeletonList } from "@/components/Skeleton";

export default function WaterPage() {
  const ensure = useEnsureWaterDefaults();
  const ensured = useRef(false);

  const { data: settings, isLoading: sLoading } = useWaterSettings();
  const { data: containers = [], isLoading: cLoading } = useWaterContainers();
  const { data: logs = [], isLoading: lLoading } = useWaterLogs();
  const logWater = useLogWater();
  const deleteLog = useDeleteWaterLog();

  const [custom, setCustom] = useState("");
  const [showConfig, setShowConfig] = useState(false);

  // First-time setup for users who pre-date this feature.
  useEffect(() => {
    if (ensured.current || sLoading || cLoading) return;
    if (!settings || containers.length === 0) {
      ensured.current = true;
      ensure.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, containers.length, sLoading, cLoading]);

  const todayKey = localDateKey(new Date());
  const todayLogs = useMemo(
    () => logs.filter((l) => localDateKey(l.logged_at) === todayKey),
    [logs, todayKey],
  );
  const total = todayLogs.reduce((s, l) => s + l.amount_ml, 0);
  const goal = settings?.daily_goal_ml ?? null;
  const pct = goal ? Math.min(1, total / goal) : 0;

  // Last 7 days totals for the mini history.
  const history = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const l of logs) {
      const k = localDateKey(l.logged_at);
      byDay.set(k, (byDay.get(k) ?? 0) + l.amount_ml);
    }
    const days: { key: string; label: string; ml: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = localDateKey(d);
      days.push({ key: k, label: format(d, "EEEEE"), ml: byDay.get(k) ?? 0 });
    }
    return days;
  }, [logs]);
  const histMax = Math.max(goal ?? 0, ...history.map((d) => d.ml), 1);

  const containerName = (id: string | null) =>
    containers.find((c) => c.id === id)?.name ?? "Water";

  function drink(amount_ml: number, container_id?: string) {
    logWater.mutate(
      { amount_ml, container_id },
      { onError: (e) => toast.error(e instanceof Error ? e.message : "Could not log") },
    );
  }

  function addCustom() {
    const v = parseInt(custom, 10);
    if (!v || v <= 0) return;
    drink(v);
    setCustom("");
  }

  const R = 54;
  const C = 2 * Math.PI * R;

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <Droplets className="h-7 w-7 text-sky-500" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Water</h1>
          <p className="text-sm text-text-muted">{format(new Date(), "EEEE, MMMM d")}</p>
        </div>
      </div>

      {sLoading && lLoading ? (
        <SkeletonList rows={3} />
      ) : (
        <div className="space-y-6">
          {/* Total / goal */}
          <div className="card flex flex-col items-center p-6">
            {goal ? (
              <div className="relative h-44 w-44">
                <svg viewBox="0 0 130 130" className="h-44 w-44 -rotate-90">
                  <circle cx="65" cy="65" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
                  <circle
                    cx="65"
                    cy="65"
                    r={R}
                    fill="none"
                    stroke="var(--color-brand-500)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={C}
                    strokeDashoffset={C * (1 - pct)}
                    style={{ transition: "stroke-dashoffset .4s ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-bold tabular-nums">{fmtVolume(total)}</span>
                  <span className="text-sm text-text-muted">of {fmtVolume(goal)}</span>
                  <span className="mt-0.5 text-sm font-semibold text-brand-600 dark:text-brand-300">
                    {Math.round(pct * 100)}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-2">
                <span className="text-5xl font-bold tabular-nums">{fmtVolume(total)}</span>
                <span className="mt-1 text-base text-text-muted">so far today</span>
              </div>
            )}
          </div>

          {/* Quick add */}
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-text-muted">
              Add a drink
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {containers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => drink(c.volume_ml, c.id)}
                  className="card flex flex-col items-center gap-1 px-3 py-4 transition active:scale-95 hover:border-brand-500/40"
                >
                  <GlassWater className="h-7 w-7 text-sky-500" />
                  <span className="text-base font-semibold">{c.name}</span>
                  <span className="text-sm text-text-muted">{fmtVolume(c.volume_ml)}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className="input"
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Custom amount (ml)"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustom()}
              />
              <button className="btn-outline shrink-0" onClick={addCustom}>
                <Plus className="h-5 w-5" /> Add
              </button>
            </div>
          </section>

          {/* Today's log */}
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-text-muted">
              Today&apos;s drinks
            </h2>
            {todayLogs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-surface/50 px-4 py-6 text-center text-base text-text-muted">
                Nothing logged yet — tap a container above when you have a drink.
              </p>
            ) : (
              <ul className="space-y-2">
                {todayLogs.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5"
                  >
                    <Droplets className="h-5 w-5 shrink-0 text-sky-500" />
                    <span className="flex-1 text-base font-medium">{fmtVolume(l.amount_ml)}</span>
                    <span className="text-sm text-text-muted">
                      {containerName(l.container_id)} ·{" "}
                      {new Date(l.logged_at).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <button
                      aria-label="Remove"
                      className="rounded-lg p-2 text-text-muted/60 hover:bg-surface-2 hover:text-rose-600"
                      onClick={() => deleteLog.mutate(l.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 7-day history */}
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-text-muted">
              Last 7 days
            </h2>
            <div className="card flex items-end justify-between gap-2 p-4" style={{ height: "9rem" }}>
              {history.map((d) => (
                <div key={d.key} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className={`w-full rounded-t-md ${d.ml > 0 ? "bg-sky-400 dark:bg-sky-500" : "bg-surface-2"}`}
                      style={{ height: `${Math.max(4, (d.ml / histMax) * 100)}%` }}
                      title={fmtVolume(d.ml)}
                    />
                  </div>
                  <span className="text-xs text-text-muted">{d.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Config */}
          <section>
            <button
              onClick={() => setShowConfig((v) => !v)}
              className="flex w-full items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-left text-base font-semibold hover:bg-surface-2"
            >
              <Settings2 className="h-5 w-5 text-text-muted" />
              Reminders &amp; containers
              <ChevronDown className={`ml-auto h-5 w-5 transition ${showConfig ? "rotate-180" : ""}`} />
            </button>
            {showConfig && (
              <div className="mt-3 card p-5">
                <WaterConfig />
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
