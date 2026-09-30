# RFQ to Purchase Order — Module Control Record

## Executive gate

- **Module:** Invited multi-supplier RFQ → quote comparison → award → draft purchase order
- **Gate:** BLOCKED — implementation complete; environment evidence pending
- **Baseline:** `d192f26ea4d76beab131b2c1d7b646ee78f465a4`
- **Candidate:** `c391bfc56067af1adc6b27ae9c1beab514f8e557`
- **Branch:** `feat/revenue-fountain-20260930`
- **Environment:** Local build/test environment without PostgreSQL, a browser-accessible localhost bridge, or an installed Chrome binary
- **Decision rationale:** The candidate implements the complete vertical slice and passes static, unit, contract, localization, and production-build gates. Acceptance is withheld because the PostgreSQL migration/trigger scenarios and the authenticated buyer/seller journey have not run in real infrastructure.
- **Next controlled action:** Run candidate `c391bfc` through one PostgreSQL-and-headed-Chrome evidence job covering migration, two-supplier quoting, award concurrency, exact draft-PO persistence, and buyer/seller UI receipts.

## Scope and baseline

### Business outcome

An authorized company buyer invites multiple suppliers, receives isolated and comparable quotations, awards one valid quote, and receives exactly one linked draft purchase order containing the accepted commercial terms without catalogue repricing.

### In-scope roles

- `COMPANY_BUYER`: create and award their own RFQ.
- `COMPANY_ADMIN`: create and award company RFQs.
- `COMPANY_APPROVER`: read sourcing records and approve a later purchase order; cannot originate or award in Wave 1 unless they are the requester.
- `SELLER_OWNER` / authorized `SELLER_STAFF`: view invitations and submit, revise, or withdraw their own seller's quote.
- Platform administrators: operational visibility without mutating supplier commercial terms.

### Critical journeys

1. Buyer creates an invitation-scoped RFQ for two active suppliers.
2. Both suppliers submit complete quotes without seeing or overwriting each other's terms.
3. A supplier submits a revision; the prior version becomes immutable history.
4. Buyer compares current quotes and awards one valid version.
5. Award atomically creates one exact, linked `DRAFT` purchase order and closes competing offers.
6. Retry, stale-version, expiry, permission-revocation, cross-company, cross-seller, and concurrent-award paths fail safely.

### CTO data-contract decisions

- Add only three lifecycle tables: `RFQSupplierInvitation`, `RFQQuote`, and `RFQQuoteItem`.
- Keep buyer requirements on `RFQRequest` / `RFQItem`; never store supplier prices on the shared requirement after cutover.
- Invitations are the default visibility boundary. Open marketplace tendering is not part of Wave 1.
- Quote revisions are append-only. Awarded commercial fields cannot be edited or deleted.
- Every quote item maps to an active product, and optional variant, owned by the quoting seller.
- Freight, VAT, validity, lead time, payment terms, and totals are structured and calculated server-side.
- `PurchaseOrder.sourceRfqQuoteId` is unique and is the award idempotency/provenance anchor.
- Accepted terms are copied to a draft PO; current catalogue prices never replace them.
- Legacy single-supplier columns remain only through expand/backfill/cutover and will be removed in a later contract migration.

### Explicit Wave 1 exclusions

- Partial or split awards
- Public tender broadcasting
- Supplier discovery/recommendation ranking
- File attachments and certificate exchange
- Counteroffers and chat redesign
- Supplier decline and quote withdrawal actions
- ERP dispatch
- Submission, approval, or placement of the quote-sourced draft PO

## Acceptance criteria and traceability

| Requirement | Planned tests | Current result | Gate effect |
| --- | --- | --- | --- |
| Two invited suppliers can quote independently | PostgreSQL integration suite | AUTHORED; SKIPPED — no `DATABASE_URL` | Blocking |
| Only latest seller revision is actionable; history remains immutable | PostgreSQL integration suite + migration triggers | AUTHORED; SKIPPED — no PostgreSQL | Blocking |
| Seller and company isolation is enforced server-side | Service checks, scoped DTOs, seller/customer suites | PASS in static/unit gates; real DB proof pending | Blocking |
| Quote covers every RFQ line and uses seller-owned catalogue items | Service validation + PostgreSQL integration suite | AUTHORED; real DB proof pending | Blocking |
| VAT, freight, validity, delivery, and total are authoritative | Decimal service calculation + exact-snapshot triggers | PASS in type/build gates; trigger proof pending | Blocking |
| Concurrent award produces one winner and one draft PO | PostgreSQL concurrent-award scenario | AUTHORED; SKIPPED — no PostgreSQL | Blocking |
| Award retry returns the existing PO; stale or different award conflicts | PostgreSQL integration suite | AUTHORED; SKIPPED — no PostgreSQL | Blocking |
| PO commercial snapshot exactly equals accepted quote | PostgreSQL integration suite + migration guards | AUTHORED; SKIPPED — no PostgreSQL | Blocking |
| Buyer and seller complete critical paths in headed Chrome | Buyer Deal Ledger and seller composer | BLOCKED — browser rejected localhost; no Chrome binary | Blocking |

