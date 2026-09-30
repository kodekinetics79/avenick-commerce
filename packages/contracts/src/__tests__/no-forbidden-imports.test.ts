import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * This package must stay importable from anywhere — a route handler, a client
 * bundle, a plain Node script with no Prisma engine on disk, a codegen step.
 *
 * `@avenick/types`' barrel re-exports runtime enums from `@avenick/database`,
 * which drags the Prisma client and `@vercel/otel` into whatever bundle
 * imports it and fails a client build with "Can't resolve 'module'"; that is
 * why its consumers must remember the `/schemas` subpath. A convention nobody
 * can forget is better than one everybody must remember, so the rule is a test.
 *
 * `import type` is banned too, not only value imports. It erases at build time,
 * but it makes @avenick/database a dependency of this package's typecheck, and
 * that is the edge that grows back into a value import the first time someone
 * needs a runtime enum.
 */
const sourceRoot = path.resolve(import.meta.dirname, "..");

const FORBIDDEN = [
  "@prisma/client",
  "@avenick/database",
  "@avenick/types",
  "@avenick/auth",
  "@avenick/observability",
  "next",
  "react",
];

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/^\s*(?:import|export)\s+(?:type\s+)?[^"']*from\s+["']([^"']+)["']/gm)].map((match) => match[1]);
}

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return entry.name.endsWith(".ts") ? [absolute] : [];
  });
}

describe("dependency hygiene", () => {
  const files = sourceFiles(sourceRoot).filter((file) => !file.includes(`${path.sep}__tests__${path.sep}`));

  it("finds the sources it is meant to be checking", () => {
    expect(files.length).toBeGreaterThan(8);
  });

  it.each(files.map((file) => [path.relative(sourceRoot, file), file]))("%s imports nothing forbidden", (_label, file) => {
    const source = fs.readFileSync(file, "utf8");
    const specifiers = importSpecifiers(source);
    for (const specifier of specifiers) {
      const offending = FORBIDDEN.find((name) => specifier === name || specifier.startsWith(`${name}/`));
      expect(offending, `${path.relative(sourceRoot, file)} imports ${specifier}`).toBeUndefined();
    }
  });

  it("keeps the OpenAPI generator out of everything the barrel reaches", () => {
    // Imports, not raw text: this file and the barrel both NAME the generator
    // in prose explaining why they must not import it, and a substring check
    // would fail on the explanation rather than on the dependency.
    const reachable = files.filter((file) => !file.includes(`${path.sep}openapi${path.sep}`));
    for (const file of reachable) {
      const specifiers = importSpecifiers(fs.readFileSync(file, "utf8"));
      expect(specifiers, path.relative(sourceRoot, file)).not.toContain("@asteasolutions/zod-to-openapi");
    }
  });

  it("declares zod as its only runtime dependency", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, "..", "package.json"), "utf8"));
    expect(Object.keys(manifest.dependencies)).toEqual(["zod"]);
  });
});
