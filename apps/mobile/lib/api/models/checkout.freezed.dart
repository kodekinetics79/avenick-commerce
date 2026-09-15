// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'checkout.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$ShippingAddress {
  String get label;
  String get line1;
  String get city;
  Country get country;
  String? get line2;
  String? get postalCode;

  /// Create a copy of ShippingAddress
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $ShippingAddressCopyWith<ShippingAddress> get copyWith =>
      _$ShippingAddressCopyWithImpl<ShippingAddress>(
          this as ShippingAddress, _$identity);

  /// Serializes this ShippingAddress to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is ShippingAddress &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.line1, line1) || other.line1 == line1) &&
            (identical(other.city, city) || other.city == city) &&
            (identical(other.country, country) || other.country == country) &&
            (identical(other.line2, line2) || other.line2 == line2) &&
            (identical(other.postalCode, postalCode) ||
                other.postalCode == postalCode));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, label, line1, city, country, line2, postalCode);

  @override
  String toString() {
    return 'ShippingAddress(label: $label, line1: $line1, city: $city, country: $country, line2: $line2, postalCode: $postalCode)';
  }
}

/// @nodoc
abstract mixin class $ShippingAddressCopyWith<$Res> {
  factory $ShippingAddressCopyWith(
          ShippingAddress value, $Res Function(ShippingAddress) _then) =
      _$ShippingAddressCopyWithImpl;
  @useResult
  $Res call(
      {String label,
      String line1,
      String city,
      Country country,
      String? line2,
      String? postalCode});
}

/// @nodoc
class _$ShippingAddressCopyWithImpl<$Res>
    implements $ShippingAddressCopyWith<$Res> {
  _$ShippingAddressCopyWithImpl(this._self, this._then);

  final ShippingAddress _self;
  final $Res Function(ShippingAddress) _then;

  /// Create a copy of ShippingAddress
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? label = null,
    Object? line1 = null,
    Object? city = null,
    Object? country = null,
    Object? line2 = freezed,
    Object? postalCode = freezed,
  }) {
    return _then(_self.copyWith(
      label: null == label
          ? _self.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      line1: null == line1
          ? _self.line1
          : line1 // ignore: cast_nullable_to_non_nullable
              as String,
      city: null == city
          ? _self.city
          : city // ignore: cast_nullable_to_non_nullable
              as String,
      country: null == country
          ? _self.country
          : country // ignore: cast_nullable_to_non_nullable
              as Country,
      line2: freezed == line2
          ? _self.line2
          : line2 // ignore: cast_nullable_to_non_nullable
              as String?,
      postalCode: freezed == postalCode
          ? _self.postalCode
          : postalCode // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// Adds pattern-matching-related methods to [ShippingAddress].
extension ShippingAddressPatterns on ShippingAddress {
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
    TResult Function(_ShippingAddress value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _ShippingAddress() when $default != null:
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
    TResult Function(_ShippingAddress value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ShippingAddress():
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
    TResult? Function(_ShippingAddress value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ShippingAddress() when $default != null:
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
    TResult Function(String label, String line1, String city, Country country,
            String? line2, String? postalCode)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _ShippingAddress() when $default != null:
        return $default(_that.label, _that.line1, _that.city, _that.country,
            _that.line2, _that.postalCode);
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
    TResult Function(String label, String line1, String city, Country country,
            String? line2, String? postalCode)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ShippingAddress():
        return $default(_that.label, _that.line1, _that.city, _that.country,
            _that.line2, _that.postalCode);
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
    TResult? Function(String label, String line1, String city, Country country,
            String? line2, String? postalCode)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ShippingAddress() when $default != null:
        return $default(_that.label, _that.line1, _that.city, _that.country,
            _that.line2, _that.postalCode);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _ShippingAddress implements ShippingAddress {
  const _ShippingAddress(
      {required this.label,
      required this.line1,
      required this.city,
      required this.country,
      this.line2,
      this.postalCode});
  factory _ShippingAddress.fromJson(Map<String, dynamic> json) =>
      _$ShippingAddressFromJson(json);

  @override
  final String label;
  @override
  final String line1;
  @override
  final String city;
  @override
  final Country country;
  @override
  final String? line2;
  @override
  final String? postalCode;

  /// Create a copy of ShippingAddress
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$ShippingAddressCopyWith<_ShippingAddress> get copyWith =>
      __$ShippingAddressCopyWithImpl<_ShippingAddress>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$ShippingAddressToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _ShippingAddress &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.line1, line1) || other.line1 == line1) &&
            (identical(other.city, city) || other.city == city) &&
            (identical(other.country, country) || other.country == country) &&
            (identical(other.line2, line2) || other.line2 == line2) &&
            (identical(other.postalCode, postalCode) ||
                other.postalCode == postalCode));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, label, line1, city, country, line2, postalCode);

  @override
  String toString() {
    return 'ShippingAddress(label: $label, line1: $line1, city: $city, country: $country, line2: $line2, postalCode: $postalCode)';
  }
}

/// @nodoc
abstract mixin class _$ShippingAddressCopyWith<$Res>
    implements $ShippingAddressCopyWith<$Res> {
  factory _$ShippingAddressCopyWith(
          _ShippingAddress value, $Res Function(_ShippingAddress) _then) =
      __$ShippingAddressCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String label,
      String line1,
      String city,
      Country country,
      String? line2,
      String? postalCode});
}

/// @nodoc
class __$ShippingAddressCopyWithImpl<$Res>
    implements _$ShippingAddressCopyWith<$Res> {
  __$ShippingAddressCopyWithImpl(this._self, this._then);

  final _ShippingAddress _self;
  final $Res Function(_ShippingAddress) _then;

  /// Create a copy of ShippingAddress
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? label = null,
    Object? line1 = null,
    Object? city = null,
    Object? country = null,
    Object? line2 = freezed,
    Object? postalCode = freezed,
  }) {
    return _then(_ShippingAddress(
      label: null == label
          ? _self.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      line1: null == line1
          ? _self.line1
          : line1 // ignore: cast_nullable_to_non_nullable
              as String,
      city: null == city
          ? _self.city
          : city // ignore: cast_nullable_to_non_nullable
              as String,
      country: null == country
          ? _self.country
          : country // ignore: cast_nullable_to_non_nullable
              as Country,
      line2: freezed == line2
          ? _self.line2
          : line2 // ignore: cast_nullable_to_non_nullable
              as String?,
      postalCode: freezed == postalCode
          ? _self.postalCode
          : postalCode // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
mixin _$QuoteLine {
  String get productId;
  String? get variantId;
  String get sellerId;
  String get sku;
  String get nameEn;
  String get nameAr;
  int get quantity;
  @DecimalConverter()
  Decimal get unitPrice;
  @DecimalConverter()
  Decimal get vatRatePercent;
  @DecimalConverter()
  Decimal get vatAmount;
  @DecimalConverter()
  Decimal get lineTotal;

  /// Create a copy of QuoteLine
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $QuoteLineCopyWith<QuoteLine> get copyWith =>
      _$QuoteLineCopyWithImpl<QuoteLine>(this as QuoteLine, _$identity);

  /// Serializes this QuoteLine to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is QuoteLine &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.variantId, variantId) ||
                other.variantId == variantId) &&
            (identical(other.sellerId, sellerId) ||
                other.sellerId == sellerId) &&
            (identical(other.sku, sku) || other.sku == sku) &&
            (identical(other.nameEn, nameEn) || other.nameEn == nameEn) &&
            (identical(other.nameAr, nameAr) || other.nameAr == nameAr) &&
            (identical(other.quantity, quantity) ||
                other.quantity == quantity) &&
            (identical(other.unitPrice, unitPrice) ||
                other.unitPrice == unitPrice) &&
            (identical(other.vatRatePercent, vatRatePercent) ||
                other.vatRatePercent == vatRatePercent) &&
            (identical(other.vatAmount, vatAmount) ||
                other.vatAmount == vatAmount) &&
            (identical(other.lineTotal, lineTotal) ||
                other.lineTotal == lineTotal));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      productId,
      variantId,
      sellerId,
      sku,
      nameEn,
      nameAr,
      quantity,
      unitPrice,
      vatRatePercent,
      vatAmount,
      lineTotal);

  @override
  String toString() {
    return 'QuoteLine(productId: $productId, variantId: $variantId, sellerId: $sellerId, sku: $sku, nameEn: $nameEn, nameAr: $nameAr, quantity: $quantity, unitPrice: $unitPrice, vatRatePercent: $vatRatePercent, vatAmount: $vatAmount, lineTotal: $lineTotal)';
  }
}

