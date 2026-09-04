#!/usr/bin/env node
/**
 * Regenerates src/generated/migration-manifest.ts from prisma/migrations.
 * Run after adding a migration; the regression test fails CI if you forget.
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "prisma", "migrations");
const names = readdirSync(dir)
  .filter((n) => statSync(join(dir, n)).isDirectory())
  .sort();

const header = `/**
 * Every migration this build expects the database to have applied.
 *
 * Generated from prisma/migrations and COMMITTED, rather than read from disk at
 * runtime: a Next.js server bundle does not ship the migrations directory, so a
 * runtime read would find nothing and report "no drift" on every deployment —
 * the check would be permanently, silently green.
 *
 * migration-manifest.regression.test.ts asserts this list still equals the
 * directory, so adding a migration without regenerating fails CI instead of
 * quietly shrinking what the drift probe is able to notice.
 *
 * Regenerate with: pnpm --filter @avenick/database db:manifest
 */
export const EXPECTED_MIGRATIONS: readonly string[] = [
`;
writeFileSync(
  join(root, "src", "generated", "migration-manifest.ts"),
  header + names.map((n) => `  "${n}",`).join("\n") + "\n];\n",
);
console.log(`[manifest] ${names.length} migrations`);
