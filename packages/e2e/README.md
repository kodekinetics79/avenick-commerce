# @avenick/e2e — browser journey evidence

Playwright, Puppeteer and Cypress, side by side, for the Avenick gated-prompt
process. This package exists because Gate 1 could not produce Chrome journey
evidence: the repository had no browser tooling at all, so every journey claim
was permanently stuck at `NOT TESTED`.

> **Three frameworks is a deliberate product-owner decision, not a default.**
> They overlap heavily. Playwright is the one wired for evidence artifacts and
> the only one that drives all three portals in a single run — treat it as the
> primary. Puppeteer and Cypress run the same public journeys as corroboration.
> If the overlap ever stops earning its keep, drop Cypress first (it duplicates
> Playwright most directly).

## Layout

```
packages/e2e/
├── targets.mjs                  single source of truth for portal URLs and public route lists
├── targets.d.ts                 types for the TS suites
├── personas.mjs                 test accounts, in two address books (see "Persona sets")
├── playwright.config.ts         primary suite — artifacts, RTL project, session projects
├── playwright/
│   ├── lib/
│   │   ├── login.ts             THE sign-in: scoped to the password form, session cookie asserted
│   │   └── page-health.ts       console / network / DOM assertions shared by the certifications
│   ├── storefront.spec.ts       public storefront smoke journeys
│   ├── security-guardrails.spec.ts   D-01 regression guard (expected GREEN)
│   ├── console-hygiene.spec.ts  every public route, every portal: clean console, nothing refused by CSP
│   ├── boundaries.spec.ts       anonymous boundary both ways: redirects with callbackUrl, public beacon stays public
│   ├── catalogue-truth.spec.ts  subcategory pages, an accepted filter, an h1 in a loaded web font
│   ├── authenticated-journeys.spec.ts   buyer / seller owner / admin sign in and walk their core pages
│   ├── setup/auth.setup.ts      signs the persona set in; caches state under artifacts/auth/
│   └── authenticated/
│       ├── tenant-isolation.spec.ts    seller-A vs seller-B, buyer order isolation
│       └── portal-boundaries.spec.ts   cross-portal denial with API/UI parity
├── cypress.config.ts
├── cypress/e2e/storefront.cy.ts
├── puppeteer/storefront.test.mjs     runs on `node --test`
└── scripts/cypress.mjs          Cypress launcher (see Troubleshooting)
```

## Prerequisites

Browsers are downloaded on install. If the cache is cold:

```bash
pnpm e2e:install          # local
pnpm --filter @avenick/e2e e2e:install:ci   # CI, adds system deps
```

**The portals must already be running.** These suites deliberately do *not*
start the apps: the apps need a reachable database, so bringing them up is an
operator decision rather than something a test run does implicitly.

```bash
pnpm dev                  # customer :13100, seller :13101, admin :13102
```

## Running

From the repo root:

```bash
pnpm e2e                  # all three frameworks, in sequence
pnpm e2e:playwright       # primary suite
pnpm e2e:puppeteer
pnpm e2e:cypress
```

Retarget any environment — the same env vars drive all three:

```bash
E2E_CUSTOMER_URL=https://avenick.vercel.app \
E2E_SELLER_URL=https://avenick-seller.vercel.app \
E2E_ADMIN_URL=https://avenick-admin.vercel.app \
pnpm e2e:playwright
```

## Browser certification

Six defects reached the product owner's hands on 2026-09-05 after every unit
test, typecheck and build had passed: a seller page answering 500 (a server
component handed a `"use client"` component an icon component), an admin
navigation label rendering `MISSING_MESSAGE` on every page, every subcategory
page rendering not-found, a Content Security Policy silently refusing every
web font on all three portals, the public view beacon answered 401 by the auth
middleware, and a catalogue filter the URL accepted but nothing read. None of
them is visible in a screenshot; each is visible in exactly one of the console,
the network log, the response status, or the rendered text. The four
certification specs watch those four places, on every run.

```bash
# public half, all three portals (needs no password)
pnpm --filter @avenick/e2e exec playwright test \
  playwright/console-hygiene.spec.ts playwright/boundaries.spec.ts playwright/catalogue-truth.spec.ts

# signed-in half — see "Persona sets" for E2E_PERSONA_SET
E2E_SEED_PASSWORD='<the personas' password>' \
pnpm --filter @avenick/e2e exec playwright test --project=authenticated-journeys

# both, in that order
E2E_SEED_PASSWORD='…' pnpm --filter @avenick/e2e e2e:certify
```

