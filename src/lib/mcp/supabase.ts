import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AuthCtx = { getToken(): string | undefined; getUserId?(): string | undefined };

/**
 * Supabase client scoped to the MCP caller's verified bearer token, so RLS
 * applies exactly as it would for that signed-in vendor in the app.
 */
export function supabaseForUser(ctx: AuthCtx) {
  const url = process.env['SUPABASE_URL'] ?? process.env['VITE_SUPABASE_URL'];
  const key =
    process.env['SUPABASE_PUBLISHABLE_KEY'] ?? process.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new Error("Supabase server environment variables are not configured.");
  const token = ctx.getToken();
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });
}
