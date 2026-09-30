import 'package:freezed_annotation/freezed_annotation.dart';

import 'converters.dart';
import 'decimal.dart';
import 'enums.dart';
import 'money.dart';

part 'order_totals.freezed.dart';
part 'order_totals.g.dart';

/// Thrown when a response is well-formed JSON that the contract nevertheless
/// forbids — a total that does not equal its parts, a VAT figure that does not
/// equal the sum of its components.
///
/// This is deliberately NOT a parse error. The bytes were fine; the arithmetic
/// was not. Swallowing it and showing the number anyway is exactly how the
/// PR #21 defect stayed invisible: every figure on the screen agreed with
/// every other figure on the screen, and all of them were wrong together.
class ContractViolation implements Exception {
  const ContractViolation(this.subject, this.detail);

  /// The schema that was violated, e.g. `OrderTotals`.
  final String subject;
  final String detail;

  @override
  String toString() => 'ContractViolation($subject): $detail';
}

/// THE ORDER TOTALS, as `checkout/quote` computes them.
///
/// This mirrors `OrderTotals` in `checkout-invariants.ts` field for field, and
/// the two VAT components are separate, required and non-nullable for one
/// reason:
///
/// PR #21 fixed a defect where VAT was charged on the goods and not on the
/// delivery. The total was `goods + goodsVat + shipping` — freight added AFTER
/// tax. Every figure agreed with every other, the buyer was undercharged, and
/// the understated `vatAmount` was persisted for invoicing and settlement to
/// read. A single collapsed `vatAmount` field is indistinguishable from a
/// correct one at the type level, so collapsing them here would let that
/// defect back in with nothing failing.
///
/// The identities are therefore checked at parse time, not documented in
/// prose:
///
///     vatAmount == goodsVatAmount + shippingVatAmount
///     total     == subtotal - discountAmount + goodsVatAmount
///                           + shippingAmount + shippingVatAmount
///
/// A zero-rated jurisdiction needs no special case: QA and KW carry rate 0, so
/// `shippingVatAmount` is exactly zero and both identities still hold. That is
/// a different fact from the field being absent, and this type keeps the
/// difference.
///
/// The comparisons are EXACT, not epsilon-based, and they can be because
/// [Decimal] is exact. An epsilon here would be a tolerance for precisely the
/// class of error the check exists to catch.
///
/// There is no currency on this object — it is a sibling field on the
/// enclosing [CheckoutQuote]/`OrderDetail`. Use [inCurrency] to get typed
/// [Money] out.
@freezed
abstract class OrderTotals with _$OrderTotals {
  const OrderTotals._();

  const factory OrderTotals({
    @DecimalConverter() required Decimal subtotal,
    @DecimalConverter() required Decimal discountAmount,

    /// VAT on the GOODS alone. Never merge this with [shippingVatAmount].
    @DecimalConverter() required Decimal goodsVatAmount,
    @DecimalConverter() required Decimal shippingAmount,

    /// VAT on the DELIVERY alone. Zero in a zero-rated jurisdiction, which is
    /// not the same as absent.
    @DecimalConverter() required Decimal shippingVatAmount,

    /// The sum of the two components above, and equal to it exactly.
    @DecimalConverter() required Decimal vatAmount,
    @DecimalConverter() required Decimal total,
  }) = _OrderTotals;

  /// Parse and enforce. A payload with a collapsed VAT figure — one where
  /// `vatAmount` is only the goods VAT — is REJECTED here rather than shown.
  factory OrderTotals.fromJson(Map<String, dynamic> json) =>
      _$OrderTotalsFromJson(json)..checkInvariants();

  /// `vatAmount == goodsVatAmount + shippingVatAmount`.
  bool get vatComponentsAgree =>
      vatAmount == goodsVatAmount + shippingVatAmount;

  /// `total == subtotal - discountAmount + goodsVat + shipping + shippingVat`.
  bool get totalAgrees =>
      total ==
      subtotal -
          discountAmount +
          goodsVatAmount +
          shippingAmount +
          shippingVatAmount;

  bool get isConsistent => vatComponentsAgree && totalAgrees;

  /// Throws [ContractViolation] unless both identities hold.
  void checkInvariants() {
    if (!vatComponentsAgree) {
      throw ContractViolation(
        'OrderTotals',
        'vatAmount ($vatAmount) != goodsVatAmount ($goodsVatAmount) + '
            'shippingVatAmount ($shippingVatAmount). This is the PR #21 defect: '
            'VAT charged on the goods but not on the delivery.',
      );
    }
    if (!totalAgrees) {
      throw ContractViolation(
        'OrderTotals',
        'total ($total) != subtotal ($subtotal) - discountAmount ($discountAmount) '
            '+ goodsVatAmount ($goodsVatAmount) + shippingAmount ($shippingAmount) '
            '+ shippingVatAmount ($shippingVatAmount).',
      );
    }
  }

  /// Typed money for display, using the currency the enclosing object stated.
  MoneyTotals inCurrency(Currency currency) => MoneyTotals(
        subtotal: Money.of(subtotal, currency),
        discountAmount: Money.of(discountAmount, currency),
        goodsVatAmount: Money.of(goodsVatAmount, currency),
        shippingAmount: Money.of(shippingAmount, currency),
        shippingVatAmount: Money.of(shippingVatAmount, currency),
        vatAmount: Money.of(vatAmount, currency),
        total: Money.of(total, currency),
      );
}

