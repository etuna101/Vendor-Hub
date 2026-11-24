# VendorHub — Kenya Kiosk Keeper

VendorHub is a mobile-first business management app for kiosk and market vendors in Kenya. It provides tools for recording sales, tracking stock and expenses, managing customer credit, and reviewing business performance. The interface supports English and Swahili.

## Features

- Vendor signup, sign-in, account status, and admin vendor management
- Dashboard and reports for sales, expenses, profit, inventory, and credit
- Sales entry for cash and credit transactions
- Inventory, restocking, and stock-loss tracking
- Customer credit and payment tracking, including M-Pesa payment flows
- Offline support for selected records, with a local queue that syncs when connectivity returns
- AI business assistant backed by a server-side Groq API call
- Installable Progressive Web App (PWA)

SMS delivery and some reminder flows depend on the Supabase Edge Function and provider configuration described in [Supabase setup](supabase/OWN_SUPABASE_SETUP.md). A reminder may be recorded without a live SMS being sent.

## Tech stack

- React 19, TypeScript, and Vite
- TanStack Start and TanStack Router
- TanStack Query
- Supabase Auth, database, and Edge Functions
- Tailwind CSS and Radix UI
- Dexie / IndexedDB for local offline data
- Vite PWA plugin

## Requirements

- Node.js and npm (or Bun)
- A Supabase project configured with the VendorHub schema

## Local development

1. Install dependencies from this directory:

   ```sh
   npm install
   ```

2. Create a `.env` file in the project root and set the variables below. Never commit real credentials.

   ```dotenv
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
   GROQ_API_KEY=<server-only-groq-key>
   ```

   The service role key and Groq key are server secrets. Do not use a `VITE_` prefix for either one or expose them in browser code. The service role key is only needed for server code that requires privileged Supabase access; keep it out of client configuration.

3. For a new Supabase project, follow [the Supabase setup guide](supabase/OWN_SUPABASE_SETUP.md). It covers schema installation, auth settings, Edge Functions, and optional M-Pesa/SMS provider setup. The app expects the database schema and RPCs provided by this project.

4. Start the development server:

   ```sh
   npm run dev
   ```

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create a production build |
| `npm run build:dev` | Build using development mode |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm run format` | Format files with Prettier |

## Project layout

```text
src/
  components/       Shared UI and app navigation
  integrations/     Supabase client, server client, and auth middleware
  lib/              Auth, localization, reporting, assistant, and offline logic
  routes/           File-based TanStack routes
  styles.css        Global styles
  router.tsx        Router setup
  server.ts         Server entry and error handling
supabase/
  functions/        M-Pesa, SMS, password reset, and reminder Edge Functions
  migrations/      Database migrations
  scripts/         Schema and SQL update scripts
  OWN_SUPABASE_SETUP.md
public/             PWA assets and service worker
```

Routes are defined by files in `src/routes/`; see [the route conventions](src/routes/README.md). The generated `src/routeTree.gen.ts` should not be edited by hand.

## Deployment notes

Build the app with `npm run build` and configure the required environment variables in the hosting provider. Set the public Supabase URL and publishable key for the client, and keep server-only credentials in the server environment. Supabase Edge Functions and their third-party provider secrets are deployed and configured separately; see the setup guide for the steps and secret names.

The app uses Supabase RPCs for transactional operations such as sales, restocking, and stock loss. Keep database migrations and functions in sync with client changes.
