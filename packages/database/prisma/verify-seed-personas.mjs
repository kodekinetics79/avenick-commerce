/**
 * Assert that the seeded personas exist and that their stored password matches
 * the one the browser suite will type. Runs after `db:seed`, before any browser
 * starts.
 *
 * The authenticated suite signs personas in through the real login form, so a
 * mismatch here surfaces as "Invalid email or password" on a screenshot — a
 * message that cannot distinguish "this account was never seeded" from "the
 * seed and the suite disagree about the password" from "the account is not
 * ACTIVE". Each of those has a different fix, and the UI reports all three
 * identically. This step names which one it is, at the point the data is
 * created rather than fifteen minutes later in a browser.
 *
 * It reads the persona list from the suite itself, so the two cannot drift.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERSONAS } from "../../e2e/personas.mjs";

const password = process.env.E2E_SEED_PASSWORD?.trim() || process.env.SEED_PASSWORD?.trim() || "";
if (!password) {
  console.error(
    "verify-seed-personas: neither E2E_SEED_PASSWORD nor SEED_PASSWORD is set.\n" +
      "The seed hashes with SEED_PASSWORD and the suite types E2E_SEED_PASSWORD; " +
      "both must carry the same value.",
  );
  process.exit(1);
}

const db = new PrismaClient();
const problems = [];

for (const [key, persona] of Object.entries(PERSONAS)) {
  const user = await db.user.findUnique({
    where: { email: persona.email },
    select: { email: true, role: true, status: true, passwordHash: true, deletedAt: true },
  });

  if (!user) {
    problems.push(`${key}: ${persona.email} was not created by the seed`);
    continue;
  }
  if (user.deletedAt) {
    problems.push(`${key}: ${persona.email} is soft-deleted, so authorize() will refuse it`);
    continue;
  }
  if (user.status !== "ACTIVE") {
    problems.push(`${key}: ${persona.email} has status ${user.status}; authorize() only admits ACTIVE`);
    continue;
  }
  if (persona.role && user.role !== persona.role) {
    problems.push(`${key}: ${persona.email} has role ${user.role}, but the suite expects ${persona.role}`);
    continue;
  }
  if (!user.passwordHash) {
    problems.push(`${key}: ${persona.email} has no password hash`);
    continue;
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    problems.push(
      `${key}: ${persona.email} exists but its stored hash does not match the run's password. ` +
        `The seed upserts users with \`update: {}\`, so an account that already existed keeps its ` +
        `OLD password — seeding a database that is not empty will reproduce this.`,
    );
    continue;
  }
  console.log(`  ✓ ${persona.email} (${user.role})`);
}

await db.$disconnect();

if (problems.length > 0) {
  console.error("\nverify-seed-personas FAILED:\n" + problems.map((p) => `  ✗ ${p}`).join("\n"));
  process.exit(1);
}
console.log(`verify-seed-personas: all ${Object.keys(PERSONAS).length} personas can sign in.`);
