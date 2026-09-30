import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import {
  AuthRefreshRequestSchema,
  AuthRevokeRequestSchema,
  AuthTokenRequestSchema,
  OtpRequestSchema,
  OtpVerifyRequestSchema,
  RevocationSchema,
  OtpChallengeSchema,
  TokenPairSchema,
  AuthPrincipalSchema,
} from "../auth";
import {
  AddCartItemRequestSchema,
  CartItemPathParamsSchema,
  CartLineSchema,
  CartMergeRejectionSchema,
  CartMergeRequestSchema,
  CartMergeResultSchema,
  CartSchema,
  UpdateCartItemRequestSchema,
} from "../cart";
import {
  AppliedPromotionSchema,
  CheckoutQuoteRequestSchema,
  CheckoutQuoteSchema,
  OrderTotalsSchema,
  QuoteLineSchema,
  ShippingAddressInputSchema,
  ShippingQuoteSchema,
} from "../checkout";
import {
  BrandListQuerySchema,
  BrandSchema,
  CardPriceSchema,
  CategorySchema,
  PriceBandSchema,
  ProductBySlugPathParamsSchema,
  ProductBySlugQuerySchema,
  ProductCardSchema,
  ProductDetailSchema,
  ProductListQueryFieldsSchema,
  ProductVariantSchema,
  RatingSummarySchema,
  SellerSummarySchema,
} from "../catalogue";
import {
  IdempotencyKeySchema,
  OrderCardSchema,
  OrderDetailSchema,
  OrderItemSchema,
  OrderListQuerySchema,
  OrderPathParamsSchema,
  OrderStatusEventSchema,
  PersistedOrderTotalsSchema,
  PlaceOrderRequestSchema,
  PlacedOrderSchema,
  ShipmentSchema,
} from "../orders";
import {
  CreateRfqRequestSchema,
  RfqCardSchema,
  RfqDecisionRequestSchema,
  RfqDetailSchema,
  RfqItemSchema,
  RfqPathParamsSchema,
  RfqSellerSchema,
} from "../rfqs";
import {
  AccountDeletionSchema,
  CompanyMembershipSchema,
  DeleteAccountRequestSchema,
  MeSchema,
  UpdateMeRequestSchema,
} from "../me";
import {
  AddressDeletedSchema,
  AddressPathParamsSchema,
  AddressSchema,
  CreateAddressRequestSchema,
  UpdateAddressRequestSchema,
} from "../addresses";
import {
  DeleteDeviceQuerySchema,
  DeviceDeletedSchema,
  DeviceSchema,
  RegisterDeviceRequestSchema,
} from "../devices";
import { ApiErrorSchema, ErrorEnvelopeSchema, PageMetaSchema } from "../envelope";
import { ImageSchema, QueryBooleanSchema } from "../primitives";

/**
 * Teach zod the `.openapi()` metadata method. This mutates the zod prototype,
 * so it happens HERE — in the generation entry — and never in a schema module.
 * Nothing an application imports pulls the generator in as a result.
 */
extendZodWithOpenApi(z);

/** The error taxonomy, mapped to the status each code is served with. */
const ERROR_RESPONSES = [
  { status: 400, code: "validation_failed", description: "The request failed schema or business validation." },
  { status: 401, code: "unauthenticated", description: "Missing or expired credential." },
  { status: 402, code: "payment_required", description: "The action needs a settled payment that has not settled." },
  { status: 403, code: "forbidden", description: "Authenticated, but not permitted." },
  { status: 404, code: "not_found", description: "No such resource, or none visible to this caller." },
  { status: 409, code: "conflict", description: "The request contradicts current state." },
  { status: 429, code: "rate_limited", description: "Throttled. Honour the Retry-After header." },
  { status: 503, code: "upstream_unavailable", description: "A dependency this platform does not control failed." },
  { status: 500, code: "internal", description: "Unexpected fault. Report the requestId." },
] as const;

type StatusCode = (typeof ERROR_RESPONSES)[number]["status"];

