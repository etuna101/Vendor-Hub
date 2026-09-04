import { adminClient, env, fetchWithTimeout, normalizeKenyanPhone } from "./core.ts";

type SmsNotification = { id: string; message: string; customer_id: string | null; user_id: string };

export async function deliverNotification(notification: SmsNotification) {
  const admin = adminClient();
  const { data: customer, error: customerError } = notification.customer_id
    ? await admin.from("customers").select("phone").eq("id", notification.customer_id).single()
    : { data: null, error: new Error("notification has no customer") };
  if (customerError || !customer?.phone)
    throw new Error("Customer has no deliverable phone number");
  const to = normalizeKenyanPhone(customer.phone);
  const endpoint = `${Deno.env.get("AT_BASE_URL") ?? "https://api.africastalking.com"}/version1/messaging`;
  const body = new URLSearchParams({
    username: env("AT_USERNAME"),
    to: `+${to}`,
    message: notification.message,
  });
  const sender = Deno.env.get("AT_SENDER_ID");
  if (sender) body.set("from", sender);
  try {
    const response = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: {
        apiKey: env("AT_API_KEY"),
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const payload = await response.json().catch(() => ({}));
    const recipient = payload?.SMSMessageData?.Recipients?.[0];
    if (!response.ok || !recipient || Number(recipient.statusCode) >= 400) {
      throw new Error(`SMS provider rejected request (${response.status})`);
    }
    await admin
      .from("notifications")
      .update({
        status: "SENT",
        provider_message_id: recipient.messageId ?? null,
        sent_at: new Date().toISOString(),
        failure_reason: null,
      })
      .eq("id", notification.id);
    console.log("sms-sent", { notificationId: notification.id });
    return { ok: true };
  } catch (error) {
    await admin
      .from("notifications")
      .update({
        status: "FAILED",
        failure_reason:
          error instanceof Error ? error.message.slice(0, 500) : "SMS delivery failed",
      })
      .eq("id", notification.id);
    console.error("sms-failed", {
      notificationId: notification.id,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false };
  }
}
