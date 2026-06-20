"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { nextRecurrenceDate } from "@/lib/errands";
import type {
  Category,
  ChecklistDraft,
  ChecklistItem,
  Errand,
  ErrandInput,
  Profile,
} from "@/lib/types";

const sb = supabaseBrowser;

async function uid(): Promise<string> {
  const {
    data: { user },
  } = await sb().auth.getUser();
  if (!user) throw new Error("Not signed in");
  return user.id;
}

// =====================================================================
// Profile
// =====================================================================
export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await sb()
        .from("profiles")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      const id = await uid();
      const { error } = await sb().from("profiles").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

// =====================================================================
// Categories
// =====================================================================
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await sb()
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: Partial<Category> & { name: string }) => {
      const id = await uid();
      if (c.id) {
        const { error } = await sb()
          .from("categories")
          .update({ name: c.name, color: c.color })
          .eq("id", c.id);
        if (error) throw error;
      } else {
        // place new categories at the end
        const { data: last } = await sb()
          .from("categories")
          .select("sort_order")
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        const { error } = await sb().from("categories").insert({
          user_id: id,
          name: c.name,
          color: c.color ?? "indigo",
          sort_order: (last?.sort_order ?? -1) + 1,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb().from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["errands"] });
    },
  });
}

// =====================================================================
// Errands (with joined category + checklist)
// =====================================================================
export function useErrands() {
  return useQuery({
    queryKey: ["errands"],
    queryFn: async (): Promise<Errand[]> => {
      const { data, error } = await sb()
        .from("errands")
        .select("*, category:categories(*), checklist:checklist_items(*)")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      // sort each errand's checklist by position
      return (data ?? []).map((e: Errand) => ({
        ...e,
        checklist: (e.checklist ?? []).slice().sort((a, b) => a.position - b.position),
      }));
    },
  });
}

// optimistic helper: patch a single errand in the cache
function patchErrand(qc: QueryClient, id: string, patch: Partial<Errand>) {
  const prev = qc.getQueryData<Errand[]>(["errands"]);
  qc.setQueryData<Errand[]>(["errands"], (old) =>
    (old ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e)),
  );
  return prev;
}

// Insert the checklist drafts for a freshly-created errand.
async function insertChecklist(
  errand_id: string,
  user_id: string,
  drafts: ChecklistDraft[],
) {
  const rows = drafts
    .map((d, i) => ({ ...d, text: d.text.trim(), position: i }))
    .filter((d) => d.text);
  if (!rows.length) return;
  const { error } = await sb()
    .from("checklist_items")
    .insert(
      rows.map((d) => ({
        errand_id,
        user_id,
        text: d.text,
        done: d.done,
        position: d.position,
      })),
    );
  if (error) throw error;
}

// Reconcile a checklist on an existing errand: insert new rows, delete
// removed ones, update rows whose text/done/position changed.
async function reconcileChecklist(
  errand_id: string,
  user_id: string,
  drafts: ChecklistDraft[],
  original: ChecklistItem[],
) {
  const cleaned = drafts
    .map((d, i) => ({ ...d, text: d.text.trim(), position: i }))
    .filter((d) => d.text);
  const keptIds = new Set(cleaned.filter((d) => d.id).map((d) => d.id));

  // deletions
  const toDelete = original.filter((o) => !keptIds.has(o.id)).map((o) => o.id);
  if (toDelete.length) {
    const { error } = await sb().from("checklist_items").delete().in("id", toDelete);
    if (error) throw error;
  }

  // inserts
  const toInsert = cleaned.filter((d) => !d.id);
  if (toInsert.length) {
    const { error } = await sb().from("checklist_items").insert(
      toInsert.map((d) => ({
        errand_id,
        user_id,
        text: d.text,
        done: d.done,
        position: d.position,
      })),
    );
    if (error) throw error;
  }

  // updates
  for (const d of cleaned) {
    if (!d.id) continue;
    const orig = original.find((o) => o.id === d.id);
    if (!orig) continue;
    if (orig.text !== d.text || orig.done !== d.done || orig.position !== d.position) {
      const { error } = await sb()
        .from("checklist_items")
        .update({ text: d.text, done: d.done, position: d.position })
        .eq("id", d.id);
      if (error) throw error;
    }
  }
}

