"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { Sun, PartyPopper, AlertCircle, Star } from "lucide-react";
import { useErrands, useProfile } from "@/lib/queries";
import { splitViews, daysUntil } from "@/lib/errands";
import { ErrandCard } from "@/components/ErrandCard";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonList } from "@/components/Skeleton";
import { WaterQuickLog } from "@/components/WaterQuickLog";
import { openErrandDialog } from "@/lib/events";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function TodayPage() {
  const { data: errands, isLoading } = useErrands();
  const { data: profile } = useProfile();
  const firstName = (profile?.full_name ?? "").split(" ")[0];

  const { overdue, today } = useMemo(() => {
    const v = splitViews(errands ?? []);
    return {
      overdue: v.today.filter((e) => (daysUntil(e.due_date) ?? 0) < 0),
      today: v.today.filter((e) => (daysUntil(e.due_date) ?? 0) === 0),
    };
  }, [errands]);

  const importantToday = today.filter((e) => e.important).length;

  return (
    <div>
      <div className="mb-6">
        <p className="text-base text-text-muted">{format(new Date(), "EEEE, MMMM d")}</p>
        <h1 className="mt-0.5 text-3xl font-bold tracking-tight">
          {greeting()}{firstName ? `, ${firstName}` : ""}
        </h1>
        {!isLoading && (
          <p className="mt-1 text-base text-text-muted">
            {today.length === 0 && overdue.length === 0
              ? "You're all caught up for today."
              : `You have ${today.length} thing${today.length === 1 ? "" : "s"} for today` +
                (importantToday ? ` · ${importantToday} important` : "") +
                (overdue.length ? ` · ${overdue.length} overdue` : "") + "."}
          </p>
        )}
      </div>

      <div className="mb-5">
        <WaterQuickLog />
      </div>

      {isLoading ? (
        <SkeletonList />
      ) : overdue.length === 0 && today.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          title="Nothing due today"
          hint="Enjoy your day! Tap below to add an errand or reminder whenever you need to."
          action={
            <button className="btn-primary" onClick={() => openErrandDialog()}>
              Add an errand
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-4 w-4" /> Overdue
              </h2>
              <div className="space-y-3">
                {overdue.map((e) => (
                  <ErrandCard key={e.id} errand={e} />
                ))}
              </div>
            </section>
          )}

          {today.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-text-muted">
                <Sun className="h-4 w-4" /> Today
              </h2>
              <div className="space-y-3">
                {today.map((e) => (
                  <ErrandCard key={e.id} errand={e} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* subtle hint about important items */}
      {!isLoading && importantToday > 0 && (
        <p className="mt-6 flex items-center justify-center gap-1.5 text-sm text-text-muted">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> Starred items are
          your important ones.
        </p>
      )}
    </div>
  );
}
