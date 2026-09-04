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

function metadata(items: Array<{ Name: string; Value: unknown }> = []) {
  return Object.fromEntries(items.map((item) => [item.Name, item.Value]));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    if (new URL(req.url).searchParams.get("token") !== env("DARAJA_CALLBACK_TOKEN"))
      throw new HttpError(401, "Unauthorized callback.");
    const callback = (await req.json())?.Body?.stkCallback;
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
      if (payment?.status === "FAILED" || payment?.status === "CANCELLED") {
        const { data: sale } = await admin
          .from("sales")
          .select("customer_id")
          .eq("id", payment.sale_id)
          .single();
        if (sale?.customer_id) {
          const inserted = await admin
            .from("notifications")
            .insert({
              user_id: payment.user_id,
              customer_id: sale.customer_id,
              sale_id: payment.sale_id,
              credit_payment_id: payment.id,
              type: "PAYMENT_FAILED",
              message:
                "Your M-Pesa payment was not completed. Your VendorHub balance has not changed.",
              status: "PENDING",
            })
            .select("id, message, customer_id, user_id")
            .maybeSingle();
          if (!inserted.error && inserted.data) await deliverNotification(inserted.data);
        }
      }
      console.log("stk-failed", {
        paymentId: payment?.id,
        checkoutRequestId: callback.CheckoutRequestID,
        resultCode: callback.ResultCode,
      });
      return json({ ok: true });
    }
    const values = metadata(callback.CallbackMetadata?.Item);
    const amount = Number(values.Amount);
    const receipt = String(values.MpesaReceiptNumber ?? "");
    const transactionDate = String(values.TransactionDate ?? "");
    const phone = normalizeKenyanPhone(values.PhoneNumber);
    const time = /^\d{14}$/.test(transactionDate)
      ? `${transactionDate.slice(0, 4)}-${transactionDate.slice(4, 6)}-${transactionDate.slice(6, 8)}T${transactionDate.slice(8, 10)}:${transactionDate.slice(10, 12)}:${transactionDate.slice(12, 14)}+03:00`
      : new Date().toISOString();
    const { data: result, error } = await admin.rpc("process_successful_mpesa_payment", {
      _checkout_request_id: callback.CheckoutRequestID,
      _merchant_request_id: callback.MerchantRequestID ?? null,
      _mpesa_receipt_number: receipt,
      _transaction_date: time,
      _amount: amount,
      _phone_number: phone,
      _result_code: callback.ResultCode,
      _result_description: callback.ResultDesc ?? null,
    });
    if (error || !result?.[0]) throw error ?? new Error("Payment result missing");
    const state = result[0];
    const { data: payment } = await admin
      .from("credit_payments")
      .select("id, user_id, sale_id")
      .eq("id", state.payment_id)
      .single();
    const { data: sale } = await admin
      .from("sales")
      .select("customer_id")
      .eq("id", state.sale_id)
      .single();
    if (!payment || !sale?.customer_id) throw new Error("Payment relationship missing");
    const message =
      state.debt_status === "PAID"
        ? `Payment received. Your VendorHub debt has been fully paid. Thank you.`
        : `Payment received. KES ${Number(amount).toLocaleString("en-KE")} has been received. Your remaining balance is KES ${Number(state.balance).toLocaleString("en-KE")}.`;
    const inserted = await admin
      .from("notifications")
      .insert({
        user_id: payment.user_id,
        customer_id: sale.customer_id,
        sale_id: payment.sale_id,
        credit_payment_id: payment.id,
        type: "PAYMENT_SUCCESS",
        message,
        status: "PENDING",
      })
      .select("id, message, customer_id, user_id")
      .maybeSingle();
    if (!inserted.error && inserted.data) await deliverNotification(inserted.data);
    // A uniqueness conflict here is the expected result of a duplicate callback.
    console.log("stk-success", {
      paymentId: payment.id,
      checkoutRequestId: callback.CheckoutRequestID,
    });
    return json({ ok: true });
  } catch (error) {
    console.error("stk-callback-error", error instanceof Error ? error.message : "unknown");
    return error instanceof HttpError
      ? json({ error: error.message }, error.status)
      : json({ error: "Callback processing failed." }, 500);
  }
});
