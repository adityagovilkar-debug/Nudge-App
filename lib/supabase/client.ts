"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Owner-only RLS (user_id = auth.uid())
// guarantees a user only ever reads/writes their own rows, so it is safe to
// query directly from the client with the anon key.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
