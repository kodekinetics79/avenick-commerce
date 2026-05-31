# Avenick Commerce — Demo Script

**Tagline:** B2B-first. B2C-ready. Built for modern trade.
**Positioning:** Modern Trade OS for the GCC.

This is the recommended 10–12 minute walkthrough for a client/investor demo. It
moves across all three portals (Admin Console, Customer Storefront, Seller
Central) to show the full commerce loop — discovery, RFQ, order, fulfilment,
finance, support, and AI.

---

## Setup (before the demo)

```bash
pnpm install
pnpm db:generate        # generate Prisma client
pnpm db:seed            # load GCC demo data (optional if DB already seeded)
pnpm dev                # starts all three apps via turbo
```

| Portal             | URL                     | Login                              |
|--------------------|-------------------------|------------------------------------|
| Customer Storefront| http://localhost:13100  | seller/customer test accounts      |
| Seller Central     | http://localhost:13101  | seller@avenick.test / Password123!  |
| Admin Console      | http://localhost:13102  | admin@avenick.test / Password123!   |

> The Customer Storefront has an in-app **Demo Role switcher** (top bar:
> Guest / B2C Customer / B2B Buyer) so you can demo buyer journeys without
> re-logging.

---

## The Path (follow in order)

### 1. Executive Dashboard — *“One control tower for the whole business”*
- Open **Admin Console → Dashboard** (`/dashboard`).
- Point out GMV, active orders, sellers, and operational health tiles.
- Message: leadership sees B2C + B2B in a single pane.

### 2. B2C Storefront — *“Consumer-grade buying experience”*
- Switch to **Customer Storefront** (`/`), Demo Role = **B2C Customer**.
- Browse a category, open a product (`/products/<slug>`), highlight pricing,
  stock, seller info, and bilingual (EN/AR) content.
- **Add to cart** → open `/cart`.

### 3. B2B Buyer — *“Same platform, procurement-grade tools”*
- Switch Demo Role = **B2B Buyer** → `/b2b`.
- Show the buyer dashboard (companies, approvals, order history).

### 4. RFQ / Quotes — *“Request, compare, decide”*
- **Create RFQ**: `/b2b/rfq/new` — add line items, submit.
- Open **Quotes** (`/b2b/quotes`) — compare supplier quotes side by side.
- **Convert** the winning quote to an order.

### 5. Supplier Portal — *“Sellers respond and fulfil”*
- Switch to **Seller Central** (`/dashboard`).
- Open **Quotes** (`/quotes`) — respond to the inbound RFQ.
- Show **Products / Pricing** (`/products`) and listing health.

### 6. Orders & Fulfilment
- **Admin Console → Orders** (`/orders`) — the new order is visible across
  channels; open the detail view for status timeline.

### 7. Warehouse / 3PL — *“Pick, pack, dispatch”*
- **Admin Console → Warehouse** (`/warehouse/pickpack?tab=dispatch`).
- Walk the pick → pack → dispatch stages; show **Stock Manager**
  (`/warehouse/stock`) with low/out-of-stock signals.

### 8. CRM / Growth — *“Retention is a metric, not a guess”*
- **Admin Console → CRM** (`/crm`) and **Retention** (`/retention`).
- Highlight a retention/churn alert and customer segments.

### 9. Finance — *“Money movement, end to end”*
- **Admin Console → Finance** (`/finance`).
- Show an invoice, **commission** (`/pricing`), settlements
  (`/settlements`), and VAT (`/vat`).

### 10. Support / Disputes
- **Admin Console → Support** (`/support`) and **Disputes** (`/disputes`).
- Open a ticket/dispute to show SLA and resolution workflow.

### 11. AI / Automation — *“The OS that works while you sleep”*
- Finish strong at **Admin Console → AI Insights** (`/ai-insights`) and
  **Automation** (`/automation`).
- Close on the AI recommendations / automation rules as the differentiator.

---

## Closing line
> “One platform — B2C storefront, B2B procurement, supplier operations,
> warehouse, finance, and AI — purpose-built for modern trade in the GCC.”

---

## Demo tips
- Pre-open the key tabs in separate browser windows to avoid load waits.
- Keep the Demo Role switcher visible — it makes the B2C↔B2B story tangible.
- If a list looks light, mention seed data is illustrative; production scales
  to thousands of suppliers/products.
- Hard-refresh (Cmd+Shift+R) once before starting to clear stale state.
