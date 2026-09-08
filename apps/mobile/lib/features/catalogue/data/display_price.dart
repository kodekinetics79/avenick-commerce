import 'package:flutter/foundation.dart' show immutable;

import '../../../api/models/catalogue.dart';
import '../../../api/models/decimal.dart';
import '../../../api/models/enums.dart';
import '../../../api/models/money.dart';
import '../../../core/l10n/numerals.dart';

/// A catalogue price, resolved for display.
///
/// ## Why this class exists, and the one thing to read before changing it
///
/// The wire sends a NET price. `CardPrice.amount` and `PriceBand.price` are
/// exclusive of VAT — `composeOrderTotals` builds a total as
/// `subtotal - discount + goodsVat + shipping + shippingVat`, so the catalogue
/// figure is the `subtotal` side of that sum. It also sends
/// `vatRatePercent`, and it sends nothing else: **there is no gross field
/// anywhere in the catalogue contract.**
///
/// GCC consumer display is VAT-inclusive, so the gross figure has to come from
/// somewhere, and the only somewhere is this client. That is uncomfortable on
/// purpose: [Decimal] deliberately has no `operator *` for a rate, with the
/// comment "the only decimal multiply this domain has is a VAT rate, and that
/// one needs a rounding rule the server owns". This class is that rule, written
/// down once, in integer arithmetic, matching the server's
/// `Number(v.toFixed(2))` — half away from zero — so the two cannot disagree by
/// construction rather than by luck.
///
/// It also records [grossIsExact]. When the multiplication lands on a whole
/// minor unit the displayed gross is the arithmetic truth; when it does not,
/// the figure is this client's rounding of it, and the NET price plus the rate
/// are rendered beside it so the number the checkout will actually charge is on
/// the screen either way. A price block that shows only a computed gross is a
/// quote the checkout might not honour, and the buyer would have no way to see
/// the difference coming.
///
/// The authoritative figure remains `/v1/checkout/quote`. Nothing here is used
/// to build a request; it is display only.
@immutable
class DisplayPrice {
  const DisplayPrice({
    required this.net,
    required this.gross,
    required this.vatRatePercent,
    required this.grossIsExact,
    required this.isFrom,
  });

  /// The price as the contract sends it — exclusive of VAT.
  final Money net;

  /// [net] with VAT added, rounded the way the server rounds. Equal to [net]
  /// when the rate is zero, which is a real GCC state, not a missing value.
  final Money gross;

  /// 5 means 5%. Not a fraction — see `VatRatePercentSchema`, which rejects
  /// 0.05 precisely because it would under-tax by a factor of a hundred.
  final Decimal vatRatePercent;

  /// False when the VAT multiplication did not land on a whole minor unit, so
  /// [gross] is this client's rounding rather than the arithmetic truth.
  final bool grossIsExact;

  /// "from AED 12.00" rather than "AED 12.00": the product has several bands
  /// or variants and no single price. Printing the lowest as if it were the
  /// price is a quote the checkout will not honour.
  final bool isFrom;

  Currency get currency => net.currency;

  /// True when the jurisdiction zero-rates this line, so gross and net are the
  /// same figure and a second line saying so would be noise.
  bool get isZeroRated => vatRatePercent.isZero;

  factory DisplayPrice.fromCard(CardPrice price) => DisplayPrice._compute(
        net: price.money,
        vatRatePercent: price.vatRatePercent,
        isFrom: price.isFrom,
      );

  factory DisplayPrice.fromBand(PriceBand band, {bool isFrom = false}) =>
      DisplayPrice._compute(
        net: band.money,
        vatRatePercent: band.vatRatePercent,
        isFrom: isFrom,
      );

  factory DisplayPrice._compute({
    required Money net,
    required Decimal vatRatePercent,
    required bool isFrom,
  }) {
    final ({BigInt units, bool exact}) g = _grossMinorUnits(
      netMinorUnits: net.minorUnits,
      vatRatePercent: vatRatePercent,
    );
    return DisplayPrice(
      net: net,
      gross: Money.fromMinorUnits(g.units, net.currency),
      vatRatePercent: vatRatePercent,
      grossIsExact: g.exact,
      isFrom: isFrom,
    );
  }

