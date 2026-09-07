// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'order_totals.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$OrderTotals {
  @DecimalConverter()
  Decimal get subtotal;
  @DecimalConverter()
  Decimal get discountAmount;

  /// VAT on the GOODS alone. Never merge this with [shippingVatAmount].
  @DecimalConverter()
  Decimal get goodsVatAmount;
  @DecimalConverter()
  Decimal get shippingAmount;

  /// VAT on the DELIVERY alone. Zero in a zero-rated jurisdiction, which is
  /// not the same as absent.
  @DecimalConverter()
  Decimal get shippingVatAmount;

  /// The sum of the two components above, and equal to it exactly.
  @DecimalConverter()
  Decimal get vatAmount;
  @DecimalConverter()
  Decimal get total;

  /// Create a copy of OrderTotals
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $OrderTotalsCopyWith<OrderTotals> get copyWith =>
      _$OrderTotalsCopyWithImpl<OrderTotals>(this as OrderTotals, _$identity);

  /// Serializes this OrderTotals to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is OrderTotals &&
            (identical(other.subtotal, subtotal) ||
                other.subtotal == subtotal) &&
            (identical(other.discountAmount, discountAmount) ||
                other.discountAmount == discountAmount) &&
            (identical(other.goodsVatAmount, goodsVatAmount) ||
                other.goodsVatAmount == goodsVatAmount) &&
            (identical(other.shippingAmount, shippingAmount) ||
                other.shippingAmount == shippingAmount) &&
            (identical(other.shippingVatAmount, shippingVatAmount) ||
                other.shippingVatAmount == shippingVatAmount) &&
            (identical(other.vatAmount, vatAmount) ||
                other.vatAmount == vatAmount) &&
            (identical(other.total, total) || other.total == total));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, subtotal, discountAmount,
      goodsVatAmount, shippingAmount, shippingVatAmount, vatAmount, total);

  @override
  String toString() {
    return 'OrderTotals(subtotal: $subtotal, discountAmount: $discountAmount, goodsVatAmount: $goodsVatAmount, shippingAmount: $shippingAmount, shippingVatAmount: $shippingVatAmount, vatAmount: $vatAmount, total: $total)';
  }
}

/// @nodoc
abstract mixin class $OrderTotalsCopyWith<$Res> {
  factory $OrderTotalsCopyWith(
          OrderTotals value, $Res Function(OrderTotals) _then) =
      _$OrderTotalsCopyWithImpl;
  @useResult
  $Res call(
      {@DecimalConverter() Decimal subtotal,
      @DecimalConverter() Decimal discountAmount,
      @DecimalConverter() Decimal goodsVatAmount,
      @DecimalConverter() Decimal shippingAmount,
      @DecimalConverter() Decimal shippingVatAmount,
      @DecimalConverter() Decimal vatAmount,
      @DecimalConverter() Decimal total});
}

/// @nodoc
class _$OrderTotalsCopyWithImpl<$Res> implements $OrderTotalsCopyWith<$Res> {
  _$OrderTotalsCopyWithImpl(this._self, this._then);

  final OrderTotals _self;
  final $Res Function(OrderTotals) _then;

  /// Create a copy of OrderTotals
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? subtotal = null,
    Object? discountAmount = null,
    Object? goodsVatAmount = null,
    Object? shippingAmount = null,
    Object? shippingVatAmount = null,
    Object? vatAmount = null,
    Object? total = null,
  }) {
    return _then(_self.copyWith(
      subtotal: null == subtotal
          ? _self.subtotal
          : subtotal // ignore: cast_nullable_to_non_nullable
              as Decimal,
      discountAmount: null == discountAmount
          ? _self.discountAmount
          : discountAmount // ignore: cast_nullable_to_non_nullable
              as Decimal,
      goodsVatAmount: null == goodsVatAmount
          ? _self.goodsVatAmount
          : goodsVatAmount // ignore: cast_nullable_to_non_nullable
              as Decimal,
      shippingAmount: null == shippingAmount
          ? _self.shippingAmount
          : shippingAmount // ignore: cast_nullable_to_non_nullable
              as Decimal,
      shippingVatAmount: null == shippingVatAmount
          ? _self.shippingVatAmount
          : shippingVatAmount // ignore: cast_nullable_to_non_nullable
              as Decimal,
      vatAmount: null == vatAmount
          ? _self.vatAmount
          : vatAmount // ignore: cast_nullable_to_non_nullable
              as Decimal,
      total: null == total
          ? _self.total
          : total // ignore: cast_nullable_to_non_nullable
              as Decimal,
    ));
  }
}

