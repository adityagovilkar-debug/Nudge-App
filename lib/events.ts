"use client";

import type { Errand } from "./types";

// A tiny event bus so any button (header, empty states, cards) can open the
// shared Add/Edit dialog that lives in the AppShell.
export const ERRAND_DIALOG_EVENT = "nudge:errand-dialog";

export interface ErrandDialogDetail {
  errand?: Errand; // present = edit, absent = create new
}

export function openErrandDialog(errand?: Errand) {
  window.dispatchEvent(
    new CustomEvent<ErrandDialogDetail>(ERRAND_DIALOG_EVENT, {
      detail: { errand },
    }),
  );
}