## Findings register

| ID | Severity | Observed fact | State | Owner / next action |
| --- | --- | --- | --- | --- |
| RFQ-001 | High | First-supplier claim prevented competition. | IMPLEMENTED | Invitation-scoped quotes replace claim behavior for the new path. |
| RFQ-002 | High | Requotes overwrote shared RFQ lines. | IMPLEMENTED | Append-only quote revisions and immutable quote items added. |
| RFQ-003 | High | Quote acceptance created no purchase order. | IMPLEMENTED | Award now atomically creates one quote-linked `DRAFT` PO. |
| RFQ-004 | High | Award authority was not transactionally current. | IMPLEMENTED | Current company actor and role are revalidated inside the transaction. |
| RFQ-005 | High | RFQ creation dropped catalogue identity. | IMPLEMENTED | Product identity is retained; submitted lines require seller-owned mappings. |
| RFQ-006 | Medium | Commercial terms were unstructured. | IMPLEMENTED | VAT, freight, validity, lead time, payment days, and totals are structured. |
| RFQ-007 | Medium | Buyer lacked comparison and confirmation. | IMPLEMENTED | Deal Ledger, comparable totals, exact-version confirmation, and PO receipt added. |
| RFQ-008 | Medium | Seller form was price-only. | IMPLEMENTED | Invitation-scoped versioned composer with catalogue mapping and terms added. |
| RFQ-009 | High | Legacy RFQ messages are not invitation-scoped and could mix supplier conversations. | CONTAINED | Buyer Deal Ledger does not project or render messages; redesign remains excluded. |
| RFQ-010 | Blocker | Raw migration, triggers, concurrency, and headed-browser journey lack executable infrastructure here. | OPEN | Resolve through the single evidence job named above. |

## Review summaries

### SDET

The target workflow now has a PostgreSQL integration suite covering two sellers, revision/replay, isolation, one-winner concurrency, exact PO snapshots, notification privacy, immutability, and rollback. The suite is intentionally skipped without a real PostgreSQL URL; no in-memory substitute is counted as evidence.

### Domain consultant

The target requires separate request and supplier-quote lifecycles, invitation confidentiality, immutable revisions, explicit validity/delivery/tax/freight terms, and a governed award. Declining one supplier's offer must not reject the RFQ.

### Enterprise consultant

The purchase-order governance, seller permission fence, advisory locks, audit model, and design system are reusable. A parallel PO engine or decorative comparison screen would create material control risk and is prohibited.

### Technical risk

The migration must use expand/backfill/cutover/contract. Historical quotes may be preserved as legacy, non-orderable snapshots where product mapping is missing. PostgreSQL constraints, partial unique indexes, and immutability triggers are required in addition to service validation.

## Gate checklist

- [x] Exact baseline and branch identified
- [x] Critical criteria mapped to planned tests
- [x] Expand migration and Prisma model implemented
- [ ] Raw migration and trigger behavior validated against PostgreSQL
- [ ] Multi-supplier service tests pass against PostgreSQL
- [x] Cross-company and cross-seller isolation implemented and statically tested
- [ ] Buyer and seller headed-browser journeys pass
- [ ] Accepted quote and draft PO persistence evidence captured from PostgreSQL
- [x] No known open Critical implementation defect remains

## Program ledger

| Order | Module | Last candidate | Gate | Open blockers | Next action |
| --- | --- | --- | --- | --- | --- |
| 1 | Invited RFQ → quote → award → draft PO | `c391bfc56067af1adc6b27ae9c1beab514f8e557` | BLOCKED | RFQ-010: real PostgreSQL and headed-Chrome evidence | Run the single deployment-candidate evidence job. |

## Verification evidence

- Prisma client generation: PASS.
- Repository typecheck: PASS, 5/5 tasks.
- Frontend route contracts: PASS; customer 254, seller 130, admin 148 destinations checked.
- Lint: PASS for customer, seller, and admin; only pre-existing font-loading warnings remain.
- Customer suite: PASS, 807 tests; 11 environment-gated tests skipped.
- Seller suite: PASS, 64 tests; 11 environment-gated tests skipped.
- Focused database suite: PASS, 4 portable tests; 7 PostgreSQL scenarios skipped.
- Customer production build: PASS, 60 routes generated.
- Seller production build: PASS, 36 routes generated.
- Headed-browser attempt: BLOCKED. Browser returned `ERR_BLOCKED_BY_CLIENT` for localhost.
- Local Playwright fallback: BLOCKED. Chrome download returned a zero-byte/truncated archive.
- PostgreSQL evidence: BLOCKED. `DATABASE_URL`, PostgreSQL, Docker, and `psql` are unavailable in this environment.
