# Roadmap — continuation notes

Record kept because credits ran out mid-task (2026-10-28). Pick up from here.

## DONE
1. DB migration applied (`drizzle/migrations/0000_vendor_approval_admin_functions.sql`):
   - profiles: +approval_status (default 'pending'), +rejection_reason, +approved_at, CHECK constraint
   - backfilled all existing profiles to 'approved'
   - SECURITY DEFINER RPCs created + granted: admin_vendor_list(), approve_vendor(uuid),
     reject_vendor(uuid, reason), suspend_vendor(uuid), reinstate_vendor(uuid), delete_vendor(uuid)
   - admin_vendor_list returns: user_id, full_name, business_name, phone, email, email_verified,
     approval_status, rejection_reason, created_at (matches AdminVendor type in src/lib/profile.ts)
2. User's personal account (maniacmorgan822@gmail.com, user c1747782-1cc3-4f3c-91bb-69d743feb975)
   had NO profile row (signup trigger had failed) — profile row created (approved) + admin role granted.
   This was blocking entry to the app.
3. SSR 500 "object is not iterable" on /admin/* fixed: router version mismatch (router-core 1.171.13
   vs start-server-core expecting 1.171.39). Fixed by mandated update:
   @tanstack/react-router@1.170.41 + @tanstack/router-plugin@1.168.42 (router-core now 1.171.34).
4. Build error fixed: admin.vendors.tsx `error instanceof Error` on non-object type (TS2358/TS2339).
5. Verified via Playwright (minted session as maniacmorgan822@gmail.com): /app/dashboard loads fully
   (vendor entry works), /admin/vendors no longer 500s and stays on URL.

## UNFINISHED / UNVERIFIED
- /admin/vendors rendered a BLANK page in the last test (no console errors, no 500). Needs
  investigation: does the admin shell render at all? Possibly a client-only render issue after the
  router update, or an error swallowed in beforeLoad. Next step: re-run
  /tmp/browser/adminfix/check_admin.py, inspect DOM + console + /tmp/dev-server-logs/dev-server.log.
- Not yet clicked Approve/Reject/Suspend/Reinstate/Delete on the vendors page (RPCs untested end-to-end).
- New signups now default to approval_status='pending' and are gated by src/routes/app.tsx until
  approved — intended feature; existing accounts backfilled approved.
- Full vite build/typecheck not re-run after the TS fix.

## Context
- User is the owner-admin; wants to promote vendors and gate new signups behind admin approval.
- Admin user for testing: 8de28b3a-e37b-4176-a7bc-4650d2aae449 (Morgan Maniac, admin+vendor).
- Never echo secrets; user asked to keep this record for continuation.
