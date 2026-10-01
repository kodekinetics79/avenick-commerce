# RFQ to Purchase Order — Module Control Record

## Executive gate

- **Module:** Invited multi-supplier RFQ → quote comparison → award → draft purchase order
- **Gate:** ACCEPTED
- **Baseline:** `37e59b8be7e6a37e7eb2fa397fe0ca88c178f933`
- **Candidate:** `21acde6b38f6e55e07860e6abc22faf2d8d89614` (`main`)
- **Evidence head:** `1bd6bedcce91e7d4b18d9faf28a06f5e5b3bba5b`; tree-equivalent to the squash-merged candidate (`ee81a60c1cc61e087ae82d00dad63f5af7bbff9b`)
- **Environment:** GitHub Actions Ubuntu runner, PostgreSQL service container, headed Chromium under Xvfb, deterministic `seed` personas, 1440 × 1000 viewport; production deployments on Vercel in `iad1`
- **Decision rationale:** All critical acceptance criteria now map to passing PostgreSQL or headed-browser evidence. The real buyer/seller interface completed the two-supplier RFQ, revision, comparison, award, and one-draft-PO journey; scoped API assertions proved supplier isolation and persisted state. No Critical or High finding remains open. The exact merged SHA is READY in all three production projects and each `/api/ready` probe reports database, migrations, and integration checks healthy.
- **Next controlled action:** Start the next revenue module. Preserve this suite as the RFQ regression and release gate; rerun it when RFQ authorization, tenancy, workflow, or schema surfaces change.

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
| Two invited suppliers can quote independently | PostgreSQL integration suite + `RFQ-E2E-001` | PASS | Satisfied |
| Only latest seller revision is actionable; history remains immutable | PostgreSQL integration suite + migration triggers + `RFQ-E2E-001` | PASS | Satisfied |
| Seller and company isolation is enforced server-side | Service checks, scoped DTOs, authenticated isolation suite, `RFQ-E2E-001` | PASS | Satisfied |
| Quote covers every RFQ line and uses seller-owned catalogue items | Service validation + PostgreSQL integration suite | PASS | Satisfied |
| VAT, freight, validity, delivery, and total are authoritative | Decimal service calculation + exact-snapshot triggers | PASS | Satisfied |
| Concurrent award produces one winner and one draft PO | PostgreSQL concurrent-award scenario | PASS | Satisfied |
| Award retry returns the existing PO; stale or different award conflicts | PostgreSQL integration suite | PASS | Satisfied |
| PO commercial snapshot exactly equals accepted quote | PostgreSQL integration suite + migration guards + `RFQ-E2E-001` persistence artifact | PASS | Satisfied |
| Buyer and seller complete critical paths in headed Chrome | `RFQ-E2E-001`, Buyer Deal Ledger and seller composer | PASS | Satisfied |

## Findings register

| ID | Severity | Observed fact | State | Owner / next action |
| --- | --- | --- | --- | --- |
| RFQ-001 | High | First-supplier claim prevented competition. | CLOSED | Invitation-scoped quotes and the two-supplier browser journey prove competition. |
| RFQ-002 | High | Requotes overwrote shared RFQ lines. | CLOSED | Append-only revisions, immutability checks, and Seller A revision 2 passed. |
| RFQ-003 | High | Quote acceptance created no purchase order. | CLOSED | Award persisted exactly one quote-linked `DRAFT` PO. |
| RFQ-004 | High | Award authority was not transactionally current. | CLOSED | Transactional role revalidation and permission tests passed. |
| RFQ-005 | High | RFQ creation dropped catalogue identity. | CLOSED | Product identity and seller-owned mapping validation passed. |
| RFQ-006 | Medium | Commercial terms were unstructured. | CLOSED | Structured terms, server totals, and exact snapshots passed. |
| RFQ-007 | Medium | Buyer lacked comparison and confirmation. | CLOSED | Deal Ledger, comparison, confirmation dialog, and receipt passed in headed Chrome. |
| RFQ-008 | Medium | Seller form was price-only. | CLOSED | Versioned catalogue-aware quote composer passed for two sellers. |
| RFQ-009 | High | Legacy RFQ messages are not invitation-scoped and could mix supplier conversations. | CLOSED FOR WAVE 1 | Messages remain excluded and are not projected or rendered in the accepted workflow. |
| RFQ-010 | Blocker | PostgreSQL and headed-browser evidence was unavailable. | CLOSED | PostgreSQL CI and headed-Chromium certification completed successfully. |

## Review summaries

### SDET

The PostgreSQL suite and the guarded headed-Chromium journey passed in CI. The evidence covers two sellers, revision/replay, scoped seller visibility, one-winner concurrency, one exact PO snapshot, notification privacy, immutability, rollback, and the real interface from RFQ creation through the PO register. The broader authenticated project retains one generic data-dependent skip, but the module-specific cross-seller isolation assertion passed against the RFQ created in the same certification run.

