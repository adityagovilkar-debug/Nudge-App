# Nudge — Errands & Reminders

A simple, friendly personal errands & reminders app. See what's due **Today**,
plan what's **Upcoming**, look back at what's **Done**, and get a gentle email
each morning. Built to be easy on a phone, big and readable, and installable as
an app (PWA).

- **Errands** — title, note, category, due date/time, an **Important ⭐** star, done.
- **Checklists** — add shopping/checklist sub-items to any errand and tick them off.
- **Repeating errands** — mark a repeating errand done and the next one is created automatically.
- **Email reminders** — a daily morning digest of what's due today (and anything overdue).
- **Today / Upcoming / Done** views.
- **Big friendly UI**, dark mode, adjustable text size, installable PWA.
- **Private by design** — owner-only Row Level Security: each account only ever sees its own data.

Stack: **Next.js 16** (App Router) · **Supabase** (Postgres + Auth + RLS) ·
**Tailwind CSS v4** · TanStack Query · Resend (email) · deploys to **Vercel**.

---

## 1. Create the Supabase project

1. Create a new project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy the **Project URL** and the **anon public** key.
3. In the **SQL Editor**, run the contents of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   This creates the tables, owner-only RLS policies, and the new-user trigger
   (it seeds a profile + a few default categories on signup).
4. **Auth → Providers → Email**: keep Email enabled. For passwordless sign-in,
   "Email OTP / Magic Link" is on by default. Add your deployed URL under
   **Auth → URL Configuration → Redirect URLs** (e.g. `https://your-app.vercel.app/**`).

## 2. Run locally

```bash
cp .env.local.example .env.local   # then fill in the two NEXT_PUBLIC_* values
npm install
npm run dev                        # http://localhost:3020 (see launch.json)
```

Sign up with email + password (or use the **Email link** tab for a magic link).
The first screen works immediately.

## 3. Deploy to Vercel

1. Push this folder to a GitHub repo and import it in Vercel.
2. Add the two env vars in **Vercel → Settings → Environment Variables**:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (and optionally `NEXT_PUBLIC_SITE_URL` = your deployed URL).
3. Deploy. Add the deployed URL to Supabase **Redirect URLs** (step 1.4).

## 4. Morning reminder emails (optional)

Reminders use a Supabase **Edge Function** + **pg_cron** + **Resend**.

1. Create a free [Resend](https://resend.com) account and an API key. For real
   sending, verify a domain; for testing, `onboarding@resend.dev` works.
2. Deploy the function and set its secrets (needs the
   [Supabase CLI](https://supabase.com/docs/guides/cli)):

   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase functions deploy daily-digest --no-verify-jwt
   supabase secrets set \
     RESEND_API_KEY=re_xxx \
     REMINDER_EMAIL_FROM="Nudge <onboarding@resend.dev>" \
     SITE_URL="https://your-app.vercel.app"
   ```

   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.
3. Schedule it: in the SQL Editor run
   [`supabase/migrations/0002_cron.sql`](supabase/migrations/0002_cron.sql)
   (replace `<PROJECT_REF>`). It runs hourly; each user is emailed once when
   it's 7am **in their own timezone** (the app records each user's timezone
   automatically). Change the hour with the `REMINDER_HOUR` secret.

Users can turn the morning email on/off in **Settings → Email reminders**.

## 5. Phone push notifications (optional)

Native phone/desktop notifications via Web Push: a buzz at each errand's due
time, plus a morning summary. Works best on **Android (Chrome)** with Nudge
installed to the home screen; also works on iOS 16.4+ for the installed PWA.

1. Generate a VAPID key pair once: `npx web-push generate-vapid-keys`.
2. In **Vercel → Environment Variables**, add:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (public key)
   - `VAPID_PRIVATE_KEY` (private key)
   - `VAPID_SUBJECT` = `mailto:you@example.com`
   - `CRON_SECRET` = a long random string
   - `SUPABASE_SERVICE_ROLE_KEY` = from Supabase → Settings → API (server-only)
   Redeploy so they take effect.
3. In the Supabase **SQL Editor**, run
   [`supabase/migrations/0003_push.sql`](supabase/migrations/0003_push.sql)
   (subscriptions table + bookkeeping columns).
4. Run [`supabase/migrations/0004_push_cron.sql`](supabase/migrations/0004_push_cron.sql)
   after replacing `<CRON_SECRET>` with the same value you set in Vercel. It
   calls `/api/push/send` every minute; that route sends due-time reminders and
   the morning summary (at `REMINDER_HOUR` in each user's timezone).
5. On each device: open the app, go to **Settings → Phone notifications →
   Turn on notifications**, and allow the prompt. (On iPhone, add to Home Screen
   first.)

The send route is protected by `CRON_SECRET`; you can test it with
`curl -X POST -H "Authorization: Bearer <CRON_SECRET>" https://<your-app>/api/push/send?test=1`.

## Project layout

```
app/                 routes — login, (app)/{Today,upcoming,done,settings}, auth/callback, manifest
components/          AppShell, ErrandCard, ErrandDialog, CategoryManager, …
lib/                 supabase clients, queries (TanStack), errands helpers, types, theme
supabase/            migrations/*.sql  +  functions/daily-digest (email)
public/icons/        PWA icons (regen with `npm run icons` after editing icon.svg)
proxy.ts             Next 16 middleware — refreshes session, guards routes
```

## Notes

- **Repeating errands** advance on completion (see `nextRecurrenceDate` in
  `lib/errands.ts`); the completed copy stays in **Done** as history.
- Dark mode + text size are stored on the device and applied before paint.
- The app caches your list to IndexedDB so it's readable offline; edits made
  offline are replayed when you reconnect.
