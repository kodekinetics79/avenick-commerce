// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'common.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$ImageRef {
  String get url;

  /// Intrinsic width in pixels. Null on every row the database has today —
  /// there is no column for it. Not zero, not a guess: absent.
  int? get width;

  /// Intrinsic height in pixels. Null on the same terms as [width].
  int? get height;

  /// BlurHash from the reference encoder. Absent on older rows.
  String? get blurhash;

  /// Alt text in the language the caller asked for. Null when the seller
  /// supplied none — which is a real state, not a missing field.
  String? get alt;

  /// Create a copy of ImageRef
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $ImageRefCopyWith<ImageRef> get copyWith =>
      _$ImageRefCopyWithImpl<ImageRef>(this as ImageRef, _$identity);

  /// Serializes this ImageRef to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is ImageRef &&
            (identical(other.url, url) || other.url == url) &&
            (identical(other.width, width) || other.width == width) &&
            (identical(other.height, height) || other.height == height) &&
            (identical(other.blurhash, blurhash) ||
                other.blurhash == blurhash) &&
            (identical(other.alt, alt) || other.alt == alt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, url, width, height, blurhash, alt);

  @override
  String toString() {
    return 'ImageRef(url: $url, width: $width, height: $height, blurhash: $blurhash, alt: $alt)';
  }
}

/// @nodoc
abstract mixin class $ImageRefCopyWith<$Res> {
  factory $ImageRefCopyWith(ImageRef value, $Res Function(ImageRef) _then) =
      _$ImageRefCopyWithImpl;
  @useResult
  $Res call(
      {String url, int? width, int? height, String? blurhash, String? alt});
}

/// @nodoc
class _$ImageRefCopyWithImpl<$Res> implements $ImageRefCopyWith<$Res> {
  _$ImageRefCopyWithImpl(this._self, this._then);

  final ImageRef _self;
  final $Res Function(ImageRef) _then;

