import type { z } from "zod";

import * as contracts from "../index";

/**
 * One valid and one invalid fixture per schema on the surface.
 *
 * The invalid fixture is never "a random wrong type" — each one is a mistake
 * a real client or a real route could plausibly make, so a passing test says
 * something. `invalidPath` names the field the failure must be attributed to,
 * because a schema that rejects for the wrong reason (a `.strict()` complaint
 * masking a missing required field) reads as passing and is not.
 */
export interface SchemaCase {
  name: string;
  schema: z.ZodTypeAny;
  valid: unknown;
  invalid: unknown;
  /** The dotted path the rejection must mention. Omit when the whole object is at fault. */
  invalidPath?: string;
}

const image = { url: "https://cdn.avenick.com/p/1.jpg", width: 800, height: 800, blurhash: "L6PZfSjE.AyE_3t7t7R**0o#DgR4" };

const cartLine = {
  id: "line_1",
  productId: "prod_1",
  variantId: null,
  sellerId: "sel_1",
  slug: "nitrile-gloves-box-100",
  sku: "SKU-1",
  nameEn: "Nitrile gloves, box of 100",
  nameAr: "قفازات نتريل، علبة 100",
  image,
  channel: "B2C" as const,
  qty: 2,
  moq: 1,
  unitPrice: 50,
  currency: "AED" as const,
  vatRatePercent: 5,
  priceTiered: false,
  availability: "IN_STOCK" as const,
  lineTotal: 100,
};

const cart = {
  id: "cart_1",
  currency: "AED" as const,
  lines: [cartLine],
  itemCount: 2,
  subtotal: 100,
  updatedAt: "2026-09-05T09:00:00Z",
};

const totals = {
  subtotal: 100,
  discountAmount: 0,
  goodsVatAmount: 5,
  shippingAmount: 20,
  shippingVatAmount: 1,
  vatAmount: 6,
  total: 126,
};

const principal = {
  id: "usr_1",
  email: "buyer@example.com",
  firstName: "Layla",
  lastName: "Hassan",
  role: "CONSUMER" as const,
  language: "EN" as const,
};

const tokenPair = {
  tokenType: "Bearer" as const,
  accessToken: "eyJhbGciOi.access",
  expiresIn: 900,
  refreshToken: "rt_01HZX",
  refreshExpiresIn: 2_592_000,
  principal,
};

const productCard = {
  id: "prod_1",
  slug: "nitrile-gloves-box-100",
  nameEn: "Nitrile gloves, box of 100",
  nameAr: "قفازات نتريل، علبة 100",
  image,
  price: { amount: 50, currency: "AED" as const, vatRatePercent: 5, isFrom: false },
  moq: 1,
  availability: "IN_STOCK" as const,
  priceTiered: false,
  rating: { average: 4.5, count: 12 },
  brandName: "Ansell",
};

const priceBand = {
  channel: "B2C" as const,
  currency: "AED" as const,
  minQty: 1,
  maxQty: null,
  price: 50,
  vatRatePercent: 5,
};

const productDetail = {
  ...productCard,
  sku: "SKU-1",
  descriptionEn: "Powder-free examination gloves.",
  descriptionAr: null,
  images: [image],
  prices: [priceBand],
  variants: [],
  availableQty: 400,
  origin: "MY",
  weightKg: 1.2,
  tags: ["ppe", "gloves"],
  channel: "B2C" as const,
  brand: { id: "brand_1", nameEn: "Ansell", nameAr: null },
  category: { id: "cat_1", slug: "safety-ppe", nameEn: "Safety & PPE", nameAr: "السلامة" },
  seller: {
    id: "sel_1",
    businessNameEn: "Gulf Safety Supplies",
    businessNameAr: null,
    tier: "VERIFIED" as const,
    city: "Dubai",
    country: "AE",
    rating: { average: 4.2, count: 88 },
  },
};
// The card's own fields are NOT part of the detail: a detail carries `images`
// and the full price bands, so `image`, `price`, `priceTiered` and `brandName`
// would be four narrower restatements of data already on it.
for (const cardOnlyField of ["image", "price", "priceTiered", "brandName"]) {
  delete (productDetail as Record<string, unknown>)[cardOnlyField];
}

