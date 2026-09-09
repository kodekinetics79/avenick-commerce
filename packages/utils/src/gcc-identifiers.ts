/**
 * Trade and tax identifiers for the six GCC markets, as one table.
 *
 * The reference implementation this replaces printed "VAT Number must be 14
 * digits, starting and ending with 3" under a field that then rejected a
 * 14-digit entry. Both halves were wrong at once: a Saudi VAT number is 15
 * digits, and the sentence shown to the registrant disagreed with the code that
 * judged them. A registrant reading that field had no way to succeed.
 *
 * The cure is structural rather than a corrected string. Every field's helper
 * sentence and every rejection message are produced by the SAME entry in the
 * table below, so a form cannot render one rule while the checker enforces
 * another. `describeIdentifier` is the only way a form is meant to obtain the
 * label, placeholder and helper; `check` is the only way it is meant to judge a
 * value. Change the rule and the sentence moves with it.
 *
 * Calibration is the other half of the design, and it is deliberately timid.
 * Refusing a legitimate business is far more expensive than accepting a
 * malformed identifier, because a refused registration is a lost customer while
 * a malformed one is caught by a human during document review. So `refuse` is
 * reserved for what is certainly wrong — the wrong character class, or a length
 * no legitimate value of that identifier can have — and everything that is
 * merely *usually* true is a `warn` the registrant can walk past.
 *
 * These strings are not routed through the next-intl dictionaries on purpose.
 * The whole point of the table is that the sentence and the check are one
 * thing; putting the sentence in `messages/*.json` would reintroduce exactly
 * the drift that produced the 14-vs-15 defect, because the key and the rule
 * would then be free to change independently. The product is English-only by
 * the owner's decision, so there is nothing to translate.
 */

/**
 * The GCC markets Avenick operates in.
 *
 * This tuple is copied from COUNTRY_VALUES in packages/types/src/schemas.ts,
 * which is itself checked against the Prisma `Country` enum. It is copied
 * rather than imported because @avenick/utils does not depend on
 * @avenick/types, and the barrel of that package drags Prisma and the auth
 * stack into whatever imports it — this package has to stay safe to import from
 * a browser bundle and from a plain Node script alike. The copy is not left
 * unguarded: `IdentifierTableCoversEveryCountry` below fails the build if the
 * table and this tuple ever disagree, and a test in
 * src/__tests__/gcc-identifiers.test.ts reads schemas.ts off disk and fails if
 * the tuple itself drifts from the authority.
 */
export const GCC_COUNTRY_VALUES = ["AE", "SA", "QA", "KW", "OM", "BH"] as const;

export type GccCountry = (typeof GCC_COUNTRY_VALUES)[number];

/** The three identifiers a GCC business is asked for at registration. */
export type IdentifierKind = "commercialRegistration" | "vatNumber" | "unifiedNumber";

/**
 * `refuse` blocks submission, `warn` is shown beside an accepted value, `ok` is
 * silent. Only `refuse` and `warn` carry a message.
 */
export type CheckLevel = "ok" | "warn" | "refuse";

export type IdentifierCheck = {
  level: CheckLevel;
  /** Present whenever the level is not `ok`. Plain English, addressed to the registrant. */
  message?: string;
};

export type IdentifierDescription = {
  /** The field label. */
  label: string;
  /** Shown inside the empty input. A realistic shape, never a real number. */
  placeholder: string;
  /** The sentence under the field. This is the rule `check` enforces, in words. */
  helper: string;
  /** When true, an empty value is accepted without complaint. */
  optional: boolean;
};

export type IdentifierRule = IdentifierDescription & {
  /** Folds the many ways a number can be typed into the one form the rule judges. */
  normalise(value: string): string;
  /** Judges an already-normalised-or-raw value; it normalises internally, so raw input is fine. */
  check(value: string): IdentifierCheck;
};

// ─── Normalisation ─────────────────────────────────────────────────────

const ARABIC_INDIC_ZERO = 0x0660; // ٠ .. ٩
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0; // ۰ .. ۹

/**
 * Folds Arabic-Indic (٠١٢٣) and Extended Arabic-Indic (۰۱۲۳) digits to ASCII.
 *
 * An Arabic keyboard on iOS emits Arabic-Indic digits by default, so a Gulf
 * registrant typing their own VAT number produces a string that no ASCII digit
 * check matches. Refusing that is refusing the customer for using their own
 * numerals, which is the worst possible reason to lose a registration.
 */
