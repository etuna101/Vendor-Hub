<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# VendorHub — Kenya Kiosk Keeper

VendorHub is a mobile-first business management app for kiosk and market vendors in Kenya. Vendors can record sales and expenses, manage stock and customer credit, and review business performance in English or Swahili.

## Features

- Vendor registration, sign-in, email verification, approval status, and profile management
- Vendor dashboard, reports, and sales, expenses, inventory, and credit records
- Cash and credit sales, customer payments, restocking, and stock-loss records
- Customer debt balances, due-date notifications, and payment reminders
- M-Pesa STK Push for payments, with payment results processed through a Supabase callback
- Offline-first access to cached records and queued sales, expenses, inventory, and credit-payment changes; queued changes sync when the device reconnects and can be reviewed
- Business assistant that summarizes vendor data and answers questions using a server-side Groq API call
- Admin tools for vendor approvals, administrators, platform statistics, AI interaction logs, and assistant prompts
- Lovable MCP tools for authorized business summaries, product and credit lookups, and recording sales or expenses
- Installable Progressive Web App (PWA)

Live M-Pesa and SMS delivery require provider credentials and deployed Supabase Edge Functions. Reminders can also be recorded in the app without live SMS delivery. See [Supabase setup](supabase/OWN_SUPABASE_SETUP.md).

## Tech stack

- React 19, TypeScript, and Vite
- TanStack Start and TanStack Router
- TanStack Query
- Supabase Auth, Postgres, Row Level Security, RPCs, and Edge Functions
- Tailwind CSS and Radix UI
- Dexie / IndexedDB for offline records and sync queue
- Vite PWA plugin and Workbox
- Lovable MCP integration

## Requirements

- Node.js and npm (or Bun)
- A configured Supabase project; see [the setup guide](supabase/OWN_SUPABASE_SETUP.md)

## Local development

Run commands from this directory (`kenya-kiosk-keeper`).

1. Install dependencies:

   ```sh
   npm install
   ```

   Or use `bun install`.

2. Create a `.env` file in the project root:

   ```dotenv
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
   VITE_SUPABASE_PROJECT_ID=<project-ref>
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
   GROQ_API_KEY=<server-side-groq-key>
   ```

   The Vite variables are public client configuration. `GROQ_API_KEY` is a server secret: do not prefix it with `VITE_` or expose it in browser code. The app uses only the Supabase publishable/anon key; never put a service-role key or database password in client configuration. Provider secrets for M-Pesa and SMS belong in Supabase Edge Function secrets.

3. Configure the Supabase schema, authentication, and any integrations you need by following [Supabase setup](supabase/OWN_SUPABASE_SETUP.md). The app relies on the project's tables, row-level security policies, and database RPCs.

4. Start the development server:

   ```sh
   npm run dev
   ```

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run build:dev` | Build using development mode |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm run format` | Format files with Prettier |

## Project layout

```text
src/
  components/       Shared UI, navigation, and dialogs
  hooks/            Shared React hooks
  integrations/     Supabase clients and authentication middleware
  lib/              Auth, localization, reporting, assistant, MCP, and offline logic
  routes/           File-based TanStack routes for vendor, admin, and auth screens
  assets/           App images and branding
  server.ts         Server entry and error handling
supabase/
  functions/        M-Pesa, SMS, password-reset, and debt-reminder Edge Functions
  migrations/       Database migrations
  scripts/          Schema and SQL update scripts
  OWN_SUPABASE_SETUP.md
public/             PWA icons, favicon, and service worker
```

Routes are defined by files in `src/routes/`; see [route conventions](src/routes/README.md). `src/routeTree.gen.ts` is generated and should not be edited by hand.

## Deployment

Build with `npm run build` and configure the Supabase URL and publishable key for the client, plus `GROQ_API_KEY` as a server-side secret. The generated production target uses Cloudflare Workers. Deploy Supabase Edge Functions and configure their provider secrets separately if you enable M-Pesa or SMS. Follow [Supabase setup](supabase/OWN_SUPABASE_SETUP.md) for schema, auth, deployment, and secret details.

Keep database migrations and RPC definitions in sync with client changes: transactional operations such as sales, restocking, stock loss, and M-Pesa payment processing depend on them.
