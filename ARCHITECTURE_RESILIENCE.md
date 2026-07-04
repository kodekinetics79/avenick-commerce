# Architecture — Resilience, DR & Data Protection

Living document for the production-grade non-functional architecture: backups,
disaster recovery, failover, and data protection. Pairs with
[OBSERVABILITY.md](OBSERVABILITY.md) (how we *see* failures) — this is how we
*survive* them.

Status legend: ✅ implemented · 🟡 partial · 🧩 configure (platform, not code) · ⬜ planned

---

## 1. Backups & Disaster Recovery

### Two independent backup tiers (defense in depth)

| Tier | Mechanism | RPO | Recovery speed | Survives |
| --- | --- | --- | --- | --- |
| **Neon PITR** 🧩 | Neon continuous WAL + history retention | seconds–minutes | fast (branch/restore in console) | accidental deletes, bad migrations |
| **Off-site dump** ✅ | Nightly `pg_dump` → S3 object storage | 24h (daily) | minutes–hours (pg_restore) | Neon account/region loss, provider outage |

The off-site tier is the one implemented in this repo and the one you fully
control — it does not depend on the DB provider staying reachable or solvent.

- **Backup**: [`scripts/backup-database.sh`](scripts/backup-database.sh), run
  nightly by the `avenick-db-backup` cron in [render.yaml](render.yaml). Dumps
  `-Fc` compressed from `DIRECT_URL`, streams to S3 via the app's own SigV4
  signer. Emits a `backup.success` JSON line; a non-zero exit = failed backup.
- **Restore**: [`scripts/restore-database.sh`](scripts/restore-database.sh).
  Downloads a chosen key, `pg_restore --clean --single-transaction` into a
  target, then prints row counts. Guarded by `RESTORE_CONFIRM=yes`.

### Targets (commitments)

| Metric | Target | Basis |
| --- | --- | --- |
| **RPO** (max data loss) | ≤ 24h off-site; ≤ 5 min via Neon PITR | daily dump cadence / Neon WAL |
| **RTO** (time to recover) | ≤ 1h to a working DB from off-site dump | pg_restore of pilot-sized data |

To tighten RPO on the off-site tier, raise the cron frequency (e.g. `0 */6 * * *`).

### Restore drill (REQUIRED — an untested backup is not a backup)

Run monthly, and after any schema change that could affect restore:

```bash
# 1. Pick the latest backup key (from the bucket / backup.success logs).
# 2. Restore into a SCRATCH database (never prod).
RESTORE_CONFIRM=yes S3_ENDPOINT=… S3_BUCKET=… S3_ACCESS_KEY=… S3_SECRET_KEY=… S3_REGION=… \
  scripts/restore-database.sh db-backups/avenick-<ts>.dump "postgresql://…/scratch"
# 3. Point a staging app at the scratch DB and smoke-test login + browse + an order.
# 4. Record the wall-clock restore time; confirm it is within RTO.
```

### Retention

Prune old dumps with an **S3 bucket lifecycle rule** (e.g. expire `db-backups/`
after `BACKUP_RETENTION_DAYS`). Done on the bucket, not in the script, so the
backup job's credentials never need list/delete permissions — least privilege.

---

## 2. Failover & Redundancy

