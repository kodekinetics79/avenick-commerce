# Phase 2 Implementation Notes — Avenick Commerce

## Framework & Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Framework**: Next.js 14 (App Router, Server Components)
- **Styling**: Tailwind CSS
- **Auth**: next-auth v5 beta
- **ORM**: Prisma
- **Language**: TypeScript

## Apps

| App       | Port  | Purpose                              |
|-----------|-------|--------------------------------------|
| customer  | 13100 | B2C storefront + B2B buyer portal    |
| seller    | 13101 | Supplier/seller management portal    |
| admin     | 13102 | Marketplace admin intelligence panel |

## Packages

| Package              | Purpose                                    |
|---------------------|--------------------------------------------|
| @manzil/auth        | next-auth configuration and helpers        |
| @manzil/database    | Prisma client, service functions, mock data|
| @manzil/ui          | Shared React component library             |
| @manzil/utils       | Shared utilities (formatCurrency, cn, etc) |
| @manzil/types       | Shared TypeScript types                    |

## Database

- **DB**: PostgreSQL (manzil_db)
- **ORM**: Prisma (schema at packages/database/prisma/schema.prisma)
- **MySQL decision**: Deferred — PostgreSQL works for development; MySQL migration recommended before production

## What Was Changed in Phase 2

### Branding (STEP 2)
- All user-visible "Manzil" → "Avenick Commerce" across all three apps
- Login headlines, sidebars, page metadata, footer, dashboard subheadings
- Customer login: "Welcome to Avenick Commerce" / "B2B-first. B2C-ready. Built for modern trade."
- Admin sidebar brand: "Avenick Commerce" / "Modern Trade OS"
- Browser tab titles updated in all three app layout.tsx files

### Shared Mock Data (STEP 4d)
- Created `/packages/database/src/mock-data.ts` with exported constants for:
  products, brands, wishlist, orders, support tickets, RFQs, quotes, B2B company,
  seller documents, seller performance, seller RFQ inbox, payout history,
  admin support tickets, finance invoices, warehouse data, CRM activities, top customers
- Exported from `/packages/database/src/index.ts`

### Customer App — New Pages
- `/wishlist` — Wishlist with add-to-cart and remove actions
- `/deals` — Deals & promotions with discount badges and category filter
- `/brands` — Brand directory grid with product counts
- `/orders/[id]` — Order detail with status timeline, line items, VAT summary
- `/support` — Support tickets list + open new ticket form
- `/b2b` (page.tsx) — B2B buyer dashboard with company info, credit, RFQs, reorder center
- `/b2b/rfq/new` — Create RFQ form with mock submit → success state
- `/b2b/quotes` — Quotes received from suppliers

### Customer App — Enhancements
- Homepage: Added "For B2B Buyers" section with Request a Quote and Open Company Account CTAs
- Header: Added Deals and Brands to category nav; integrated RoleSwitcher component
- New `RoleSwitcher` component: Guest / B2C Customer / B2B Buyer demo role switcher, stored in localStorage

### Seller App — New Pages
- `/onboarding` — Onboarding step progress with document upload checklist
- `/documents` — Document center with expiry alerts and status badges
- `/performance` — Performance scorecard with metrics and monthly trend chart

### Seller App — Enhancements
- `/inventory` — Added low stock alert banner
- `/messages` — Added RFQ inbox section with respond buttons
- `/dashboard` — Added expiring documents widget, pending RFQs widget, performance score widget
- `seller-layout.tsx` — Added Documents and Performance nav items

### Admin App — New Pages
- `/crm` — CRM overview: customer counts, smart alerts, activity timeline, top customers table
- `/finance` — Finance overview: invoice summary, VAT, commission, settlements, invoice table
- `/support` — Support tickets with status filters, SLA remaining, and action buttons
- `/warehouse` — Warehouse overview: utilization, low stock alerts, stock by category

### Admin App — Enhancements
- `/dashboard` — Added 6 new intelligence widgets: B2C/B2B sales split, RFQ intelligence, expiring supplier docs, active B2B companies, top categories, platform users
- `admin-layout.tsx` — Added CRM, Finance, Warehouse, Support nav items

## What Was NOT Changed

- Package names in package.json (kept @manzil/*)
- Database name (manzil_db) or env vars
- Prisma schema — no migrations run
- Existing working pages (cart, checkout, products, account, orders, categories, search, register)
- Internal identifiers like `manzil-cart` localStorage key
- API route internals
- File/folder names that would break imports

## Assumptions

- Mock data is used for all new features — no new Prisma queries introduced
- Role switcher is UI-only; no auth changes made
- All new pages are server components unless interactivity required (form pages use "use client")
- Existing Tailwind config and design tokens reused; no new CSS files added
- No new npm packages added
