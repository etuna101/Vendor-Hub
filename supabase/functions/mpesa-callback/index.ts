import {
  adminClient,
  corsHeaders,
  env,
  HttpError,
  json,
  normalizeKenyanPhone,
  safeError,
} from "../_shared/core.ts";
import { deliverNotification } from "../_shared/sms.ts";
const metadata = (items: Array<{ Name: string; Value: unknown }> = []) =>
  Object.fromEntries(items.map((item) => [item.Name, item.Value]));
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (new URL(request.url).searchParams.get("token") !== env("DARAJA_CALLBACK_TOKEN"))
      throw new HttpError(401, "Unauthorized callback.");
    const callback = (await request.json())?.Body?.stkCallback;
    if (!callback?.CheckoutRequestID || typeof callback.ResultCode !== "number")
      throw new HttpError(400, "Invalid callback payload.");
    const admin = adminClient();
    if (callback.ResultCode !== 0) {
      const { data: payment, error } = await admin.rpc("process_failed_mpesa_payment", {
        _checkout_request_id: callback.CheckoutRequestID,
        _merchant_request_id: callback.MerchantRequestID ?? null,
        _result_code: callback.ResultCode,
        _result_description: callback.ResultDesc ?? null,
      });
      if (error) throw error;
      if (payment?.status !== "SUCCESS") {
        const { data: sale } = await admin
          .from("sales")
          .select("customer_id")
          .eq("id", payment.sale_id)
          .single();
        if (sale?.customer_id) {
          const { data: notice } = await admin
            .from("notifications")
            .insert({
              user_id: payment.user_id,
              customer_id: sale.customer_id,
              sale_id: payment.sale_id,
              credit_payment_id: payment.id,
              type: "PAYMENT_FAILED",
              message:
                "Your M-Pesa payment was not completed. Your VendorHub balance has not changed.",
            })
            .select("id,customer_id,message")
            .maybeSingle();
          if (notice) await deliverNotification(notice);
        }
      }
      return json({ ok: true });
    }
    const values = metadata(callback.CallbackMetadata?.Item);
    const amount = Number(values.Amount);
    const phone = normalizeKenyanPhone(values.PhoneNumber);
    const rawDate = String(values.TransactionDate ?? "");
    const date = /^\d{14}$/.test(rawDate)
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}T${rawDate.slice(8, 10)}:${rawDate.slice(10, 12)}:${rawDate.slice(12, 14)}+03:00`
      : new Date().toISOString();
    const { data: result, error } = await admin.rpc("process_successful_mpesa_payment", {
      _checkout_request_id: callback.CheckoutRequestID,
      _merchant_request_id: callback.MerchantRequestID ?? null,
      _mpesa_receipt_number: String(values.MpesaReceiptNumber ?? ""),
      _transaction_date: date,
      _amount: amount,
      _phone_number: phone,
      _result_code: 0,
      _result_description: callback.ResultDesc ?? null,
    });
    if (error || !result?.[0]) throw error ?? new Error("Payment result missing");
    const state = result[0];
    const { data: payment } = await admin
      .from("credit_payments")
      .select("id,user_id,sale_id")
      .eq("id", state.payment_id)
      .single();
    const { data: sale } = await admin
      .from("sales")
      .select("customer_id")
      .eq("id", state.sale_id)
      .single();
    if (payment && sale?.customer_id) {
      const message =
        state.debt_status === "PAID"
          ? "Payment received. Your VendorHub debt has been fully paid. Thank you."
          : `Payment received. KES ${Number(amount).toLocaleString("en-KE")} has been received. Your remaining balance is KES ${Number(state.balance).toLocaleString("en-KE")}.`;
      const { data: notice } = await admin
        .from("notifications")
        .insert({
          user_id: payment.user_id,
          customer_id: sale.customer_id,
          sale_id: payment.sale_id,
          credit_payment_id: payment.id,
          type: "PAYMENT_SUCCESS",
          message,
        })
        .select("id,customer_id,message")
        .maybeSingle();
      if (notice) await deliverNotification(notice);
    }
    return json({ ok: true });
  } catch (error) {
    return safeError(error);
  }
});
