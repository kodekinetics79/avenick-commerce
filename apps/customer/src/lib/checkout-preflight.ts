/**
 * PRE-SUBMIT VALIDATION THAT MIRRORS THE SERVER'S REFUSALS.
 *
 * createOrder (packages/database/src/services/orders.ts) and the order route
 * (app/api/orders/route.ts) refuse an order for a fixed set of reasons. Every
 * one of them is right — the server must never guess — but each is discovered
 * only after the buyer has walked all three steps and pressed submit, and
 * several of them (an unserved destination, a variant not chosen) fall outside
 * the route's business-error pattern and arrive as a bare 500.
 *
 * This module asks the same questions BEFORE submission, from facts the server
 * itself has published: the delivery tariff's shape (checkout-shipping-coverage),
 * the catalogue's own projection of each product (/api/products/[slug]), and
 * the request schema's field limits. It is pure and it computes NO MONEY: no
 * price, rate, weight band or discount is evaluated here. A refusal states the
 * rule the server would apply; the figures stay the server's.
 *
 * Each refusal kind is annotated with the server error it mirrors, so the
 * mapping can be read in one place and tested without a database.
 */

import { COUNTRY_VALUES } from "@avenick/types/schemas";
import { VAT_RATES } from "@avenick/utils";
import {
  resolveDestinationCoverage,
  type DestinationCoverage,
  type ShippingCoverage,
} from "./checkout-shipping-coverage";

// ─── Address ────────────────────────────────────────────────────────────────

export interface CheckoutAddress {
  label: string;
  line1: string;
  city: string;
  country: string;
}

export type AddressField = keyof CheckoutAddress;
export type AddressFieldError = "REQUIRED" | "TOO_SHORT" | "TOO_LONG" | "UNSUPPORTED_COUNTRY";
export type AddressErrors = Partial<Record<AddressField, AddressFieldError>>;

/**
 * The order route's `CreateOrderSchema.shippingAddress`, field for field:
 * label 1–80, line1 3–240, city 1–120 (all trimmed), country from the Prisma
 * Country enum. A value that fails here is a 400 there.
 */
export const ADDRESS_LIMITS = {
  label: { min: 1, max: 80 },
  line1: { min: 3, max: 240 },
  city: { min: 1, max: 120 },
} as const;

export const ADDRESS_FIELD_ORDER: readonly AddressField[] = ["label", "line1", "city", "country"];

export function isSupportedDestination(country: string): boolean {
  return (COUNTRY_VALUES as readonly string[]).includes(country.trim().toUpperCase());
}

export function validateShippingAddress(address: CheckoutAddress): AddressErrors {
  const errors: AddressErrors = {};
  for (const field of ["label", "line1", "city"] as const) {
    const value = address[field].trim();
    const { min, max } = ADDRESS_LIMITS[field];
    if (value.length === 0) errors[field] = "REQUIRED";
    else if (value.length < min) errors[field] = "TOO_SHORT";
    else if (value.length > max) errors[field] = "TOO_LONG";
  }
  const country = address.country.trim();
  if (!country) errors.country = "REQUIRED";
  else if (!isSupportedDestination(country)) errors.country = "UNSUPPORTED_COUNTRY";
  return errors;
}

// ─── VAT jurisdiction ───────────────────────────────────────────────────────

export interface VatJurisdiction {
  country: string;
  /** Statutory rate in percent, from the one table the server also reads. */
  ratePercent: number;
}

/**
 * The place of supply is the delivery destination (resolveTaxJurisdiction).
 * Read from the same VAT_RATES table the server uses, with the same explicit
 * membership probe — a bare Record reads an unknown key back as undefined.
 * This names the rate the server WILL apply; it never applies it.
 */
export function vatJurisdictionFor(country: string): VatJurisdiction | null {
  const iso = country.trim().toUpperCase();
  if (!iso || !Object.prototype.hasOwnProperty.call(VAT_RATES, iso)) return null;
  const rate = VAT_RATES[iso];
  return typeof rate === "number" && Number.isFinite(rate) ? { country: iso, ratePercent: rate } : null;
}

// ─── Product facts ──────────────────────────────────────────────────────────