function foldArabicDigits(value: string): string {
  let out = "";
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) {
      out += String(code - ARABIC_INDIC_ZERO);
    } else if (code >= EXTENDED_ARABIC_INDIC_ZERO && code <= EXTENDED_ARABIC_INDIC_ZERO + 9) {
      out += String(code - EXTENDED_ARABIC_INDIC_ZERO);
    } else {
      out += character;
    }
  }
  return out;
}

/**
 * Whitespace, the bidirectional control characters an RTL editor inserts around
 * a Latin/numeric run, and the separators people copy out of a certificate.
 *
 * The bidi marks matter more than they look: copying a number out of an Arabic
 * PDF routinely carries U+200F or U+061C along with it, invisible in the input
 * but fatal to a length check, which is how a correct 15-digit number can be
 * refused for being 16 characters long.
 */
const DISCARDED_CHARACTERS = new RegExp(
  "[" +
    [
      "\\s", // every kind of space, including the tab a spreadsheet paste carries
      "\\u00A0", // no-break space
      "\\u061C", // Arabic letter mark
      "\\u200B-\\u200F", // zero-width space, ZWNJ, ZWJ, and the LRM/RLM an Arabic PDF carries
      "\\u2066-\\u2069", // the isolate marks an RTL editor wraps around a Latin or numeric run
      "\\u2010-\\u2015", // the dash family, including the en dash Word substitutes for a hyphen
      "\\-", // plain hyphen: a Bahraini branch registration is written "123456-1"
      "\\u060C", // Arabic comma
      "/\\\\.,_#:;|()",
    ].join("") +
    "]",
  "g",
);

function normaliseIdentifierValue(value: string, uppercase: boolean): string {
  const folded = foldArabicDigits(value.normalize("NFC")).replace(DISCARDED_CHARACTERS, "");
  return uppercase ? folded.toUpperCase() : folded;
}

// ─── Shared judgements ─────────────────────────────────────────────────

/**
 * The silent result. Frozen because it is returned by reference from every rule
 * that has nothing to say, so a caller that decorated it with its own message
 * would put that message on every other field on the form.
 */
const ok: IdentifierCheck = Object.freeze({ level: "ok" });

function refuse(message: string): IdentifierCheck {
  return { level: "refuse", message };
}

function warn(...messages: Array<string | undefined>): IdentifierCheck {
  const kept = messages.filter((message): message is string => Boolean(message));
  return kept.length === 0 ? ok : { level: "warn", message: kept.join(" ") };
}

/**
 * Names the characters that do not belong, rather than saying "invalid input".
 *
 * A registrant staring at a field they believe is correct cannot act on
 * "invalid"; they can act on being told that a stray letter is the problem.
 */
function listOffendingCharacters(value: string, allowed: RegExp): string {
  const offenders = [...new Set([...value].filter((character) => !allowed.test(character)))];
  return offenders.join(" ");
}

const DIGIT = /[0-9]/;
const LATIN_ALPHANUMERIC = /[0-9A-Z]/;

/** The refusal every required field shares, so the empty case reads the same everywhere. */
function requiredButEmpty(subject: string): IdentifierCheck {
  return refuse(`Enter the ${subject}. We cannot verify the business without it.`);
}

type DigitRuleSpec = IdentifierDescription & {
  /** How the identifier is named inside messages, e.g. "A Saudi VAT number". */
  subject: string;
  /** The lower-case noun used in the "enter the ..." refusal for required fields. */
  emptySubject: string;
  /** Exactly this many digits, or a permitted band. */
  length: { exact: number } | { min: number; max: number };
  /** Conventions that are usually but not always true. Never escalates to a refusal. */
  advise?: (digits: string) => Array<string | undefined>;
};

/**
 * Builds the rule for an identifier that is a bare run of digits.
 *
 * The length band, not a regex, is the thing worth reading: `exact` is used only
 * where the issuing authority publishes a fixed width (Saudi and UAE tax
 * numbers), and everywhere else the band is deliberately wider than the shapes
 * we have seen, because a registry that lengthens its numbers next year must not
 * lock existing customers out of registration.
 */
