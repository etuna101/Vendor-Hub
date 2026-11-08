import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const changeAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { userId: string; promote: boolean }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data?.userId ?? "")) throw new Error("INVALID_TARGET");
    return { userId: data.userId, promote: data.promote === true };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: isAdmin, error: roleCheckError } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleCheckError || !isAdmin) throw new Error("FORBIDDEN");

    const { error } = await supabase.rpc("admin_manage_user_role" as any, {
      _target_user: data.userId,
      _make_admin: data.promote,
    });
    if (error) {
      const message = String(error.message ?? "");
      const known = ["CANNOT_DEMOTE_SELF", "LAST_ADMIN", "VENDOR_NOT_FOUND", "ADMIN_NOT_FOUND", "FORBIDDEN"];
      throw new Error(known.find((code) => message.includes(code)) ?? "ROLE_CHANGE_FAILED");
    }
    return { success: true as const };
  });