### Domain consultant

The accepted workflow preserves separate request and supplier-quote lifecycles, invitation confidentiality, immutable revisions, explicit delivery/tax/freight/payment terms, and a governed award. Awarding one supplier closes competing offers without rejecting or corrupting the RFQ.

### Enterprise consultant

The purchase-order governance, seller permission fence, advisory locks, audit model, and design system are reusable. Production readiness confirms the database and migrations match the deployed candidate. A parallel PO engine or client-only comparison path remains prohibited.

### Technical risk

The migration followed expand/backfill/cutover discipline and passed against PostgreSQL. Contract removal of legacy single-supplier columns remains a later, separately gated change. Historical quotes may remain legacy, non-orderable snapshots where product mapping is missing.

## Gate checklist

- [x] Exact baseline and branch identified
- [x] Critical criteria mapped to planned tests
- [x] Expand migration and Prisma model implemented
- [x] Raw migration and trigger behavior validated against PostgreSQL
- [x] Multi-supplier service tests pass against PostgreSQL
- [x] Cross-company and cross-seller isolation validated server-side
- [x] Buyer and seller headed-browser journey passes
- [x] Accepted quote and draft PO persistence evidence captured
- [x] No known open Critical implementation defect remains

## Program ledger

| Order | Module | Last candidate | Gate | Open blockers | Next action |
| --- | --- | --- | --- | --- | --- |
| 1 | Invited RFQ → quote → award → draft PO | `21acde6b38f6e55e07860e6abc22faf2d8d89614` | ACCEPTED | None | Preserve as regression; begin the next revenue module. |

## Verification evidence

### `RFQ-E2E-001` — two-supplier RFQ award creates one draft PO

- **Requirement / finding IDs:** RFQ-001, RFQ-002, RFQ-003, RFQ-007, RFQ-008, RFQ-010; all critical acceptance rows above.
- **Candidate / deployed build:** evidence head `1bd6bedcce91e7d4b18d9faf28a06f5e5b3bba5b`; squash candidate `21acde6b38f6e55e07860e6abc22faf2d8d89614`; identical tree `ee81a60c1cc61e087ae82d00dad63f5af7bbff9b`.
- **Environment:** GitHub Actions Ubuntu; PostgreSQL service; headed Chromium under Xvfb; 1440 × 1000; company admin, Seller A owner, Seller B owner; deterministic `seed` tenant/personas.
- **Preconditions:** migrations applied; catalogue and six personas seeded; all three portals built and started; real login form used to establish sessions.
- **Steps:** buyer creates RFQ and invites two suppliers; both invitations are confirmed; Seller A submits and revises; Seller B is denied Seller A's quotes and submits its own; buyer compares two current quotes and awards Seller B; customer API and PO register are checked.
- **Expected / actual:** exactly two current supplier quotes, one accepted quote, one linked `DRAFT` PO, and one PO-register row. Actual matched expected; supplier isolation returned an empty Seller B quote projection before its submission.
- **Result:** PASS.
- **Artifacts:** GitHub Actions run `36755211329`, job `110026842910`, artifact `browser-journey-evidence` (`11117131524`), SHA-256 `e370f2ba16534a519a8fb7a11034f424bae8f036eb7344406a0105466432257d`. The artifact contains RFQ creation, both supplier submissions, Seller A revision 2, buyer comparison, award receipt, PO-register screenshots, and `rfq-to-po-persistence.json`.
- **Timestamp:** 2026-09-30 18:14 UTC.
- **Limitations:** the mutating journey is intentionally restricted to a disposable loopback environment. Production verification is non-mutating readiness and deployment provenance, not a production purchase-order write.

### CI and production release evidence

- PR #56 CI run `36725143451`: migrations, unit/integration tests, route contracts, builds, authenticated boundary journeys, and browser evidence all passed against PostgreSQL; artifact `11103626226`, SHA-256 `ab3851f1a9a908b587df8db4b68a34fa116085a5c9304a79c3a7a45bebbae455`.
- PR #57 CI run `36755211329`: `Typecheck, lint, test, build` and `Browser journey evidence` passed. The browser job applied migrations, seeded personas, built and started all portals, then ran the authenticated isolation and RFQ-to-PO certification in headed Chrome.
- Production commit checks: customer, seller, and admin Vercel statuses are successful for `21acde6b38f6e55e07860e6abc22faf2d8d89614`.
- Production deployments: customer `dpl_DjTt1PzqdWJG7Gm1nSU3CpQRTRMc`, seller `dpl_5bqeDwcUcbcWtWuWCFRFjp9RqSgg`, admin `dpl_2tQNL2LEHCiLFW9yTwFFubNdAeGC`; all are `READY`, target `production`, region `iad1`, with no alias error.
- Production readiness at 2026-10-01 12:34 UTC: customer, seller, and admin `/api/ready` returned HTTP 200 with `status=ready` and database, migrations, and integration checks all `ok=true`.