function digitsRule(spec: DigitRuleSpec): IdentifierRule {
  const { subject, emptySubject, length, advise, ...description } = spec;
  const normalise = (value: string) => normaliseIdentifierValue(value, false);
  return {
    ...description,
    normalise,
    check(value: string): IdentifierCheck {
      const digits = normalise(value ?? "");
      if (digits === "") return description.optional ? ok : requiredButEmpty(emptySubject);

      const strays = listOffendingCharacters(digits, DIGIT);
      if (strays !== "") {
        return refuse(`${subject} is made only of digits. Remove these characters: ${strays}`);
      }
      if ("exact" in length && digits.length !== length.exact) {
        return refuse(
          `${subject} is ${length.exact} digits long. You entered ${digits.length}, so some digits are missing or extra.`,
        );
      }
      if ("min" in length && (digits.length < length.min || digits.length > length.max)) {
        return refuse(
          `${subject} is between ${length.min} and ${length.max} digits long. You entered ${digits.length}.`,
        );
      }
      return warn(...(advise?.(digits) ?? []));
    },
  };
}

/**
 * The rule for the two markets that have not introduced VAT.
 *
 * Kuwait and Qatar levy no VAT, so there is no number to demand and no format to
 * enforce. A registrant may still have something on a tax card, or may be
 * pre-filling for a regime that has been announced but not started, and refusing
 * that entry would be refusing a real business over a field that does not apply
 * to them. So this accepts anything, including nothing, and only explains.
 */
function notRequiredHereRule(country: "Kuwait" | "Qatar", description: IdentifierDescription): IdentifierRule {
  const normalise = (value: string) => normaliseIdentifierValue(value, true);
  return {
    ...description,
    normalise,
    check(value: string): IdentifierCheck {
      const cleaned = normalise(value ?? "");
      if (cleaned === "") return ok;
      return warn(
        `${country} has not introduced VAT, so no number is required here. We have kept what you entered and will pass it to our finance team unchanged.`,
      );
    },
  };
}

// ─── The table ─────────────────────────────────────────────────────────

const AE_TRADE_LICENCE: IdentifierRule = (() => {
  const normalise = (value: string) => normaliseIdentifierValue(value, true);
  return {
    label: "Trade Licence Number",
    placeholder: "CN1234567",
    helper:
      "Enter the licence number exactly as it appears on the trade licence. Each emirate and free zone numbers licences differently, so letters are as normal as digits.",
    optional: false,
    normalise,
    check(value: string): IdentifierCheck {
      const cleaned = normalise(value ?? "");
      if (cleaned === "") return requiredButEmpty("trade licence number");
      // Seven emirates and more than forty free zones each issue their own
      // format: a bare six-digit Dubai number, an Abu Dhabi "CN-1234567", a
      // free-zone code with a slash. There is no shape to enforce here that
      // would not lock out a whole free zone, so length is the only refusal.
      if (cleaned.length < 3) {
        return refuse("A trade licence number is at least three characters long. This looks like part of a number.");
      }
      if (cleaned.length > 30) {
        return refuse(
          `A trade licence number is at most 30 characters long. You entered ${cleaned.length}, so this may be two numbers run together.`,
        );
      }
      const strays = listOffendingCharacters(cleaned, LATIN_ALPHANUMERIC);
      return warn(
        strays === ""
          ? undefined
          : `Trade licence numbers are normally letters and digits only. Check these characters against the licence: ${strays}`,
      );
    },
  };
})();

const OM_TAX_NUMBER: IdentifierRule = (() => {
  const normalise = (value: string) => normaliseIdentifierValue(value, true);
  return {
    label: "Tax Identification Number",
    placeholder: "OM1100000000",
    helper:
      "An Omani tax identification number is the letters OM followed by ten digits. If you have a Tax Card Number instead, enter that.",
    optional: true,
    normalise,
    check(value: string): IdentifierCheck {
      const cleaned = normalise(value ?? "");
      if (cleaned === "") return ok;

      if (cleaned.startsWith("OM")) {
        const digits = cleaned.slice(2);
        const strays = listOffendingCharacters(digits, DIGIT);
        if (strays !== "") {
          return refuse(`After the letters OM an Omani tax number is digits only. Remove these characters: ${strays}`);
        }
        return warn(
          digits.length === 10
            ? undefined
            : `An Omani tax identification number normally has ten digits after OM, and yours has ${digits.length}. Check it against your certificate before continuing.`,
        );
      }

      // A digits-only rule here would have excluded every Omani business that
      // holds a Tax Card Number rather than a VAT registration, which is most
      // businesses under the registration threshold. They are legitimate, so
      // they are accepted and told what we assumed.
      const strays = listOffendingCharacters(cleaned, DIGIT);
      if (strays !== "") {
        return refuse(
          `An Omani tax number is either the letters OM followed by digits, or a Tax Card Number made of digits. Remove these characters: ${strays}`,
        );
      }
      return warn("We have read this as a Tax Card Number, since an Omani tax identification number starts with OM.");
    },
  };
})();