  /// Create a copy of ImageRef
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? url = null,
    Object? width = freezed,
    Object? height = freezed,
    Object? blurhash = freezed,
    Object? alt = freezed,
  }) {
    return _then(_self.copyWith(
      url: null == url
          ? _self.url
          : url // ignore: cast_nullable_to_non_nullable
              as String,
      width: freezed == width
          ? _self.width
          : width // ignore: cast_nullable_to_non_nullable
              as int?,
      height: freezed == height
          ? _self.height
          : height // ignore: cast_nullable_to_non_nullable
              as int?,
      blurhash: freezed == blurhash
          ? _self.blurhash
          : blurhash // ignore: cast_nullable_to_non_nullable
              as String?,
      alt: freezed == alt
          ? _self.alt
          : alt // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// Adds pattern-matching-related methods to [ImageRef].
extension ImageRefPatterns on ImageRef {
  /// A variant of `map` that fallback to returning `orElse`.
  ///
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case final Subclass value:
  ///     return ...;
  ///   case _:
  ///     return orElse();
  /// }
  /// ```

  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>(
    TResult Function(_ImageRef value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _ImageRef() when $default != null:
        return $default(_that);
      case _:
        return orElse();
    }
  }

  /// A `switch`-like method, using callbacks.
  ///
  /// Callbacks receives the raw object, upcasted.
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case final Subclass value:
  ///     return ...;
  ///   case final Subclass2 value:
  ///     return ...;
  /// }
  /// ```

  @optionalTypeArgs
  TResult map<TResult extends Object?>(
    TResult Function(_ImageRef value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ImageRef():
        return $default(_that);
      case _:
        throw StateError('Unexpected subclass');
    }
  }

  /// A variant of `map` that fallback to returning `null`.
  ///
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case final Subclass value:
  ///     return ...;
  ///   case _:
  ///     return null;
  /// }
  /// ```

  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>(
    TResult? Function(_ImageRef value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ImageRef() when $default != null:
        return $default(_that);
      case _:
        return null;
    }
  }

  /// A variant of `when` that fallback to an `orElse` callback.
  ///
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case Subclass(:final field):
  ///     return ...;
  ///   case _:
  ///     return orElse();
  /// }
  /// ```

  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>(
    TResult Function(
            String url, int? width, int? height, String? blurhash, String? alt)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _ImageRef() when $default != null:
        return $default(
            _that.url, _that.width, _that.height, _that.blurhash, _that.alt);
      case _:
        return orElse();
    }
  }

  /// A `switch`-like method, using callbacks.
  ///
  /// As opposed to `map`, this offers destructuring.
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case Subclass(:final field):
  ///     return ...;
  ///   case Subclass2(:final field2):
  ///     return ...;
  /// }
  /// ```

  @optionalTypeArgs
  TResult when<TResult extends Object?>(
    TResult Function(
            String url, int? width, int? height, String? blurhash, String? alt)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ImageRef():
        return $default(
            _that.url, _that.width, _that.height, _that.blurhash, _that.alt);
      case _:
        throw StateError('Unexpected subclass');
    }
  }

  /// A variant of `when` that fallback to returning `null`
  ///
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case Subclass(:final field):
  ///     return ...;
  ///   case _:
  ///     return null;
  /// }
  /// ```

  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>(
    TResult? Function(
            String url, int? width, int? height, String? blurhash, String? alt)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ImageRef() when $default != null:
        return $default(
            _that.url, _that.width, _that.height, _that.blurhash, _that.alt);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _ImageRef extends ImageRef {
  const _ImageRef(
      {required this.url, this.width, this.height, this.blurhash, this.alt})
      : super._();
  factory _ImageRef.fromJson(Map<String, dynamic> json) =>
      _$ImageRefFromJson(json);

  @override
  final String url;

  /// Intrinsic width in pixels. Null on every row the database has today —
  /// there is no column for it. Not zero, not a guess: absent.
  @override
  final int? width;

  /// Intrinsic height in pixels. Null on the same terms as [width].
  @override
  final int? height;

  /// BlurHash from the reference encoder. Absent on older rows.
  @override
  final String? blurhash;

  /// Alt text in the language the caller asked for. Null when the seller
  /// supplied none — which is a real state, not a missing field.
  @override
  final String? alt;

  /// Create a copy of ImageRef
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$ImageRefCopyWith<_ImageRef> get copyWith =>
      __$ImageRefCopyWithImpl<_ImageRef>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$ImageRefToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _ImageRef &&
            (identical(other.url, url) || other.url == url) &&
            (identical(other.width, width) || other.width == width) &&
            (identical(other.height, height) || other.height == height) &&
            (identical(other.blurhash, blurhash) ||
                other.blurhash == blurhash) &&
            (identical(other.alt, alt) || other.alt == alt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, url, width, height, blurhash, alt);

  @override
  String toString() {
    return 'ImageRef(url: $url, width: $width, height: $height, blurhash: $blurhash, alt: $alt)';
  }
}

/// @nodoc
abstract mixin class _$ImageRefCopyWith<$Res>
    implements $ImageRefCopyWith<$Res> {
  factory _$ImageRefCopyWith(_ImageRef value, $Res Function(_ImageRef) _then) =
      __$ImageRefCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String url, int? width, int? height, String? blurhash, String? alt});
}

/// @nodoc
class __$ImageRefCopyWithImpl<$Res> implements _$ImageRefCopyWith<$Res> {
  __$ImageRefCopyWithImpl(this._self, this._then);

  final _ImageRef _self;
  final $Res Function(_ImageRef) _then;

  /// Create a copy of ImageRef
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? url = null,
    Object? width = freezed,
    Object? height = freezed,
    Object? blurhash = freezed,
    Object? alt = freezed,
  }) {
    return _then(_ImageRef(
      url: null == url
          ? _self.url
          : url // ignore: cast_nullable_to_non_nullable
              as String,
      width: freezed == width
          ? _self.width
          : width // ignore: cast_nullable_to_non_nullable
              as int?,
      height: freezed == height
          ? _self.height
          : height // ignore: cast_nullable_to_non_nullable
              as int?,
      blurhash: freezed == blurhash
          ? _self.blurhash
          : blurhash // ignore: cast_nullable_to_non_nullable
              as String?,
      alt: freezed == alt
          ? _self.alt
          : alt // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
mixin _$PageMeta {
  String? get cursor;
  bool get hasMore;

  /// Create a copy of PageMeta
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $PageMetaCopyWith<PageMeta> get copyWith =>
      _$PageMetaCopyWithImpl<PageMeta>(this as PageMeta, _$identity);

  /// Serializes this PageMeta to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is PageMeta &&
            (identical(other.cursor, cursor) || other.cursor == cursor) &&
            (identical(other.hasMore, hasMore) || other.hasMore == hasMore));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, cursor, hasMore);

  @override
  String toString() {
    return 'PageMeta(cursor: $cursor, hasMore: $hasMore)';
  }
}

/// @nodoc
abstract mixin class $PageMetaCopyWith<$Res> {
  factory $PageMetaCopyWith(PageMeta value, $Res Function(PageMeta) _then) =
      _$PageMetaCopyWithImpl;
  @useResult
  $Res call({String? cursor, bool hasMore});
}

/// @nodoc
class _$PageMetaCopyWithImpl<$Res> implements $PageMetaCopyWith<$Res> {
  _$PageMetaCopyWithImpl(this._self, this._then);

  final PageMeta _self;
  final $Res Function(PageMeta) _then;

  /// Create a copy of PageMeta
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? cursor = freezed,
    Object? hasMore = null,
  }) {
    return _then(_self.copyWith(
      cursor: freezed == cursor
          ? _self.cursor
          : cursor // ignore: cast_nullable_to_non_nullable
              as String?,
      hasMore: null == hasMore
          ? _self.hasMore
          : hasMore // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// Adds pattern-matching-related methods to [PageMeta].
extension PageMetaPatterns on PageMeta {
  /// A variant of `map` that fallback to returning `orElse`.
  ///
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case final Subclass value:
  ///     return ...;
  ///   case _:
  ///     return orElse();
  /// }
  /// ```

  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>(
    TResult Function(_PageMeta value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _PageMeta() when $default != null:
        return $default(_that);
      case _:
        return orElse();
    }
  }

  /// A `switch`-like method, using callbacks.
  ///
  /// Callbacks receives the raw object, upcasted.
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case final Subclass value:
  ///     return ...;
  ///   case final Subclass2 value:
  ///     return ...;
  /// }
  /// ```

  @optionalTypeArgs
  TResult map<TResult extends Object?>(
    TResult Function(_PageMeta value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _PageMeta():
        return $default(_that);
      case _:
        throw StateError('Unexpected subclass');
    }
  }

  /// A variant of `map` that fallback to returning `null`.
  ///
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case final Subclass value:
  ///     return ...;
  ///   case _:
  ///     return null;
  /// }
  /// ```

  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>(
    TResult? Function(_PageMeta value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _PageMeta() when $default != null:
        return $default(_that);
      case _:
        return null;
    }
  }

  /// A variant of `when` that fallback to an `orElse` callback.
  ///
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case Subclass(:final field):
  ///     return ...;
  ///   case _:
  ///     return orElse();
  /// }
  /// ```

  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>(
    TResult Function(String? cursor, bool hasMore)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _PageMeta() when $default != null:
        return $default(_that.cursor, _that.hasMore);
      case _:
        return orElse();
    }
  }

  /// A `switch`-like method, using callbacks.
  ///
  /// As opposed to `map`, this offers destructuring.
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case Subclass(:final field):
  ///     return ...;
  ///   case Subclass2(:final field2):
  ///     return ...;
  /// }
  /// ```

  @optionalTypeArgs
  TResult when<TResult extends Object?>(
    TResult Function(String? cursor, bool hasMore) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _PageMeta():
        return $default(_that.cursor, _that.hasMore);
      case _:
        throw StateError('Unexpected subclass');
    }
  }

  /// A variant of `when` that fallback to returning `null`
  ///
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case Subclass(:final field):
  ///     return ...;
  ///   case _:
  ///     return null;
  /// }
  /// ```

  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>(
    TResult? Function(String? cursor, bool hasMore)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _PageMeta() when $default != null:
        return $default(_that.cursor, _that.hasMore);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _PageMeta extends PageMeta {
  const _PageMeta({required this.cursor, required this.hasMore}) : super._();
  factory _PageMeta.fromJson(Map<String, dynamic> json) =>
      _$PageMetaFromJson(json);

  @override
  final String? cursor;
  @override
  final bool hasMore;

  /// Create a copy of PageMeta
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$PageMetaCopyWith<_PageMeta> get copyWith =>
      __$PageMetaCopyWithImpl<_PageMeta>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$PageMetaToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _PageMeta &&
            (identical(other.cursor, cursor) || other.cursor == cursor) &&
            (identical(other.hasMore, hasMore) || other.hasMore == hasMore));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, cursor, hasMore);

  @override
  String toString() {
    return 'PageMeta(cursor: $cursor, hasMore: $hasMore)';
  }
}

/// @nodoc
abstract mixin class _$PageMetaCopyWith<$Res>
    implements $PageMetaCopyWith<$Res> {
  factory _$PageMetaCopyWith(_PageMeta value, $Res Function(_PageMeta) _then) =
      __$PageMetaCopyWithImpl;
  @override
  @useResult
  $Res call({String? cursor, bool hasMore});
}

/// @nodoc
class __$PageMetaCopyWithImpl<$Res> implements _$PageMetaCopyWith<$Res> {
  __$PageMetaCopyWithImpl(this._self, this._then);

  final _PageMeta _self;
  final $Res Function(_PageMeta) _then;

  /// Create a copy of PageMeta
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? cursor = freezed,
    Object? hasMore = null,
  }) {
    return _then(_PageMeta(
      cursor: freezed == cursor
          ? _self.cursor
          : cursor // ignore: cast_nullable_to_non_nullable
              as String?,
      hasMore: null == hasMore
          ? _self.hasMore
          : hasMore // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
mixin _$ApiError {
  /// The machine-readable code. Branch on this, never on [message].
  ApiErrorCode get code;

  /// Human-readable and safe to show, but NOT a stable identifier.
  String get message;

  /// The server-assigned id for this exact request. Required, not optional:
  /// a support conversation that starts with "it failed" and cannot name the
  /// request is a conversation with no evidence in it.
  String get requestId;

  /// Per-field detail keyed by the dotted path into the request body —
  /// `items.2.quantity`, `shippingAddress.country`. Present only with
  /// `validation_failed`; omitted entirely otherwise, so an empty map is
  /// never sent as a claim that nothing is wrong.
  Map<String, List<String>>? get fieldErrors;

  /// Create a copy of ApiError
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $ApiErrorCopyWith<ApiError> get copyWith =>
      _$ApiErrorCopyWithImpl<ApiError>(this as ApiError, _$identity);

  /// Serializes this ApiError to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is ApiError &&
            (identical(other.code, code) || other.code == code) &&
            (identical(other.message, message) || other.message == message) &&
            (identical(other.requestId, requestId) ||
                other.requestId == requestId) &&
            const DeepCollectionEquality()
                .equals(other.fieldErrors, fieldErrors));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, code, message, requestId,
      const DeepCollectionEquality().hash(fieldErrors));

  @override
  String toString() {
    return 'ApiError(code: $code, message: $message, requestId: $requestId, fieldErrors: $fieldErrors)';
  }
}

/// @nodoc
abstract mixin class $ApiErrorCopyWith<$Res> {
  factory $ApiErrorCopyWith(ApiError value, $Res Function(ApiError) _then) =
      _$ApiErrorCopyWithImpl;
  @useResult
  $Res call(
      {ApiErrorCode code,
      String message,
      String requestId,
      Map<String, List<String>>? fieldErrors});
}

/// @nodoc
class _$ApiErrorCopyWithImpl<$Res> implements $ApiErrorCopyWith<$Res> {
  _$ApiErrorCopyWithImpl(this._self, this._then);

  final ApiError _self;
  final $Res Function(ApiError) _then;

  /// Create a copy of ApiError
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? code = null,
    Object? message = null,
    Object? requestId = null,
    Object? fieldErrors = freezed,
  }) {
    return _then(_self.copyWith(
      code: null == code
          ? _self.code
          : code // ignore: cast_nullable_to_non_nullable
              as ApiErrorCode,
      message: null == message
          ? _self.message
          : message // ignore: cast_nullable_to_non_nullable
              as String,
      requestId: null == requestId
          ? _self.requestId
          : requestId // ignore: cast_nullable_to_non_nullable
              as String,
      fieldErrors: freezed == fieldErrors
          ? _self.fieldErrors
          : fieldErrors // ignore: cast_nullable_to_non_nullable
              as Map<String, List<String>>?,
    ));
  }
}

