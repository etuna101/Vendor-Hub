import { adminClient, env, fetchWithTimeout, normalizeKenyanPhone } from "./core.ts";
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
    const phone = normalizeKenyanPhone(customer?.phone);
    const body = new URLSearchParams({
      username: env("AT_USERNAME"),
      to: `+${phone}`,
      message: notification.message,
    });
    const sender = Deno.env.get("AT_SENDER_ID");
    if (sender) body.set("from", sender);
    const response = await fetchWithTimeout(
      `${Deno.env.get("AT_BASE_URL") ?? "https://api.africastalking.com"}/version1/messaging`,
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
    const payload = await response.json().catch(() => ({}));
    const recipient = payload?.SMSMessageData?.Recipients?.[0];
    if (!response.ok || !recipient || Number(recipient.statusCode) >= 400)
      throw new Error("SMS provider rejected request");
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