| Spec | Runs as | Asserts |
|---|---|---|
| `console-hygiene.spec.ts` | anonymous, every public route of every portal (`PUBLIC_PORTAL_ROUTES` in `targets.mjs`) | status < 400; **zero** console errors matching `MISSING_MESSAGE \| is not a function \| Cannot read prop \| Minified React error \| Hydration failed` (uncaught exceptions included); **zero** CSP refusals ("Content Security Policy" in the console); **zero** requests to `fonts.googleapis.com` / `fonts.gstatic.com` failed with error text `csp`; **zero** other failed requests, bar `ERR_ABORTED` and the one admitted loopback noise below |
| `boundaries.spec.ts` | anonymous | eight protected seller/admin pages answer a redirect whose `Location` is `/login?callbackUrl=<path and query>` on the same origin; a browser sent away from seller `/settings` and admin `/shipping-zones` stands in front of the login form; protected APIs answer `401` JSON, not a redirect; `POST /api/signals/view` answers `202 {success:true, outcome}` without a session (never `unavailable`; `counted`/`duplicate` for a real product, `ignored` for a probe id) and `400` to five kinds of garbage; `GET /api/categories` answers a non-empty tree whose `data[0].children` is an array |
| `catalogue-truth.spec.ts` | anonymous | the first root category and the first **sub**category of the live tree answer 200 at `/categories/<slug>` with a `<title>` and `h1` that name the category and never the fallback "Category"; `/products?minRating=4&sort=rating` answers 200 with content and no error surface; on the storefront homepage `document.fonts` reports Inter loaded and the `h1`'s own family resolves to a loaded face, not a system fallback |
| `authenticated-journeys.spec.ts` | buyer on the storefront, seller owner in Seller Central, platform admin in the console — each signed in through the real login form | a `*.session-token` cookie (HttpOnly) after sign-in; then every core page — seller `/settings` and admin `/shipping-zones` named among them — answers **exactly 200 on its own URL** (no bounce to `/login`, no detour to `/pending`), renders no error surface and no untranslated message key, and passes the same console and network assertions as the public half |

Every test attaches what it observed (console errors, failed requests) to the
report as JSON, so a green line is not the only evidence.

### The harness trap, encoded

The storefront's header carries a search form — a real GET form, so it works
before hydration — whose submit control is a plain `button[type="submit"]`. A
login step written as "fill the two fields, click the first submit button"
clicks **that** button on the customer portal: the browser lands on
`/search?q=` with no session, and every protected page the run visits
afterwards bounces to `/login`. Read from the outside, that is a whole portal's
authentication reported broken by a test that never submitted the login form.

`playwright/lib/login.ts` is the only sign-in in this package, and it closes the
trap twice over: every locator is scoped to `form:has(input[type="password"])`,
and a sign-in is not believed until a `*.session-token` cookie exists — a
navigation away from `/login` without one throws as a **harness fault**, in
those words, so it can never masquerade as a product defect. `auth.setup.ts`
and the signed-in journeys both go through it. Do not add a second way to log
in.

### The one admitted network noise, and why

The production CSP (`packages/config/security-headers.mjs`) carries
`upgrade-insecure-requests`. Chromium honours it by rewriting the app's own
`http://localhost:PORT` subresource fetches — Next's RSC route prefetches above
all — to `https://localhost:PORT`, where nothing is listening, and logs each
as a failed request. On a deployed `https` origin the rewrite is a no-op. So
`page-health.ts` forgives a failed request to `https://localhost` **only when
the portal target is itself loopback** (`isLocalTarget` in `targets.mjs`);
against any other target the same failure is reported. Nothing else is
forgiven: a `csp` error text, on any host, fails the page.

### Persona sets — two databases, two address books

The same roles exist under different addresses depending on which database the
portals point at, and a suite that knows only one address book signs in against
the other with "Invalid email or password" — indistinguishable on a screenshot
from a wrong password. `personas.mjs` therefore carries two sets, selected by
`E2E_PERSONA_SET`:

