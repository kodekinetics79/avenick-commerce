import 'package:json_annotation/json_annotation.dart';

/// Every closed value set the `/v1` surface carries on the wire.
///
/// The Dart names are lowerCamelCase and the wire names are pinned with
/// `@JsonValue`, so `constant_identifier_names` stays quiet and — more
/// importantly — a rename on this side can never silently change what is sent.
///
/// The authority for each list is `packages/contracts/src/enums.ts`, which is
/// itself checked against `schema.prisma` member for member by
/// `enums-match-prisma.test.ts`. A value added there and not here is a state
/// this app cannot render, so these lists are exhaustive on purpose.

/// A trading currency.
///
/// `decimalDigits` is the ISO 4217 minor-unit exponent, and it is the reason
/// this enum carries data at all: KWD, BHD and OMR are three-digit currencies.
/// Formatting 12.5 KWD as "12.50" is not a rounding nicety, it is the wrong
/// number by a factor of ten in the last place a buyer reads.
///
/// KNOWN SERVER LIMITATION, mirrored rather than hidden: every money column on
/// this platform is `Decimal(12, 2)` and `composeOrderTotals` rounds through
/// `Number(v.toFixed(2))`, so the wire only ever delivers TWO decimal places,
/// even for a three-digit currency. Widening 2 places to 3 is exact and
/// lossless, so [Money] does it and the app shows "12.500". What the app must
/// never do is invent a third digit of its own: the ledger does not have one.
enum Currency {
  @JsonValue('AED')
  aed('AED', 2),
  @JsonValue('SAR')
  sar('SAR', 2),
  @JsonValue('QAR')
  qar('QAR', 2),
  @JsonValue('KWD')
  kwd('KWD', 3),
  @JsonValue('OMR')
  omr('OMR', 3),
  @JsonValue('BHD')
  bhd('BHD', 3),
  @JsonValue('USD')
  usd('USD', 2);

  const Currency(this.code, this.decimalDigits);

  /// The ISO 4217 alphabetic code, identical to the wire value.
  final String code;

  /// ISO 4217 minor-unit exponent: 2 for AED/SAR/QAR/USD, 3 for KWD/OMR/BHD.
  final int decimalDigits;

  static Currency fromCode(String code) => Currency.values.firstWhere(
        (c) => c.code == code,
        orElse: () => throw FormatException('Unknown currency code: $code'),
      );
}

/// A GCC country this platform ships to.
enum Country {
  @JsonValue('AE')
  ae('AE'),
  @JsonValue('SA')
  sa('SA'),
  @JsonValue('QA')
  qa('QA'),
  @JsonValue('KW')
  kw('KW'),
  @JsonValue('OM')
  om('OM'),
  @JsonValue('BH')
  bh('BH');

  const Country(this.code);
  final String code;
}

enum Language {
  @JsonValue('AR')
  ar('AR'),
  @JsonValue('EN')
  en('EN');

  const Language(this.code);
  final String code;

  bool get isRtl => this == Language.ar;
}

/// The sales channel a price is resolved in. `PricingType` in Prisma,
/// `OrderType` on an order; the mobile surface names it once.
enum Channel {
  @JsonValue('B2C')
  b2c('B2C'),
  @JsonValue('B2B')
  b2b('B2B');

  const Channel(this.wire);
  final String wire;
}

enum Availability {
  @JsonValue('IN_STOCK')
  inStock,
  @JsonValue('OUT_OF_STOCK')
  outOfStock,

  /// The catalogue has no confirmed stock position. NOT the same as
  /// out-of-stock: the app must not strike the item through.
  @JsonValue('UNCONFIRMED')
  unconfirmed;

  bool get isOrderable => this != Availability.outOfStock;
}

enum OrderStatus {
  @JsonValue('PENDING_PAYMENT')
  pendingPayment,
  @JsonValue('PAYMENT_CONFIRMED')
  paymentConfirmed,
  @JsonValue('CONFIRMED')
  confirmed,
  @JsonValue('PROCESSING')
  processing,
  @JsonValue('SHIPPED')
  shipped,
  @JsonValue('OUT_FOR_DELIVERY')
  outForDelivery,
  @JsonValue('DELIVERED')
  delivered,
  @JsonValue('CANCELLED')
  cancelled,
  @JsonValue('REFUNDED')
  refunded,
  @JsonValue('RETURN_REQUESTED')
  returnRequested,
  @JsonValue('RETURNED')
  returned,
}

enum PaymentStatus {
  @JsonValue('UNPAID')
  unpaid,
  @JsonValue('PAID')
  paid,
  @JsonValue('PARTIALLY_PAID')
  partiallyPaid,
  @JsonValue('REFUNDED')
  refunded,
  @JsonValue('FAILED')
  failed,
}

enum PaymentMethod {
  @JsonValue('MADA')
  mada,
  @JsonValue('APPLE_PAY')
  applePay,
  @JsonValue('CREDIT_CARD')
  creditCard,
  @JsonValue('BANK_TRANSFER')
  bankTransfer,
  @JsonValue('STC_PAY')
  stcPay,
  @JsonValue('MOCK')
  mock,
}

