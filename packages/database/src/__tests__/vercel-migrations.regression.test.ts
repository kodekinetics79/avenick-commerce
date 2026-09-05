import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

/**
 * Vercel runs no migration step of its own. A Vercel deployment could therefore
 * go live carrying code whose queries name a column the database does not have
 * yet — Render migrates before its own deploys, but the two platforms ship the
 * same commit independently and nothing orders them.
 *
 * The step is one line in a build command, which is exactly the kind of thing
 * that gets dropped during an unrelated edit and noticed a release later.
 */
describe("vercel build applies migrations", () => {
  it.each(["customer", "seller", "admin"])("%s runs the guarded migration step", (app) => {
    const config = JSON.parse(
      readFileSync(join(repoRoot, `apps/${app}/vercel.json`), "utf8"),
    ) as { buildCommand: string };

    expect(config.buildCommand).toContain("db:deploy:vercel");

    // The GUARDED entrypoint, never the bare one. migrate-deploy.sh applies
    // migrations unconditionally, and Vercel builds every pull request as a
    // preview using production's DATABASE_URL — so the bare script here would
    // migrate production the moment someone opened a PR.
    expect(
      config.buildCommand,
      "must call the guarded wrapper, not the unconditional migrate script",
    ).not.toMatch(/db:deploy(?!:vercel)/);

    // Migrations must precede the build, not follow it.
    expect(config.buildCommand.indexOf("db:deploy:vercel")).toBeLessThan(
      config.buildCommand.indexOf("turbo run build"),
    );
  });

  it("the wrapper refuses to migrate anything but a production deployment", () => {
    const script = readFileSync(
      join(repoRoot, "packages/database/scripts/migrate-deploy-vercel.sh"),
      "utf8",
    );
    expect(script).toMatch(/VERCEL_ENV.*!=.*production/);
    // It must EXIT on the non-production path. A guard that only logs and falls
    // through would migrate production from every preview build.
    expect(script).toMatch(/exit 0/);
  });
});