/**
 * Every rule, keyed by country and then by identifier. A missing key means the
 * field is not asked for in that market at all — only Saudi Arabia issues a
 * unified national number, so only Saudi Arabia has that entry.
 */
export const GCC_IDENTIFIER_RULES = {
  AE: {
    commercialRegistration: AE_TRADE_LICENCE,
    vatNumber: digitsRule({
      label: "Tax Registration Number",
      placeholder: "100123456700003",
      helper: "A UAE tax registration number is 15 digits and usually starts with 100.",
      optional: true,
      subject: "A UAE tax registration number",
      emptySubject: "tax registration number",
      length: { exact: 15 },
      advise: (digits) => [
        digits.startsWith("100")
          ? undefined
          : "UAE tax registration numbers usually start with 100. Check this against your certificate before continuing.",
      ],
    }),
  },
  SA: {
    commercialRegistration: digitsRule({
      label: "Commercial Registration Number",
      placeholder: "1010123456",
      helper: "A Saudi commercial registration number is 10 digits.",
      optional: false,
      subject: "A Saudi commercial registration number",
      emptySubject: "commercial registration number",
      length: { exact: 10 },
      // No city-prefix check lives here on purpose. The old prefixes — 1010 for
      // Riyadh, 2050 for Dammam, 4030 for Jeddah — stopped being universal when
      // the unified national commercial registration took effect in 2025, and a
      // prefix check would now refuse every newly issued number.
      advise: (digits) => [
        digits.startsWith("7")
          ? "Numbers starting with 7 are usually the unified national number rather than the commercial registration number. Check that this is the right one of the two."
          : undefined,
      ],
    }),
    vatNumber: digitsRule({
      label: "VAT Registration Number",
      placeholder: "300123456700003",
      helper: "A Saudi VAT registration number is 15 digits, and normally starts with 3 and ends with 03.",
      optional: true,
      subject: "A Saudi VAT registration number",
      emptySubject: "VAT registration number",
      length: { exact: 15 },
      advise: (digits) => [
        // Both of these are conventions, not rules. Group registrations and
        // older certificates depart from them, and refusing on either would
        // block a business whose number is genuinely correct.
        digits.startsWith("3")
          ? undefined
          : "Saudi VAT numbers normally start with 3. Check this against your certificate before continuing.",
        digits.endsWith("03")
          ? undefined
          : "Saudi VAT numbers normally end with 03. A group registration may not, so continue if your certificate matches.",
      ],
    }),
    unifiedNumber: digitsRule({
      label: "Unified National Number",
      placeholder: "7001234567",
      helper: "The unified national number is 10 digits and normally starts with 7. Leave it blank if you do not have one.",
      optional: true,
      subject: "A Saudi unified national number",
      emptySubject: "unified national number",
      length: { exact: 10 },
      advise: (digits) => [
        digits.startsWith("7")
          ? undefined
          : "Unified national numbers normally start with 7. Check that this is not the commercial registration number instead.",
      ],
    }),
  },
  QA: {
    commercialRegistration: digitsRule({
      label: "Commercial Registration Number",
      placeholder: "123456",
      helper: "A Qatari commercial registration number is made of digits, usually five to eight of them.",
      optional: false,
      subject: "A Qatari commercial registration number",
      emptySubject: "commercial registration number",
      // Qatar has lengthened its registration numbers over time and older
      // businesses still hold short ones, so the band is wide at both ends.
      length: { min: 3, max: 12 },
    }),
    vatNumber: notRequiredHereRule("Qatar", {
      label: "Tax Identification Number",
      placeholder: "Not required in Qatar",
      helper: "Qatar has not introduced VAT. Leave this blank unless you already hold a tax identification number.",
      optional: true,
    }),
  },
  KW: {
    commercialRegistration: digitsRule({
      label: "Commercial Licence Number",
      placeholder: "123456",
      helper: "A Kuwaiti commercial licence number is made of digits, usually five to seven of them.",
      optional: false,
      subject: "A Kuwaiti commercial licence number",
      emptySubject: "commercial licence number",
      length: { min: 3, max: 12 },
    }),
    vatNumber: notRequiredHereRule("Kuwait", {
      label: "Tax Identification Number",
      placeholder: "Not required in Kuwait",
      helper: "Kuwait has not introduced VAT. Leave this blank unless you already hold a tax identification number.",
      optional: true,
    }),
  },
  OM: {
    commercialRegistration: digitsRule({
      label: "Commercial Registration Number",
      placeholder: "1234567",
      helper: "An Omani commercial registration number is made of digits, usually six or seven of them.",
      optional: false,
      subject: "An Omani commercial registration number",
      emptySubject: "commercial registration number",
      length: { min: 4, max: 12 },
    }),
    vatNumber: OM_TAX_NUMBER,
  },
  BH: {
    commercialRegistration: digitsRule({
      label: "Commercial Registration Number",
      placeholder: "123456-1",
      helper:
        "A Bahraini commercial registration number is made of digits. Include the branch number after the dash if your registration has one.",
      optional: false,
      subject: "A Bahraini commercial registration number",
      emptySubject: "commercial registration number",
      // The dash is stripped before this check, so a "123456-1" branch
      // registration arrives here as seven digits rather than as an error.
      length: { min: 4, max: 12 },
      advise: (digits) => [
        digits.length >= 5 && digits.length <= 9
          ? undefined
          : "Bahraini registration numbers are usually five to nine digits once the branch number is included. Check this against your registration.",
      ],
    }),
    vatNumber: digitsRule({
      label: "VAT Account Number",
      placeholder: "200000000000002",
      helper: "A Bahraini VAT account number is 15 digits.",
      optional: true,
      subject: "A Bahraini VAT account number",
      emptySubject: "VAT account number",
      // Bahrain publishes a 15-digit account number, but businesses also quote
      // the shorter number printed on older certificates. Fifteen is therefore
      // advice here rather than a refusal, and the band only catches an entry
      // that cannot be a tax number at all.
      length: { min: 5, max: 20 },
      advise: (digits) => [
        digits.length === 15
          ? undefined
          : `A Bahraini VAT account number is normally 15 digits and yours has ${digits.length}. Check it against your certificate before continuing.`,
      ],
    }),
  },
} as const satisfies Record<GccCountry, Partial<Record<IdentifierKind, IdentifierRule>>>;

