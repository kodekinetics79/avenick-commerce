import { db } from "../index";
import { write } from "../resilient-ops";
import { enforcePromotionRedemptionCapacity, evaluateCommercePromotions } from "./promotions";
import {
  assertMinimumOrderQuantity,
  inventoryStockIdentityWhere,
  lockCompanyApprovalRows,
  lockInventoryStockRows,
  lockProductCommercialRows,
  lockSellerCommercialRows,
  composeOrderTotals,
  lockUserCommerceRows,
} from "./checkout-invariants";
import { resolveCompanyOrderIntegration } from "./integration-routing";
import { assertMatchingIdempotencyFingerprint } from "./commerce-governance";
// The statutory VAT table lives in exactly one place. Re-declaring rates here is
// what produced the two-sources-of-truth defect this module now guards against.
import { VAT_RATES } from "@avenick/utils";
import type { Prisma, OrderStatus, Country, Currency, PaymentMethod } from "@prisma/client";
import { quoteShipping } from "./shipping-zones";

// Prisma interactive-transaction client — the subset of the client available
// inside db.$transaction(async (tx) => ...). Lets commission accrual join an
// existing payment-confirmation transaction so money and its ledger commit as one.
type Tx = Prisma.TransactionClient;

/**
 * Accrue the platform's commission for every seller on a paid order in the same
 * transaction that confirms payment. Commission is based on merchandise value
 * EXCLUDING VAT; the previous implementation used OrderItem.total, which meant
 * the platform could collect commission on tax.
 */
export async function accrueCommissions(tx: Tx, orderId: string): Promise<void> {
  const existing = await tx.commission.count({ where: { orderId } });
  if (existing > 0) return; // already accrued — replay-safe

  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return;

  const perSeller = new Map<string, Prisma.Decimal>();
  for (const item of order.items) {
    const merchandiseNet = item.total.sub(item.vatAmount);
    const prev = perSeller.get(item.sellerId);
    perSeller.set(item.sellerId, prev ? prev.add(merchandiseNet) : merchandiseNet);
  }

  for (const [sellerId, sellerTotal] of perSeller) {
    const profile = await tx.sellerProfile.findUnique({
      where: { id: sellerId },
      select: { id: true, commissionRate: true },
    });
    if (!profile) continue;
    const rate = profile.commissionRate;
    const amount = sellerTotal.mul(rate).div(100);
    await tx.commission.create({
      data: {
        sellerId: profile.id,
        orderId: order.id,
        amount,
        rate,
        currency: order.currency,
      },
    });
  }
}

// Collision-resistant, human-readable order number.
export function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const time = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.floor(100 + Math.random() * 900);
  return `AVN-${year}-${time}${rand}`;
}

export interface CreateOrderInput {
  userId: string;
  companyId?: string;
  type: "B2C" | "B2B";
  currency: Currency;
  // unitPrice is intentionally NOT accepted from the caller — prices are
  // resolved server-side from the catalog to prevent price tampering.
  items: { productId: string; variantId?: string; quantity: number; sellerId: string }[];
  shippingAddress: Record<string, string>;
  paymentMethod?: PaymentMethod;
  notes?: string;
  purchaseOrderId?: string;
  couponCode?: string;
  /** Client-supplied key: safe retries return the original order. */
  idempotencyKey?: string;
  /** Canonical server-derived representation bound to idempotencyKey. */
  requestFingerprint?: string;
  /** Internal PO-only terms proven under the governed placement lock. */
  governedCommercial?: {
    total: number;
    lines: Array<{
      productId: string;
      variantId?: string | null;
      sellerId: string;
      quantity: number;
      unitPrice: number;
      vatRate: number;
      sourcePriceId?: string | null;
      sku: string;
      nameEn: string;
    }>;
  };
  /** Deterministic seam after governed integration routing locks are held. */
  afterIntegrationRoutingLocks?: () => Promise<void>;
}

/**
 * The tax jurisdiction that governs an order. VAT follows the place of supply —
 * where the goods are delivered — which is why the shipping destination, not the
 * currency, is the authority here.
 */
export interface TaxJurisdiction {
  /** ISO 3166-1 alpha-2 country whose VAT law governs this order. */
  country: string;
  /** Statutory rate in percent, read from the one table in @avenick/utils. */
  rate: number;
  /** How the country was established; surfaced in the refusal message. */
  source: "SHIPPING_DESTINATION" | "CURRENCY_HOME_COUNTRY";
}

