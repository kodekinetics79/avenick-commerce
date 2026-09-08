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
 * The GCC trading entity.
 *
 * NOT YET SUPPLIED. The operator has confirmed one exists alongside the US
 * headquarters, but its registered name and address have not been provided, and
 * this module does not invent them: a company name on a contract page is the
 * single least survivable thing to guess.
 *
 * Returns null until `NEXT_PUBLIC_GCC_ENTITY` is configured, and every surface
 * that reads it renders nothing rather than a placeholder. When it is set, the
 * contact and about pages pick it up with no further change.
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
