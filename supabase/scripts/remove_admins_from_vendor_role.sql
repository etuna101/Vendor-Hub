-- Repair legacy accounts that have both role rows.
-- This only removes the duplicate vendor role; it does not delete users or profiles.
-- Safe to run repeatedly. Review the returned user IDs, then verify the final query is empty.
BEGIN;

WITH removed AS (
  DELETE FROM public.user_roles AS vendor_role
  USING public.user_roles AS admin_role
  WHERE vendor_role.user_id = admin_role.user_id
    AND vendor_role.role = 'vendor'
    AND admin_role.role = 'admin'
  RETURNING vendor_role.user_id
)
SELECT removed.user_id, profiles.full_name, profiles.business_name
FROM removed
LEFT JOIN public.profiles AS profiles ON profiles.id = removed.user_id;

SELECT roles.user_id
FROM public.user_roles AS roles
WHERE roles.role = 'admin'
  AND EXISTS (
    SELECT 1
    FROM public.user_roles AS vendor_role
    WHERE vendor_role.user_id = roles.user_id
      AND vendor_role.role = 'vendor'
  );

COMMIT;
