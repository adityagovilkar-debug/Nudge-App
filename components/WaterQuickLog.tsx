"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Droplets, Plus } from "lucide-react";
import { toast } from "sonner";
import { useWaterLogs, useLogWater } from "@/lib/waterQueries";
import { fmtVolume, localDateKey } from "@/lib/water";

// Compact water strip for the Today page so a glass can be logged without
// switching tabs.
export function WaterQuickLog() {
  const { data: logs = [] } = useWaterLogs();
  const logWater = useLogWater();

  const todayKey = localDateKey(new Date());
  const total = useMemo(
    () =>
      logs
        .filter((l) => localDateKey(l.logged_at) === todayKey)
        .reduce((s, l) => s + l.amount_ml, 0),
    [logs, todayKey],
  );

  return (
    <div className="card flex items-center gap-3 p-3.5">
      <Droplets className="h-6 w-6 shrink-0 text-sky-500" />
      <div className="min-w-0 flex-1">
        <span className="text-base font-semibold">Water</span>
        <Link href="/water" className="ml-2 text-sm text-text-muted hover:underline">
          {fmtVolume(total)} today
        </Link>
      </div>
      <button
        className="btn-outline shrink-0"
        disabled={logWater.isPending}
        onClick={() =>
          logWater.mutate(
            { amount_ml: 250 },
            {
              onSuccess: () => toast.success("Logged 250 ml 💧"),
              onError: (e) => toast.error(e instanceof Error ? e.message : "Could not log"),
            },
          )
        }
      >
        <Plus className="h-5 w-5" /> 250 ml
      </button>
    </div>
  );
}