| Concern | Status | Notes |
| --- | --- | --- |
| App instance failure | 🧩 | Every portal is a **single Starter instance** (always-on, but nothing to fail over to; Render restarts it on crash — that's downtime, not failover). **Configure** ≥2 instances (Standard plan or higher) so one dying instance fails over. |
| Region failure | 🧩 | Single region (`frankfurt`). Multi-region is a platform-tier decision; document acceptable RTO first. |
| DB unavailable (transient) | ✅ | Circuit breaker + timeout/retry + stale-read cache — see OBSERVABILITY.md "Graceful degradation". Reads degrade to cache; writes fail fast. |
| DB read scaling / failover | 🧩 | Add a **Neon read replica**; route `read()` traffic to it. The `read()`/`write()` split already isolates read paths for this. |
| Cold start / idle spin-down | ✅ | Avoided already: Starter is a paid, always-on tier — it was chosen precisely because the **free** tier spins down on idle (see render.yaml comment). Risk returns only if downgraded to free. |
| Resource saturation | 🟡 | Starter = 0.5 CPU / 512 MB per portal. Under real traffic this saturates before it crashes — watch `http.server.active_requests` and p99. Fix is the same plan upgrade. |

**Highest-impact next step is platform tier, not code**: upgrade at least the
customer portal to a plan with **≥2 instances** (instance failover + headroom),
and add a Neon read replica. That removes the single-instance failure mode on
the money path.

---

## 3. Data Protection

| Control | Status | Notes |
| --- | --- | --- |
| Password storage | ✅ | bcrypt (`passwordHash`). |
| Transport encryption | ✅ | HTTPS everywhere (Vercel/Render); Postgres over TLS (Neon). |
| Secrets management | 🟡 | Env vars (`sync:false`) today. **Planned**: dedicated secrets manager. |
| PII field encryption at rest | ✅ | AES-256-GCM helper [`@avenick/utils/crypto`](packages/utils/src/crypto.ts): versioned envelope, key rotation, tamper detection, blind-index for searchable fields. Opt-in via `PII_ENCRYPTION_KEYS`. |
| Right to access (export) | ✅ | `exportUserData()` → customer self-service at `/api/account/data-export`. Audited. |
| Right to erasure (be forgotten) | ✅ | `eraseUserData()` → admin `POST /api/admin/users/[id]/erase` (confirm-gated). Anonymises identity, keeps retained transactional records, audited. |
| Access audit | ✅ | Export + erasure both write to the audit trail (actor, subject, operation). |

**Applying field encryption to a column** (e.g. `User.phone`): store `encrypt(phone)`
for display and `blindIndex(phone)` for equality lookup, then read back through
`decrypt()`. The envelope is self-describing, so a column can migrate incrementally
(mixed plaintext/ciphertext reads correctly). Keys never leave the runtime; a
leaked DB dump yields only ciphertext.

---

## 4. Delivery / CDN

| Layer | Status | Notes |
| --- | --- | --- |
| Static assets / ISR | ✅ | Fronted by Vercel's edge CDN automatically. |
| Public catalog GETs | ✅ | `/api/products`, `/api/brands`, `/api/categories` now send `Cache-Control: public, s-maxage=…, stale-while-revalidate=…` so shared/edge caches serve them and refresh in the background. This also adds resilience: the edge can serve cached catalog if the origin briefly blips. |
| Authed / personalised APIs | ✅ (by design) | No shared caching — the data-export route sets `no-store, private`; authed responses are uncached. |

**Caveat / verify in prod**: the customer app rewrites `/api/*` to the Render
origin ([vercel.json](apps/customer/vercel.json)). Vercel's edge honours
`s-maxage` on proxied responses, but confirm cache HITs with `curl -I` against
the deployed URL (look for `x-vercel-cache: HIT`) once live, and adjust windows.
The `s-maxage`/`stale-while-revalidate` values are conservative starting points.

---

## Change log

- **Graceful degradation (GAP 1)** — DB circuit breaker, timeout/retry, stale
  cache fallback; `read()`/`write()` split; `/api/ready` reports circuit state.
- **Backup + DR (GAP 2)** — off-site nightly `pg_dump` → S3, tested restore
  script, RTO/RPO targets, restore-drill procedure.
- **Data protection (GAP 3)** — AES-256-GCM PII field encryption (rotation,
  tamper detection, blind index); GDPR/PDPL export (self-service) + erasure
  (admin, confirm-gated); both audited.
- **Status & downtime comms (GAP 4)** — public `/api/status` aggregator +
  standalone `/status` page; external uptime-monitor config
  ([`ops/observability/uptime-monitors.yaml`](ops/observability/uptime-monitors.yaml))
  hitting `/api/ready` from multiple regions, paging on 2× failures.
- **CDN / edge caching (GAP 5)** — `Cache-Control` (`s-maxage` +
  `stale-while-revalidate`) on public catalog GETs so the edge serves and
  revalidates them; authed responses stay uncached.