const address = {
  id: "adr_1",
  label: "Warehouse",
  line1: "Plot 42, Jebel Ali Free Zone",
  line2: null,
  city: "Dubai",
  country: "AE" as const,
  postalCode: null,
  latitude: 25.0,
  longitude: 55.1,
  isDefault: true,
};

const shippingAddress = {
  label: "Warehouse",
  line1: "Plot 42, Jebel Ali Free Zone",
  city: "Dubai",
  country: "AE" as const,
};

const orderCard = {
  id: "ord_1",
  orderNumber: "AV-2026-000123",
  status: "CONFIRMED" as const,
  paymentStatus: "PAID" as const,
  type: "B2C" as const,
  currency: "AED" as const,
  total: 126,
  itemCount: 2,
  thumbnail: image,
  placedAt: "2026-09-04T08:30:00Z",
};

const orderItem = {
  id: "oi_1",
  productId: "prod_1",
  variantId: null,
  sellerId: "sel_1",
  slug: "nitrile-gloves-box-100",
  sku: "SKU-1",
  nameEn: "Nitrile gloves, box of 100",
  nameAr: "قفازات نتريل، علبة 100",
  image,
  quantity: 2,
  unitPrice: 50,
  vatRatePercent: 5,
  vatAmount: 5,
  total: 105,
  status: "CONFIRMED" as const,
};

const me = {
  id: "usr_1",
  email: "buyer@example.com",
  phone: "+971501234567",
  firstName: "Layla",
  lastName: "Hassan",
  firstNameAr: null,
  lastNameAr: null,
  avatar: null,
  role: "CONSUMER" as const,
  status: "ACTIVE" as const,
  language: "EN" as const,
  emailVerified: true,
  phoneVerified: false,
  company: null,
  createdAt: "2026-01-04T08:30:00Z",
};

const device = {
  id: "dev_1",
  deviceId: "install_01HZX",
  platform: "ios" as const,
  appVersion: "1.4.0",
  language: "EN" as const,
  registeredAt: "2026-09-01T08:30:00Z",
  lastSeenAt: "2026-09-05T08:30:00Z",
};