/// Adds pattern-matching-related methods to [ApiError].
extension ApiErrorPatterns on ApiError {
  /// A variant of `map` that fallback to returning `orElse`.
  ///
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case final Subclass value:
  ///     return ...;
  ///   case _:
  ///     return orElse();
  /// }
  /// ```

  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>(
    TResult Function(_ApiError value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _ApiError() when $default != null:
        return $default(_that);
      case _:
        return orElse();
    }
  }

  /// A `switch`-like method, using callbacks.
  ///
  /// Callbacks receives the raw object, upcasted.
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case final Subclass value:
  ///     return ...;
  ///   case final Subclass2 value:
  ///     return ...;
  /// }
  /// ```

  @optionalTypeArgs
  TResult map<TResult extends Object?>(
    TResult Function(_ApiError value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ApiError():
        return $default(_that);
      case _:
        throw StateError('Unexpected subclass');
    }
  }

  /// A variant of `map` that fallback to returning `null`.
  ///
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case final Subclass value:
  ///     return ...;
  ///   case _:
  ///     return null;
  /// }
  /// ```

  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>(
    TResult? Function(_ApiError value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ApiError() when $default != null:
        return $default(_that);
      case _:
        return null;
    }
  }

  /// A variant of `when` that fallback to an `orElse` callback.
  ///
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case Subclass(:final field):
  ///     return ...;
  ///   case _:
  ///     return orElse();
  /// }
  /// ```

  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>(
    TResult Function(ApiErrorCode code, String message, String requestId,
            Map<String, List<String>>? fieldErrors)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _ApiError() when $default != null:
        return $default(
            _that.code, _that.message, _that.requestId, _that.fieldErrors);
      case _:
        return orElse();
    }
  }

  /// A `switch`-like method, using callbacks.
  ///
  /// As opposed to `map`, this offers destructuring.
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case Subclass(:final field):
  ///     return ...;
  ///   case Subclass2(:final field2):
  ///     return ...;
  /// }
  /// ```

  @optionalTypeArgs
  TResult when<TResult extends Object?>(
    TResult Function(ApiErrorCode code, String message, String requestId,
            Map<String, List<String>>? fieldErrors)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ApiError():
        return $default(
            _that.code, _that.message, _that.requestId, _that.fieldErrors);
      case _:
        throw StateError('Unexpected subclass');
    }
  }

  /// A variant of `when` that fallback to returning `null`
  ///
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case Subclass(:final field):
  ///     return ...;
  ///   case _:
  ///     return null;
  /// }
  /// ```

  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>(
    TResult? Function(ApiErrorCode code, String message, String requestId,
            Map<String, List<String>>? fieldErrors)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ApiError() when $default != null:
        return $default(
            _that.code, _that.message, _that.requestId, _that.fieldErrors);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _ApiError extends ApiError {
  const _ApiError(
      {required this.code,
      required this.message,
      required this.requestId,
      final Map<String, List<String>>? fieldErrors})
      : _fieldErrors = fieldErrors,
        super._();
  factory _ApiError.fromJson(Map<String, dynamic> json) =>
      _$ApiErrorFromJson(json);

  /// The machine-readable code. Branch on this, never on [message].
  @override
  final ApiErrorCode code;

  /// Human-readable and safe to show, but NOT a stable identifier.
  @override
  final String message;

  /// The server-assigned id for this exact request. Required, not optional:
  /// a support conversation that starts with "it failed" and cannot name the
  /// request is a conversation with no evidence in it.
  @override
  final String requestId;

  /// Per-field detail keyed by the dotted path into the request body —
  /// `items.2.quantity`, `shippingAddress.country`. Present only with
  /// `validation_failed`; omitted entirely otherwise, so an empty map is
  /// never sent as a claim that nothing is wrong.
  final Map<String, List<String>>? _fieldErrors;

  /// Per-field detail keyed by the dotted path into the request body —
  /// `items.2.quantity`, `shippingAddress.country`. Present only with
  /// `validation_failed`; omitted entirely otherwise, so an empty map is
  /// never sent as a claim that nothing is wrong.
  @override
  Map<String, List<String>>? get fieldErrors {
    final value = _fieldErrors;
    if (value == null) return null;
    if (_fieldErrors is EqualUnmodifiableMapView) return _fieldErrors;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  /// Create a copy of ApiError
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$ApiErrorCopyWith<_ApiError> get copyWith =>
      __$ApiErrorCopyWithImpl<_ApiError>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$ApiErrorToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _ApiError &&
            (identical(other.code, code) || other.code == code) &&
            (identical(other.message, message) || other.message == message) &&
            (identical(other.requestId, requestId) ||
                other.requestId == requestId) &&
            const DeepCollectionEquality()
                .equals(other._fieldErrors, _fieldErrors));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, code, message, requestId,
      const DeepCollectionEquality().hash(_fieldErrors));

  @override
  String toString() {
    return 'ApiError(code: $code, message: $message, requestId: $requestId, fieldErrors: $fieldErrors)';
  }
}