/// The totals a fetched ORDER carries.
///
/// This is not [OrderTotals] with the same fields made convenient — it is a
/// genuinely weaker shape, and the difference is faithful to the database.
///
/// The `Order` table has columns for `subtotal`, `discountAmount`,
/// `shippingAmount`, `vatAmount` and `total`. It has NO column for the two VAT
/// components. `composeOrderTotals` computes them at checkout, the total is
/// written correctly from them, and then the split itself is dropped on the
/// floor. So an order placed before those columns exist can report what VAT
/// was charged in aggregate but cannot say how much of it was on the delivery.
///
/// Modelling those two as nullable is therefore the honest shape. Defaulting
/// them to zero would assert that no VAT was charged on freight — the exact
/// false claim PR #21 fixed. A UI that wants to show the split must handle
/// null by not showing it.
///
/// Consequently only the weaker identity can be enforced here:
///
///     total == subtotal - discountAmount + vatAmount + shippingAmount
///
/// and, WHEN both components are present, the stronger one as well.
@freezed
abstract class PersistedOrderTotals with _$PersistedOrderTotals {
  const PersistedOrderTotals._();

  const factory PersistedOrderTotals({
    @DecimalConverter() required Decimal subtotal,
    @DecimalConverter() required Decimal discountAmount,
    @DecimalConverter() required Decimal shippingAmount,

    /// The aggregate VAT actually charged. Always present.
    @DecimalConverter() required Decimal vatAmount,

    /// VAT on the goods — NULL for every order stored before the `Order` table
    /// grew a column for it. Null means "not recorded", never "zero".
    @NullableDecimalConverter() required Decimal? goodsVatAmount,

    /// VAT on the delivery — null on the same terms as [goodsVatAmount].
    @NullableDecimalConverter() required Decimal? shippingVatAmount,
    @DecimalConverter() required Decimal total,
  }) = _PersistedOrderTotals;

  factory PersistedOrderTotals.fromJson(Map<String, dynamic> json) =>
      _$PersistedOrderTotalsFromJson(json)..checkInvariants();

  /// True when this order recorded how its VAT split between goods and
  /// freight. False for every order written before those columns landed.
  bool get hasVatBreakdown =>
      goodsVatAmount != null && shippingVatAmount != null;

  /// The stronger identity, checkable only when the split was recorded.
  /// Returns null when there is nothing to check — deliberately tri-state, so
  /// "not recorded" cannot be mistaken for "checked and fine".
  bool? get vatComponentsAgree {
    final goods = goodsVatAmount;
    final shipping = shippingVatAmount;
    if (goods == null || shipping == null) return null;
    return vatAmount == goods + shipping;
  }

  bool get totalAgrees =>
      total == subtotal - discountAmount + vatAmount + shippingAmount;

  void checkInvariants() {
    if (!totalAgrees) {
      throw ContractViolation(
        'PersistedOrderTotals',
        'total ($total) != subtotal ($subtotal) - discountAmount ($discountAmount) '
            '+ vatAmount ($vatAmount) + shippingAmount ($shippingAmount).',
      );
    }
    if (vatComponentsAgree == false) {
      throw ContractViolation(
        'PersistedOrderTotals',
        'vatAmount ($vatAmount) != goodsVatAmount ($goodsVatAmount) + '
            'shippingVatAmount ($shippingVatAmount). The order recorded a VAT '
            'split that does not add up to the VAT it charged.',
      );
    }
  }

  PersistedMoneyTotals inCurrency(Currency currency) => PersistedMoneyTotals(
        subtotal: Money.of(subtotal, currency),
        discountAmount: Money.of(discountAmount, currency),
        shippingAmount: Money.of(shippingAmount, currency),
        vatAmount: Money.of(vatAmount, currency),
        goodsVatAmount:
            goodsVatAmount == null ? null : Money.of(goodsVatAmount!, currency),
        shippingVatAmount: shippingVatAmount == null
            ? null
            : Money.of(shippingVatAmount!, currency),
        total: Money.of(total, currency),
      );
}

/// [OrderTotals] paired with its currency, ready to format.
@immutable
class MoneyTotals {
  const MoneyTotals({
    required this.subtotal,
    required this.discountAmount,
    required this.goodsVatAmount,
    required this.shippingAmount,
    required this.shippingVatAmount,
    required this.vatAmount,
    required this.total,
  });

  final Money subtotal;
  final Money discountAmount;
  final Money goodsVatAmount;
  final Money shippingAmount;
  final Money shippingVatAmount;
  final Money vatAmount;
  final Money total;

  Currency get currency => total.currency;
}

/// [PersistedOrderTotals] paired with its currency. The two components stay
/// nullable here too — a formatter cannot conjure a figure the order never
/// stored.
@immutable
class PersistedMoneyTotals {
  const PersistedMoneyTotals({
    required this.subtotal,
    required this.discountAmount,
    required this.shippingAmount,
    required this.vatAmount,
    required this.goodsVatAmount,
    required this.shippingVatAmount,
    required this.total,
  });

  final Money subtotal;
  final Money discountAmount;
  final Money shippingAmount;
  final Money vatAmount;
  final Money? goodsVatAmount;
  final Money? shippingVatAmount;
  final Money total;

  Currency get currency => total.currency;

  bool get hasVatBreakdown =>
      goodsVatAmount != null && shippingVatAmount != null;
}
