import type { CheckoutQuote, CheckoutQuoteRequest } from "@avenick/contracts";
import {
  ShippingRateUnavailableError,
  ShippingZoneAmbiguousError,
  ShippingZoneUnavailableError,
  composeOrderTotals,
  db,
  evaluateCommercePromotions,
  quoteShipping,
  resolveTaxJurisdiction,
} from "@avenick/database";
import type { Logger } from "@avenick/observability";

import { conflict, forbidden, notFound, unauthenticated, validationFailed } from "../../_lib/errors";
import type { Principal } from "../../_lib/principal";
import {
  composeGoodsTotals,
  priceQuoteLines,
  type PricedQuoteLine,
  type QuotableProduct,
} from "./quote-lines";

/**
 * POST /api/v1/checkout/quote — the only endpoint on this surface that states
 * a total, and the reason the phone must never compute money locally.
 *
 * Every figure here is resolved server-side. The client sends identity and
 * quantity and nothing else that costs money: prices come from the published
 * price lists, the discount from the promotions engine, VAT from the statutory
 * table keyed on the place of supply, and freight from the shipping zones. A
 * shipping figure the client can influence is a discount the client can grant
 * itself.
 *
 * The order-level arithmetic is `composeOrderTotals` and nothing else. That is
 * not a preference: PR #21 fixed a defect where the total was
 * `goods + goodsVat + shipping`, adding freight AFTER tax and so never taxing
 * it. Every figure agreed with every other, the buyer was undercharged, and the
 * understated `vatAmount` was persisted for invoicing to read. `composeOrderTotals`
 * is the one function that assembles those parts correctly, so the quote and
 * the order reach the same total by running the same code, not by two
 * implementations that happen to agree today.
 *
 * `calculateOrderTotal` in `packages/utils/src/currency.ts` is the stale
 * pre-#21 arithmetic — it taxes the goods and adds the freight untaxed. It has
 * no callers, it is being deleted, and
 * `__tests__/checkout-quote-arithmetic.regression.test.ts` fails if this route
 * ever grows an import of it.
 */

/** How long a quote is honoured. Prices, stock and promotions all move. */
export const QUOTE_TTL_MS = 15 * 60_000;

const PRODUCT_SELECTION = {
  seller: { select: { status: true, deletedAt: true } },
  prices: true,
  variants: { include: { prices: true } },
} as const;

export interface BuildQuoteInput {
  request: CheckoutQuoteRequest;
  principal: Principal | null;
  requestId: string;
  log: Logger;
  now?: Date;
}

export async function buildCheckoutQuote(input: BuildQuoteInput): Promise<CheckoutQuote> {
  const { request, principal } = input;
  const now = input.now ?? new Date();

  /*
    THE PLACE OF SUPPLY.

    Resolved first, and by the same function the order uses. VAT follows where
    the goods are delivered, not the currency they are priced in, and a
    destination this platform cannot tax is refused rather than taxed at a
    guess. The contract's CountrySchema already narrows this to the six GCC
    states, all of which are in the rate table, so the refusal below is a guard
    against the table and the enum drifting apart — not dead code.
  */
  let jurisdiction: ReturnType<typeof resolveTaxJurisdiction>;
  try {
    jurisdiction = resolveTaxJurisdiction(request.shippingAddress, request.currency);
  } catch (error) {
    throw validationFailed(
      error instanceof Error ? error.message : "This destination cannot be priced.",
      { "shippingAddress.country": ["Delivery to this destination cannot be priced."] },
    );
  }

  /*
    B2B PRICING NEEDS AN IDENTITY.

    `createOrder` refuses a B2B order without an active, verified company
    membership. Quoting B2B prices to anyone who asks would publish a company's
    negotiated price list to the internet, so the same rule applies one step
    earlier — and it distinguishes "sign in" (401, the app can fix it) from
    "this account has no company" (403, refreshing will not help).
  */
  if (request.channel === "B2B") {
    if (!principal) throw unauthenticated("Sign in to a business account to see business pricing.");
    if (!principal.companyId) {
      throw forbidden("Business pricing needs an active verified company membership.");
    }
  }

  if (request.cartId) await assertCartMatches(request, principal);

  const productIds = [...new Set(request.items.map((item) => item.productId))];
  const products = (await db.product.findMany({
    where: { id: { in: productIds }, deletedAt: null },
    include: PRODUCT_SELECTION,
  })) as unknown as QuotableProduct[];

  const pricedLines = priceQuoteLines({
    items: request.items,
    products: new Map(products.map((product) => [product.id, product])),
    channel: request.channel,
    currency: request.currency,
  });

  const promotion = await evaluatePromotions({ request, principal, lines: pricedLines });

  const goods = composeGoodsTotals({
    lines: pricedLines,
    lineDiscounts: promotion.lineDiscounts,
    vatRatePercent: jurisdiction.rate,
  });

  const shipping = await quoteFreight({
    request,
    subtotal: goods.subtotal,
    lines: pricedLines,
    vatRatePercent: jurisdiction.rate,
    log: input.log,
    requestId: input.requestId,
  });

  /*
    ONE PLACE ASSEMBLES THE MONEY.

    Note what is NOT here: no `+`, no rounding, no VAT expression. The delivery
    VAT, the declared `vatAmount` and the final `total` are all produced by
    `composeOrderTotals`, which is the same call `createOrder` makes with the
    same four inputs. If the statutory treatment of freight changes, it changes
    in one function and both the quote and the order follow it.
  */
  const totals = composeOrderTotals({
    subtotal: goods.subtotal,
    discountAmount: promotion.discountAmount,
    goodsVatAmount: goods.goodsVatAmount,
    shippingAmount: shipping.amount,
    vatRatePercent: jurisdiction.rate,
  });

  return {
    /*
      NOTE FOR THE BACKEND: there is no Quote table, so this id correlates a
      quote to its log line and nothing more — it cannot be replayed, and
      `POST /api/orders` neither accepts nor verifies one. That means the quote
      is advisory: the order re-prices from the same sources at submit time and
      can legitimately differ if a price, a promotion or a tariff moved in
      between. `expiresAt` is what bounds that window. Persisting the quote and
      binding the order to it needs a schema change; see the report.
    */
    quoteId: `qt_${globalThis.crypto.randomUUID()}`,
    currency: request.currency,
    channel: request.channel,
    vatRatePercent: jurisdiction.rate,
    lines: goods.lines,
    shipping,
    promotions: promotion.applied,
    totals,
    expiresAt: new Date(now.getTime() + QUOTE_TTL_MS).toISOString(),
  };
}

