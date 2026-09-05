import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  GCC_COUNTRY_VALUES,
  GCC_IDENTIFIER_RULES,
  type GccCountry,
  type IdentifierKind,
  checkIdentifier,
  describeIdentifier,
  identifierKindsFor,
  identifierRule,
  normaliseIdentifier,
} from "../gcc-identifiers";

/** Rewrites ASCII digits as the Arabic-Indic ones an Arabic keyboard emits. */
const toArabicIndic = (value: string) =>
  value.replace(/[0-9]/g, (digit) => String.fromCharCode(0x0660 + Number(digit)));

/** Rewrites ASCII digits as Extended Arabic-Indic (the Persian/Urdu set). */
const toExtendedArabicIndic = (value: string) =>
  value.replace(/[0-9]/g, (digit) => String.fromCharCode(0x06f0 + Number(digit)));

const everyRule = GCC_COUNTRY_VALUES.flatMap((country) =>
  identifierKindsFor(country).map(
    (kind) => [country, kind, identifierRule(country, kind)!] as const,
  ),
);

type Case = [GccCountry, IdentifierKind, string, "ok" | "warn" | "refuse", string];

/**
 * One case per country per identifier, at each level the rule can reach.
 *
 * The last column is a fragment the message must contain. It exists so a
 * rewritten rule cannot quietly keep its level while losing the sentence that
 * told the registrant what to do — which is the failure mode this whole table
 * was built to prevent.
 */
const CASES: Case[] = [
  // United Arab Emirates.
  ["AE", "commercialRegistration", "CN-1234567", "ok", ""],
  ["AE", "commercialRegistration", "CN 1234567*", "warn", "*"],
  ["AE", "commercialRegistration", "AB", "refuse", "three characters"],
  ["AE", "vatNumber", "100123456700003", "ok", ""],
  ["AE", "vatNumber", "200123456700003", "warn", "start with 100"],
  ["AE", "vatNumber", "10012345670000", "refuse", "15 digits"],

  // Saudi Arabia.
  ["SA", "commercialRegistration", "1010123456", "ok", ""],
  ["SA", "commercialRegistration", "7001234567", "warn", "unified national number"],
  ["SA", "commercialRegistration", "101012345", "refuse", "10 digits"],
  ["SA", "vatNumber", "300123456700003", "ok", ""],
  ["SA", "vatNumber", "400123456700003", "warn", "start with 3"],
  ["SA", "vatNumber", "30012345670003", "refuse", "15 digits"],
  ["SA", "unifiedNumber", "7001234567", "ok", ""],
  ["SA", "unifiedNumber", "1001234567", "warn", "start with 7"],
  ["SA", "unifiedNumber", "700123456", "refuse", "10 digits"],

  // Qatar — no VAT regime, so the tax field can only ever be ok or a warn.
  ["QA", "commercialRegistration", "123456", "ok", ""],
  ["QA", "commercialRegistration", "12345A", "refuse", "only of digits"],
  ["QA", "commercialRegistration", "12", "refuse", "3 and 12 digits"],
  ["QA", "vatNumber", "", "ok", ""],
  ["QA", "vatNumber", "12345", "warn", "has not introduced VAT"],

  // Kuwait — likewise.
  ["KW", "commercialRegistration", "123456", "ok", ""],
  ["KW", "commercialRegistration", "12345A", "refuse", "only of digits"],
  ["KW", "commercialRegistration", "", "refuse", "commercial licence number"],
  ["KW", "vatNumber", "", "ok", ""],
  ["KW", "vatNumber", "987654321", "warn", "has not introduced VAT"],

  // Oman — the tax field accepts two different real identifiers.
  ["OM", "commercialRegistration", "1234567", "ok", ""],
  ["OM", "commercialRegistration", "ABC1234", "refuse", "only of digits"],
  ["OM", "commercialRegistration", "12", "refuse", "4 and 12 digits"],
  ["OM", "vatNumber", "OM1100000000", "ok", ""],
  ["OM", "vatNumber", "12345678", "warn", "Tax Card Number"],
  ["OM", "vatNumber", "OM110000000", "warn", "ten digits after OM"],
  ["OM", "vatNumber", "XY12345", "refuse", "Tax Card Number"],

  // Bahrain — the branch suffix survives normalisation as digits.
  ["BH", "commercialRegistration", "123456-1", "ok", ""],
  ["BH", "commercialRegistration", "1234", "warn", "five to nine digits"],
  ["BH", "commercialRegistration", "12", "refuse", "4 and 12 digits"],
  ["BH", "vatNumber", "200000000000002", "ok", ""],
  ["BH", "vatNumber", "20000000", "warn", "normally 15 digits"],
  ["BH", "vatNumber", "1234", "refuse", "5 and 20 digits"],
];