/**
 * A currency is not a jurisdiction. Each GCC currency does have exactly one
 * issuing state, so when a destination is genuinely absent the issuing state is
 * the only defensible place of supply — and that is the ONLY case in which this
 * map is consulted. USD is deliberately absent: it has no GCC home country, so a
 * USD order with no destination has no derivable jurisdiction and must fail
 * rather than be taxed at a guess.
 */
const CURRENCY_HOME_COUNTRY: Partial<Record<Currency, Country>> = {
  AED: "AE",
  SAR: "SA",
  QAR: "QA",
  KWD: "KW",
  BHD: "BH",
  OMR: "OM",
};

// VAT_RATES is a bare Record<string, number>, so an unknown key reads back as a
// typed number that is actually undefined. Probe membership explicitly instead.
function statutoryVatRate(country: string): number | undefined {
  return Object.prototype.hasOwnProperty.call(VAT_RATES, country) ? VAT_RATES[country] : undefined;
}

/**
 * Establish the order's tax jurisdiction, or refuse. Never returns a guess.
 */
export function resolveTaxJurisdiction(
  shippingAddress: Record<string, string> | null | undefined,
  currency: Currency,
): TaxJurisdiction {
  const destination = shippingAddress?.["country"]?.trim().toUpperCase();
  if (destination) {
    const rate = statutoryVatRate(destination);
    // A stated destination we cannot tax is never quietly reinterpreted as the
    // currency's home country: that would tax a real address by a guess.
    if (rate === undefined) {
      throw new Error(
        `No VAT jurisdiction is configured for delivery destination "${destination}"; this order cannot be priced`,
      );
    }
    return { country: destination, rate, source: "SHIPPING_DESTINATION" };
  }
  const homeCountry = CURRENCY_HOME_COUNTRY[currency];
  const homeRate = homeCountry ? statutoryVatRate(homeCountry) : undefined;
  if (!homeCountry || homeRate === undefined) {
    throw new Error(
      `Order has no delivery destination and ${currency} has no home VAT jurisdiction; this order cannot be priced`,
    );
  }
  return { country: homeCountry, rate: homeRate, source: "CURRENCY_HOME_COUNTRY" };
}

/**
 * Refuse any line whose configured rate contradicts the jurisdiction's statutory
 * rate. Silently overriding would hide a mispriced catalog from the seller;
 * silently accepting is the defect itself. Both are wrong, so this throws.
 *
 * ProductPrice.vatRate is a bare non-null Decimal — the schema has no
 * zero-rated/exempt marker — so a 0 on a price row is honoured only where the
 * jurisdiction is itself zero-rated (QA and KW today). A genuine per-product
 * exemption would need a schema field, which this change does not invent.
 */
export function assertStatutoryVatRate(
  productName: string,
  configuredRate: number,
  jurisdiction: TaxJurisdiction,
): number {
  if (!Number.isFinite(configuredRate) || configuredRate < 0) {
    throw new Error(`Configured VAT rate for "${productName}" is invalid`);
  }
  // Compare as integer basis points: vatRate is Decimal(5,2) against a whole-
  // percent table, so binary float equality is the only hazard in this compare.
  if (Math.round(configuredRate * 100) !== Math.round(jurisdiction.rate * 100)) {
    throw new Error(
      `VAT rate mismatch for "${productName}": the price row is configured at ${configuredRate}% but the statutory rate in `
      + `${jurisdiction.country} is ${jurisdiction.rate}% (jurisdiction from ${jurisdiction.source}). `
      + `Correct the price row before this order can be placed.`,
    );
  }
  return jurisdiction.rate;
}

function resolveUnitPrice(
  prices: { id: string; type: string; currency: string; minQty: number; maxQty: number | null; price: Prisma.Decimal; isActive: boolean; vatRate: Prisma.Decimal }[],
  channel: "B2C" | "B2B",
  currency: Currency,
  quantity: number,
) {
  const applicable = prices
    .filter((p) => p.isActive && p.type === channel && p.currency === currency && p.minQty <= quantity && (p.maxQty == null || quantity <= p.maxQty))
    .sort((a, b) => b.minQty - a.minQty);
  return applicable[0] ?? null;
}

