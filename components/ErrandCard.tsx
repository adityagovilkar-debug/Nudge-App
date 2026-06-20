"use client";

import { useState } from "react";
import {
  Check,
  Star,
  Repeat,
  ChevronDown,
  ListChecks,
  Plus,
  Trash2,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAddChecklistItem,
  useDeleteChecklistItem,
  useSetImportant,
  useToggleChecklistItem,
  useToggleDone,
} from "@/lib/queries";
import { dueLabel, dueStatus, type DueStatus } from "@/lib/errands";
import { categoryColor } from "@/lib/types";
import { openErrandDialog } from "@/lib/events";
import { cn } from "@/lib/utils";
import type { Errand } from "@/lib/types";

const DUE_STYLES: Record<DueStatus, string> = {
  overdue: "text-rose-600 dark:text-rose-400 font-semibold",
  today: "text-brand-700 dark:text-brand-300 font-semibold",
  tomorrow: "text-sky-700 dark:text-sky-400",
  upcoming: "text-text-muted",
  someday: "text-text-muted",
};

export function ErrandCard({ errand }: { errand: Errand }) {
  const toggleDone = useToggleDone();
  const setImportant = useSetImportant();
  const addItem = useAddChecklistItem();
  const toggleItem = useToggleChecklistItem();
  const deleteItem = useDeleteChecklistItem();

  const [expanded, setExpanded] = useState(false);
  const [newItem, setNewItem] = useState("");

  const checklist = errand.checklist ?? [];
  const doneCount = checklist.filter((c) => c.done).length;
  const hasChecklist = checklist.length > 0;
  const status = dueStatus(errand);

  function onToggleDone(e: React.MouseEvent) {
    e.stopPropagation();
    toggleDone.mutate(errand, {
      onSuccess: () => {
        if (!errand.done) {
          toast.success(
            errand.recurrence ? "Done! Next one scheduled." : "Nice — done!",
          );
        }
      },
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Could not update"),
    });
  }

  function onToggleImportant(e: React.MouseEvent) {
    e.stopPropagation();
    setImportant.mutate({ id: errand.id, important: !errand.important });
  }

  function onAddItem() {
    const t = newItem.trim();
    if (!t) return;
    addItem.mutate(
      { errand_id: errand.id, text: t, position: checklist.length },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add") },
    );
    setNewItem("");
  }

  return (
    <div
      className={cn(
        "card overflow-hidden transition",
        errand.done && "opacity-65",
        errand.important && !errand.done && "ring-1 ring-amber-400/40",
      )}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Done toggle */}
        <button
          onClick={onToggleDone}
          aria-label={errand.done ? "Mark not done" : "Mark done"}
          aria-pressed={errand.done}
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90",
            errand.done
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-border text-transparent hover:border-brand-500 hover:text-brand-500/40",
          )}
        >
          <Check className="h-5 w-5" strokeWidth={3} />
        </button>

        {/* Body — tap to edit */}
        <button
          type="button"
          onClick={() => openErrandDialog(errand)}
          className="min-w-0 flex-1 text-left"
        >
          <p
            className={cn(
              "break-words text-lg font-medium leading-snug",
              errand.done && "line-through text-text-muted",
            )}
          >
            {errand.title}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
            {errand.done && errand.done_at ? (
              <span className="text-text-muted">
                Done {dueLabelDone(errand.done_at)}
              </span>
            ) : (
              errand.due_date || errand.due_time ? (
                <span className={DUE_STYLES[status]}>{dueLabel(errand)}</span>
              ) : (
                <span className="text-text-muted">No date</span>
              )
            )}

            {errand.category && (
              <span className={`chip ${categoryColor(errand.category.color).chip}`}>
                <span className={`h-2 w-2 rounded-full ${categoryColor(errand.category.color).dot}`} />
                {errand.category.name}
              </span>
            )}

            {errand.recurrence && (
              <span className="inline-flex items-center gap-1 text-text-muted">
                <Repeat className="h-4 w-4" /> repeats
              </span>
            )}

            {errand.note && (
              <span className="inline-flex items-center gap-1 text-text-muted">
                <StickyNote className="h-4 w-4" /> note
              </span>
            )}
          </div>
        </button>

        {/* Important star */}
        <button
          onClick={onToggleImportant}
          aria-label={errand.important ? "Remove important" : "Mark important"}
          aria-pressed={errand.important}
          className="shrink-0 rounded-lg p-1.5 hover:bg-surface-2"
        >
          <Star
            className={cn(
              "h-6 w-6 transition",
              errand.important ? "fill-amber-400 text-amber-400" : "text-text-muted/50",
            )}
          />
        </button>
      </div>

      {/* Checklist */}
      {hasChecklist && (
        <div className="border-t border-border">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-text-muted hover:bg-surface-2"
          >
            <ListChecks className="h-4 w-4" />
            <span>
              {doneCount}/{checklist.length} items
            </span>
            <div className="ml-1 h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${(doneCount / checklist.length) * 100}%` }}
              />
            </div>
            <ChevronDown className={cn("h-4 w-4 transition", expanded && "rotate-180")} />
          </button>

          {expanded && (
            <div className="space-y-1 px-4 pb-3">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2.5 py-1">
                  <button
                    onClick={() => toggleItem.mutate({ id: item.id, done: !item.done })}
                    aria-label={item.done ? `Uncheck ${item.text}` : `Check ${item.text}`}
                    aria-pressed={item.done}
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition active:scale-90",
                      item.done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-border text-transparent hover:border-brand-500",
                    )}
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </button>
                  <span className={cn("flex-1 text-base", item.done && "text-text-muted line-through")}>
                    {item.text}
                  </span>
                  <button
                    onClick={() => deleteItem.mutate(item.id)}
                    aria-label={`Remove ${item.text}`}
                    className="rounded-md p-1.5 text-text-muted/60 hover:bg-surface-2 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <input
                  className="input py-2"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onAddItem();
                    }
                  }}
                  placeholder="Add an item…"
                />
                <button className="btn-outline shrink-0" onClick={onAddItem}>
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// "today", "Mon, Jun 16" — a light relative label for completion time.
function dueLabelDone(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return "today";
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