/**
 * Refuse a quote for a basket that is not the basket the server holds.
 *
 * The contract carries `cartId` so the server can do exactly this. Without the
 * check a phone that edited its cart on another device would be shown a total
 * for lines the account no longer has, and would then submit an order the
 * server prices differently — the classic "the price changed at checkout"
 * complaint, caused by the client and the server disagreeing about what is in
 * the basket rather than about what anything costs.
 */
async function assertCartMatches(
  request: CheckoutQuoteRequest,
  principal: Principal | null,
): Promise<void> {
  if (!principal) {
    // A guest basket lives on the device; there is no server cart to reconcile
    // it against, so a cartId from a guest is a request the server cannot honour.
    throw validationFailed("A cart id can only be checked for a signed-in account.", {
      cartId: ["Omit cartId when quoting as a guest."],
    });
  }
  const cart = await db.cart.findUnique({
    where: { id: request.cartId },
    select: { userId: true, items: { select: { productId: true, variantId: true, qty: true } } },
  });
  // Someone else's cart id is answered as "not found", never as "forbidden":
  // the difference between the two tells a prober which ids exist.
  if (!cart || cart.userId !== principal.userId) throw notFound("That cart no longer exists.");

  const held = new Map<string, number>();
  for (const item of cart.items) {
    const key = `${item.productId}::${item.variantId ?? ""}`;
    held.set(key, (held.get(key) ?? 0) + item.qty);
  }
  const asked = new Map<string, number>();
  for (const item of request.items) {
    const key = `${item.productId}::${item.variantId ?? ""}`;
    asked.set(key, (asked.get(key) ?? 0) + item.quantity);
  }
  const agrees =
    held.size === asked.size && [...asked].every(([key, quantity]) => held.get(key) === quantity);
  if (!agrees) {
    throw conflict("Your cart changed. Reload it and ask for the total again.");
  }
}

interface PromotionOutcome {
  discountAmount: number;
  lineDiscounts: Record<string, number>;
  applied: CheckoutQuote["promotions"];
}

const NO_PROMOTIONS: PromotionOutcome = { discountAmount: 0, lineDiscounts: {}, applied: [] };

/**
 * Promotions, and the one thing a guest cannot have.
 *
 * `evaluateCommercePromotions` takes a `userId` and uses it to count
 * redemptions against per-customer limits. There is no honest value to pass
 * for a guest: a sentinel id counts zero redemptions for everybody, which
 * hands every guest a promotion that is capped at one per customer, and hands
 * it to them again on every request. So a guest is quoted at list price — a
 * total that can only come DOWN when they sign in, never up — and a guest who
 * sends a coupon code is told to sign in rather than being silently ignored.
 *
 * That is a real divergence between the guest quote and the eventual order,
 * and it is stated here rather than hidden: see the report.
 */
