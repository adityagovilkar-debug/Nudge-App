"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useCategories, useDeleteCategory, useUpsertCategory } from "@/lib/queries";
import {
  CATEGORY_COLOR_KEYS,
  CATEGORY_COLORS,
  type CategoryColorKey,
} from "@/lib/types";
import { cn } from "@/lib/utils";

function ColorPicker({
  value,
  onChange,
}: {
  value: CategoryColorKey;
  onChange: (c: CategoryColorKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORY_COLOR_KEYS.map((k) => (
        <button
          key={k}
          type="button"
          aria-label={CATEGORY_COLORS[k].label}
          aria-pressed={value === k}
          onClick={() => onChange(k)}
          className={cn(
            "h-7 w-7 rounded-full ring-offset-2 ring-offset-surface transition",
            CATEGORY_COLORS[k].dot,
            value === k ? "ring-2 ring-text" : "ring-1 ring-black/10",
          )}
        />
      ))}
    </div>
  );
}

export function CategoryManager() {
  const { data: categories = [] } = useCategories();
  const upsert = useUpsertCategory();
  const del = useDeleteCategory();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<CategoryColorKey>("indigo");

  const [adding, setAdding] = useState(false);
  const [addName, setAddName] = useState("");
  const [addColor, setAddColor] = useState<CategoryColorKey>("indigo");

  function startEdit(id: string, name: string, color: CategoryColorKey) {
    setEditingId(id);
    setEditName(name);
    setEditColor(color);
  }

  async function saveEdit() {
    if (!editName.trim()) return;
    try {
      await upsert.mutateAsync({ id: editingId!, name: editName.trim(), color: editColor });
      setEditingId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  async function add() {
    if (!addName.trim()) return;
    try {
      await upsert.mutateAsync({ name: addName.trim(), color: addColor });
      setAddName("");
      setAddColor("indigo");
      setAdding(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add");
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete the “${name}” category? Errands keep their other details.`)) return;
    try {
      await del.mutateAsync(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {categories.map((c) =>
          editingId === c.id ? (
            <li key={c.id} className="rounded-xl border border-border bg-surface-2/50 p-3">
              <input
                className="input mb-3"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
              <ColorPicker value={editColor} onChange={setEditColor} />
              <div className="mt-3 flex justify-end gap-2">
                <button className="btn-ghost" onClick={() => setEditingId(null)}>
                  <X className="h-4 w-4" /> Cancel
                </button>
                <button className="btn-primary" onClick={saveEdit} disabled={upsert.isPending}>
                  <Check className="h-4 w-4" /> Save
                </button>
              </div>
            </li>
          ) : (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
            >
              <span className={cn("h-4 w-4 shrink-0 rounded-full", CATEGORY_COLORS[c.color].dot)} />
              <span className="flex-1 text-base font-medium">{c.name}</span>
              <button
                aria-label={`Edit ${c.name}`}
                className="rounded-lg p-2 text-text-muted hover:bg-surface-2 hover:text-text"
                onClick={() => startEdit(c.id, c.name, c.color)}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                aria-label={`Delete ${c.name}`}
                className="rounded-lg p-2 text-text-muted hover:bg-surface-2 hover:text-rose-600"
                onClick={() => remove(c.id, c.name)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ),
        )}
      </ul>

      {adding ? (
        <div className="rounded-xl border border-border bg-surface-2/50 p-3">
          <input
            className="input mb-3"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="Category name"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <ColorPicker value={addColor} onChange={setAddColor} />
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={add} disabled={upsert.isPending}>
              Add category
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-outline w-full" onClick={() => setAdding(true)}>
          <Plus className="h-5 w-5" /> Add a category
        </button>
      )}
    </div>
  );
}