function errorResponses(statuses: readonly StatusCode[]) {
  const responses: Record<string, unknown> = {};
  // 500 is on every endpoint; the rest are declared per route so the document
  // does not promise a 402 on a catalogue read.
  for (const status of [...new Set([...statuses, 500 as StatusCode])].sort((a, b) => a - b)) {
    const entry = ERROR_RESPONSES.find((candidate) => candidate.status === status)!;
    responses[String(status)] = {
      description: entry.description,
      content: { "application/json": { schema: ErrorEnvelopeSchema } },
    };
  }
  return responses;
}

/**
 * Every endpoint on the surface, so the round-trip tests and the OpenAPI paths
 * are generated from one list rather than two that drift.
 */
export const V1_ENDPOINTS = [
  "POST /v1/auth/token",
  "POST /v1/auth/refresh",
  "POST /v1/auth/revoke",
  "POST /v1/auth/otp/request",
  "POST /v1/auth/otp/verify",
  "GET /v1/cart",
  "POST /v1/cart/items",
  "PATCH /v1/cart/items/{id}",
  "DELETE /v1/cart/items/{id}",
  "POST /v1/cart/merge",
  "POST /v1/checkout/quote",
  "GET /v1/products",
  "GET /v1/products/{slug}",
  "GET /v1/categories",
  "GET /v1/brands",
  "GET /v1/orders",
  "POST /v1/orders",
  "GET /v1/orders/{id}",
  "GET /v1/rfqs",
  "POST /v1/rfqs",
  "GET /v1/rfqs/{id}",
  "POST /v1/rfqs/{id}/decision",
  "GET /v1/me",
  "PATCH /v1/me",
  "DELETE /v1/account",
  "GET /v1/addresses",
  "POST /v1/addresses",
  "GET /v1/addresses/{id}",
  "PATCH /v1/addresses/{id}",
  "DELETE /v1/addresses/{id}",
  "POST /v1/devices",
  "DELETE /v1/devices",
] as const;

/**
 * Register a schema as a NAMED component, and make every OTHER schema that
 * embeds it emit a `$ref` to that name rather than a fresh inline copy.
 *
 * This needs explaining, because it is a sharp edge in the library. `.openapi()`
 * returns a CLONE carrying the metadata; the instance the schema modules
 * composed with is untouched. So the obvious `registry.register("Cart", CartSchema)`
 * registers a named `Cart` and then, when generating `CartMergeResult`, meets
 * the original `CartSchema` instance — which has no name — and inlines the
 * whole thing again. The first version of this file did exactly that and
 * produced a 426 KB document in which `Image` appeared eleven times. A Dart
 * generator fed that emits eleven near-identical model classes and no shared
 * `Image` type, which is the drift this package exists to prevent.
 *
 * So the metadata the library builds is copied back onto the ORIGINAL
 * instance, which is what the composites hold a reference to. Everything below
 * then resolves by name. The mutation is confined to this module — nothing an
 * application imports loads it — it only adds documentation metadata, and it
 * changes no parsing behaviour whatsoever.
 */
function named<T extends z.ZodTypeAny>(registry: OpenAPIRegistry, refId: string, schema: T): T {
  const tagged = schema.openapi(refId);
  (schema as { _def: { openapi?: unknown } })._def.openapi = (tagged as { _def: { openapi?: unknown } })._def.openapi;
  registry.register(refId, schema);
  return schema;
}

