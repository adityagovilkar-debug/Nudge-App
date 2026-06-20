"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";
import { useState, useEffect } from "react";
import { Toaster } from "sonner";

const WEEK = 1000 * 60 * 60 * 24 * 7;

// Persist the query cache to IndexedDB so the app is readable offline and a
// flaky connection doesn't lose your list. Writes made while offline are
// paused and replayed when the connection returns (last-write-wins).
const persister = createAsyncStoragePersister({
  storage: {
    getItem: (k) => get(k),
    setItem: (k, v) => set(k, v),
    removeItem: (k) => del(k),
  },
  key: "nudge-query-cache",
  throttleTime: 1000,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: WEEK, // must outlive the persisted cache to be restored
            refetchOnWindowFocus: false,
            retry: 1,
            networkMode: "offlineFirst",
          },
          mutations: { networkMode: "offlineFirst" },
        },
      }),
  );

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    function onOnline() {
      qc.resumePausedMutations().then(() => qc.invalidateQueries());
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [qc]);

  return (
    <PersistQueryClientProvider
      client={qc}
      persistOptions={{
        persister,
        maxAge: WEEK,
        buster: "v1",
        dehydrateOptions: { shouldDehydrateMutation: () => false },
      }}
      onSuccess={() => {
        qc.resumePausedMutations();
      }}
    >
      {children}
      <Toaster richColors position="top-center" toastOptions={{ duration: 2500 }} />
    </PersistQueryClientProvider>
  );
}
