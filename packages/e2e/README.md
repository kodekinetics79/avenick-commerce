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
