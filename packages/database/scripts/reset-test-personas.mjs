#!/usr/bin/env node
/**
 * Set a known password on the SEEDED TEST PERSONAS, and nothing else.
 *
 * Why this exists: the seed hashes with bcrypt, so the password it used cannot
 * be read back out of the database by anyone — not the operator, not an
 * attacker, not the person who ran it. The value that seeded this database was
 * either typed once at a shell or minted and masked inside a CI run, and in
 * both cases it is gone. Without it the authenticated journeys — buyer
 * checkout, seller fulfilment, admin approval — cannot be exercised at all.
 *
 * WHAT IT WILL TOUCH, and the guard that keeps it there: only accounts whose
 * email ends in the TEST_DOMAIN below. Every seeded persona uses it and no real
 * customer can, because it is not a routable domain. The filter is applied in
 * the query rather than checked afterwards, so a mistake cannot widen it, and
 * the script prints every account it is about to change and refuses to touch
 * one it was not asked for by name.
 *
 * It does NOT reseed, migrate, delete, or alter any other column. It writes
 * passwordHash on a fixed list of addresses.
 *
 *   TEST_PERSONA_PASSWORD='<choose one>' node packages/database/scripts/reset-test-personas.mjs apply
 *
 * `status` (the default) lists the accounts and changes nothing.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const TEST_DOMAIN = "@avenick.test";

/** Exactly the personas the journey suite signs in as, one per role. */
const PERSONAS = [
  "buyer@avenick.test",
  "cert-buyer@avenick.test",
  "cert-company-admin@avenick.test",
  "cert-company-approver@avenick.test",
  "cert-seller-a-owner@avenick.test",
  "cert-seller-a-catalog@avenick.test",
  "admin@avenick.test",
];

const mode = process.argv[2] ?? "status";
const db = new PrismaClient();

// Belt and braces: the constant is checked, not assumed, so an edit that
// widened it would fail here rather than in production.
if (!PERSONAS.every((email) => email.endsWith(TEST_DOMAIN))) {
  console.error(`[personas] FATAL: every target must end in ${TEST_DOMAIN}`);
  process.exitCode = 1;
} else if (mode === "status" || mode === "apply") {
  const rows = await db.user.findMany({
    where: { email: { in: PERSONAS, mode: "insensitive" }, AND: [{ email: { endsWith: TEST_DOMAIN } }] },
    select: { email: true, role: true, status: true },
    orderBy: { email: "asc" },
  });

  console.log(`[personas] ${rows.length} of ${PERSONAS.length} target accounts exist:`);
  for (const r of rows) console.log(`  ${r.email.padEnd(38)} ${r.role.padEnd(18)} ${r.status}`);
  const missing = PERSONAS.filter((e) => !rows.some((r) => r.email.toLowerCase() === e));
  if (missing.length) console.log(`[personas] not present (skipped): ${missing.join(", ")}`);

  if (mode === "apply") {
    const password = process.env.TEST_PERSONA_PASSWORD?.trim();
    if (!password || password.length < 12) {
      console.error("[personas] FATAL: set TEST_PERSONA_PASSWORD to at least 12 characters.");
      console.error("[personas] No default is offered. A password written into a script is a published one.");
      process.exitCode = 1;
    } else {
      // Same cost factor the seed uses, so these hashes are indistinguishable
      // from seeded ones and nothing downstream can tell them apart.
      const passwordHash = await bcrypt.hash(password, 12);
      const result = await db.user.updateMany({
        where: { email: { in: rows.map((r) => r.email) }, AND: [{ email: { endsWith: TEST_DOMAIN } }] },
        data: { passwordHash },
      });
      console.log(`[personas] password set on ${result.count} test accounts. ✅`);
      console.log("[personas] Nothing else was modified. Real customer accounts cannot match the filter.");
    }
  }
} else {
  console.error(`usage: [TEST_PERSONA_PASSWORD=...] node ${process.argv[1]} status|apply`);
  process.exitCode = 1;
}

await db.$disconnect();
