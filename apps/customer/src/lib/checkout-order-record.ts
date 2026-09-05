/**
 * THE ORDER AS THE SERVER RECORDED IT, AND WHAT TRUTHFULLY HAPPENS NEXT.
 *
 * Two things the confirmation and the order history must get right:
 *
 *  1. THE MONEY. composeOrderTotals (packages/database) builds an order as
 *     goods − discount + VAT on goods + delivery + VAT on delivery, and the
 *     order row persists subtotal, discountAmount, shippingAmount, vatAmount
 *     and total. It does NOT persist the goods/delivery split of the VAT — but
 *     each OrderItem row persists its own vatAmount, and createOrder's
 *     goodsVatAmount is, by construction, the sum of exactly those rows. So
 *     the split is recoverable from persisted figures alone: VAT on goods is
 *     the line rows added up, VAT on delivery is what remains of the persisted
 *     VAT. No rate is applied in the browser; nothing is priced here.
 *
 *  2. THE STATUS. The Prisma OrderStatus enum is the only authority on what an
 *     order can be, and the confirmation may only describe the step the
 *     platform actually takes next — never a delivery date it cannot compute.
 *
 * Pure, so both can be checked without a database, and safe to import from a
 * client component: the Prisma enums are imported as TYPES only and erased.
 */

import type { OrderStatus, PaymentMethod } from "@avenick/database";

type Exact<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type AssertTrue<T extends true> = T;

export const ORDER_STATUS_VALUES = [
  "PENDING_PAYMENT",
  "PAYMENT_CONFIRMED",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
  "RETURN_REQUESTED",
  "RETURNED",
] as const;
export type OrderStatusValue = (typeof ORDER_STATUS_VALUES)[number];

export const PAYMENT_METHOD_VALUES = ["MADA", "APPLE_PAY", "CREDIT_CARD", "BANK_TRANSFER", "STC_PAY", "MOCK"] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHOD_VALUES)[number];

/** Methods a buyer can be told about. MOCK is a pilot simulation, not an offer. */
export const BUYER_PAYMENT_METHODS = PAYMENT_METHOD_VALUES.filter((method) => method !== "MOCK");

/** Compile-time proof the lists above are exactly the Prisma enums. */
export type EnumListsMatchPrisma = [
  AssertTrue<Exact<OrderStatusValue, OrderStatus>>,
  AssertTrue<Exact<PaymentMethodValue, PaymentMethod>>,
];

