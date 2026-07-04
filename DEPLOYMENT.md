# Deployment

There is no separate API server package in this repo. Each Next.js app contains
its API runtime. The pilot deployment shape is:

- Vercel hosts the customer, seller, and admin frontends
- Render hosts the matching API/runtime for each portal
- Neon is the single PostgreSQL system of record
- Vercel proxies `/api/*` to Render; server-rendered pilot pages use the same
  backend URL explicitly

## Render Backends

1. Push this repo to GitHub, then in Render: **New → Blueprint** → select the
   repo. Render reads [render.yaml](render.yaml) and creates:
   - `avenick-customer`, `avenick-seller`, `avenick-admin` web services
     (Frankfurt, health-checked on `/api/health`)
   - prompts for the Neon `DATABASE_URL` and `DIRECT_URL`
   - prompts for each portal's `AUTH_SECRET` and `NEXTAUTH_SECRET`
2. Use the same auth-secret values on each matching Vercel/Render portal pair.
   Customer, seller, and admin may each use a different pair.
3. Every deploy runs `prisma migrate deploy` automatically (safe under
   concurrency — Prisma serializes with an advisory lock).
4. Seed demo data once against the dedicated Neon pilot database:

   ```bash
   DATABASE_URL="<neon-pooled>" DIRECT_URL="<neon-direct>" pnpm --filter @avenick/database db:seed
   ```

4. Optional integrations — add in each service's Environment tab when ready
   (apps degrade gracefully without them):
   - customer: `CHECKOUT_PUBLIC_KEY`, `CHECKOUT_SECRET_KEY`, `CHECKOUT_WEBHOOK_SECRET`
   - seller: `ANTHROPIC_API_KEY`
   - any: `REDIS_URL` (shared rate limiting)
   - any: `NEXTAUTH_URL` is optional on Render; the customer email flow falls
     back to `RENDER_EXTERNAL_URL` automatically
5. Verify: `GET /api/health` → `ok`, `GET /api/ready` → `ready` on each
   service URL. Point the Checkout.com webhook at
   `https://<avenick-customer>.onrender.com/api/payments/webhook`.

Notes:

- Starter instances (in the Blueprint) stay warm; free instances spin down on
  idle and can OOM during Next.js builds.
- The rate limiter is per-instance in-memory. On Render's single-instance
  services that is globally correct until you scale to multiple instances —
  then plug Redis into `setRateLimitStore()`.

## Vercel Frontends

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

### 3. Environment variables

Every frontend requires:

- `AUTH_SECRET` / `NEXTAUTH_SECRET` — identical to its matching Render service
- `NEXTAUTH_URL` — that project's public URL

Backend URL by project:

- Customer: `NEXT_PUBLIC_BACKEND_URL=https://avenick-commerce.onrender.com`
- Seller: `NEXT_PUBLIC_SELLER_BACKEND_URL=https://avenick-seller.onrender.com`
- Admin: `NEXT_PUBLIC_ADMIN_BACKEND_URL=https://avenick-admin.onrender.com`

Do not put `DATABASE_URL` or `DIRECT_URL` on Vercel. Database access belongs to
the Render services.

Per-feature (only where used):

- Customer: `CHECKOUT_PUBLIC_KEY`, `CHECKOUT_SECRET_KEY`, `CHECKOUT_WEBHOOK_SECRET`
- Seller: `ANTHROPIC_API_KEY` (AI drafts degrade gracefully without it)
- Optional: `REDIS_URL` (rate limiting falls back to per-instance in-memory when unset)

For the customer frontend on Vercel, set:

- `NEXTAUTH_URL` = `https://avenick.vercel.app`
- `NEXT_PUBLIC_BACKEND_URL` = `https://avenick-commerce.onrender.com`
- `AUTH_SECRET` and `NEXTAUTH_SECRET` must match the Render backend values so the frontend can read the same session cookies

The complete environment blocks and the rehearsal sequence are in
[PILOT_DEMO.md](PILOT_DEMO.md).

### 4. Post-deploy checks

- `GET /api/health` on each app → `{"status":"ok"}`
- `GET /api/ready` on each app → `{"status":"ready"}` with database latency
- Point the Checkout.com webhook at `https://<customer-domain>/api/payments/webhook`

### 5. CI

`.github/workflows/ci.yml` runs typecheck, lint, unit + integration tests
(against a disposable Postgres service), and builds all three apps on every
push/PR to `main`.
