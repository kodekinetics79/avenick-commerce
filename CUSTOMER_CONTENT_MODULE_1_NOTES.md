# Customer Content — Module 1 Evidence

## Workstream

- Branch: `feature/app-content-design`
- Worktree: `/Users/zackkhan/manzil-content`
- Current feature: `C01-CONTENT-FOUNDATION-AND-SAFETY`
- Status: complete with documented product, legal, accessibility, and localization follow-up work

## Delivered

- Created the application-wide content design system and controlled English/Arabic terminology.
- Reworked and extended the customer message catalogs while preserving structural parity and ICU variables.
- Replaced unsupported homepage volume, supplier, partner, verification, escrow, refund, logistics, AI, quote-count, and time-saving claims with capability-led language.
- Removed hardcoded homepage supplier/product/company counts and the unsupported partner marquee.
- Removed exposed seeded login credentials and improved login label/error semantics.
- Disabled fabricated deals, reference prices, discounts, countdown scarcity, and daily-reset claims. The localized route now states only that promotions are not currently available.
- Removed fabricated rating defaults from product cards and product detail plus the unverified “Fast” delivery label. Ratings render only when a real non-zero review aggregate exists.
- Localized wishlist action labels and made them accessible names.
- Removed unsupported RFQ review/response SLAs and guaranteed supplier-distribution or order-conversion outcomes.
- Softened unsupported business-registration and brand/seller reach/verification claims.

## Validation

- English and Arabic catalogs parse as JSON.
- English and Arabic catalogs contain the same 137 leaf keys.
- No missing or extra bilingual keys.
- Customer TypeScript: passed.
- Customer ESLint: passed with zero warnings.
- Customer production build: passed; it retained the repository&apos;s existing caught missing-`DATABASE_URL` log while exporting `/api/brands`.
- `git diff --check`: passed.

## Claims registry and release ownership

| Claim family | Current status | Required owner/evidence before use |
|---|---|---|
| Marketplace counts and growth metrics | Removed from rendered homepage | Commercial analytics owner; source query and effective date |
| Supplier verification/KYC badges | Generic claims removed in edited surfaces | Compliance owner; defined verification state and scope |
| Discounts/reference prices | Fabricated deals disabled | Pricing owner; authoritative promotion model, validity, eligibility, reference-price provenance |
| Delivery speed, coverage, tracking, free shipping | Removed from edited global/product-card copy | Fulfilment owner; destination-aware quote and carrier data |
| RFQ response time and supplier participation | Guarantees removed | Marketplace operations; measured SLA and eligibility rules |
| Ratings/reviews | Fabricated defaults removed | Reviews service; non-zero published aggregate and count |
| Escrow, refunds, credit terms, binding offers | Legal pages still require review | Legal, payments, finance, and product owners |
| Privacy compliance, hosting, cookies, analytics | Legal pages still require verification | Privacy counsel and security/data-flow owner |

## Blocking follow-up features

1. `C02-AUTHORITATIVE-COMMERCE-SUMMARY`: server-owned cart/checkout quote for price, VAT, shipping, promotions, currency, and expiry. Current hardcoded cross-GCC totals must not be treated as authoritative.
2. `C03-CUSTOMER-I18N-EXTRACTION`: migrate the remaining hardcoded UI. Only 7 of 52 customer TSX files currently import `next-intl`; English/Arabic catalog parity alone is not end-to-end localization.
3. `C04-CONTENT-ACCESSIBILITY`: repair invalid nested product-card interactions, account-menu keyboard behavior, form labels, live errors, reduced-motion loading, and empty/error recovery.
4. `C05-ERROR-CONTRACTS`: replace raw exception messages with stable localized error codes and server-side reference IDs.
5. `C06-LEGAL-CONTENT-RECONCILIATION`: counsel review of terms, privacy, and cookie content against actual payments, hosting, analytics, consent, KYC, credit, fulfilment, and returns behavior.
6. `C07-SEO-METADATA`: localized, data-backed metadata and structured data for public catalog routes; `noindex` policy for private/search surfaces.
7. `C08-DEAD-CTA-CLEANUP`: implement or remove newsletter, social, invoice, attachment, filter, and other controls that currently promise unavailable behavior.

## Phase boundary

This feature establishes the content system and removes immediate unsafe or fabricated content. It does not claim that the entire customer app is localized, legally approved, accessible, or commercially authoritative. Seller and administrator content modules should begin only after the customer safety-critical follow-up slices are scheduled and owned.
