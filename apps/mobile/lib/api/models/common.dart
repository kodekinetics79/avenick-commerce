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
/// ONLY [url] IS REQUIRED. The previous contract made the two dimensions
/// required as well, and the reasoning was defensible on paper: a defaulted
/// size is how a grid jumps. In practice it took the whole surface down.
/// `ProductImage` stores `url`, `altEn`, `altAr`, `isPrimary` and `sortOrder`
/// and has no column for `width`, `height` or `blurhash` — so no live response
/// could carry them, and "fails to parse" was not one product image, it was
/// EVERY product image and EVERY brand logo in the pilot catalogue. A model
/// that refuses the only payload the server can send is not strict, it is
/// broken.
///
/// So the dimensions are nullable and the layout question is answered
/// explicitly instead: use [aspectRatio] when it is there — [hasIntrinsicSize]
/// says so — and [aspectRatioOr] with the surface's own ratio token when it is
/// not. What the app must still never do is invent a number and present it as
/// the image's own: null means "the row does not record this", which is a
/// different claim from a square thumbnail.
@freezed
abstract class ImageRef with _$ImageRef {
  const ImageRef._();

  const factory ImageRef({
    required String url,

    /// Intrinsic width in pixels. Null on every row the database has today —
    /// there is no column for it. Not zero, not a guess: absent.
    int? width,

    /// Intrinsic height in pixels. Null on the same terms as [width].
    int? height,

    /// BlurHash from the reference encoder. Absent on older rows.
    String? blurhash,

    /// Alt text in the language the caller asked for. Null when the seller
    /// supplied none — which is a real state, not a missing field.
    String? alt,
  }) = _ImageRef;

  factory ImageRef.fromJson(Map<String, dynamic> json) =>
      _$ImageRefFromJson(json);

  /// True when both dimensions travelled, so a box can be reserved at the
  /// image's OWN proportions rather than at the surface's.
  bool get hasIntrinsicSize => width != null && height != null;

  /// Intrinsic aspect ratio, for a `SizedBox`/`AspectRatio` placeholder, or
  /// null when the dimensions did not travel.
  double? get aspectRatio {
    final int? w = width;
    final int? h = height;
    if (w == null || h == null || h == 0) return null;
    return w / h;
  }

  /// [aspectRatio] when the server sent one, and [fallback] — the surface's
  /// own ratio token — when it did not. This is the call site that avoids a
  /// layout shift without pretending to know the picture's shape.
  double aspectRatioOr(double fallback) => aspectRatio ?? fallback;
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