/**
 * Fails the build if the table ever stops covering exactly the country tuple —
 * the copied tuple's safety net against a seventh market being added to Prisma
 * and silently having no identifier rules at all.
 */
type Exact<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type AssertTrue<T extends true> = T;
export type IdentifierTableCoversEveryCountry = AssertTrue<
  Exact<keyof typeof GCC_IDENTIFIER_RULES, GccCountry>
>;

// ─── The surface a form is meant to use ────────────────────────────────

/** The rule for one field, or undefined when that market is not asked for it. */
export function identifierRule(country: GccCountry, kind: IdentifierKind): IdentifierRule | undefined {
  // An unlisted country is a question, not a crash. The outer lookup is
  // undefined for anything outside the six markets — indexing it threw a
  // TypeError, which on a registration form means a blank page for a visitor
  // whose only mistake was a country this platform does not serve yet.
  const forCountry = GCC_IDENTIFIER_RULES[country] as Partial<Record<IdentifierKind, IdentifierRule>> | undefined;
  return forCountry?.[kind];
}

/**
 * The label, placeholder and helper a form renders.
 *
 * A form must read its sentence from here rather than hard-coding one, because
 * this is the same object whose `check` judges the value. That is the entire
 * defence against a field that promises 14 digits and then demands 15.
 */
export function describeIdentifier(
  country: GccCountry,
  kind: IdentifierKind,
): IdentifierDescription | undefined {
  const rule = identifierRule(country, kind);
  if (!rule) return undefined;
  const { label, placeholder, helper, optional } = rule;
  return { label, placeholder, helper, optional };
}

/** Judges a raw value. An identifier a market does not ask for is never an error. */
export function checkIdentifier(
  country: GccCountry,
  kind: IdentifierKind,
  value: string,
): IdentifierCheck {
  return identifierRule(country, kind)?.check(value) ?? ok;
}

/** The stored form of a value: what `check` judged, not what was typed. */
export function normaliseIdentifier(country: GccCountry, kind: IdentifierKind, value: string): string {
  return identifierRule(country, kind)?.normalise(value) ?? value;
}

/** Which identifier fields a market's registration form should render, in order. */
export function identifierKindsFor(country: GccCountry): IdentifierKind[] {
  const order: IdentifierKind[] = ["commercialRegistration", "vatNumber", "unifiedNumber"];
  return order.filter((kind) => identifierRule(country, kind) !== undefined);
}

/** True when a value would block submission, which is the only reason a form should stop. */
export function blocksSubmission(check: IdentifierCheck): boolean {
  return check.level === "refuse";
}