async function evaluatePromotions(input: {
  request: CheckoutQuoteRequest;
  principal: Principal | null;
  lines: readonly PricedQuoteLine[];
}): Promise<PromotionOutcome> {
  const { request, principal } = input;
  if (!principal) {
    if (request.couponCode) {
      throw unauthenticated("Sign in to use a coupon code.");
    }
    return NO_PROMOTIONS;
  }

  // Exactly the projection `createOrder` hands the engine. The scope fields
  // are not decoration: a seller-scoped or category-scoped rule that cannot see
  // them silently declines to apply, and the quote would then show a price the
  // order beats.
  const lines = input.lines.map((line) => ({
    key: line.key,
    productId: line.productId,
    categoryId: line.categoryId,
    brandId: line.brandId,
    sellerId: line.sellerId,
    quantity: line.quantity,
    baseUnitPrice: line.unitPrice,
  }));

  try {
    const evaluation = await evaluateCommercePromotions({
      tenantKey: "default",
      userId: principal.userId,
      ...(principal.companyId ? { companyId: principal.companyId } : {}),
      currency: request.currency,
      country: request.shippingAddress.country,
      ...(request.couponCode ? { couponCode: request.couponCode } : {}),
      lines,
    });
    return {
      discountAmount: evaluation.discountAmount,
      lineDiscounts: evaluation.lineDiscounts,
      applied: evaluation.applied.map((promotion) => ({
        promotionId: promotion.promotionId,
        couponCode: promotion.couponCode ?? null,
        label: promotion.name.slice(0, 200),
        discountAmount: promotion.discount,
      })),
    };
  } catch (error) {
    // Every refusal this engine raises is about the coupon the client sent —
    // invalid, expired, exhausted, not combinable. That is a fixable input, so
    // it is named as a field error rather than reported as a fault.
    const message = error instanceof Error ? error.message : "This coupon cannot be applied.";
    throw validationFailed(message, { couponCode: [message] });
  }
}

/**
 * Delivery, priced by the SAME function the order transaction uses.
 *
 * `quoteShipping` takes an optional transaction client and defaults to the
 * global one, so freight quoting is genuinely reachable outside a transaction
 * and nothing here duplicates it. The difference between quoting inside
 * `createOrder`'s transaction and quoting here is real but is a property of
 * quoting at all, not of this implementation: an operator can retune a tariff
 * between the quote and the order. That window is what `expiresAt` bounds.
 *
 * The three statuses are the three answers `createOrder` already acts on, and
 * a bare `amount: 0` cannot tell them apart:
 *
 *   · unpriced_no_zones — no zones configured anywhere. Freight is genuinely
 *     zero and the order will proceed. This is how checkout behaved before
 *     shipping zones existed.
 *   · priced — a zone covers the destination.
 *   · unavailable — zones exist and none covers this destination, or the
 *     configuration is ambiguous or publishes no band. The ORDER WILL BE
 *     REFUSED. An app that could not tell this from the first case would show
 *     a free-delivery badge on an order that is about to be rejected.
 */
async function quoteFreight(input: {
  request: CheckoutQuoteRequest;
  subtotal: number;
  lines: readonly { quantity: number; weightKg: number | null }[];
  vatRatePercent: number;
  log: Logger;
  requestId: string;
}): Promise<CheckoutQuote["shipping"]> {
  const base = {
    zoneName: null,
    amount: 0,
    vatRatePercent: input.vatRatePercent,
    estimatedDaysMin: null,
    estimatedDaysMax: null,
  } as const;

  const configuredZones = await db.shippingZone.count({ where: { isActive: true } });
  if (configuredZones === 0) return { ...base, status: "unpriced_no_zones" };

  try {
    const quote = await quoteShipping({
      country: input.request.shippingAddress.country,
      currency: input.request.currency,
      subtotal: input.subtotal,
      lines: input.lines.map((line) => ({ quantity: line.quantity, weightKg: line.weightKg })),
    });
    // `quoteShipping` returns the operator-facing zone CODE, which
    // schema.prisma marks "never shown to a buyer". The contract asks for a
    // name, so the buyer-facing one is read by id — one indexed lookup rather
    // than a code on a checkout screen.
    const zone = await db.shippingZone.findUnique({
      where: { id: quote.zoneId },
      select: { nameEn: true },
    });
    return {
      status: "priced",
      zoneName: zone?.nameEn?.slice(0, 120) ?? null,
      amount: Number(quote.price.toFixed(2)),
      vatRatePercent: input.vatRatePercent,
      estimatedDaysMin: quote.etaMinDays,
      estimatedDaysMax: quote.etaMaxDays,
    };
  } catch (error) {
    if (error instanceof ShippingZoneUnavailableError) return { ...base, status: "unavailable" };
    if (error instanceof ShippingZoneAmbiguousError || error instanceof ShippingRateUnavailableError) {
      // Not a buyer's fault and not a fault of this request: two zones claim
      // one country, or a zone publishes no band for this currency and weight.
      // The buyer is told delivery is unavailable — which is the truth, since
      // the order would be refused — and an operator is told why.
      input.log.error("shipping tariff is misconfigured for a quoted destination", error, {
        requestId: input.requestId,
        country: input.request.shippingAddress.country,
        currency: input.request.currency,
      });
      return { ...base, status: "unavailable" };
    }
    throw error;
  }
}
