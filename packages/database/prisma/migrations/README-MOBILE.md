# Applying the three mobile-foundation migrations

**Audience:** whoever is holding the pager. This is written to be followed at 2am
without judgement calls. Every step says what to type and what you should see.
If a step's actual output is not what this file says it should be, **stop** — do
not improvise, do not skip ahead. The rollback note at the bottom applies.

## The migrations, in the order they apply

Prisma applies migrations in lexical directory order. These three are already in
that order and are independent of one another, but apply all three together.

| # | Directory | What it does |
|---|---|---|
| 1 | `20260905130000_mobile_identity_and_sessions` | 3 enums + 3 new tables (`RefreshToken`, `OtpChallenge`, `DeviceToken`) |
| 2 | `20260905140000_user_sessions_valid_after` | 1 nullable column: `User.sessionsValidAfter` |
| 3 | `20260905150000_order_vat_component_split` | 2 nullable columns: `Order.goodsVatAmount`, `Order.shippingVatAmount` |

All three are **purely additive**. Nothing is dropped, altered, defaulted or
backfilled. Migrations 2 and 3 add nullable columns with no default, which on
PostgreSQL 11+ is a metadata-only change: no table rewrite, no long lock, safe
on a live `User` and `Order`.

## Read this before you touch anything

**`DATABASE_URL` and `DIRECT_URL` in `.env` point at PRODUCTION.** Local dev,
Render and Vercel all share one Neon instance. There is no staging database.
That is why this file exists and why step 2 is a Neon branch.

**Never run** `prisma migrate dev`, `prisma db push`, `prisma migrate reset`, or
the `pnpm db:migrate` / `db:push` / `db:reset` aliases. They are already refused
by `scripts/refuse-destructive.mjs`. Do not use the `:DANGEROUS` escape hatches
and do not set `I_KNOW_THIS_HITS_PRODUCTION`. The only migration command in this
runbook is `pnpm db:deploy`, which runs `prisma migrate deploy` — it applies
pending migrations and never resets, never drops and never offers to.

**The schema has known pre-existing drift** — an `ApprovalPolicy.updatedAt`
default, documented in the header of `20260903200000_shipping_zones/migration.sql`.
These three migrations deliberately do not touch it. If `migrate deploy` mentions
`ApprovalPolicy`, that is the known drift and not something these migrations
caused. It does not block `migrate deploy`.

### ⚠ The deployment-ordering hazard — the one thing that will bite you

Prisma Client selects **every** scalar column of a model on every read. The
client generated from this commit therefore names `User.sessionsValidAfter` and
`Order.goodsVatAmount` / `Order.shippingVatAmount` in its SQL.

**If application code carrying this client reaches production before these
migrations are applied, every query touching `User` or `Order` fails** with
Prisma error `P2022 — The column ... does not exist in the current database`.
That is sign-in, checkout and the order history, all at once.

This is not theoretical: it is exactly what the `@avenick/database` integration
test suite does against an unmigrated database today.

So the ordering is **migrations first, application deploy second — never the
reverse.** Render applies migrations in its `preDeployCommand`, so Render is
self-ordering. **Vercel is not** — `migrate-deploy-vercel.sh` runs only when
`VERCEL_ENV=production`. Complete step 5 of this runbook before you let a Vercel
production deployment of this commit go live.

---

## Step 0 — Preconditions

Run from the repository root, on the branch carrying these migrations.

```bash
cd /path/to/manzil
git status --short          # know what is in your tree; do not commit anything here
pnpm --filter @avenick/database db:manifest
git diff --stat packages/database/src/generated/migration-manifest.ts
```

**Expected:** `[manifest] 26 migrations`, and **no diff** on
`migration-manifest.ts`. A diff means the manifest was committed stale; commit
the regenerated file before deploying, or the readiness probe will under-report
what it expects.

Confirm the three directories exist and each holds exactly one file:

```bash
ls packages/database/prisma/migrations/20260905130000_mobile_identity_and_sessions \
   packages/database/prisma/migrations/20260905140000_user_sessions_valid_after \
   packages/database/prisma/migrations/20260905150000_order_vat_component_split
```

**Expected:** `migration.sql` under each. Nothing else.

---

## Step 1 — Capture the production connection string