const money = (value: number) => Number(value.toFixed(2));
const identityKey = (value: { productId: string; variantId?: string | null; sellerId: string }) =>
  `${value.productId}::${value.variantId ?? ""}::${value.sellerId}`;

export async function createOrder(input: CreateOrderInput) {
  if (input.items.length === 0) throw new Error("Order must contain at least one item");
  if (input.governedCommercial && (input.type !== "B2B" || !input.purchaseOrderId || input.couponCode)) {
    throw new Error("Governed commercial terms require a B2B purchase-order placement without promotions");
  }

  // Resolved before the transaction opens: an order whose jurisdiction cannot be
  // established must fail before it takes a single advisory lock.
  const jurisdiction = resolveTaxJurisdiction(input.shippingAddress, input.currency);
  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const governedByIdentity = new Map(input.governedCommercial?.lines.map((line) => [
    identityKey(line), line,
  ]) ?? []);
  if (input.governedCommercial && governedByIdentity.size !== input.items.length) {
    throw new Error("Governed purchase-order lines do not match the checkout request");
  }

  return write(
    () =>
      db.$transaction(async (tx) => {
        await lockCompanyApprovalRows(tx, input.companyId ? [input.companyId] : []);
        const erpConnection = input.type === "B2B" && input.companyId
          ? await resolveCompanyOrderIntegration(tx, {
              companyId: input.companyId,
              afterRoutingLocks: input.afterIntegrationRoutingLocks,
            })
          : null;
        await lockUserCommerceRows(tx, [input.userId]);
        const currentUser = await tx.user.findUnique({
          where: { id: input.userId },
          include: { companyMember: { include: { company: true } } },
        });
        if (!currentUser || currentUser.deletedAt || currentUser.status !== "ACTIVE") {
          throw new Error("Customer account is not active");
        }
        if (!["CONSUMER", "COMPANY_ADMIN", "COMPANY_BUYER", "COMPANY_APPROVER"].includes(currentUser.role)) {
          throw new Error("This account is not permitted to place customer orders");
        }
        if (input.type === "B2B") {
          const member = currentUser.companyMember;
          if (!input.companyId || !member || member.companyId !== input.companyId || !member.isActive
            || member.company.status !== "ACTIVE" || member.company.deletedAt) {
            throw new Error("An active verified company membership is required for B2B checkout");
          }
        }
        const sellerIds = (await tx.product.findMany({
          where: { id: { in: productIds } },
          select: { sellerId: true },
        })).map(({ sellerId }) => sellerId);
        await lockSellerCommercialRows(tx, sellerIds);
        await lockProductCommercialRows(tx, productIds);
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, deletedAt: null },
          include: {
            seller: { select: { status: true, deletedAt: true } },
            prices: true,
            variants: { include: { prices: true } },
          },
        });
        const productMap = new Map(products.map((product) => [product.id, product]));
        const pricedLines = input.items.map((item, index) => {
          const product = productMap.get(item.productId);
          if (!product || product.status !== "ACTIVE") throw new Error(`Product ${item.productId} is unavailable`);
          if (product.seller.status !== "ACTIVE" || product.seller.deletedAt) {
            throw new Error(`Seller for "${product.nameEn}" is unavailable`);
          }
          if (input.type === "B2B" && !product.isB2BEnabled) {
            throw new Error(`"${product.nameEn}" is not available for B2B ordering`);
          }
          if (input.type === "B2C" && !product.isB2CEnabled) {
            throw new Error(`"${product.nameEn}" is not available for B2C ordering`);
          }
          assertMinimumOrderQuantity(product.nameEn, item.quantity, product.moq);
          const activeVariants = product.variants.filter((candidate) => candidate.isActive);
          if (!item.variantId && activeVariants.length > 0) {
            throw new Error(`Select a product variant for "${product.nameEn}"`);
          }
          const variant = item.variantId
            ? activeVariants.find((candidate) => candidate.id === item.variantId)
            : undefined;
          if (item.variantId && !variant) throw new Error(`Selected variant is unavailable for "${product.nameEn}"`);
          const governed = governedByIdentity.get(identityKey(item));
          if (input.governedCommercial && (!governed || governed.quantity !== item.quantity)) {
            throw new Error("Governed purchase-order lines do not match the checkout request");
          }
          const variantTier = !governed && variant
            ? resolveUnitPrice(variant.prices, input.type, input.currency, item.quantity)
            : null;
          const tier = governed ? null : variantTier ?? resolveUnitPrice(product.prices, input.type, input.currency, item.quantity);
          if (!governed && !tier) throw new Error(`No active ${input.type} price for "${product.nameEn}" in ${input.currency}`);
          const unitPrice = governed?.unitPrice ?? Number(tier!.price);
          // The jurisdiction is the single authority for the rate actually
          // charged. ProductPrice.vatRate is data a seller or an importer typed
          // — consulting it to decide tax is precisely the two-sources-of-truth
          // defect this module now guards against, and its non-null 5% default
          // is wrong in most GCC markets.
          //
          // Statute is applied rather than refused at this boundary on purpose.
          // A mistyped price row is a seller data fault; refusing here would
          // take checkout down for a buyer who did nothing wrong, while still
          // leaving the bad row in the catalog. The row is instead rejected
          // where it is authored (assertStatutoryVatRate, exported for the
          // catalog write paths), so bad data cannot reach a price list at all.
          //
          // A governed purchase order is the one exception: its approved lines
          // are an immutable snapshot fixed at approval and re-verified by the
          // approval fingerprint. Re-deriving their rate here would let a later
          // statutory change silently invalidate an already-approved PO — the
          // one thing the B2B governance layer exists to prevent.
          const vatRate = governed ? Number(governed.vatRate) : jurisdiction.rate;
          return {
            key: `line-${index}`,
            productId: item.productId,
            variantId: item.variantId,
            sellerId: item.sellerId,
            categoryId: product.categoryId,
            brandId: product.brandId,
            sku: governed?.sku ?? variant?.sku ?? product.sku,
            nameEn: governed?.nameEn ?? variant?.nameEn ?? product.nameEn,
            nameAr: variant?.nameAr ?? product.nameAr,
            quantity: item.quantity,
            unitPrice,
            lineSubtotal: money(unitPrice * item.quantity),
            vatRate,
            sourcePriceId: governed ? governed.sourcePriceId ?? undefined : tier!.id,
            priceScope: governed ? "GOVERNED_PO" : variantTier ? "VARIANT" : "PRODUCT",
          };
        });

        const promotion = input.governedCommercial ? {
          discountAmount: 0,
          lineDiscounts: {} as Record<string, number>,
          applied: [],
          explanation: [{ step: "GOVERNED_PO", purchaseOrderId: input.purchaseOrderId }],
        } : await evaluateCommercePromotions({
          tenantKey: "default",
          userId: input.userId,
          companyId: input.companyId,
          currency: input.currency,
          country: input.shippingAddress["country"],
          couponCode: input.couponCode,
          lines: pricedLines.map((line) => ({
            key: line.key,
            productId: line.productId,
            categoryId: line.categoryId,
            brandId: line.brandId,
            sellerId: line.sellerId,
            quantity: line.quantity,
            baseUnitPrice: line.unitPrice,
          })),
        });

        let subtotal = 0;
        let vatTotal = 0;
        const itemData = pricedLines.map((line) => {
          const lineDiscount = Math.min(promotion.lineDiscounts[line.key] ?? 0, line.lineSubtotal);
          const discountedSubtotal = money(line.lineSubtotal - lineDiscount);
          const vatAmount = money(discountedSubtotal * (line.vatRate / 100));
          subtotal += line.lineSubtotal;
          vatTotal += vatAmount;
          return {
            productId: line.productId,
            variantId: line.variantId,
            sellerId: line.sellerId,
            sku: line.sku,
            nameEn: line.nameEn,
            nameAr: line.nameAr,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            vatRate: line.vatRate,
            vatAmount,
            total: money(discountedSubtotal + vatAmount),
          };
        });
        subtotal = money(subtotal);
        const discountAmount = money(promotion.discountAmount);
        // Goods VAT only. Freight is not priced yet, and it is taxable too —
        // the order's final vatAmount is assembled once both parts are known.
        const goodsVatAmount = money(vatTotal);
        const merchandiseTotal = money(subtotal - discountAmount + goodsVatAmount);

        // The snapshot approved GOODS, so it is compared against the goods
        // total. Freight is added after this check and never to a governed
        // purchase order: an approved commercial figure that silently grows by
        // a delivery charge is no longer the figure anybody approved.
        if (input.governedCommercial && Math.round(merchandiseTotal * 100) !== Math.round(input.governedCommercial.total * 100)) {
          throw new Error("Governed purchase-order total does not match the approved commercial snapshot");
        }

        /*
          Delivery, priced server-side by zone and weight.

          Skipped entirely for a governed purchase order (see above). For every
          other order the quote is authoritative — a shipping figure the client
          can influence is a discount the client can grant itself.

          The distinction that matters here is between "this platform has not
          configured delivery yet" and "we do not ship there". With NO zones at
          all, freight is zero and the order proceeds, which is exactly how
          checkout behaved before this existed. With zones configured but none
          covering the destination, the order is REFUSED — that is a real answer
          about a real destination, and shipping a parcel nobody priced is a
          loss the buyer never agreed to.
        */
        let shippingAmount = 0;
        if (!input.governedCommercial) {
          const destination = typeof input.shippingAddress?.["country"] === "string"
            ? String(input.shippingAddress["country"])
            : "";
          const configuredZones = await tx.shippingZone.count({ where: { isActive: true } });
          if (configuredZones > 0 && destination) {
            const quote = await quoteShipping({
              country: destination,
              currency: input.currency,
              subtotal,
              lines: pricedLines.map((line) => {
                const product = productMap.get(line.productId)!;
                return {
                  quantity: line.quantity,
                  weightKg: product.weight == null ? null : Number(product.weight),
                };
              }),
            }, tx);
            shippingAmount = money(quote.price);
          }
        }

        /*
          VAT ON DELIVERY.

          The total used to be `merchandiseTotal + shippingAmount`, which added
          freight AFTER tax and so never taxed it. Delivery this platform prices
          and charges is part of the consideration for the supply, not a
          separate untaxed fee, so it carries the destination's VAT at the same
          statutory rate the goods on the order do — 5% in AE, 15% in SA, 0% in
          the zero-rated jurisdictions, which falls out of the rate table
          without a special case.

          The old arithmetic was a SILENT wrong answer: every figure on the
          order looked consistent, the buyer was charged less than the invoice
          legally owes, and the understated vatAmount is persisted and read
          downstream by invoicing and settlement. It scales with the freight
          bill, so the heaviest orders were the most wrong.

          A governed purchase order never reaches this with a non-zero freight
          figure (shipping is skipped entirely above), so its approved total is
          unaffected and the snapshot comparison above still governs it.

          `jurisdiction.rate` is used rather than any per-line rate on purpose:
          the delivery is a supply by the PLATFORM to the buyer, so it follows
          the order's place of supply, not whatever rate a seller configured on
          a product.
        */
        const totals = composeOrderTotals({
          subtotal,
          discountAmount,
          goodsVatAmount,
          shippingAmount,
          vatRatePercent: jurisdiction.rate,
        });
        const { vatAmount, total } = totals;

        const initialStockRows = await Promise.all(input.items.map((item) => tx.inventoryStock.findMany({
          where: inventoryStockIdentityWhere(item.productId, item.variantId),
          select: { id: true },
        })));
        await lockInventoryStockRows(tx, initialStockRows.flat().map((stock) => stock.id));

        for (const item of input.items) {
          // Re-read only after holding every involved row lock. CSV on-hand
          // changes and other checkouts therefore linearize before this read.
          const stockRows = await tx.inventoryStock.findMany({
            where: inventoryStockIdentityWhere(item.productId, item.variantId),
            orderBy: { updatedAt: "asc" },
          });
          const available = stockRows.reduce((sum, s) => sum + (s.qty - s.reservedQty), 0);
          if (available < item.quantity) {
            const product = productMap.get(item.productId);
            throw new Error(`Insufficient stock for "${product?.nameEn ?? item.productId}" (${available} available, ${item.quantity} requested)`);
          }

          let remaining = item.quantity;
          for (const s of stockRows) {
            if (remaining <= 0) break;
            const want = Math.min(remaining, s.qty - s.reservedQty);
            if (want <= 0) continue;
            const { count } = await tx.inventoryStock.updateMany({
              where: { id: s.id, qty: s.qty, reservedQty: s.reservedQty },
              data: { reservedQty: { increment: want } },
            });
            if (count === 1) remaining -= want;
          }
          if (remaining > 0) {
            const product = productMap.get(item.productId);
            throw new Error(`Insufficient stock for "${product?.nameEn ?? item.productId}" (reserved by a concurrent order)`);
          }
        }

        // Recheck promotion/coupon caps immediately before redemption evidence is
        // written. The calculation itself already validated eligibility; this
        // catches most stale usage-limit races without trusting browser state.
        if (promotion.applied.length > 0) {
          await enforcePromotionRedemptionCapacity(tx, {
            userId: input.userId,
            currency: input.currency,
            companyId: input.companyId,
            country: input.shippingAddress["country"],
            lines: pricedLines.map((line) => ({
              key: line.key,
              productId: line.productId,
              categoryId: line.categoryId,
              brandId: line.brandId,
              sellerId: line.sellerId,
              quantity: line.quantity,
              baseUnitPrice: line.unitPrice,
            })),
            applied: promotion.applied,
          });
        }
        for (const applied of promotion.applied) {
          const rule = await tx.commercePromotion.findUnique({ where: { id: applied.promotionId } });
          if (!rule || rule.status !== "ACTIVE") throw new Error("Promotion changed while the order was being submitted");
          if (rule.usageLimit) {
            const usage = await tx.promotionRedemption.count({ where: { promotionId: rule.id } });
            if (usage >= rule.usageLimit) throw new Error("Promotion usage limit has been reached");
          }
          if (rule.perCustomerLimit) {
            const usage = await tx.promotionRedemption.count({ where: { promotionId: rule.id, userId: input.userId } });
            if (usage >= rule.perCustomerLimit) throw new Error("Promotion usage limit has been reached for this account");
          }
          if (applied.couponId) {
            const coupon = await tx.promotionCoupon.findUnique({ where: { id: applied.couponId } });
            if (!coupon || coupon.status !== "ACTIVE") throw new Error("Coupon changed while the order was being submitted");
            if (coupon.usageLimit) {
              const usage = await tx.promotionRedemption.count({ where: { couponId: coupon.id } });
              if (usage >= coupon.usageLimit) throw new Error("Coupon usage limit has been reached");
            }
            if (coupon.perCustomerLimit) {
              const usage = await tx.promotionRedemption.count({ where: { couponId: coupon.id, userId: input.userId } });
              if (usage >= coupon.perCustomerLimit) throw new Error("Coupon usage limit has been reached for this account");
            }
          }
        }

        const order = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            userId: input.userId,
            companyId: input.companyId,
            purchaseOrderId: input.purchaseOrderId,
            type: input.type,
            currency: input.currency,
            subtotal,
            discountAmount,
            vatAmount,
            shippingAmount,
            total,
            paymentMethod: input.paymentMethod,
            shippingAddress: input.shippingAddress,
            notes: input.notes,
            idempotencyKey: input.idempotencyKey,
            requestFingerprint: input.requestFingerprint,
            items: { create: itemData },
            statusHistory: {
              create: {
                status: "PENDING_PAYMENT",
                message: erpConnection
                  ? "Order created; payment and ERP validation are pending"
                  : "Order created, awaiting payment",
              },
            },
          },
          include: { items: true, statusHistory: true },
        });

        // Commercial price provenance. These snapshots make support/finance able
        // to reconstruct why the buyer saw a price even after price lists change.
        await tx.commercialPriceSnapshot.createMany({
          data: pricedLines.map((line) => ({
            tenantKey: "default",
            productId: line.productId,
            variantId: line.variantId,
            companyId: input.companyId,
            source: "LOCAL_CATALOG",
            sourceSystem: "AVENICK",
            sourceReference: line.sourcePriceId,
            currency: input.currency,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            explanation: {
              channel: input.type,
              priceId: line.sourcePriceId,
              quantity: line.quantity,
              promotions: promotion.applied,
            },
          })),
        });

        const createdByIdentity = new Map<string, typeof order.items>();
        for (const created of order.items) {
          const key = identityKey(created);
          const group = createdByIdentity.get(key) ?? [];
          group.push(created);
          createdByIdentity.set(key, group);
        }

        for (const line of pricedLines) {
          const key = identityKey(line);
          const created = createdByIdentity.get(key)?.shift();
          if (!created) throw new Error("Unable to correlate created order line for price trace");
          const lineDiscount = money(promotion.lineDiscounts[line.key] ?? 0);
          const finalUnitPrice = Number(((line.lineSubtotal - lineDiscount) / line.quantity).toFixed(4));
          await tx.orderLinePriceTrace.create({
            data: {
              orderItemId: created.id,
              currency: input.currency,
              contractPrice: line.unitPrice,
              promotionDiscount: lineDiscount,
              finalUnitPrice,
                sourceSystem: "AVENICK",
                explanation: {
                baseUnitPrice: line.unitPrice,
                lineSubtotal: line.lineSubtotal,
                discount: lineDiscount,
                  finalUnitPrice,
                  priceScope: line.priceScope,
                  variantId: line.variantId ?? null,
                applied: promotion.applied,
              },
            },
          });
        }

        for (const applied of promotion.applied) {
          await tx.promotionRedemption.create({
            data: {
              promotionId: applied.promotionId,
              couponId: applied.couponId,
              userId: input.userId,
              companyId: input.companyId,
              orderId: order.id,
              discountAmount: applied.discount,
              currency: input.currency,
            },
          });
        }

        if (erpConnection) {
          await tx.orderIntegrationState.create({
            data: {
              tenantKey: "default",
              orderId: order.id,
              system: erpConnection.system,
              state: "PENDING_VALIDATION",
            },
          });
          await tx.integrationOutbox.create({
            data: {
              tenantKey: "default",
              aggregateType: "ORDER",
              aggregateId: order.id,
              eventType: "ORDER_SUBMIT_REQUESTED",
              destination: erpConnection.system,
              connectionId: erpConnection.id,
              idempotencyKey: `order:${order.id}:${erpConnection.system}:submit`,
              payload: {
                orderId: order.id,
                orderNumber: order.orderNumber,
                companyId: input.companyId,
                currency: input.currency,
                subtotal,
                discountAmount,
                vatAmount,
                total,
                items: itemData.map((item) => ({
                  productId: item.productId,
                  variantId: item.variantId,
                  sku: item.sku,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  vatRate: item.vatRate,
                  total: item.total,
                })),
              },
            },
          });
        }

        return order;
      }).catch(async (e: unknown) => {
        if (
          input.idempotencyKey &&
          typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002"
        ) {
          const existing = await db.order.findUnique({
            where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } },
            include: { items: true, statusHistory: true },
          });
          if (existing) {
            if (!input.requestFingerprint) throw new Error("An idempotency request fingerprint is required");
            assertMatchingIdempotencyFingerprint(existing.requestFingerprint, input.requestFingerprint);
            return existing;
          }
        }
        throw e;
      }),
    { name: "orders.create", config: { maxAttempts: 1 } },
  );
}

