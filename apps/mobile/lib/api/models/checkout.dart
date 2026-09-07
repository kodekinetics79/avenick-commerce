import 'package:freezed_annotation/freezed_annotation.dart';

import 'converters.dart';
import 'decimal.dart';
import 'enums.dart';
import 'money.dart';
import 'order_totals.dart';

part 'checkout.freezed.dart';
part 'checkout.g.dart';

/// The ship-to address as a quote and an order carry it — exactly the four
/// required fields `/api/orders` accepts, and no more. Pricing freight against
/// a richer address than checkout admits would quote for a destination the
/// order could not be placed to.
@freezed
abstract class ShippingAddress with _$ShippingAddress {
  const factory ShippingAddress({
    required String label,
    required String line1,
    required String city,
    required Country country,
    String? line2,
    String? postalCode,
  }) = _ShippingAddress;

  factory ShippingAddress.fromJson(Map<String, dynamic> json) =>
      _$ShippingAddressFromJson(json);
}

/// One priced line of a checkout quote.
///
/// Note this line carries its own [vatAmount] while [CartLine] does not: a
/// quote is the thing an order is written from, so every figure it was built
/// out of travels with it.
@freezed
abstract class QuoteLine with _$QuoteLine {
  const QuoteLine._();

  const factory QuoteLine({
    required String productId,
    required String? variantId,
    required String sellerId,
    required String sku,
    required String nameEn,
    required String nameAr,
    required int quantity,
    @DecimalConverter() required Decimal unitPrice,
    @DecimalConverter() required Decimal vatRatePercent,
    @DecimalConverter() required Decimal vatAmount,
    @DecimalConverter() required Decimal lineTotal,
  }) = _QuoteLine;

  factory QuoteLine.fromJson(Map<String, dynamic> json) =>
      _$QuoteLineFromJson(json);

  String name(Language language) => language == Language.ar ? nameAr : nameEn;

  Money unitPriceIn(Currency currency) => Money.of(unitPrice, currency);
  Money vatAmountIn(Currency currency) => Money.of(vatAmount, currency);
  Money lineTotalIn(Currency currency) => Money.of(lineTotal, currency);
}

/// What delivery costs, or why it could not be priced.
///
/// [status] is the field to branch on. `unpriced_no_zones` is NOT an error and
/// NOT free shipping: no zone covers the address, [amount] is zero, and the
/// buyer must be told freight will be quoted separately rather than shown a
/// total that omits it.
@freezed
abstract class ShippingQuote with _$ShippingQuote {
  const ShippingQuote._();

  const factory ShippingQuote({
    required ShippingQuoteStatus status,
    required String? zoneName,
    @DecimalConverter() required Decimal amount,
    @DecimalConverter() required Decimal vatRatePercent,
    required int? estimatedDaysMin,
    required int? estimatedDaysMax,
  }) = _ShippingQuote;

  factory ShippingQuote.fromJson(Map<String, dynamic> json) =>
      _$ShippingQuoteFromJson(json);

  Money amountIn(Currency currency) => Money.of(amount, currency);

  bool get isPriced => status == ShippingQuoteStatus.priced;

  /// True when the total on screen does not include freight, because freight
  /// is not knowable yet. The checkout screen MUST say so.
  bool get freightQuotedSeparately =>
      status == ShippingQuoteStatus.unpricedNoZones;

  bool get hasEstimate => estimatedDaysMin != null && estimatedDaysMax != null;
}

@freezed
abstract class AppliedPromotion with _$AppliedPromotion {
  const AppliedPromotion._();

  const factory AppliedPromotion({
    required String promotionId,

    /// Null for an automatic promotion the buyer did not type a code for.
    required String? couponCode,
    required String label,
    @DecimalConverter() required Decimal discountAmount,
  }) = _AppliedPromotion;

  factory AppliedPromotion.fromJson(Map<String, dynamic> json) =>
      _$AppliedPromotionFromJson(json);

  Money discountIn(Currency currency) => Money.of(discountAmount, currency);
}

/// A priced basket, valid until [expiresAt].
///
/// The totals carry the goods/shipping VAT split as two separate required
/// fields, and [OrderTotals.fromJson] refuses a payload where they do not add
/// up — see `order_totals.dart` for why that check exists.
@freezed
abstract class CheckoutQuote with _$CheckoutQuote {
  const CheckoutQuote._();

  const factory CheckoutQuote({
    required String quoteId,
    required Currency currency,
    required Channel channel,

    /// The jurisdiction's headline rate, as a PERCENTAGE (5 means 5%), which
    /// is the unit `composeOrderTotals` takes. A fraction such as 0.05 here
    /// would under-tax by a factor of a hundred.
    @DecimalConverter() required Decimal vatRatePercent,
    required List<QuoteLine> lines,
    required ShippingQuote shipping,
    required List<AppliedPromotion> promotions,
    required OrderTotals totals,
    @UtcDateTimeConverter() required DateTime expiresAt,
  }) = _CheckoutQuote;

  factory CheckoutQuote.fromJson(Map<String, dynamic> json) =>
      _$CheckoutQuoteFromJson(json);

  /// Totals paired with [currency], ready to format.
  MoneyTotals get money => totals.inCurrency(currency);

  bool isExpired(DateTime now) => !now.toUtc().isBefore(expiresAt);

  Duration timeRemaining(DateTime now) {
    final left = expiresAt.difference(now.toUtc());
    return left.isNegative ? Duration.zero : left;
  }

  /// True when the quote priced VAT on the delivery as well as on the goods.
  /// A zero-rated market (QA, KW) reports false here with a zero component,
  /// which is correct and different from the component being missing.
  bool get chargesVatOnShipping => !totals.shippingVatAmount.isZero;
}
