import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appRoot = fileURLToPath(new URL("../../../", import.meta.url));

describe("readiness route", () => {
  /**
   * The readiness route must allow the database probe its cold-start budget.
   *
   * runProbe races every dependency against the spec's own ceiling, so leaving
   * this at the 3s default aborts the first probe after boot — while Neon's
   * compute is still resuming — and answers 503. Render gates the deploy on
   * this route, so that 503 is read as a failed deploy and the release is
   * rolled back in favour of the already-warm previous version. Fixing the
   * probe's internal budget alone would not have fixed the outage; this
   * asserts the caller's half.
   */
  it("gives the database probe its published cold-start ceiling", () => {
    const route = readFileSync(join(appRoot, "src/app/api/ready/route.ts"), "utf8");
    const start = route.indexOf("database: {");
    expect(start, "no database probe in the readiness route").toBeGreaterThan(-1);
    const spec = route.slice(start, route.indexOf("}", start));
    expect(spec).toContain("critical: true");
    expect(spec, "database probe does not allow the cold-start budget").toContain(
      "timeoutMs: DB_HEALTH_PROBE_TIMEOUT_MS",
    );
  });
});
