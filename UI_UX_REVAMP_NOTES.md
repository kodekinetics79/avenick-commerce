# UI/UX Revamp — Design System & App Shell

Scope: **visual foundation + app shell only** (no business-module logic changed).
Goal: premium, enterprise-grade, GCC-business-ready SaaS feel.

---

## What changed

### Design tokens (foundation)
- **Re-based the palette** from legacy orange → enterprise **navy + CTA blue + teal accent**.
- `packages/config/tailwind.config.base.js`:
  - `primary` scale → blue; added `navy`, `accent` (teal), `success`/`warning`/`danger` semantic colors
  - added `shadow-xs / shadow-card / shadow-elevated` enterprise elevation
- Rewrote all three `globals.css` with the new CSS-variable theme:
  - admin + seller → **blue** primary, teal accent, slate-50 canvas, navy text
  - customer → **green** storefront primary on the same neutral foundation
  - added `.skeleton` shimmer, `.scrollbar-thin`, `.scrollbar-hide` utilities; antialiased body; tight headings

### Sub-brand strategy
Enterprise back-office (admin/seller) reads as trustworthy **blue/navy**; the consumer
storefront keeps its **green** marketplace identity — both from one token system, so
shared primitives theme automatically.

### Primitives (`@avenick/ui`)
- **Button**: themeable `primary` (CSS var, not hardcoded), new `accent` (teal) variant,
  bordered `secondary`, refined `ghost/outline`, `destructive` for danger CTAs, new `xs` size.
- **MetricCard**: `shadow-card` + hover `shadow-elevated`, semantic trend colors (success/destructive), token borders.
- **New components**: `PageHeader`, `SectionHeader`, `TableShell`/`TableHead`, `Timeline`, `Skeleton*`.

### App shell
- **Admin sidebar**: gradient logo mark, "Modern Trade OS" descriptor, brand tagline in footer, refined borders/active state.
- **Role switcher** (customer): token-based (green active), premium dropdown with `shadow-elevated`, removed legacy orange.

### Build hygiene
- Fixed pre-existing strict-null (`noUncheckedIndexedAccess`) errors in seller pages that surfaced
  when the shared UI package cache invalidated (invoices, quotes, messages, shipments, quotes/submit).
- Result: **zero app-level TypeScript errors**; all three apps compile and serve.

---

## CTA hierarchy (applied standard)
- **Primary** (blue/green): Create RFQ, Add Product, Submit Quote, Convert to Order, Approve Supplier, Create Shipment, Start Campaign
- **Accent** (teal): Generate AI Insight
- **Secondary/Outline**: View Details, Compare, Export, Filter, Save Draft, Upload Document, Add Note
- **Destructive** (red): Reject, Cancel, Remove, Close Dispute

## Design language
- Cards: white, `rounded-2xl`, `border-border`, `shadow-card`
- Tables: `TableShell` chrome — uppercase muted headers, hover rows, scroll, footer
- Bars: **segmented** (no inline width styles) — consistent across health/credit/confidence/utilization
- Status: success green · warning amber · danger red · info blue · neutral slate
- Loading: shimmer `Skeleton*` placeholders
- Empty states: icon tile + title + description + action (`EmptyState`)

## Verification
- `pnpm typecheck` — no app-level errors (remaining items are long-standing package-internal
  type stubs: data-table/@tanstack, hijri-date/date-fns — not introduced here, not blocking dev/build)
- Customer `:13100` → 200 · Seller `:13101` → 307 · Admin `:13102` → 307 (auth redirects)
- Dev compile: ✓ across customer (989+ mods), admin, seller (1034 mods)

## Adoption guidance (next, optional)
Business-module pages currently hand-roll headers/tables. They can incrementally adopt
`PageHeader`, `SectionHeader`, `TableShell`, `Timeline`, and `Skeleton*` to remove
remaining bespoke markup — purely mechanical, no behavior change. Not done here to respect
the "foundation only" scope.

## Known limitations
- Existing module pages still use some hardcoded slate/green utility classes that already
  match the system; a follow-up pass could route them through the new primitives.
- A few semantic `orange-*` usages remain where orange is the *status* meaning (e.g. RETURNED) — intentional.
- No dark mode (light enterprise theme only); tokens are structured to allow adding it later.

## Phase 3 addendum
- Production build stabilized (see PHASE3_IMPLEMENTATION_NOTES.md); shared
  `@avenick/ui` primitives remain the single source for badges, cards, buttons,
  tables and empty states across all three portals.
- Login screens (admin + seller) unified on the slate/blue gradient + logo-badge
  treatment for a consistent entry experience.