| Role | `seed` — `prisma/seed.ts` on an empty database (CI, local docker) | `shared` — the shared database local dev points at, reset by `scripts/reset-test-personas.mjs` |
|---|---|---|
| buyer (CONSUMER) | `buyer@avenick.test` | `buyer@avenick.test` |
| companyAdmin (COMPANY_ADMIN) | `company@avenick.test` | `cert-company-admin@avenick.test` |
| sellerOwner (SELLER_OWNER) | `seller@avenick.test` | `cert-seller-a-owner@avenick.test` |
| sellerBOwner (SELLER_OWNER) | `seller-b-owner@avenick.test` | — none with a known password; isolation specs skip with the reason |
| sellerStaff (SELLER_STAFF) | `seller-a-fulfillment@avenick.test` | `cert-seller-a-catalog@avenick.test` |
| admin (SUPER_ADMIN) | `admin@avenick.test` | `admin@avenick.test` |

The default is `shared`, because that is the database a developer's portals
actually point at. CI sets `seed` explicitly in the job that seeds, and its
`verify:personas` step reads the same table, so the seed and the suite are
checked against one address book. An unknown value throws.

The signed-in journeys use only `buyer`, `sellerOwner` and `admin`, and do not
depend on the `auth-setup` project, so a persona one database does not hold
cannot take them down with it.

## Authenticated certification (Gate 1 / PROMPT 02)

The `authenticated` project signs the active persona set in through the real
login form and certifies both what they can reach and what they must not.

Against the shared database (the default), give the personas a password you
know first — this writes `passwordHash` on the listed test accounts and nothing
else — then certify with the same password:

```bash
TEST_PERSONA_PASSWORD='<choose-one>' node packages/database/scripts/reset-test-personas.mjs apply
E2E_SEED_PASSWORD='<the-same-one>' pnpm e2e:playwright
```

Against an empty local Postgres, seed and select the `seed` address book:

```bash
# 1. database up, migrated, seeded with a password you choose
docker compose up -d postgres
pnpm --filter @avenick/database db:deploy
SEED_PASSWORD='<choose-one>' pnpm db:seed

# 2. build and start all three portals
pnpm build
# customer :13100, seller :13101, admin :13102

# 3. certify — same password you seeded with, seed address book
E2E_PERSONA_SET=seed E2E_SEED_PASSWORD='<the-same-one>' pnpm e2e:playwright
```

`E2E_SEED_PASSWORD` is never stored in the repository. Without it the setup
project fails immediately with an explicit message rather than producing a
confusing cascade of assertion failures.

Sign-in runs **serially** on purpose: the login route is rate limited, and
parallel logins fail in a way that looks like bad credentials but is throttling.
The budget is 30 attempts per 15 minutes per client IP; a full run draws up to
nine (six in `auth-setup`, three in the signed-in journeys), so repeated runs in
quick succession will exhaust it, and the helper reports that in the server's
own words rather than retrying into it.

### What the authenticated suite asserts

| Area | Assertion |
|---|---|
| Cross-portal denial | A buyer/seller session cannot reach a portal it does not own |
| API/UI parity | The API refuses in the same direction as the UI — a portal that redirects the browser but still serves the JSON is not protected |
| Seller isolation | Every line item returned to a seller belongs to that seller |
| Direct-ID access | One seller cannot fetch another seller's order by guessing its ID |
| Buyer isolation | A buyer's order list contains only their own orders |

**On shared orders:** a marketplace order can legitimately contain items from
several sellers, so two sellers seeing the same order *header* is correct and is
not a leak. The isolation guarantee is asserted at line-item level, which is
where it actually lives. An earlier draft asserted that order IDs must not
intersect, failed against a genuine multi-seller order, and was wrong.

## Local setup gotchas

Worth knowing, because each of these presents as "authentication is broken":

- **Several env files, and the most specific wins.** `apps/*/.env.local`
  overrides the repo-root `.env` for `next start`, and `packages/database/.env`
  is what Prisma CLI reads. A stale password in any one of them fails in a way
  that looks like rejected credentials.
- **Playwright does not read `.env.local`.** `E2E_SEED_PASSWORD` and
  `E2E_PERSONA_SET` must be in the shell that runs the suite.
- **"Invalid email or password" has three causes** — a wrong password, an
  address the database does not hold (wrong persona set), or a non-ACTIVE
  account — and the UI reports all three identically. The sign-in helper names
  the persona set in its failure so the second is not mistaken for the first.
- **`docker-compose.yml` creates `avenick_db`**, while the env files point at
  `avenick`. Create it, or point them at the same name.
