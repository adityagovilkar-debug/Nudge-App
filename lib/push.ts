"use client";

// Client-side helpers for enabling/disabling Web Push on this device.
// On Android (Chrome) an installed PWA can receive these as native
// notifications even when the app is closed.

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  // Construct over an explicit ArrayBuffer so the type is Uint8Array<ArrayBuffer>,
  // which satisfies applicationServerKey's BufferSource requirement.
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function ready(): Promise<ServiceWorkerRegistration> {
  // Register defensively in case the SW wasn't registered yet (dev/first run).
  await navigator.serviceWorker.register("/sw.js").catch(() => {});
  return navigator.serviceWorker.ready;
}

/** Is push currently enabled on this device? */
export async function getPushState(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

/** Ask permission, subscribe, and store the subscription on the server. */
export async function enablePush(): Promise<void> {
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) throw new Error("Notifications aren't configured yet (missing VAPID key).");

  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    throw new Error(
      perm === "denied"
        ? "Notifications are blocked. Enable them for this site in your browser settings."
        : "Notification permission was not granted.",
    );
  }

  const reg = await ready();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    }));

  const json = sub.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent,
    }),
  });
  if (!res.ok) throw new Error("Could not save the subscription. Please try again.");
}

/** Unsubscribe this device and remove it from the server. */
export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/** Send a local test notification (verifies the SW + permission on-device). */
export async function showTestNotification(): Promise<void> {
  const reg = await ready();
  await reg.showNotification("Nudge", {
    body: "Notifications are on — you're all set. 🔔",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: "nudge-test",
  });
}
