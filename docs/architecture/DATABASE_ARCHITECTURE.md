# Database architecture

Status: active engineering contract  
Owner: platform engineering  
Primary store: PostgreSQL through Prisma

## Purpose

The database is the commercial system of record for a three-sided marketplace:
buyers and companies, sellers, and platform operators. It favors explicit
business records and immutable commercial evidence over a small number of
overloaded tables. "Lean" here means one authoritative owner for each fact,
bounded growth, and no speculative duplication—not an arbitrary table limit.

## Domain boundaries

| Domain | Authoritative records | Invariant |
| --- | --- | --- |
| Identity and access | `User`, sessions, memberships | Identity is global; capabilities are resolved at the company or seller boundary. |
| Seller and catalog | seller profiles, products, variants, documents | A sellable SKU belongs to one seller and its approval state is explicit. |
| Inventory | locations, stock, reservations, adjustments | Available stock is derived from an audited ledger; external availability is evidence, not inventory. |
| Buyer and company | companies, memberships, addresses, requisitions | Company purchasing authority is checked server-side. |
| Commerce | carts, orders, order items, payments, refunds, returns | Accepted prices, taxes, and terms are snapshotted so history cannot drift. |
| B2B procurement | RFQs, purchase orders, approvals | Commercial decisions are versioned and attributable. |
| Marketplace finance | commissions and payouts | Money uses fixed-precision decimals and is never silently converted across currencies. |
| Growth and service | promotions, referrals, reviews, support | Eligibility, redemption, and trust claims have auditable source records. |
| Integrations | connections, links, inbox, outbox, snapshots | External systems are retryable and idempotent; local acceptance is distinct from ERP acceptance. |

## Structural rules

1. **Relational first.** Stable searchable business attributes are typed
   columns with constraints. JSON is reserved for source payloads, immutable
   explanations, optional provider metadata, or deliberately versioned
   snapshots. Code must parse JSON through a named boundary type.
2. **One ledger per fact.** Inventory, payment, commission, payout, and
   promotion redemption records are not mirrored in convenience tables.
   Read models are derived by query or bounded snapshots.
3. **Money stays exact.** Monetary values use `Decimal`; a currency is stored
   on every independent monetary aggregate. Cross-currency totals may not be
   presented without an explicit conversion source and timestamp.
4. **History stays truthful.** Orders and governed purchase orders retain
   commercial snapshots. Later catalog, tax, or integration changes cannot
   rewrite what a buyer accepted.
5. **Relations are indexed.** Every foreign key used for parent deletion or
   direct lookup must have an index with that key as its leading column.
   Composite tenant indexes do not replace a relation-leading index when code
   queries by the relation alone.
6. **Transactions are short.** Transactions protect a single commercial
   decision. Network calls run outside them; integration work is handed to the
   transactional outbox and processed idempotently.
7. **Hot streams are bounded.** High-volume behavior is aggregated into
   bounded signals such as `ProductViewSignal`. A raw event stream needs an
   owner, retention policy, partitioning plan, and an ADR before it enters the
   primary database.
8. **Sensitive fields are encrypted at the application boundary.** Banking
   details are stored as versioned AES-GCM envelopes using the configured PII
   key ring. New writes fail closed when no active key exists; legacy plaintext
   is read only for controlled backfill and must not be emitted to logs or
   audit payloads.

## Tenancy and authorization

The current application is a shared-schema marketplace. `sellerId` and
`companyId` are the primary business isolation boundaries; `tenantKey` fences
external integration namespaces. Authorization is enforced in server services
by resolving the current actor and membership inside the transaction that
writes the business record.

PostgreSQL row-level security is not currently the source of truth. It must not
be partially enabled: pooled connections and background workers require a
complete session-context design. Moving a domain to RLS therefore requires an
ADR, integration tests for every role and worker, and a fail-closed connection
policy. Until then, every seller- or company-scoped service must take the scope
explicitly and have cross-tenant denial tests.

## Change gate

A new table or JSON field is approved only when its pull request states:

- owning domain and service;
- authoritative source and deletion/retention policy;
- tenant or marketplace scope;
- uniqueness, foreign-key, and state-transition invariants;
- expected read/write paths and their indexes;
- migration and rollback behavior;
- whether the record is mutable state, an immutable snapshot, or an event.

Prefer extending an existing aggregate when ownership and lifecycle are the
same. Create a new table when cardinality, lifecycle, permissions, or audit
requirements differ. Names such as `V2`, `New`, `Copy`, and `Legacy` are not
acceptable substitutes for a migration plan.

## Scaling path

- Use composite indexes that match real filters and ordering; confirm with
  `EXPLAIN (ANALYZE, BUFFERS)` against production-like data.
- Paginate operational lists with deterministic cursors; never load an
  unbounded ledger into a request.
- Add partial indexes for small active queues only after measuring the query.
- Archive or partition append-only evidence by time when measured volume
  requires it; do not pre-partition low-volume tables.
- Read replicas and caches are disposable read acceleration. PostgreSQL remains
  authoritative for checkout, inventory reservation, approvals, and finance.

## Verification

Every schema change must pass Prisma validation and generation, migration
manifest checks, database integration tests on PostgreSQL, and an index/query
review for new access paths. Migrations are forward-only in deployed
environments; destructive changes use expand/backfill/contract phases.