/// @nodoc
abstract mixin class $QuoteLineCopyWith<$Res> {
  factory $QuoteLineCopyWith(QuoteLine value, $Res Function(QuoteLine) _then) =
      _$QuoteLineCopyWithImpl;
  @useResult
  $Res call(
      {String productId,
      String? variantId,
      String sellerId,
      String sku,
      String nameEn,
      String nameAr,
      int quantity,
      @DecimalConverter() Decimal unitPrice,
      @DecimalConverter() Decimal vatRatePercent,
      @DecimalConverter() Decimal vatAmount,
      @DecimalConverter() Decimal lineTotal});
}

/// @nodoc
class _$QuoteLineCopyWithImpl<$Res> implements $QuoteLineCopyWith<$Res> {
  _$QuoteLineCopyWithImpl(this._self, this._then);

  final QuoteLine _self;
  final $Res Function(QuoteLine) _then;

  /// Create a copy of QuoteLine
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? productId = null,
    Object? variantId = freezed,
    Object? sellerId = null,
    Object? sku = null,
    Object? nameEn = null,
    Object? nameAr = null,
    Object? quantity = null,
    Object? unitPrice = null,
    Object? vatRatePercent = null,
    Object? vatAmount = null,
    Object? lineTotal = null,
  }) {
    return _then(_self.copyWith(
      productId: null == productId
          ? _self.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      variantId: freezed == variantId
          ? _self.variantId
          : variantId // ignore: cast_nullable_to_non_nullable
              as String?,
      sellerId: null == sellerId
          ? _self.sellerId
          : sellerId // ignore: cast_nullable_to_non_nullable
              as String,
      sku: null == sku
          ? _self.sku
          : sku // ignore: cast_nullable_to_non_nullable
              as String,
      nameEn: null == nameEn
          ? _self.nameEn
          : nameEn // ignore: cast_nullable_to_non_nullable
              as String,
      nameAr: null == nameAr
          ? _self.nameAr
          : nameAr // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _self.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      unitPrice: null == unitPrice
          ? _self.unitPrice
          : unitPrice // ignore: cast_nullable_to_non_nullable
              as Decimal,
      vatRatePercent: null == vatRatePercent
          ? _self.vatRatePercent
          : vatRatePercent // ignore: cast_nullable_to_non_nullable
              as Decimal,
      vatAmount: null == vatAmount
          ? _self.vatAmount
          : vatAmount // ignore: cast_nullable_to_non_nullable
              as Decimal,
      lineTotal: null == lineTotal
          ? _self.lineTotal
          : lineTotal // ignore: cast_nullable_to_non_nullable
              as Decimal,
    ));
  }
}

