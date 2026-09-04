import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EXPECTED_MIGRATIONS } from "../generated/migration-manifest";

/**
 * The drift probe can only notice a missing migration that is on its list. If
 * someone adds a migration and does not regenerate the manifest, the probe goes
 * on reporting "ready" for a database that is missing exactly the migration the
 * new code needs — the check quietly stops covering the newest, riskiest change
 * while still looking green. This is the guard on the guard.
 */
describe("migration manifest", () => {
  it("lists exactly the migrations on disk", () => {
    const dir = join(fileURLToPath(new URL("../../", import.meta.url)), "prisma/migrations");
    const onDisk = readdirSync(dir)
      .filter((name) => statSync(join(dir, name)).isDirectory())
      .sort();

    expect(
      [...EXPECTED_MIGRATIONS],
      "manifest is stale — run: pnpm --filter @avenick/database db:manifest",
    ).toEqual(onDisk);
  });

  it("is ordered, so the pending list reads chronologically", () => {
    expect([...EXPECTED_MIGRATIONS]).toEqual([...EXPECTED_MIGRATIONS].sort());
  });
});
