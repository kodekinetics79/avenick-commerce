import { z } from "zod";

/**
 * The Prisma enums the /api/v1 mobile surface exposes, mirrored as plain
 * string tuples.
 *
 * `packages/database/prisma/schema.prisma` is the single authority for every
 * list below: it is the storage constraint, so a value this package accepts
 * and the column rejects is a 500 at write time, and a value the column has
 * that this package omits is a state the Flutter app can never render.
 *
 * Unlike `@avenick/types/schemas`, this file does not even `import type` from
 * `@avenick/database`. This package is generated from by a Dart codegen step
 * and is meant to be importable from anywhere — a server route, a client
 * bundle, a plain Node script with no Prisma engine on disk — so it carries no
 * edge to the database package at all, not even one that erases at build time.
 *
 * Drift is caught instead by `src/__tests__/enums-match-prisma.test.ts`, which
 * reads schema.prisma at test time and compares the enum bodies member for
 * member. That is a stronger check than the type-level one it replaces: it
 * fails on ORDER changes and on values added to Prisma that nothing here
 * references yet, and it needs no generated client to run.
 */

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

export const PAYMENT_METHOD_VALUES = [
  "MADA",
  "APPLE_PAY",
  "CREDIT_CARD",
  "BANK_TRANSFER",
  "STC_PAY",
  "MOCK",
] as const;

export const PAYMENT_STATUS_VALUES = ["UNPAID", "PAID", "PARTIALLY_PAID", "REFUNDED", "FAILED"] as const;

export const CURRENCY_VALUES = ["AED", "SAR", "QAR", "KWD", "OMR", "BHD", "USD"] as const;

export const COUNTRY_VALUES = ["AE", "SA", "QA", "KW", "OM", "BH"] as const;

export const LANGUAGE_VALUES = ["AR", "EN"] as const;

export const PRODUCT_STATUS_VALUES = [
  "DRAFT",
  "PENDING_REVIEW",
  "ACTIVE",
  "SUPPRESSED",
  "SUSPENDED",
  "REJECTED",
  "INACTIVE",
] as const;

export const RFQ_STATUS_VALUES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "QUOTED",
  "NEGOTIATING",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
] as const;

export const PO_STATUS_VALUES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "PLACING",
  "REJECTED",
  "CANCELLED",
  "ORDERED",
] as const;

export const RETURN_STATUS_VALUES = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "IN_TRANSIT",
  "RECEIVED",
  "REFUNDED",
] as const;

export const SHIPMENT_STATUS_VALUES = [
  "PENDING",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "RETURNED",
] as const;

export const ORDER_TYPE_VALUES = ["B2C", "B2B"] as const;

export const USER_ROLE_VALUES = [
  "CONSUMER",
  "COMPANY_ADMIN",
  "COMPANY_BUYER",
  "COMPANY_APPROVER",
  "SELLER_OWNER",
  "SELLER_STAFF",
  "ADMIN",
  "SUPER_ADMIN",
] as const;

export const USER_STATUS_VALUES = ["PENDING", "ACTIVE", "SUSPENDED", "BANNED"] as const;

/**
 * The Prisma enum each tuple above mirrors. The drift test reads this map, so
 * a new enum added here without a schema.prisma counterpart fails loudly
 * rather than being silently unchecked.
 */
export const PRISMA_ENUM_MIRRORS = {
  OrderStatus: ORDER_STATUS_VALUES,
  PaymentMethod: PAYMENT_METHOD_VALUES,
  PaymentStatus: PAYMENT_STATUS_VALUES,
  Currency: CURRENCY_VALUES,
  Country: COUNTRY_VALUES,
  Language: LANGUAGE_VALUES,
  ProductStatus: PRODUCT_STATUS_VALUES,
  RFQStatus: RFQ_STATUS_VALUES,
  POStatus: PO_STATUS_VALUES,
  ReturnStatus: RETURN_STATUS_VALUES,
  ShipmentStatus: SHIPMENT_STATUS_VALUES,
  OrderType: ORDER_TYPE_VALUES,
  UserRole: USER_ROLE_VALUES,
  UserStatus: USER_STATUS_VALUES,
} as const satisfies Record<string, readonly [string, ...string[]]>;

export const OrderStatusSchema = z.enum(ORDER_STATUS_VALUES);
export const PaymentMethodSchema = z.enum(PAYMENT_METHOD_VALUES);
export const PaymentStatusSchema = z.enum(PAYMENT_STATUS_VALUES);
export const CurrencySchema = z.enum(CURRENCY_VALUES);
export const CountrySchema = z.enum(COUNTRY_VALUES);
export const LanguageSchema = z.enum(LANGUAGE_VALUES);
export const ProductStatusSchema = z.enum(PRODUCT_STATUS_VALUES);
export const RfqStatusSchema = z.enum(RFQ_STATUS_VALUES);
export const PurchaseOrderStatusSchema = z.enum(PO_STATUS_VALUES);
export const ReturnStatusSchema = z.enum(RETURN_STATUS_VALUES);
export const ShipmentStatusSchema = z.enum(SHIPMENT_STATUS_VALUES);
export const OrderTypeSchema = z.enum(ORDER_TYPE_VALUES);
export const UserRoleSchema = z.enum(USER_ROLE_VALUES);
export const UserStatusSchema = z.enum(USER_STATUS_VALUES);

/**
 * The sales channel a price is resolved in. This is `PricingType` in Prisma
 * and `OrderType` on an order; the mobile surface names it once.
 */
export const ChannelSchema = z.enum(["B2C", "B2B"]);

/** Availability as the catalogue projections already report it. */
export const AvailabilitySchema = z.enum(["IN_STOCK", "OUT_OF_STOCK", "UNCONFIRMED"]);

export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export type Currency = z.infer<typeof CurrencySchema>;
export type Country = z.infer<typeof CountrySchema>;
export type Channel = z.infer<typeof ChannelSchema>;
