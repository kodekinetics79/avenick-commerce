import 'package:freezed_annotation/freezed_annotation.dart';

/// An exact decimal number: [units] scaled by ten to the power of [scale].
///
/// WHY THIS EXISTS INSTEAD OF `double`
///
/// Every money field on the `/v1` surface arrives as a JSON *number* in major
/// units — `12.34`, not `1234`. Decoded into a Dart `double` that value is
/// 12.339999999999999857891452847979962825775146484375, and the error is
/// silent: it survives a `toStringAsFixed(2)`, so a wrong total looks right
/// until it is summed a few hundred times in a cart, a settlement report or a
/// VAT return. `0.1 + 0.2 != 0.3` is not a curiosity here, it is a defect
/// class with money attached.
///
/// So this type never performs binary floating-point arithmetic. It parses the
/// decimal *text* of the incoming number and works in [BigInt] from there.
///
/// A NOTE ON THE PARSE PATH. `dart:convert` hands us a `double` for `12.34`
/// before we get a say — there is no reviver that exposes the raw token. The
/// only lossless recovery is `double.toString()`, which Dart specifies as the
/// SHORTEST string that round-trips back to the same double. For a value the
/// server produced with `Number(v.toFixed(2))` that string is exactly the two
/// decimal places the server rounded to. From there everything is integer
/// arithmetic. [Decimal.parse] is the preferred entry point where the raw text
/// is available (fixtures, tests, a future string-typed contract).
@immutable
class Decimal implements Comparable<Decimal> {
  const Decimal._(this.units, this.scale);

  /// The unscaled value. The number represented is `units / 10^scale`.
  final BigInt units;

  /// The number of decimal places. Always `>= 0`.
  final int scale;

  static final Decimal zero = Decimal._(BigInt.zero, 0);

  /// The largest magnitude a `Decimal(12, 2)` money column can hold. Anything
  /// beyond this is a value the server could not have written, so parsing it
  /// as money is refused rather than displayed.
  static final BigInt maxMoneyMinorUnits = BigInt.from(999999999999);

  /// Scales beyond this are not a precision this platform has any use for, and
  /// an unbounded scale is an unbounded [BigInt] allocation from a hostile
  /// response body.
  static const int maxScale = 30;

  factory Decimal.fromUnits(BigInt units, int scale) {
    if (scale < 0 || scale > maxScale) {
      throw ArgumentError.value(
        scale,
        'scale',
        'scale must be in 0..$maxScale',
      );
    }
    return Decimal._(units, scale);
  }

  factory Decimal.fromInt(int value) => Decimal._(BigInt.from(value), 0);

  static final RegExp _syntax =
      RegExp(r'^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$');

  /// Parse exact decimal text. Accepts an exponent so that `double.toString()`
  /// output such as `1e+21` does not become a silent `FormatException` in a
  /// place where a wrong number would be worse than a crash.
  factory Decimal.parse(String source) {
    final trimmed = source.trim();
    final match = _syntax.firstMatch(trimmed);
    if (match == null) {
      throw FormatException('Not an exact decimal: "$source"');
    }
    final negative = match.group(1) == '-';
    final whole = match.group(2)!;
    final fraction = match.group(3) ?? '';
    final exponent = int.parse(match.group(4) ?? '0');

    var scale = fraction.length - exponent;
    var units = BigInt.parse('$whole$fraction');
    if (scale < 0) {
      units *= _pow10(-scale);
      scale = 0;
    }
    if (scale > maxScale) {
      throw FormatException(
        'Decimal "$source" needs $scale places; the limit is $maxScale',
      );
    }
    return Decimal._(negative ? -units : units, scale);
  }

  /// Build from a decoded JSON value.
  ///
  /// `int` is taken directly. `double` goes through its shortest round-trip
  /// text, never through multiplication. A `String` is taken as exact text, so
  /// this keeps working unchanged the day the contract widens money to a
  /// string — which is the change this client would most like to see.
  factory Decimal.fromJson(Object? json) {
    if (json is int) return Decimal._(BigInt.from(json), 0);
    if (json is String) return Decimal.parse(json);
    if (json is double) {
      if (!json.isFinite) {
        throw FormatException('Not a finite decimal: $json');
      }
      return Decimal.parse(json.toString());
    }
    if (json is BigInt) return Decimal._(json, 0);
    throw FormatException(
      'Cannot read a decimal from ${json.runtimeType}: $json',
    );
  }

  static Decimal? fromJsonNullable(Object? json) =>
      json == null ? null : Decimal.fromJson(json);

  /// The JSON form: a number in major units, matching what the server sends.
  ///
  /// No request body on the `/v1` surface carries money — prices, discounts,
  /// VAT and freight are all resolved server-side, deliberately — so this is
  /// used for round-trip tests, caching and diagnostics rather than for
  /// anything the server reads. It is still exact for every value the wire can
  /// carry: at `Decimal(12, 2)` magnitudes the shortest round-trip text of the
  /// resulting double is the same text we started from.
  Object toJson() {
    if (scale == 0) {
      final asInt = units.toInt();
      if (BigInt.from(asInt) == units) return asInt;
    }
    return double.parse(toString());
  }

  static Object? toJsonNullable(Decimal? value) => value?.toJson();

