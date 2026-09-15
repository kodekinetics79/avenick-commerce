import { readFileSync } from "node:fs";

import { globalsCssPath } from "../paths";

/**
 * These suites read the REAL packages/ui/src/globals.css rather than a fixture.
 *
 * A fixture would make them stable, and stable is exactly the wrong property
 * here: the job of this package is to fail when the stylesheet moves in a way it
 * cannot follow, and a test pinned to a copy of last month's stylesheet would go
 * on passing through precisely the change it exists to catch.
 */
export function readGlobalsCss(): string {
  return readFileSync(globalsCssPath(), "utf8");
}