enum ShipmentStatus {
  @JsonValue('PENDING')
  pending,
  @JsonValue('PICKED_UP')
  pickedUp,
  @JsonValue('IN_TRANSIT')
  inTransit,
  @JsonValue('OUT_FOR_DELIVERY')
  outForDelivery,
  @JsonValue('DELIVERED')
  delivered,
  @JsonValue('FAILED')
  failed,
  @JsonValue('RETURNED')
  returned,
}

enum UserRole {
  @JsonValue('CONSUMER')
  consumer,
  @JsonValue('COMPANY_ADMIN')
  companyAdmin,
  @JsonValue('COMPANY_BUYER')
  companyBuyer,
  @JsonValue('COMPANY_APPROVER')
  companyApprover,
  @JsonValue('SELLER_OWNER')
  sellerOwner,
  @JsonValue('SELLER_STAFF')
  sellerStaff,
  @JsonValue('ADMIN')
  admin,
  @JsonValue('SUPER_ADMIN')
  superAdmin,
}

enum UserStatus {
  @JsonValue('PENDING')
  pending,
  @JsonValue('ACTIVE')
  active,
  @JsonValue('SUSPENDED')
  suspended,
  @JsonValue('BANNED')
  banned,
}

/// The seller's standing badge, as `SellerSummary.tier` reports it.
enum SellerTier {
  @JsonValue('STANDARD')
  standard,
  @JsonValue('VERIFIED')
  verified,
  @JsonValue('GOLD')
  gold,
  @JsonValue('PLATINUM')
  platinum,
}

/// A buyer's standing inside their company, as `CompanyMembership.status`
/// reports it. Note this is NOT `UserStatus`: the value set is different.
enum CompanyStatus {
  @JsonValue('PENDING_VERIFICATION')
  pendingVerification,
  @JsonValue('ACTIVE')
  active,
  @JsonValue('SUSPENDED')
  suspended,
}

/// Why one line of a guest-cart merge was not accepted.
enum CartMergeRejectionReason {
  @JsonValue('product_not_found')
  productNotFound,
  @JsonValue('product_unavailable')
  productUnavailable,
  @JsonValue('variant_not_found')
  variantNotFound,
  @JsonValue('channel_not_enabled')
  channelNotEnabled,
  @JsonValue('currency_not_priced')
  currencyNotPriced,
  @JsonValue('below_moq')
  belowMoq,
  @JsonValue('insufficient_stock')
  insufficientStock,
  @JsonValue('quantity_limit')
  quantityLimit,
}

/// How a guest cart is folded into the signed-in one.
enum CartMergeStrategy {
  /// Add the guest quantity to whatever the server cart already holds.
  @JsonValue('sum')
  sum,

  /// The guest cart wins outright.
  @JsonValue('replace')
  replace,
}

/// Whether freight could be priced for this destination.
enum ShippingQuoteStatus {
  @JsonValue('priced')
  priced,

  /// No zone covers the address. The buyer is not blocked; the seller will
  /// quote freight separately.
  @JsonValue('unpriced_no_zones')
  unpricedNoZones,

  /// The destination is not served at all.
  @JsonValue('unavailable')
  unavailable,
}

enum DevicePlatform {
  @JsonValue('ios')
  ios,
  @JsonValue('android')
  android,
}

/// The sorts `GET /v1/products` accepts. There is deliberately no price sort:
/// the catalogue cannot order by a price it resolves per channel and currency.
enum ProductSort {
  @JsonValue('newest')
  newest,
  @JsonValue('name_asc')
  nameAsc,
  @JsonValue('moq_asc')
  moqAsc,
  @JsonValue('rating')
  rating;

  String get wire => const {
        ProductSort.newest: 'newest',
        ProductSort.nameAsc: 'name_asc',
        ProductSort.moqAsc: 'moq_asc',
        ProductSort.rating: 'rating',
      }[this]!;
}

/// The closed set of machine-readable failure codes the whole `/v1` surface
/// answers with. The app branches on this, never on `ApiError.message`.
enum ApiErrorCode {
  @JsonValue('unauthenticated')
  unauthenticated,
  @JsonValue('forbidden')
  forbidden,
  @JsonValue('not_found')
  notFound,
  @JsonValue('validation_failed')
  validationFailed,
  @JsonValue('rate_limited')
  rateLimited,
  @JsonValue('conflict')
  conflict,
  @JsonValue('payment_required')
  paymentRequired,
  @JsonValue('upstream_unavailable')
  upstreamUnavailable,
  @JsonValue('internal')
  internal;

  static ApiErrorCode? tryParse(String? wire) {
    if (wire == null) return null;
    for (final code in ApiErrorCode.values) {
      if (code.wire == wire) return code;
    }
    return null;
  }

  String get wire => const {
        ApiErrorCode.unauthenticated: 'unauthenticated',
        ApiErrorCode.forbidden: 'forbidden',
        ApiErrorCode.notFound: 'not_found',
        ApiErrorCode.validationFailed: 'validation_failed',
        ApiErrorCode.rateLimited: 'rate_limited',
        ApiErrorCode.conflict: 'conflict',
        ApiErrorCode.paymentRequired: 'payment_required',
        ApiErrorCode.upstreamUnavailable: 'upstream_unavailable',
        ApiErrorCode.internal: 'internal',
      }[this]!;
}

enum AccountDeletionStatus {
  @JsonValue('scheduled')
  scheduled,
}

enum TokenType {
  @JsonValue('Bearer')
  bearer;

  String get header => 'Bearer';
}