  bool get isZero => units == BigInt.zero;
  bool get isNegative => units.isNegative;
  int get sign => units.sign;

  /// Move to [newScale] without losing a digit.
  ///
  /// Widening (2 places to 3, for a KWD figure the server rounded to 2) is
  /// exact and always allowed. Narrowing throws unless the digits being
  /// dropped are zero: rounding money is the server's job — `composeOrderTotals`
  /// does it once, and a client that rounds again produces a second, different
  /// answer that no invoice agrees with.
  Decimal rescale(int newScale) {
    if (newScale < 0 || newScale > maxScale) {
      throw ArgumentError.value(
        newScale,
        'newScale',
        'scale must be in 0..$maxScale',
      );
    }
    if (newScale == scale) return this;
    if (newScale > scale) {
      return Decimal._(units * _pow10(newScale - scale), newScale);
    }
    final divisor = _pow10(scale - newScale);
    final quotient = units ~/ divisor;
    if (quotient * divisor != units) {
      throw StateError(
        'Rescaling $this to $newScale places would drop a non-zero digit. '
        'Rounding money is the server\'s job, not this client\'s.',
      );
    }
    return Decimal._(quotient, newScale);
  }

  BigInt _at(int targetScale) => units * _pow10(targetScale - scale);

  Decimal operator +(Decimal other) {
    final s = scale > other.scale ? scale : other.scale;
    return Decimal._(_at(s) + other._at(s), s);
  }

  Decimal operator -(Decimal other) {
    final s = scale > other.scale ? scale : other.scale;
    return Decimal._(_at(s) - other._at(s), s);
  }

  Decimal operator -() => Decimal._(-units, scale);

  /// Multiply by a whole number — a quantity, never a rate. There is no
  /// `operator *` taking another [Decimal] because the only decimal multiply
  /// this domain has is a VAT rate, and that one needs a rounding rule the
  /// server owns.
  Decimal timesInt(int factor) => Decimal._(units * BigInt.from(factor), scale);

  /// Drop trailing zeros without changing the value. Two decimals that compare
  /// equal under [compareTo] can have different [scale]s, so equality is
  /// defined on the normalised form.
  Decimal get normalized {
    if (units == BigInt.zero) return Decimal._(BigInt.zero, 0);
    var u = units;
    var s = scale;
    final ten = BigInt.from(10);
    while (s > 0 && u % ten == BigInt.zero) {
      u = u ~/ ten;
      s -= 1;
    }
    return Decimal._(u, s);
  }

  @override
  int compareTo(Decimal other) {
    final s = scale > other.scale ? scale : other.scale;
    return _at(s).compareTo(other._at(s));
  }

  bool operator <(Decimal other) => compareTo(other) < 0;
  bool operator <=(Decimal other) => compareTo(other) <= 0;
  bool operator >(Decimal other) => compareTo(other) > 0;
  bool operator >=(Decimal other) => compareTo(other) >= 0;

  /// Plain decimal text, with exactly [scale] places. Never exponent notation:
  /// a price is read by a person.
  @override
  String toString() => toFixed(scale);

  /// Decimal text with exactly [places] places. Widening pads with zeros;
  /// narrowing follows [rescale] and refuses to drop a significant digit.
  String toFixed(int places) {
    final scaled = rescale(places);
    final digits = scaled.units.abs().toString().padLeft(places + 1, '0');
    final whole = digits.substring(0, digits.length - places);
    final fraction =
        places == 0 ? '' : '.${digits.substring(digits.length - places)}';
    return '${scaled.isNegative ? '-' : ''}$whole$fraction';
  }

  /// Decimal text with [places] places and thousands separators in the whole
  /// part. Grouping is done on the digit string, so no `double` and no
  /// `NumberFormat` (which takes a `num` and would put us straight back into
  /// binary floating point) is involved.
  String toGrouped(
    int places, {
    String groupSeparator = ',',
    String decimalSeparator = '.',
  }) {
    final plain = toFixed(places);
    final negative = plain.startsWith('-');
    final body = negative ? plain.substring(1) : plain;
    final dot = body.indexOf('.');
    final whole = dot < 0 ? body : body.substring(0, dot);
    final rest = dot < 0 ? '' : decimalSeparator + body.substring(dot + 1);

    final buffer = StringBuffer();
    for (var i = 0; i < whole.length; i++) {
      if (i > 0 && (whole.length - i) % 3 == 0) buffer.write(groupSeparator);
      buffer.write(whole[i]);
    }
    return '${negative ? '-' : ''}$buffer$rest';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! Decimal) return false;
    final a = normalized;
    final b = other.normalized;
    return a.units == b.units && a.scale == b.scale;
  }

  @override
  int get hashCode {
    final n = normalized;
    return Object.hash(n.units, n.scale);
  }

  static final List<BigInt> _powers = List<BigInt>.generate(
    maxScale + 1,
    (i) => BigInt.from(10).pow(i),
    growable: false,
  );

  static BigInt _pow10(int exponent) {
    if (exponent < 0) {
      throw ArgumentError.value(exponent, 'exponent', 'must be >= 0');
    }
    return exponent <= maxScale
        ? _powers[exponent]
        : BigInt.from(10).pow(exponent);
  }
}