/// Adds pattern-matching-related methods to [QuoteLine].
extension QuoteLinePatterns on QuoteLine {
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
    TResult Function(_QuoteLine value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _QuoteLine() when $default != null:
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
    TResult Function(_QuoteLine value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _QuoteLine():
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
    TResult? Function(_QuoteLine value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _QuoteLine() when $default != null:
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
            String productId,
            String? variantId,
            String sellerId,
            String sku,
            String nameEn,
            String nameAr,
            int quantity,
            @DecimalConverter() Decimal unitPrice,
            @DecimalConverter() Decimal vatRatePercent,
            @DecimalConverter() Decimal vatAmount,
            @DecimalConverter() Decimal lineTotal)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _QuoteLine() when $default != null:
        return $default(
            _that.productId,
            _that.variantId,
            _that.sellerId,
            _that.sku,
            _that.nameEn,
            _that.nameAr,
            _that.quantity,
            _that.unitPrice,
            _that.vatRatePercent,
            _that.vatAmount,
            _that.lineTotal);
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
            String productId,
            String? variantId,
            String sellerId,
            String sku,
            String nameEn,
            String nameAr,
            int quantity,
            @DecimalConverter() Decimal unitPrice,
            @DecimalConverter() Decimal vatRatePercent,
            @DecimalConverter() Decimal vatAmount,
            @DecimalConverter() Decimal lineTotal)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _QuoteLine():
        return $default(
            _that.productId,
            _that.variantId,
            _that.sellerId,
            _that.sku,
            _that.nameEn,
            _that.nameAr,
            _that.quantity,
            _that.unitPrice,
            _that.vatRatePercent,
            _that.vatAmount,
            _that.lineTotal);
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
            String productId,
            String? variantId,
            String sellerId,
            String sku,
            String nameEn,
            String nameAr,
            int quantity,
            @DecimalConverter() Decimal unitPrice,
            @DecimalConverter() Decimal vatRatePercent,
            @DecimalConverter() Decimal vatAmount,
            @DecimalConverter() Decimal lineTotal)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _QuoteLine() when $default != null:
        return $default(
            _that.productId,
            _that.variantId,
            _that.sellerId,
            _that.sku,
            _that.nameEn,
            _that.nameAr,
            _that.quantity,
            _that.unitPrice,
            _that.vatRatePercent,
            _that.vatAmount,
            _that.lineTotal);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _QuoteLine extends QuoteLine {
  const _QuoteLine(
      {required this.productId,
      required this.variantId,
      required this.sellerId,
      required this.sku,
      required this.nameEn,
      required this.nameAr,
      required this.quantity,
      @DecimalConverter() required this.unitPrice,
      @DecimalConverter() required this.vatRatePercent,
      @DecimalConverter() required this.vatAmount,
      @DecimalConverter() required this.lineTotal})
      : super._();
  factory _QuoteLine.fromJson(Map<String, dynamic> json) =>
      _$QuoteLineFromJson(json);

  @override
  final String productId;
  @override
  final String? variantId;
  @override
  final String sellerId;
  @override
  final String sku;
  @override
  final String nameEn;
  @override
  final String nameAr;
  @override
  final int quantity;
  @override
  @DecimalConverter()
  final Decimal unitPrice;
  @override
  @DecimalConverter()
  final Decimal vatRatePercent;
  @override
  @DecimalConverter()
  final Decimal vatAmount;
  @override
  @DecimalConverter()
  final Decimal lineTotal;

  /// Create a copy of QuoteLine
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$QuoteLineCopyWith<_QuoteLine> get copyWith =>
      __$QuoteLineCopyWithImpl<_QuoteLine>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$QuoteLineToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _QuoteLine &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.variantId, variantId) ||
                other.variantId == variantId) &&
            (identical(other.sellerId, sellerId) ||
                other.sellerId == sellerId) &&
            (identical(other.sku, sku) || other.sku == sku) &&
            (identical(other.nameEn, nameEn) || other.nameEn == nameEn) &&
            (identical(other.nameAr, nameAr) || other.nameAr == nameAr) &&
            (identical(other.quantity, quantity) ||
                other.quantity == quantity) &&
            (identical(other.unitPrice, unitPrice) ||
                other.unitPrice == unitPrice) &&
            (identical(other.vatRatePercent, vatRatePercent) ||
                other.vatRatePercent == vatRatePercent) &&
            (identical(other.vatAmount, vatAmount) ||
                other.vatAmount == vatAmount) &&
            (identical(other.lineTotal, lineTotal) ||
                other.lineTotal == lineTotal));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      productId,
      variantId,
      sellerId,
      sku,
      nameEn,
      nameAr,
      quantity,
      unitPrice,
      vatRatePercent,
      vatAmount,
      lineTotal);

  @override
  String toString() {
    return 'QuoteLine(productId: $productId, variantId: $variantId, sellerId: $sellerId, sku: $sku, nameEn: $nameEn, nameAr: $nameAr, quantity: $quantity, unitPrice: $unitPrice, vatRatePercent: $vatRatePercent, vatAmount: $vatAmount, lineTotal: $lineTotal)';
  }
}

/// @nodoc
abstract mixin class _$QuoteLineCopyWith<$Res>
    implements $QuoteLineCopyWith<$Res> {
  factory _$QuoteLineCopyWith(
          _QuoteLine value, $Res Function(_QuoteLine) _then) =
      __$QuoteLineCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String productId,
      String? variantId,
      String sellerId,
      String sku,
      String nameEn,
      String nameAr,
      int quantity,
      @DecimalConverter() Decimal unitPrice,
      @DecimalConverter() Decimal vatRatePercent,
      @DecimalConverter() Decimal vatAmount,
      @DecimalConverter() Decimal lineTotal});
}

/// @nodoc
class __$QuoteLineCopyWithImpl<$Res> implements _$QuoteLineCopyWith<$Res> {
  __$QuoteLineCopyWithImpl(this._self, this._then);

  final _QuoteLine _self;
  final $Res Function(_QuoteLine) _then;

