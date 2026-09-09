import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';

/// Western (ASCII) digits in both locales, app-wide.
///
/// `intl` resolves `ar` to the `arab` numbering system and emits Arabic-Indic
/// digits (٠١٢٣٤٥٦٧٨٩) for every number it formats. That is correct for prose
/// in some markets and wrong for this product, for three reasons that all
/// showed up on the web before it was forced there too:
///
/// 1. A price column has to align. Arabic-Indic digits have different advance
///    widths from the Latin figures in the same tabular font, so a right-aligned
///    money column goes ragged the moment a locale switches.
/// 2. SKUs, AWB numbers, PO numbers and order ids are the same string on the
///    invoice, in the warehouse scanner, and in the carrier's tracking page.
///    Rendering them in a second digit set makes them un-typeable back in.
/// 3. The web app already forces Western digits. A price that reads ١٢٣ in the
///    app and 123 on the site is two different claims about the same number.
///
/// Every formatter in the app must come from here. Constructing `NumberFormat`
/// directly with an `ar` locale re-introduces the bug silently — there is no
/// error, just different glyphs.
abstract final class Numerals {
  /// The locale `intl` is asked for when formatting numbers, regardless of the
  /// UI locale.
  ///
  /// `en` rather than `ar` is the override: it is the shortest way to pin the
  /// `latn` numbering system for every one of `intl`'s formatters at once.
  /// Symbol, separator and currency placement are set explicitly below, so
  /// nothing else leaks in from English.
  static const String numberLocale = 'en';

  /// Force ASCII digits onto an already-formatted string.
  ///
  /// The safety net for anything that slipped past the formatters — a
  /// server-rendered total, a value out of a package that built its own
  /// `NumberFormat`. Maps both the Arabic-Indic (U+0660) and the Extended
  /// Arabic-Indic / Persian (U+06F0) ranges.
  static String toWestern(String input) {
    if (input.isEmpty) return input;
    final StringBuffer out = StringBuffer();
    for (final int rune in input.runes) {
      if (rune >= 0x0660 && rune <= 0x0669) {
        out.writeCharCode(0x30 + (rune - 0x0660));
      } else if (rune >= 0x06F0 && rune <= 0x06F9) {
        out.writeCharCode(0x30 + (rune - 0x06F0));
      } else {
        out.writeCharCode(rune);
      }
    }
    return out.toString();
  }

  /// A plain integer: `1,250`.
  static String integer(num value) =>
      toWestern(NumberFormat.decimalPattern(numberLocale).format(value));

  /// A decimal with a fixed fraction length.
  static String decimal(num value, {int fractionDigits = 2}) {
    final NumberFormat f = NumberFormat.decimalPattern(numberLocale)
      ..minimumFractionDigits = fractionDigits
      ..maximumFractionDigits = fractionDigits;
    return toWestern(f.format(value));
  }

  /// Money. Always Western digits, and pair it with the figCard type step so
  /// the figures are tabular and a price column holds still.
  static String money(
    num value, {
    required String currencyCode,
    String? symbol,
    int fractionDigits = 2,
  }) {
    final NumberFormat f = NumberFormat.currency(
      locale: numberLocale,
      name: currencyCode,
      symbol: symbol ?? _symbolFor(currencyCode),
      decimalDigits: fractionDigits,
    );
    return toWestern(f.format(value));
  }

  /// A percentage: `12%`.
  static String percent(num fraction, {int fractionDigits = 0}) {
    final NumberFormat f = NumberFormat.decimalPercentPattern(
      locale: numberLocale,
      decimalDigits: fractionDigits,
    );
    return toWestern(f.format(fraction));
  }

  /// A quantity for a cart line or a stock count.
  static String quantity(int value) => integer(value);

  static String _symbolFor(String code) => switch (code.toUpperCase()) {
        'AED' => 'AED ',
        'SAR' => 'SAR ',
        'USD' => r'$',
        'EUR' => '€',
        'GBP' => '£',
        _ => '$code ',
      };
}

/// Dates and times, with Western digits in both locales for the same reasons.
///
/// Month and weekday NAMES still localise — those are words, not figures, and
/// an Arabic reader should see سبتمبر. Only the digits are pinned.
abstract final class Dates {
  static String short(DateTime value, Locale locale) => Numerals.toWestern(
        DateFormat.yMMMd(locale.toLanguageTag()).format(value),
      );

  static String dayMonth(DateTime value, Locale locale) => Numerals.toWestern(
        DateFormat.MMMd(locale.toLanguageTag()).format(value),
      );

  static String timeOfDay(DateTime value, Locale locale) => Numerals.toWestern(
        DateFormat.jm(locale.toLanguageTag()).format(value),
      );

  static String full(DateTime value, Locale locale) => Numerals.toWestern(
        DateFormat.yMMMMd(locale.toLanguageTag()).add_jm().format(value),
      );
}
