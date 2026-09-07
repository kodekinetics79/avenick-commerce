import 'package:freezed_annotation/freezed_annotation.dart';

import 'common.dart';
import 'converters.dart';
import 'decimal.dart';
import 'enums.dart';
import 'money.dart';

part 'cart.freezed.dart';
part 'cart.g.dart';

/// One line of the server-held cart.
///
/// [unitPrice] and [lineTotal] are the server's figures, not the client's.
/// The app must NOT compute `unitPrice * qty` and show that: a tiered product
/// re-bands as the quantity crosses a rung, and the two answers disagree at
/// exactly the moment the buyer is watching.
@freezed
abstract class CartLine with _$CartLine {
  const CartLine._();

  const factory CartLine({
    required String id,
    required String productId,
    required String? variantId,
    required String sellerId,
    required String slug,
    required String sku,
    required String nameEn,
    required String nameAr,
    required ImageRef? image,
    required Channel channel,
    required int qty,

    /// Minimum order quantity. A B2B line below this cannot check out, so the
    /// stepper's floor comes from here, not from 1.
    required int moq,
    @DecimalConverter() required Decimal unitPrice,
    required Currency currency,
    @DecimalConverter() required Decimal vatRatePercent,

    /// True when the unit price came off a quantity ladder, so it will change
    /// if the quantity does.
    required bool priceTiered,
    required Availability availability,
    @DecimalConverter() required Decimal lineTotal,
  }) = _CartLine;

  factory CartLine.fromJson(Map<String, dynamic> json) =>
      _$CartLineFromJson(json);

  Money get unitPriceMoney => Money.of(unitPrice, currency);
  Money get lineTotalMoney => Money.of(lineTotal, currency);

  String name(Language language) => language == Language.ar ? nameAr : nameEn;

  bool get isBelowMoq => qty < moq;
}

@freezed
abstract class Cart with _$Cart {
  const Cart._();

  const factory Cart({
    required String id,

    /// A cart is single-currency by contract. Every [CartLine] repeats it, and
    /// they always agree — [assertSingleCurrency] is the check that says so.
    required Currency currency,
    required List<CartLine> lines,
    required int itemCount,
    @DecimalConverter() required Decimal subtotal,
    @UtcDateTimeConverter() required DateTime updatedAt,
  }) = _Cart;

  factory Cart.fromJson(Map<String, dynamic> json) => _$CartFromJson(json);

  Money get subtotalMoney => Money.of(subtotal, currency);

  bool get isEmpty => lines.isEmpty;

  /// Lines that would stop a checkout: below MOQ, or gone out of stock while
  /// the cart sat there.
  List<CartLine> get blockingLines => lines
      .where((l) => l.isBelowMoq || l.availability == Availability.outOfStock)
      .toList();

  /// The one arithmetic identity worth checking on a cart. It is NOT enforced
  /// at parse time: unlike the order totals, a cart is a scratch surface the
  /// buyer is still editing and a stale subtotal is a nuisance, not a wrong
  /// invoice. Screens that care can assert it.
  bool get subtotalAgrees {
    if (lines.isEmpty) return subtotal.isZero;
    var sum = Money.zero(currency);
    for (final line in lines) {
      sum += line.lineTotalMoney;
    }
    return sum == subtotalMoney;
  }
}

/// One line of a guest cart the merge refused, and why.
///
/// [acceptedQty] is what the server took instead — null when it took nothing.
/// The app shows this: silently dropping a line the buyer added before signing
/// in is how a cart "loses" items.
@freezed
abstract class CartMergeRejection with _$CartMergeRejection {
  const factory CartMergeRejection({
    required String productId,
    required String? variantId,
    required CartMergeRejectionReason reason,
    required int? acceptedQty,
  }) = _CartMergeRejection;

  factory CartMergeRejection.fromJson(Map<String, dynamic> json) =>
      _$CartMergeRejectionFromJson(json);
}

@freezed
abstract class CartMergeResult with _$CartMergeResult {
  const CartMergeResult._();

  const factory CartMergeResult({
    required Cart cart,
    required List<CartMergeRejection> rejected,
  }) = _CartMergeResult;

  factory CartMergeResult.fromJson(Map<String, dynamic> json) =>
      _$CartMergeResultFromJson(json);

  bool get isClean => rejected.isEmpty;
}
