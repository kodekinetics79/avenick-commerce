import 'package:freezed_annotation/freezed_annotation.dart';

import 'decimal.dart';
import 'enums.dart';

/// An amount of money: an exact integer count of minor units, plus the
/// currency that says how many of them make one.
///
/// Money is never a `double` in this app. See [Decimal] for why. What [Money]
/// adds on top of an exact decimal is the currency, because a bare number
/// cannot be formatted correctly without one: 12.5 is "12.50" in AED and
/// "12.500" in KWD, and the difference is a factor of ten in the last digit a
/// buyer reads.
///
/// The wire does NOT carry a currency inside each money field — it carries a
/// bare number, with the currency as a sibling on the enclosing object
/// (`Cart.currency`, `CheckoutQuote.currency`, `OrderDetail.currency`). So the
/// generated models hold [Decimal] for each amount and expose typed [Money]
/// through getters that pair the amount with the object's own currency. That
/// keeps the deserializer honest — it does not invent a currency the payload
/// did not state — while giving screens a value they cannot mis-format.
@immutable
class Money implements Comparable<Money> {
  const Money._(this.currency, this.minorUnits);

  final Currency currency;

  /// The exact amount, counted in the currency's minor unit: fils for AED,
  /// halalas for SAR, and thousandths for KWD/BHD/OMR.
  final BigInt minorUnits;

  /// Pair an amount from the wire with the currency its enclosing object
  /// declared.
  ///
  /// The rescale is a widening for the three-digit currencies (the server
  /// rounds every money column to two places) and a no-op for the rest, so it
  /// is always exact. It throws rather than rounds if a payload ever carries
  /// more precision than the currency has — that would be a figure the ledger
  /// cannot store, and displaying a rounded version of it would hide the fact.
  factory Money.of(Decimal amount, Currency currency) =>
      Money._(currency, amount.rescale(currency.decimalDigits).units);

  factory Money.fromMinorUnits(BigInt minorUnits, Currency currency) =>
      Money._(currency, minorUnits);

  factory Money.zero(Currency currency) => Money._(currency, BigInt.zero);

  /// The amount in major units, exact.
  Decimal get amount => Decimal.fromUnits(minorUnits, currency.decimalDigits);

  bool get isZero => minorUnits == BigInt.zero;
  bool get isNegative => minorUnits.isNegative;

  Money operator +(Money other) {
    _requireSameCurrency(other);
    return Money._(currency, minorUnits + other.minorUnits);
  }

  Money operator -(Money other) {
    _requireSameCurrency(other);
    return Money._(currency, minorUnits - other.minorUnits);
  }

  /// Multiply by a whole quantity. There is no divide and no multiply by a
  /// rate: both need a rounding rule, and the rounding rule for this platform
  /// lives in `composeOrderTotals` on the server. A client that rounds a
  /// second time produces a second answer, and PR #21 is what that costs.
  Money timesQuantity(int quantity) =>
      Money._(currency, minorUnits * BigInt.from(quantity));

  void _requireSameCurrency(Money other) {
    if (other.currency != currency) {
      throw ArgumentError(
        'Cannot combine ${currency.code} with ${other.currency.code}. '
        'A cart is single-currency by contract; mixing them here would invent a rate.',
      );
    }
  }

  @override
  int compareTo(Money other) {
    _requireSameCurrency(other);
    return minorUnits.compareTo(other.minorUnits);
  }

  bool operator <(Money other) => compareTo(other) < 0;
  bool operator <=(Money other) => compareTo(other) <= 0;
  bool operator >(Money other) => compareTo(other) > 0;
  bool operator >=(Money other) => compareTo(other) >= 0;

  /// "1,234.500 KWD" — the currency's own number of decimals, always.
  ///
  /// Deliberately not `intl`'s `NumberFormat.currency`: its `format` takes a
  /// `num`, so using it would convert an exact amount to a `double` at the
  /// last moment, which is the one place the error is hardest to notice. The
  /// digits here come from [Decimal.toGrouped], which never leaves [BigInt].
  ///
  /// Arabic numerals and RTL placement are a presentation concern the theme
  /// layer owns; this returns the neutral form and takes separators so a
  /// locale-aware caller can pass its own.
  String format({
    bool withCode = true,
    String groupSeparator = ',',
    String decimalSeparator = '.',
  }) {
    final digits = amount.toGrouped(
      currency.decimalDigits,
      groupSeparator: groupSeparator,
      decimalSeparator: decimalSeparator,
    );
    return withCode ? '$digits ${currency.code}' : digits;
  }

  @override
  String toString() => format();

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Money &&
          other.currency == currency &&
          other.minorUnits == minorUnits);

  @override
  int get hashCode => Object.hash(currency, minorUnits);
}

/// Pair a wire [Decimal] with a currency.
extension DecimalAsMoney on Decimal {
  Money inCurrency(Currency currency) => Money.of(this, currency);
}
