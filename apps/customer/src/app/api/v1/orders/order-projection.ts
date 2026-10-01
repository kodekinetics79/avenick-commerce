import type { z } from "zod";

import type {
  OrderCardSchema,
  OrderDetailSchema,
  PersistedOrderTotalsSchema,
  ShippingAddressInputSchema,
} from "@avenick/contracts";
import { COUNTRY_VALUES } from "@avenick/contracts";
import type { Prisma } from "@avenick/database";

import { absoluteUrl, slugOrNull, toImage, toMoney, toTimestamp, toVatRatePercent } from "../_lib/dto";

type OrderCard = z.infer<typeof OrderCardSchema>;
type OrderDetail = z.infer<typeof OrderDetailSchema>;
type PersistedOrderTotals = z.infer<typeof PersistedOrderTotalsSchema>;
type ShippingAddressInput = z.infer<typeof ShippingAddressInputSchema>;

/**
 * The stored order, as the contract's two DTOs.
 *
 * `/api/orders` returns every column of every order with all of its items and a
 * status-history row, unpaginated, for the whole account — the Prisma rows,
 * verbatim, Decimals serialised as strings. A list row draws a number, a date,
 * a state and a price; the fat one is a request away.
 */

/**
 * THE VAT SPLIT — the one place the contract cannot promise what
 * `composeOrderTotals` computes, and it is read from the columns rather than
 * reconstructed.
 *
 * `Order` now HAS `goodsVatAmount` and `shippingVatAmount`
 * (`20260905150000_order_vat_component_split`), both nullable and neither
 * backfilled. Nothing writes them yet: `services/orders.ts` still does
 * `const { vatAmount, total } = totals;` and drops the two components on the
 * floor. So they read NULL for every order in the database today, and NULL is
 * the honest answer — "this order predates the split being recorded".
 *
 * Deriving them would be worse than the gap. `goodsVatAmount = vatAmount` (or
 * `shippingVatAmount = 0`) is indistinguishable from a measured figure to
 * everyone who reads it afterwards, and it is wrong by exactly the freight's
 * VAT — which is the defect PR #21 fixed in the checkout path. The contract
 * enforces the pair is present or absent together, so a half-answer cannot
 * escape either.
 */
function toTotals(order: {
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  shippingAmount: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  goodsVatAmount: Prisma.Decimal | null;
  shippingVatAmount: Prisma.Decimal | null;
  total: Prisma.Decimal;
}): PersistedOrderTotals {
  return {
    subtotal: toMoney(order.subtotal),
    discountAmount: toMoney(order.discountAmount),
    shippingAmount: toMoney(order.shippingAmount),
    vatAmount: toMoney(order.vatAmount),
    goodsVatAmount: order.goodsVatAmount == null ? null : toMoney(order.goodsVatAmount),
    shippingVatAmount: order.shippingVatAmount == null ? null : toMoney(order.shippingVatAmount),
    total: toMoney(order.total),
  };
}

const COUNTRIES = new Set<string>(COUNTRY_VALUES);

/**
 * `Order.shippingAddress` is an unconstrained `Json` column, and the contract's
 * address is `.strict()`. Projecting exactly the six described keys is what
 * stops an extra key some future writer adds from failing every historical
 * order's detail with a 500 — the payload is the address, not whatever else
 * happens to be in the column.
 *
 * Nothing is invented for a missing key. A stored address without a usable
 * `label`, `line1`, `city` or `country` fails response validation, loudly, with
 * the request id: an order whose destination cannot be stated is not an order
 * to render a confident screen for.
 */
function toShippingAddress(value: Prisma.JsonValue): ShippingAddressInput {
  const stored = (typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : {}) as Record<string, unknown>;
  const text = (key: string): string | undefined => {
    const raw = stored[key];
    return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined;
  };
  const country = text("country")?.toUpperCase();

  return {
    label: text("label") ?? "",
    line1: text("line1") ?? "",
    ...(text("line2") !== undefined && { line2: text("line2")! }),
    city: text("city") ?? "",
    country: (COUNTRIES.has(country ?? "") ? country : "") as ShippingAddressInput["country"],
    ...(text("postalCode") !== undefined && { postalCode: text("postalCode")! }),
  };
}

/** How many of an order's items are read to find one thumbnail for the row. */
export const THUMBNAIL_ITEM_SCAN = 10;