/// @nodoc
abstract mixin class _$ApiErrorCopyWith<$Res>
    implements $ApiErrorCopyWith<$Res> {
  factory _$ApiErrorCopyWith(_ApiError value, $Res Function(_ApiError) _then) =
      __$ApiErrorCopyWithImpl;
  @override
  @useResult
  $Res call(
      {ApiErrorCode code,
      String message,
      String requestId,
      Map<String, List<String>>? fieldErrors});
}

/// @nodoc
class __$ApiErrorCopyWithImpl<$Res> implements _$ApiErrorCopyWith<$Res> {
  __$ApiErrorCopyWithImpl(this._self, this._then);

  final _ApiError _self;
  final $Res Function(_ApiError) _then;

  /// Create a copy of ApiError
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? code = null,
    Object? message = null,
    Object? requestId = null,
    Object? fieldErrors = freezed,
  }) {
    return _then(_ApiError(
      code: null == code
          ? _self.code
          : code // ignore: cast_nullable_to_non_nullable
              as ApiErrorCode,
      message: null == message
          ? _self.message
          : message // ignore: cast_nullable_to_non_nullable
              as String,
      requestId: null == requestId
          ? _self.requestId
          : requestId // ignore: cast_nullable_to_non_nullable
              as String,
      fieldErrors: freezed == fieldErrors
          ? _self._fieldErrors
          : fieldErrors // ignore: cast_nullable_to_non_nullable
              as Map<String, List<String>>?,
    ));
  }
}

