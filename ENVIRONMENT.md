# VendorHub — settings you need to collect

Everything below is what the app reads. Collect the real values, then paste them
where the table says. Nothing else is needed for the app to run.

---

## 1. Your own Supabase project (required)

Create the project first, run `supabase/schema_bundle.sql` in its SQL Editor
(see `supabase/OWN_SUPABASE_SETUP.md`), then copy these from
**Project Settings → API**.

| Name | Where to paste | Value |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Hosting (Vercel) env vars + local `.env` | `https://<your-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Hosting + local `.env` | anon / publishable key |
| `VITE_SUPABASE_PROJECT_ID` | Hosting + local `.env` | `<your-ref>` |
| `SUPABASE_URL` | Hosting + local `.env` | same URL as above |
| `SUPABASE_PUBLISHABLE_KEY` | Hosting + local `.env` | same anon key as above |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server side only** — hosting env vars, never in `VITE_`, never in Git | service role key |

The Edge Functions get `SUPABASE_URL`, the anon key and the service role key
automatically — do **not** create those as function secrets.

---

## 2. AI assistant (required for insights + Assistant tab)

| Name | Where | What it is |
| --- | --- | --- |
| `LOVABLE_API_KEY` | Hosting env vars (server side) | Lovable AI Gateway key. If you move off Lovable AI, swap this for your own Gemini/OpenAI key and update `src/lib/ai.functions.ts`. |

---

## 3. M-Pesa (Daraja) — credit repayments

From the Safaricom Daraja portal. Paste in **Supabase → Edge Functions → Secrets**
(`supabase secrets set ...`).

| Name | Value |
| --- | --- |
| `DARAJA_BASE_URL` | `https://sandbox.safaricom.co.ke` (test) or `https://api.safaricom.co.ke` (live) |
| `DARAJA_CONSUMER_KEY` | app consumer key |
| `DARAJA_CONSUMER_SECRET` | app consumer secret |
| `DARAJA_SHORTCODE` | paybill / till shortcode |
| `DARAJA_PASSKEY` | STK push passkey |
| `DARAJA_CALLBACK_URL` | `https://<your-ref>.supabase.co/functions/v1/mpesa-callback?token=<your token>` |
| `DARAJA_CALLBACK_TOKEN` | a long random string you invent; must match the `token=` above |

---

## 4. SMS reminders (Africa's Talking)

Also Supabase Edge Function secrets.

| Name | Value |
| --- | --- |
| `AT_USERNAME` | Africa's Talking username (`sandbox` while testing) |
| `AT_API_KEY` | API key |
| `AT_SENDER_ID` | approved sender ID (optional; omit to use the shared pool) |
| `AT_BASE_URL` | `https://api.africastalking.com` (optional, this is the default) |

---

## 5. Debt reminder scheduler

| Name | Where | Value |
| --- | --- | --- |
| `CRON_SECRET` | Supabase Edge Function secret **and** in the scheduler's `x-cron-secret` header | a long random string you invent |

Schedule a daily call to
`https://<your-ref>.supabase.co/functions/v1/debt-reminders` with header
`x-cron-secret: <CRON_SECRET>`.

---

## Safety rules

- Only `VITE_*` values ever reach the browser. Never prefix a secret with `VITE_`.
- Never commit real values, and never paste the service role key or database
  password into chat, screenshots or the report appendix.
- Any key that has already been shared publicly should be rotated in
  Supabase → API → Rotate keys.

---

## Quick checklist for migrating to your own Supabase

1. Create the project, run `supabase/schema_bundle.sql`.
2. Enable Email auth + leaked-password protection; add your app URL to Site URL / Redirect URLs.
3. Set the section-1 variables on Vercel (and in local `.env`).
4. `supabase link --project-ref <your-ref>`, then set the section 3–5 secrets and deploy the four functions.
5. Sign up once in the app, then promote yourself to admin with the SQL in `supabase/OWN_SUPABASE_SETUP.md`.
