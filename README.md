# VendorHub — Kenya Kiosk Keeper

VendorHub is a mobile-first business operations platform for informal retail vendors in Kenya. The app helps vendors manage daily sales, inventory, expenses, credit repayment, and reporting from a simple phone-friendly interface.

## Overview

This project is built for small-scale vendors operating in local marketplaces, including fresh-produce sellers and kiosk owners who need a lightweight, data-driven workflow without enterprise complexity. The product combines operational tracking with a bilingual UX and an AI-assisted insight layer to support daily business decisions.

At a high level, the application provides:

- sales capture for cash and credit transactions
- stock tracking with low-stock monitoring and restocking workflows
- expense logging and business profitability tracking
- customer credit visibility and payment tracking
- dashboard analytics and exportable reports
- offline-first data capture with queued synchronization when connectivity is restored
- AI-generated business insights for vendors in English and Swahili

## Product goals

The application is designed to solve practical problems for vendors:

- reduce time spent managing records manually
- make stock and credit performance visible at a glance
- improve decision-making using dashboard metrics
- support operations from mobile devices in low-connectivity environments
- provide a localized experience for Kenyan market contexts

## Architecture

The project is a TanStack Start application using React 19 and TypeScript.

Core architecture decisions:

- file-based routing via TanStack Router
- server/client separation for auth and Supabase access
- React Query for dashboard and data-fetch orchestration
- Tailwind-based UI system with Radix primitives
- Supabase as the primary data and auth backend
- Dexie/IndexedDB for offline-first persistence and local queueing
- PWA support for installable mobile experiences

## Key features

- authenticated vendor onboarding and approval flow
- dashboard with sales, expenses, profit, low-stock, and credit summaries
- mobile shell with top navigation and bottom navigation patterns
- sales, inventory, expenses, and credit management screens
- bilingual English/Swahili interaction layer
- reporting views for operational insights
- offline queue handling for sales, expenses, payments, restocks, and stock losses
- AI-powered insight generation via server-side functions
- PDF/CSV-style reporting support using jsPDF and structured data exports

## Tech stack

- React 19
- TypeScript
- Vite
- TanStack Router
- TanStack Start
- React Query
- Supabase
- Tailwind CSS
- Radix UI
- Zod
- Dexie
- jsPDF
- Lucide icons
- PWA plugin support

## Project structure

```text
kenya-kiosk-keeper/
├── src/
│   ├── components/          # Shared UI, navigation, cards, dialogs
│   ├── integrations/
│   │   └── supabase/        # Client/server Supabase configuration
│   ├── lib/
│   │   ├── ai.functions.ts  # AI insight generation
│   │   ├── mcp/            # MCP tooling and Supabase-bound helper integrations
│   │   ├── offline/        # IndexedDB sync queue and offline actions
│   │   ├── auth.tsx        # Auth helpers
│   │   ├── i18n.tsx        # Bilingual text configuration
│   │   └── format.ts       # Formatting helpers
│   ├── routes/             # File-based TanStack routes
│   ├── styles.css          # App-wide styling
│   ├── router.tsx
│   ├── routeTree.gen.ts
│   └── start.ts
├── package.json
├── vite.config.*
├── README.md
└── src/routes/README.md    # TanStack route conventions for this app
```

## Environment configuration

Create your local environment variables before running the app.

Required Supabase values:

```bash
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
SUPABASE_URL=your-supabase-url
SUPABASE_PUBLISHABLE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Notes:

- `VITE_*` variables are used by the browser/client runtime.
- `SUPABASE_*` values are used by server-side Supabase helpers and backend-guarded logic.
- The app expects valid database tables and auth settings to be configured in Supabase for product flows such as sales, expenses, credit, restocks, and profiles.

## Getting started

1. Install dependencies

```bash
npm install
```

2. Create environment variables

Add the values above to a `.env.local` file or your shell environment.

3. Start the app in development mode

```bash
npm run dev
```

4. Build for production

```bash
npm run build
```

5. Preview the production build

```bash
npm run preview
```

## Available scripts

```bash
npm run dev         # start local development server
npm run build       # production build
npm run build:dev   # development-mode build
npm run preview     # preview production build locally
npm run lint        # run ESLint checks
npm run format      # format the codebase with Prettier
```

## Offline-first behavior

The application includes an offline-first layer designed for unreliable connectivity in mobile kiosk environments.

Key behaviors:

- local persistence via IndexedDB
- queued writes for transactions when the app is offline
- review card UI for pending sync items
- automatic refresh from the server when connectivity returns
- local stock and customer state updates reflected immediately in the UI

This is implemented primarily in `src/lib/offline/` and is important for real-world vendor usage in low-bandwidth environments.

## Business domain and data model

The app centers on typical kiosk operations:

- products and inventory stock
- sales entries with optional credit and due dates
- customer records and debt tracking
- expense categories and amounts
- restocking events and stock loss logging
- profiles and vendor approval status

There are Supabase RPC patterns such as `record_sale`, `record_restock`, and `record_stock_loss`, which means database procedures are part of the core product workflow and should be maintained in sync with client-side logic.

## Operational notes

- The application is intentionally mobile-first and optimized for small screens.
- Bilingual support is part of the product UX; the app uses a localized text layer rather than a static English-only interface.
- The product includes approval and account-status gating for vendor access.
- The app shell supports vendor-specific workflow routing across dashboard, sales, inventory, expenses, reports, and credit screens.

## Suggested next steps for engineering work

- add a committed `.env.example` file
- document the required Supabase schema and database functions
- add seed data for local onboarding and QA
- define a release checklist for production deployment and environment validation
- add CI for linting and type checks

## Contributing

This repository is a software project with a product-oriented architecture. Contributions should keep the following in mind:

- maintain parity between Supabase schema and client assumptions
- preserve the offline-first flow when modifying data paths
- keep the mobile user experience responsive and lightweight
- respect English/Swahili localization requirements
- validate build and lint status before merging changes

---

Built for Kenya-based kiosk and fresh-produce vendors who want a practical, mobile-first tool for tracking sales, stock, credit, and business performance.