export function buildOpenApiDocument() {
  const registry = new OpenAPIRegistry();

  const bearerAuth = registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "Access token from POST /v1/auth/token, /refresh or /otp/verify.",
  });
  const security = [{ [bearerAuth.name]: [] }];

  // ── Shared components ────────────────────────────────────────────────────
  // Order matters only for readability of the emitted document; the $ref
  // linking above is by instance, not by declaration order.
  named(registry, "Image", ImageSchema);
  named(registry, "PageMeta", PageMetaSchema);
  named(registry, "ApiError", ApiErrorSchema);
  const ErrorEnvelope = named(registry, "ErrorEnvelope", ErrorEnvelopeSchema);
  void ErrorEnvelope;

  named(registry, "AuthPrincipal", AuthPrincipalSchema);
  const TokenPair = named(registry, "TokenPair", TokenPairSchema);
  const OtpChallenge = named(registry, "OtpChallenge", OtpChallengeSchema);
  const Revocation = named(registry, "Revocation", RevocationSchema);

  named(registry, "CartLine", CartLineSchema);
  const Cart = named(registry, "Cart", CartSchema);
  named(registry, "CartMergeRejection", CartMergeRejectionSchema);
  const CartMergeResult = named(registry, "CartMergeResult", CartMergeResultSchema);

  named(registry, "ShippingAddress", ShippingAddressInputSchema);
  named(registry, "QuoteLine", QuoteLineSchema);
  named(registry, "ShippingQuote", ShippingQuoteSchema);
  named(registry, "AppliedPromotion", AppliedPromotionSchema);
  named(registry, "OrderTotals", OrderTotalsSchema);
  const CheckoutQuote = named(registry, "CheckoutQuote", CheckoutQuoteSchema);

  named(registry, "RatingSummary", RatingSummarySchema);
  named(registry, "CardPrice", CardPriceSchema);
  named(registry, "PriceBand", PriceBandSchema);
  named(registry, "ProductVariant", ProductVariantSchema);
  named(registry, "SellerSummary", SellerSummarySchema);
  const ProductCard = named(registry, "ProductCard", ProductCardSchema);
  const ProductDetail = named(registry, "ProductDetail", ProductDetailSchema);
  const Category = named(registry, "Category", CategorySchema);
  const Brand = named(registry, "Brand", BrandSchema);

  named(registry, "PersistedOrderTotals", PersistedOrderTotalsSchema);
  named(registry, "OrderItem", OrderItemSchema);
  named(registry, "OrderStatusEvent", OrderStatusEventSchema);
  named(registry, "Shipment", ShipmentSchema);
  const OrderCard = named(registry, "OrderCard", OrderCardSchema);
  const OrderDetail = named(registry, "OrderDetail", OrderDetailSchema);
  const PlacedOrder = named(registry, "PlacedOrder", PlacedOrderSchema);

  named(registry, "RfqSeller", RfqSellerSchema);
  named(registry, "RfqItem", RfqItemSchema);
  const RfqCard = named(registry, "RfqCard", RfqCardSchema);
  const RfqDetail = named(registry, "RfqDetail", RfqDetailSchema);

  named(registry, "CompanyMembership", CompanyMembershipSchema);
  const Me = named(registry, "Me", MeSchema);
  const AccountDeletion = named(registry, "AccountDeletion", AccountDeletionSchema);

  const Address = named(registry, "Address", AddressSchema);
  const AddressDeleted = named(registry, "AddressDeleted", AddressDeletedSchema);

  const Device = named(registry, "Device", DeviceSchema);
  const DeviceDeleted = named(registry, "DeviceDeleted", DeviceDeletedSchema);

  /**
   * `inStock` accepts a real boolean or the spellings a query string carries,
   * so its zod type is a union with a transform — which the generator would
   * otherwise document as `anyOf[boolean, enum]`, and which a Dart generator
   * would turn into a wrapper type for what is a checkbox. The parameter MEANS
   * a boolean, so it is documented as one; the schema still parses "true",
   * "1" and a bare boolean at the route. `.openapi()` clones, so this override
   * is local to the document and changes nothing for any other consumer.
   */
  const productListQueryForDocs = ProductListQueryFieldsSchema.extend({
    inStock: QueryBooleanSchema.openapi({ type: "boolean" }).optional(),
  });

  // ── Response envelope helpers ────────────────────────────────────────────
  const ok = (schema: z.ZodTypeAny, description: string) => ({
    description,
    content: { "application/json": { schema: z.object({ data: schema }).strict() } },
  });
  const okPage = (item: z.ZodTypeAny, description: string) => ({
    description,
    content: {
      "application/json": {
        schema: z.object({ data: z.array(item), meta: PageMetaSchema }).strict(),
      },
    },
  });
  const json = (schema: z.ZodTypeAny, description: string) => ({
    description,
    required: true,
    content: { "application/json": { schema } },
  });

  // ── auth ─────────────────────────────────────────────────────────────────
  registry.registerPath({
    method: "post",
    path: "/v1/auth/token",
    tags: ["auth"],
    summary: "Exchange credentials for a token pair",
    security: [],
    request: { body: json(AuthTokenRequestSchema, "Password grant.") },
    responses: { 200: ok(TokenPair, "A token pair."), ...errorResponses([400, 401, 403, 429]) },
  });

  registry.registerPath({
    method: "post",
    path: "/v1/auth/refresh",
    tags: ["auth"],
    summary: "Rotate a refresh token for a new pair",
    security: [],
    request: { body: json(AuthRefreshRequestSchema, "The stored refresh token and its device.") },
    responses: { 200: ok(TokenPair, "A new token pair; the old refresh token is now invalid."), ...errorResponses([400, 401, 429]) },
  });

  registry.registerPath({
    method: "post",
    path: "/v1/auth/revoke",
    tags: ["auth"],
    summary: "Revoke one refresh token, or every session on the account",
    security,
    request: { body: json(AuthRevokeRequestSchema, "Exactly one of refreshToken or allSessions.") },
    responses: { 200: ok(Revocation, "How many tokens stopped working."), ...errorResponses([400, 401, 429]) },
  });

  registry.registerPath({
    method: "post",
    path: "/v1/auth/otp/request",
    tags: ["auth"],
    summary: "Send a one-time code by SMS",
    description: "Answers identically for a registered and an unregistered number: a differing answer is an account-enumeration oracle.",
    security: [],
    request: { body: json(OtpRequestSchema, "The phone to challenge.") },
    responses: { 200: ok(OtpChallenge, "The challenge to verify against."), ...errorResponses([400, 429, 503]) },
  });

  registry.registerPath({
    method: "post",
    path: "/v1/auth/otp/verify",
    tags: ["auth"],
    summary: "Verify a one-time code and sign in",
    security: [],
    request: { body: json(OtpVerifyRequestSchema, "The challenge and the code.") },
    responses: { 200: ok(TokenPair, "A token pair."), ...errorResponses([400, 401, 429]) },
  });

  // ── cart ─────────────────────────────────────────────────────────────────
  registry.registerPath({
    method: "get",
    path: "/v1/cart",
    tags: ["cart"],
    summary: "The signed-in account's cart",
    security,
    responses: { 200: ok(Cart, "The cart. Reports a subtotal, never a total — see POST /v1/checkout/quote."), ...errorResponses([401, 429]) },
  });

  registry.registerPath({
    method: "post",
    path: "/v1/cart/items",
    tags: ["cart"],
    summary: "Add a line to the cart",
    security,
    request: { body: json(AddCartItemRequestSchema, "Identity and quantity; the server resolves the price.") },
    responses: { 200: ok(Cart, "The cart after the addition."), ...errorResponses([400, 401, 404, 409, 429]) },
  });

  registry.registerPath({
    method: "patch",
    path: "/v1/cart/items/{id}",
    tags: ["cart"],
    summary: "Set a line's quantity",
    description: "A line with priceTiered=true is repriced by the server; the resolved unitPrice may change.",
    security,
    request: { params: CartItemPathParamsSchema, body: json(UpdateCartItemRequestSchema, "The new quantity.") },
    responses: { 200: ok(Cart, "The cart after the change."), ...errorResponses([400, 401, 404, 409, 429]) },
  });

  registry.registerPath({
    method: "delete",
    path: "/v1/cart/items/{id}",
    tags: ["cart"],
    summary: "Remove a line",
    security,
    request: { params: CartItemPathParamsSchema },
    responses: { 200: ok(Cart, "The cart after the removal."), ...errorResponses([401, 404, 429]) },
  });

  registry.registerPath({
    method: "post",
    path: "/v1/cart/merge",
    tags: ["cart"],
    summary: "Fold an offline cart into the account's cart",
    security,
    request: { body: json(CartMergeRequestSchema, "Offline lines and the merge strategy.") },
    responses: { 200: ok(CartMergeResult, "The merged cart, and every line that could not be taken."), ...errorResponses([400, 401, 429]) },
  });

  // ── checkout ─────────────────────────────────────────────────────────────
  registry.registerPath({
    method: "post",
    path: "/v1/checkout/quote",
    tags: ["checkout"],
    summary: "Price a basket for a destination",
    description:
      "The only endpoint that states a total. `totals` mirrors composeOrderTotals exactly: goodsVatAmount and shippingVatAmount are separate, required fields and vatAmount is their sum. Delivery carries the destination's VAT at the same statutory rate the goods do.",
    security,
    request: { body: json(CheckoutQuoteRequestSchema, "Lines, destination and currency.") },
    responses: { 200: ok(CheckoutQuote, "The priced quote."), ...errorResponses([400, 401, 403, 404, 409, 429, 503]) },
  });

  // ── catalogue ────────────────────────────────────────────────────────────
  registry.registerPath({
    method: "get",
    path: "/v1/products",
    tags: ["catalogue"],
    summary: "Browse the catalogue",
    description: "Cursor-paginated. There is no total count by design: an unbounded count() beside every page query is the cheapest external way to load this database.",
    security: [],
    request: { query: productListQueryForDocs },
    responses: { 200: okPage(ProductCard, "A page of lean product cards."), ...errorResponses([400, 401, 429]) },
  });

  registry.registerPath({
    method: "get",
    path: "/v1/products/{slug}",
    tags: ["catalogue"],
    summary: "One product, in full",
    security: [],
    request: { params: ProductBySlugPathParamsSchema, query: ProductBySlugQuerySchema },
    responses: { 200: ok(ProductDetail, "The full product."), ...errorResponses([400, 401, 404, 429]) },
  });

  registry.registerPath({
    method: "get",
    path: "/v1/categories",
    tags: ["catalogue"],
    summary: "The category tree, flattened",
    description: "Depth-first order, each node carrying parentId and depth. Only branches with a discoverable product beneath them are present.",
    security: [],
    responses: { 200: ok(z.array(Category), "Every visible category."), ...errorResponses([429]) },
  });

  registry.registerPath({
    method: "get",
    path: "/v1/brands",
    tags: ["catalogue"],
    summary: "Brands with active products",
    security: [],
    request: { query: BrandListQuerySchema },
    responses: { 200: okPage(Brand, "A page of brands."), ...errorResponses([400, 429]) },
  });

  // ── orders ───────────────────────────────────────────────────────────────
  registry.registerPath({
    method: "get",
    path: "/v1/orders",
    tags: ["orders"],
    summary: "The account's orders",
    security,
    request: { query: OrderListQuerySchema },
    responses: { 200: okPage(OrderCard, "A page of order cards."), ...errorResponses([400, 401, 429]) },
  });

  registry.registerPath({
    method: "post",
    path: "/v1/orders",
    tags: ["orders"],
    summary: "Place an order",
    description:
      "Prices, discounts, VAT and freight are resolved server-side; the request carries identity and quantity only. Send an Idempotency-Key header: a retry of the same submission returns the original order with replayed=true instead of creating a second one. B2C only — a B2B order must go through the governed purchase-order workflow, which has no endpoint on this surface. Card and wallet methods are refused with 503 until a payment-session flow exists; BANK_TRANSFER is the method that completes.",
    security,
    request: {
      headers: z.object({ "Idempotency-Key": IdempotencyKeySchema.optional() }),
      body: json(PlaceOrderRequestSchema, "Lines, destination, currency and payment method."),
    },
    responses: {
      200: ok(PlacedOrder, "The placed order, and whether this response replayed an existing one."),
      ...errorResponses([400, 401, 403, 404, 409, 429, 503]),
    },
  });

  registry.registerPath({
    method: "get",
    path: "/v1/orders/{id}",
    tags: ["orders"],
    summary: "One order, in full",
    description:
      "totals.goodsVatAmount and totals.shippingVatAmount are nullable here, unlike on a quote: the Order table stores a single collapsed vatAmount and the two components are not persisted.",
    security,
    request: { params: OrderPathParamsSchema },
    responses: { 200: ok(OrderDetail, "The full order."), ...errorResponses([401, 403, 404, 429]) },
  });

  // ── rfqs ─────────────────────────────────────────────────────────────────
  registry.registerPath({
    method: "get",
    path: "/v1/rfqs",
    tags: ["rfqs"],
    summary: "The buyer's requests for quote",
    description:
      "The caller's own RFQs, plus their company's when they hold an active membership. Returned whole and capped at 50: the buyer service reads a fixed page with no cursor.",
    security,
    responses: { 200: ok(z.array(RfqCard), "The buyer's RFQs, newest first."), ...errorResponses([401, 429]) },
  });

  registry.registerPath({
    method: "post",
    path: "/v1/rfqs",
    tags: ["rfqs"],
    summary: "Ask for a quote",
    description:
      "The action a quote-only product offers instead of Add to Cart. A line naming a catalogue product takes its name from the catalogue; a free-text line must carry its own. One RFQ is answered by at most one supplier — see the RfqDetail description.",
    security,
    request: { body: json(CreateRfqRequestSchema, "The lines, the currency to be quoted in, and when they are needed.") },
    responses: { 200: ok(RfqDetail, "The submitted request."), ...errorResponses([400, 401, 404, 429]) },
  });

  registry.registerPath({
    method: "get",
    path: "/v1/rfqs/{id}",
    tags: ["rfqs"],
    summary: "One request, with its quoted lines",
    description:
      "RFQRequest.sellerId is a single nullable supplier and submitQuote is its only writer, so a request carries at most ONE supplier's prices. There is no multi-supplier comparison to return, and this surface does not pretend otherwise.",
    security,
    request: { params: RfqPathParamsSchema },
    responses: { 200: ok(RfqDetail, "The request and its lines."), ...errorResponses([401, 404, 429]) },
  });

  registry.registerPath({
    method: "post",
    path: "/v1/rfqs/{id}/decision",
    tags: ["rfqs"],
    summary: "Accept or reject a quote",
    description:
      "expectedQuoteVersion is compared against the stored version under the RFQ's advisory lock, so a decision made against a quote the supplier has since revised is refused rather than binding the buyer to a price they never saw.",
    security,
    request: { params: RfqPathParamsSchema, body: json(RfqDecisionRequestSchema, "The decision and the quote version it was made against.") },
    responses: { 200: ok(RfqDetail, "The request after the decision."), ...errorResponses([400, 401, 404, 409, 429]) },
  });

  // ── me ───────────────────────────────────────────────────────────────────
  registry.registerPath({
    method: "get",
    path: "/v1/me",
    tags: ["me"],
    summary: "The signed-in identity",
    security,
    responses: { 200: ok(Me, "The profile."), ...errorResponses([401, 429]) },
  });

  registry.registerPath({
    method: "patch",
    path: "/v1/me",
    tags: ["me"],
    summary: "Change the profile",
    description: "Changing phone re-enters verification, so phoneVerified may come back false.",
    security,
    request: { body: json(UpdateMeRequestSchema, "At least one field.") },
    responses: { 200: ok(Me, "The updated profile."), ...errorResponses([400, 401, 409, 429]) },
  });

  registry.registerPath({
    method: "delete",
    path: "/v1/account",
    tags: ["me"],
    summary: "Schedule account deletion",
    security,
    request: { body: json(DeleteAccountRequestSchema, "Typed confirmation.") },
    responses: { 200: ok(AccountDeletion, "When the erasure happens."), ...errorResponses([400, 401, 409, 429]) },
  });

  // ── addresses ────────────────────────────────────────────────────────────
  registry.registerPath({
    method: "get",
    path: "/v1/addresses",
    tags: ["addresses"],
    summary: "The account's addresses",
    security,
    responses: { 200: ok(z.array(Address), "Every address on the account."), ...errorResponses([401, 429]) },
  });

  registry.registerPath({
    method: "post",
    path: "/v1/addresses",
    tags: ["addresses"],
    summary: "Add an address",
    security,
    request: { body: json(CreateAddressRequestSchema, "The new address.") },
    responses: { 200: ok(Address, "The created address."), ...errorResponses([400, 401, 429]) },
  });

  registry.registerPath({
    method: "get",
    path: "/v1/addresses/{id}",
    tags: ["addresses"],
    summary: "One address",
    security,
    request: { params: AddressPathParamsSchema },
    responses: { 200: ok(Address, "The address."), ...errorResponses([401, 403, 404, 429]) },
  });

  registry.registerPath({
    method: "patch",
    path: "/v1/addresses/{id}",
    tags: ["addresses"],
    summary: "Change an address",
    security,
    request: { params: AddressPathParamsSchema, body: json(UpdateAddressRequestSchema, "At least one field.") },
    responses: { 200: ok(Address, "The updated address."), ...errorResponses([400, 401, 403, 404, 429]) },
  });

  registry.registerPath({
    method: "delete",
    path: "/v1/addresses/{id}",
    tags: ["addresses"],
    summary: "Remove an address",
    description: "Orders keep their own address snapshot, so removing one never rewrites history.",
    security,
    request: { params: AddressPathParamsSchema },
    responses: { 200: ok(AddressDeleted, "The address is gone."), ...errorResponses([401, 403, 404, 409, 429]) },
  });

  // ── devices ──────────────────────────────────────────────────────────────
  registry.registerPath({
    method: "post",
    path: "/v1/devices",
    tags: ["devices"],
    summary: "Register or refresh a push token",
    description: "Idempotent on deviceId: a rotated token updates the row rather than creating a second one.",
    security,
    request: { body: json(RegisterDeviceRequestSchema, "The installation and its push token.") },
    responses: { 200: ok(Device, "The registered device."), ...errorResponses([400, 401, 429]) },
  });

  registry.registerPath({
    method: "delete",
    path: "/v1/devices",
    tags: ["devices"],
    summary: "Stop pushing to a device",
    security,
    request: { query: DeleteDeviceQuerySchema },
    responses: { 200: ok(DeviceDeleted, "The device is deregistered."), ...errorResponses([400, 401, 404, 429]) },
  });

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Avenick Mobile API",
      version: "1.0.0",
      description:
        "The versioned surface the Avenick Flutter app consumes. Generated from the zod schemas in @avenick/contracts — never edited by hand. Every response is `{ data, meta? }`; every failure is `{ error: { code, message, requestId, fieldErrors? } }`.",
    },
    servers: [{ url: "/api", description: "Same-origin. /v1 paths are relative to this." }],
    tags: [
      { name: "auth", description: "Tokens, refresh, revocation and OTP." },
      { name: "cart", description: "The server cart, which absorbs the device's offline cart." },
      { name: "checkout", description: "Pricing a basket. The only place a total is stated." },
      { name: "catalogue", description: "Products, categories and brands." },
      { name: "orders", description: "Placing and reading orders." },
      { name: "rfqs", description: "Requests for quote — the buying journey for a quote-only catalogue." },
      { name: "me", description: "Identity and account lifecycle." },
      { name: "addresses", description: "Ship-to addresses." },
      { name: "devices", description: "Push-notification registration." },
    ],
  });
}