/// @nodoc
mixin _$ErrorEnvelope {
  ApiError get error;

  /// Create a copy of ErrorEnvelope
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $ErrorEnvelopeCopyWith<ErrorEnvelope> get copyWith =>
      _$ErrorEnvelopeCopyWithImpl<ErrorEnvelope>(
          this as ErrorEnvelope, _$identity);

  /// Serializes this ErrorEnvelope to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is ErrorEnvelope &&
            (identical(other.error, error) || other.error == error));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, error);

  @override
  String toString() {
    return 'ErrorEnvelope(error: $error)';
  }
}

/// @nodoc
abstract mixin class $ErrorEnvelopeCopyWith<$Res> {
  factory $ErrorEnvelopeCopyWith(
          ErrorEnvelope value, $Res Function(ErrorEnvelope) _then) =
      _$ErrorEnvelopeCopyWithImpl;
  @useResult
  $Res call({ApiError error});

  $ApiErrorCopyWith<$Res> get error;
}

/// @nodoc
class _$ErrorEnvelopeCopyWithImpl<$Res>
    implements $ErrorEnvelopeCopyWith<$Res> {
  _$ErrorEnvelopeCopyWithImpl(this._self, this._then);

  final ErrorEnvelope _self;
  final $Res Function(ErrorEnvelope) _then;

  /// Create a copy of ErrorEnvelope
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? error = null,
  }) {
    return _then(_self.copyWith(
      error: null == error
          ? _self.error
          : error // ignore: cast_nullable_to_non_nullable
              as ApiError,
    ));
  }

  /// Create a copy of ErrorEnvelope
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ApiErrorCopyWith<$Res> get error {
    return $ApiErrorCopyWith<$Res>(_self.error, (value) {
      return _then(_self.copyWith(error: value));
    });
  }
}

