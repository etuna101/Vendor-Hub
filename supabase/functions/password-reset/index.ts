import {
  adminClient,
  corsHeaders,
  HttpError,
  json,
  normalizeKenyanPhone,
  safeError,
} from "../_shared/core.ts";
import { sendTextMessage } from "../_shared/sms.ts";

async function hashCode(phone: string, code: string) {
  const secret = Deno.env.get("PASSWORD_RESET_SECRET");
  if (!secret || secret.length < 32) {
    throw new Error("PASSWORD_RESET_SECRET must contain at least 32 characters.");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${phone}:${code}`),
  );
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function newCode() {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const body = await request.json();
    const phone = normalizeKenyanPhone(body.phone);
    const admin = adminClient();

    if (body.action === "request") {
      const { data: vendors, error: lookupError } = await admin.rpc(
        "find_vendor_for_password_reset",
        { _phone: phone },
      );
      if (lookupError) throw lookupError;

      if (vendors?.length === 1) {
        const code = newCode();
        const { data: accepted, error: issueError } = await admin.rpc(
          "issue_password_reset_challenge",
          { _phone: phone, _code_hash: await hashCode(phone, code) },
        );
        if (issueError) throw issueError;

        if (accepted) {
          const language = vendors[0].preferred_language === "sw" ? "sw" : "en";
          const message =
            language === "sw"
              ? `Msimbo wa kubadilisha nywila ya VendorHub ni ${code}. Unaisha baada ya dakika 10. Usimpe mtu yeyote.`
              : `Your VendorHub password reset code is ${code}. It expires in 10 minutes. Do not share it.`;
          try {
            await sendTextMessage(phone, message);
          } catch (error) {
            await admin.from("password_reset_challenges").delete().eq("phone", phone);
            console.error(
              "password-reset-sms-failed",
              error instanceof Error ? error.message : "unknown",
            );
          }
        }
      }

      return json({ ok: true });
    }

    if (body.action === "verify") {
      const code = String(body.code ?? "");
      const password = String(body.password ?? "");
      if (!/^\d{6}$/.test(code) || password.length < 6) {
        throw new HttpError(422, "Enter a valid code and a password of at least 6 characters.");
      }

      const { data: vendors, error: lookupError } = await admin.rpc(
        "find_vendor_for_password_reset",
        { _phone: phone },
      );
      if (lookupError) throw lookupError;
      const vendor = vendors?.length === 1 ? vendors[0] : null;
      const { data: valid, error: verifyError } = await admin.rpc(
        "consume_password_reset_challenge",
        { _phone: phone, _code_hash: await hashCode(phone, code) },
      );
      if (verifyError) throw verifyError;
      if (!valid || !vendor) throw new HttpError(400, "The code is invalid or expired.");

      const { error: updateError } = await admin.auth.admin.updateUserById(vendor.user_id, {
        password,
      });
      if (updateError) throw updateError;
      return json({ ok: true });
    }

    throw new HttpError(422, "Unsupported password reset action.");
  } catch (error) {
    return safeError(error);
  }
});
