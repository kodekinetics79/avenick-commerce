# Deployment

There is no separate API server package in this repo. Each Next.js app contains
its API runtime. The pilot deployment shape is:

- Vercel hosts each customer, seller, and admin Next.js application, including
  its API routes, in one authentication trust boundary
- Render hosts the integration worker and may host independent full portal
  runtimes when that topology is explicitly provisioned
- Neon is the single PostgreSQL system of record

Vercel must not proxy authenticated `/api/*` traffic to another runtime. Doing
so splits JWT issuance and validation across independently configured secrets.

## Render Backends

1. Push this repo to GitHub, then in Render: **New → Blueprint** → select the
   repo. Render reads [render.yaml](render.yaml) and creates:
   - `avenick-customer`, `avenick-seller`, `avenick-admin` web services
     (Frankfurt, health-checked on `/api/health`)
   - prompts for the Neon `DATABASE_URL` and `DIRECT_URL`
   - prompts for each portal's `AUTH_SECRET` and `NEXTAUTH_SECRET`
2. Each independently exposed portal runtime owns its own auth-secret values.
   Do not forward its authenticated traffic into another portal runtime.
3. Every deploy runs `prisma migrate deploy` automatically (safe under
   concurrency — Prisma serializes with an advisory lock).
4. Seed demo data once against the dedicated Neon pilot database:

   ```bash
   DATABASE_URL="<neon-pooled>" DIRECT_URL="<neon-direct>" pnpm --filter @avenick/database db:seed
   ```

4. Optional integrations — add in each service's Environment tab when ready
   (apps degrade gracefully without them):
   - customer: `CHECKOUT_PUBLIC_KEY`, `CHECKOUT_SECRET_KEY`, `CHECKOUT_WEBHOOK_SECRET`
   - admin ERP ingress: `INTEGRATION_WEBHOOK_SIGNING_KEYRING`, a deployment-owned
     JSON array binding each provider `keyId` to exactly one `system`, governed
     `connectionId`, and 32+ character `secret`;
     configure the provider URL as
     `https://<avenick-admin>.onrender.com/api/integrations/inbound/<system>`.
     Send `x-avenick-key-id`, `x-avenick-timestamp`, and an HMAC-SHA256 hex
     `x-avenick-signature` over `<key-id>.<timestamp>.<raw body>`.
   - seller: `ANTHROPIC_API_KEY`
   - any: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (shared rate limiting
     and cache). `REDIS_URL` is NOT read by any code — setting it does nothing.
   - all three portal services: `NEXT_PUBLIC_CUSTOMER_PORTAL_URL`,
     `NEXT_PUBLIC_SELLER_PORTAL_URL`, `NEXT_PUBLIC_ADMIN_PORTAL_URL` and
     `NEXT_PUBLIC_SUPPORT_EMAIL` (prompted by the Blueprint, `sync: false`).
     They are build-time values — set them before the first build. What each
     one does, and what breaks without it, is in the
     [portal origins table](#portal-origins-sender-and-contacts) below.
   - customer: `RESEND_API_KEY` + `RESEND_FROM_EMAIL`. There is no default
     sender: without `RESEND_FROM_EMAIL` every email refuses to send.
   - any: `NEXTAUTH_URL` is optional on Render. The app's own origin (used in
     invitation and already-registered links) resolves as
     `NEXT_PUBLIC_<PORTAL>_PORTAL_URL` → `NEXTAUTH_URL` → `RENDER_EXTERNAL_URL`
     → `VERCEL_PROJECT_PRODUCTION_URL`; when none is set the email is refused
     rather than sent with a guessed host. The password-reset link is the
     exception: it is built from `NEXT_PUBLIC_CUSTOMER_PORTAL_URL` only, and the
     reset request answers 500 when that is unset.
5. Verify: `GET /api/health` → `ok`, `GET /api/ready` → `ready` on each
   service URL. Point the Checkout.com webhook at
   `https://<avenick-customer>.onrender.com/api/payments/webhook`.

Notes:

- Starter instances (in the Blueprint) stay warm; free instances spin down on
  idle and can OOM during Next.js builds.
- The rate limiter is per-instance in-memory. On Render's single-instance
  services that is globally correct until you scale to multiple instances —
  Redis is already wired: `installRedisRateLimitStore()` runs from each portal's
  `instrumentation.ts` at boot and installs the shared store when the two
  `UPSTASH_REDIS_REST_*` variables are set. Without them every instance falls
  back to a per-process in-memory store, which does not throttle across instances.

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