/// Adds pattern-matching-related methods to [OrderTotals].
extension OrderTotalsPatterns on OrderTotals {
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
    TResult Function(_OrderTotals value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _OrderTotals() when $default != null:
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
    TResult Function(_OrderTotals value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OrderTotals():
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
    TResult? Function(_OrderTotals value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OrderTotals() when $default != null:
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
            @DecimalConverter() Decimal subtotal,
            @DecimalConverter() Decimal discountAmount,
            @DecimalConverter() Decimal goodsVatAmount,
            @DecimalConverter() Decimal shippingAmount,
            @DecimalConverter() Decimal shippingVatAmount,
            @DecimalConverter() Decimal vatAmount,
            @DecimalConverter() Decimal total)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _OrderTotals() when $default != null:
        return $default(
            _that.subtotal,
            _that.discountAmount,
            _that.goodsVatAmount,
            _that.shippingAmount,
            _that.shippingVatAmount,
            _that.vatAmount,
            _that.total);
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
            @DecimalConverter() Decimal subtotal,
            @DecimalConverter() Decimal discountAmount,
            @DecimalConverter() Decimal goodsVatAmount,
            @DecimalConverter() Decimal shippingAmount,
            @DecimalConverter() Decimal shippingVatAmount,
            @DecimalConverter() Decimal vatAmount,
            @DecimalConverter() Decimal total)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OrderTotals():
        return $default(
            _that.subtotal,
            _that.discountAmount,
            _that.goodsVatAmount,
            _that.shippingAmount,
            _that.shippingVatAmount,
            _that.vatAmount,
            _that.total);
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
            @DecimalConverter() Decimal subtotal,
            @DecimalConverter() Decimal discountAmount,
            @DecimalConverter() Decimal goodsVatAmount,
            @DecimalConverter() Decimal shippingAmount,
            @DecimalConverter() Decimal shippingVatAmount,
            @DecimalConverter() Decimal vatAmount,
            @DecimalConverter() Decimal total)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OrderTotals() when $default != null:
        return $default(
            _that.subtotal,
            _that.discountAmount,
            _that.goodsVatAmount,
            _that.shippingAmount,
            _that.shippingVatAmount,
            _that.vatAmount,
            _that.total);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _OrderTotals extends OrderTotals {
  const _OrderTotals(
      {@DecimalConverter() required this.subtotal,
      @DecimalConverter() required this.discountAmount,
      @DecimalConverter() required this.goodsVatAmount,
      @DecimalConverter() required this.shippingAmount,
      @DecimalConverter() required this.shippingVatAmount,
      @DecimalConverter() required this.vatAmount,
      @DecimalConverter() required this.total})
      : super._();
  factory _OrderTotals.fromJson(Map<String, dynamic> json) =>
      _$OrderTotalsFromJson(json);

  @override
  @DecimalConverter()
  final Decimal subtotal;
  @override
  @DecimalConverter()
  final Decimal discountAmount;

  /// VAT on the GOODS alone. Never merge this with [shippingVatAmount].
  @override
  @DecimalConverter()
  final Decimal goodsVatAmount;
  @override
  @DecimalConverter()
  final Decimal shippingAmount;

  /// VAT on the DELIVERY alone. Zero in a zero-rated jurisdiction, which is
  /// not the same as absent.
  @override
  @DecimalConverter()
  final Decimal shippingVatAmount;

  /// The sum of the two components above, and equal to it exactly.
  @override
  @DecimalConverter()
  final Decimal vatAmount;
  @override
  @DecimalConverter()
  final Decimal total;

  /// Create a copy of OrderTotals
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$OrderTotalsCopyWith<_OrderTotals> get copyWith =>
      __$OrderTotalsCopyWithImpl<_OrderTotals>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$OrderTotalsToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _OrderTotals &&
            (identical(other.subtotal, subtotal) ||
                other.subtotal == subtotal) &&
            (identical(other.discountAmount, discountAmount) ||
                other.discountAmount == discountAmount) &&
            (identical(other.goodsVatAmount, goodsVatAmount) ||
                other.goodsVatAmount == goodsVatAmount) &&
            (identical(other.shippingAmount, shippingAmount) ||
                other.shippingAmount == shippingAmount) &&
            (identical(other.shippingVatAmount, shippingVatAmount) ||
                other.shippingVatAmount == shippingVatAmount) &&
            (identical(other.vatAmount, vatAmount) ||
                other.vatAmount == vatAmount) &&
            (identical(other.total, total) || other.total == total));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, subtotal, discountAmount,
      goodsVatAmount, shippingAmount, shippingVatAmount, vatAmount, total);

  @override
  String toString() {
    return 'OrderTotals(subtotal: $subtotal, discountAmount: $discountAmount, goodsVatAmount: $goodsVatAmount, shippingAmount: $shippingAmount, shippingVatAmount: $shippingVatAmount, vatAmount: $vatAmount, total: $total)';
  }
}

