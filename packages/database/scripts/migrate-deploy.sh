#!/usr/bin/env bash
#
# Resilient `prisma migrate deploy` for the Render preDeployCommand.
#
# Why this exists: Neon's serverless Postgres auto-suspends its compute after
# inactivity and takes a few seconds to resume. A deploy that fires migrations
# against a cold Neon endpoint can get its connection dropped mid-handshake —
# surfacing as `Error in PostgreSQL connection: kind: Closed`. The bare
# `prisma migrate deploy` gives that zero tolerance and fails the whole deploy,
# even when there are no migrations to apply. This wrapper retries with backoff
# so a cold-start resume self-heals instead of red-flagging the release.
#
# Migrations use the DIRECT (unpooled) connection — the pooler drops the long
# advisory-lock connection migrate needs. Falls back to DATABASE_URL only if
# DIRECT_URL is unset (works, but set DIRECT_URL to the direct endpoint in prod).
set -uo pipefail

export DIRECT_URL="${DIRECT_URL:-${DATABASE_URL:-}}"
if [[ -z "${DIRECT_URL}" ]]; then
  echo "[migrate] FATAL: neither DIRECT_URL nor DATABASE_URL is set" >&2
  exit 1
fi

# Fail fast on the #1 misconfig: a POOLED DIRECT_URL. Connection poolers in
# TRANSACTION mode drop the long advisory-lock connection `prisma migrate deploy`
# needs, which surfaces as the cryptic `PostgreSQL connection: kind: Closed`.
# Retrying a pooled URL can never succeed, so error clearly instead of burning
# retries.
#
# Detection must be provider-aware. Checking only for "-pooler." caught Neon and
# silently passed Supabase, whose pooler host is "<region>.pooler.supabase.com" —
# so a Supabase TRANSACTION pooler (port 6543) would sail through this guard and
# then fail deep inside migrate with an unhelpful error.
POOLED_REASON=""
case "${DIRECT_URL}" in
  # Neon: pooled endpoints carry "-pooler" in the hostname.
  *-pooler.*)            POOLED_REASON="hostname contains '-pooler' (Neon pooled endpoint)" ;;
  # Supabase: 6543 is the TRANSACTION pooler. 5432 is the SESSION pooler, which
  # holds a dedicated connection and DOES support migrations — allow that one.
  *pooler.supabase.com:6543*) POOLED_REASON="port 6543 is the Supabase TRANSACTION pooler" ;;
esac
# PgBouncer transaction mode is also signalled explicitly by Prisma's flag.
case "${DIRECT_URL}" in
  *pgbouncer=true*)      POOLED_REASON="URL sets pgbouncer=true (transaction pooling)" ;;
esac

if [[ -n "${POOLED_REASON}" ]]; then
  echo "[migrate] FATAL: DIRECT_URL points at a POOLED endpoint — ${POOLED_REASON}." >&2
  echo "[migrate] Migrations need a session-scoped connection." >&2
  echo "[migrate] Neon:     Connect dialog -> Connection Pooling OFF -> host has no '-pooler'." >&2
  echo "[migrate] Supabase: use the SESSION pooler on port 5432 (not 6543), or the" >&2
  echo "[migrate]           direct db.<ref>.supabase.co host if your platform has IPv6." >&2
  echo "[migrate] Keep DATABASE_URL pooled for the app runtime; only DIRECT_URL must be direct." >&2
  exit 1
fi

ATTEMPTS="${MIGRATE_MAX_ATTEMPTS:-5}"
SLEEP="${MIGRATE_BACKOFF_SECONDS:-6}"

for i in $(seq 1 "${ATTEMPTS}"); do
  echo "[migrate] prisma migrate deploy — attempt ${i}/${ATTEMPTS}"
  if npx --no-install prisma migrate deploy; then
    echo "[migrate] migrations applied (or already up to date). ✅"
    exit 0
  fi
  if [[ "${i}" -lt "${ATTEMPTS}" ]]; then
    echo "[migrate] attempt ${i} failed (likely Neon cold-start). Retrying in ${SLEEP}s…" >&2
    sleep "${SLEEP}"
  fi
done

echo "[migrate] FATAL: migrate deploy failed after ${ATTEMPTS} attempts" >&2
exit 1
