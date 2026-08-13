# Pilot Stabilization Evidence

## Decision

**EXTERNAL-BLOCKED — internal P0/P1 closure is complete; keep PR #4 draft until hosted gates pass.**

The last code candidate certified before this evidence-only commit was
`6625e65bfd670bf3aaf8ea39426e9d61061676a0`. The evidence commit necessarily changes the Git SHA;
the exact pushed SHA, hosted checks, and deployment URLs must therefore be recorded on PR #4 after
CI and deployment complete.

## Exact-candidate repository gates

Run on 2026-08-13 against a newly created local PostgreSQL database:

- Prisma migration deployment: PASS (19/19 migrations)
- TypeScript: PASS (database, customer, seller, admin; 4/4)
- Lint: PASS (customer, seller, admin; 3/3)
- Full test matrix: PASS (228/228)
  - database 134, auth 40, customer 23, seller 23, admin 4, observability 4
- Production builds: PASS (customer, seller, admin; 3/3)
- Independent hostile board: ACCEPT (commerce/finance, marketplace/security, integration/SRE)

Expected negative-path logs (unique-key races, bounded invalid catalog values, and masked error
handling) appeared during tests; no test failed.

## Closed internal release boundaries

- Governed POs bind immutable policy and commercial evidence, revalidate current authority and
  commercial truth, force reapproval on changes, and recover crash windows without losing audit.
- Generic checkout rejects free-form B2B/PO placement. Idempotency keys are SHA-256-bound to a
  canonical request and return 409 for payload mismatch.
- Checkout, seller/admin catalog writers, pilot imports, inventory, and fulfillment use a coherent
  company/user/seller/product/stock lock order with transactional current-state rereads.
- Promotion capacity/mode, payment webhooks, commissions, returns/refunds, payout settlement, and
  seller receivables are replay-safe, monotonic, seller-scoped, and concurrency-tested.
- Platform admin, company, and seller mutations revalidate the real actor under durable revocation
  fences; staff capabilities and multi-seller projections are enforced at service and page/API
  boundaries with actor audit evidence.
- Integration outbox/inbox processing has leases, fencing, heartbeat, retries, DLQ/redrive,
  readiness metrics, deployed worker topology, deterministic certification adapters, and signed
  inbound processing.
- ERP order routing is explicit company-to-connection governance. Connection metadata/status and
  order binding serialize under shared locks and fail closed on missing, ambiguous, inactive, or
  unresolved routes.
- Inbound ERP authentication uses a deployment-owned per-connection keyring. The signed key ID,
  system, and connection binding—not a caller-selected connection ID—authorize each event.
- Public catalog DTOs minimize operational data, preserve authoritative variant/channel/currency/
  VAT/MOQ facts, and remove fabricated discounts, ratings, availability, and shipping promises.

## Local Chrome evidence

Exact code was exercised in Chrome against a migrated and seeded PostgreSQL database:

- Customer catalog: PASS; real product cards, prices, availability, categories, and privacy DTOs
  rendered.
- B2B buyer: PASS; authenticated company purchase-order screen rendered governed status/actions.
- Seller fulfillment staff: PASS; landed on `/orders`, saw only Seller A's AED 105 share of the
  two-seller certification order, and direct catalog navigation was denied.
- Admin: PASS; authenticated dashboard rendered database-backed commerce and operational metrics.
- Automated PostgreSQL journeys additionally prove Seller A/Seller B line isolation, parent-state
  derivation, single inventory consumption, and exact staff actor attribution.

## Pilot catalog certification

The authorized normalized file was found locally at `/tmp/avenick-private/pilot-catalog-v1.json`.
It remains outside Git. Validation and atomic import into the designated local certification
database passed:

| Seller/brand | Products | Active + verified price | Draft/no price | Source stock |
|---|---:|---:|---:|---:|
| Mennekes | 176 | 176 | 0 | 0 |
| Plymouth | 81 | 81 | 0 | 0 |
| Eaton | 767 | 0 | 767 | 767 |
| BG Nexus | 55 | 55 | 0 | 0 |
| 3M | 71 | 71 | 0 | 0 |
| **Total** | **1,150** | **383** | **767** | **767** |

The import produced one atomic actor-attributed audit record. Eaton has no invented price and is
non-sellable. The source maps media metadata for 153 rows, but no protected object-storage
credentials were authorized; no media URL is certified and no confidential source data was
committed.

## Hosted and external gates

- PR #4 remains draft. Its remote head is still the older `6377a167...` until the reviewed branch
  is pushed.
- The older customer Vercel preview is READY but is not the current candidate. Older seller/admin
  checks include build-rate-limit failures and cannot certify this SHA.
- Chrome reached the existing customer alias, but it remained on `Loading...`; it is not reusable
  as deployed exact-head evidence.
- Exact-head customer, seller, and admin previews must each become READY at the same pushed SHA,
  followed by the required deployed Chrome login/catalog/cart/B2B/PO/payment/API journeys.
- Live D365/SAP credentials are not authorized. The deterministic adapter is certified and the
  runtime fails closed as `ERP_DISCONNECTED_PILOT`.
- Protected object-storage credentials are not authorized. Media upload/read/delete and broken-link
  checks remain external.
- Real card/mada/Apple Pay, messaging providers, and production observability provisioning require
  authorized third-party credentials and transaction evidence.

## Merge rule

Do not mark PR #4 ready or merge while exact-head CI, all three READY deployments, deployed Chrome,
and protected media/provider evidence remain incomplete. Internal code closure does not waive any
hosted or third-party gate.