/** The forward path an order walks, in the order the enum declares it. */
export const ORDER_FLOW = [
  "PENDING_PAYMENT",
  "PAYMENT_CONFIRMED",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;
export type FlowStatus = (typeof ORDER_FLOW)[number];

export function isOrderStatus(value: unknown): value is OrderStatusValue {
  return typeof value === "string" && (ORDER_STATUS_VALUES as readonly string[]).includes(value);
}

/** Index on the forward path, or -1 for a status that has left it. */
export function flowPosition(status: string): number {
  return (ORDER_FLOW as readonly string[]).indexOf(status);
}

export type NextStepKey =
  | "AWAIT_BANK_TRANSFER"
  | "AWAIT_PAYMENT"
  | "PAYMENT_CONFIRMED"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED"
  | "RETURN_REQUESTED"
  | "RETURNED";

/**
 * What the platform does next, for a status and a payment method.
 *
 * Bank transfer is the one case that depends on the method: finalizeInternal-
 * OrderPayment records an UNPAID payment and leaves the order at
 * PENDING_PAYMENT until finance verifies the funds. A pilot MOCK payment marks
 * the order PAID and moves it straight to CONFIRMED, so it never shows this
 * branch. No step here carries a time.
 */
export function whatHappensNext(status: string, paymentMethod: string | null | undefined): NextStepKey {
  switch (status) {
    case "PENDING_PAYMENT":
      return paymentMethod === "BANK_TRANSFER" ? "AWAIT_BANK_TRANSFER" : "AWAIT_PAYMENT";
    case "PAYMENT_CONFIRMED":
      return "PAYMENT_CONFIRMED";
    case "CONFIRMED":
      return "CONFIRMED";
    case "PROCESSING":
      return "PROCESSING";
    case "SHIPPED":
      return "SHIPPED";
    case "OUT_FOR_DELIVERY":
      return "OUT_FOR_DELIVERY";
    case "DELIVERED":
      return "DELIVERED";
    case "CANCELLED":
      return "CANCELLED";
    case "REFUNDED":
      return "REFUNDED";
    case "RETURN_REQUESTED":
      return "RETURN_REQUESTED";
    case "RETURNED":
      return "RETURNED";
    default:
      return "AWAIT_PAYMENT";
  }
}

// ─── The persisted record ───────────────────────────────────────────────────

export interface PersistedOrderLine {
  sku: string;
  nameEn: string;
  nameAr: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  vatAmount: number;
  total: number;
}

export interface PersistedAddress {
  label?: string;
  line1?: string;
  city?: string;
  country?: string;
}

export interface PersistedOrder {
  id: string;
  orderNumber: string;
  status: OrderStatusValue;
  paymentMethod: string | null;
  currency: string;
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  shippingAmount: number;
  total: number;
  shippingAddress: PersistedAddress | null;
  items: PersistedOrderLine[];
}

const num = (value: unknown): number | null => {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(n) ? n : null;
};

/**
 * GET /api/orders/[id] returns the Prisma row with Decimals serialised as
 * strings. Anything short of a complete money record is rejected as a whole:
 * a confirmation printing three real figures and one missing is worse than one
 * that says the record is on its way.
 */
export function parsePersistedOrder(json: unknown): PersistedOrder | null {
  if (typeof json !== "object" || json === null) return null;
  const o = json as Record<string, unknown>;
  const subtotal = num(o.subtotal);
  const discountAmount = num(o.discountAmount);
  const vatAmount = num(o.vatAmount);
  const shippingAmount = num(o.shippingAmount);
  const total = num(o.total);
  if (
    typeof o.id !== "string" || typeof o.orderNumber !== "string" || typeof o.currency !== "string"
    || !isOrderStatus(o.status)
    || subtotal == null || discountAmount == null || vatAmount == null || shippingAmount == null || total == null
  ) {
    return null;
  }
  const rawItems = Array.isArray(o.items) ? (o.items as Array<Record<string, unknown>>) : [];
  const items: PersistedOrderLine[] = [];
  for (const item of rawItems) {
    const quantity = num(item.quantity);
    const unitPrice = num(item.unitPrice);
    const vatRate = num(item.vatRate);
    const lineVat = num(item.vatAmount);
    const lineTotal = num(item.total);
    if (quantity == null || unitPrice == null || vatRate == null || lineVat == null || lineTotal == null) return null;
    items.push({
      sku: typeof item.sku === "string" ? item.sku : "",
      nameEn: typeof item.nameEn === "string" ? item.nameEn : "",
      nameAr: typeof item.nameAr === "string" ? item.nameAr : "",
      quantity,
      unitPrice,
      vatRate,
      vatAmount: lineVat,
      total: lineTotal,
    });
  }
  const address = typeof o.shippingAddress === "object" && o.shippingAddress !== null
    ? (o.shippingAddress as Record<string, unknown>)
    : null;
  const str = (value: unknown) => (typeof value === "string" ? value : undefined);
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    paymentMethod: typeof o.paymentMethod === "string" ? o.paymentMethod : null,
    currency: o.currency,
    subtotal,
    discountAmount,
    vatAmount,
    shippingAmount,
    total,
    shippingAddress: address
      ? { label: str(address.label), line1: str(address.line1), city: str(address.city), country: str(address.country) }
      : null,
    items,
  };
}

export interface ReconciledTotals {
  /** Persisted, verbatim. */
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  vatAmount: number;
  total: number;
  /** The persisted line VAT rows added up — createOrder's goodsVatAmount by construction. Null when the split cannot be stated. */
  goodsVatAmount: number | null;
  /** The persisted order VAT less the line rows — createOrder's shippingVatAmount by construction. Null with goodsVatAmount. */
  shippingVatAmount: number | null;
  /** subtotal − discount + VAT + delivery equals the persisted total, to the cent. */
  reconciles: boolean;
}

const cents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => value / 100;

/**
 * Read the persisted figures back as the six lines an invoice prints.
 *
 * Integer cents throughout, so that subtracting two two-decimal figures
 * cannot produce 0.30000000000000004 — this is comparison and separation of
 * amounts the server already fixed, not arithmetic that produces new ones.
 * The split is withheld whenever it would not hold: no line rows, a remainder
 * below zero, or delivery VAT on an order that carried no delivery charge.
 */
export function reconcilePersistedTotals(order: Pick<PersistedOrder, "subtotal" | "discountAmount" | "vatAmount" | "shippingAmount" | "total" | "items">): ReconciledTotals {
  const subtotalC = cents(order.subtotal);
  const discountC = cents(order.discountAmount);
  const vatC = cents(order.vatAmount);
  const shippingC = cents(order.shippingAmount);
  const totalC = cents(order.total);
  const reconciles = subtotalC - discountC + vatC + shippingC === totalC;

  let goodsVatAmount: number | null = null;
  let shippingVatAmount: number | null = null;
  if (order.items.length > 0) {
    const goodsC = order.items.reduce((sum, item) => sum + cents(item.vatAmount), 0);
    const deliveryC = vatC - goodsC;
    const splitHolds = deliveryC >= 0 && (shippingC > 0 || deliveryC === 0);
    if (splitHolds) {
      goodsVatAmount = fromCents(goodsC);
      shippingVatAmount = fromCents(deliveryC);
    }
  }

  return {
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    shippingAmount: order.shippingAmount,
    vatAmount: order.vatAmount,
    total: order.total,
    goodsVatAmount,
    shippingVatAmount,
    reconciles,
  };
}
