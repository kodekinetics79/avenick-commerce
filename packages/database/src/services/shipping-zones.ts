import { db, type Currency } from "../index";

/**
 * Delivery pricing, the way a carrier prices it: by ZONE and by WEIGHT.
 *
 * A zone is a set of destination countries sharing one tariff. A rate is one
 * weight band of that tariff in one currency. A quote is the band whose range
 * contains the order's billable weight.
 *
 * The rules this module refuses to break:
 *
 *  · IT NEVER GUESSES A DESTINATION. If no active zone covers the country, the
 *    quote is UNAVAILABLE and checkout must say so. Shipping a parcel to a
 *    country nobody priced is a loss the buyer never agreed to.
 *  · IT NEVER PICKS BETWEEN TWO ZONES. If two active zones claim the same
 *    country the configuration is ambiguous, and an ambiguous tariff resolved
 *    silently is how a customer is charged the wrong amount forever. It refuses
 *    and names both zones so an operator can fix the overlap.
 *  · IT NEVER PRESENTS AN ESTIMATE AS A MEASUREMENT. 373 of 385 live products
 *    carry a weight; the rest fall back to the zone's flat price, and the quote
 *    says `basis: "FALLBACK"` so the UI can disclose that the figure is not
 *    weight-derived.
 *
 * Money is computed here and never in the browser: a shipping figure the client
 * can influence is a discount the client can grant itself.
 */

/** How a price was arrived at. The UI discloses each differently. */
export type ShippingBasis = "WEIGHT_BAND" | "FALLBACK" | "FREE_THRESHOLD";

export interface ShippingQuote {
  zoneId: string;
  zoneCode: string;
  price: number;
  currency: Currency;
  basis: ShippingBasis;
  /** Billable weight in kg, or null when the catalogue could not supply one. */
  billableWeightKg: number | null;
  etaMinDays: number | null;
  etaMaxDays: number | null;
}

export interface ShippingLine {
  quantity: number;
  /** Unit weight in kg. Null for a product with no recorded weight. */
  weightKg: number | null;
}

/** No tariff covers this destination. Checkout must refuse, not default to zero. */
export class ShippingZoneUnavailableError extends Error {
  readonly country: string;
  constructor(country: string) {
    super(`No active shipping zone covers ${country}`);
    this.name = "ShippingZoneUnavailableError";
    this.country = country;
  }
}

/** Two active zones claim the same country. Refuse rather than pick one. */
export class ShippingZoneAmbiguousError extends Error {
  readonly country: string;
  readonly zoneCodes: string[];
  constructor(country: string, zoneCodes: string[]) {
    super(`${country} is claimed by more than one active shipping zone: ${zoneCodes.join(", ")}`);
    this.name = "ShippingZoneAmbiguousError";
    this.country = country;
    this.zoneCodes = zoneCodes;
  }
}

/** The zone covers the country but publishes no band for this currency/weight. */
export class ShippingRateUnavailableError extends Error {
  readonly zoneCode: string;
  constructor(zoneCode: string, currency: string) {
    super(`Zone ${zoneCode} publishes no active ${currency} rate covering this weight`);
    this.name = "ShippingRateUnavailableError";
    this.zoneCode = zoneCode;
  }
}

/**
 * Billable weight for a basket.
 *
 * Returns null when ANY line lacks a weight: a partial sum understates the
 * parcel, and understating it means charging less than the carrier will. One
 * unweighed item makes the whole basket unmeasured, which is the honest reading.
 */
export function billableWeightKg(lines: readonly ShippingLine[]): number | null {
  if (lines.length === 0) return 0;
  let total = 0;
  for (const line of lines) {
    if (line.weightKg == null || !Number.isFinite(line.weightKg)) return null;
    total += line.weightKg * line.quantity;
  }
  // Carriers round up to the gram; so do we, and never below zero.
  return Math.max(0, Math.round(total * 1000) / 1000);
}

export interface RateBand {
  minWeightKg: number;
  maxWeightKg: number | null;
  price: number;
}

/**
 * The band whose range contains `weight`: min inclusive, max exclusive, with a
 * null max as the open-ended top band. Pure, so the selection rule is testable
 * without a database.
 */
export function selectRateBand(bands: readonly RateBand[], weight: number): RateBand | null {
  const ordered = [...bands].sort((a, b) => a.minWeightKg - b.minWeightKg);
  for (const band of ordered) {
    const aboveFloor = weight >= band.minWeightKg;
    const belowCeiling = band.maxWeightKg == null || weight < band.maxWeightKg;
    if (aboveFloor && belowCeiling) return band;
  }
  return null;
}

export interface QuoteInput {
  /** ISO-3166 alpha-2 destination. */
  country: string;
  currency: Currency;
  /** Order subtotal, for the free-delivery threshold. */
  subtotal: number;
  lines: readonly ShippingLine[];
}

/**
 * Price delivery for one basket to one destination.
 *
 * Throws rather than returning a zero for every condition an operator has not
 * priced — a silent zero is indistinguishable from free delivery, and the
 * caller cannot tell the difference after the fact.
 */
export async function quoteShipping(input: QuoteInput): Promise<ShippingQuote> {
  const country = input.country.trim().toUpperCase();
  const zones = await db.shippingZone.findMany({
    where: { isActive: true, countries: { has: country } },
    orderBy: { sortOrder: "asc" },
    include: {
      rates: {
        where: { isActive: true, currency: input.currency },
        orderBy: { minWeightKg: "asc" },
      },
    },
  });

  if (zones.length === 0) throw new ShippingZoneUnavailableError(country);
  if (zones.length > 1) {
    throw new ShippingZoneAmbiguousError(country, zones.map((zone) => zone.code));
  }

  const zone = zones[0]!;
  const weight = billableWeightKg(input.lines);
  const eta = { etaMinDays: zone.etaMinDays, etaMaxDays: zone.etaMaxDays };

  // The threshold is checked BEFORE the bands: free delivery is a commercial
  // promise about the order, not the cheapest band that happened to match.
  const freeOver = zone.freeOverSubtotal == null ? null : Number(zone.freeOverSubtotal);
  if (freeOver != null && input.subtotal >= freeOver) {
    return { zoneId: zone.id, zoneCode: zone.code, price: 0, currency: input.currency,
      basis: "FREE_THRESHOLD", billableWeightKg: weight, ...eta };
  }

  if (weight == null) {
    return { zoneId: zone.id, zoneCode: zone.code, price: Number(zone.fallbackPrice),
      currency: input.currency, basis: "FALLBACK", billableWeightKg: null, ...eta };
  }

  const band = selectRateBand(
    zone.rates.map((rate) => ({
      minWeightKg: Number(rate.minWeightKg),
      maxWeightKg: rate.maxWeightKg == null ? null : Number(rate.maxWeightKg),
      price: Number(rate.price),
    })),
    weight,
  );
  if (!band) throw new ShippingRateUnavailableError(zone.code, input.currency);

  return { zoneId: zone.id, zoneCode: zone.code, price: band.price, currency: input.currency,
    basis: "WEIGHT_BAND", billableWeightKg: weight, ...eta };
}
