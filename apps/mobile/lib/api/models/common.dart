import 'package:freezed_annotation/freezed_annotation.dart';

import 'enums.dart';

part 'common.freezed.dart';
part 'common.g.dart';

/// An image, described rather than named.
///
/// A bare URL forces the app to guess an aspect ratio, which is what makes a
/// grid reflow as thumbnails arrive on a slow connection. [width] and [height]
/// let Flutter reserve the box before the bytes land, and [blurhash] gives it
/// something to draw meanwhile.
///
/// BACKEND NOTE, carried over from `primitives.ts`: `ProductImage` stores only
/// `url`, `altEn`, `altAr`, `isPrimary` and `sortOrder` today. `width`,
/// `height` and `blurhash` have no column yet, so a live server cannot fill
/// them. They are required in the contract, which means the first real
/// response either carries them or fails to parse — that is the intended
/// outcome, not a surprise: silently defaulting a size is how you get a grid
/// that jumps.
@freezed
abstract class ImageRef with _$ImageRef {
  const ImageRef._();

  const factory ImageRef({
    required String url,
    required int width,
    required int height,

    /// BlurHash from the reference encoder. Absent on older rows.
    String? blurhash,

    /// Alt text in the language the caller asked for. Null when the seller
    /// supplied none — which is a real state, not a missing field.
    String? alt,
  }) = _ImageRef;

  factory ImageRef.fromJson(Map<String, dynamic> json) =>
      _$ImageRefFromJson(json);

  /// Intrinsic aspect ratio, for a `SizedBox`/`AspectRatio` placeholder.
  double get aspectRatio => height == 0 ? 1 : width / height;
}

/// Cursor pagination metadata: `{ cursor, hasMore }`, and deliberately no
/// total. See `envelope.ts` — `/api/products` runs an unbounded `count()`
/// beside every page query against the pool checkout transactions share, and a
/// scrolling list needs "is there more", which [hasMore] answers for free.
///
/// [cursor] is opaque. Echo it back as `?cursor=` byte for byte; it is null on
/// the last page.
@freezed
abstract class PageMeta with _$PageMeta {
  const PageMeta._();

  const factory PageMeta({
    required String? cursor,
    required bool hasMore,
  }) = _PageMeta;

  factory PageMeta.fromJson(Map<String, dynamic> json) =>
      _$PageMetaFromJson(json);

  /// The last page of a list: `hasMore` is false and there is no cursor.
  static const PageMeta end = PageMeta(cursor: null, hasMore: false);

  /// A cursor is only usable when the server says there is more behind it.
  String? get nextCursor => hasMore ? cursor : null;
}

/// The wire shape of a failure. This is the payload; the *typed* failure the
/// rest of the app catches is `ApiFailure` in `lib/core/error`.
@freezed
abstract class ApiError with _$ApiError {
  const ApiError._();

  const factory ApiError({
    /// The machine-readable code. Branch on this, never on [message].
    required ApiErrorCode code,

    /// Human-readable and safe to show, but NOT a stable identifier.
    required String message,

    /// The server-assigned id for this exact request. Required, not optional:
    /// a support conversation that starts with "it failed" and cannot name the
    /// request is a conversation with no evidence in it.
    required String requestId,

    /// Per-field detail keyed by the dotted path into the request body —
    /// `items.2.quantity`, `shippingAddress.country`. Present only with
    /// `validation_failed`; omitted entirely otherwise, so an empty map is
    /// never sent as a claim that nothing is wrong.
    Map<String, List<String>>? fieldErrors,
  }) = _ApiError;

  factory ApiError.fromJson(Map<String, dynamic> json) =>
      _$ApiErrorFromJson(json);
}

@freezed
abstract class ErrorEnvelope with _$ErrorEnvelope {
  const ErrorEnvelope._();

  const factory ErrorEnvelope({required ApiError error}) = _ErrorEnvelope;

  factory ErrorEnvelope.fromJson(Map<String, dynamic> json) =>
      _$ErrorEnvelopeFromJson(json);
}
