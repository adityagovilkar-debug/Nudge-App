import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { reminderTimes, toMinutes } from "@/lib/water";

interface WaterSettingsRow {
  user_id: string;
  reminders_enabled: boolean;
  reminders_per_day: number;
  window_start: string;
  window_end: string;
  last_water_reminder_key: string | null;
}

// Runs on the Node runtime (web-push needs Node crypto). Triggered every
// minute by Supabase pg_cron (see 0004_push_cron.sql), protected by CRON_SECRET.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Sub {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Today's date + current hour/minute (HH:MM) in a given IANA timezone.
function localParts(tz: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(
    fmt.formatToParts(new Date()).map((x) => [x.type, x.value]),
  );
  let hour = Number(p.hour);
  if (hour === 24) hour = 0; // some engines emit "24" at midnight
  return {
    today: `${p.year}-${p.month}-${p.day}`,
    hour,
    hhmm: `${String(hour).padStart(2, "0")}:${p.minute}`,
  };
}

function fmtTime(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hr = Number(h);
  const ampm = hr >= 12 ? "PM" : "AM";
  const h12 = hr % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Test mode bypasses the morning hour-gate (still requires a valid secret).
  const test = new URL(req.url).searchParams.get("test") === "1";

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hello@nudge.app";
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }
  webpush.setVapidDetails(subject, vapidPublic, vapidPrivate);

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "service role key not configured" }, { status: 500 });
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

  const sendHour = Number(process.env.REMINDER_HOUR ?? "7");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "/";

  // Group every subscription by user.
  const { data: subsAll } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth");
  const byUser = new Map<string, Sub[]>();
  for (const s of subsAll ?? []) {
    const arr = byUser.get(s.user_id) ?? [];
    arr.push({ id: s.id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth });
    byUser.set(s.user_id, arr);
  }
  if (byUser.size === 0) return NextResponse.json({ users: 0, pushed: 0, test });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, timezone, last_morning_push_on")
    .in("id", [...byUser.keys()]);

  // Water reminder settings for the same users.
  const { data: waterRows } = await supabase
    .from("water_settings")
    .select(
      "user_id, reminders_enabled, reminders_per_day, window_start, window_end, last_water_reminder_key",
    )
    .in("user_id", [...byUser.keys()]);
  const waterByUser = new Map<string, WaterSettingsRow>(
    (waterRows ?? []).map((w) => [w.user_id, w as WaterSettingsRow]),
  );

  let pushed = 0;
  const dead: string[] = [];
  const reminded: string[] = [];
  const morningDone: { id: string; today: string }[] = [];
  const waterKeyUpdates: { id: string; key: string }[] = [];

  async function sendTo(subs: Sub[], payload: Record<string, unknown>) {
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        pushed++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.endpoint); // expired
      }
    }
  }

  for (const p of profiles ?? []) {
    const subs = byUser.get(p.id) ?? [];
    if (!subs.length) continue;
    const tz = p.timezone || "UTC";
    const { today, hour, hhmm } = localParts(tz);

    // 1) Due-time reminders: errands due today whose time has arrived, not yet
    //    reminded, not done.
    const { data: dueRows } = await supabase
      .from("errands")
      .select("id, title, due_time, important")
      .eq("user_id", p.id)
      .eq("done", false)
      .eq("due_date", today)
      .not("due_time", "is", null)
      .is("reminded_at", null);
    const dueNow = (dueRows ?? []).filter((e) => (e.due_time ?? "").slice(0, 5) <= hhmm);
    for (const e of dueNow) {
      const t = fmtTime(e.due_time);
      await sendTo(subs, {
        title: "⏰ Due now",
        body: `${e.important ? "⭐ " : ""}${e.title}${t ? ` · ${t}` : ""}`,
        url: siteUrl,
        tag: `errand-${e.id}`,
        requireInteraction: true,
      });
      reminded.push(e.id);
    }

    // 2) Morning summary: once per local day at the send-hour (test bypasses).
    if (test || (hour === sendHour && p.last_morning_push_on !== today)) {
      const { data: todays } = await supabase
        .from("errands")
        .select("id, due_date")
        .eq("user_id", p.id)
        .eq("done", false)
        .not("due_date", "is", null)
        .lte("due_date", today);
      const rows = todays ?? [];
      if (rows.length) {
        const overdue = rows.filter((r) => (r.due_date as string) < today).length;
        const todayCount = rows.length - overdue;
        const first = (p.full_name ?? "").split(" ")[0];
        const body =
          `${todayCount} for today` +
          (overdue ? `, ${overdue} overdue` : "") +
          ". Tap to see your list.";
        await sendTo(subs, {
          title: `Good morning${first ? ", " + first : ""} 👋`,
          body,
          url: siteUrl,
          tag: "morning",
        });
      }
      if (!test) morningDone.push({ id: p.id, today });
    }

    // 3) Water reminders: spread evenly across the user's window; fire each
    //    slot once (keyed by local date + slot index).
    const ws = waterByUser.get(p.id);
    if (ws && ws.reminders_enabled && ws.reminders_per_day > 0) {
      const slots = reminderTimes(
        ws.reminders_per_day,
        toMinutes(ws.window_start),
        toMinutes(ws.window_end),
      );
      const [hh, mm] = hhmm.split(":");
      const nowMin = Number(hh) * 60 + Number(mm);
      let latestIdx = -1;
      for (let i = 0; i < slots.length; i++) if (slots[i] <= nowMin) latestIdx = i;
      if (latestIdx >= 0) {
        const key = `${today}#${latestIdx}`;
        if (ws.last_water_reminder_key !== key) {
          await sendTo(subs, {
            title: "💧 Water break",
            body: "Time to drink some water 🥤",
            url: siteUrl,
            tag: "water",
          });
          waterKeyUpdates.push({ id: p.id, key });
        }
      }
    }
  }

  // Persist bookkeeping so we don't repeat sends.
  if (reminded.length) {
    await supabase
      .from("errands")
      .update({ reminded_at: new Date().toISOString() })
      .in("id", reminded);
  }
  for (const m of morningDone) {
    await supabase.from("profiles").update({ last_morning_push_on: m.today }).eq("id", m.id);
  }
  for (const w of waterKeyUpdates) {
    await supabase
      .from("water_settings")
      .update({ last_water_reminder_key: w.key })
      .eq("user_id", w.id);
  }
  if (dead.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", dead);
  }

  return NextResponse.json({
    users: byUser.size,
    pushed,
    reminded: reminded.length,
    waterReminders: waterKeyUpdates.length,
    deadRemoved: dead.length,
    test,
  });
}