/// @nodoc
abstract mixin class _$OrderTotalsCopyWith<$Res>
    implements $OrderTotalsCopyWith<$Res> {
  factory _$OrderTotalsCopyWith(
          _OrderTotals value, $Res Function(_OrderTotals) _then) =
      __$OrderTotalsCopyWithImpl;
  @override
  @useResult
  $Res call(
      {@DecimalConverter() Decimal subtotal,
      @DecimalConverter() Decimal discountAmount,
      @DecimalConverter() Decimal goodsVatAmount,
      @DecimalConverter() Decimal shippingAmount,
      @DecimalConverter() Decimal shippingVatAmount,
      @DecimalConverter() Decimal vatAmount,
      @DecimalConverter() Decimal total});
}

/// @nodoc
class __$OrderTotalsCopyWithImpl<$Res> implements _$OrderTotalsCopyWith<$Res> {
  __$OrderTotalsCopyWithImpl(this._self, this._then);

  final _OrderTotals _self;
  final $Res Function(_OrderTotals) _then;

  /// Create a copy of OrderTotals
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? subtotal = null,
    Object? discountAmount = null,
    Object? goodsVatAmount = null,
    Object? shippingAmount = null,
    Object? shippingVatAmount = null,
    Object? vatAmount = null,
    Object? total = null,
  }) {
    return _then(_OrderTotals(
      subtotal: null == subtotal
          ? _self.subtotal
          : subtotal // ignore: cast_nullable_to_non_nullable
              as Decimal,
      discountAmount: null == discountAmount
          ? _self.discountAmount
          : discountAmount // ignore: cast_nullable_to_non_nullable
              as Decimal,
      goodsVatAmount: null == goodsVatAmount
          ? _self.goodsVatAmount
          : goodsVatAmount // ignore: cast_nullable_to_non_nullable
              as Decimal,
      shippingAmount: null == shippingAmount
          ? _self.shippingAmount
          : shippingAmount // ignore: cast_nullable_to_non_nullable
              as Decimal,
      shippingVatAmount: null == shippingVatAmount
          ? _self.shippingVatAmount
          : shippingVatAmount // ignore: cast_nullable_to_non_nullable
              as Decimal,
      vatAmount: null == vatAmount
          ? _self.vatAmount
          : vatAmount // ignore: cast_nullable_to_non_nullable
              as Decimal,
      total: null == total
          ? _self.total
          : total // ignore: cast_nullable_to_non_nullable
              as Decimal,
    ));
  }
}

