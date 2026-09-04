import {
  adminClient,
  authenticatedUser,
  corsHeaders,
  HttpError,
  json,
  safeError,
} from "../_shared/core.ts";
import { deliverNotification } from "../_shared/sms.ts";
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await authenticatedUser(request);
    const { notification_id } = await request.json();
    if (!notification_id) throw new HttpError(422, "Notification is required.");
    const { data: notification } = await adminClient()
      .from("notifications")
      .select("id,user_id,customer_id,message,status")
      .eq("id", notification_id)
      .maybeSingle();
    if (!notification || notification.user_id !== user.id)
      throw new HttpError(404, "Notification not found.");
    if (notification.status === "SENT") return json({ ok: true, status: "SENT" });
    const ok = await deliverNotification(notification);
    return json({ ok, status: ok ? "SENT" : "FAILED" }, ok ? 200 : 502);
  } catch (error) {
    return safeError(error);
  }
});