describe("GCC identifier rules", () => {
  it.each(CASES)("%s %s: %s is %s", (country, kind, value, level, fragment) => {
    const result = checkIdentifier(country, kind, value);
    expect(result.level, `message was: ${result.message ?? "(none)"}`).toBe(level);
    if (level === "ok") {
      expect(result.message).toBeUndefined();
    } else {
      expect(result.message).toContain(fragment);
    }
  });

  it("covers every country and every identifier that country asks for", () => {
    expect(everyRule.length).toBeGreaterThan(0);
    const covered = new Set(CASES.map(([country, kind]) => `${country}.${kind}`));
    for (const [country, kind] of everyRule) {
      expect(covered, `${country}.${kind} has no case`).toContain(`${country}.${kind}`);
    }
  });

  it("asks for a unified national number in Saudi Arabia and nowhere else", () => {
    for (const country of GCC_COUNTRY_VALUES) {
      expect(identifierKindsFor(country).includes("unifiedNumber")).toBe(country === "SA");
    }
  });
});

/**
 * The defect this module exists to kill.
 *
 * The reference implementation showed "VAT Number must be 14 digits, starting
 * and ending with 3" and then rejected a 14-digit entry. Both directions are
 * pinned here: the correct 15-digit number is accepted, the 14-digit one is
 * refused, and the refusal says 15 rather than repeating the wrong number.
 */
describe("Saudi VAT length, the defect that motivated the table", () => {
  it("accepts a 15-digit number starting with 3", () => {
    expect(checkIdentifier("SA", "vatNumber", "300123456700003")).toEqual({ level: "ok" });
  });

  it("refuses a 14-digit number and says 15 in the message", () => {
    const result = checkIdentifier("SA", "vatNumber", "30012345670003");
    expect(result.level).toBe("refuse");
    expect(result.message).toContain("15");
    expect(result.message).not.toContain("14 digits");
  });

  it("says 15 in the helper the form renders, not just in the refusal", () => {
    const described = describeIdentifier("SA", "vatNumber");
    expect(described?.helper).toContain("15");
    // The sentence under the field and the sentence in the refusal have to
    // agree on the number, because disagreeing is the original bug.
    const refusal = checkIdentifier("SA", "vatNumber", "3001234567003").message ?? "";
    const lengthInHelper = described?.helper.match(/\b(\d{2})\b/)?.[1];
    expect(refusal).toContain(lengthInHelper);
  });

  it("never refuses on the ending-in-03 convention, only warns", () => {
    // A group registration legitimately departs from it, so refusing here would
    // lock a real Saudi business out of registering.
    const result = checkIdentifier("SA", "vatNumber", "300123456700013");
    expect(result.level).toBe("warn");
  });
});

describe("normalisation", () => {
  it("folds Arabic-Indic digits so an Arabic keyboard is not a refusal", () => {
    expect(checkIdentifier("SA", "vatNumber", toArabicIndic("300123456700003"))).toEqual({
      level: "ok",
    });
    expect(normaliseIdentifier("SA", "commercialRegistration", toArabicIndic("1010123456"))).toBe(
      "1010123456",
    );
  });

  it("folds Extended Arabic-Indic digits too", () => {
    expect(
      checkIdentifier("AE", "vatNumber", toExtendedArabicIndic("100123456700003")),
    ).toEqual({ level: "ok" });
  });

  it("strips the spaces, dashes and bidi marks a copied number carries", () => {
    // U+200F is the right-to-left mark an Arabic PDF wraps a number in. It is
    // invisible in the input box but would make this a 16-character value.
    const pasted = "‏ 300 1234 5670-0003 ‏";
    expect(checkIdentifier("SA", "vatNumber", pasted)).toEqual({ level: "ok" });
  });

  it("uppercases where the format carries letters", () => {
    expect(normaliseIdentifier("OM", "vatNumber", "om1100000000")).toBe("OM1100000000");
    expect(checkIdentifier("OM", "vatNumber", "om 1100000000")).toEqual({ level: "ok" });
    expect(normaliseIdentifier("AE", "commercialRegistration", "cn-1234567")).toBe("CN1234567");
  });
});

describe("optional fields never refuse an empty value", () => {
  const optionalRules = everyRule.filter(([, , rule]) => rule.optional);

  it("has optional fields to check", () => {
    expect(optionalRules.length).toBeGreaterThan(0);
  });

  it.each(optionalRules.map(([country, kind]) => [country, kind] as const))(
    "%s %s accepts an absent value",
    (country, kind) => {
      // A business under the registration threshold has no tax number at all.
      // Refusing them here would refuse the customer, not the value.
      for (const empty of ["", "   ", "‏", "\t\n"]) {
        const result = checkIdentifier(country, kind, empty);
        expect(result.level, `refused ${JSON.stringify(empty)}`).toBe("ok");
      }
    },
  );

  it("refuses an empty value only where the field is required", () => {
    for (const [country, kind, rule] of everyRule) {
      const level = rule.check("").level;
      expect(level === "refuse", `${country}.${kind} optional=${rule.optional}`).toBe(
        !rule.optional,
      );
    }
  });
});