/// @nodoc
mixin _$PersistedOrderTotals {
  @DecimalConverter()
  Decimal get subtotal;
  @DecimalConverter()
  Decimal get discountAmount;
  @DecimalConverter()
  Decimal get shippingAmount;

  /// The aggregate VAT actually charged. Always present.
  @DecimalConverter()
  Decimal get vatAmount;

  /// VAT on the goods — NULL for every order stored before the `Order` table
  /// grew a column for it. Null means "not recorded", never "zero".
  @NullableDecimalConverter()
  Decimal? get goodsVatAmount;

  /// VAT on the delivery — null on the same terms as [goodsVatAmount].
  @NullableDecimalConverter()
  Decimal? get shippingVatAmount;
  @DecimalConverter()
  Decimal get total;

  /// Create a copy of PersistedOrderTotals
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $PersistedOrderTotalsCopyWith<PersistedOrderTotals> get copyWith =>
      _$PersistedOrderTotalsCopyWithImpl<PersistedOrderTotals>(
          this as PersistedOrderTotals, _$identity);

  /// Serializes this PersistedOrderTotals to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is PersistedOrderTotals &&
            (identical(other.subtotal, subtotal) ||
                other.subtotal == subtotal) &&
            (identical(other.discountAmount, discountAmount) ||
                other.discountAmount == discountAmount) &&
            (identical(other.shippingAmount, shippingAmount) ||
                other.shippingAmount == shippingAmount) &&
            (identical(other.vatAmount, vatAmount) ||
                other.vatAmount == vatAmount) &&
            (identical(other.goodsVatAmount, goodsVatAmount) ||
                other.goodsVatAmount == goodsVatAmount) &&
            (identical(other.shippingVatAmount, shippingVatAmount) ||
                other.shippingVatAmount == shippingVatAmount) &&
            (identical(other.total, total) || other.total == total));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, subtotal, discountAmount,
      shippingAmount, vatAmount, goodsVatAmount, shippingVatAmount, total);

  @override
  String toString() {
    return 'PersistedOrderTotals(subtotal: $subtotal, discountAmount: $discountAmount, shippingAmount: $shippingAmount, vatAmount: $vatAmount, goodsVatAmount: $goodsVatAmount, shippingVatAmount: $shippingVatAmount, total: $total)';
  }
}

/// @nodoc
abstract mixin class $PersistedOrderTotalsCopyWith<$Res> {
  factory $PersistedOrderTotalsCopyWith(PersistedOrderTotals value,
          $Res Function(PersistedOrderTotals) _then) =
      _$PersistedOrderTotalsCopyWithImpl;
  @useResult
  $Res call(
      {@DecimalConverter() Decimal subtotal,
      @DecimalConverter() Decimal discountAmount,
      @DecimalConverter() Decimal shippingAmount,
      @DecimalConverter() Decimal vatAmount,
      @NullableDecimalConverter() Decimal? goodsVatAmount,
      @NullableDecimalConverter() Decimal? shippingVatAmount,
      @DecimalConverter() Decimal total});
}

/// @nodoc
class _$PersistedOrderTotalsCopyWithImpl<$Res>
    implements $PersistedOrderTotalsCopyWith<$Res> {
  _$PersistedOrderTotalsCopyWithImpl(this._self, this._then);

  final PersistedOrderTotals _self;
  final $Res Function(PersistedOrderTotals) _then;

  /// Create a copy of PersistedOrderTotals
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? subtotal = null,
    Object? discountAmount = null,
    Object? shippingAmount = null,
    Object? vatAmount = null,
    Object? goodsVatAmount = freezed,
    Object? shippingVatAmount = freezed,
    Object? total = null,
  }) {
    return _then(_self.copyWith(
      subtotal: null == subtotal
          ? _self.subtotal
          : subtotal // ignore: cast_nullable_to_non_nullable
              as Decimal,
      discountAmount: null == discountAmount
          ? _self.discountAmount
          : discountAmount // ignore: cast_nullable_to_non_nullable
              as Decimal,
      shippingAmount: null == shippingAmount
          ? _self.shippingAmount
          : shippingAmount // ignore: cast_nullable_to_non_nullable
              as Decimal,
      vatAmount: null == vatAmount
          ? _self.vatAmount
          : vatAmount // ignore: cast_nullable_to_non_nullable
              as Decimal,
      goodsVatAmount: freezed == goodsVatAmount
          ? _self.goodsVatAmount
          : goodsVatAmount // ignore: cast_nullable_to_non_nullable
              as Decimal?,
      shippingVatAmount: freezed == shippingVatAmount
          ? _self.shippingVatAmount
          : shippingVatAmount // ignore: cast_nullable_to_non_nullable
              as Decimal?,
      total: null == total
          ? _self.total
          : total // ignore: cast_nullable_to_non_nullable
              as Decimal,
    ));
  }
}

