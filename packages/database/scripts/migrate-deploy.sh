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

# Warn (don't fail) if the migration URL looks pooled — a common misconfig.
if [[ "${DIRECT_URL}" == *"-pooler."* ]]; then
  echo "[migrate] WARNING: DIRECT_URL points at a POOLED endpoint (-pooler). " \
       "prisma migrate needs the DIRECT endpoint; set DIRECT_URL accordingly." >&2
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