export function useCreateErrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      input,
      checklist,
    }: {
      input: ErrandInput;
      checklist?: ChecklistDraft[];
    }) => {
      const user_id = await uid();
      const { data, error } = await sb()
        .from("errands")
        .insert({ ...input, user_id })
        .select("id")
        .single();
      if (error) throw error;
      const errandId = data.id as string;
      if (checklist?.length) await insertChecklist(errandId, user_id, checklist);
      return errandId;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["errands"] }),
  });
}

export function useUpdateErrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
      checklist,
      original,
    }: {
      id: string;
      input: ErrandInput;
      checklist?: ChecklistDraft[];
      original?: ChecklistItem[];
    }) => {
      const { error } = await sb().from("errands").update(input).eq("id", id);
      if (error) throw error;
      if (checklist) {
        const user_id = await uid();
        await reconcileChecklist(id, user_id, checklist, original ?? []);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["errands"] }),
  });
}

export function useDeleteErrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb().from("errands").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["errands"] });
      const prev = qc.getQueryData<Errand[]>(["errands"]);
      qc.setQueryData<Errand[]>(["errands"], (old) =>
        (old ?? []).filter((e) => e.id !== id),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["errands"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["errands"] }),
  });
}

export function useSetImportant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, important }: { id: string; important: boolean }) => {
      const { error } = await sb().from("errands").update({ important }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, important }) => {
      await qc.cancelQueries({ queryKey: ["errands"] });
      const prev = patchErrand(qc, id, { important });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["errands"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["errands"] }),
  });
}

// Mark done/undone. On completing a *recurring* errand, spawn the next
// occurrence (copying fields + checklist, all un-done).
export function useToggleDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (errand: Errand) => {
      const markingDone = !errand.done;
      const { error } = await sb()
        .from("errands")
        .update({
          done: markingDone,
          done_at: markingDone ? new Date().toISOString() : null,
        })
        .eq("id", errand.id);
      if (error) throw error;

      if (markingDone && errand.recurrence) {
        const user_id = await uid();
        const next_due = nextRecurrenceDate(
          errand.recurrence,
          errand.due_date,
          errand.recurrence_interval,
        );
        const { data: created, error: nErr } = await sb()
          .from("errands")
          .insert({
            user_id,
            title: errand.title,
            note: errand.note,
            category_id: errand.category_id,
            due_date: next_due,
            due_time: errand.due_time,
            important: errand.important,
            recurrence: errand.recurrence,
            recurrence_interval: errand.recurrence_interval,
          })
          .select("id")
          .single();
        if (nErr) throw nErr;
        // copy the checklist (reset to not-done) onto the new occurrence
        const items = errand.checklist ?? [];
        if (items.length) {
          await sb()
            .from("checklist_items")
            .insert(
              items.map((it, i) => ({
                errand_id: created.id,
                user_id,
                text: it.text,
                position: i,
              })),
            );
        }
      }
    },
    onMutate: async (errand) => {
      await qc.cancelQueries({ queryKey: ["errands"] });
      const markingDone = !errand.done;
      const prev = patchErrand(qc, errand.id, {
        done: markingDone,
        done_at: markingDone ? new Date().toISOString() : null,
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["errands"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["errands"] }),
  });
}

// =====================================================================
// Checklist items
// =====================================================================
export function useAddChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      errand_id,
      text,
      position,
    }: {
      errand_id: string;
      text: string;
      position: number;
    }) => {
      const user_id = await uid();
      const { error } = await sb()
        .from("checklist_items")
        .insert({ errand_id, user_id, text: text.trim(), position });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["errands"] }),
  });
}

export function useToggleChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await sb().from("checklist_items").update({ done }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: ["errands"] });
      const prev = qc.getQueryData<Errand[]>(["errands"]);
      qc.setQueryData<Errand[]>(["errands"], (old) =>
        (old ?? []).map((e) => ({
          ...e,
          checklist: (e.checklist ?? []).map((c) =>
            c.id === id ? { ...c, done } : c,
          ),
        })),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["errands"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["errands"] }),
  });
}

export function useUpdateChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const { error } = await sb()
        .from("checklist_items")
        .update({ text: text.trim() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["errands"] }),
  });
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb().from("checklist_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["errands"] }),
  });
}
