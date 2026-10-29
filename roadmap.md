# Roadmap — continuation notes

All tasks from the 2026-10-28 continuation are DONE and verified (2026-10-29).

## DONE
1. DB migration applied (`drizzle/migrations/0000_vendor_approval_admin_functions.sql`):
   profiles.approval_status (+rejection_reason, approved_at), all existing profiles backfilled
   to 'approved', SECURITY DEFINER RPCs: admin_vendor_list(), approve/reject/suspend/reinstate/
   delete_vendor — all granted.
2. Owner account (maniacmorgan822@gmail.com) had no profile row — created (approved) + admin role.
3. Router version mismatch fixed (@tanstack/react-router@1.170.41 + router-plugin@1.168.42) —
   SSR 500 on /admin/* resolved.
4. admin.vendors.tsx TS error fixed (error instanceof Error on non-object type).

## VERIFIED (Playwright, 2026-10-29, as admin maniacmorgan822@gmail.com)
- /admin/vendors renders fully: 4 vendors, search/status filters, pagination, no console errors.
  The earlier "structure of query does not match function result type" error and the blank page
  are both gone.
- Suspend → status changes to Suspended (toast "Vendor status updated", Reinstatement button shows).
- Reinstate → status back to Approved. RPCs work end-to-end.
- /app/dashboard loads for the admin account (admin bypasses vendor gate, role works both ways).
- Vendor approval gate in src/routes/app.tsx beforeLoad: admins bypass; non-approved vendors are
  redirected to /account-status which shows the rejection reason (EN/SW). Route exists.
- New signups default to approval_status='pending' and wait for admin approval.

## Not tested
- Reject and Delete buttons (destructive; need a pending vendor / real deletion — left to the user).
- Approve button for a pending signup (needs an email-confirmed new signup).

## Context
- User is the owner-admin; promotes vendors and gates new signups behind admin approval.
- Admin user for testing: 8de28b3a-e37b-4176-a7bc-4650d2aae449 (Morgan Maniac, admin+vendor).
- Never echo secrets; keep this record for continuation.
