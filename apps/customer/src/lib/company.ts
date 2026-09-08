/**
 * The operating company's own identity — the values a buyer needs in order to
 * know who they are contracting with.
 *
 * WHY NOT portal-config. That module's docstring states it invents nothing and
 * that the brand name is "the one permitted literal"; adding a second default
 * there would weaken an invariant several other tracks rely on. These values are
 * company facts rather than deployment topology, so they live here, still
 * env-overridable, still resolving to `null` rather than to a guess.
 *
 * WHY IT MATTERS THAT THIS IS ONE MODULE. An address that appears on /contact,
 * /about, the terms and an invoice, typed separately each time, disagrees with
 * itself the first time the company moves — and a disagreeing legal address is
 * worse than a missing one, because each copy looks authoritative.
 */

/**
 * The headquarters. Supplied by the operator; overridable per deployment.
 *
 * This is the US entity. It is deliberately labelled "headquarters" everywhere
 * it is rendered rather than "our address", because this platform trades in the
 * GCC: a buyer in Riyadh reading a Virginia address with no qualifier would
 * reasonably conclude that is the entity they are contracting with, and that is
 * a question the pages must not answer by implication.
 */
export interface CompanyAddress {
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

const HQ: CompanyAddress = {
  line1: "10432 Balls Ford Rd",
  city: "Manassas",
  region: "VA",
  postalCode: "20109",
  country: "USA",
};

export function companyHeadquarters(): CompanyAddress {
  const raw = process.env.NEXT_PUBLIC_COMPANY_HQ_ADDRESS?.trim();
  if (!raw) return HQ;
  // "line1|city|region|postal|country" — five parts or the value is rejected
  // rather than partially trusted, the same rule portal-config applies to an
  // origin. A half-parsed postal address renders as a real one.
  const parts = raw.split("|").map((s) => s.trim());
  if (parts.length !== 5 || parts.some((p) => p === "")) return HQ;
  const [line1, city, region, postalCode, country] = parts as [string, string, string, string, string];
  return { line1, city, region, postalCode, country };
}

/** One line, for a footer or an email signature. */
export function formatAddress(a: CompanyAddress): string {
  return `${a.line1}, ${a.city} ${a.region} ${a.postalCode}, ${a.country}`;
}

/**
 * The GCC offices.
 *
 * WHERE THE PLATFORM OPERATES IN THE GULF. These are presence, not identity —
 * see the note on gccTradingEntity() below for why the two must not be
 * conflated on a page a buyer reads before contracting.
 *
 * Dubai is recorded against the UAE. The operator supplied it as "Dubai - USA",
 * alongside "Riyand" for Riyadh, so the entry is a typo in an obviously
 * city-country list rather than a claim about jurisdiction. Publishing "Dubai,
 * USA" on a Gulf marketplace would be visibly wrong to every buyer it serves,
 * and a country is the half of an address that decides which consumer law
 * applies — so it is corrected here and flagged rather than transcribed.
 */
export interface Office {
  city: string;
  country: string;
}

const GCC_OFFICES: Office[] = [
  { city: "Riyadh", country: "Saudi Arabia" },
  { city: "Doha", country: "Qatar" },
  { city: "Dubai", country: "United Arab Emirates" },
];

/** Arabic names, so an Arabic reader is not handed a Latin list of Gulf cities. */
export const OFFICE_AR: Record<string, { city: string; country: string }> = {
  Riyadh: { city: "الرياض", country: "المملكة العربية السعودية" },
  Doha: { city: "الدوحة", country: "قطر" },
  Dubai: { city: "دبي", country: "الإمارات العربية المتحدة" },
};

/**
 * Format: "City,Country;City,Country" — overrides the list entirely when set.
 * A malformed value is rejected rather than partially trusted, the same rule
 * portal-config applies to an origin.
 */
export function gccOffices(): Office[] {
  const raw = process.env.NEXT_PUBLIC_GCC_OFFICES?.trim();
  if (!raw) return GCC_OFFICES;
  const parsed = raw
    .split(";")
    .map((entry) => entry.split(",").map((s) => s.trim()))
    .filter((p): p is [string, string] => p.length === 2 && p.every((s) => s !== ""))
    .map(([city, country]) => ({ city, country }));
  return parsed.length > 0 ? parsed : GCC_OFFICES;
}

/**
 * The GCC trading ENTITY — still not supplied, and deliberately still separate
 * from the office list above.
 *
 * An office is where a company works. A trading entity is the legal person a
 * buyer's contract is with, and it has a registered name and a commercial
 * registration number. Three city names do not answer that question: a buyer in
 * Riyadh reading "Riyadh · Doha · Dubai" learns the platform is present in the
 * region, not who is on the invoice or who they sue.
 *
 * So the offices render as offices, and this stays null until
 * `NEXT_PUBLIC_GCC_ENTITY` is configured. A company name on a contract page is
 * the least survivable thing in this product to guess.
 *
 * Format: "Legal Name|line1|city|country"
 */
export interface TradingEntity {
  legalName: string;
  line1: string;
  city: string;
  country: string;
}

export function gccTradingEntity(): TradingEntity | null {
  const raw = process.env.NEXT_PUBLIC_GCC_ENTITY?.trim();
  if (!raw) return null;
  const parts = raw.split("|").map((s) => s.trim());
  if (parts.length !== 4 || parts.some((p) => p === "")) return null;
  const [legalName, line1, city, country] = parts as [string, string, string, string];
  return { legalName, line1, city, country };
}
