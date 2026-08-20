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
├── targets.mjs                  single source of truth for portal URLs
├── targets.d.ts                 types for the TS suites
├── playwright.config.ts         primary suite — artifacts, RTL project
├── playwright/
│   ├── storefront.spec.ts       public storefront smoke journeys
│   └── security-guardrails.spec.ts   D-01 regression guard (expected RED)
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

## Authenticated certification (Gate 1 / PROMPT 02)

The `authenticated` project signs six personas in through the real login form
and certifies both what they can reach and what they must not.

```bash
# 1. database up, migrated, seeded with a password you choose
docker compose up -d postgres
pnpm --filter @avenick/database db:deploy
SEED_PASSWORD='<choose-one>' pnpm db:seed

# 2. build and start all three portals
pnpm build
# customer :13100, seller :13101, admin :13102

# 3. certify — same password you seeded with
E2E_SEED_PASSWORD='<the-same-one>' pnpm e2e:playwright
```

`E2E_SEED_PASSWORD` is never stored in the repository. Without it the setup
project fails immediately with an explicit message rather than producing a
confusing cascade of assertion failures.

Sign-in runs **serially** on purpose: the login route is rate limited, and
parallel logins fail in a way that looks like bad credentials but is throttling.

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

1. **Unauthenticated and read-only.** Every current spec visits public routes
   only and writes no data, so any of them can safely be pointed at a deployed
   runtime.
2. **No fixtures presented as journeys.** Do not add a spec that asserts against
   seeded or mocked rows and call the result a customer journey.
3. **Never weaken a guardrail to get green.** See below.

## The D-01 guardrail is expected to FAIL

`playwright/security-guardrails.spec.ts` and the matching Cypress and Puppeteer
cases assert that no credential strings render on an unauthenticated login page.

They currently **fail**, and that is correct. They encode defect D-01 (CRITICAL)
from `AVENICK_GATE_1_WORKTREE_AUDIT_2026-08-17.md`:

| Portal | Location | Leaked |
|---|---|---|
| admin | `apps/admin/src/app/login/page.tsx:53` | `admin@avenick.test · Password123!` |
| customer | `apps/customer/src/app/login/page.tsx:65` | `buyer@avenick.test · Password123!` |
| seller | `apps/seller/src/app/login/page.tsx:53` | `seller@avenick.test · Password123!` |

These turn green when the credentials are removed from the pages — never by
relaxing the assertion, adding `.skip`, or narrowing the forbidden list in
`targets.mjs`.

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

## Not yet wired

CI does not run these suites. `.github/workflows/ci.yml` was left untouched
deliberately — adding a browser stage changes the release gate, which is a
product-owner decision. Wiring it needs a job that builds the apps, starts the
three portals against the CI Postgres, then runs `pnpm e2e`.
