"use client";

import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import { useErrands } from "@/lib/queries";
import { splitViews, groupUpcoming } from "@/lib/errands";
import { ErrandCard } from "@/components/ErrandCard";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonList } from "@/components/Skeleton";
import { openErrandDialog } from "@/lib/events";

export default function UpcomingPage() {
  const { data: errands, isLoading } = useErrands();

  const groups = useMemo(() => {
    const v = splitViews(errands ?? []);
    return groupUpcoming(v.upcoming);
  }, [errands]);

  return (
    <div>
      <h1 className="mb-1 text-3xl font-bold tracking-tight">Upcoming</h1>
      <p className="mb-6 text-base text-text-muted">
        Everything ahead of today, and anything without a date.
      </p>

      {isLoading ? (
        <SkeletonList />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nothing coming up"
          hint="When you add errands with a future date, they'll appear here grouped by day."
          action={
            <button className="btn-primary" onClick={() => openErrandDialog()}>
              Add an errand
            </button>
          }
        />
      ) : (
        <div className="space-y-7">
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-text-muted">
                {g.label}
              </h2>
              <div className="space-y-3">
                {g.items.map((e) => (
                  <ErrandCard key={e.id} errand={e} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