/** What the catalogue says about a product, read for one cart line's identity. */
export interface ProductFacts {
  productId: string;
  /** The server's current MOQ — createOrder reads the product row, not the cart. */
  moq: number;
  /** Unit weight in kg, or null when unrecorded (the quote's basis becomes FALLBACK). */
  weightKg: number | null;
  /** Ids of the product's ACTIVE variants; non-empty means one must be chosen. */
  activeVariantIds: string[];
  isB2CEnabled: boolean;
  /**
   * Units available for the line's identity (base SKU or chosen variant), or
   * null when the catalogue holds no stock rows for it — which the server
   * counts as zero available.
   */
  availableQty: number | null;
}

/** The catalogue answered 404: withdrawn, inactive, or not publicly listed. */
export interface CatalogueMiss {
  productId: string;
  unavailable: true;
}

export type LineFacts = ProductFacts | CatalogueMiss;

const asNumber = (value: unknown): number | null => {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(n) ? n : null;
};

/**
 * Project /api/products/[slug]'s DTO (lib/catalog-detail-dto.ts) to the facts
 * checkout needs. Structural and defensive: the DTO serialises Prisma Decimals
 * as strings, and an older shape must degrade to "unverified" (null) rather
 * than to a wrong refusal.
 */
export function productFactsFromCatalogDetail(dto: unknown, variantId?: string): ProductFacts | null {
  if (typeof dto !== "object" || dto === null) return null;
  const d = dto as Record<string, unknown>;
  if (typeof d.id !== "string" || typeof d.moq !== "number") return null;
  const variants = Array.isArray(d.variants) ? (d.variants as Array<Record<string, unknown>>) : [];
  const activeVariantIds = variants.map((v) => v.id).filter((id): id is string => typeof id === "string");
  const inventory = Array.isArray(d.inventory) ? (d.inventory as Array<Record<string, unknown>>) : [];

  let availableQty: number | null = null;
  if (variantId) {
    const variant = variants.find((v) => v.id === variantId);
    availableQty = variant && variant.availabilityStatus !== "UNCONFIRMED" ? asNumber(variant.availableQty) : null;
  } else {
    const base = inventory[0];
    availableQty = base && base.status !== "UNCONFIRMED" ? asNumber(base.availableQty) : null;
  }

  return {
    productId: d.id,
    moq: Math.max(1, Math.trunc(d.moq)),
    weightKg: asNumber(d.weight),
    activeVariantIds,
    isB2CEnabled: d.isB2CEnabled !== false,
    availableQty,
  };
}

// ─── Lines ──────────────────────────────────────────────────────────────────

export interface PreflightLine {
  id: string;
  productId: string;
  variantId?: string;
  qty: number;
  /** The MOQ captured when the line was added; superseded by ProductFacts.moq. */
  moq?: number;
  currency: string;
  channel?: "B2C" | "B2B";
  /** The rate on the displayed price row; the server taxes at the destination's rate instead. */
  vatRate?: number;
}

/**
 * A refusal the server is certain to issue. `mirrors` names the server error.
 */
export type PreflightRefusal =
  /** mirrors: prices resolve in one currency; a foreign line has "No active B2C price … in {currency}" (409) */
  | { kind: "MIXED_CURRENCY" }
  /** mirrors: assertGovernedB2BCheckout — "B2B orders must be created through the governed purchase-order workflow" */
  | { kind: "B2B_LINES"; lineIds: string[] }
  /** mirrors: CreateOrderSchema country enum — 400 */
  | { kind: "DESTINATION_UNSUPPORTED"; country: string }
  /** mirrors: ShippingZoneUnavailableError — "No active shipping zone covers {country}" (500) */
  | { kind: "DESTINATION_UNSERVED"; country: string }
  /** mirrors: ShippingZoneAmbiguousError — "{country} is claimed by more than one active shipping zone" (500) */
  | { kind: "DESTINATION_AMBIGUOUS"; country: string; zoneCodes: string[] }
  /** mirrors: ShippingRateUnavailableError — "Zone {code} publishes no active {currency} rate covering this weight" (500) */
  | { kind: "RATE_UNAVAILABLE"; zoneCode: string; currency: string }
  /** mirrors: assertMinimumOrderQuantity — "Minimum order quantity for "{name}" is {moq}" (409) */
  | { kind: "BELOW_MOQ"; lineId: string; moq: number; qty: number }
  /** mirrors: "Select a product variant for "{name}"" (500) */
  | { kind: "VARIANT_REQUIRED"; lineId: string }
  /** mirrors: "Selected variant is unavailable for "{name}"" (409) */
  | { kind: "VARIANT_UNAVAILABLE"; lineId: string }
  /** mirrors: ""{name}" is not available for B2C ordering" (409) */
  | { kind: "CHANNEL_NOT_B2C"; lineId: string }
  /** mirrors: "Insufficient stock for "{name}" ({available} available, {qty} requested)" (409) */
  | { kind: "INSUFFICIENT_STOCK"; lineId: string; available: number; qty: number; unconfirmed: boolean };