export const SCHEMA_CASES: SchemaCase[] = [
  // ── primitives ──────────────────────────────────────────────────────────
  {
    name: "Image",
    schema: contracts.ImageSchema,
    valid: image,
    // A bare string is exactly what the current DTOs ship, and what this
    // contract exists to stop.
    invalid: { url: "https://cdn.avenick.com/p/1.jpg" },
    invalidPath: "width",
  },
  {
    name: "Money (via CardPrice)",
    schema: contracts.CardPriceSchema,
    valid: { amount: 50.25, currency: "AED", vatRatePercent: 5, isFrom: false },
    invalid: { amount: 50.255, currency: "AED", vatRatePercent: 5, isFrom: false },
    invalidPath: "amount",
  },

  // ── auth ────────────────────────────────────────────────────────────────
  {
    name: "AuthTokenRequest",
    schema: contracts.AuthTokenRequestSchema,
    valid: { email: "buyer@example.com", password: "Str0ngPassword", deviceId: "install_01HZX" },
    invalid: { email: "buyer@example.com", password: "short", deviceId: "install_01HZX" },
    invalidPath: "password",
  },
  {
    name: "TokenPair",
    schema: contracts.TokenPairSchema,
    valid: tokenPair,
    // A refresh response that omits the rotated token pins the client to a
    // token that is about to be invalidated.
    invalid: { ...tokenPair, refreshToken: undefined },
    invalidPath: "refreshToken",
  },
  {
    name: "AuthRefreshRequest",
    schema: contracts.AuthRefreshRequestSchema,
    valid: { refreshToken: "rt_01HZX", deviceId: "install_01HZX" },
    invalid: { refreshToken: "rt_01HZX" },
    invalidPath: "deviceId",
  },
  {
    name: "AuthRevokeRequest",
    schema: contracts.AuthRevokeRequestSchema,
    valid: { refreshToken: "rt_01HZX" },
    // Neither named: ambiguous between "do nothing" and "sign me out everywhere".
    invalid: { allSessions: false },
  },
  {
    name: "Revocation",
    schema: contracts.RevocationSchema,
    valid: { revokedCount: 3 },
    invalid: { revokedCount: -1 },
    invalidPath: "revokedCount",
  },
  {
    name: "OtpRequest",
    schema: contracts.OtpRequestSchema,
    valid: { phone: "+971501234567", deviceId: "install_01HZX" },
    invalid: { phone: "0501234567", deviceId: "install_01HZX" },
    invalidPath: "phone",
  },
  {
    name: "OtpChallenge",
    schema: contracts.OtpChallengeSchema,
    valid: {
      challengeId: "chl_1",
      codeLength: 6,
      expiresAt: "2026-09-05T09:05:00Z",
      resendAfter: "2026-09-05T09:00:30Z",
    },
    invalid: { challengeId: "chl_1", codeLength: 6, expiresAt: "2026-09-05 09:05:00", resendAfter: "2026-09-05T09:00:30Z" },
    invalidPath: "expiresAt",
  },
  {
    name: "OtpVerifyRequest",
    schema: contracts.OtpVerifyRequestSchema,
    valid: { challengeId: "chl_1", code: "483920", deviceId: "install_01HZX" },
    invalid: { challengeId: "chl_1", code: "48a920", deviceId: "install_01HZX" },
    invalidPath: "code",
  },

  // ── cart ────────────────────────────────────────────────────────────────
  {
    name: "CartLine",
    schema: contracts.CartLineSchema,
    valid: cartLine,
    // priceTiered is not optional: a line that omits it cannot be stepped
    // safely, because the client cannot tell whether the price depends on qty.
    invalid: { ...cartLine, priceTiered: undefined },
    invalidPath: "priceTiered",
  },
  {
    name: "Cart",
    schema: contracts.CartSchema,
    valid: cart,
    // The cart must not state a total: VAT depends on a destination it has not
    // been told, and the delivery has its own VAT.
    invalid: { ...cart, total: 126, vatAmount: 6 },
  },
  {
    name: "AddCartItemRequest",
    schema: contracts.AddCartItemRequestSchema,
    valid: { productId: "prod_1", qty: 2 },
    // A client-supplied price is a discount the client grants itself.
    invalid: { productId: "prod_1", qty: 2, unitPrice: 1 },
  },
  {
    name: "UpdateCartItemRequest",
    schema: contracts.UpdateCartItemRequestSchema,
    valid: { qty: 5 },
    invalid: { qty: 10_000 },
    invalidPath: "qty",
  },
  {
    name: "CartMergeRequest",
    schema: contracts.CartMergeRequestSchema,
    valid: { strategy: "sum", lines: [{ productId: "prod_1", qty: 2 }] },
    // Defaulting the strategy is how a buyer ends up with twice what they meant.
    invalid: { lines: [{ productId: "prod_1", qty: 2 }] },
    invalidPath: "strategy",
  },
  {
    name: "CartMergeResult",
    schema: contracts.CartMergeResultSchema,
    valid: { cart, rejected: [{ productId: "prod_9", variantId: null, reason: "product_unavailable", acceptedQty: null }] },
    invalid: { cart, rejected: [{ productId: "prod_9", variantId: null, reason: "because", acceptedQty: null }] },
    invalidPath: "rejected.0.reason",
  },

  // ── checkout ────────────────────────────────────────────────────────────
  {
    name: "CheckoutQuoteRequest",
    schema: contracts.CheckoutQuoteRequestSchema,
    valid: {
      items: [{ productId: "prod_1", quantity: 2 }],
      shippingAddress,
      currency: "AED",
    },
    // Currency is required, never defaulted: a defaulted one prices an order
    // in a currency the buyer never chose.
    invalid: { items: [{ productId: "prod_1", quantity: 2 }], shippingAddress },
    invalidPath: "currency",
  },
  {
    name: "OrderTotals",
    schema: contracts.OrderTotalsSchema,
    valid: totals,
    invalid: { ...totals, vatAmount: 5, total: 125 },
    invalidPath: "vatAmount",
  },
  {
    name: "ShippingQuote",
    schema: contracts.ShippingQuoteSchema,
    valid: { status: "priced", zoneName: "UAE mainland", amount: 20, vatRatePercent: 5, estimatedDaysMin: 2, estimatedDaysMax: 4 },
    invalid: { status: "priced", zoneName: "UAE mainland", amount: 20, vatRatePercent: 5 },
    invalidPath: "estimatedDaysMin",
  },

  // ── catalogue ───────────────────────────────────────────────────────────
  {
    name: "ProductCard",
    schema: contracts.ProductCardSchema,
    valid: productCard,
    // The fat fields the current list DTO ships on every card are refused here.
    invalid: { ...productCard, descriptionEn: "…", descriptionAr: "…", prices: [priceBand] },
  },
  {
    name: "ProductDetail",
    schema: contracts.ProductDetailSchema,
    valid: productDetail,
    invalid: { ...productDetail, images: [{ url: "https://cdn.avenick.com/p/1.jpg" }] },
    invalidPath: "images.0.width",
  },
  {
    name: "ProductListQuery",
    schema: contracts.ProductListQuerySchema,
    valid: { limit: "24", channel: "B2B", inStock: "true", minRating: "4" },
    // An empty MOQ window returns zero rows under a filter that reads reasonable.
    invalid: { moqMin: "50", moqMax: "10" },
    invalidPath: "moqMin",
  },
  {
    name: "Category",
    schema: contracts.CategorySchema,
    valid: { id: "cat_1", slug: "safety-ppe", nameEn: "Safety & PPE", nameAr: "السلامة", parentId: null, depth: 0, image: null, productCount: 42 },
    invalid: { id: "cat_1", slug: "Safety PPE", nameEn: "Safety & PPE", nameAr: "السلامة", parentId: null, depth: 0, image: null, productCount: 42 },
    invalidPath: "slug",
  },
  {
    name: "Brand",
    schema: contracts.BrandSchema,
    valid: { id: "brand_1", slug: "ansell", nameEn: "Ansell", nameAr: null, logo: null, productCount: 7 },
    invalid: { id: "brand_1", slug: "ansell", nameEn: "Ansell", nameAr: null, logo: "https://cdn.avenick.com/b/1.png", productCount: 7 },
    invalidPath: "logo",
  },

  // ── orders ──────────────────────────────────────────────────────────────
  {
    name: "OrderCard",
    schema: contracts.OrderCardSchema,
    valid: orderCard,
    // The current /api/orders returns every column plus every item on every row.
    invalid: { ...orderCard, items: [orderItem] },
  },
  {
    name: "OrderDetail",
    schema: contracts.OrderDetailSchema,
    valid: {
      id: "ord_1",
      orderNumber: "AV-2026-000123",
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paymentMethod: "BANK_TRANSFER",
      type: "B2C",
      currency: "AED",
      totals: { subtotal: 100, discountAmount: 0, shippingAmount: 20, vatAmount: 6, goodsVatAmount: 5, shippingVatAmount: 1, total: 126 },
      items: [orderItem],
      shippingAddress,
      shipments: [],
      statusHistory: [{ status: "PENDING_PAYMENT", message: "Order created, awaiting payment", occurredAt: "2026-09-04T08:30:00Z" }],
      notes: null,
      vatInvoiceUrl: null,
      placedAt: "2026-09-04T08:30:00Z",
      updatedAt: "2026-09-04T09:30:00Z",
    },
    invalid: {
      id: "ord_1",
      orderNumber: "AV-2026-000123",
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paymentMethod: "BANK_TRANSFER",
      type: "B2C",
      currency: "AED",
      totals: { subtotal: 100, discountAmount: 0, shippingAmount: 20, vatAmount: 6, goodsVatAmount: 5, shippingVatAmount: 5, total: 126 },
      items: [orderItem],
      shippingAddress,
      shipments: [],
      statusHistory: [],
      notes: null,
      vatInvoiceUrl: null,
      placedAt: "2026-09-04T08:30:00Z",
      updatedAt: "2026-09-04T09:30:00Z",
    },
    invalidPath: "totals.vatAmount",
  },
  {
    name: "OrderListQuery",
    schema: contracts.OrderListQuerySchema,
    valid: { status: "SHIPPED", limit: "10" },
    invalid: { status: "IN_TRANSIT" },
    invalidPath: "status",
  },

  // ── me ──────────────────────────────────────────────────────────────────
  {
    name: "Me",
    schema: contracts.MeSchema,
    valid: me,
    // The password hash must never be expressible on this surface.
    invalid: { ...me, passwordHash: "$2a$10$abc" },
  },
  {
    name: "UpdateMeRequest",
    schema: contracts.UpdateMeRequestSchema,
    valid: { firstName: "Layla", language: "AR" },
    // An empty patch is a client bug; a 200 makes it look like a saved form.
    invalid: {},
  },
  {
    name: "DeleteAccountRequest",
    schema: contracts.DeleteAccountRequestSchema,
    valid: { confirmEmail: "buyer@example.com", reason: "Moving to another supplier" },
    invalid: { reason: "Moving to another supplier" },
    invalidPath: "confirmEmail",
  },
  {
    name: "AccountDeletion",
    schema: contracts.AccountDeletionSchema,
    valid: { status: "scheduled", requestedAt: "2026-09-05T09:00:00Z", erasesAt: "2026-10-05T09:00:00Z" },
    invalid: { status: "done", requestedAt: "2026-09-05T09:00:00Z", erasesAt: "2026-10-05T09:00:00Z" },
    invalidPath: "status",
  },

  // ── addresses ───────────────────────────────────────────────────────────
  {
    name: "Address",
    schema: contracts.AddressSchema,
    valid: address,
    invalid: { ...address, country: "US" },
    invalidPath: "country",
  },
  {
    name: "CreateAddressRequest",
    schema: contracts.CreateAddressRequestSchema,
    valid: { label: "Warehouse", line1: "Plot 42, JAFZA", city: "Dubai", country: "AE" },
    // Half a coordinate is not a location.
    invalid: { label: "Warehouse", line1: "Plot 42, JAFZA", city: "Dubai", country: "AE", latitude: 25.0 },
    invalidPath: "longitude",
  },
  {
    name: "UpdateAddressRequest",
    schema: contracts.UpdateAddressRequestSchema,
    valid: { isDefault: true },
    invalid: {},
  },
  {
    name: "AddressDeleted",
    schema: contracts.AddressDeletedSchema,
    valid: { id: "adr_1", deleted: true },
    invalid: { id: "adr_1", deleted: false },
    invalidPath: "deleted",
  },

  // ── devices ─────────────────────────────────────────────────────────────
  {
    name: "RegisterDeviceRequest",
    schema: contracts.RegisterDeviceRequestSchema,
    valid: {
      deviceId: "install_01HZX",
      pushToken: "fcm_token_that_is_long_enough_to_be_real",
      platform: "android",
      appVersion: "1.4.0",
      timeZone: "Asia/Dubai",
    },
    invalid: {
      deviceId: "install_01HZX",
      pushToken: "fcm_token_that_is_long_enough_to_be_real",
      platform: "web",
      appVersion: "1.4.0",
    },
    invalidPath: "platform",
  },
  {
    name: "Device",
    schema: contracts.DeviceSchema,
    valid: device,
    // The push token itself is never echoed back: a stolen response would be a
    // licence to notify the device.
    invalid: { ...device, pushToken: "fcm_token_that_is_long_enough_to_be_real" },
  },
  {
    name: "DeleteDeviceQuery",
    schema: contracts.DeleteDeviceQuerySchema,
    valid: { deviceId: "install_01HZX" },
    invalid: {},
    invalidPath: "deviceId",
  },
];
