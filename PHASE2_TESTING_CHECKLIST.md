# Phase 2 Testing Checklist — Avenick Commerce

## Branding

- [ ] Customer app: browser tab shows "Avenick Commerce"
- [ ] Customer login page: headline "Welcome to Avenick Commerce", subheading "B2B-first. B2C-ready."
- [ ] Customer header logo: "Avenick Commerce"
- [ ] Customer footer: "Avenick Commerce" brand name and copyright
- [ ] Seller login: subheading "Avenick Commerce — Modern Trade OS"
- [ ] Seller sidebar: "Avenick Commerce" brand, "Modern Trade OS" tagline
- [ ] Admin login: subheading "Avenick Commerce — Platform Operations"
- [ ] Admin sidebar: "Avenick Commerce" brand, "Modern Trade OS" tagline
- [ ] Admin dashboard subheading: "Modern trade command center"
- [ ] No visible "Manzil" text anywhere in the UI (excluding @manzil/* package import comments)

## Database & Build

- [ ] `pnpm build` passes without errors in all three apps
- [ ] `pnpm dev` starts all three apps on correct ports (13100, 13101, 13102)
- [ ] Prisma schema unchanged — no migration errors
- [ ] `@manzil/database` mock-data.ts exports are importable from all apps

## Role Switcher (Customer App)

- [ ] Role switcher visible in customer header category nav bar
- [ ] Selecting "Guest" shows public nav: Products, Deals, Brands, Categories
- [ ] Selecting "B2B Buyer" shows B2B nav: Dashboard, RFQs, Quotes, Company
- [ ] Role preference persists in localStorage after page reload
- [ ] Selecting "B2C Customer" shows standard nav items

## Navigation per Role

### Customer (Guest/B2C)
- [ ] /products loads product grid
- [ ] /deals shows deals with discount badges and category filter
- [ ] /brands shows brand directory grid
- [ ] /wishlist shows wishlist (mock items or empty state)
- [ ] /support shows ticket list and new ticket form
- [ ] /orders/ord_001 shows order detail with timeline

### B2B Buyer
- [ ] /b2b shows B2B dashboard with company info, credit, RFQs, reorder center
- [ ] /b2b/rfq/new shows RFQ creation form
- [ ] Submit RFQ form shows success state
- [ ] /b2b/quotes shows quotes table

## B2C Flow

- [ ] Homepage loads with featured products (or empty state if DB empty)
- [ ] Homepage shows "For B2B Buyers" section with two CTA cards
- [ ] Product card "Add to Cart" updates cart counter in header
- [ ] Cart page shows subtotal, VAT (5%), and total
- [ ] /checkout page accessible from cart

## B2B RFQ

- [ ] /b2b shows mock RFQ list with status badges
- [ ] /b2b/rfq/new form validates required fields
- [ ] /b2b/rfq/new submission shows success toast/screen
- [ ] /b2b/quotes shows received quotes with Accept button placeholder

## Supplier Flow (Seller App)

- [ ] Seller login works (redirects to /dashboard)
- [ ] Dashboard shows existing stats plus three new widgets (documents, RFQs, performance)
- [ ] /onboarding shows step progress and document upload checklist
- [ ] /documents shows table with expiry dates and status badges
- [ ] /documents shows amber banner for expiring docs
- [ ] /messages shows RFQ inbox section with PENDING badge count
- [ ] /performance shows overall score, metrics cards, and monthly trend
- [ ] /inventory shows low stock alert banner when items are below reorder point
- [ ] /payouts shows payout history table

## Warehouse (Admin)

- [ ] /warehouse loads without error
- [ ] Utilization % progress bar renders
- [ ] Low stock alerts section visible
- [ ] Stock by category bar chart renders

## CRM (Admin)

- [ ] /crm loads without error
- [ ] Customer count cards show B2C and B2B numbers
- [ ] Smart alerts section shows 3 alerts
- [ ] Recent activity timeline renders
- [ ] Top customers table renders

## Admin Dashboard

- [ ] /dashboard shows existing KPI cards
- [ ] New widgets section visible: Sales Split, RFQ Intelligence, Supplier Documents, Active B2B, Top Categories, Platform Users
- [ ] B2C/B2B bar progress renders correctly

## Support / Dispute (Admin)

- [ ] /support loads ticket table
- [ ] 8 mock tickets visible
- [ ] Status badges render (Open, In Progress, Escalated, Closed)
- [ ] Summary count cards at top correct
- [ ] Filter tab buttons render (non-functional in mock)

## Finance (Admin)

- [ ] /finance loads without error
- [ ] Summary cards show totals, collected, outstanding, VAT
- [ ] Supplier settlements pending banner renders
- [ ] Commission revenue breakdown renders
- [ ] Invoice table shows 5 mock rows

## Build / Start Commands

```bash
# Install dependencies
pnpm install

# Start all apps in development
pnpm dev

# Build all apps
pnpm build

# Start individual apps
pnpm --filter customer dev
pnpm --filter seller dev
pnpm --filter admin dev
```
