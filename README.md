# Manzil — منزل

GCC B2B + B2C Marketplace Platform — Stage 1 MVP

Three-portal monorepo: Customer Marketplace · Seller Central · Admin Console

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

### 1. Clone and install

```bash
git clone <repo>
cd manzil
pnpm install
```

### 2. Environment setup

```bash
cp .env.example .env
```

Edit `.env` — the defaults work for local Docker dev out of the box.

### 3. Start infrastructure

```bash
docker compose up -d
```

Starts: PostgreSQL 15 · Redis 7 · MinIO · Elasticsearch 8

Wait ~15s for Elasticsearch to be healthy before running migrations.

### 4. Run database migrations + seed

```bash
pnpm db:migrate
pnpm db:seed
```

### 5. Start all portals

```bash
pnpm dev
```

Or individually:

```bash
pnpm --filter @manzil/customer dev   # port 14000
pnpm --filter @manzil/seller dev     # port 14001
pnpm --filter @manzil/admin dev      # port 14002
```

---

## Ports

| Service            | URL                          |
|--------------------|------------------------------|
| Customer Portal    | http://localhost:3000        |
| Seller Central     | http://localhost:3001        |
| Admin Console      | http://localhost:3002        |
| MinIO Console      | http://localhost:9001        |
| Elasticsearch      | http://localhost:9200        |
| PostgreSQL         | localhost:5432               |
| Redis              | localhost:6379               |

---

## Test Accounts (after seed)

| Role              | Email                         | Password       |
|-------------------|-------------------------------|----------------|
| Super Admin       | admin@manzil.test             | Password123!   |
| Seller Owner      | seller@manzil.test            | Password123!   |
| B2C Buyer         | buyer@manzil.test             | Password123!   |
| B2B Company Admin | company@manzil.test           | Password123!   |
| Pending Seller    | pending-seller@manzil.test    | Password123!   |

---

## Portal Overview

### Customer Portal (port 3000)
- Product browse, search, and detail pages
- Arabic/English support, RTL layout
- Add to cart (Zustand, persisted), checkout with mock payment
- B2C order placement with VAT calculation (UAE 5%)
- B2B company registration page
- Order history

### Seller Central (port 3001)
- Amazon-inspired command-center dashboard
- Action cards: orders, revenue, payout, compliance, messages, RFQs
- **Fix Your Products** — per-product issue list (missing images, Arabic title, price, stock, compliance)
- Product listing health score (0–100)
- Inventory management with warehouse/location tracking
- Orders table with status workflow
- Compliance documents with expiry alerts
- Payout history with commission breakdown
- Message threads from buyers

### Admin Console (port 3002)
- Platform KPIs (GMV today/month/year, active sellers, etc.)
- **Pending Seller Review** — one-click approve/reject with reason
- Seller detail with document review panel (approve/reject each doc)
- Product moderation queue
- Compliance document review
- All platform orders view

---

## Architecture

```
manzil/
├── apps/
│   ├── customer/         # Next.js 14 App Router, port 3000
│   ├── seller/           # Next.js 14 App Router, port 3001
│   └── admin/            # Next.js 14 App Router, port 3002
└── packages/
    ├── database/         # Prisma schema, migrations, seed, service layer
    ├── auth/             # NextAuth v5, JWT, role guards, portal middleware
    ├── types/            # Shared TypeScript types + Zod schemas
    ├── ui/               # Shared components (shadcn/ui-based)
    ├── utils/            # Currency, date, listing health utilities
    ├── config/           # Shared ESLint, Tailwind, TS configs
    └── email-templates/  # React Email templates (order, seller welcome, docs)
```

---

## Key Models

- **User** → roles: CONSUMER, COMPANY_ADMIN/BUYER/APPROVER, SELLER_OWNER/STAFF, ADMIN, SUPER_ADMIN
- **Company** → B2B buyer organisation with members, approval policies, POs
- **SellerProfile** → seller account with documents, payouts, warehouses
- **Product** → with ProductImage, ProductPrice (tiered B2B/B2C), ProductIssue, ListingHealthSnapshot
- **Warehouse → InventoryLocation → InventoryStock** → warehouse-ready inventory structure
- **RFQRequest** → B2B quote request with items, status workflow
- **MessageThread → Message** → buyer-seller conversation with admin visibility
- **SellerCustomer** → CRM model with tags and activity tracking
- **Order → OrderItem → Payment → Commission** → full financial audit trail
- **AuditLog** → all admin actions recorded

---

## Known TODOs (Stage 2+)

- [ ] Product create/edit form in Seller Central (foundation pages exist, form TODO)
- [ ] Elasticsearch product search (DB search works now; ES indexing service stubbed)
- [ ] Checkout.com payment integration (webhook handler built; hosted fields TODO)
- [ ] File upload to MinIO (upload API endpoint TODO)
- [ ] RFQ negotiation workflow (model + UI foundation exists)
- [ ] PDF VAT invoice generation (@react-pdf/renderer)
- [ ] WhatsApp notifications (Twilio adapter stub)
- [ ] 3PL warehouse integration
- [ ] Seller Reports page (recharts foundation in place)
- [ ] B2B purchase order approval workflow (models built)
- [ ] Admin user management page
- [ ] Mobile PWA for buyer

---

## Development Notes

- All money fields use `Decimal` (Prisma + PostgreSQL `DECIMAL(12,2)`)
- Service functions in `packages/database/src/services/` contain all business logic
- API route handlers call services, not DB directly
- Listing health is calculated and snapshotted in `ListingHealthSnapshot`
- Product issues are auto-generated and stored in `ProductIssue`
- Auth middleware per portal in `packages/auth/src/middleware.ts`
