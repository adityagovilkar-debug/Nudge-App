// Supabase Edge Function: daily morning reminder digest.
//
// For every user who has reminders switched on, finds their errands that are
// due today or overdue (in *their* local timezone) and emails a friendly
// summary via Resend.
//
// Deploy:  supabase functions deploy daily-digest --no-verify-jwt
// Secrets: supabase secrets set RESEND_API_KEY=... REMINDER_EMAIL_FROM="Nudge <...>"
// Schedule: see supabase/migrations/0002_cron.sql (runs hourly; each user is
//           emailed once when it's ~7am in their timezone).

import { createClient } from "jsr:@supabase/supabase-js@2";

interface ErrandRow {
  id: string;
  title: string;
  due_date: string | null;
  due_time: string | null;
  important: boolean;
  category: { name: string } | null;
}

// Today's date (YYYY-MM-DD) and current hour in a given IANA timezone.
function localInfo(tz: string): { today: string; hour: number } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    today: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
  };
}

function fmtTime(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hr = Number(h);
  const ampm = hr >= 12 ? "pm" : "am";
  const h12 = hr % 12 || 12;
  return ` · ${h12}:${m}${ampm}`;
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("REMINDER_EMAIL_FROM") ?? "Nudge <onboarding@resend.dev>";
  const siteUrl = Deno.env.get("SITE_URL") ?? "";
  // The hour (in each user's local time) at which to send. Default 7am.
  const sendHour = Number(Deno.env.get("REMINDER_HOUR") ?? "7");

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, timezone")
    .eq("email_reminders", true);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let considered = 0;

  for (const p of profiles ?? []) {
    if (!p.email) continue;
    const tz = p.timezone || "UTC";
    const { today, hour } = localInfo(tz);
    // Only email each user once, when it's the send-hour in their timezone.
    if (hour !== sendHour) continue;
    considered++;

    const { data: errands } = await supabase
      .from("errands")
      .select("id, title, due_date, due_time, important, category:categories(name)")
      .eq("user_id", p.id)
      .eq("done", false)
      .not("due_date", "is", null)
      .lte("due_date", today)
      .order("due_date", { ascending: true })
      .order("due_time", { ascending: true, nullsFirst: true });

    const rows = (errands ?? []) as unknown as ErrandRow[];
    if (rows.length === 0 || !resendKey) continue;

    const overdue = rows.filter((e) => e.due_date! < today);
    const dueToday = rows.filter((e) => e.due_date === today);
    const firstName = (p.full_name ?? "").split(" ")[0];

    function listHtml(items: ErrandRow[]): string {
      return items
        .map((e) => {
          const star = e.important ? "⭐ " : "";
          const cat = e.category?.name ? `  ·  ${e.category.name}` : "";
          return `<li style="margin:6px 0;font-size:16px">${star}<b>${escapeHtml(
            e.title,
          )}</b><span style="color:#6b7280">${fmtTime(e.due_time)}${cat}</span></li>`;
        })
        .join("");
    }

    const sections: string[] = [];
    if (overdue.length) {
      sections.push(
        `<p style="margin:18px 0 4px;color:#e11d48;font-weight:600">Overdue (${overdue.length})</p><ul style="padding-left:20px;margin:0">${listHtml(overdue)}</ul>`,
      );
    }
    if (dueToday.length) {
      sections.push(
        `<p style="margin:18px 0 4px;color:#4f46e5;font-weight:600">Due today (${dueToday.length})</p><ul style="padding-left:20px;margin:0">${listHtml(dueToday)}</ul>`,
      );
    }

    const cta = siteUrl
      ? `<p style="margin:24px 0 0"><a href="${siteUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;font-size:16px">Open Nudge</a></p>`
      : "";

    const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:540px;margin:0 auto;color:#1f2937">
      <h1 style="font-size:22px;margin:0 0 2px">Good morning${firstName ? ", " + escapeHtml(firstName) : ""} 👋</h1>
      <p style="margin:0;color:#6b7280;font-size:16px">Here's what's on your list for today.</p>
      ${sections.join("")}
      ${cta}
      <p style="margin:28px 0 0;color:#9ca3af;font-size:13px">You're getting this because morning reminders are on in Nudge. You can turn them off anytime in Settings.</p>
    </div>`;

    const subject =
      overdue.length > 0
        ? `Nudge · ${dueToday.length} for today, ${overdue.length} overdue`
        : `Nudge · ${dueToday.length} thing${dueToday.length === 1 ? "" : "s"} for today`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [p.email], subject, html }),
    });
    if (res.ok) sent++;
  }

  return Response.json({ considered, emailsSent: sent });
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
