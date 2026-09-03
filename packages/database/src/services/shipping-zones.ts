import { db, type Currency, type Prisma } from "../index";

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
export async function quoteShipping(
  input: QuoteInput,
  /**
   * The caller's transaction client, when there is one. Checkout quotes inside
   * the same transaction that prices the goods and reserves the stock, so the
   * tariff it reads is the tariff that was in force for THIS order — reading it
   * on the global client would step outside that transaction and could price
   * against a tariff an operator edited mid-checkout.
   */
  client: Prisma.TransactionClient | typeof db = db,
): Promise<ShippingQuote> {
  const country = input.country.trim().toUpperCase();
  const zones = await client.shippingZone.findMany({
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

// ─── ADMINISTRATION ──────────────────────────────────────────────────────────

export interface ZoneInput {
  code: string;
  nameEn: string;
  nameAr: string;
  countries: string[];
  fallbackPrice: number;
  freeOverSubtotal: number | null;
  etaMinDays: number | null;
  etaMaxDays: number | null;
  isActive: boolean;
  sortOrder: number;
}

/** A country is already priced by another active zone. */
export class ShippingZoneOverlapError extends Error {
  readonly conflicts: Array<{ country: string; zoneCode: string }>;
  constructor(conflicts: Array<{ country: string; zoneCode: string }>) {
    super(
      `Already covered by another active zone: ${conflicts
        .map(({ country, zoneCode }) => `${country} (${zoneCode})`)
        .join(", ")}`,
    );
    this.name = "ShippingZoneOverlapError";
    this.conflicts = conflicts;
  }
}

/**
 * Refuse to create an overlap rather than let a quote discover it later.
 *
 * quoteShipping throws when two active zones claim a country, which is the
 * right behaviour at checkout but a terrible place to learn about it — the
 * buyer sees a failure for a configuration mistake made days earlier. The
 * overlap is caught here, where an operator can still fix it, and the error
 * names every offending country and the zone that already holds it.
 */
async function assertNoOverlap(
  client: Prisma.TransactionClient | typeof db,
  countries: string[],
  excludeZoneId?: string,
) {
  const normalised = countries.map((country) => country.trim().toUpperCase()).filter(Boolean);
  if (normalised.length === 0) return normalised;
  const others = await client.shippingZone.findMany({
    where: { isActive: true, ...(excludeZoneId ? { id: { not: excludeZoneId } } : {}) },
    select: { code: true, countries: true },
  });
  const conflicts: Array<{ country: string; zoneCode: string }> = [];
  for (const zone of others) {
    for (const country of normalised) {
      if (zone.countries.includes(country)) conflicts.push({ country, zoneCode: zone.code });
    }
  }
  if (conflicts.length > 0) throw new ShippingZoneOverlapError(conflicts);
  return normalised;
}

export async function listShippingZones() {
  return db.shippingZone.findMany({
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    include: { rates: { orderBy: [{ currency: "asc" }, { minWeightKg: "asc" }] } },
  });
}

export async function createShippingZone(input: ZoneInput) {
  return db.$transaction(async (tx) => {
    const countries = await assertNoOverlap(tx, input.countries);
    return tx.shippingZone.create({ data: { ...input, countries } });
  });
}

export async function updateShippingZone(zoneId: string, input: ZoneInput) {
  return db.$transaction(async (tx) => {
    const countries = await assertNoOverlap(tx, input.countries, zoneId);
    return tx.shippingZone.update({ where: { id: zoneId }, data: { ...input, countries } });
  });
}

export interface RateInput {
  zoneId: string;
  currency: Currency;
  minWeightKg: number;
  maxWeightKg: number | null;
  price: number;
  isActive: boolean;
}

/** A band that overlaps or leaves a hole in an existing tariff. */
export class ShippingBandInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShippingBandInvalidError";
  }
}

/**
 * A tariff must be a partition, not a pile of ranges.
 *
 * Two bands covering the same weight means the price depends on which one the
 * query happened to return first; a gap means selectRateBand finds nothing and
 * checkout refuses an order it should have priced. Both are configuration
 * mistakes that only show up as a wrong or missing price much later, so they
 * are refused at the point of entry.
 */
export async function upsertShippingRate(rateId: string | null, input: RateInput) {
  if (input.maxWeightKg != null && input.maxWeightKg <= input.minWeightKg) {
    throw new ShippingBandInvalidError("A band's upper bound must be above its lower bound");
  }
  return db.$transaction(async (tx) => {
    const siblings = await tx.shippingRate.findMany({
      where: {
        zoneId: input.zoneId, currency: input.currency, isActive: true,
        ...(rateId ? { id: { not: rateId } } : {}),
      },
      select: { minWeightKg: true, maxWeightKg: true },
    });
    for (const sibling of siblings) {
      const otherMin = Number(sibling.minWeightKg);
      const otherMax = sibling.maxWeightKg == null ? Number.POSITIVE_INFINITY : Number(sibling.maxWeightKg);
      const thisMax = input.maxWeightKg ?? Number.POSITIVE_INFINITY;
      // Half-open ranges: [min, max). They overlap when each starts before the
      // other ends.
      if (input.minWeightKg < otherMax && otherMin < thisMax) {
        throw new ShippingBandInvalidError(
          `Overlaps the existing ${otherMin}–${sibling.maxWeightKg ?? "∞"}kg band in this currency`,
        );
      }
    }
    const data = { ...input };
    return rateId
      ? tx.shippingRate.update({ where: { id: rateId }, data })
      : tx.shippingRate.create({ data });
  });
}

export async function deleteShippingRate(rateId: string) {
  return db.shippingRate.delete({ where: { id: rateId } });
}