// Statuses in which an order's units have been reserved but not yet consumed.
const RESERVED_STATUSES: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAYMENT_CONFIRMED",
  "CONFIRMED",
  "PROCESSING",
];
const CONSUME_STATUSES: OrderStatus[] = ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
const RELEASE_STATUSES: OrderStatus[] = ["CANCELLED", "REFUNDED", "RETURNED"];

/**
 * Transition an order's status and settle its inventory side-effects atomically.
 */
// updateOrderStatus was removed here.
//
// It had zero callers and was unsafe by construction: no advisory lock,
// unlike every other stock writer in this file; a plain decrement rather
// than the compare-and-set the reservation path uses; and no legal-
// transition table, so it accepted any status from any status.
//
// Dead code with unsafe semantics is worse than no code — the next person
// to need an order transition would have reached for it and quietly
// bypassed the locking discipline. The governed path is
// advanceSellerFulfillment in seller-fulfillment.ts.

export async function getOrdersForSeller(sellerId: string, params: { page?: number; limit?: number; status?: OrderStatus }) {
  const { page = 1, limit = 20, status } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.OrderWhereInput = {
    items: { some: { sellerId } },
    ...(status && { status }),
  };

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        items: { where: { sellerId }, include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } } },
        user: { select: { firstName: true, lastName: true, email: true } },
        company: { select: { nameEn: true, nameAr: true } },
        statusHistory: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    db.order.count({ where }),
  ]);

  return { orders, total, page, limit, totalPages: Math.ceil(total / limit) };
}