/** A fact worth stating that does not stop the order. */
export type PreflightNotice =
  /** quoteShipping basis FALLBACK: a line has no recorded weight, so the zone's flat rate applies. */
  | { kind: "DELIVERY_FALLBACK_RATE"; lineIds: string[]; zoneCode: string; fallbackPrice: number }
  /** The catalogue answered 404 for this line; the server will refuse it if it has been withdrawn. */
  | { kind: "CATALOGUE_MISS"; lineId: string }
  /** These lines could not be re-checked against the catalogue (no slug, or the read failed). */
  | { kind: "FACTS_UNVERIFIED"; lineIds: string[] };

export type DeliveryExpectation =
  | { kind: "UNKNOWN" }
  | { kind: "NOT_CONFIGURED" }
  | { kind: "UNSERVED"; country: string }
  | { kind: "AMBIGUOUS"; country: string }
  | {
      kind: "QUOTED";
      zone: { code: string; nameEn: string; nameAr: string };
      /**
       * WEIGHT_BAND when every line is weighed, FALLBACK when any is not,
       * UNDETERMINED when some lines are unverified. The server decides
       * FREE_THRESHOLD from its own subtotal; only the threshold is stated.
       */
      basis: "WEIGHT_BAND" | "FALLBACK" | "UNDETERMINED";
      fallbackPrice: number;
      freeOverSubtotal: number | null;
    };

export interface PreflightInput {
  lines: PreflightLine[];
  address: CheckoutAddress;
  currency: string;
  coverage: ShippingCoverage | null;
  /**
   * Keyed by LINE id, not product id: two lines may share a product and differ
   * by variant, and stock is a fact about the variant. Absent means not (yet)
   * verified against the catalogue.
   */
  facts: Readonly<Record<string, LineFacts | undefined>>;
}

export interface PreflightResult {
  addressErrors: AddressErrors;
  refusals: PreflightRefusal[];
  notices: PreflightNotice[];
  delivery: DeliveryExpectation;
  jurisdiction: VatJurisdiction | null;
  /**
   * True when a displayed line carries a VAT rate other than the destination's
   * statutory rate. The server taxes every line at the latter, so the cart's
   * VAT estimate will not match the order.
   */
  vatRateDiffers: boolean;
  canSubmit: boolean;
}

