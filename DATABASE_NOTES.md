# Database Notes — Avenick Commerce

## Current Database

- **Engine**: PostgreSQL
- **Database name**: `avenick_db`
- **ORM**: Prisma (schema at `packages/database/prisma/schema.prisma`)
- **Connection**: `DATABASE_URL` environment variable

## Prisma Schema Overview

The schema includes 40+ models covering:
- Users, Sessions, AdminProfile
- Company, CompanyMember, ApprovalPolicy, PurchaseOrder (B2B)
- SellerProfile, SellerDocument, SellerPayout, SellerPayoutItem
- Category, Brand, Product, ProductImage, ProductVariant, ProductPrice
- ProductComplianceDocument, ProductIssue, ListingHealthSnapshot
- Warehouse, InventoryLocation, InventoryStock, InventoryMovement
- Cart, CartItem
- Address, Order, OrderItem, OrderStatusHistory
- Payment, Refund, Commission, TaxInvoice
- RFQRequest, RFQItem
- MessageThread, Message
- SellerCustomer, CustomerActivity
- Notification, AuditLog

## MySQL Decision: DEFERRED

**Decision**: PostgreSQL is kept for development. MySQL migration is deferred until pre-production.

**Rationale**:
- Prisma supports both PostgreSQL and MySQL with minimal schema changes
- The schema uses `@db.Decimal(x, y)` and `@db.Text` annotations — both compatible with MySQL
- No database rewrite was done in Phase 2 — frontend-first approach taken
- Rewriting the database mid-development introduces risk without benefit at this stage

## Migration Path to MySQL (when needed)

1. Export current schema: `prisma migrate dump`
2. Change `datasource db { provider = "mysql" }` in schema.prisma
3. Replace PostgreSQL-specific types:
   - `@db.Text` → `@db.Text` (MySQL compatible, no change)
   - `@db.Decimal(x,y)` → `@db.Decimal(x,y)` (MySQL compatible, no change)
   - `String[]` arrays → separate junction tables (MySQL has no native array support)
4. Run `prisma migrate dev` against a MySQL instance
5. Test all service functions and API routes

## Known Schema Considerations for MySQL

- `String[]` fields (e.g. `Product.tags`, `SellerProfile.bankDetails`) use PostgreSQL array syntax
- These would need to be converted to serialized JSON strings or junction tables in MySQL
- `Json` fields are compatible with both databases

## Phase 2 Database Changes

- **None**: No schema changes, no new migrations, no new Prisma queries in Phase 2
- All new features use mock data from `packages/database/src/mock-data.ts`
- Mock data file exports TypeScript constants — no DB connection required

## Seeding (Development)

If the database is empty, use the existing seed script (if present) or create test accounts directly via the registration APIs:

- Customer: `POST /api/auth/register/consumer`
- Business: `POST /api/auth/register/business`
- Seller: via seller onboarding flow
- Admin: manually set `role: ADMIN` in the users table

## Senior DB Audit (Avenick hardening pass)

### Applied
- **FK indexes** added where Postgres does not auto-index foreign keys:
  Product.brandId, ProductPrice.variantId, InventoryStock.variantId,
  OrderItem.productId, CartItem.productId, RFQItem.productId,
  SellerPayoutItem.orderId, Order.purchaseOrderId/addressId,
  PurchaseOrder.requesterId/approverId, InventoryMovement.createdAt.
- **Referential integrity**: Refund and TaxInvoice now have real FK relations
  to Order (previously bare string columns with no constraint).
- **Enums replace stringly-typed columns**: InventoryMovement.type →
  InventoryMovementType (IN/OUT/ADJUSTMENT/RESERVE/RELEASE); Refund.status →
  RefundStatus.
- **onDelete: Cascade** on owned children so a product/order/RFQ/payout can be
  removed without orphan rows (images, prices, variants, compliance, issues,
  health snapshots, inventory, order items, status history, payments, refunds,
  tax invoice, rfq items, payout items).
- **Migrations introduced**: replaced db-push-only workflow with a baseline
  Prisma migration + `prisma.seed` config; added `db:push` / `db:deploy`
  scripts. DB is reproducible via `prisma migrate reset`.
- **Env consolidation**: all env files now point at a single `avenick`
  Postgres role/database (previously three different credentials).

### Recommended next (not yet applied)
- Partial unique index on InventoryStock(productId, variantId, locationId) to
  prevent duplicate stock rows (needs raw SQL for NULL-safe semantics).
- Move money math to integer minor units or enforce rounding centrally.
- Add DB-level CHECK constraints (qty >= 0, reservedQty <= qty).
