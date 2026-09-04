import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required server configuration: ${name}`);
  return value;
}

function platformKey(kind: "SUPABASE_SECRET_KEYS" | "SUPABASE_PUBLISHABLE_KEYS", legacy: string) {
  const old = Deno.env.get(legacy);
  if (old) return old;
  const values = Deno.env.get(kind);
  if (!values) throw new Error(`Missing ${kind}`);
  return JSON.parse(values).default as string;
}

export function adminClient() {
  return createClient(
    env("SUPABASE_URL"),
    platformKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export async function authenticatedUser(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Sign in to continue.");
  const client = createClient(
    env("SUPABASE_URL"),
    platformKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"),
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Your session is no longer valid.");
  return data.user;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function normalizeKenyanPhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  const normalized = /^0[71]\d{8}$/.test(digits)
    ? `254${digits.slice(1)}`
    : /^[71]\d{8}$/.test(digits)
      ? `254${digits}`
      : digits;
  if (!/^254[71]\d{8}$/.test(normalized)) {
    throw new HttpError(422, "Enter a valid Kenyan mobile number.");
  }
  return normalized;
}

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function safeError(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  console.error("provider-function-error", error instanceof Error ? error.message : "unknown");
  return json({ error: "The request could not be completed. Please try again." }, 500);
}
