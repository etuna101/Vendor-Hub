import { adminClient, corsHeaders, env, json, safeError } from "../_shared/core.ts";
import { deliverNotification } from "../_shared/sms.ts";
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (request.headers.get("x-cron-secret") !== env("CRON_SECRET"))
      return json({ error: "Unauthorized." }, 401);
    const admin = adminClient();
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const { data: sales, error } = await admin
      .from("sales")
      .select(
        "id,user_id,customer_id,total,due_date,customers(name),credit_payments(amount,status)",
      )
      .eq("is_credit", true)
      .eq("credit_paid", false)
      .not("due_date", "is", null)
      .lte("due_date", tomorrow);
    if (error) throw error;
    let queued = 0;
    for (const sale of sales ?? []) {
      if (!sale.customer_id || !sale.due_date) continue;
      const paid = (
        (sale.credit_payments as Array<{ amount: number; status: string }> | null) ?? []
      )
        .filter((payment) => payment.status === "SUCCESS")
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      const balance = Math.max(0, Number(sale.total) - paid);
      if (!balance) continue;
      const type =
        sale.due_date < today
          ? "DEBT_OVERDUE"
          : sale.due_date === today
            ? "DEBT_DUE_TODAY"
            : "DEBT_DUE_SOON";
      const name = (sale.customers as { name?: string } | null)?.name ?? "Customer";
      const message =
        type === "DEBT_OVERDUE"
          ? `Hello ${name}, your VendorHub balance of KES ${balance.toLocaleString("en-KE")} is overdue.`
          : `Hello ${name}, your VendorHub balance of KES ${balance.toLocaleString("en-KE")} is due ${type === "DEBT_DUE_TODAY" ? "today" : "tomorrow"}.`;
      const { data: notice, error: insertError } = await admin
        .from("notifications")
        .insert({
          user_id: sale.user_id,
          customer_id: sale.customer_id,
          sale_id: sale.id,
          type,
          message,
          reminder_date: today,
        })
        .select("id,customer_id,message")
        .maybeSingle();
      if (insertError) {
        if (insertError.code !== "23505")
          console.error("reminder-queue-failed", { saleId: sale.id });
        continue;
      }
      queued++;
      if (notice) await deliverNotification(notice);
    }
    return json({ ok: true, queued });
  } catch (error) {
    return safeError(error);
  }
});
