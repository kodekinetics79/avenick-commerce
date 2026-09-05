/**
 * THE DELIVERY TARIFF, AS FACTS THE CHECKOUT MAY STATE.
 *
 * packages/database/src/services/shipping-zones.ts prices delivery by zone and
 * weight inside the order transaction, and it refuses rather than guesses: a
 * destination no active zone covers (ShippingZoneUnavailableError), a
 * destination two zones claim (ShippingZoneAmbiguousError), and a weighed
 * basket the zone publishes no band for in the order's currency
 * (ShippingRateUnavailableError). None of those messages matches the order
 * endpoint's business-error pattern, so each reaches the buyer as a 500 — after
 * they have walked all three steps and pressed submit.
 *
 * This module carries the tariff's SHAPE to the browser — which countries each
 * active zone serves, what it charges when a product has no recorded weight,
 * whether it publishes bands in a currency — so the checkout can say "we do
 * not deliver to Oman" at the address step instead. It carries no arithmetic:
 * the delivery figure is quoted by the server, from the server's own weights,
 * when the order is written. Nothing here can produce a figure the server did
 * not.
 *
 * Pure on purpose. The page reads the zones through @avenick/database and hands
 * the rows in; the projection and the destination lookup are testable without a
 * database, and the DTO holds only numbers and strings so it can cross the
 * server/client boundary (a Prisma Decimal cannot).
 */

type DecimalLike = number | string | { toString(): string };

/** The subset of a ShippingZone row (with its rates) this projection reads. */
export interface ShippingZoneRow {
  code: string;
  nameEn: string;
  nameAr: string;
  countries: string[];
  isActive: boolean;
  fallbackPrice: DecimalLike;
  freeOverSubtotal: DecimalLike | null;
  rates: Array<{ currency: string; isActive: boolean }>;
}

export interface ShippingZoneCoverage {
  code: string;
  nameEn: string;
  nameAr: string;
  /** ISO 3166-1 alpha-2, upper-cased, exactly as quoteShipping normalises them. */
  countries: string[];
  /** What the server charges when any line has no recorded weight (basis FALLBACK). */
  fallbackPrice: number;
  /** Subtotal at or above which the server charges nothing (basis FREE_THRESHOLD). */
  freeOverSubtotal: number | null;
  /** Currencies in which this zone publishes at least one active weight band. */
  ratedCurrencies: string[];
}

export interface ShippingCoverage {
  /**
   * Whether ANY active zone exists. createOrder skips the quote entirely when
   * none does — freight is then zero and the order proceeds — so "not
   * configured" and "not served" are different answers and must be told apart.
   */
  configured: boolean;
  zones: ShippingZoneCoverage[];
}

const toNumber = (value: DecimalLike): number => {
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : 0;
};

export function toShippingCoverage(rows: readonly ShippingZoneRow[]): ShippingCoverage {
  const zones = rows
    .filter((row) => row.isActive)
    .map((row) => ({
      code: row.code,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      countries: row.countries.map((country) => country.trim().toUpperCase()).filter(Boolean),
      fallbackPrice: toNumber(row.fallbackPrice),
      freeOverSubtotal: row.freeOverSubtotal == null ? null : toNumber(row.freeOverSubtotal),
      ratedCurrencies: [...new Set(row.rates.filter((rate) => rate.isActive).map((rate) => rate.currency))],
    }));
  return { configured: zones.length > 0, zones };
}

export type DestinationCoverage =
  /** The tariff could not be read, or no country is chosen yet: nothing may be pre-judged. */
  | { status: "UNKNOWN" }
  /** No active zone anywhere: the server adds nothing for delivery. */
  | { status: "NOT_CONFIGURED" }
  /** Zones exist and none covers the country — quoteShipping throws ShippingZoneUnavailableError. */
  | { status: "UNSERVED"; country: string }
  /** More than one active zone claims the country — ShippingZoneAmbiguousError. */
  | { status: "AMBIGUOUS"; country: string; zoneCodes: string[] }
  | { status: "SERVED"; country: string; zone: ShippingZoneCoverage };

/** The same lookup quoteShipping performs, minus the database. */
export function resolveDestinationCoverage(
  coverage: ShippingCoverage | null,
  country: string,
): DestinationCoverage {
  if (!coverage) return { status: "UNKNOWN" };
  if (!coverage.configured) return { status: "NOT_CONFIGURED" };
  const iso = country.trim().toUpperCase();
  if (!iso) return { status: "UNKNOWN" };
  const claiming = coverage.zones.filter((zone) => zone.countries.includes(iso));
  if (claiming.length === 0) return { status: "UNSERVED", country: iso };
  if (claiming.length > 1) {
    return { status: "AMBIGUOUS", country: iso, zoneCodes: claiming.map((zone) => zone.code) };
  }
  return { status: "SERVED", country: iso, zone: claiming[0]! };
}
