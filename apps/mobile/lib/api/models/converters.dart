import 'package:json_annotation/json_annotation.dart';

import 'decimal.dart';

/// Reads a money/rate field as an exact [Decimal] instead of a `double`.
///
/// Applied per field with `@DecimalConverter()` rather than globally, so a
/// reviewer can see at the field which numbers are exact and which (a rating
/// average, a weight, a latitude) are genuinely approximate quantities where a
/// `double` is the right type.
class DecimalConverter implements JsonConverter<Decimal, Object> {
  const DecimalConverter();

  @override
  Decimal fromJson(Object json) => Decimal.fromJson(json);

  @override
  Object toJson(Decimal object) => object.toJson();
}

class NullableDecimalConverter implements JsonConverter<Decimal?, Object?> {
  const NullableDecimalConverter();

  @override
  Decimal? fromJson(Object? json) => Decimal.fromJsonNullable(json);

  @override
  Object? toJson(Decimal? object) => object?.toJson();
}

/// ISO-8601 with an offset, as `TimestampSchema` mints it. Parsed to UTC so
/// two instants from different responses are always comparable.
class UtcDateTimeConverter implements JsonConverter<DateTime, String> {
  const UtcDateTimeConverter();

  @override
  DateTime fromJson(String json) => DateTime.parse(json).toUtc();

  @override
  String toJson(DateTime object) => object.toUtc().toIso8601String();
}

class NullableUtcDateTimeConverter
    implements JsonConverter<DateTime?, String?> {
  const NullableUtcDateTimeConverter();

  @override
  DateTime? fromJson(String? json) =>
      json == null ? null : DateTime.parse(json).toUtc();

  @override
  String? toJson(DateTime? object) => object?.toUtc().toIso8601String();
}