export function preflightCheckout(input: PreflightInput): PreflightResult {
  const refusals: PreflightRefusal[] = [];
  const notices: PreflightNotice[] = [];
  const addressErrors = validateShippingAddress(input.address);

  const currencies = new Set(input.lines.map((line) => line.currency));
  if (currencies.size > 1 || (currencies.size === 1 && !currencies.has(input.currency))) {
    refusals.push({ kind: "MIXED_CURRENCY" });
  }

  const b2bLines = input.lines.filter((line) => line.channel === "B2B").map((line) => line.id);
  if (b2bLines.length > 0) refusals.push({ kind: "B2B_LINES", lineIds: b2bLines });

  const country = input.address.country.trim().toUpperCase();
  const jurisdiction = vatJurisdictionFor(country);
  let destination: DestinationCoverage = { status: "UNKNOWN" };
  if (country && !isSupportedDestination(country)) {
    refusals.push({ kind: "DESTINATION_UNSUPPORTED", country });
  } else if (country) {
    destination = resolveDestinationCoverage(input.coverage, country);
    if (destination.status === "UNSERVED") refusals.push({ kind: "DESTINATION_UNSERVED", country });
    if (destination.status === "AMBIGUOUS") {
      refusals.push({ kind: "DESTINATION_AMBIGUOUS", country, zoneCodes: destination.zoneCodes });
    }
  }

  const unverified: string[] = [];
  const unweighed: string[] = [];
  let everyLineWeighed = input.lines.length > 0;

  for (const line of input.lines) {
    const facts = input.facts[line.id];
    const isInteger = Number.isInteger(line.qty);

    if (!facts) {
      unverified.push(line.id);
      everyLineWeighed = false;
      const moq = Math.max(1, Number.isInteger(line.moq) ? (line.moq as number) : 1);
      if (!isInteger || line.qty < moq) refusals.push({ kind: "BELOW_MOQ", lineId: line.id, moq, qty: line.qty });
      continue;
    }
    if ("unavailable" in facts) {
      notices.push({ kind: "CATALOGUE_MISS", lineId: line.id });
      everyLineWeighed = false;
      continue;
    }

    const moq = Math.max(1, facts.moq);
    if (!isInteger || line.qty < moq) refusals.push({ kind: "BELOW_MOQ", lineId: line.id, moq, qty: line.qty });
    if (!facts.isB2CEnabled) refusals.push({ kind: "CHANNEL_NOT_B2C", lineId: line.id });

    if (!line.variantId && facts.activeVariantIds.length > 0) {
      refusals.push({ kind: "VARIANT_REQUIRED", lineId: line.id });
    } else if (line.variantId && !facts.activeVariantIds.includes(line.variantId)) {
      refusals.push({ kind: "VARIANT_UNAVAILABLE", lineId: line.id });
    } else {
      const available = facts.availableQty ?? 0;
      if (line.qty > available) {
        refusals.push({
          kind: "INSUFFICIENT_STOCK",
          lineId: line.id,
          available,
          qty: line.qty,
          unconfirmed: facts.availableQty == null,
        });
      }
    }

    if (facts.weightKg == null) {
      unweighed.push(line.id);
      everyLineWeighed = false;
    }
  }

  let delivery: DeliveryExpectation;
  switch (destination.status) {
    case "NOT_CONFIGURED":
      delivery = { kind: "NOT_CONFIGURED" };
      break;
    case "UNSERVED":
      delivery = { kind: "UNSERVED", country: destination.country };
      break;
    case "AMBIGUOUS":
      delivery = { kind: "AMBIGUOUS", country: destination.country };
      break;
    case "SERVED": {
      const { zone } = destination;
      const basis = unweighed.length > 0 ? "FALLBACK" : everyLineWeighed ? "WEIGHT_BAND" : "UNDETERMINED";
      delivery = {
        kind: "QUOTED",
        zone: { code: zone.code, nameEn: zone.nameEn, nameAr: zone.nameAr },
        basis,
        fallbackPrice: zone.fallbackPrice,
        freeOverSubtotal: zone.freeOverSubtotal,
      };
      if (unweighed.length > 0) {
        notices.push({ kind: "DELIVERY_FALLBACK_RATE", lineIds: unweighed, zoneCode: zone.code, fallbackPrice: zone.fallbackPrice });
      }
      // A weighed basket needs a band in this currency. The free threshold is
      // checked by the server BEFORE the bands, so with one configured the
      // order might still price — only its absence makes the refusal certain.
      if (basis === "WEIGHT_BAND" && zone.freeOverSubtotal == null && !zone.ratedCurrencies.includes(input.currency)) {
        refusals.push({ kind: "RATE_UNAVAILABLE", zoneCode: zone.code, currency: input.currency });
      }
      break;
    }
    default:
      delivery = { kind: "UNKNOWN" };
  }

  if (unverified.length > 0) notices.push({ kind: "FACTS_UNVERIFIED", lineIds: unverified });

  const vatRateDiffers = jurisdiction != null && input.lines.some((line) =>
    line.vatRate != null && Math.round(line.vatRate * 100) !== Math.round(jurisdiction.ratePercent * 100),
  );

  return {
    addressErrors,
    refusals,
    notices,
    delivery,
    jurisdiction,
    vatRateDiffers,
    canSubmit: input.lines.length > 0 && refusals.length === 0 && Object.keys(addressErrors).length === 0,
  };
}
