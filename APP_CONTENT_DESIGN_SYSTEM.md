# Avenick App Content Design System

## Purpose

This system governs customer, seller, and administrator interface content. It prioritizes purchasing accuracy, confident task completion, bilingual parity, and verifiable claims over promotional volume.

## Audiences

1. Consumer buyer: wants fast discovery, clear price and availability, and a predictable checkout.
2. Business buyer: needs SKU accuracy, MOQ, lead time, quote and purchase-order clarity.
3. Business approver or administrator: needs status, ownership, thresholds, auditability, and safe decisions.
4. Seller operator: needs direct next actions for products, inventory, orders, compliance, and payouts.
5. Platform operator: needs unambiguous risk, exception, financial, and operational language.

## Voice

- Clear: name the object and the next action.
- Assured, not inflated: explain what the interface can verify now.
- Commercially precise: distinguish listed price, quoted price, estimated availability, and confirmed order terms.
- Calm under failure: explain what happened, what was preserved, and what the user can do next.
- Compact: front-load differentiating words; avoid repeated headings and filler.
- Respectful: never blame the user or describe routine states as errors.

## Content hierarchy

Every task surface should answer, in order:

1. Where am I?
2. What is the current state?
3. What matters commercially?
4. What can I do next?
5. What happens after that action?

## Controlled terminology

| Concept | English | Arabic | Guidance |
|---|---|---|---|
| SKU | SKU / item code | رمز الصنف | Preserve identifiers left-to-right. |
| RFQ | Request for quotation (RFQ) | طلب عرض سعر | Expand on first use in a journey. |
| Purchase order | Purchase order | أمر شراء | Use “PO” only after the full term appears. |
| MOQ | Minimum order quantity | الحد الأدنى لكمية الطلب | Do not imply it is enforced unless validated server-side. |
| Lead time | Lead time | مدة التوريد | Qualify as estimated unless contractually confirmed. |
| Availability | Available / Limited / Unavailable | متوفر / كمية محدودة / غير متوفر | Never use “in stock” unless inventory is authoritative. |
| Listed price | Listed price | السعر المعروض | Do not call it a customer price without entitlement data. |
| Quote | Quote | عرض سعر | A request is not a confirmed quote. |
| Approval | Pending approval / Approved / Rejected | بانتظار الموافقة / تمت الموافقة / مرفوض | State who acts next where known. |
| Delete | Delete | حذف | Reserve for destructive, non-recoverable actions. |
| Remove | Remove | إزالة | Use for reversible list/cart membership changes. |

## CTA rules

- Use verb + object: “Add to cart”, “Request a quote”, “Review order”, “Invite member”.
- A CTA must match the immediate result. Do not use “Continue” when the destination can be named.
- Do not display actionable styling for unavailable or unimplemented behavior.
- Destructive CTAs name the consequence and require confirmation where data is material.
- Sentence case is the default in both navigation and buttons.

## State-writing patterns

### Empty

`No [objects] yet.` Then explain how the first object appears or provide one valid action.

### Loading

Name the object: `Loading orders…`, not a generic `Please wait`.

### Error

Use: `[Object] could not be [action]. No changes were made. Try again or [alternative].`

Never show stack traces, raw provider messages, internal identifiers, or secrets.

### Success

Confirm the completed object and the next state: `Purchase order created. It is now pending approval.`

### Unavailable

Explain whether the state is temporary, unknown, or policy-controlled. Do not turn unknown inventory into “out of stock”.

## Claims governance

The UI may not assert these without an authoritative product or legal source:

- Seller counts, product counts, customer counts, ratings, or conversion statistics.
- “Verified”, “KYC checked”, “secure”, “escrow”, “insured”, or regulatory-compliance claims.
- Guaranteed refunds, delivery coverage, delivery speed, price savings, quote counts, or inventory.
- “Free shipping” thresholds unless calculated from the active fulfillment rules.
- Payment methods, credit terms, taxes, or discounts not returned by authoritative services.
- Physical office locations or contact identities not approved by the business owner.

Where evidence is unavailable, describe capability without the claim: `Compare eligible products and request quotes from participating suppliers.`

## Arabic and RTL

- Write natural Modern Standard Arabic suitable across the GCC; do not translate English structure word-for-word.
- Isolate Latin SKUs, order numbers, emails, currencies, and URLs with bidi-safe markup.
- Preserve semantic variables and ICU plural categories.
- Avoid unnecessary uppercase concepts, letter spacing, slash-separated bilingual labels, and mixed-language sentences.
- Keep camera, timeline, and numerical semantics functionally correct rather than mechanically mirrored.

## SEO and metadata

- Every indexable route requires a unique, factual title and description.
- Product metadata derives from authorized product data and must not promise stock or price stability.
- Account, checkout, company, and administrative routes should be non-indexable.
- Heading text and metadata should use the same primary task vocabulary.

## Module delivery order

1. Customer marketplace foundation and navigation.
2. Discovery, product, cart, checkout, account, and support journeys.
3. B2B procurement, RFQ, approval, purchase-order, team, billing, and analytics content.
4. Seller portal operations and compliance content.
5. Administrator operations, risk, finance, support, and governance content.

Each module ends with English/Arabic key parity, JSON/ICU validation, claims review, accessibility review, focused UI validation, and an evidence report.