/// Adds pattern-matching-related methods to [ErrorEnvelope].
extension ErrorEnvelopePatterns on ErrorEnvelope {
  /// A variant of `map` that fallback to returning `orElse`.
  ///
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case final Subclass value:
  ///     return ...;
  ///   case _:
  ///     return orElse();
  /// }
  /// ```

  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>(
    TResult Function(_ErrorEnvelope value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _ErrorEnvelope() when $default != null:
        return $default(_that);
      case _:
        return orElse();
    }
  }

  /// A `switch`-like method, using callbacks.
  ///
  /// Callbacks receives the raw object, upcasted.
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case final Subclass value:
  ///     return ...;
  ///   case final Subclass2 value:
  ///     return ...;
  /// }
  /// ```

  @optionalTypeArgs
  TResult map<TResult extends Object?>(
    TResult Function(_ErrorEnvelope value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ErrorEnvelope():
        return $default(_that);
      case _:
        throw StateError('Unexpected subclass');
    }
  }

  /// A variant of `map` that fallback to returning `null`.
  ///
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case final Subclass value:
  ///     return ...;
  ///   case _:
  ///     return null;
  /// }
  /// ```

  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>(
    TResult? Function(_ErrorEnvelope value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ErrorEnvelope() when $default != null:
        return $default(_that);
      case _:
        return null;
    }
  }

