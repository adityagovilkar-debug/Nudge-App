"use client";

import { useEffect, useRef, useState } from "react";
import { addDays, format, nextSaturday } from "date-fns";
import {
  X,
  Star,
  Trash2,
  Plus,
  CalendarDays,
  Clock,
  ListChecks,
  Repeat,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCategories,
  useCreateErrand,
  useDeleteErrand,
  useUpdateErrand,
} from "@/lib/queries";
import { RECURRENCE_OPTIONS } from "@/lib/errands";
import { categoryColor } from "@/lib/types";
import type { ChecklistDraft, Errand, ErrandInput, Recurrence } from "@/lib/types";

export function ErrandDialog({
  open,
  errand,
  onClose,
}: {
  open: boolean;
  errand?: Errand;
  onClose: () => void;
}) {
  const isEdit = !!errand;
  const { data: categories = [] } = useCategories();
  const createErrand = useCreateErrand();
  const updateErrand = useUpdateErrand();
  const deleteErrand = useDeleteErrand();

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [important, setImportant] = useState(false);
  const [recurrence, setRecurrence] = useState<"" | Recurrence>("");
  const [checklist, setChecklist] = useState<ChecklistDraft[]>([]);
  const [newItem, setNewItem] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  // (Re)initialize whenever the dialog opens or the target errand changes.
  useEffect(() => {
    if (!open) return;
    setTitle(errand?.title ?? "");
    setNote(errand?.note ?? "");
    setCategoryId(errand?.category_id ?? "");
    setDueDate(errand?.due_date ?? "");
    setDueTime(errand?.due_time ? errand.due_time.slice(0, 5) : "");
    setImportant(errand?.important ?? false);
    setRecurrence((errand?.recurrence as Recurrence) ?? "");
    setChecklist(
      (errand?.checklist ?? []).map((c) => ({
        id: c.id,
        text: c.text,
        done: c.done,
      })),
    );
    setNewItem("");
    // focus the title shortly after the dialog paints
    setTimeout(() => titleRef.current?.focus(), 50);
  }, [open, errand]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const saving = createErrand.isPending || updateErrand.isPending;

  function addChecklistItem() {
    const t = newItem.trim();
    if (!t) return;
    setChecklist((c) => [...c, { text: t, done: false }]);
    setNewItem("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please give your errand a title.");
      titleRef.current?.focus();
      return;
    }
    const input: ErrandInput = {
      title: title.trim(),
      note: note.trim() || null,
      category_id: categoryId || null,
      due_date: dueDate || null,
      due_time: dueTime || null,
      important,
      recurrence: recurrence || null,
    };
    try {
      if (isEdit && errand) {
        const origTime = errand.due_time ? errand.due_time.slice(0, 5) : "";
        const resetReminder =
          (errand.due_date ?? "") !== (input.due_date ?? "") || origTime !== (dueTime || "");
        await updateErrand.mutateAsync({
          id: errand.id,
          input,
          checklist,
          original: errand.checklist ?? [],
          resetReminder,
        });
        toast.success("Saved");
      } else {
        await createErrand.mutateAsync({ input, checklist });
        toast.success("Errand added");
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function onDelete() {
    if (!errand) return;
    if (!confirm(`Delete “${errand.title}”? This can't be undone.`)) return;
    try {
      await deleteErrand.mutateAsync(errand.id);
      toast.success("Deleted");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit errand" : "New errand"}
        className="card max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-b-none rounded-t-3xl sm:rounded-3xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface/95 px-5 py-4 backdrop-blur">
          <h2 className="text-xl font-bold">{isEdit ? "Edit errand" : "New errand"}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-text-muted hover:bg-surface-2 hover:text-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 p-5">
          <div>
            <label className="label" htmlFor="errand-title">
              What do you need to do?
            </label>
            <input
              id="errand-title"
              ref={titleRef}
              className="input text-lg"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Pick up prescription"
              required
            />
          </div>

          {/* Important star + Category */}
          <div className="flex flex-wrap items-end gap-3">
            <button
              type="button"
              onClick={() => setImportant((v) => !v)}
              aria-pressed={important}
              className={`btn-outline ${important ? "border-amber-400 bg-amber-400/10 text-amber-600 dark:text-amber-300" : ""}`}
            >
              <Star className={`h-5 w-5 ${important ? "fill-amber-400 text-amber-400" : ""}`} />
              {important ? "Important" : "Mark important"}
            </button>
            <div className="min-w-[10rem] flex-1">
              <label className="label" htmlFor="errand-cat">
                Category
              </label>
              <select
                id="errand-cat"
                className="select"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {categoryId && (
                <span className={`chip mt-2 ${categoryColor(categories.find((c) => c.id === categoryId)?.color).chip}`}>
                  <span className={`h-2 w-2 rounded-full ${categoryColor(categories.find((c) => c.id === categoryId)?.color).dot}`} />
                  {categories.find((c) => c.id === categoryId)?.name}
                </span>
              )}
            </div>
          </div>

          {/* Due date + time */}
          <div>
            <label className="label">
              <CalendarDays className="mr-1 inline h-4 w-4" /> When is it due?
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="chip ring-border hover:bg-surface-2" onClick={() => setDueDate(format(new Date(), "yyyy-MM-dd"))}>
                Today
              </button>
              <button type="button" className="chip ring-border hover:bg-surface-2" onClick={() => setDueDate(format(addDays(new Date(), 1), "yyyy-MM-dd"))}>
                Tomorrow
              </button>
              <button type="button" className="chip ring-border hover:bg-surface-2" onClick={() => setDueDate(format(nextSaturday(new Date()), "yyyy-MM-dd"))}>
                This weekend
              </button>
              {(dueDate || dueTime) && (
                <button type="button" className="chip text-rose-600 ring-border hover:bg-surface-2" onClick={() => { setDueDate(""); setDueTime(""); }}>
                  Clear
                </button>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                type="date"
                aria-label="Due date"
                className="input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="time"
                  aria-label="Due time"
                  className="input"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  disabled={!dueDate}
                />
              </div>
            </div>
            {!dueDate && (
              <p className="mt-1.5 text-sm text-text-muted">No date — it&apos;ll wait in “Upcoming · Someday”.</p>
            )}
          </div>

          {/* Recurrence */}
          <div>
            <label className="label" htmlFor="errand-repeat">
              <Repeat className="mr-1 inline h-4 w-4" /> Repeat
            </label>
            <select
              id="errand-repeat"
              className="select"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as Recurrence | "")}
            >
              <option value="">Does not repeat</option>
              {RECURRENCE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {recurrence && (
              <p className="mt-1.5 text-sm text-text-muted">
                When you tick this off, the next one is created automatically.
              </p>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="label" htmlFor="errand-note">
              Note (optional)
            </label>
            <textarea
              id="errand-note"
              className="input min-h-[72px] resize-y"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything to remember…"
            />
          </div>

          {/* Checklist */}
          <div>
            <label className="label">
              <ListChecks className="mr-1 inline h-4 w-4" /> Checklist / shopping items (optional)
            </label>
            {checklist.length > 0 && (
              <ul className="mb-2 space-y-2">
                {checklist.map((item, i) => (
                  <li key={item.id ?? `new-${i}`} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.done}
                      aria-label={`Mark ${item.text} done`}
                      onChange={(e) =>
                        setChecklist((c) =>
                          c.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)),
                        )
                      }
                      className="h-5 w-5 shrink-0 accent-brand-600"
                    />
                    <input
                      className="input py-2"
                      value={item.text}
                      onChange={(e) =>
                        setChecklist((c) =>
                          c.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)),
                        )
                      }
                    />
                    <button
                      type="button"
                      aria-label="Remove item"
                      className="rounded-lg p-2 text-text-muted hover:bg-surface-2 hover:text-rose-600"
                      onClick={() => setChecklist((c) => c.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                className="input"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addChecklistItem();
                  }
                }}
                placeholder="Add an item…"
              />
              <button type="button" className="btn-outline shrink-0" onClick={addChecklistItem}>
                <Plus className="h-5 w-5" /> Add
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            {isEdit && (
              <button
                type="button"
                onClick={onDelete}
                className="btn-ghost text-rose-600 hover:bg-rose-500/10"
              >
                <Trash2 className="h-5 w-5" /> Delete
              </button>
            )}
            <div className="flex-1" />
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add errand"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
