import {
  authenticatedUser,
  corsHeaders,
  HttpError,
  json,
  safeError,
  adminClient,
} from "../_shared/core.ts";
import { deliverNotification } from "../_shared/sms.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const user = await authenticatedUser(req);
    const { notification_id } = await req.json();
    if (!notification_id) throw new HttpError(422, "Notification is required.");
    const { data: notification, error } = await adminClient()
      .from("notifications")
      .select("id, message, customer_id, user_id, status")
      .eq("id", notification_id)
      .maybeSingle();
    if (error || !notification || notification.user_id !== user.id)
      throw new HttpError(404, "Notification not found.");
    if (notification.status === "SENT") return json({ ok: true, status: "SENT" });
    const result = await deliverNotification(notification);
    return json({ ok: result.ok, status: result.ok ? "SENT" : "FAILED" }, result.ok ? 200 : 502);
  } catch (error) {
    return safeError(error);
  }
});
