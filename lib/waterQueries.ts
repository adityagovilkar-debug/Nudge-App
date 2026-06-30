"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseBrowser } from "@/lib/supabase/browser";
import {
  DEFAULT_CONTAINERS,
  type WaterContainer,
  type WaterLog,
  type WaterSettings,
} from "@/lib/water";

const sb = supabaseBrowser;

async function uid(): Promise<string> {
  const {
    data: { user },
  } = await sb().auth.getUser();
  if (!user) throw new Error("Not signed in");
  return user.id;
}

// ---------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------
export function useWaterSettings() {
  return useQuery({
    queryKey: ["water", "settings"],
    queryFn: async (): Promise<WaterSettings | null> => {
      const { data, error } = await sb().from("water_settings").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateWaterSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<WaterSettings>) => {
      const user_id = await uid();
      const { error } = await sb()
        .from("water_settings")
        .upsert({ user_id, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water", "settings"] }),
  });
}

// ---------------------------------------------------------------------
// Containers
// ---------------------------------------------------------------------
export function useWaterContainers() {
  return useQuery({
    queryKey: ["water", "containers"],
    queryFn: async (): Promise<WaterContainer[]> => {
      const { data, error } = await sb()
        .from("water_containers")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertWaterContainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: { id?: string; name: string; volume_ml: number }) => {
      const user_id = await uid();
      if (c.id) {
        const { error } = await sb()
          .from("water_containers")
          .update({ name: c.name, volume_ml: c.volume_ml })
          .eq("id", c.id);
        if (error) throw error;
      } else {
        const { data: last } = await sb()
          .from("water_containers")
          .select("sort_order")
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        const { error } = await sb().from("water_containers").insert({
          user_id,
          name: c.name,
          volume_ml: c.volume_ml,
          sort_order: (last?.sort_order ?? -1) + 1,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water", "containers"] }),
  });
}

export function useDeleteWaterContainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb().from("water_containers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water", "containers"] }),
  });
}

// ---------------------------------------------------------------------
// Logs (last ~8 days so we can show today + a week of history)
// ---------------------------------------------------------------------
export function useWaterLogs() {
  return useQuery({
    queryKey: ["water", "logs"],
    queryFn: async (): Promise<WaterLog[]> => {
      const since = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await sb()
        .from("water_logs")
        .select("*")
        .gte("logged_at", since)
        .order("logged_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLogWater() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      amount_ml,
      container_id,
    }: {
      amount_ml: number;
      container_id?: string | null;
    }) => {
      const user_id = await uid();
      const { error } = await sb().from("water_logs").insert({
        user_id,
        amount_ml,
        container_id: container_id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water", "logs"] }),
  });
}

export function useDeleteWaterLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb().from("water_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["water", "logs"] });
      const prev = qc.getQueryData<WaterLog[]>(["water", "logs"]);
      qc.setQueryData<WaterLog[]>(["water", "logs"], (old) =>
        (old ?? []).filter((l) => l.id !== id),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["water", "logs"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["water", "logs"] }),
  });
}

// ---------------------------------------------------------------------
// One-time setup: create the settings row + default containers if missing
// (covers users who pre-date this feature; new signups can run it too).
// ---------------------------------------------------------------------
export function useEnsureWaterDefaults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const user_id = await uid();
      const { data: settings } = await sb()
        .from("water_settings")
        .select("user_id")
        .maybeSingle();
      if (!settings) {
        await sb().from("water_settings").insert({ user_id });
      }
      const { data: containers } = await sb()
        .from("water_containers")
        .select("id")
        .limit(1);
      if (!containers || containers.length === 0) {
        await sb()
          .from("water_containers")
          .insert(
            DEFAULT_CONTAINERS.map((d, i) => ({
              user_id,
              name: d.name,
              volume_ml: d.volume_ml,
              sort_order: i,
            })),
          );
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["water", "settings"] });
      qc.invalidateQueries({ queryKey: ["water", "containers"] });
    },
  });
}
