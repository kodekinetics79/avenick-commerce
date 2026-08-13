# Pilot Stabilization Evidence

## Decision

**CODE MERGE READY, pending final exact-evidence-SHA CI/deployment/Chrome confirmation. Pilot
activation remains externally blocked.**

The final code candidate certified before the release-evidence commits was
`68cd0be8e5c5b5470767aa5025035b076f7cfba2`. The first evidence-only head,
`83fa941ad5617b59f1e6ae2a4ffe840b6477bd93`, passed GitHub CI and reached READY on all three
Vercel projects. This document correction necessarily creates one final evidence-only SHA; its CI,
deployment IDs, and deployed smoke result are recorded on PR #4 after the checks finish. No source,
schema, migration, or runtime configuration changes are permitted in that final evidence commit.

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

## Hosted exact-head evidence

At evidence head `83fa941ad5617b59f1e6ae2a4ffe840b6477bd93`:

- GitHub CI run `31728462538`: PASS.
- Customer Vercel deployment `dpl_H4KWBY4nxgyL6hYE5o9TC89VZTxW`: READY; authenticated health
  response PASS.
- Seller Vercel deployment `dpl_43f7ekiv2aMTnsYb8BUh6ecBiD9g`: READY; authenticated health
  response PASS.
- Admin Vercel deployment `dpl_Hhe6FeGmJd93DJhVNd9Ag7GZMz8m`: READY; authenticated health
  response PASS.

Preview protection is an access control, not a product defect. Deployed Chrome certification must
use an authorized Vercel session or expiring share access and is recorded separately on the PR. A
READY status or health response alone is not represented as a completed browser journey.

## External capability classification

### Closed for code merge

- Internal P0: 0. Internal P1: 0. Independent commerce/finance, marketplace/security, and
  integration/SRE boards accepted the final code candidate.
- Migrations, typecheck, lint, tests, concurrency/security regressions, and all three production
  builds pass.
- Integration certification provider, durable worker/inbox/outbox lifecycle, signed per-connection
  ingress, company routing, readiness degradation, and DLQ/redrive paths pass.
- Unsupported or unprovisioned capabilities fail closed; no acceptance or transaction evidence is
  fabricated.

### Pilot-activation blockers

- **ERP:** no authorized live D365/SAP credentials or provider transaction evidence. Runtime mode is
  `ERP_DISCONNECTED_PILOT`; the deterministic certification provider passes. Do not claim live ERP
  acceptance.
- **Online payments:** bank transfer is supported. MOCK is pilot-only behind explicit environment
  gates. Card, mada, Apple Pay, and STC Pay remain disabled/fail-closed until real initiation,
  callback, settlement, and replay evidence exists.
- **Media:** no protected object-storage credentials or hosted object inventory is certified.
  Confidential assets remain outside Git. Products without certified media use the safe no-image
  state and must not emit invented or broken URLs.
- **Messaging:** production provider credentials are absent; messaging must remain disabled or
  fail closed if required by a pilot workflow.
- **Observability/operations:** application logs, correlation, health/readiness, and integration
  degradation signals exist. Vendor/account provisioning, alert delivery, backup recovery, and the
  production runbook drill remain activation evidence.

### Optional/post-pilot

- Payment methods and messaging channels not included in the signed pilot scope remain disabled.
- Broader media enrichment beyond the certified pilot product set is post-pilot.

## Merge rule

Mark PR #4 ready and merge without bypassing repository governance when the final evidence-only SHA
has green CI, all three exact-SHA Vercel deployments are READY, deployed core Chrome journeys pass,
and GitHub-required checks/reviews are satisfied. Live ERP, online-payment, messaging, observability,
and protected-media credentials are tracked as post-merge pilot-activation gates when their code
paths remain explicitly disabled/fail-closed.