  /// A variant of `when` that fallback to an `orElse` callback.
  ///
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case Subclass(:final field):
  ///     return ...;
  ///   case _:
  ///     return orElse();
  /// }
  /// ```

  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>(
    TResult Function(ApiError error)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _ErrorEnvelope() when $default != null:
        return $default(_that.error);
      case _:
        return orElse();
    }
  }

  /// A `switch`-like method, using callbacks.
  ///
  /// As opposed to `map`, this offers destructuring.
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case Subclass(:final field):
  ///     return ...;
  ///   case Subclass2(:final field2):
  ///     return ...;
  /// }
  /// ```

  @optionalTypeArgs
  TResult when<TResult extends Object?>(
    TResult Function(ApiError error) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ErrorEnvelope():
        return $default(_that.error);
      case _:
        throw StateError('Unexpected subclass');
    }
  }

  /// A variant of `when` that fallback to returning `null`
  ///
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case Subclass(:final field):
  ///     return ...;
  ///   case _:
  ///     return null;
  /// }
  /// ```

  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>(
    TResult? Function(ApiError error)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ErrorEnvelope() when $default != null:
        return $default(_that.error);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _ErrorEnvelope extends ErrorEnvelope {
  const _ErrorEnvelope({required this.error}) : super._();
  factory _ErrorEnvelope.fromJson(Map<String, dynamic> json) =>
      _$ErrorEnvelopeFromJson(json);

  @override
  final ApiError error;

  /// Create a copy of ErrorEnvelope
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$ErrorEnvelopeCopyWith<_ErrorEnvelope> get copyWith =>
      __$ErrorEnvelopeCopyWithImpl<_ErrorEnvelope>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$ErrorEnvelopeToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _ErrorEnvelope &&
            (identical(other.error, error) || other.error == error));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, error);

  @override
  String toString() {
    return 'ErrorEnvelope(error: $error)';
  }
}

/// @nodoc
abstract mixin class _$ErrorEnvelopeCopyWith<$Res>
    implements $ErrorEnvelopeCopyWith<$Res> {
  factory _$ErrorEnvelopeCopyWith(
          _ErrorEnvelope value, $Res Function(_ErrorEnvelope) _then) =
      __$ErrorEnvelopeCopyWithImpl;
  @override
  @useResult
  $Res call({ApiError error});

  @override
  $ApiErrorCopyWith<$Res> get error;
}

/// @nodoc
class __$ErrorEnvelopeCopyWithImpl<$Res>
    implements _$ErrorEnvelopeCopyWith<$Res> {
  __$ErrorEnvelopeCopyWithImpl(this._self, this._then);

  final _ErrorEnvelope _self;
  final $Res Function(_ErrorEnvelope) _then;

  /// Create a copy of ErrorEnvelope
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? error = null,
  }) {
    return _then(_ErrorEnvelope(
      error: null == error
          ? _self.error
          : error // ignore: cast_nullable_to_non_nullable
              as ApiError,
    ));
  }

  /// Create a copy of ErrorEnvelope
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ApiErrorCopyWith<$Res> get error {
    return $ApiErrorCopyWith<$Res>(_self.error, (value) {
      return _then(_self.copyWith(error: value));
    });
  }
}

// dart format on
