import {
  adminClient,
  authenticatedUser,
  corsPreflightHeaders,
  env,
  fetchWithTimeout,
  HttpError,
  json,
  normalizeKenyanPhone,
  safeError,
} from "../_shared/core.ts";
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsPreflightHeaders(request) });
  try {
    const user = await authenticatedUser(request);
    const { sale_id, amount, phone_number } = await request.json();
    const value = Number(amount);
    if (!sale_id || !Number.isInteger(value) || value <= 0)
      throw new HttpError(422, "Enter a whole-KES amount greater than zero.");
    const admin = adminClient();
    const { data: sale } = await admin
      .from("sales")
      .select("id,user_id,customer_id,is_credit,credit_paid,customers(phone)")
      .eq("id", sale_id)
      .maybeSingle();
    if (!sale || sale.user_id !== user.id) throw new HttpError(404, "Sale not found.");
    if (sale.is_credit && sale.credit_paid) throw new HttpError(404, "This debt is already paid.");
    const phone = normalizeKenyanPhone(
      phone_number ?? (sale.customers as { phone?: string | null } | null)?.phone,
    );

    const { data: payment, error } = await admin.rpc("create_pending_mpesa_payment", {
      _sale_id: sale.id,
      _amount: value,
      _phone_number: phone,
    });
    if (error || !payment) throw new HttpError(422, error?.message ?? "Cannot start this payment.");
    try {
      const base = env("DARAJA_BASE_URL").replace(/\/$/, "");
      const oauth = await fetchWithTimeout(
        `${base}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${btoa(`${env("DARAJA_CONSUMER_KEY")}:${env("DARAJA_CONSUMER_SECRET")}`)}`,
          },
        },
      );
      const auth = await oauth.json();
      if (!oauth.ok || !auth.access_token) throw new Error("Daraja OAuth failed");
      const timestamp = new Date()
        .toISOString()
        .replace(/[-:TZ.]/g, "")
        .slice(0, 14);
      const shortcode = env("DARAJA_SHORTCODE");
      const stk = await fetchWithTimeout(`${base}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: btoa(`${shortcode}${env("DARAJA_PASSKEY")}${timestamp}`),
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: value,
          PartyA: phone,
          PartyB: shortcode,
          PhoneNumber: phone,
          CallBackURL: env("DARAJA_CALLBACK_URL"),
          AccountReference: `VH-${sale.id.slice(0, 8)}`,
          TransactionDesc: "VendorHub debt payment",
        }),
      });
      const response = await stk.json();
      if (!stk.ok || !response.CheckoutRequestID) throw new Error("Daraja rejected STK request");
      await admin
        .from("credit_payments")
        .update({
          merchant_request_id: response.MerchantRequestID ?? null,
          checkout_request_id: response.CheckoutRequestID,
          result_description: response.ResponseDescription ?? null,
        })
        .eq("id", payment.id);
      return json(
        {
          payment_id: payment.id,
          status: "PENDING",
          message: "Check the customer phone and enter the M-Pesa PIN.",
        },
        202,
      );
    } catch (error) {
      await admin
        .from("credit_payments")
        .update({ status: "FAILED", result_description: "Unable to initiate M-Pesa request." })
        .eq("id", payment.id);
      throw new HttpError(502, "M-Pesa is unavailable. Try again shortly.");
    }
  } catch (error) {
    return safeError(error);
  }
});