  /// Create a copy of QuoteLine
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? productId = null,
    Object? variantId = freezed,
    Object? sellerId = null,
    Object? sku = null,
    Object? nameEn = null,
    Object? nameAr = null,
    Object? quantity = null,
    Object? unitPrice = null,
    Object? vatRatePercent = null,
    Object? vatAmount = null,
    Object? lineTotal = null,
  }) {
    return _then(_QuoteLine(
      productId: null == productId
          ? _self.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      variantId: freezed == variantId
          ? _self.variantId
          : variantId // ignore: cast_nullable_to_non_nullable
              as String?,
      sellerId: null == sellerId
          ? _self.sellerId
          : sellerId // ignore: cast_nullable_to_non_nullable
              as String,
      sku: null == sku
          ? _self.sku
          : sku // ignore: cast_nullable_to_non_nullable
              as String,
      nameEn: null == nameEn
          ? _self.nameEn
          : nameEn // ignore: cast_nullable_to_non_nullable
              as String,
      nameAr: null == nameAr
          ? _self.nameAr
          : nameAr // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _self.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      unitPrice: null == unitPrice
          ? _self.unitPrice
          : unitPrice // ignore: cast_nullable_to_non_nullable
              as Decimal,
      vatRatePercent: null == vatRatePercent
          ? _self.vatRatePercent
          : vatRatePercent // ignore: cast_nullable_to_non_nullable
              as Decimal,
      vatAmount: null == vatAmount
          ? _self.vatAmount
          : vatAmount // ignore: cast_nullable_to_non_nullable
              as Decimal,
      lineTotal: null == lineTotal
          ? _self.lineTotal
          : lineTotal // ignore: cast_nullable_to_non_nullable
              as Decimal,
    ));
  }
}

/// @nodoc
mixin _$ShippingQuote {
  ShippingQuoteStatus get status;
  String? get zoneName;
  @DecimalConverter()
  Decimal get amount;
  @DecimalConverter()
  Decimal get vatRatePercent;
  int? get estimatedDaysMin;
  int? get estimatedDaysMax;

  /// Create a copy of ShippingQuote
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $ShippingQuoteCopyWith<ShippingQuote> get copyWith =>
      _$ShippingQuoteCopyWithImpl<ShippingQuote>(
          this as ShippingQuote, _$identity);

  /// Serializes this ShippingQuote to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is ShippingQuote &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.zoneName, zoneName) ||
                other.zoneName == zoneName) &&
            (identical(other.amount, amount) || other.amount == amount) &&
            (identical(other.vatRatePercent, vatRatePercent) ||
                other.vatRatePercent == vatRatePercent) &&
            (identical(other.estimatedDaysMin, estimatedDaysMin) ||
                other.estimatedDaysMin == estimatedDaysMin) &&
            (identical(other.estimatedDaysMax, estimatedDaysMax) ||
                other.estimatedDaysMax == estimatedDaysMax));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, status, zoneName, amount,
      vatRatePercent, estimatedDaysMin, estimatedDaysMax);

  @override
  String toString() {
    return 'ShippingQuote(status: $status, zoneName: $zoneName, amount: $amount, vatRatePercent: $vatRatePercent, estimatedDaysMin: $estimatedDaysMin, estimatedDaysMax: $estimatedDaysMax)';
  }
}

/// @nodoc
abstract mixin class $ShippingQuoteCopyWith<$Res> {
  factory $ShippingQuoteCopyWith(
          ShippingQuote value, $Res Function(ShippingQuote) _then) =
      _$ShippingQuoteCopyWithImpl;
  @useResult
  $Res call(
      {ShippingQuoteStatus status,
      String? zoneName,
      @DecimalConverter() Decimal amount,
      @DecimalConverter() Decimal vatRatePercent,
      int? estimatedDaysMin,
      int? estimatedDaysMax});
}

/// @nodoc
class _$ShippingQuoteCopyWithImpl<$Res>
    implements $ShippingQuoteCopyWith<$Res> {
  _$ShippingQuoteCopyWithImpl(this._self, this._then);

  final ShippingQuote _self;
  final $Res Function(ShippingQuote) _then;

  /// Create a copy of ShippingQuote
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? status = null,
    Object? zoneName = freezed,
    Object? amount = null,
    Object? vatRatePercent = null,
    Object? estimatedDaysMin = freezed,
    Object? estimatedDaysMax = freezed,
  }) {
    return _then(_self.copyWith(
      status: null == status
          ? _self.status
          : status // ignore: cast_nullable_to_non_nullable
              as ShippingQuoteStatus,
      zoneName: freezed == zoneName
          ? _self.zoneName
          : zoneName // ignore: cast_nullable_to_non_nullable
              as String?,
      amount: null == amount
          ? _self.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as Decimal,
      vatRatePercent: null == vatRatePercent
          ? _self.vatRatePercent
          : vatRatePercent // ignore: cast_nullable_to_non_nullable
              as Decimal,
      estimatedDaysMin: freezed == estimatedDaysMin
          ? _self.estimatedDaysMin
          : estimatedDaysMin // ignore: cast_nullable_to_non_nullable
              as int?,
      estimatedDaysMax: freezed == estimatedDaysMax
          ? _self.estimatedDaysMax
          : estimatedDaysMax // ignore: cast_nullable_to_non_nullable
              as int?,
    ));
  }
}