/// Adds pattern-matching-related methods to [PersistedOrderTotals].
extension PersistedOrderTotalsPatterns on PersistedOrderTotals {
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
    TResult Function(_PersistedOrderTotals value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _PersistedOrderTotals() when $default != null:
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
    TResult Function(_PersistedOrderTotals value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _PersistedOrderTotals():
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
    TResult? Function(_PersistedOrderTotals value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _PersistedOrderTotals() when $default != null:
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
            @DecimalConverter() Decimal subtotal,
            @DecimalConverter() Decimal discountAmount,
            @DecimalConverter() Decimal shippingAmount,
            @DecimalConverter() Decimal vatAmount,
            @NullableDecimalConverter() Decimal? goodsVatAmount,
            @NullableDecimalConverter() Decimal? shippingVatAmount,
            @DecimalConverter() Decimal total)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _PersistedOrderTotals() when $default != null:
        return $default(
            _that.subtotal,
            _that.discountAmount,
            _that.shippingAmount,
            _that.vatAmount,
            _that.goodsVatAmount,
            _that.shippingVatAmount,
            _that.total);
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
            @DecimalConverter() Decimal subtotal,
            @DecimalConverter() Decimal discountAmount,
            @DecimalConverter() Decimal shippingAmount,
            @DecimalConverter() Decimal vatAmount,
            @NullableDecimalConverter() Decimal? goodsVatAmount,
            @NullableDecimalConverter() Decimal? shippingVatAmount,
            @DecimalConverter() Decimal total)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _PersistedOrderTotals():
        return $default(
            _that.subtotal,
            _that.discountAmount,
            _that.shippingAmount,
            _that.vatAmount,
            _that.goodsVatAmount,
            _that.shippingVatAmount,
            _that.total);
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
            @DecimalConverter() Decimal subtotal,
            @DecimalConverter() Decimal discountAmount,
            @DecimalConverter() Decimal shippingAmount,
            @DecimalConverter() Decimal vatAmount,
            @NullableDecimalConverter() Decimal? goodsVatAmount,
            @NullableDecimalConverter() Decimal? shippingVatAmount,
            @DecimalConverter() Decimal total)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _PersistedOrderTotals() when $default != null:
        return $default(
            _that.subtotal,
            _that.discountAmount,
            _that.shippingAmount,
            _that.vatAmount,
            _that.goodsVatAmount,
            _that.shippingVatAmount,
            _that.total);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _PersistedOrderTotals extends PersistedOrderTotals {
  const _PersistedOrderTotals(
      {@DecimalConverter() required this.subtotal,
      @DecimalConverter() required this.discountAmount,
      @DecimalConverter() required this.shippingAmount,
      @DecimalConverter() required this.vatAmount,
      @NullableDecimalConverter() required this.goodsVatAmount,
      @NullableDecimalConverter() required this.shippingVatAmount,
      @DecimalConverter() required this.total})
      : super._();
  factory _PersistedOrderTotals.fromJson(Map<String, dynamic> json) =>
      _$PersistedOrderTotalsFromJson(json);

  @override
  @DecimalConverter()
  final Decimal subtotal;
  @override
  @DecimalConverter()
  final Decimal discountAmount;
  @override
  @DecimalConverter()
  final Decimal shippingAmount;

  /// The aggregate VAT actually charged. Always present.
  @override
  @DecimalConverter()
  final Decimal vatAmount;

  /// VAT on the goods — NULL for every order stored before the `Order` table
  /// grew a column for it. Null means "not recorded", never "zero".
  @override
  @NullableDecimalConverter()
  final Decimal? goodsVatAmount;

  /// VAT on the delivery — null on the same terms as [goodsVatAmount].
  @override
  @NullableDecimalConverter()
  final Decimal? shippingVatAmount;
  @override
  @DecimalConverter()
  final Decimal total;

  /// Create a copy of PersistedOrderTotals
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$PersistedOrderTotalsCopyWith<_PersistedOrderTotals> get copyWith =>
      __$PersistedOrderTotalsCopyWithImpl<_PersistedOrderTotals>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$PersistedOrderTotalsToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _PersistedOrderTotals &&
            (identical(other.subtotal, subtotal) ||
                other.subtotal == subtotal) &&
            (identical(other.discountAmount, discountAmount) ||
                other.discountAmount == discountAmount) &&
            (identical(other.shippingAmount, shippingAmount) ||
                other.shippingAmount == shippingAmount) &&
            (identical(other.vatAmount, vatAmount) ||
                other.vatAmount == vatAmount) &&
            (identical(other.goodsVatAmount, goodsVatAmount) ||
                other.goodsVatAmount == goodsVatAmount) &&
            (identical(other.shippingVatAmount, shippingVatAmount) ||
                other.shippingVatAmount == shippingVatAmount) &&
            (identical(other.total, total) || other.total == total));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, subtotal, discountAmount,
      shippingAmount, vatAmount, goodsVatAmount, shippingVatAmount, total);

  @override
  String toString() {
    return 'PersistedOrderTotals(subtotal: $subtotal, discountAmount: $discountAmount, shippingAmount: $shippingAmount, vatAmount: $vatAmount, goodsVatAmount: $goodsVatAmount, shippingVatAmount: $shippingVatAmount, total: $total)';
  }
}

