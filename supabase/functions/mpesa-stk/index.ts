import {
  adminClient,
  authenticatedUser,
  corsHeaders,
  env,
  fetchWithTimeout,
  HttpError,
  json,
  normalizeKenyanPhone,
  safeError,
} from "../_shared/core.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const user = await authenticatedUser(req);
    const { sale_id, amount } = await req.json();
    const paymentAmount = Number(amount);
    if (!sale_id || !Number.isInteger(paymentAmount) || paymentAmount <= 0) {
      throw new HttpError(422, "Enter a whole-KES amount greater than zero.");
    }
    const admin = adminClient();
    const { data: sale, error: saleError } = await admin
      .from("sales")
      .select("id, user_id, customer_id, is_credit, credit_paid, customers(phone)")
      .eq("id", sale_id)
      .maybeSingle();
    if (
      saleError ||
      !sale ||
      sale.user_id !== user.id ||
      !sale.is_credit ||
      sale.credit_paid ||
      !sale.customer_id
    ) {
      throw new HttpError(404, "This outstanding debt was not found.");
    }
    const phone = normalizeKenyanPhone((sale.customers as { phone?: string | null } | null)?.phone);
    const { data: pending, error: pendingError } = await admin.rpc("create_pending_mpesa_payment", {
      _sale_id: sale.id,
      _amount: paymentAmount,
      _phone_number: phone,
    });
    if (pendingError || !pending)
      throw new HttpError(422, pendingError?.message ?? "Unable to create payment request.");

    try {
      const key = env("DARAJA_CONSUMER_KEY");
      const secret = env("DARAJA_CONSUMER_SECRET");
      const baseUrl = env("DARAJA_BASE_URL").replace(/\/$/, "");
      const tokenResponse = await fetchWithTimeout(
        `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: { Authorization: `Basic ${btoa(`${key}:${secret}`)}` },
        },
      );
      const tokenPayload = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || !tokenPayload.access_token)
        throw new Error("Daraja OAuth request failed");
      const timestamp = new Date()
        .toISOString()
        .replace(/[-:TZ.]/g, "")
        .slice(0, 14);
      const shortcode = env("DARAJA_SHORTCODE");
      const password = btoa(`${shortcode}${env("DARAJA_PASSKEY")}${timestamp}`);
      const callbackUrl = env("DARAJA_CALLBACK_URL");
      const requestResponse = await fetchWithTimeout(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenPayload.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: paymentAmount,
          PartyA: phone,
          PartyB: shortcode,
          PhoneNumber: phone,
          CallBackURL: callbackUrl,
          AccountReference: `VH-${sale.id.slice(0, 8)}`,
          TransactionDesc: "VendorHub debt payment",
        }),
      });
      const responsePayload = await requestResponse.json().catch(() => ({}));
      if (!requestResponse.ok || !responsePayload.CheckoutRequestID)
        throw new Error("Daraja STK request was rejected");
      const { error: updateError } = await admin
        .from("credit_payments")
        .update({
          merchant_request_id: responsePayload.MerchantRequestID ?? null,
          checkout_request_id: responsePayload.CheckoutRequestID,
          result_code: responsePayload.ResponseCode ? Number(responsePayload.ResponseCode) : null,
          result_description: responsePayload.ResponseDescription ?? null,
        })
        .eq("id", pending.id);
      if (updateError) throw new Error("Unable to store payment request");
      console.log("stk-requested", {
        paymentId: pending.id,
        checkoutRequestId: responsePayload.CheckoutRequestID,
      });
      return json(
        {
          payment_id: pending.id,
          status: "PENDING",
          message: "Check the customer phone and enter the M-Pesa PIN.",
        },
        202,
      );
    } catch (providerError) {
      await admin
        .from("credit_payments")
        .update({ status: "FAILED", result_description: "Unable to initiate M-Pesa request." })
        .eq("id", pending.id)
        .eq("status", "PENDING");
      console.error("stk-request-failed", {
        paymentId: pending.id,
        reason: providerError instanceof Error ? providerError.message : "unknown",
      });
      throw new HttpError(502, "M-Pesa is unavailable right now. Please try again.");
    }
  } catch (error) {
    return safeError(error);
  }
});
