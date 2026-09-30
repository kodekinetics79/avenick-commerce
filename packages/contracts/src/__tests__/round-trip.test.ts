import { describe, expect, it } from "vitest";

import { SCHEMA_CASES } from "./fixtures";

/**
 * Every schema on the surface parses a realistic value and refuses a realistic
 * mistake, and refuses it for the RIGHT REASON.
 *
 * The path assertion is the part that earns its keep: a `.strict()` object
 * rejects an unexpected key with an `unrecognized_keys` issue at the object's
 * own path, so a test that only checked `success === false` would pass while
 * the rule it meant to prove was never exercised.
 */
describe.each(SCHEMA_CASES)("$name", ({ schema, valid, invalid, invalidPath }) => {
  it("accepts a realistic value", () => {
    const result = schema.safeParse(valid);
    if (!result.success) {
      throw new Error(`expected the valid fixture to parse, got: ${JSON.stringify(result.error.issues, null, 2)}`);
    }
  });

  it("re-parses its own output unchanged", () => {
    const parsed = schema.parse(valid);
    // Idempotence matters because responses are parsed by the app, re-encoded
    // into local storage, and parsed again on the next launch. A schema whose
    // output its own input rules reject makes the second launch fail.
    expect(schema.parse(parsed)).toEqual(parsed);
  });

  it("refuses a realistic mistake", () => {
    const result = schema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (invalidPath && !result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain(invalidPath);
    }
  });
});

describe("coverage", () => {
  it("names every case uniquely, so a duplicated fixture cannot hide a missing one", () => {
    const names = SCHEMA_CASES.map((testCase) => testCase.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
