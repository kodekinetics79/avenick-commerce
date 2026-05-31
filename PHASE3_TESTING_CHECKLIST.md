# Phase 3 Testing Checklist

## Build / Start
- [ ] `pnpm typecheck` — zero app-level errors (customer/seller/admin)
- [ ] Customer `:13100` → 200, Seller `:13101` → 307, Admin `:13102` → 307
- [ ] No inline `style={{ width }}` bars (segment-based everywhere)

## Design System & App Shell
- [ ] Admin/seller primary = enterprise blue; customer storefront primary = green
- [ ] Sidebar navy with "Modern Trade OS" descriptor + tagline
- [ ] Buttons: primary / accent / secondary / outline / ghost / destructive variants render correctly
- [ ] Cards use `shadow-card`; canvas is slate-50
- [ ] Skeleton shimmer + scrollbar utilities available

## Executive Command Center (`/admin/dashboard`)
- [ ] PageHeader shows eyebrow, "Executive Command Center" title, Live pill, AI Insights CTA
- [ ] Quick actions row: Create RFQ, Invite Supplier, Launch Campaign, Review Delayed Orders, Open Warehouse Queue, View AI Insights — all link correctly
- [ ] 12 KPI cards render: GMV, B2B Rev, B2C Rev, Commission, Active Companies, Active Customers, Active Suppliers, RFQ Conversion, Fulfillment Rate, Warehouse Utilization, Open Disputes (urgent), Delayed Orders (urgent)
- [ ] KPI trend indicators show (up green / down)
- [ ] AI Recommendations: 6 cards with confidence %, tags, deep-link actions
- [ ] Operational Health: 5 rows with severity dots + counts, link to target pages
- [ ] Pending-supplier-review callout shows when count > 0
- [ ] Revenue Split bar + legend (B2B/B2C) correct percentages
- [ ] RFQ Funnel bars (Created → Accepted)
- [ ] Order Lifecycle bars
- [ ] Top Categories share bars
- [ ] Top Suppliers list (rank, rating, orders, GMV)
- [ ] Top Customers list (orders, spend, B2B/B2C tag)
- [ ] Live GMV from DB used when paid orders exist; mock fallback otherwise
- [ ] Responsive: KPIs 2→4 col; analytics 1→3 col; quick actions wrap
- [ ] Dashboard compiles with zero errors; route returns 307 unauthenticated

## Module pages (regression)
- [ ] All admin nav links resolve (no 404s)
- [ ] CRM / Campaigns / Segments / Retention render
- [ ] Finance / Payments / Settlements / VAT render
- [ ] Support / Disputes / SLA render
- [ ] Warehouse / Inbound / Stock / Pick-Pack render
- [ ] Pricing & Commission renders
- [ ] Audit / Settings / Users / Integrations render

## Phase 3 — Build & demo readiness (verified)
- [x] `pnpm db:generate` succeeds (Prisma client generated)
- [x] `pnpm turbo run build` → 3 successful, 3 total
- [x] `next start` serves in production mode (admin /login → 200)
- [x] Customer storefront `/` and `/products/[slug]` render with live data
- [x] Demo Role switcher (Guest / B2C / B2B) toggles contextual nav
- [x] User-facing branding reads "Avenick Commerce" (no Avenick)
- [ ] ESLint: not configured yet (no eslint-config-next) — follow-up
- [ ] Run full DEMO_SCRIPT.md path end-to-end before each demo