- **`pkill -f "next start"` does not always match a running portal.** Kill by
  port instead — `lsof -tiTCP:13100 -sTCP:LISTEN` — or a days-old process keeps
  serving with its original environment while every "restart" silently fails to
  bind.

## Evidence artifacts

Playwright writes to `artifacts/`, which is git-ignored and regenerated per run:

| Artifact | Path |
|---|---|
| HTML report | `artifacts/playwright-report/` |
| JSON summary | `artifacts/playwright-results.json` |
| Traces, screenshots, video | `artifacts/playwright-output/` |
| Cypress screenshots / video | `artifacts/cypress/` |

Under the project's evidence rules, a green console line is **not** evidence. A
gate report cites the trace, the screenshot, or the JSON summary — and records
the exact target URL and commit the run was made against.

## Scope rules for these suites

1. **Read-only.** No spec seeds, migrates or writes data. The only write a run
   performs is the one a page view performs: the storefront's view beacon
   incrementing a per-product, per-day counter. Anything in the public projects
   can safely be pointed at a deployed runtime.
2. **No fixtures presented as journeys.** Do not add a spec that asserts against
   seeded or mocked rows and call the result a customer journey. The
   certifications read the live tree and the live catalogue, and skip with a
   stated reason when the data cannot exercise a check.
3. **Never weaken a guardrail to get green.** See below.

## The D-01 guardrail is expected to PASS

`playwright/security-guardrails.spec.ts` and the matching Cypress and Puppeteer
cases assert that no credential strings render on an unauthenticated login page.

They encode defect D-01 (CRITICAL) from
`AVENICK_GATE_1_WORKTREE_AUDIT_2026-08-17.md`: working credential pairs were once
rendered on the login page of all three portals. Those strings have been
removed, so the guard is **green** and CI runs it on every push.

A red result means the credentials have come back on a public page. Fix the page
to turn it green — never by relaxing the assertion, adding `.skip`, or narrowing
the forbidden list in `targets.mjs`.

## Troubleshooting

**`Cypress: bad option: --no-sandbox` / `Cypress failed to start`**
VS Code and other Electron-hosted terminals export `ELECTRON_RUN_AS_NODE=1`,
which makes Cypress's bundled Electron boot as plain Node and reject its own
launch flags. `scripts/cypress.mjs` clears the variable for the child process,
which is why `pnpm e2e:cypress` goes through that shim instead of calling the
`cypress` binary directly. Keep it that way.

**Browsers missing after install**
`pnpm-workspace.yaml` gates dependency build scripts via `allowBuilds`. `cypress`
and `puppeteer` are listed there because both download their browser from a
postinstall script; removing those entries makes pnpm skip the download silently
and the suites then fail at launch rather than at install.

**`pnpm test` does not run these suites** — by design. This package intentionally
declares no `test` script, so the vitest gate stays fast and database-only.
Browser suites run only through the explicit `e2e:*` scripts.

## CI

`.github/workflows/ci.yml` runs these suites in the `Browser journey evidence`
job after the unit gate passes. The job builds the apps, seeds a throwaway
Postgres with `prisma/seed.ts` (so it sets `E2E_PERSONA_SET=seed`), starts all
three portals with `next start` against it, and then runs, in order:

1. `storefront.spec.ts`;
2. `security-guardrails.spec.ts` (D-01);
3. `console-hygiene.spec.ts`, `boundaries.spec.ts`, `catalogue-truth.spec.ts`
   — in both the `chromium` and `chromium-rtl` projects;
4. `--project=authenticated-journeys` — buyer, seller owner and admin;
5. `--project=authenticated` — which pulls in `auth-setup` and the isolation
   suites;

followed by Puppeteer and Cypress. All three portals are up in that job, so the
certification runs in full there; nothing is reduced to a customer-only subset.
Because the portals run `next start`, the CSP there is the production one,
`upgrade-insecure-requests` included — which is exactly what the loopback noise
allowance above exists for.

Artifacts under `artifacts/` are uploaded as `browser-journey-evidence`, with two
exclusions that must stay:

- `artifacts/auth/` — cached signed-in browser state, i.e. live session cookies.
- Playwright traces from the `auth-setup`, `authenticated` and
  `authenticated-journeys` projects — a trace embeds every request and response
  header, so it would carry the login POST and the `Set-Cookie` that follows.
  Those projects run with `trace: "off"`; screenshots and video are still
  retained on failure.
