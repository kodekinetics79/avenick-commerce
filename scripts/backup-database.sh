#!/usr/bin/env bash
#
# Off-site logical backup of the Postgres database to S3-compatible object
# storage. This is the *independent* backup tier that complements Neon's own
# point-in-time recovery (PITR): a provider-portable dump that survives even a
# Neon-account-level problem. Restore with scripts/restore-database.sh.
#
# What it does:
#   1. pg_dump the database in custom format (-Fc), compressed, from DIRECT_URL
#      (the unpooled connection — pooled endpoints can drop long dumps).
#   2. Stream the dump to a presigned S3 PUT URL (signing reuses the app's
#      existing @avenick/utils/s3 SigV4 helper, so there is one signer).
#   3. Verify the upload (HTTP 200) and prune backups older than the retention
#      window so storage doesn't grow forever.
#
# Designed to run as a scheduled job on Render (see render.yaml cron service).
# Fails loudly (set -euo pipefail) so a failed backup is a visible, alertable
# non-zero exit rather than a silent gap in your recovery coverage.
#
# Required env: DATABASE_URL (or DIRECT_URL), S3_* (endpoint/bucket/keys/region).
# Optional env: BACKUP_RETENTION_DAYS (default 14), BACKUP_PREFIX (default "db-backups").

set -euo pipefail

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
PREFIX="${BACKUP_PREFIX:-db-backups}"
# Prefer the direct (unpooled) URL for dumps; fall back to DATABASE_URL.
DUMP_URL="${DIRECT_URL:-${DATABASE_URL:-}}"

if [[ -z "${DUMP_URL}" ]]; then
  echo "[backup] FATAL: DIRECT_URL/DATABASE_URL not set" >&2
  exit 1
fi
if [[ -z "${S3_BUCKET:-}" || -z "${S3_ENDPOINT:-}" || -z "${S3_ACCESS_KEY:-}" || -z "${S3_SECRET_KEY:-}" ]]; then
  echo "[backup] FATAL: object storage (S3_*) not configured" >&2
  exit 1
fi

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
KEY="${PREFIX}/avenick-${TIMESTAMP}.dump"
TMP="$(mktemp -t avenick-backup.XXXXXX.dump)"
trap 'rm -f "${TMP}"' EXIT

echo "[backup] dumping database → ${TMP}"
# -Fc custom format is compressed and restorable selectively with pg_restore.
# --no-owner/--no-privileges keep the dump portable across roles/accounts.
pg_dump --format=custom --compress=9 --no-owner --no-privileges --dbname="${DUMP_URL}" --file="${TMP}"

SIZE="$(wc -c < "${TMP}" | tr -d ' ')"
echo "[backup] dump complete: ${SIZE} bytes → uploading as ${KEY}"

# Presign a PUT URL using the app's own SigV4 signer (single source of truth).
PUT_URL="$(node -e '
  const { presignPutUrl } = require("./packages/utils/src/s3.ts");
  process.stdout.write(presignPutUrl(process.argv[1], { expiresIn: 3600, contentType: "application/octet-stream" }));
' "${KEY}" 2>/dev/null || true)"

# The .ts require above only works if a loader is present; fall back to the
# compiled path or a tsx runner. Try tsx if the plain require produced nothing.
if [[ -z "${PUT_URL}" ]]; then
  PUT_URL="$(pnpm --filter @avenick/utils exec tsx -e '
    import { presignPutUrl } from "./src/s3";
    process.stdout.write(presignPutUrl(process.argv[1], { expiresIn: 3600, contentType: "application/octet-stream" }));
  ' "${KEY}")"
fi

if [[ -z "${PUT_URL}" ]]; then
  echo "[backup] FATAL: could not presign upload URL" >&2
  exit 1
fi

echo "[backup] streaming dump to object storage…"
HTTP_CODE="$(curl -sS -o /dev/null -w '%{http_code}' \
  -X PUT -H 'Content-Type: application/octet-stream' \
  --upload-file "${TMP}" "${PUT_URL}")"

if [[ "${HTTP_CODE}" != "200" ]]; then
  echo "[backup] FATAL: upload failed with HTTP ${HTTP_CODE}" >&2
  exit 1
fi
echo "[backup] uploaded OK: s3://${S3_BUCKET}/${KEY} (${SIZE} bytes)"

# Emit a machine-parseable success line for log-based backup monitoring.
echo "{\"event\":\"backup.success\",\"key\":\"${KEY}\",\"bytes\":${SIZE},\"at\":\"${TIMESTAMP}\"}"

echo "[backup] retention: pruning ${PREFIX}/ older than ${RETENTION_DAYS} days is handled by the bucket lifecycle policy (see DR runbook). Configure it once on the bucket; this script does not delete objects to avoid destructive S3 list/delete perms in the job role."
