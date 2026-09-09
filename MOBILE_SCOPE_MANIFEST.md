# Mobile Scope Manifest — what is actually wired

**Status:** authoritative scope definition for the Flutter mobile programme.
**Method:** every claim below was established by searching for code that **creates** a
row, not code that reads one. A model with a rich schema and no creator is a table,
not a feature.
**Verified:** 5 September 2026, branch `feat/mobile-foundations`.

> **Why this file exists.** `packages/database/prisma/schema.prisma` is 1,922 lines and
> describes a far more complete business than the code implements. Anyone scoping
> screens from the schema will build against features that have no writer. Read this
> file first. If you are about to build a screen for something marked NO CREATOR or
> ABSENT, stop — you are building a screen for a table.

---

## How to re-verify

Counting *writer* calls per model, excluding `node_modules`:

```bash
grep -rn "\.<model>\.\(create\|createMany\|update\|updateMany\|upsert\|delete\)" \
  --include="*.ts" --include="*.tsx" apps packages | grep -v node_modules
```

A non-zero count is **not** proof of a feature. Read every hit and classify it:

- a `deleteMany({})` in `prisma/seed.ts` is **teardown**, not a writer
- an `updateMany({ isRead: true })` is **mark-as-read**, not a creator
- a `deleteMany` inside `services/data-rights.ts` is **erasure**, not a creator
- an `update` on a row nothing creates is a **dead code path**

Nested relation writes (`items: { create: [...] }`) do not match the pattern above.
Check those separately before concluding a model has no creator.

---

## Wired — build against these freely

| Capability | Writer calls | Notes |
| --- | ---: | --- |
| Orders + order items | 32 | `packages/database/src/services/orders.ts` |
| Purchase orders | 19 | create, approve, reject all wired |
| RFQ requests + items | 9 | see the constraint below |
| Returns | 5 | `services/customer-returns.ts`, nested item create |
| Support tickets | 3 | |
| Product reviews | 2 | |
| Requisition lists | 1 | `b2b/lists/actions.ts`, incl. reprice |
| VAT + freight composition | — | `composeOrderTotals`, `checkout-invariants.ts:264-290` |
| User erasure | — | `services/data-rights.ts:92` — see caveat below |

---

## No creator — the model exists, nothing writes a row

| Model | What the "writers" actually are | Consequence for mobile |
| --- | --- | --- |
| `Cart` / `CartItem` | `prisma/seed.ts:142-143` — `deleteMany({})` teardown only | **No server cart.** The real cart is `apps/customer/src/stores/cart.ts`, zustand + localStorage, with prices captured client-side. Add-on-phone / buy-on-laptop silently fails. |
| `Notification` | `apps/seller/.../notifications/route.ts:22-23` mark-as-read; `data-rights.ts:134` erasure delete | **No push substrate.** Nothing produces a notification, so order updates and approval requests — the two things that make a commerce app worth keeping installed — have no source event. |
| `Shipment` / `ShipmentEvent` | `apps/seller/src/app/shipments/actions.ts:23` `update`; `seed.ts:123` teardown | The seller portal **updates shipments that nothing creates**. No customer-visible tracking data exists. |
| `TaxInvoice` | `seed.ts:121` teardown only | Referenced on the order read path; never written. |
| `PaymentAttempt` | none at all | The Checkout.com webhook is well-built but **unreachable**: `services/payments.ts:68-69` requires a pre-existing attempt row. |
| `ReferralProgram` / `Code` / `Attribution` | admin campaign code only | Referral is not a shippable mechanic. |

---

## Absent — no model at all

| Thing | State | Needed for |
| --- | --- | --- |
| Wishlist | No `model Wishlist` in the schema. Client-side Zustand store only. | v1.5 |
| Phone / OTP identity | `User.phone` is `@unique` and `phoneVerified` exists, but there is **no OTP or verification-token model**. | v1 — GCC identity |
| Refresh tokens / device sessions | No model. Consequence: **sessions cannot be revoked.** `auth/password-reset/redeem/route.ts:118-123` states it plainly — JWT sessions "carry no server-side row and stay valid until they expire". | v1 — mobile auth |
| Device / push tokens | No model, no FCM or APNs wiring. | v1.5 |
| Search facets | `listProducts` is a tiered ILIKE (`services/products.ts:278-390`). Elasticsearch is marked `configured: false … notImplemented`. | v2 |

---

## Payments — fail-closed, by design

`apps/customer/src/app/api/orders/route.ts:155-160` returns **503** for `MADA`,
`APPLE_PAY`, `CREDIT_CARD` and `STC_PAY`, with the comment:

> A signed Checkout.com webhook already exists, but this repository does not yet
> contain a live payment-session creation flow. Fail closed rather than accepting a
> card-looking order that can never be charged.

Only `MOCK` (gated on `PILOT_MODE && ALLOW_MOCK_PAYMENTS`) and `BANK_TRANSFER`
complete. This is correct behaviour, not a bug — but it means **the mobile app cannot
take money until a payment-intent path exists.** `COD` is not in the `PaymentMethod`
enum at all.

---

## Account deletion — the service exists; the route does not

Correcting a common misreading: `eraseUserData` at `packages/database/src/services/data-rights.ts:92`
is real, thorough and covered by `data-erasure-governance-races.pg.integration.test.ts`.
It takes advisory locks in the global company → sorted-users order, hard-deletes
addresses / notifications / sessions, anonymises the identity in place with a tombstone
email, and — notably — reverts any `APPROVED` purchase order the erased user approved
back to `PENDING_APPROVAL` with an incremented `approvalVersion` and an audit log entry.

**The gap is narrower and more specific than "deletion doesn't exist":**

1. There is **no HTTP route**. `apps/customer/src/app/api/account/` contains only `data-export`.
2. It **requires an admin actor** — `["ADMIN","SUPER_ADMIN"].includes(actor.role)` — so it
   cannot serve a self-service request as written.

Apple requires in-app, self-service account deletion for any app with sign-up. Satisfying
that means either a self-actor path through the same governance, or a request-and-process
flow with an in-app status. Effort is **S/M** (expose and adapt), not **L** (build).

---

## Structural constraints that shape the UI

**RFQ is single-supplier.** `RFQRequest` carries one nullable `sellerId`; the quote is
written back in place via `RFQItem.unitQuoted` / `quoteVersion`. Multi-supplier quote
comparison **is not expressible in this schema**. Do not design a compare screen the data
cannot fill.

**An approved PO whose prices moved is no longer approved.** `PurchaseOrder` carries
`approvedCommercialFingerprint` and `approvalVersion`. Mobile needs a first-class
re-approval screen showing the diff — not a toast.

**Carts must not merge across channels.** `apps/customer/src/lib/cart-commercial.ts`
already refuses mixed B2B/B2C carts. Mirror that invariant client-side rather than
discovering it at checkout.

---

## Known trap

`calculateOrderTotal` in `packages/utils/src/currency.ts:96-105` is the **old** arithmetic
that does not tax shipping — precisely the defect fixed in PR #21.

It has **zero callers** — verified; the only hit for the symbol is its own definition. So it
is not a live defect, it is a **trap laid for the next person**, and the next person is
whoever writes the mobile checkout. Delete it.

Mobile must take totals from a server `/checkout/quote` endpoint backed by
`composeOrderTotals` and compute nothing locally.