  /// `net × (100 + rate) / 100`, entirely in [BigInt], rounded half away from
  /// zero — the same rule as the server's `Number(v.toFixed(2))`.
  ///
  /// The rate arrives as a [Decimal] of arbitrary scale, so both sides are
  /// lifted to that scale before the division rather than the rate being
  /// flattened to an int (which would turn a 7.5% rate into 7% and undercharge
  /// every line on the page).
  static ({BigInt units, bool exact}) _grossMinorUnits({
    required BigInt netMinorUnits,
    required Decimal vatRatePercent,
  }) {
    final BigInt rateScale = BigInt.from(10).pow(vatRatePercent.scale);
    final BigInt hundred = BigInt.from(100);
    final BigInt multiplier = hundred * rateScale + vatRatePercent.units;
    final BigInt denominator = hundred * rateScale;
    final BigInt numerator = netMinorUnits * multiplier;

    final bool negative = numerator.isNegative;
    final BigInt magnitude = numerator.abs();
    final BigInt quotient = magnitude ~/ denominator;
    final BigInt remainder = magnitude - quotient * denominator;
    final bool exact = remainder == BigInt.zero;
    final BigInt rounded = remainder * BigInt.two >= denominator
        ? quotient + BigInt.one
        : quotient;
    return (units: negative ? -rounded : rounded, exact: exact);
  }

  /// The VAT itself, as a figure. Derived rather than stored: it is exactly
  /// `gross - net`, and storing it separately is how a display grows a third
  /// number that does not agree with the other two.
  Money get vatAmount => gross - net;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is DisplayPrice &&
          other.net == net &&
          other.gross == gross &&
          other.vatRatePercent == vatRatePercent &&
          other.grossIsExact == grossIsExact &&
          other.isFrom == isFrom;

  @override
  int get hashCode =>
      Object.hash(net, gross, vatRatePercent, grossIsExact, isFrom);
}

/// Money as a string, in the shape a GCC storefront prints it.
///
/// The currency CODE leads — `AED 1,234.50` — because the six GCC currencies
/// have no distinct single-glyph symbols in common use and `د.إ` renders
/// inconsistently across the platform fallback faces this app currently has.
/// A three-letter code is unambiguous in both scripts.
///
/// Digits are forced Western by [Numerals.toWestern] in both locales, and the
/// digit string comes from [Decimal.toGrouped], never from `NumberFormat` —
/// `NumberFormat.format` takes a `num`, which would put an exact amount back
/// through binary floating point at the very last step.
abstract final class MoneyFormat {
  /// `AED 1,234.50`, or `1,234.50` with [withCode] false.
  static String format(Money money, {bool withCode = true}) {
    final String digits = Numerals.toWestern(
      money.amount.toGrouped(money.currency.decimalDigits),
    );
    return withCode ? '${money.currency.code} $digits' : digits;
  }

  /// A VAT rate as a percentage: `5%`, `7.5%`, `0%`.
  ///
  /// Trailing zeros are dropped — `5%`, never `5.00%` — because a statutory
  /// rate is a whole fact, not a measurement, and `5.00%` reads like a computed
  /// figure that might move.
  static String ratePercent(Decimal rate) =>
      '${Numerals.toWestern(rate.normalized.toString())}%';

  /// "Save AED 12.00 (20%)". The percent is integer division on [BigInt]: a
  /// saving of 19.7% shows as 19%, never as 20%, because rounding a saving up
  /// is a claim in the seller's favour.
  static String saving(Money was, Money now) {
    final Money diff = was - now;
    final String amount = format(diff);
    if (was.isZero) return 'Save $amount';
    final BigInt percent = diff.minorUnits * BigInt.from(100) ~/ was.minorUnits;
    return 'Save $amount (${Numerals.toWestern(percent.toString())}%)';
  }
}
