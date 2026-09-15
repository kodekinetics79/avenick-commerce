/**
 * Where things are.
 *
 * Resolved by walking up for `pnpm-workspace.yaml` rather than from
 * `import.meta.url`, because this package is run three ways — `tsx` (CJS
 * transpile, no `import.meta`), vitest, and turbo — and the only thing all
 * three agree on is that we are somewhere inside the workspace.
 */

import { existsSync } from "node:fs";
import path from "node:path";

/** Absolute path to the monorepo root. */
export function repoRoot(from: string = process.cwd()): string {
  let current = path.resolve(from);
  for (;;) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) return current;
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(
        `Could not find pnpm-workspace.yaml above ${from}. @avenick/design-tokens has to be run from ` +
          "inside the monorepo so it can read packages/ui/src/globals.css.",
      );
    }
    current = parent;
  }
}

/** The single source of truth, relative to the repo root. */
export const GLOBALS_CSS_RELATIVE = "packages/ui/src/globals.css";

/** The generated Flutter theme, relative to the repo root. */
export const DART_OUTPUT_RELATIVE = "apps/mobile/lib/theme/tokens.g.dart";

/** The plain JSON extraction, relative to the repo root. */
export const JSON_OUTPUT_RELATIVE = "packages/design-tokens/dist/tokens.json";

/** The typed TS re-export, relative to the repo root. */
export const TS_OUTPUT_RELATIVE = "packages/design-tokens/src/generated/tokens.ts";

export function globalsCssPath(root: string = repoRoot()): string {
  return path.join(root, GLOBALS_CSS_RELATIVE);
}