In the Neon console: **Project → Connection Details**.

1. Set **Connection pooling** to **OFF**. The host must **not** contain
   `-pooler`. `migrate-deploy.sh` refuses a pooled URL outright, because a
   transaction pooler drops the advisory-lock connection `migrate deploy` holds
   and the failure surfaces as the unhelpful `PostgreSQL connection: kind: Closed`.
2. Copy the connection string somewhere you can read it back. You need it in
   step 6 to restore your `.env`.

Also back up your `.env` now, so restoring it later is a copy and not a retype:

```bash
cp .env .env.backup.$(date +%Y%m%d-%H%M%S)
```

---

## Step 2 — Branch production in Neon

Neon console → **Branches** → **Create branch**.

- **Parent:** your production branch (usually `main` or `production`).
- **Name:** `migrate-mobile-foundations-YYYYMMDD` — dated, so an abandoned
  branch is obviously stale to whoever finds it next.
- **Include data:** yes, from the current point in time. The whole point is to
  apply these migrations to production's **actual** state, drift included. An
  empty branch proves only that the SQL parses, which CI already proves against
  a virgin `postgres:15-alpine`.

Copy the branch's connection string, again with **Connection pooling OFF**.

**Sanity check before continuing:** the branch host must be different from the
production host you copied in step 1. If they are the same string, you copied
production. Stop and re-copy.

---

## Step 3 — Point DIRECT_URL at the branch

Edit `.env` and set **`DIRECT_URL`** to the **branch** connection string from
step 2. Leave `DATABASE_URL` alone — `migrate-deploy.sh` uses `DIRECT_URL`, and
changing both only widens the blast radius if you forget to restore one.

Verify you are pointed at the branch, and that it is unpooled, without printing
the password:

```bash
grep '^DIRECT_URL=' .env | sed -E 's#://[^@]*@#://***@#'
```

**Expected:** the **branch** host, and **no** `-pooler` in it. If you see the
production host, or you see `-pooler`, fix `.env` before continuing.

---

## Step 4 — Apply to the branch and verify

```bash
pnpm --filter @avenick/database db:deploy
```

**Expected:** `3 migrations found`, the three names listed as applied, and
`[migrate] migrations applied (or already up to date). ✅`.

The script retries up to five times with backoff — a first attempt failing on a
Neon cold-start resume is normal and self-heals. Five consecutive failures is
not; stop and read the error.

### Verify the schema actually changed

Open the Neon SQL editor **on the branch** (confirm the branch selector at the
top of the console says the branch name, not production) and run:

```sql
-- 1. All three tables exist.
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('RefreshToken','OtpChallenge','DeviceToken')
ORDER BY table_name;
-- Expect exactly 3 rows: DeviceToken, OtpChallenge, RefreshToken

-- 2. All three new columns exist, and are NULLABLE.
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE (table_name = 'User'  AND column_name = 'sessionsValidAfter')
   OR (table_name = 'Order' AND column_name IN ('goodsVatAmount','shippingVatAmount'))
ORDER BY table_name, column_name;
-- Expect 3 rows, every is_nullable = 'YES', every column_default = NULL

-- 3. No existing order was touched. Both must return 0.
SELECT count(*) AS backfilled FROM "Order"
WHERE "goodsVatAmount" IS NOT NULL OR "shippingVatAmount" IS NOT NULL;
SELECT count(*) AS cutoffs_set FROM "User" WHERE "sessionsValidAfter" IS NOT NULL;

-- 4. Nothing was lost. Compare against production's own counts.
SELECT (SELECT count(*) FROM "User")  AS users,
       (SELECT count(*) FROM "Order") AS orders,
       (SELECT count(*) FROM "Product") AS products;

-- 5. Every migration recorded as finished, none rolled back.
SELECT migration_name, finished_at, rolled_back_at
FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5;
-- Expect the three new names with a finished_at and a NULL rolled_back_at
```

Run query 4 against **production** too (Neon console, production branch — it is
a read-only `count(*)`) and confirm the numbers match the branch. If they do
not, the branch was not created with data, and step 4 proved nothing about
production's real state. Delete the branch and redo step 2.

