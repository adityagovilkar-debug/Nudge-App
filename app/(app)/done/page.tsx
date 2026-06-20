"use client";

import { useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import { useErrands } from "@/lib/queries";
import { splitViews } from "@/lib/errands";
import { ErrandCard } from "@/components/ErrandCard";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonList } from "@/components/Skeleton";

export default function DonePage() {
  const { data: errands, isLoading } = useErrands();

  const done = useMemo(() => splitViews(errands ?? []).done, [errands]);

  return (
    <div>
      <h1 className="mb-1 text-3xl font-bold tracking-tight">Done</h1>
      <p className="mb-6 text-base text-text-muted">
        Everything you&apos;ve completed, most recent first. Tap the circle to bring
        one back.
      </p>

      {isLoading ? (
        <SkeletonList />
      ) : done.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing completed yet"
          hint="As you tick errands off, they'll collect here so you can look back."
        />
      ) : (
        <div className="space-y-3">
          {done.map((e) => (
            <ErrandCard key={e.id} errand={e} />
          ))}
        </div>
      )}
    </div>
  );
}
