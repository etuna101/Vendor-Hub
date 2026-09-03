# Using your own Supabase project with VendorHub

The app currently uses the Lovable-managed backend. To run it fully on a Supabase project you own:

## 1. Create the schema in your project

In your Supabase dashboard → SQL Editor → New query, paste the whole contents of
`supabase/schema_bundle.sql` and run it. It creates, in order:

- enums (`app_role`, `expense_category`)
- tables: `user_roles`, `profiles`, `products`, `stock_history`, `customers`,
  `sales`, `credit_payments`, `expenses`, `ai_interactions`, `system_prompts`
- GRANTs + Row Level Security policies (each vendor only sees their own rows)
- functions/RPCs: `has_role`, `handle_new_user`, `record_sale`, `record_restock`,
  `record_stock_loss`, `admin_platform_stats`, `admin_vendor_overview`
- the `on_auth_user_created` trigger that creates a profile + `vendor` role on signup

It is safe to run once on an empty project. If a statement fails because an object
already exists, that object is already correct — continue with the rest.

## 2. Auth settings

- Authentication → Providers → Email: enable, and enable "Leaked password protection".
- Authentication → URL Configuration: add your app URL (e.g. Vercel domain) to
  Site URL and Redirect URLs.
- If you want Google sign-in, enable the Google provider and add its client id/secret.

## 3. Point the app at your project

The app reads these variables (see `.env`):

```
VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your anon / publishable key>
VITE_SUPABASE_PROJECT_ID=<your-ref>
SUPABASE_URL=https://<your-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<your anon / publishable key>
```

- **On Vercel / your own hosting:** set those five variables in the project's
  Environment Variables and redeploy. That deployment then reads and writes only
  your Supabase project.
- **Inside Lovable:** these values are managed by Lovable Cloud and cannot be
  edited from chat. Switch the backend from project **Settings → Cloud/Supabase
  connection** (connect your own Supabase project). After that, the same code
  runs against your database.

Only ever use the **anon / publishable** key in the app. Never put the service role
key or database password in `.env`, client code, or chat.

## 4. Make yourself admin

After signing up once in the app, run in the SQL Editor:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com'
on conflict (user_id, role) do nothing;
```
