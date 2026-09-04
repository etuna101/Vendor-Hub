# M-Pesa and SMS deployment

Apply the database migration before deploying functions. The application is configured for Supabase project `ibivokyralgxxqkfdcpm`.

```sh
supabase link --project-ref ibivokyralgxxqkfdcpm
supabase db push
supabase functions deploy mpesa-stk
supabase functions deploy mpesa-callback
supabase functions deploy send-sms
supabase functions deploy debt-reminders
```

Set these as **Supabase Edge Function secrets**, never as `VITE_*` variables or committed files:

```text
DARAJA_CONSUMER_KEY=
DARAJA_CONSUMER_SECRET=
DARAJA_PASSKEY=
DARAJA_SHORTCODE=
DARAJA_BASE_URL=https://sandbox.safaricom.co.ke
DARAJA_CALLBACK_TOKEN=<long-random-secret>
DARAJA_CALLBACK_URL=https://ibivokyralgxxqkfdcpm.supabase.co/functions/v1/mpesa-callback?token=<the-same-long-random-secret>

AT_API_KEY=
AT_USERNAME=
AT_SENDER_ID=
AT_BASE_URL=https://api.sandbox.africastalking.com

CRON_SECRET=<different-long-random-secret>
```

For example, save those values in a local, gitignored file and run:

```sh
supabase secrets set --env-file supabase/functions/.env.local
```

Use Safaricom's sandbox consumer key, secret, passkey, and test shortcode first. Register the exact `DARAJA_CALLBACK_URL` above in the STK request configuration; the token query parameter is required because Daraja callbacks do not carry a user session. Use Africa's Talking sandbox credentials and sender settings first, then replace only the provider values with production credentials after their approval process.

To schedule reminders, configure a trusted scheduler to POST once each morning to:

```text
https://ibivokyralgxxqkfdcpm.supabase.co/functions/v1/debt-reminders
```

with `x-cron-secret: <CRON_SECRET>`. The database unique index prevents a second same-day reminder for the same debt/type.

Recommended sandbox test sequence: create a credit sale with a valid sandbox phone, initiate a partial STK request, complete it in the provider sandbox, confirm the payment becomes `SUCCESS` and the balance drops once, resend the callback to verify it is idempotent, then cancel a second request and confirm the debt balance is unchanged. Verify both payment and reminder SMS entries in `notifications` independently of the payment result.
