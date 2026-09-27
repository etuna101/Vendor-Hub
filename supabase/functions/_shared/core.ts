import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-cron-secret, x-supabase-api-version, accept-profile, content-profile",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export function corsPreflightHeaders(request: Request) {
  const requestedHeaders = request.headers.get("Access-Control-Request-Headers");
  return {
    ...corsHeaders,
    ...(requestedHeaders ? { "Access-Control-Allow-Headers": requestedHeaders } : {}),
    Vary: "Access-Control-Request-Headers",
  };
}
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
// Accept both the documented DARAJA_*/AT_* names and the shorter aliases some
// deployments already use, so existing secret names keep working.
const ALIASES: Record<string, string[]> = {
  DARAJA_CONSUMER_KEY: ["CONSUMER_KEY"],
  DARAJA_CONSUMER_SECRET: ["CONSUMER_SECRET"],
  DARAJA_SHORTCODE: ["SHORTCODE"],
  DARAJA_PASSKEY: ["PASSKEY"],
  DARAJA_BASE_URL: ["MPESA_BASE_URL"],
  AT_USERNAME: ["AFRICASTALKING_USERNAME"],
  AT_API_KEY: ["AFRICASTALKING_API_KEY"],
};
export function env(name: string) {
  for (const key of [name, ...(ALIASES[name] ?? [])]) {
    const value = Deno.env.get(key);
    if (value) return value;
  }
  if (name === "DARAJA_BASE_URL") return "https://sandbox.safaricom.co.ke";
  throw new Error(`Missing Edge Function secret: ${name}`);
}
function platformKey(modern: string, legacy: string) {
  return Deno.env.get(legacy) ?? JSON.parse(env(modern)).default;
}
export function adminClient() {
  return createClient(
    env("SUPABASE_URL"),
    platformKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function authenticatedUser(request: Request) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Sign in to continue.");
  const client = createClient(
    env("SUPABASE_URL"),
    platformKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Your session is invalid.");
  return data.user;
}
export function normalizeKenyanPhone(input: unknown) {
  const digits = String(input ?? "").replace(/\D/g, "");
  const phone = /^0[71]\d{8}$/.test(digits)
    ? `254${digits.slice(1)}`
    : /^[71]\d{8}$/.test(digits)
      ? `254${digits}`
      : digits;
  if (!/^254[71]\d{8}$/.test(phone))
    throw new HttpError(422, "Enter a valid Kenyan mobile number.");
  return phone;
}
export async function fetchWithTimeout(url: string, init: RequestInit, timeout = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
export function safeError(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  console.error("edge-function-error", error instanceof Error ? error.message : "unknown");
  return json({ error: "Unable to complete this request." }, 500);
}
