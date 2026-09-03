# Avenick Commerce — Gate 0 Containment Evidence Pack

**Prompt:** PROMPT 01 — Security and Truth Containment
**Date:** 17 August 2026
**Base SHA:** `803138cf80c28189a07b2728e22ab13a5579e936`
**Branch:** `main`
**Gate 0 verdict:** **NOT PASSED — objective 1 outstanding.** See §7.

---

## 1. Scope and honest limits

Objectives 2 and 4–12 were implemented. **Objective 1 (credential rotation, session
invalidation, audit-log inspection) was not executed** and is not executable from this
environment: it requires live identity and database access plus explicit authority, which
PROMPT 01 itself gates ("No production mutation until the credential/action target and
rollback are explicitly authorized"). It remains **BLOCKED**, owned by CIO/Security.

Two further limits, stated plainly:

- **No deployed-runtime evidence.** No Vercel preview was produced, so there are no
  exact-SHA preview IDs. Runtime verification below was performed against a **local
  production build** (`next build` + `next start`, `NODE_ENV=production`). That is
  stronger than source inspection and weaker than a deployed preview. Do not cite it as
  deployed-runtime evidence.
- **Chrome journey evidence was obtained, but against that same local build**, not a
  deployed preview — 44/44 Playwright cases across Chromium and an Arabic RTL project.
  See §6.1. It does not substitute for exact-SHA preview evidence.

### Prior-gate dependency

Rule 9 says a new prompt's work does not merge until the previous gate report is approved.
The Gate 1 report was produced against the working tree, not this base, and the originally
cited `AVENICK_GATE_1_CURRENT_STATE_SDET_REPORT_2026-08-17.md` does not exist in this
repository. **This work is therefore unmerged pending that approval.**

---

## 2. Defect register re-derived at the base SHA

The Gate 1 register described a tree 188 commits behind this base. Re-derived here:

| Gate 1 finding | Status at `803138c` |
|---|---|
| D-01 public credential pairs | **PRESENT** — fixed by this work |
| D-02 seller boundary on order creation | Already fixed upstream (`b98d6cb`) |
| D-03 ungated mock payment | Already fixed upstream (`97ee87e`) |
| D-04 client-asserted B2B order type | Already fixed upstream (`50e7b01`, `0a10fd3`) |
| D-05 fabricated deal discounts | Already fixed upstream — `/deals` is retitled and prices are real |
| D-06 unsupported trust badges | **PARTIALLY PRESENT** — fixed by this work |
| D-07 escrow claim | Already fixed upstream — Terms now states escrow is not provided |
| D-08 status page fails open | **PRESENT** — fixed by this work |
| D-09 stale domains | **PRESENT** — aliases corrected; residual risk retained, see §8 |
| D-10 admin UI shells | Not in PROMPT 01 scope |

---

## 3. Objective-by-objective evidence

### Objective 2 — Credential removal · DONE

Credential pairs were live on all three unauthenticated login pages at this base.

| Surface | Before |
|---|---|
| `apps/admin/src/app/login/page.tsx:53` | `admin@avenick.test · Password123!` |
| `apps/seller/src/app/login/page.tsx:53` | `seller@avenick.test · Password123!` |
| `apps/customer/src/app/login/page.tsx:65` | `buyer@avenick.test · Password123!` |

Also removed from `README.md`, `PILOT_DEMO.md`, `DEMO_SCRIPT.md`,
`MODULE_11_AI_AUTOMATION_INTEGRATIONS_NOTES.md`, `dev-docs/content/Getting Started.md`,
`packages/auth/src/__tests__/client.test.ts`, and 8 call sites in
`packages/database/prisma/seed.ts`.

**No replacement secret was written anywhere.** The seed now takes `SEED_PASSWORD`, or
generates a random password per run and prints it once to the seeding terminal
(`packages/database/prisma/seed.ts:37-48`).

- Repo-wide sweep: **0** occurrences of `Password123` remain.
- Runtime: served HTML of `/login` and `/` contains no credential string.

### Objective 3 — Correct portal aliases · DONE

`render.yaml`, `PILOT_DEMO.md`, `ops/observability/uptime-monitors.yaml` corrected to the
aliases PROMPT 01 declares:

| Portal | Was | Now |
|---|---|---|
| seller | `avenick-seller.vercel.app` | `avenick-commerce-seller.vercel.app` |
| admin | `avenick-admin.vercel.app` | `avenick-commerce-admin.vercel.app` |
| customer | `avenick.vercel.app` | unchanged (already correct) |

Signed-out/signed-in callback behaviour was **not** proven — that needs a deployed preview.

### Objective 4 — `/brands` public authorization contract · DONE

`/brands` was a public page whose data API was not public, so an anonymous visitor hit a
401 behind a public route. `/api/brands` added to `PUBLIC_API_PATHS.customer`
(`packages/auth/src/middleware.ts:31`).

- Runtime: `/api/brands` → **HTTP 500** (no local DB), *not* 401 — middleware passes it.
- Control: `/api/orders` → **HTTP 401**, so the change did not widen the API surface.
- Tests: 4 new cases, including that seller and admin portals still reject `/api/brands`.

### Objective 5 — Scoped process health plus journey status · DONE

The page claimed `All systems operational` and defaulted to `operational` whenever the
response lacked a status field.

- `ComponentStatus` extended with `unverified` and `not_configured`; components gain a
  `kind` of `process | journey | integration` (`packages/observability/src/probes.ts`).
- `statusSummary` now returns `processStatus` and `journeyStatus` separately. `unverified`
  outranks `degraded` in the roll-up: not knowing cannot be reasoned about.
- Headline is now scoped — `Process health: …` plus `Customer journeys: unverified — no
  journey synthetic has run against this deployment`.
- Integrations report `not_configured` when zero are configured, never `operational`.
- 13 new tests, including "does not let a journey component change process health" and
  "falls back to unverified when every component is unconfigured".

### Objective 6 — Safe same-origin returnTo · DONE

Two defects. `callbackUrl` was passed unvalidated to `window.location.assign()` — a live
open redirect. And the middleware set `callbackUrl` from `pathname` only, dropping the
query, so an RFQ/product return path came back stripped of its context.

- New `packages/auth/src/safe-redirect.ts`: accepts site-relative paths only; strips
  control characters before checking; rejects protocol-relative, backslash variants and
  schemes; re-validates the resolved origin; refuses login/auth loops.
- Middleware now preserves the query string (`middleware.ts:86-90`).
- **31 tests, including 17 adversarial vectors** — absolute URLs, `//evil`, `/\evil`,
  `javascript:`, `data:`, newline/tab/CR/NUL smuggling, uppercase scheme.
- Runtime: `/b2b/rfq/new?productId=p-1&supplier=s-9` →
  `location: /login?callbackUrl=%2Fb2b%2Frfq%2Fnew%3FproductId%3Dp-1%26supplier%3Ds-9`.

### Objective 7 — Silent category fallback removed · DONE

`apps/customer/src/app/products/page.tsx:58-61` silently `redirect()`ed an empty category
to the full catalog, discarding the visitor's selection and hiding that the category was
empty. Removed. The zero-result state now names the situation ("No products in this
category yet") and offers **Browse all products** as a visible link.
`emptyCategoryRecoveryHref` renamed to `browseAllHref` so the name states what it is.

### Objective 8 — Deals removed from navigation · DONE

`/deals` lists ordinary catalog products, so presenting it as Deals claims a discount the
commercial model does not back. Removed from **four** entry points — header nav, footer,
role switcher, and the cart/wishlist empty-state CTAs (retargeted to `/products`).

Runtime: `href="/deals"` count is **0** on `/`, `/cart` and `/wishlist`. The route itself
is left reachable and truthful (titled "Featured Products", real prices).

### Objective 9 — Unsupported public claims removed or qualified · DONE

| Claim | Backing check | Action |
|---|---|---|
| `Verified Supplier` badge on every product | Real `seller.tier` renders separately at `:299` | Replaced with `Price checked at order` |
| `14-day returns` | **No return window exists** in schema or services | Replaced with `See returns policy`; detail text now defers to the published policy |
| `HOT` badge on homepage best sellers | No demand ranking computed | Removed |
| "verified GCC suppliers" ×13 | Verification is per-seller, not universal | Qualified across 6 files |
| RFQ "distributed to matching suppliers" | `RFQRequest` has a single optional `sellerId`; no distribution function exists | Rewritten |
| RFQ "competitive quotes" | Single-supplier model | Rewritten |
| RFQ "reviewed within 2 business hours" | No SLA implemented | Removed |
| "as a verified seller" | Seller approval **is** implemented | Changed to "approved seller" — kept, because it is true |

### Objective 10 — Policy copy reconciled · DONE

Terms claimed credit-line applications, periodic creditworthiness review, and automatic
suspension/lockout on overdue invoices. `creditLimit` and `paymentTerms` exist as Company
fields but **nothing enforces them** — and the Support page already said new credit terms
were unavailable, so Terms directly contradicted Support. Terms rewritten to match the
implemented model.

**Both language variants were corrected.** The Arabic credit and RFQ paragraphs still
carried the original claims after the English was fixed; leaving them would have made the
Arabic terms the misleading ones.

Jurisdiction copy was already honest at this base and was left alone.

### Objective 11 — Accessibility on touched screens · DONE

- Seller and admin login had **no labels at all** — placeholder-only inputs. Added
  `sr-only` labels with `htmlFor`/`id`, plus `autoComplete` and `name`.
- Customer login had visible labels that were **not programmatically associated**. Added
  `htmlFor`/`id`.
- Error text now carries `role="alert"` on all three so failures are announced.
- Forms given accessible names via `aria-label`.
- **Skip link added** to `MainLayout` — none existed anywhere. Visually hidden until
  focused; `<main id="main-content" tabIndex={-1}>` as the target.
- Runtime: `/login` serves `for="login-email"`, `for="login-password"`,
  `id="main-content"`, and the bilingual skip link.

Not covered: full WCAG 2.2 AA audit, keyboard traversal of every touched screen, and
contrast checks. Those need Chrome journeys (§6).

### Objective 12 — Security headers · DONE

**No security headers existed on any portal.** Added `packages/config/security-headers.mjs`,
wired into all three `next.config.mjs` so policy stays in one place.

Verified at runtime on `/login`:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: …; font-src 'self' data:;
  connect-src 'self' http://localhost:13100; object-src 'none'; frame-src 'none';
  frame-ancestors 'none'; base-uri 'self'; form-action 'self'; manifest-src 'self';
  upgrade-insecure-requests
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(),
  magnetometer=(), microphone=(), payment=(), usb=()
X-DNS-Prefetch-Control: off
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

`form-action 'self'` deliberately complements the returnTo fix: even a hijacked form
cannot POST credentials off-origin. HSTS and `upgrade-insecure-requests` are production
only; `'unsafe-eval'` is added only in development.

**No required flow broke**: build succeeded, and `/`, `/login`, `/cart`, `/wishlist`,
`/b2b/rfq/new` and `/api/brands` all served correctly under the enforced policy.

---

## 4. Verification results

| Gate | Result |
|---|---|
| `pnpm typecheck` | **PASS** — 4/4 packages |
| `pnpm lint` | **PASS** — no ESLint warnings or errors, 3/3 apps |
| `@avenick/auth` tests | **PASS** — 84 passed (7 files) |
| `@avenick/observability` tests | **PASS** — 17 passed |
| `@avenick/utils` tests | **PASS** — 7 passed |
| `@avenick/customer` tests | 38 passed, 2 skipped, **1 file failed** |
| `next build` (customer) | **PASS** |

The single failing file is
`apps/customer/src/app/b2b/team/__tests__/b2b-iam-audit.security.integration.test.ts`,
which requires Postgres on `localhost:5432`. Not running locally; **environmental, not
caused by this work**. CI provisions a throwaway Postgres for exactly this suite.

### New test coverage

| Suite | Cases |
|---|---|
| `packages/auth/src/__tests__/safe-redirect.test.ts` | 31 (17 adversarial) |
| `packages/observability/src/__tests__/status-summary.test.ts` | 13 |
| `packages/auth/src/__tests__/middleware.test.ts` (added) | 6 |
| `apps/customer/src/lib/catalog-navigation.regression.test.ts` (rewritten) | 4 |

---

## 5. Changed-claim matrix — awaiting sign-off

Owners are **proposed, not obtained**. PROMPT 01 requires Legal/Product/Ops signature;
that has not happened and cannot be self-certified.

| # | Surface | Claim removed or qualified | Proposed owner | Signed |
|---|---|---|---|---|
| 1 | Product detail | `Verified Supplier` on every product | Product | ☐ |
| 2 | Product detail | `14-day returns` | Legal + Ops | ☐ |
| 3 | Home | `HOT` badge | Product | ☐ |
| 4 | Brands, B2B, Deals | "verified GCC suppliers" | Sales + Product | ☐ |
| 5 | RFQ, Terms | RFQ distribution / competition / 2-hour SLA | Product + Legal | ☐ |
| 6 | Terms | Credit lines, review, auto-suspension | Legal + Finance | ☐ |
| 7 | Brands | "verified seller" → "approved seller" | Sales | ☐ |
| 8 | Status | `All systems operational` | Ops | ☐ |
| 9 | Nav | Deals entry points | Product + Sales | ☐ |

---

## 6. Evidence classes obtained

| Class | Status |
|---|---|
| Source present | **OBTAINED** |
| Automated test pass | **OBTAINED** — §4 |
| Local production-build runtime | **OBTAINED** — headers, credential absence, redirect behaviour, nav |
| Chrome journey pass | **OBTAINED against a local production build** — §6.1 |
| Deployed runtime pass | **NOT OBTAINED** — no preview deployed |
| External-provider certification | **NOT OBTAINED** |

The browser suite (Playwright + Puppeteer + Cypress) is **PROMPT 04 item 6** and is
deliberately *not* part of this containment diff, which PROMPT 01 requires to stay
narrowly scoped. It was run against the containment build purely to produce evidence.

### 6.1 Chrome journey results

All three portals were built (`pnpm build`, 3/3) and started in production mode on
:13100 / :13101 / :13102. Playwright drove real Chromium against them.

**44 / 44 passed**, across two projects — `chromium` and `chromium-rtl` (locale `ar-AE`,
timezone `Asia/Dubai`), so the Arabic RTL surface was exercised too.

The security guardrail is the significant result. It was authored **before** the fix,
asserting that no credential string appears on any unauthenticated login page, and it
failed at the time by design. It now passes:

| Case | Portals | Result |
|---|---|---|
| Login page renders no credential string | customer, seller, admin | **PASS** |
| Login HTML payload contains no credential string | customer, seller, admin | **PASS** |
| Dashboard unreachable without a session | seller, admin | **PASS** |
| Checkout requires a session | customer | **PASS** |

Storefront coverage: 9 public routes render without an error boundary; catalog navigation
exposes its entry points; the status page states `Process health:` and `Customer
journeys:` separately and **never** renders `all systems operational`; `/api/status`
returns `journeyStatus` that is not `operational` and integrations that are not
`operational`.

One spec failed on first run and was corrected: `storefront.spec.ts` predated objective 5
and its assertion did not recognise the new `unverified` state. The page was behaving
correctly — `/api/status` returned `processStatus: down` (no local database),
`journeyStatus: unverified`, `external-integrations: not_configured`. The spec, not the
fix, was stale.

Artifacts: `packages/.e2e/artifacts/` — HTML report, `playwright-results.json`, traces.

**Scope limit:** this is Chrome evidence against a *local production build*, not against a
deployed preview. It does not satisfy PROMPT 01's requirement for exact-SHA Vercel preview
IDs, and must not be cited as deployed-runtime evidence.

---

## 7. Gate 0 assessment

Gate 0 passes only when *no public privileged credentials remain*, domains and auth
callbacks work, Brands/category/RFQ continuity are fixed, public claims are truthful, and
no Sev-1/Sev-2 containment defect remains.

| Condition | State |
|---|---|
| No public privileged credentials in source or served pages | **MET** |
| Compromised credentials rotated, sessions invalidated, audit reviewed | **NOT MET — objective 1 blocked** |
| Correct domains configured | **MET in configuration**; callback behaviour unproven |
| Brands fixed | **MET** |
| Category continuity fixed | **MET** |
| RFQ continuity fixed | **MET** |
| Public claims truthful | **MET in source**; unverified in a deployed browser |
| Claim matrix signed | **NOT MET** |

**Verdict: NOT PASSED.** Removing the credentials from the pages does not un-publish them
— they were publicly readable and must be treated as compromised until rotated. That is
objective 1, and it is the gating item.

---

## 8. Residual risks

1. **Objective 1 outstanding.** The three seeded accounts must be assumed compromised.
2. **CSP retains `'unsafe-inline'` for scripts.** Next.js 14 App Router injects inline
   bootstrap scripts; removing it needs a per-request nonce through middleware, which
   would make every response dynamic. Documented in `security-headers.mjs`. Main residual
   CSP risk; the clickjacking, base-URI, plugin and form-action directives are strict.
3. **Backend URL falls back to a hardcoded host.** `apps/*/src/lib/backend.ts` still
   defaults to `https://avenick-*.onrender.com` when `NEXT_PUBLIC_*BACKEND_URL` is unset
   in production mode. A preview or CI run with that variable missing will silently drive
   **live** services. Left unchanged as out of PROMPT 01 scope; **recommend fail-closed
   instead of defaulting.**
4. **`pathname.includes(".")` bypasses middleware** (`middleware.ts:56`). Pre-existing and
   out of scope; worth a look.
5. **Accessibility is partial.** Touched screens only; no full WCAG 2.2 AA pass.
6. **No deployed evidence**, per §6.

---

## 9. Rollback plan

All work is a single set of source changes on `main` above `803138c`, with no migration
and no data mutation.

- **Full rollback:** `git revert` the containment commit, or reset `main` to `803138c`.
  No database or deployment state to unwind.
- **Partial rollback:** each objective touches a distinct file set — security headers are
  isolated to `packages/config/security-headers.mjs` plus three `next.config.mjs` header
  blocks; returnTo to `packages/auth`; status to `packages/observability` plus the status
  route and page.
- **The one non-revertible item is objective 2.** Reverting would republish the
  credentials. If a revert is ever needed, rotate first.
- Pre-change state is preserved on `wip/gate1-worktree-2026-08-17` (`808716c`).

---

## 10. Recommended next step

Do not start PROMPT 02. It is blocked on private rotated test accounts, which is
objective 1.

1. **CIO/Security executes objective 1** — rotate the three accounts, invalidate sessions,
   review auth/audit logs for use of the published credentials, and create private
   least-privilege test accounts. No replacement secret enters source, docs or artifacts.
2. **Obtain the §5 claim-matrix signatures.**
3. **Deploy an exact-SHA preview** and re-verify the runtime items against it, so
   deployed-runtime evidence replaces the local-build evidence here.
4. **Approve or reject the Gate 1 report** so rule 9 is satisfied and this work can merge.