/// Adds pattern-matching-related methods to [ShippingQuote].
extension ShippingQuotePatterns on ShippingQuote {
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
    TResult Function(_ShippingQuote value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _ShippingQuote() when $default != null:
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
    TResult Function(_ShippingQuote value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ShippingQuote():
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
    TResult? Function(_ShippingQuote value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ShippingQuote() when $default != null:
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
            ShippingQuoteStatus status,
            String? zoneName,
            @DecimalConverter() Decimal amount,
            @DecimalConverter() Decimal vatRatePercent,
            int? estimatedDaysMin,
            int? estimatedDaysMax)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _ShippingQuote() when $default != null:
        return $default(
            _that.status,
            _that.zoneName,
            _that.amount,
            _that.vatRatePercent,
            _that.estimatedDaysMin,
            _that.estimatedDaysMax);
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
            ShippingQuoteStatus status,
            String? zoneName,
            @DecimalConverter() Decimal amount,
            @DecimalConverter() Decimal vatRatePercent,
            int? estimatedDaysMin,
            int? estimatedDaysMax)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ShippingQuote():
        return $default(
            _that.status,
            _that.zoneName,
            _that.amount,
            _that.vatRatePercent,
            _that.estimatedDaysMin,
            _that.estimatedDaysMax);
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
            ShippingQuoteStatus status,
            String? zoneName,
            @DecimalConverter() Decimal amount,
            @DecimalConverter() Decimal vatRatePercent,
            int? estimatedDaysMin,
            int? estimatedDaysMax)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ShippingQuote() when $default != null:
        return $default(
            _that.status,
            _that.zoneName,
            _that.amount,
            _that.vatRatePercent,
            _that.estimatedDaysMin,
            _that.estimatedDaysMax);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _ShippingQuote extends ShippingQuote {
  const _ShippingQuote(
      {required this.status,
      required this.zoneName,
      @DecimalConverter() required this.amount,
      @DecimalConverter() required this.vatRatePercent,
      required this.estimatedDaysMin,
      required this.estimatedDaysMax})
      : super._();
  factory _ShippingQuote.fromJson(Map<String, dynamic> json) =>
      _$ShippingQuoteFromJson(json);

  @override
  final ShippingQuoteStatus status;
  @override
  final String? zoneName;
  @override
  @DecimalConverter()
  final Decimal amount;
  @override
  @DecimalConverter()
  final Decimal vatRatePercent;
  @override
  final int? estimatedDaysMin;
  @override
  final int? estimatedDaysMax;

  /// Create a copy of ShippingQuote
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$ShippingQuoteCopyWith<_ShippingQuote> get copyWith =>
      __$ShippingQuoteCopyWithImpl<_ShippingQuote>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$ShippingQuoteToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _ShippingQuote &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.zoneName, zoneName) ||
                other.zoneName == zoneName) &&
            (identical(other.amount, amount) || other.amount == amount) &&
            (identical(other.vatRatePercent, vatRatePercent) ||
                other.vatRatePercent == vatRatePercent) &&
            (identical(other.estimatedDaysMin, estimatedDaysMin) ||
                other.estimatedDaysMin == estimatedDaysMin) &&
            (identical(other.estimatedDaysMax, estimatedDaysMax) ||
                other.estimatedDaysMax == estimatedDaysMax));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, status, zoneName, amount,
      vatRatePercent, estimatedDaysMin, estimatedDaysMax);

  @override
  String toString() {
    return 'ShippingQuote(status: $status, zoneName: $zoneName, amount: $amount, vatRatePercent: $vatRatePercent, estimatedDaysMin: $estimatedDaysMin, estimatedDaysMax: $estimatedDaysMax)';
  }
}

/// @nodoc
abstract mixin class _$ShippingQuoteCopyWith<$Res>
    implements $ShippingQuoteCopyWith<$Res> {
  factory _$ShippingQuoteCopyWith(
          _ShippingQuote value, $Res Function(_ShippingQuote) _then) =
      __$ShippingQuoteCopyWithImpl;
  @override
  @useResult
  $Res call(
      {ShippingQuoteStatus status,
      String? zoneName,
      @DecimalConverter() Decimal amount,
      @DecimalConverter() Decimal vatRatePercent,
      int? estimatedDaysMin,
      int? estimatedDaysMax});
}

/// @nodoc
class __$ShippingQuoteCopyWithImpl<$Res>
    implements _$ShippingQuoteCopyWith<$Res> {
  __$ShippingQuoteCopyWithImpl(this._self, this._then);

  final _ShippingQuote _self;
  final $Res Function(_ShippingQuote) _then;

  /// Create a copy of ShippingQuote
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? status = null,
    Object? zoneName = freezed,
    Object? amount = null,
    Object? vatRatePercent = null,
    Object? estimatedDaysMin = freezed,
    Object? estimatedDaysMax = freezed,
  }) {
    return _then(_ShippingQuote(
      status: null == status
          ? _self.status
          : status // ignore: cast_nullable_to_non_nullable
              as ShippingQuoteStatus,
      zoneName: freezed == zoneName
          ? _self.zoneName
          : zoneName // ignore: cast_nullable_to_non_nullable
              as String?,
      amount: null == amount
          ? _self.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as Decimal,
      vatRatePercent: null == vatRatePercent
          ? _self.vatRatePercent
          : vatRatePercent // ignore: cast_nullable_to_non_nullable
              as Decimal,
      estimatedDaysMin: freezed == estimatedDaysMin
          ? _self.estimatedDaysMin
          : estimatedDaysMin // ignore: cast_nullable_to_non_nullable
              as int?,
      estimatedDaysMax: freezed == estimatedDaysMax
          ? _self.estimatedDaysMax
          : estimatedDaysMax // ignore: cast_nullable_to_non_nullable
              as int?,
    ));
  }
}

/// @nodoc
mixin _$AppliedPromotion {
  String get promotionId;

  /// Null for an automatic promotion the buyer did not type a code for.
  String? get couponCode;
  String get label;
  @DecimalConverter()
  Decimal get discountAmount;

  /// Create a copy of AppliedPromotion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $AppliedPromotionCopyWith<AppliedPromotion> get copyWith =>
      _$AppliedPromotionCopyWithImpl<AppliedPromotion>(
          this as AppliedPromotion, _$identity);

  /// Serializes this AppliedPromotion to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is AppliedPromotion &&
            (identical(other.promotionId, promotionId) ||
                other.promotionId == promotionId) &&
            (identical(other.couponCode, couponCode) ||
                other.couponCode == couponCode) &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.discountAmount, discountAmount) ||
                other.discountAmount == discountAmount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, promotionId, couponCode, label, discountAmount);

  @override
  String toString() {
    return 'AppliedPromotion(promotionId: $promotionId, couponCode: $couponCode, label: $label, discountAmount: $discountAmount)';
  }
}

/// @nodoc
abstract mixin class $AppliedPromotionCopyWith<$Res> {
  factory $AppliedPromotionCopyWith(
          AppliedPromotion value, $Res Function(AppliedPromotion) _then) =
      _$AppliedPromotionCopyWithImpl;
  @useResult
  $Res call(
      {String promotionId,
      String? couponCode,
      String label,
      @DecimalConverter() Decimal discountAmount});
}