/// @nodoc
abstract mixin class _$PersistedOrderTotalsCopyWith<$Res>
    implements $PersistedOrderTotalsCopyWith<$Res> {
  factory _$PersistedOrderTotalsCopyWith(_PersistedOrderTotals value,
          $Res Function(_PersistedOrderTotals) _then) =
      __$PersistedOrderTotalsCopyWithImpl;
  @override
  @useResult
  $Res call(
      {@DecimalConverter() Decimal subtotal,
      @DecimalConverter() Decimal discountAmount,
      @DecimalConverter() Decimal shippingAmount,
      @DecimalConverter() Decimal vatAmount,
      @NullableDecimalConverter() Decimal? goodsVatAmount,
      @NullableDecimalConverter() Decimal? shippingVatAmount,
      @DecimalConverter() Decimal total});
}

/// @nodoc
class __$PersistedOrderTotalsCopyWithImpl<$Res>
    implements _$PersistedOrderTotalsCopyWith<$Res> {
  __$PersistedOrderTotalsCopyWithImpl(this._self, this._then);

  final _PersistedOrderTotals _self;
  final $Res Function(_PersistedOrderTotals) _then;

  /// Create a copy of PersistedOrderTotals
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? subtotal = null,
    Object? discountAmount = null,
    Object? shippingAmount = null,
    Object? vatAmount = null,
    Object? goodsVatAmount = freezed,
    Object? shippingVatAmount = freezed,
    Object? total = null,
  }) {
    return _then(_PersistedOrderTotals(
      subtotal: null == subtotal
          ? _self.subtotal
          : subtotal // ignore: cast_nullable_to_non_nullable
              as Decimal,
      discountAmount: null == discountAmount
          ? _self.discountAmount
          : discountAmount // ignore: cast_nullable_to_non_nullable
              as Decimal,
      shippingAmount: null == shippingAmount
          ? _self.shippingAmount
          : shippingAmount // ignore: cast_nullable_to_non_nullable
              as Decimal,
      vatAmount: null == vatAmount
          ? _self.vatAmount
          : vatAmount // ignore: cast_nullable_to_non_nullable
              as Decimal,
      goodsVatAmount: freezed == goodsVatAmount
          ? _self.goodsVatAmount
          : goodsVatAmount // ignore: cast_nullable_to_non_nullable
              as Decimal?,
      shippingVatAmount: freezed == shippingVatAmount
          ? _self.shippingVatAmount
          : shippingVatAmount // ignore: cast_nullable_to_non_nullable
              as Decimal?,
      total: null == total
          ? _self.total
          : total // ignore: cast_nullable_to_non_nullable
              as Decimal,
    ));
  }
}

// dart format on