Backend URL by project (the matching Render service's public origin):

- Customer: `NEXT_PUBLIC_BACKEND_URL=https://<your-customer-backend>`
- Seller: `NEXT_PUBLIC_SELLER_BACKEND_URL=https://<your-seller-backend>`
- Admin: `NEXT_PUBLIC_ADMIN_BACKEND_URL=https://<your-admin-backend>`

Do not put `DATABASE_URL` or `DIRECT_URL` on Vercel. Database access belongs to
the Render services.

#### Portal origins, sender and contacts

Every value that names another deployment or an address the platform speaks
from is read in exactly one place, `@avenick/utils/portal-config`
(`packages/utils/src/portal-config.ts`). None of them has a production default:
a missing value hides the control that needs it, or makes the server refuse the
operation, rather than inventing a host or an address. `NEXT_PUBLIC_*` values
are inlined at **build** time — set them before the build and rebuild after
changing one; a restart is not enough.

Set on **all three** Render portal services and on **every** Vercel project.
Each portal needs all three origins, not only its own, because each one links
into the others:

| Variable | Value | Missing in production |
| --- | --- | --- |
| `NEXT_PUBLIC_CUSTOMER_PORTAL_URL` | `https://<your-customer-domain>` — origin only, no path | "Forgot password" link hidden on seller login; every link back to the storefront hidden. On the customer portal itself, **password reset refuses outright** (the request route answers 500 and logs at error — no other variable substitutes), and invitation / already-registered emails refuse to send unless `NEXTAUTH_URL`, `RENDER_EXTERNAL_URL` or `VERCEL_PROJECT_PRODUCTION_URL` supplies the origin |
| `NEXT_PUBLIC_SELLER_PORTAL_URL` | `https://<your-seller-domain>` | "Become a seller" hidden on the storefront; every link into the seller portal hidden |
| `NEXT_PUBLIC_ADMIN_PORTAL_URL` | `https://<your-admin-domain>` | Every link into the admin portal hidden |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | bare address, `support@<your-domain>` | Support contact line omitted from footers, legal pages and emails — no address is substituted |
| `NEXT_PUBLIC_LEGAL_EMAIL` | bare address (optional) | Falls back to `NEXT_PUBLIC_SUPPORT_EMAIL`; omitted when that is unset too |
| `NEXT_PUBLIC_PRIVACY_EMAIL` | bare address (optional) | Falls back to `NEXT_PUBLIC_SUPPORT_EMAIL`; omitted when that is unset too |
| `NEXT_PUBLIC_PLATFORM_NAME` | brand name (optional) | Defaults to `Avenick` |

Set wherever email is sent — today the **customer** Render service and Vercel
project (invitations, password reset, already-registered notices):

| Variable | Value | Missing |
| --- | --- | --- |
| `RESEND_API_KEY` | Resend API key | Emails are skipped and logged at info |
| `RESEND_FROM_EMAIL` | `Name <noreply@<your-domain>>` or `noreply@<your-domain>`, on a domain verified in Resend | **Required for any email to send — there is no default sender.** Password-reset, invitation and notice emails refuse to send and log at error |

Validation rules, so a typo fails loudly instead of quietly:

- An origin must be `https://host` or `https://host/` (a port is fine). A value
  carrying a path, query, fragment or credentials — `https://<your-customer-domain>/store` —
  is rejected as if unset and warned once in the server log.
- Addresses are validated as a bare `local@host` (`RESEND_FROM_EMAIL` may also
  carry a display name). A malformed value is treated as unset.
- Outside production (`NODE_ENV` ≠ `production`) an unset portal origin falls
  back to the documented dev port (customer 13100, seller 13101, admin 13102).
  Nothing falls back in production.

Per-feature (only where used):

- Customer: `CHECKOUT_PUBLIC_KEY`, `CHECKOUT_SECRET_KEY`, `CHECKOUT_WEBHOOK_SECRET`
- Seller: `ANTHROPIC_API_KEY` (AI drafts degrade gracefully without it)
- Strongly recommended: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.
  Without both, rate limiting is per-instance in-memory and resets on restart —
  acceptable for a single instance, ineffective for a multi-instance rollout.

Object storage (browser-direct uploads: product images, seller documents):

- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` on the
  **seller** Render service (it presigns) and — at minimum `S3_ENDPOINT` (and
  `S3_PUBLIC_BASE_URL` when used) — on **every** Vercel project. The portals
  add the storage host to next/image's allow-list at build time; without it,
  uploaded product images render as a blank catalog rather than an error.
- `S3_PUBLIC_BASE_URL` (optional): the public-read origin when it differs from
  the API endpoint (Cloudflare R2 public bucket URL, or a CDN). It must already
  address the bucket.
- The bucket needs a CORS rule: `AllowedOrigins` = the seller portal origin,
  `AllowedMethods` = `PUT`, `AllowedHeaders` = `Content-Type`. Without it the
  browser's preflight fails and no upload ever reaches the app.
- Public-read policy must cover product images only (`sellers/*/products/*`).
  Seller documents (`sellers/*/documents/*`) are private and are served through
  short-lived signed GETs; a bucket-wide anonymous read policy exposes them.

For the customer frontend on Vercel, set:

- `NEXTAUTH_URL` = `https://<your-customer-domain>`
- `NEXT_PUBLIC_BACKEND_URL` = `https://<your-customer-backend>`
- `NEXT_PUBLIC_CUSTOMER_PORTAL_URL` = the same `https://<your-customer-domain>`,
  plus the seller and admin origins from the table above
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
