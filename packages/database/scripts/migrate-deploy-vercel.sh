#!/usr/bin/env bash
#
# `prisma migrate deploy` for a Vercel build — PRODUCTION DEPLOYMENTS ONLY.
#
# Vercel runs no migration step of its own, so a Vercel deployment can go live
# carrying code whose queries name a column the database does not have yet.
# Render applies migrations before each of its own deploys, but the two
# platforms deploy the same commit independently and nothing orders them.
#
# The guard is the whole point of this file. Vercel builds every pull request as
# a PREVIEW, and previews inherit the project's environment variables —
# including DATABASE_URL, which points at the single Neon instance that IS
# production. Wiring migrations into the build command unguarded would therefore
# apply a schema change to production the moment somebody OPENS a pull request,
# days before anyone reviewed it. That is worse than not migrating at all: a
# change nobody approved, triggered by an action that is supposed to carry no
# consequence.
#
# So: production migrates, everything else says plainly that it did not and why.
# A skip is printed rather than silent, because a build log that shows nothing
# is indistinguishable from one where the step was quietly dropped.
set -uo pipefail

if [[ "${VERCEL_ENV:-}" != "production" ]]; then
  echo "[migrate] SKIPPED — VERCEL_ENV='${VERCEL_ENV:-unset}', not 'production'."
  echo "[migrate] Preview and development builds share production's DATABASE_URL."
  echo "[migrate] They must never migrate it. Production deployments do."
  exit 0
fi

echo "[migrate] VERCEL_ENV=production — applying migrations."
exec bash "$(dirname "${BASH_SOURCE[0]}")/migrate-deploy.sh"
