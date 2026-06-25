"use client";

import { useEffect, useState } from "react";
import { BellRing, Send } from "lucide-react";
import { toast } from "sonner";
import {
  pushSupported,
  getPushState,
  enablePush,
  disablePush,
  showTestNotification,
} from "@/lib/push";

export function NotificationToggle() {
  const [supported, setSupported] = useState(true);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const ok = pushSupported();
    setSupported(ok);
    if (ok) getPushState().then(setOn).finally(() => setReady(true));
    else setReady(true);
  }, []);

  if (!supported) {
    return (
      <p className="text-base text-text-muted">
        This browser can&apos;t show notifications. On an iPhone, first add Nudge to
        your Home Screen (Share → Add to Home Screen), then open it from there.
      </p>
    );
  }

  async function turnOn() {
    setBusy(true);
    try {
      await enablePush();
      setOn(true);
      await showTestNotification();
      toast.success("Notifications are on for this device");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not turn on notifications");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      await disablePush();
      setOn(false);
      toast.success("Notifications turned off on this device");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not turn off notifications");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-base text-text-muted">
        Get a notification on this device when an errand is due, plus a morning
        summary. Turn this on for each phone or computer you want reminders on.
      </p>

      {on ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3.5 py-3 text-base font-medium text-emerald-700 dark:text-emerald-300">
            <BellRing className="h-5 w-5" /> On for this device
          </div>
          <div className="flex gap-2">
            <button className="btn-outline" disabled={busy} onClick={() => showTestNotification()}>
              <Send className="h-5 w-5" /> Send a test
            </button>
            <button className="btn-ghost text-rose-600" disabled={busy} onClick={turnOff}>
              Turn off
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-primary w-full" disabled={busy || !ready} onClick={turnOn}>
          <BellRing className="h-5 w-5" />
          {busy ? "Please wait…" : "Turn on notifications"}
        </button>
      )}
    </div>
  );
}
