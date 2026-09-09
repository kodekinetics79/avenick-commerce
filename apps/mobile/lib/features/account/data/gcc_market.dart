import 'package:flutter/foundation.dart';

import '../../../api/models/enums.dart';

/// The six markets this platform trades in, and everything that follows from
/// choosing one.
///
/// NO BACKEND DEPENDENCY. Market selection is a device preference: `Me` carries
/// `language` but has no market or currency field, and `/v1/addresses` takes a
/// [Country] per address rather than a per-account market. So this file is the
/// whole source of truth for the dial code, the currency and the phone shape,
/// and none of it can drift out of sync with a server that does not model it.
///
/// The dial code matters more here than anywhere else in the app: **the phone
/// number is the account in the GCC**. A sign-in screen that opens on an empty
/// international field, or on `+1`, is asking a shopper in Riyadh to know their
/// own country code before they can log in.
enum GccMarket {
  ae(
    country: Country.ae,
    currency: Currency.aed,
    dialCode: '971',
    nameEn: 'United Arab Emirates',
    nameAr: 'الإمارات العربية المتحدة',
    nationalLength: 9,
    mobilePrefixes: <String>['50', '52', '54', '55', '56', '58'],
    groups: <int>[2, 3, 4],
  ),
  sa(
    country: Country.sa,
    currency: Currency.sar,
    dialCode: '966',
    nameEn: 'Saudi Arabia',
    nameAr: 'المملكة العربية السعودية',
    nationalLength: 9,
    mobilePrefixes: <String>['50', '53', '54', '55', '56', '57', '58', '59'],
    groups: <int>[2, 3, 4],
  ),
  qa(
    country: Country.qa,
    currency: Currency.qar,
    dialCode: '974',
    nameEn: 'Qatar',
    nameAr: 'قطر',
    nationalLength: 8,
    mobilePrefixes: <String>['3', '5', '6', '7'],
    groups: <int>[4, 4],
  ),
  kw(
    country: Country.kw,
    currency: Currency.kwd,
    dialCode: '965',
    nameEn: 'Kuwait',
    nameAr: 'الكويت',
    nationalLength: 8,
    mobilePrefixes: <String>['5', '6', '9'],
    groups: <int>[4, 4],
  ),
  om(
    country: Country.om,
    currency: Currency.omr,
    dialCode: '968',
    nameEn: 'Oman',
    nameAr: 'عُمان',
    nationalLength: 8,
    mobilePrefixes: <String>['7', '9'],
    groups: <int>[4, 4],
  ),
  bh(
    country: Country.bh,
    currency: Currency.bhd,
    dialCode: '973',
    nameEn: 'Bahrain',
    nameAr: 'البحرين',
    nationalLength: 8,
    mobilePrefixes: <String>['3'],
    groups: <int>[4, 4],
  );

  const GccMarket({
    required this.country,
    required this.currency,
    required this.dialCode,
    required this.nameEn,
    required this.nameAr,
    required this.nationalLength,
    required this.mobilePrefixes,
    required this.groups,
  });

  final Country country;

  /// The currency prices are shown in for this market. KWD, OMR and BHD are
  /// three-decimal currencies — see [Currency.decimalDigits].
  final Currency currency;

  /// Without the `+`. Rendered with one, and always inside an LTR isolate.
  final String dialCode;

  final String nameEn;
  final String nameAr;

  /// Digits in the national significant number, once the trunk `0` is gone.
  final int nationalLength;

  /// The prefixes a MOBILE number starts with in this market. Used to warn,
  /// never to block — see [PhoneNumber.looksLikeMobile].
  final List<String> mobilePrefixes;

  /// How the national number is grouped for display: AE `50 123 4567`,
  /// QA `3312 3456`. Cosmetic only; the wire value is never grouped.
  final List<int> groups;

  String displayName(Language language) =>
      language == Language.ar ? nameAr : nameEn;

  /// `+971`, ready to sit in the field prefix.
  String get displayDialCode => '+$dialCode';

  static GccMarket forCountry(Country country) =>
      GccMarket.values.firstWhere((GccMarket m) => m.country == country);

  static GccMarket? tryForDialCode(String dialCode) {
    for (final GccMarket m in GccMarket.values) {
      if (m.dialCode == dialCode) return m;
    }
    return null;
  }

  /// The market a build opens on when nothing has been chosen yet.
  ///
  /// The UAE, because that is where the platform is registered — NOT because
  /// it is a sensible neutral. There is no neutral: every default is wrong for
  /// five of the six markets, which is why the picker sits on the sign-in
  /// screen itself rather than three levels into settings.
  static const GccMarket fallback = GccMarket.ae;
}

/// A phone number in one market, in the three forms the app needs: what the
/// user typed, what is shown back to them, and what goes on the wire.
///
/// The wire form is E.164 — `+9715xxxxxxx` — because that is exactly what
/// `OtpRequest.phone` and `UpdateMeRequest.phone` are documented to take, and
/// what web registration already enforces. Diverging by even a space collects
/// a number the web would reject.
@immutable
class PhoneNumber {
  const PhoneNumber._({
    required this.market,
    required this.nationalDigits,
  });

