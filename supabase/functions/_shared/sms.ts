import { adminClient, env, fetchWithTimeout, normalizeKenyanPhone } from "./core.ts";

export async function sendTextMessage(phoneInput: unknown, message: string) {
  const phone = normalizeKenyanPhone(phoneInput);
  const username = env("AT_USERNAME");
  const body = new URLSearchParams({ username, to: `+${phone}`, message });
  const sender = Deno.env.get("AT_SENDER_ID");
  if (sender) body.set("from", sender);
  const response = await fetchWithTimeout(
    `${
      Deno.env.get("AT_BASE_URL") ??
      (username.trim().toLowerCase() === "sandbox"
        ? "https://api.sandbox.africastalking.com"
        : "https://api.africastalking.com")
    }/version1/messaging`,
    {
      method: "POST",
      headers: {
        apiKey: env("AT_API_KEY"),
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  const raw = await response.text();
  const payload = (() => {
    try {
      return JSON.parse(raw);
    } catch {
      return {} as Record<string, unknown>;
    }
  })();
  const recipient = payload?.SMSMessageData?.Recipients?.[0];
  if (!response.ok || !recipient || Number(recipient.statusCode) >= 400) {
    const detail =
      recipient?.status ??
      payload?.SMSMessageData?.Message ??
      raw.slice(0, 200) ??
      `HTTP ${response.status}`;
    throw new Error(`SMS provider rejected request: ${detail}`);
  }
  return recipient as { messageId?: string; status?: string; statusCode?: number };
}

export async function deliverNotification(notification: {
  id: string;
  customer_id: string | null;
  message: string;
}) {
  const admin = adminClient();
  const { data: customer } = notification.customer_id
    ? await admin.from("customers").select("phone").eq("id", notification.customer_id).single()
    : { data: null };
  try {
    const recipient = await sendTextMessage(customer?.phone, notification.message);
    await admin
      .from("notifications")
      .update({
        status: "SENT",
        provider_message_id: recipient.messageId ?? null,
        sent_at: new Date().toISOString(),
        failure_reason: null,
      })
      .eq("id", notification.id);
    return true;
  } catch (error) {
    await admin
      .from("notifications")
      .update({
        status: "FAILED",
        failure_reason:
          error instanceof Error ? error.message.slice(0, 500) : "SMS delivery failed",
      })
      .eq("id", notification.id);
    console.error("sms-failed", { notificationId: notification.id });
    return false;
  }
}
