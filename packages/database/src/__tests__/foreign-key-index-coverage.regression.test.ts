import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const schemaPath = join(fileURLToPath(new URL("../../", import.meta.url)), "prisma/schema.prisma");

function fields(raw: string): string[] {
  return raw
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);
}

/**
 * PostgreSQL creates the referenced-side index for a primary/unique key, but
 * does not create an index on the child columns. A missing child index turns a
 * parent delete and common relation lookup into a table scan. This lightweight
 * schema contract catches that regression before a migration reaches a large
 * marketplace table.
 */
describe("foreign-key index coverage", () => {
  it("gives every explicit relation a matching leading index", () => {
    const schema = readFileSync(schemaPath, "utf8");
    const uncovered: string[] = [];

    for (const match of schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
      const [, model, body] = match;
      const indexes = [...body.matchAll(/@@(?:index|unique|id)\(\[([^\]]+)\]/g)].map((entry) => fields(entry[1]));

      for (const scalar of body.matchAll(/^\s*(\w+)\s+[^\n]+@(id|unique)(?:\s|$)/gm)) {
        indexes.push([scalar[1]]);
      }

      for (const relation of body.matchAll(/@relation\([^)]*fields:\s*\[([^\]]+)\]/g)) {
        const relationFields = fields(relation[1]);
        const covered = indexes.some(
          (index) => relationFields.every((field, position) => index[position] === field),
        );
        if (!covered) uncovered.push(`${model}.${relationFields.join("+")}`);
      }
    }

    expect(uncovered, "relation fields missing a leading index").toEqual([]);
  });
});