  /// Take whatever is in the field and make sense of it.
  ///
  /// Handles every spelling a real person pastes out of WhatsApp or a contact
  /// card: `050 123 4567`, `+971 50 123 4567`, `00971501234567`,
  /// `971-50-123-4567`, and Arabic-Indic digits from an Arabic keyboard.
  /// [market] is the market whose prefix is showing in the field; an explicit
  /// international prefix in the input WINS over it, because someone who typed
  /// `+966` meant `+966`.
  factory PhoneNumber.parse(String input, {required GccMarket market}) {
    final String western = _toWesternDigits(input);
    String digits = western.replaceAll(RegExp(r'[^0-9+]'), '');

    GccMarket resolved = market;

    if (digits.startsWith('+')) {
      digits = digits.substring(1);
    } else if (digits.startsWith('00')) {
      digits = digits.substring(2);
    }

    // An explicit country code the user typed overrides the picker.
    for (final GccMarket candidate in GccMarket.values) {
      if (digits.length > candidate.dialCode.length &&
          digits.startsWith(candidate.dialCode)) {
        resolved = candidate;
        digits = digits.substring(candidate.dialCode.length);
        break;
      }
    }

    // The trunk prefix. Everyone in the Gulf writes their own number with a
    // leading 0 and nobody writes it with one when dialling from abroad.
    while (digits.startsWith('0')) {
      digits = digits.substring(1);
    }

    return PhoneNumber._(market: resolved, nationalDigits: digits);
  }

  /// Rebuild from a stored E.164 value, e.g. `Me.phone`.
  static PhoneNumber? fromE164(String? value) {
    if (value == null || value.isEmpty) return null;
    final String digits =
        _toWesternDigits(value).replaceAll(RegExp(r'[^0-9]'), '');
    for (final GccMarket candidate in GccMarket.values) {
      if (digits.startsWith(candidate.dialCode)) {
        return PhoneNumber._(
          market: candidate,
          nationalDigits: digits.substring(candidate.dialCode.length),
        );
      }
    }
    return null;
  }

  final GccMarket market;

  /// The national significant number: no `+`, no country code, no trunk `0`.
  final String nationalDigits;

  bool get isEmpty => nationalDigits.isEmpty;

  /// The right number of digits for this market.
  bool get hasCompleteLength => nationalDigits.length == market.nationalLength;

  /// Whether this looks like a MOBILE line rather than a landline.
  ///
  /// Advisory, and deliberately not part of [isValid]. Numbering plans move,
  /// operators are allocated new ranges, and a client that hard-blocks an
  /// unrecognised prefix locks out a real customer with a number that works
  /// perfectly. The screen warns; the server decides.
  bool get looksLikeMobile =>
      market.mobilePrefixes.any(nationalDigits.startsWith);

  bool get isValid => hasCompleteLength;

  /// The wire form: `+9715xxxxxxx`.
  String get e164 => '+${market.dialCode}$nationalDigits';

  /// Grouped for reading: `50 123 4567`. Never sent anywhere.
  String get nationalDisplay {
    if (nationalDigits.isEmpty) return '';
    final StringBuffer out = StringBuffer();
    int cursor = 0;
    for (final int size in market.groups) {
      if (cursor >= nationalDigits.length) break;
      if (cursor > 0) out.write(' ');
      final int end = (cursor + size).clamp(0, nationalDigits.length);
      out.write(nationalDigits.substring(cursor, end));
      cursor = end;
    }
    if (cursor < nationalDigits.length) {
      out.write(' ${nationalDigits.substring(cursor)}');
    }
    return out.toString();
  }

  /// `+971 50 123 4567` — for showing a number back, never for sending it.
  String get internationalDisplay =>
      '${market.displayDialCode} $nationalDisplay'.trim();

  /// Everything but the last two digits masked: `+971 •• ••• ••67`.
  ///
  /// What the OTP screen says it sent the code to. A full number echoed on a
  /// screen someone else can see is a number someone else can now use.
  String get masked {
    if (nationalDigits.length < 3) return market.displayDialCode;
    final String tail = nationalDigits.substring(nationalDigits.length - 2);
    final String body = List<String>.filled(
      nationalDigits.length - 2,
      '•',
    ).join();
    final String grouped = PhoneNumber._grouped(body + tail, market.groups);
    return '${market.displayDialCode} $grouped';
  }

  static String _grouped(String value, List<int> groups) {
    final StringBuffer out = StringBuffer();
    int cursor = 0;
    for (final int size in groups) {
      if (cursor >= value.length) break;
      if (cursor > 0) out.write(' ');
      final int end = (cursor + size).clamp(0, value.length);
      out.write(value.substring(cursor, end));
      cursor = end;
    }
    if (cursor < value.length) out.write(' ${value.substring(cursor)}');
    return out.toString();
  }

  /// Arabic-Indic and Persian digits back to ASCII, so a number typed on an
  /// Arabic keyboard is the same number as one typed on an English one.
  static String _toWesternDigits(String input) {
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

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PhoneNumber &&
          other.market == market &&
          other.nationalDigits == nationalDigits;

  @override
  int get hashCode => Object.hash(market, nationalDigits);

  @override
  String toString() => 'PhoneNumber($e164)';
}