/// @nodoc
class _$AppliedPromotionCopyWithImpl<$Res>
    implements $AppliedPromotionCopyWith<$Res> {
  _$AppliedPromotionCopyWithImpl(this._self, this._then);

  final AppliedPromotion _self;
  final $Res Function(AppliedPromotion) _then;

  /// Create a copy of AppliedPromotion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? promotionId = null,
    Object? couponCode = freezed,
    Object? label = null,
    Object? discountAmount = null,
  }) {
    return _then(_self.copyWith(
      promotionId: null == promotionId
          ? _self.promotionId
          : promotionId // ignore: cast_nullable_to_non_nullable
              as String,
      couponCode: freezed == couponCode
          ? _self.couponCode
          : couponCode // ignore: cast_nullable_to_non_nullable
              as String?,
      label: null == label
          ? _self.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      discountAmount: null == discountAmount
          ? _self.discountAmount
          : discountAmount // ignore: cast_nullable_to_non_nullable
              as Decimal,
    ));
  }
}

/// Adds pattern-matching-related methods to [AppliedPromotion].
extension AppliedPromotionPatterns on AppliedPromotion {
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
    TResult Function(_AppliedPromotion value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _AppliedPromotion() when $default != null:
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
    TResult Function(_AppliedPromotion value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _AppliedPromotion():
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
    TResult? Function(_AppliedPromotion value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _AppliedPromotion() when $default != null:
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
    TResult Function(String promotionId, String? couponCode, String label,
            @DecimalConverter() Decimal discountAmount)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _AppliedPromotion() when $default != null:
        return $default(_that.promotionId, _that.couponCode, _that.label,
            _that.discountAmount);
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
    TResult Function(String promotionId, String? couponCode, String label,
            @DecimalConverter() Decimal discountAmount)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _AppliedPromotion():
        return $default(_that.promotionId, _that.couponCode, _that.label,
            _that.discountAmount);
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
    TResult? Function(String promotionId, String? couponCode, String label,
            @DecimalConverter() Decimal discountAmount)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _AppliedPromotion() when $default != null:
        return $default(_that.promotionId, _that.couponCode, _that.label,
            _that.discountAmount);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _AppliedPromotion extends AppliedPromotion {
  const _AppliedPromotion(
      {required this.promotionId,
      required this.couponCode,
      required this.label,
      @DecimalConverter() required this.discountAmount})
      : super._();
  factory _AppliedPromotion.fromJson(Map<String, dynamic> json) =>
      _$AppliedPromotionFromJson(json);

  @override
  final String promotionId;

  /// Null for an automatic promotion the buyer did not type a code for.
  @override
  final String? couponCode;
  @override
  final String label;
  @override
  @DecimalConverter()
  final Decimal discountAmount;

  /// Create a copy of AppliedPromotion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$AppliedPromotionCopyWith<_AppliedPromotion> get copyWith =>
      __$AppliedPromotionCopyWithImpl<_AppliedPromotion>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$AppliedPromotionToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _AppliedPromotion &&
            (identical(other.promotionId, promotionId) ||
                other.promotionId == promotionId) &&
            (identical(other.couponCode, couponCode) ||
                other.couponCode == couponCode) &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.discountAmount, discountAmount) ||
                other.discountAmount == discountAmount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, promotionId, couponCode, label, discountAmount);

  @override
  String toString() {
    return 'AppliedPromotion(promotionId: $promotionId, couponCode: $couponCode, label: $label, discountAmount: $discountAmount)';
  }
}

/// @nodoc
abstract mixin class _$AppliedPromotionCopyWith<$Res>
    implements $AppliedPromotionCopyWith<$Res> {
  factory _$AppliedPromotionCopyWith(
          _AppliedPromotion value, $Res Function(_AppliedPromotion) _then) =
      __$AppliedPromotionCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String promotionId,
      String? couponCode,
      String label,
      @DecimalConverter() Decimal discountAmount});
}

/// @nodoc
class __$AppliedPromotionCopyWithImpl<$Res>
    implements _$AppliedPromotionCopyWith<$Res> {
  __$AppliedPromotionCopyWithImpl(this._self, this._then);

  final _AppliedPromotion _self;
  final $Res Function(_AppliedPromotion) _then;

  /// Create a copy of AppliedPromotion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? promotionId = null,
    Object? couponCode = freezed,
    Object? label = null,
    Object? discountAmount = null,
  }) {
    return _then(_AppliedPromotion(
      promotionId: null == promotionId
          ? _self.promotionId
          : promotionId // ignore: cast_nullable_to_non_nullable
              as String,
      couponCode: freezed == couponCode
          ? _self.couponCode
          : couponCode // ignore: cast_nullable_to_non_nullable
              as String?,
      label: null == label
          ? _self.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      discountAmount: null == discountAmount
          ? _self.discountAmount
          : discountAmount // ignore: cast_nullable_to_non_nullable
              as Decimal,
    ));
  }
}

/// @nodoc
mixin _$CheckoutQuote {
  String get quoteId;
  Currency get currency;
  Channel get channel;

  /// The jurisdiction's headline rate, as a PERCENTAGE (5 means 5%), which
  /// is the unit `composeOrderTotals` takes. A fraction such as 0.05 here
  /// would under-tax by a factor of a hundred.
  @DecimalConverter()
  Decimal get vatRatePercent;
  List<QuoteLine> get lines;
  ShippingQuote get shipping;
  List<AppliedPromotion> get promotions;
  OrderTotals get totals;
  @UtcDateTimeConverter()
  DateTime get expiresAt;

  /// Create a copy of CheckoutQuote
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $CheckoutQuoteCopyWith<CheckoutQuote> get copyWith =>
      _$CheckoutQuoteCopyWithImpl<CheckoutQuote>(
          this as CheckoutQuote, _$identity);

  /// Serializes this CheckoutQuote to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is CheckoutQuote &&
            (identical(other.quoteId, quoteId) || other.quoteId == quoteId) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.vatRatePercent, vatRatePercent) ||
                other.vatRatePercent == vatRatePercent) &&
            const DeepCollectionEquality().equals(other.lines, lines) &&
            (identical(other.shipping, shipping) ||
                other.shipping == shipping) &&
            const DeepCollectionEquality()
                .equals(other.promotions, promotions) &&
            (identical(other.totals, totals) || other.totals == totals) &&
            (identical(other.expiresAt, expiresAt) ||
                other.expiresAt == expiresAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      quoteId,
      currency,
      channel,
      vatRatePercent,
      const DeepCollectionEquality().hash(lines),
      shipping,
      const DeepCollectionEquality().hash(promotions),
      totals,
      expiresAt);

  @override
  String toString() {
    return 'CheckoutQuote(quoteId: $quoteId, currency: $currency, channel: $channel, vatRatePercent: $vatRatePercent, lines: $lines, shipping: $shipping, promotions: $promotions, totals: $totals, expiresAt: $expiresAt)';
  }
}

