#!/usr/bin/env bash
#
# Restore the database from an off-site backup produced by backup-database.sh.
# This is the half of a backup plan people forget to test — an untested restore
# is not a backup. Run this against a SCRATCH database as a periodic drill (see
# the DR runbook for the schedule and RTO/RPO targets).
#
# Usage:
#   scripts/restore-database.sh <s3-key> <target-database-url>
#
#   <s3-key>              e.g. db-backups/avenick-20260703T120000Z.dump
#   <target-database-url> the DB to restore INTO. NEVER a production URL unless
#                         you are intentionally performing DR recovery.
#
# Safety: this script refuses to run unless RESTORE_CONFIRM=yes is set, because
# pg_restore --clean drops and recreates objects in the target.
#
# Required env: S3_* (to download the backup). RESTORE_CONFIRM=yes to proceed.

set -euo pipefail

KEY="${1:-}"
TARGET_URL="${2:-}"

if [[ -z "${KEY}" || -z "${TARGET_URL}" ]]; then
  echo "usage: $0 <s3-key> <target-database-url>" >&2
  exit 2
fi
if [[ "${RESTORE_CONFIRM:-}" != "yes" ]]; then
  echo "[restore] REFUSING: set RESTORE_CONFIRM=yes to confirm a destructive restore into:" >&2
  echo "          ${TARGET_URL}" >&2
  exit 3
fi
if [[ -z "${S3_BUCKET:-}" || -z "${S3_ENDPOINT:-}" || -z "${S3_ACCESS_KEY:-}" || -z "${S3_SECRET_KEY:-}" ]]; then
  echo "[restore] FATAL: object storage (S3_*) not configured" >&2
  exit 1
fi

TMP="$(mktemp -t avenick-restore.XXXXXX.dump)"
trap 'rm -f "${TMP}"' EXIT

# Presign a GET URL with the app's SigV4 signer for a private-bucket download.
echo "[restore] presigning download for ${KEY}"
GET_URL="$(pnpm --filter @avenick/utils exec tsx -e '
  import { presignGetUrl } from "./src/s3";
  process.stdout.write(presignGetUrl(process.argv[1], { expiresIn: 3600 }));
' "${KEY}")"

if [[ -z "${GET_URL}" ]]; then
  echo "[restore] FATAL: could not presign download URL" >&2
  exit 1
fi

echo "[restore] downloading backup…"
HTTP_CODE="$(curl -sS -o "${TMP}" -w '%{http_code}' "${GET_URL}")"
if [[ "${HTTP_CODE}" != "200" ]]; then
  echo "[restore] FATAL: download failed with HTTP ${HTTP_CODE}" >&2
  exit 1
fi
echo "[restore] downloaded $(wc -c < "${TMP}" | tr -d ' ') bytes"

echo "[restore] restoring into target (pg_restore --clean --if-exists)…"
# --clean --if-exists drops existing objects first so the restore is idempotent.
# --no-owner keeps it portable. Single-transaction so a failure rolls back whole.
pg_restore --clean --if-exists --no-owner --single-transaction \
  --dbname="${TARGET_URL}" "${TMP}"

echo "[restore] verifying row counts on key tables…"
psql "${TARGET_URL}" -c "SELECT
  (SELECT count(*) FROM \"User\")   AS users,
  (SELECT count(*) FROM \"Product\") AS products,
  (SELECT count(*) FROM \"Order\")   AS orders;" || true

echo "{\"event\":\"restore.success\",\"key\":\"${KEY}\",\"at\":\"$(date -u +%Y%m%dT%H%M%SZ)\"}"
echo "[restore] done. Validate the app against this database before promoting it."
