# Deployment

There is no separate API server in this repo: each Next.js app (customer,
seller, admin) contains its own backend — API routes, server actions, and
Prisma. Deploying "the backend" means deploying the apps themselves.

Two supported paths: **Render** (one-click Blueprint, includes managed
Postgres) or **Vercel + Neon**.

## Option A — Render (Blueprint)

1. Push this repo to GitHub, then in Render: **New → Blueprint** → select the
   repo. Render reads [render.yaml](render.yaml) and creates:
   - `avenick-customer`, `avenick-seller`, `avenick-admin` web services
     (Frankfurt, health-checked on `/api/health`)
   - `avenick-db` managed Postgres, wired into every service as
     `DATABASE_URL`/`DIRECT_URL`
   - a generated `AUTH_SECRET` per service (`AUTH_TRUST_HOST=true` is set;
     the auth config already has `trustHost: true`)
2. Every deploy runs `prisma migrate deploy` automatically (safe under
   concurrency — Prisma serializes with an advisory lock).
3. Seed demo data once (optional), from your machine against the Render DB's
   **external** connection string (Dashboard → avenick-db → Connect):

   ```bash
   DATABASE_URL="<external-url>" DIRECT_URL="<external-url>" pnpm --filter @avenick/database db:seed
   ```

4. Optional integrations — add in each service's Environment tab when ready
   (apps degrade gracefully without them):
   - customer: `CHECKOUT_PUBLIC_KEY`, `CHECKOUT_SECRET_KEY`, `CHECKOUT_WEBHOOK_SECRET`
   - seller: `ANTHROPIC_API_KEY`
   - any: `REDIS_URL` (shared rate limiting)
5. Verify: `GET /api/health` → `ok`, `GET /api/ready` → `ready` on each
   service URL. Point the Checkout.com webhook at
   `https://<avenick-customer>.onrender.com/api/payments/webhook`.

Notes:

- Starter instances (in the Blueprint) stay warm; free instances spin down on
  idle and can OOM during Next.js builds.
- The rate limiter is per-instance in-memory. On Render's single-instance
  services that is globally correct until you scale to multiple instances —
  then plug Redis into `setRateLimitStore()`.

## Option B — Vercel + Neon

Three Vercel projects, one repo (monorepo). One Neon Postgres shared by all three.

### 1. Neon database

1. Create a Neon project (or install the Neon integration from the Vercel Marketplace — it wires the env vars automatically).
2. You need **two** connection strings:
   - **Pooled** (`…-pooler.neon.tech`) → `DATABASE_URL` (runtime queries)
   - **Direct** → `DIRECT_URL` (used only by `prisma migrate deploy`)
3. Apply migrations and seed from your machine:

   ```bash
   DATABASE_URL="<pooled>" DIRECT_URL="<direct>" pnpm --filter @avenick/database db:deploy
   DATABASE_URL="<pooled>" DIRECT_URL="<direct>" pnpm --filter @avenick/database db:seed   # optional demo data
   ```

The Prisma schema is already Neon-ready: `directUrl` is configured and
`binaryTargets` includes `rhel-openssl-3.0.x` for the Vercel runtime.

### 2. Vercel projects

Create three projects from this repo, differing only in **Root Directory**:

| Project | Root Directory |
| --- | --- |
| avenick-customer | `apps/customer` |
| avenick-seller | `apps/seller` |
| avenick-admin | `apps/admin` |

Vercel detects Next.js and the pnpm workspace automatically; the default
build command (`next build`) is correct. `@prisma/nextjs-monorepo-workaround-plugin`
is already wired into each app's Next config.

### 3. Environment variables (all three projects)

Required:

- `DATABASE_URL` — Neon pooled URL
- `DIRECT_URL` — Neon direct URL
- `AUTH_SECRET` / `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32` (same value across the three projects is fine)
- `NEXTAUTH_URL` — that project's public URL

Per-feature (only where used):

- Customer: `CHECKOUT_PUBLIC_KEY`, `CHECKOUT_SECRET_KEY`, `CHECKOUT_WEBHOOK_SECRET`
- Seller: `ANTHROPIC_API_KEY` (AI drafts degrade gracefully without it)
- Optional: `REDIS_URL` (rate limiting falls back to per-instance in-memory when unset)

### 4. Post-deploy checks

- `GET /api/health` on each app → `{"status":"ok"}`
- `GET /api/ready` on each app → `{"status":"ready"}` with database latency
- Point the Checkout.com webhook at `https://<customer-domain>/api/payments/webhook`

### 5. CI

`.github/workflows/ci.yml` runs typecheck, lint, unit + integration tests
(against a disposable Postgres service), and builds all three apps on every
push/PR to `main`.