/// @nodoc
abstract mixin class $CheckoutQuoteCopyWith<$Res> {
  factory $CheckoutQuoteCopyWith(
          CheckoutQuote value, $Res Function(CheckoutQuote) _then) =
      _$CheckoutQuoteCopyWithImpl;
  @useResult
  $Res call(
      {String quoteId,
      Currency currency,
      Channel channel,
      @DecimalConverter() Decimal vatRatePercent,
      List<QuoteLine> lines,
      ShippingQuote shipping,
      List<AppliedPromotion> promotions,
      OrderTotals totals,
      @UtcDateTimeConverter() DateTime expiresAt});

  $ShippingQuoteCopyWith<$Res> get shipping;
  $OrderTotalsCopyWith<$Res> get totals;
}

/// @nodoc
class _$CheckoutQuoteCopyWithImpl<$Res>
    implements $CheckoutQuoteCopyWith<$Res> {
  _$CheckoutQuoteCopyWithImpl(this._self, this._then);

  final CheckoutQuote _self;
  final $Res Function(CheckoutQuote) _then;

  /// Create a copy of CheckoutQuote
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? quoteId = null,
    Object? currency = null,
    Object? channel = null,
    Object? vatRatePercent = null,
    Object? lines = null,
    Object? shipping = null,
    Object? promotions = null,
    Object? totals = null,
    Object? expiresAt = null,
  }) {
    return _then(_self.copyWith(
      quoteId: null == quoteId
          ? _self.quoteId
          : quoteId // ignore: cast_nullable_to_non_nullable
              as String,
      currency: null == currency
          ? _self.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as Currency,
      channel: null == channel
          ? _self.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as Channel,
      vatRatePercent: null == vatRatePercent
          ? _self.vatRatePercent
          : vatRatePercent // ignore: cast_nullable_to_non_nullable
              as Decimal,
      lines: null == lines
          ? _self.lines
          : lines // ignore: cast_nullable_to_non_nullable
              as List<QuoteLine>,
      shipping: null == shipping
          ? _self.shipping
          : shipping // ignore: cast_nullable_to_non_nullable
              as ShippingQuote,
      promotions: null == promotions
          ? _self.promotions
          : promotions // ignore: cast_nullable_to_non_nullable
              as List<AppliedPromotion>,
      totals: null == totals
          ? _self.totals
          : totals // ignore: cast_nullable_to_non_nullable
              as OrderTotals,
      expiresAt: null == expiresAt
          ? _self.expiresAt
          : expiresAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }

  /// Create a copy of CheckoutQuote
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ShippingQuoteCopyWith<$Res> get shipping {
    return $ShippingQuoteCopyWith<$Res>(_self.shipping, (value) {
      return _then(_self.copyWith(shipping: value));
    });
  }

  /// Create a copy of CheckoutQuote
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $OrderTotalsCopyWith<$Res> get totals {
    return $OrderTotalsCopyWith<$Res>(_self.totals, (value) {
      return _then(_self.copyWith(totals: value));
    });
  }
}

/// Adds pattern-matching-related methods to [CheckoutQuote].
extension CheckoutQuotePatterns on CheckoutQuote {
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
    TResult Function(_CheckoutQuote value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _CheckoutQuote() when $default != null:
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
    TResult Function(_CheckoutQuote value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CheckoutQuote():
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
    TResult? Function(_CheckoutQuote value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CheckoutQuote() when $default != null:
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
            String quoteId,
            Currency currency,
            Channel channel,
            @DecimalConverter() Decimal vatRatePercent,
            List<QuoteLine> lines,
            ShippingQuote shipping,
            List<AppliedPromotion> promotions,
            OrderTotals totals,
            @UtcDateTimeConverter() DateTime expiresAt)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _CheckoutQuote() when $default != null:
        return $default(
            _that.quoteId,
            _that.currency,
            _that.channel,
            _that.vatRatePercent,
            _that.lines,
            _that.shipping,
            _that.promotions,
            _that.totals,
            _that.expiresAt);
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
            String quoteId,
            Currency currency,
            Channel channel,
            @DecimalConverter() Decimal vatRatePercent,
            List<QuoteLine> lines,
            ShippingQuote shipping,
            List<AppliedPromotion> promotions,
            OrderTotals totals,
            @UtcDateTimeConverter() DateTime expiresAt)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CheckoutQuote():
        return $default(
            _that.quoteId,
            _that.currency,
            _that.channel,
            _that.vatRatePercent,
            _that.lines,
            _that.shipping,
            _that.promotions,
            _that.totals,
            _that.expiresAt);
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
            String quoteId,
            Currency currency,
            Channel channel,
            @DecimalConverter() Decimal vatRatePercent,
            List<QuoteLine> lines,
            ShippingQuote shipping,
            List<AppliedPromotion> promotions,
            OrderTotals totals,
            @UtcDateTimeConverter() DateTime expiresAt)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CheckoutQuote() when $default != null:
        return $default(
            _that.quoteId,
            _that.currency,
            _that.channel,
            _that.vatRatePercent,
            _that.lines,
            _that.shipping,
            _that.promotions,
            _that.totals,
            _that.expiresAt);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _CheckoutQuote extends CheckoutQuote {
  const _CheckoutQuote(
      {required this.quoteId,
      required this.currency,
      required this.channel,
      @DecimalConverter() required this.vatRatePercent,
      required final List<QuoteLine> lines,
      required this.shipping,
      required final List<AppliedPromotion> promotions,
      required this.totals,
      @UtcDateTimeConverter() required this.expiresAt})
      : _lines = lines,
        _promotions = promotions,
        super._();
  factory _CheckoutQuote.fromJson(Map<String, dynamic> json) =>
      _$CheckoutQuoteFromJson(json);

  @override
  final String quoteId;
  @override
  final Currency currency;
  @override
  final Channel channel;

  /// The jurisdiction's headline rate, as a PERCENTAGE (5 means 5%), which
  /// is the unit `composeOrderTotals` takes. A fraction such as 0.05 here
  /// would under-tax by a factor of a hundred.
  @override
  @DecimalConverter()
  final Decimal vatRatePercent;
  final List<QuoteLine> _lines;
  @override
  List<QuoteLine> get lines {
    if (_lines is EqualUnmodifiableListView) return _lines;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_lines);
  }

  @override
  final ShippingQuote shipping;
  final List<AppliedPromotion> _promotions;
  @override
  List<AppliedPromotion> get promotions {
    if (_promotions is EqualUnmodifiableListView) return _promotions;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_promotions);
  }

  @override
  final OrderTotals totals;
  @override
  @UtcDateTimeConverter()
  final DateTime expiresAt;

  /// Create a copy of CheckoutQuote
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$CheckoutQuoteCopyWith<_CheckoutQuote> get copyWith =>
      __$CheckoutQuoteCopyWithImpl<_CheckoutQuote>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$CheckoutQuoteToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _CheckoutQuote &&
            (identical(other.quoteId, quoteId) || other.quoteId == quoteId) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.vatRatePercent, vatRatePercent) ||
                other.vatRatePercent == vatRatePercent) &&
            const DeepCollectionEquality().equals(other._lines, _lines) &&
            (identical(other.shipping, shipping) ||
                other.shipping == shipping) &&
            const DeepCollectionEquality()
                .equals(other._promotions, _promotions) &&
            (identical(other.totals, totals) || other.totals == totals) &&
            (identical(other.expiresAt, expiresAt) ||
                other.expiresAt == expiresAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      quoteId,
      currency,
      channel,
      vatRatePercent,
      const DeepCollectionEquality().hash(_lines),
      shipping,
      const DeepCollectionEquality().hash(_promotions),
      totals,
      expiresAt);

  @override
  String toString() {
    return 'CheckoutQuote(quoteId: $quoteId, currency: $currency, channel: $channel, vatRatePercent: $vatRatePercent, lines: $lines, shipping: $shipping, promotions: $promotions, totals: $totals, expiresAt: $expiresAt)';
  }
}

