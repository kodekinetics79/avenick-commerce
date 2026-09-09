#!/usr/bin/env node
/**
 * A refusal, not a script.
 *
 * `prisma migrate dev`, `prisma db push` and `prisma migrate reset` are all
 * safe against a scratch database and catastrophic against this one. There is
 * no scratch database here: DATABASE_URL and DIRECT_URL in .env both point at
 * the production Neon instance that local dev, Render and Vercel all share.
 *
 * Three facts make the combination fatal rather than merely risky:
 *
 *   1. schema.prisma declares no `shadowDatabaseUrl`, so `migrate dev` creates
 *      and drops its shadow database on the SAME server as production.
 *   2. The schema has known pre-existing drift — an ApprovalPolicy default,
 *      documented in the header of migrations/20260903200000_shipping_zones.
 *   3. On detecting drift, `migrate dev` offers to RESET the database. The
 *      operator is then one keystroke from deleting the business.
 *
 * So these entry points refuse. The real commands still exist under explicit
 * names (see below) and require you to say, in an environment variable, that
 * you know which database you are pointed at.
 *
 * Adding a table? Follow the safe path instead:
 *
 *   1. Hand-write additive SQL — CREATE TABLE, indexes, foreign keys. Never
 *      ALTER or DROP in the same migration as an addition. Use
 *      migrations/20260903200000_shipping_zones as the template; it explains
 *      in its own header why it was hand-written.
 *   2. Prove it replays from empty: CI already does this against a virgin
 *      postgres:15-alpine service.
 *   3. Prove it applies to production's ACTUAL state: create a Neon branch,
 *      point DIRECT_URL at the branch, run `pnpm db:deploy`, delete the branch.
 *      This is the step that catches drift, and it costs minutes.
 *   4. Regenerate the manifest: `pnpm --filter @avenick/database db:manifest`.
 *   5. Apply through ONE pipeline. Not seven.
 *
 * To revert this guard: restore the original commands in package.json.
 * They are preserved verbatim in the escape hatches below.
 */

const ESCAPE = {
  "db:migrate": {
    real: "prisma migrate dev",
    hatch: "db:migrate:DANGEROUS",
    why: "creates a shadow database on the production server and offers to reset on drift",
  },
  "db:push": {
    real: "prisma db push",
    hatch: "db:push:DANGEROUS",
    why: "silently drops columns and tables to make the database match the schema",
  },
  "db:reset": {
    real: "prisma migrate reset --force",
    hatch: "db:reset:DANGEROUS",
    why: "drops and recreates every table, with --force so it does not even ask",
  },
};

const name = process.argv[2] ?? "this command";
const entry = ESCAPE[name] ?? { real: "the underlying Prisma command", hatch: `${name}:DANGEROUS`, why: "is destructive" };

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

console.error(`
${red(bold("REFUSED"))}  ${bold(`pnpm ${name}`)}  ${dim(`(${entry.real})`)}

  This repository's DATABASE_URL points at ${bold("production")}.
  Local dev, Render and Vercel all share one Neon instance, and
  schema.prisma declares no shadowDatabaseUrl.

  ${entry.real} ${entry.why}.

${bold("To add or change a table, use the safe path:")}

  1. Hand-write additive SQL in packages/database/prisma/migrations/
     Template: migrations/20260903200000_shipping_zones/migration.sql
  2. CI replays it from an empty database automatically.
  3. Prove it against production's real state on a ${bold("Neon branch")}:
       - branch production in the Neon console
       - point DIRECT_URL at the branch
       - pnpm --filter @avenick/database db:deploy
       - delete the branch
  4. pnpm --filter @avenick/database db:manifest
  5. Deploy through one pipeline.

${dim(`If you genuinely need the raw command and you know which database you are`)}
${dim(`pointed at, the escape hatch is:`)}

    ${dim("I_KNOW_THIS_HITS_PRODUCTION=1 pnpm --filter @avenick/database " + entry.hatch)}

${dim("Guard: packages/database/scripts/refuse-destructive.mjs")}
`);

process.exit(1);
