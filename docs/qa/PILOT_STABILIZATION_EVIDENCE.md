# Pilot Stabilization Evidence

## Decision

**NO-GO — do not merge or certify for production pilot.**

This record replaces the stale certification for `2b13d1a77a5b3a4276a526c21be8c4fba0ef68a0`.
The exact candidate SHA and hosted check URLs belong in the draft PR evidence comment because
committing this record changes the SHA under test.

## Repository-local gates

Run against PostgreSQL using the repository Docker Compose service:

- Prisma migration deployment: PASS (11 migrations, none pending)
- TypeScript: PASS for database, customer, seller, and admin packages
- Lint: PASS for customer, seller, and admin applications
- Focused security/commerce regressions: PASS
- Full repository test suites: PASS (database 44, auth 38, observability 4)
- Customer production build: PASS
- Seller production build: PASS
- Admin production build: PASS
- Mock payment mode during certification: DISABLED

These commands must be rerun after the final evidence commit. The resulting exact SHA and output
summary are posted to the PR; a green local run does not override a failed required hosted check.

## Chrome journey evidence

The local applications were exercised in Chrome against the seeded PostgreSQL database:

- Customer: login, catalog, product detail, cart quantity and server-checkout promotion messaging PASS
- B2B buyer: create server-priced PO and place the governed order PASS; the PO ended `ORDERED`
- Seller owner: login, dashboard, products, inventory, and seller-scoped orders PASS
- Admin: login, dashboard, integration truth, disabled AI, and protected catalog import PASS
- Seller staff capability journey: NOT RUN; the seed contains no staff identity/membership
- Multi-seller return journey: NOT RUN; the seed contains one seller
- Real pilot catalog/media journey: BLOCKED; no authorized client source dataset or media set was supplied

The local browser run created one disposable governed test PO/order in the local seed database.

## Corrected release-critical invariants

- Generic checkout cannot consume a governed PO; only the governed placement service can do so.
- Variant stock selection is exact and explicit 0% VAT is preserved.
- Promotion/coupon capacity and campaign budget checks are serialized in the order transaction.
- Payment webhooks bind signed event, attempt, order, gateway, amount, and currency; replay and late
  terminal transitions fail safely.
- Seller returns/refunds are seller-line scoped and concurrent duplicate refunds are serialized.
- Direct browser object upload presigning fails closed until an enforceable storage policy exists.
- Seller staff APIs require named capabilities for sensitive reads and quote submission.
- Pilot catalog apply is atomic, bounded, audited, and rejects foreign-SKU ownership collisions.
- Unsupported live, AI, support-ticket, escrow, promotion, and operational-success claims were removed
  or relabeled.

## Merge blockers

### P0 — required before certification

1. **Hosted deployments are not green.** The prior PR run failed the database typecheck and all
   Vercel checks; seller/admin hosted deployment URLs were unavailable. A successful deployment and
   Chrome run against the deployed candidate are required.
2. **ERP transaction delivery is absent.** Durable outbox/inbox primitives exist, but no worker,
   provider adapter, or scheduled consumer claims and delivers messages. There is no recorded
   D365/SAP/generic handshake or accepted/rejected transaction pair. Pilot status is therefore
   `ERP_DISCONNECTED_PILOT`, not ERP-certified.
3. **Real catalog and media evidence is absent.** The repository seed is synthetic and contains 20
   products. Certification requires the authorized approximately 1,150-product source dataset,
   deterministic import report, and object-storage write/read/delete and broken-media checks.

### P1 — required before production-pilot certification

1. Purchase-order approval still needs an immutable governing-policy/commercial snapshot and an
   atomic conditional approve/reject transition, including forced reapproval when governed facts
   change.
2. Checkout idempotency keys are not bound to a request fingerprint; a reused key with a different
   body can return the first order instead of a conflict.
3. Integration leases need worker ownership/fencing, conditional completion/failure, and inbound
   claim/retry/dead-letter processing. Integration identifiers also lack relational constraints.
4. Product bulk mutations and shipment events do not consistently retain structured actor evidence.
5. Readiness/observability deployment evidence is missing: hosting probes use liveness, shared Redis
   is not configured, and monitor/alert/OTLP provisioning has not been demonstrated.
6. The required seller-staff and multi-seller browser journeys need representative test identities
   and data, followed by deployed Chrome evidence.

## External dependency matrix

| Capability | Certification state | Required evidence |
|---|---|---|
| Card/mada/Apple Pay | Blocked | Real outbound session, signed callback, approved/declined/replay cases |
| Bank transfer | Repository path available | Deployed lifecycle and reconciliation evidence |
| Object storage | Blocked | Enforced upload policy plus write/read/delete probe |
| Email/SMS/WhatsApp | Not configured | Provider health and delivery evidence |
| ERP | Disconnected | Handshake plus accepted/rejected transaction evidence |
| Search | Database fallback | Optional provider health if external search is enabled |
| Redis | In-memory fallback | Shared service required for multi-instance rollout |

## Certification rule

No PR is mergeable while any P0/P1 item above remains open or any required CI/deployment check is
red. Repository-local PASS results prove only the code gates that were actually run; they do not
constitute hosted, catalog, media, payment-provider, ERP, or observability certification.