**If `migrate deploy` failed on the branch: STOP.** It will fail the same way on
production. Do not proceed to step 5. Capture the full error, delete the branch,
restore `.env` (step 6), and hand the error to whoever wrote the migration.

---

## Step 5 — Restore `.env`, then apply to production

**Restore `.env` FIRST.** Applying to production with `.env` still pointing at
the branch is the failure mode this whole procedure exists to avoid, and the
symptom — everything succeeds, production is untouched — looks exactly like
success.

```bash
# restore from the backup you took in step 1
cp .env.backup.<the one you made> .env
grep '^DIRECT_URL=' .env | sed -E 's#://[^@]*@#://***@#'
```

**Expected:** the **production** host from step 1, unpooled, no `-pooler`.

Then apply through **one** pipeline. Pick whichever is normal for this release:

- **Preferred — Render.** Merge and let Render deploy. Its `preDeployCommand`
  runs `migrate-deploy.sh` before the new code serves traffic, which is the
  correct ordering for free. Watch the deploy log for the same
  `migrations applied ✅` line.
- **Manual, when you are applying migrations ahead of a Vercel release:**
  ```bash
  pnpm --filter @avenick/database db:deploy
  ```

**Expected:** the same three migrations applied, `✅`. Because you already
applied them to a branch of this exact database, there should be no surprises.

Do not run both. Applying through two pipelines at once is how two
`migrate deploy` processes end up contending for the same advisory lock.

### Verify production

Re-run verification queries 2, 3 and 5 from step 4, this time against
**production**. Then check the readiness probe, which compares
`_prisma_migrations` against the committed manifest:

```bash
curl -s https://<customer-host>/api/ready | jq '.migrations'
```

**Expected:** state `ready`, an empty `pending` array, and `expected` equal to
`applied` (26). A `pending` array naming any of the three means the migration
did not land — do not deploy application code until it reads `ready`.

Then confirm the real thing works: sign in on the web, open an existing order,
and place a test order. Sign-in exercises `User` and checkout exercises `Order`
— the two models these migrations touched.

---

## Step 6 — Delete the branch

Neon console → **Branches** → the branch from step 2 → **Delete**.

Do this even if something went wrong. A branch left behind holds a full copy of
production data and costs storage, and the next person to open the console
cannot tell a forgotten branch from a live one.

Then clean up your backups:

```bash
grep '^DIRECT_URL=' .env | sed -E 's#://[^@]*@#://***@#'   # confirm production, one last time
rm .env.backup.*
```

---

## Rollback

**Do not write a down-migration for these.** All three are additive, and none of
them is read by any application code at the time they are applied:

- The three new tables start empty and have no writer yet.
- `User.sessionsValidAfter` is NULL everywhere and must be read as "allow".
- `Order.goodsVatAmount` / `shippingVatAmount` are NULL everywhere and every
  existing total is unchanged.

So a bad application deploy is rolled back by **rolling back the application**,
not the schema. The columns and tables sitting unused cost nothing and break
nothing, and dropping a column from a live `User` or `Order` is a far more
dangerous operation than leaving it.

The only case for reverting the schema is a migration that applied *partially*.
`migrate deploy` runs each migration in a transaction, so a failed one leaves a
row in `_prisma_migrations` with `finished_at` NULL and its changes rolled back.
In that case: fix the SQL, do **not** hand-edit `_prisma_migrations`, and
restart this runbook from step 2 with a fresh branch.

---

## After the migrations are live

These three migrations are the **schema half** of two live defects. Neither is
fixed until the code half lands:

1. **Session revocation.** `guarded()` (`packages/auth/src/api.ts`) must compare
   the session token's issued-at against `User.sessionsValidAfter` — it already
   loads the user by primary key on every authenticated request, so this is one
   more field on an existing `select`, not a new query. The password-reset
   redeem route (`apps/customer/src/app/api/auth/password-reset/redeem/route.ts`)
   must set it. **Until both land, a stolen session cookie still survives a
   password reset for up to 30 days.**
2. **VAT split.** `services/orders.ts` (~line 486) currently does
   `const { vatAmount, total } = totals;` and drops the two components on the
   floor. It must persist `goodsVatAmount` and `shippingVatAmount` too. Orders
   placed between this migration and that change will have NULL components —
   correctly, since nothing computed and stored them.
