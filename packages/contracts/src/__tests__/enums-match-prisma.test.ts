import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PRISMA_ENUM_MIRRORS } from "../enums";

/**
 * The enum drift gate.
 *
 * `@avenick/types/schemas` proves its lists match Prisma with a type-level
 * `Exact<>` assertion, which needs an `import type` edge to `@avenick/database`
 * and therefore a generated client on disk. This package keeps no edge to the
 * database package at all, so it proves the same thing by reading
 * schema.prisma — the actual authority — and comparing the members.
 *
 * A value in Prisma that this package omits is a state the app can never
 * render; a value here that Prisma lacks is a 500 at write time. Both fail
 * here, on the offending enum, with both lists printed.
 */
const schemaPath = path.resolve(import.meta.dirname, "../../../database/prisma/schema.prisma");

function prismaEnumMembers(source: string, name: string): string[] | null {
  const match = new RegExp(`^enum\\s+${name}\\s*\\{([^}]*)\\}`, "m").exec(source);
  if (!match) return null;
  return match[1]
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter((line) => /^[A-Z][A-Z0-9_]*$/.test(line));
}

describe("Prisma enum mirrors", () => {
  it("can find schema.prisma — a moved schema must fail loudly, not silently skip", () => {
    expect(fs.existsSync(schemaPath)).toBe(true);
  });

  const source = fs.readFileSync(schemaPath, "utf8");

  it.each(Object.entries(PRISMA_ENUM_MIRRORS))("%s matches schema.prisma exactly", (name, mirrored) => {
    const members = prismaEnumMembers(source, name);
    expect(members, `enum ${name} is not declared in schema.prisma`).not.toBeNull();
    expect(members).toEqual([...mirrored]);
  });
});