describe("what a form is handed", () => {
  it("gives every entry a label, a placeholder and a non-empty helper sentence", () => {
    for (const [country, kind] of everyRule) {
      const described = describeIdentifier(country, kind);
      expect(described, `${country}.${kind}`).toBeDefined();
      expect(described!.label.trim().length, `${country}.${kind} label`).toBeGreaterThan(2);
      expect(described!.placeholder.trim().length, `${country}.${kind} placeholder`).toBeGreaterThan(2);
      expect(described!.helper.trim().length, `${country}.${kind} helper`).toBeGreaterThan(20);
      // A helper is a sentence shown to a human, not a shorthand.
      expect(described!.helper, `${country}.${kind} helper`).toMatch(/^[A-Z].*\.$/s);
    }
  });

  it("returns nothing for a field the market does not ask for", () => {
    expect(describeIdentifier("AE", "unifiedNumber")).toBeUndefined();
    expect(checkIdentifier("AE", "unifiedNumber", "anything")).toEqual({ level: "ok" });
  });

  it("hands out a copy, so a form cannot edit the rule it is meant to obey", () => {
    const described = describeIdentifier("SA", "vatNumber")!;
    described.helper = "tampered";
    expect(describeIdentifier("SA", "vatNumber")!.helper).not.toBe("tampered");
  });
});

/**
 * Probes chosen to reach every refusal branch in the table without knowing
 * which branch belongs to which rule.
 */
const REFUSAL_PROBES = [
  "",
  " ",
  "A",
  "AB",
  "12",
  "1",
  "abc",
  "12a34",
  "12345A",
  "!!!!!!",
  "XY12345",
  "OM11ZZ00",
  "300123456700003300123456700003300123456700003",
  "1010123456789012345678901234567890",
];

describe("refusal messages", () => {
  const refusals = everyRule.flatMap(([country, kind, rule]) =>
    REFUSAL_PROBES.map((probe) => ({ country, kind, probe, result: rule.check(probe) }))
      .filter(({ result }) => result.level === "refuse")
      .map(({ probe, result }) => ({ country, kind, probe, message: result.message ?? "" })),
  );

  it("reaches a refusal on every rule that has one", () => {
    // Kuwait's and Qatar's tax fields deliberately have no refusal at all, so
    // they are the only rules allowed to be missing from this set.
    const withRefusals = new Set(refusals.map(({ country, kind }) => `${country}.${kind}`));
    const missing = everyRule
      .map(([country, kind]) => `${country}.${kind}`)
      .filter((key) => !withRefusals.has(key));
    expect(missing.sort()).toEqual(["KW.vatNumber", "QA.vatNumber"]);
  });

  it.each(refusals.map((r) => [`${r.country}.${r.kind}`, r.probe, r.message] as const))(
    "%s refusing %j reads as a sentence to a human",
    (where, _probe, message) => {
      expect(message.length, where).toBeGreaterThan(25);
      expect(message, where).toMatch(/^[A-Z]/);
      expect(message.split(" ").length, where).toBeGreaterThan(5);
      // It has to say what was wrong, so a bare "invalid" is not enough.
      expect(message.toLowerCase(), where).not.toBe("invalid");
    },
  );

  it.each(refusals.map((r) => [`${r.country}.${r.kind}`, r.probe, r.message] as const))(
    "%s refusing %j names no code identifier",
    (where, _probe, message) => {
      // A registrant cannot act on "vatNumber must match /^3\\d{14}$/". The
      // message has to be about their certificate, not about our source.
      const codeShapes: Array<[RegExp, string]> = [
        [/[a-z][A-Z]/, "camelCase"],
        [/_/, "snake_case"],
        [/`/, "a backtick"],
        [/\{|\}|\[|\]|\$|\\/, "a regex or template fragment"],
        [/\bundefined\b|\bnull\b|\bNaN\b/, "a JavaScript value"],
        [/commercialRegistration|vatNumber|unifiedNumber|GCC_IDENTIFIER_RULES/, "a table key"],
      ];
      for (const [shape, what] of codeShapes) {
        expect(shape.test(message), `${where} leaks ${what}: ${message}`).toBe(false);
      }
    },
  );
});

/**
 * The country tuple in gcc-identifiers.ts is a copy of COUNTRY_VALUES in
 * packages/types/src/schemas.ts, which is itself compile-time checked against
 * the Prisma `Country` enum. @avenick/utils cannot import that package — its
 * barrel drags Prisma and the auth stack into every consumer — so the copy is
 * guarded by reading the authority off disk instead. If a seventh market is
 * added to Prisma and to schemas.ts, this fails and points at the table that
 * has no rules for it.
 */
describe("the copied country tuple", () => {
  it("still matches COUNTRY_VALUES in @avenick/types", () => {
    const schemasPath = new URL("../../../types/src/schemas.ts", import.meta.url);
    const source = readFileSync(schemasPath, "utf8");
    const declaration = source.match(/export const COUNTRY_VALUES = \[(.*?)\] as const;/s);
    expect(declaration, "COUNTRY_VALUES is no longer declared the way this test reads it").not.toBeNull();
    const authority = [...declaration![1]!.matchAll(/"([A-Z]{2})"/g)].map((match) => match[1]);
    expect([...GCC_COUNTRY_VALUES].sort()).toEqual([...authority].sort());
  });

  it("has a rule table covering exactly those countries", () => {
    expect(Object.keys(GCC_IDENTIFIER_RULES).sort()).toEqual([...GCC_COUNTRY_VALUES].sort());
  });
});