/// @nodoc
abstract mixin class _$CheckoutQuoteCopyWith<$Res>
    implements $CheckoutQuoteCopyWith<$Res> {
  factory _$CheckoutQuoteCopyWith(
          _CheckoutQuote value, $Res Function(_CheckoutQuote) _then) =
      __$CheckoutQuoteCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String quoteId,
      Currency currency,
      Channel channel,
      @DecimalConverter() Decimal vatRatePercent,
      List<QuoteLine> lines,
      ShippingQuote shipping,
      List<AppliedPromotion> promotions,
      OrderTotals totals,
      @UtcDateTimeConverter() DateTime expiresAt});

  @override
  $ShippingQuoteCopyWith<$Res> get shipping;
  @override
  $OrderTotalsCopyWith<$Res> get totals;
}

/// @nodoc
class __$CheckoutQuoteCopyWithImpl<$Res>
    implements _$CheckoutQuoteCopyWith<$Res> {
  __$CheckoutQuoteCopyWithImpl(this._self, this._then);

  final _CheckoutQuote _self;
  final $Res Function(_CheckoutQuote) _then;

  /// Create a copy of CheckoutQuote
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? quoteId = null,
    Object? currency = null,
    Object? channel = null,
    Object? vatRatePercent = null,
    Object? lines = null,
    Object? shipping = null,
    Object? promotions = null,
    Object? totals = null,
    Object? expiresAt = null,
  }) {
    return _then(_CheckoutQuote(
      quoteId: null == quoteId
          ? _self.quoteId
          : quoteId // ignore: cast_nullable_to_non_nullable
              as String,
      currency: null == currency
          ? _self.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as Currency,
      channel: null == channel
          ? _self.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as Channel,
      vatRatePercent: null == vatRatePercent
          ? _self.vatRatePercent
          : vatRatePercent // ignore: cast_nullable_to_non_nullable
              as Decimal,
      lines: null == lines
          ? _self._lines
          : lines // ignore: cast_nullable_to_non_nullable
              as List<QuoteLine>,
      shipping: null == shipping
          ? _self.shipping
          : shipping // ignore: cast_nullable_to_non_nullable
              as ShippingQuote,
      promotions: null == promotions
          ? _self._promotions
          : promotions // ignore: cast_nullable_to_non_nullable
              as List<AppliedPromotion>,
      totals: null == totals
          ? _self.totals
          : totals // ignore: cast_nullable_to_non_nullable
              as OrderTotals,
      expiresAt: null == expiresAt
          ? _self.expiresAt
          : expiresAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }

  /// Create a copy of CheckoutQuote
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ShippingQuoteCopyWith<$Res> get shipping {
    return $ShippingQuoteCopyWith<$Res>(_self.shipping, (value) {
      return _then(_self.copyWith(shipping: value));
    });
  }

  /// Create a copy of CheckoutQuote
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $OrderTotalsCopyWith<$Res> get totals {
    return $OrderTotalsCopyWith<$Res>(_self.totals, (value) {
      return _then(_self.copyWith(totals: value));
    });
  }
}

// dart format on
