#!/usr/bin/env node

/**
 * CI gate: openapi.json must be what the schemas produce, right now.
 *
 * Modelled on scripts/verify-frontend-contracts.mjs — a plain Node script, run
 * from CI, that fails with the specific reason rather than a diff dump.
 *
 * The Flutter app's Dart models are generated from the committed openapi.json.
 * If a schema changes and the document is not regenerated, the generated
 * models keep describing the OLD server and nothing fails until a field is
 * missing at runtime on a phone. So the document is regenerated here, into a
 * temporary file, and compared byte for byte with what is committed. A
 * difference is not a warning: it means the committed contract is a lie about
 * the schemas in the same commit.
 *
 * It deliberately does NOT rewrite openapi.json. A gate that fixes the tree it
 * is checking passes on a machine where the fix never gets committed.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const packageRoot = path.resolve(import.meta.dirname, "..");
const committedPath = path.join(packageRoot, "openapi.json");
const failures = [];

function fail(message) {
  failures.push(message);
}

if (!fs.existsSync(committedPath)) {
  fail("openapi.json is not committed — run `pnpm --filter @avenick/contracts contracts:openapi`");
}

const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), "avenick-openapi-"));
const regeneratedPath = path.join(scratchDir, "openapi.json");
let regenerated = null;

try {
  // Regenerate into a scratch directory by pointing the emitter's package root
  // at it, so the working tree is never touched by the check itself.
  const script = `
    import fs from "node:fs";
    import { buildOpenApiDocument } from ${JSON.stringify(path.join(packageRoot, "src/openapi/document.ts"))};
    fs.writeFileSync(${JSON.stringify(regeneratedPath)}, JSON.stringify(buildOpenApiDocument(), null, 2) + "\\n", "utf8");
  `;
  const scriptPath = path.join(scratchDir, "regenerate.mts");
  fs.writeFileSync(scriptPath, script, "utf8");
  execFileSync("node", [path.join(packageRoot, "node_modules/tsx/dist/cli.mjs"), scriptPath], {
    cwd: packageRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  regenerated = fs.readFileSync(regeneratedPath, "utf8");
} catch (error) {
  fail(`openapi.json could not be regenerated: ${error.stderr?.toString().trim() || error.message}`);
}

if (regenerated !== null && failures.length === 0) {
  const committed = fs.readFileSync(committedPath, "utf8");
  if (committed !== regenerated) {
    const committedLines = committed.split("\n");
    const regeneratedLines = regenerated.split("\n");
    const firstDivergence = committedLines.findIndex((line, index) => line !== regeneratedLines[index]);
    fail(
      "openapi.json is stale — the committed document is not what the schemas generate. " +
        "Run `pnpm --filter @avenick/contracts contracts:openapi` and commit the result.",
    );
    if (firstDivergence >= 0) {
      fail(`first difference at line ${firstDivergence + 1}:`);
      fail(`  committed:   ${committedLines[firstDivergence] ?? "<end of file>"}`);
      fail(`  regenerated: ${regeneratedLines[firstDivergence] ?? "<end of file>"}`);
    }
  }
}

fs.rmSync(scratchDir, { recursive: true, force: true });

if (failures.length) {
  console.error(`openapi contract FAILED (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const document = JSON.parse(regenerated);
console.log(
  JSON.stringify(
    {
      status: "pass",
      openapi: document.openapi,
      paths: Object.keys(document.paths ?? {}).length,
      operations: Object.values(document.paths ?? {}).reduce((sum, item) => sum + Object.keys(item).length, 0),
      schemas: Object.keys(document.components?.schemas ?? {}).length,
    },
    null,
    2,
  ),
);
