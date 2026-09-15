#!/usr/bin/env node
/**
 * Gate for the destructive Prisma escape hatches.
 *
 * Requires I_KNOW_THIS_HITS_PRODUCTION=1 and prints the host it is about to
 * act on, so the acknowledgement is informed rather than reflexive. Pairs with
 * scripts/refuse-destructive.mjs.
 */

if (process.env.I_KNOW_THIS_HITS_PRODUCTION !== "1") {
  console.error(
    "\n\x1b[31m\x1b[1mBLOCKED\x1b[0m  set I_KNOW_THIS_HITS_PRODUCTION=1 to run a destructive Prisma command.\n" +
      "        First read: packages/database/scripts/refuse-destructive.mjs\n",
  );
  process.exit(1);
}

// Show which database is about to be hit. Never print credentials.
const raw = process.env.DIRECT_URL || process.env.DATABASE_URL || "";
let target = "UNKNOWN — no DIRECT_URL or DATABASE_URL in the environment";
try {
  if (raw) {
    const u = new URL(raw);
    target = `${u.hostname}${u.pathname}`;
  }
} catch {
  target = "UNPARSEABLE connection string";
}

const looksProd = /neon\.tech|render\.com|amazonaws\.com/i.test(target);

console.error(
  `\n\x1b[33m\x1b[1mPROCEEDING\x1b[0m against: \x1b[1m${target}\x1b[0m` +
    (looksProd
      ? "\n\x1b[31m           This host looks like a MANAGED/REMOTE database, not a local one.\x1b[0m"
      : "") +
    "\n",
);