export interface OrderCardRow {
  id: string;
  orderNumber: string;
  status: OrderCard["status"];
  paymentStatus: OrderCard["paymentStatus"];
  type: OrderCard["type"];
  currency: OrderCard["currency"];
  total: Prisma.Decimal;
  createdAt: Date;
  _count: { items: number };
  items: Array<{ product: { images: Array<{ url: string; altEn: string | null }> } | null }>;
}

export function toOrderCard(order: OrderCardRow, origin: string): OrderCard {
  // The first item carrying an image wins. Only the first few items are read —
  // an order may hold five hundred lines and this is a 48-pixel thumbnail, so
  // loading every line's product to decorate a list row is not a trade worth
  // making. An order whose images all sit past that window shows none.
  const thumbnail = order.items
    .flatMap((item) => item.product?.images ?? [])
    .map((image) => toImage({ url: image.url, alt: image.altEn }, origin))
    .find((image) => image !== null) ?? null;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    type: order.type,
    currency: order.currency,
    total: toMoney(order.total),
    itemCount: order._count.items,
    thumbnail,
    placedAt: toTimestamp(order.createdAt),
  };
}

export interface OrderDetailRow extends Omit<OrderCardRow, "_count" | "items"> {
  paymentMethod: OrderDetail["paymentMethod"];
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  shippingAmount: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  goodsVatAmount: Prisma.Decimal | null;
  shippingVatAmount: Prisma.Decimal | null;
  shippingAddress: Prisma.JsonValue;
  notes: string | null;
  vatInvoiceUrl: string | null;
  updatedAt: Date;
  items: Array<{
    id: string;
    productId: string;
    variantId: string | null;
    sellerId: string;
    sku: string;
    nameEn: string;
    nameAr: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
    vatRate: Prisma.Decimal;
    vatAmount: Prisma.Decimal;
    total: Prisma.Decimal;
    status: OrderDetail["status"];
    product: { slug: string; images: Array<{ url: string; altEn: string | null }> } | null;
  }>;
  shipments: Array<{
    id: string;
    status: OrderDetail["shipments"][number]["status"];
    carrier: string | null;
    trackingNumber: string | null;
    promisedBy: Date | null;
  }>;
  statusHistory: Array<{ status: OrderDetail["status"]; message: string | null; createdAt: Date }>;
}

export function toOrderDetail(order: OrderDetailRow, origin: string): OrderDetail {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    type: order.type,
    currency: order.currency,
    totals: toTotals(order),
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      sellerId: item.sellerId,
      // The line's own name, SKU and price are the SNAPSHOT the order recorded,
      // not today's catalogue values: an order is what was bought, and a
      // relisted product must not rewrite it. Only the slug and the image —
      // navigation and decoration — are read live.
      slug: slugOrNull(item.product?.slug),
      sku: item.sku,
      nameEn: item.nameEn,
      nameAr: item.nameAr,
      image: item.product?.images[0]
        ? toImage({ url: item.product.images[0].url, alt: item.product.images[0].altEn }, origin)
        : null,
      quantity: item.quantity,
      unitPrice: toMoney(item.unitPrice),
      vatRatePercent: toVatRatePercent(item.vatRate),
      vatAmount: toMoney(item.vatAmount),
      total: toMoney(item.total),
      status: item.status,
    })),
    shippingAddress: toShippingAddress(order.shippingAddress),
    shipments: order.shipments.map((shipment) => ({
      id: shipment.id,
      status: shipment.status,
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      /**
       * `Shipment` has no `trackingUrl` column, so this is ALWAYS null. The app
       * cannot build one either: a tracking URL is carrier-specific and there
       * is no carrier→URL template anywhere in this repository. Flagged in the
       * report — the fix is a `Carrier` table (or a static template map) plus a
       * column, not a guess assembled from the carrier's name.
       */
      trackingUrl: null,
      /**
       * `promisedBy` is the only delivery date the row carries. `shippedAt` and
       * `deliveredAt` are facts about what happened; the contract asks for the
       * estimate, which is what `promisedBy` is.
       */
      estimatedDelivery: shipment.promisedBy ? toTimestamp(shipment.promisedBy) : null,
    })),
    statusHistory: order.statusHistory.map((event) => ({
      status: event.status,
      // `messageAr` is dropped: the contract carries one message, and the
      // platform is English-only until the localisation system exists.
      message: event.message,
      occurredAt: toTimestamp(event.createdAt),
    })),
    notes: order.notes,
    vatInvoiceUrl: absoluteUrl(order.vatInvoiceUrl, origin),
    placedAt: toTimestamp(order.createdAt),
    updatedAt: toTimestamp(order.updatedAt),
  };
}
