import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const authSrc = resolve(here, "..");
const repoRoot = resolve(here, "../../../..");

/**
 * Middleware runs in the edge runtime, which cannot execute the Prisma client.
 *
 * Every portal returned HTTP 500 on every request in a production build because
 * two modules that end up inside the middleware bundle imported the generated
 * `UserRole` OBJECT from @avenick/database, and each app's middleware.ts
 * imported the NextAuth instance — whose credentials provider reaches the
 * database. Prisma threw while the bundle was still initialising, Next re-ran
 * the module in the same VM context, and the second failure surfaced as
 * `TypeError: Cannot redefine property: __import_unsupported`, which named
 * nothing that was actually wrong.
 *
 * `next build` does not fail on this and no unit test ran a production server,
 * so nothing caught it. These assertions are the cheap guard: they fail the
 * moment a runtime import creeps back into the middleware graph.
 */
const EDGE_MODULES = ["middleware.ts", "remote-session.ts"];

describe("edge runtime safety", () => {
  it.each(EDGE_MODULES)("%s imports @avenick/database for types only", (file) => {
    const source = readFileSync(resolve(authSrc, file), "utf8");
    const databaseImports = [...source.matchAll(/^import\s+(type\s+)?\{[^}]*\}\s+from\s+"@avenick\/database";/gm)];
    expect(databaseImports.length).toBeGreaterThan(0);
    for (const match of databaseImports) {
      // `import type` is erased at compile time; a value import is not, and
      // pulls the whole Prisma client into the edge bundle.
      expect(match[1], `value import of @avenick/database in ${file}: ${match[0]}`).toBeDefined();
    }
  });

  it.each(EDGE_MODULES)("%s never reads a Prisma enum object at runtime", (file) => {
    const source = readFileSync(resolve(authSrc, file), "utf8");
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(withoutComments).not.toMatch(/Object\.(values|keys|entries)\(\s*UserRole\s*\)/);
    // `UserRole.CONSUMER` and friends dereference the generated object, which is
    // a runtime import even when the surrounding import is written as a type.
    expect(withoutComments).not.toMatch(/\bUserRole\.[A-Z_]+/);
  });

  it("no portal middleware imports the NextAuth instance", () => {
    for (const app of ["customer", "seller", "admin"]) {
      const source = readFileSync(resolve(repoRoot, "apps", app, "src/middleware.ts"), "utf8");
      const withoutComments = source.replace(/^\s*\/\/.*$/gm, "");
      expect(withoutComments, `${app}/src/middleware.ts`).not.toMatch(/from\s+"@\/lib\/auth-instance"/);
      expect(withoutComments, `${app}/src/middleware.ts`).not.toMatch(/from\s+"@avenick\/auth"/);
    }
  });

  it("the role list the middleware validates against covers every schema role", () => {
    // The compile-time fence in remote-session.ts is the real guard; this
    // asserts the list has not been trimmed to make that fence pass.
    const source = readFileSync(resolve(authSrc, "remote-session.ts"), "utf8");
    const schema = readFileSync(resolve(repoRoot, "packages/database/prisma/schema.prisma"), "utf8");
    const enumBlock = schema.match(/enum\s+UserRole\s*\{([^}]*)\}/);
    expect(enumBlock).not.toBeNull();
    const roles = enumBlock![1]!.split("\n").map((line) => line.trim()).filter((line) => /^[A-Z_]+$/.test(line));
    expect(roles.length).toBeGreaterThan(0);
    for (const role of roles) {
      expect(source, `role ${role} missing from the middleware's accepted list`).toContain(`"${role}"`);
    }
  });
});
