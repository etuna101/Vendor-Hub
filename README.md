# VendorHub — Kenya Kiosk Keeper

VendorHub is a mobile-first kiosk management app built for small fresh-produce vendors in Kenya. It helps vendors track sales, stock, expenses, customer credit, and business performance from a simple web interface.

## What this project is

This app is designed for informal marketplace vendors who need a lightweight, phone-friendly system to:

- record daily sales and cash/credit transactions
- manage inventory and low-stock alerts
- log expenses and calculate profit
- track outstanding customer credit and mark payments
- generate simple sales, expense, profit, and inventory reports
- use an AI-powered assistant for business insights

The UI is optimized for a small screen and supports English and Swahili language text.

## Key features

- authenticated vendor experience using Supabase
- dashboard with sales, expenses, profit, low stock, and credit totals
- branded mobile shell with top navigation and bottom tab navigation
- sales entry with credit support and customer selection
- inventory tracking with product restocking and low-stock filtering
- expense tracking by category
- outstanding credit management and payment marking
- report export to CSV / PDF
- AI insights and assistant support via server functions
- responsive layout using Tailwind CSS and TanStack React Router

## Tech stack

- React 19
- TypeScript
- Vite
- TanStack React Router
- TanStack React Query
- Supabase (auth + database)
- Tailwind CSS
- Radix UI primitives
- jsPDF for PDF export
- Lucide icons
- Zod validation

## Getting started

1. Install dependencies

```bash
npm install
```

2. Configure Supabase

- create a Supabase project
- add the required database tables and auth settings
- provide your Supabase URL and anon key via environment variables

3. Run the app locally

```bash
npm run dev
```

4. Build for production

```bash
npm run build
```

## Project structure

- `src/routes/` — file-based app routes for pages like dashboard, sales, inventory, expenses, credit, and reports
- `src/components/` — shared UI elements, navigation, and controls
- `src/lib/` — auth, formatting, i18n, utilities, and error reporting
- `src/integrations/supabase/` — Supabase client and auth helpers
- `supabase/` — Supabase database migrations and configuration
- `styles.css` — global styles imported by the app shell

## Notes for reviewers

- The app uses Supabase for both authentication and data persistence.
- The app shell title/description indicates a vendor-focused product for "Mama Mboga" and Kenyan marketplace workflows.
- There are Supabase RPC calls such as `record_sale` and `record_restock`, so the database schema and stored procedures are important for full functionality.
- The app is intentionally simple and focused on essential business operations for small vendors.

## Recommended next steps

- add a `.env.example` with Supabase keys and configuration variables
- include migration documentation for the required tables and stored procedures
- provide sample data for quick onboarding during review

---

Built as a TanStack Start app to help vendors manage sales, stock, expenses, and credit with a Kenyan market focus.