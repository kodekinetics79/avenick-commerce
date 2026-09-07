// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'catalogue.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$RatingSummary {
  /// 1.0 to 5.0. Genuinely an approximate quantity, so `double` is the right
  /// type here — unlike money, nothing is settled against it.
  double get average;
  int get count;

  /// Create a copy of RatingSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $RatingSummaryCopyWith<RatingSummary> get copyWith =>
      _$RatingSummaryCopyWithImpl<RatingSummary>(
          this as RatingSummary, _$identity);

  /// Serializes this RatingSummary to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is RatingSummary &&
            (identical(other.average, average) || other.average == average) &&
            (identical(other.count, count) || other.count == count));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, average, count);

  @override
  String toString() {
    return 'RatingSummary(average: $average, count: $count)';
  }
}

/// @nodoc
abstract mixin class $RatingSummaryCopyWith<$Res> {
  factory $RatingSummaryCopyWith(
          RatingSummary value, $Res Function(RatingSummary) _then) =
      _$RatingSummaryCopyWithImpl;
  @useResult
  $Res call({double average, int count});
}

/// @nodoc
class _$RatingSummaryCopyWithImpl<$Res>
    implements $RatingSummaryCopyWith<$Res> {
  _$RatingSummaryCopyWithImpl(this._self, this._then);

  final RatingSummary _self;
  final $Res Function(RatingSummary) _then;

  /// Create a copy of RatingSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? average = null,
    Object? count = null,
  }) {
    return _then(_self.copyWith(
      average: null == average
          ? _self.average
          : average // ignore: cast_nullable_to_non_nullable
              as double,
      count: null == count
          ? _self.count
          : count // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// Adds pattern-matching-related methods to [RatingSummary].
extension RatingSummaryPatterns on RatingSummary {
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
    TResult Function(_RatingSummary value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _RatingSummary() when $default != null:
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
    TResult Function(_RatingSummary value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _RatingSummary():
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
    TResult? Function(_RatingSummary value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _RatingSummary() when $default != null:
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
    TResult Function(double average, int count)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _RatingSummary() when $default != null:
        return $default(_that.average, _that.count);
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
    TResult Function(double average, int count) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _RatingSummary():
        return $default(_that.average, _that.count);
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
    TResult? Function(double average, int count)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _RatingSummary() when $default != null:
        return $default(_that.average, _that.count);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _RatingSummary implements RatingSummary {
  const _RatingSummary({required this.average, required this.count});
  factory _RatingSummary.fromJson(Map<String, dynamic> json) =>
      _$RatingSummaryFromJson(json);

  /// 1.0 to 5.0. Genuinely an approximate quantity, so `double` is the right
  /// type here — unlike money, nothing is settled against it.
  @override
  final double average;
  @override
  final int count;

  /// Create a copy of RatingSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$RatingSummaryCopyWith<_RatingSummary> get copyWith =>
      __$RatingSummaryCopyWithImpl<_RatingSummary>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$RatingSummaryToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _RatingSummary &&
            (identical(other.average, average) || other.average == average) &&
            (identical(other.count, count) || other.count == count));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, average, count);

  @override
  String toString() {
    return 'RatingSummary(average: $average, count: $count)';
  }
}

/// @nodoc
abstract mixin class _$RatingSummaryCopyWith<$Res>
    implements $RatingSummaryCopyWith<$Res> {
  factory _$RatingSummaryCopyWith(
          _RatingSummary value, $Res Function(_RatingSummary) _then) =
      __$RatingSummaryCopyWithImpl;
  @override
  @useResult
  $Res call({double average, int count});
}

/// @nodoc
class __$RatingSummaryCopyWithImpl<$Res>
    implements _$RatingSummaryCopyWith<$Res> {
  __$RatingSummaryCopyWithImpl(this._self, this._then);

  final _RatingSummary _self;
  final $Res Function(_RatingSummary) _then;

  /// Create a copy of RatingSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? average = null,
    Object? count = null,
  }) {
    return _then(_RatingSummary(
      average: null == average
          ? _self.average
          : average // ignore: cast_nullable_to_non_nullable
              as double,
      count: null == count
          ? _self.count
          : count // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
mixin _$CardPrice {
  @DecimalConverter()
  Decimal get amount;
  Currency get currency;
  @DecimalConverter()
  Decimal get vatRatePercent;
  bool get isFrom;

  /// Create a copy of CardPrice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $CardPriceCopyWith<CardPrice> get copyWith =>
      _$CardPriceCopyWithImpl<CardPrice>(this as CardPrice, _$identity);

  /// Serializes this CardPrice to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is CardPrice &&
            (identical(other.amount, amount) || other.amount == amount) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.vatRatePercent, vatRatePercent) ||
                other.vatRatePercent == vatRatePercent) &&
            (identical(other.isFrom, isFrom) || other.isFrom == isFrom));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, amount, currency, vatRatePercent, isFrom);

  @override
  String toString() {
    return 'CardPrice(amount: $amount, currency: $currency, vatRatePercent: $vatRatePercent, isFrom: $isFrom)';
  }
}

/// @nodoc
abstract mixin class $CardPriceCopyWith<$Res> {
  factory $CardPriceCopyWith(CardPrice value, $Res Function(CardPrice) _then) =
      _$CardPriceCopyWithImpl;
  @useResult
  $Res call(
      {@DecimalConverter() Decimal amount,
      Currency currency,
      @DecimalConverter() Decimal vatRatePercent,
      bool isFrom});
}

/// @nodoc
class _$CardPriceCopyWithImpl<$Res> implements $CardPriceCopyWith<$Res> {
  _$CardPriceCopyWithImpl(this._self, this._then);

  final CardPrice _self;
  final $Res Function(CardPrice) _then;

  /// Create a copy of CardPrice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? amount = null,
    Object? currency = null,
    Object? vatRatePercent = null,
    Object? isFrom = null,
  }) {
    return _then(_self.copyWith(
      amount: null == amount
          ? _self.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as Decimal,
      currency: null == currency
          ? _self.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as Currency,
      vatRatePercent: null == vatRatePercent
          ? _self.vatRatePercent
          : vatRatePercent // ignore: cast_nullable_to_non_nullable
              as Decimal,
      isFrom: null == isFrom
          ? _self.isFrom
          : isFrom // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// Adds pattern-matching-related methods to [CardPrice].
extension CardPricePatterns on CardPrice {
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
    TResult Function(_CardPrice value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _CardPrice() when $default != null:
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
    TResult Function(_CardPrice value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CardPrice():
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
    TResult? Function(_CardPrice value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CardPrice() when $default != null:
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
    TResult Function(@DecimalConverter() Decimal amount, Currency currency,
            @DecimalConverter() Decimal vatRatePercent, bool isFrom)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _CardPrice() when $default != null:
        return $default(
            _that.amount, _that.currency, _that.vatRatePercent, _that.isFrom);
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
    TResult Function(@DecimalConverter() Decimal amount, Currency currency,
            @DecimalConverter() Decimal vatRatePercent, bool isFrom)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CardPrice():
        return $default(
            _that.amount, _that.currency, _that.vatRatePercent, _that.isFrom);
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
    TResult? Function(@DecimalConverter() Decimal amount, Currency currency,
            @DecimalConverter() Decimal vatRatePercent, bool isFrom)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CardPrice() when $default != null:
        return $default(
            _that.amount, _that.currency, _that.vatRatePercent, _that.isFrom);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _CardPrice extends CardPrice {
  const _CardPrice(
      {@DecimalConverter() required this.amount,
      required this.currency,
      @DecimalConverter() required this.vatRatePercent,
      required this.isFrom})
      : super._();
  factory _CardPrice.fromJson(Map<String, dynamic> json) =>
      _$CardPriceFromJson(json);

  @override
  @DecimalConverter()
  final Decimal amount;
  @override
  final Currency currency;
  @override
  @DecimalConverter()
  final Decimal vatRatePercent;
  @override
  final bool isFrom;

  /// Create a copy of CardPrice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$CardPriceCopyWith<_CardPrice> get copyWith =>
      __$CardPriceCopyWithImpl<_CardPrice>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$CardPriceToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _CardPrice &&
            (identical(other.amount, amount) || other.amount == amount) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.vatRatePercent, vatRatePercent) ||
                other.vatRatePercent == vatRatePercent) &&
            (identical(other.isFrom, isFrom) || other.isFrom == isFrom));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, amount, currency, vatRatePercent, isFrom);

  @override
  String toString() {
    return 'CardPrice(amount: $amount, currency: $currency, vatRatePercent: $vatRatePercent, isFrom: $isFrom)';
  }
}

/// @nodoc
abstract mixin class _$CardPriceCopyWith<$Res>
    implements $CardPriceCopyWith<$Res> {
  factory _$CardPriceCopyWith(
          _CardPrice value, $Res Function(_CardPrice) _then) =
      __$CardPriceCopyWithImpl;
  @override
  @useResult
  $Res call(
      {@DecimalConverter() Decimal amount,
      Currency currency,
      @DecimalConverter() Decimal vatRatePercent,
      bool isFrom});
}

/// @nodoc
class __$CardPriceCopyWithImpl<$Res> implements _$CardPriceCopyWith<$Res> {
  __$CardPriceCopyWithImpl(this._self, this._then);

  final _CardPrice _self;
  final $Res Function(_CardPrice) _then;

  /// Create a copy of CardPrice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? amount = null,
    Object? currency = null,
    Object? vatRatePercent = null,
    Object? isFrom = null,
  }) {
    return _then(_CardPrice(
      amount: null == amount
          ? _self.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as Decimal,
      currency: null == currency
          ? _self.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as Currency,
      vatRatePercent: null == vatRatePercent
          ? _self.vatRatePercent
          : vatRatePercent // ignore: cast_nullable_to_non_nullable
              as Decimal,
      isFrom: null == isFrom
          ? _self.isFrom
          : isFrom // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
mixin _$PriceBand {
  Channel get channel;
  Currency get currency;
  int get minQty;
  int? get maxQty;
  @DecimalConverter()
  Decimal get price;
  @DecimalConverter()
  Decimal get vatRatePercent;

  /// Create a copy of PriceBand
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $PriceBandCopyWith<PriceBand> get copyWith =>
      _$PriceBandCopyWithImpl<PriceBand>(this as PriceBand, _$identity);

  /// Serializes this PriceBand to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is PriceBand &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.minQty, minQty) || other.minQty == minQty) &&
            (identical(other.maxQty, maxQty) || other.maxQty == maxQty) &&
            (identical(other.price, price) || other.price == price) &&
            (identical(other.vatRatePercent, vatRatePercent) ||
                other.vatRatePercent == vatRatePercent));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, channel, currency, minQty, maxQty, price, vatRatePercent);

  @override
  String toString() {
    return 'PriceBand(channel: $channel, currency: $currency, minQty: $minQty, maxQty: $maxQty, price: $price, vatRatePercent: $vatRatePercent)';
  }
}

/// @nodoc
abstract mixin class $PriceBandCopyWith<$Res> {
  factory $PriceBandCopyWith(PriceBand value, $Res Function(PriceBand) _then) =
      _$PriceBandCopyWithImpl;
  @useResult
  $Res call(
      {Channel channel,
      Currency currency,
      int minQty,
      int? maxQty,
      @DecimalConverter() Decimal price,
      @DecimalConverter() Decimal vatRatePercent});
}

/// @nodoc
class _$PriceBandCopyWithImpl<$Res> implements $PriceBandCopyWith<$Res> {
  _$PriceBandCopyWithImpl(this._self, this._then);

  final PriceBand _self;
  final $Res Function(PriceBand) _then;

  /// Create a copy of PriceBand
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? channel = null,
    Object? currency = null,
    Object? minQty = null,
    Object? maxQty = freezed,
    Object? price = null,
    Object? vatRatePercent = null,
  }) {
    return _then(_self.copyWith(
      channel: null == channel
          ? _self.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as Channel,
      currency: null == currency
          ? _self.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as Currency,
      minQty: null == minQty
          ? _self.minQty
          : minQty // ignore: cast_nullable_to_non_nullable
              as int,
      maxQty: freezed == maxQty
          ? _self.maxQty
          : maxQty // ignore: cast_nullable_to_non_nullable
              as int?,
      price: null == price
          ? _self.price
          : price // ignore: cast_nullable_to_non_nullable
              as Decimal,
      vatRatePercent: null == vatRatePercent
          ? _self.vatRatePercent
          : vatRatePercent // ignore: cast_nullable_to_non_nullable
              as Decimal,
    ));
  }
}

/// Adds pattern-matching-related methods to [PriceBand].
extension PriceBandPatterns on PriceBand {
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
    TResult Function(_PriceBand value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _PriceBand() when $default != null:
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
    TResult Function(_PriceBand value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _PriceBand():
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
    TResult? Function(_PriceBand value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _PriceBand() when $default != null:
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
            Channel channel,
            Currency currency,
            int minQty,
            int? maxQty,
            @DecimalConverter() Decimal price,
            @DecimalConverter() Decimal vatRatePercent)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _PriceBand() when $default != null:
        return $default(_that.channel, _that.currency, _that.minQty,
            _that.maxQty, _that.price, _that.vatRatePercent);
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
            Channel channel,
            Currency currency,
            int minQty,
            int? maxQty,
            @DecimalConverter() Decimal price,
            @DecimalConverter() Decimal vatRatePercent)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _PriceBand():
        return $default(_that.channel, _that.currency, _that.minQty,
            _that.maxQty, _that.price, _that.vatRatePercent);
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
            Channel channel,
            Currency currency,
            int minQty,
            int? maxQty,
            @DecimalConverter() Decimal price,
            @DecimalConverter() Decimal vatRatePercent)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _PriceBand() when $default != null:
        return $default(_that.channel, _that.currency, _that.minQty,
            _that.maxQty, _that.price, _that.vatRatePercent);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _PriceBand extends PriceBand {
  const _PriceBand(
      {required this.channel,
      required this.currency,
      required this.minQty,
      required this.maxQty,
      @DecimalConverter() required this.price,
      @DecimalConverter() required this.vatRatePercent})
      : super._();
  factory _PriceBand.fromJson(Map<String, dynamic> json) =>
      _$PriceBandFromJson(json);

  @override
  final Channel channel;
  @override
  final Currency currency;
  @override
  final int minQty;
  @override
  final int? maxQty;
  @override
  @DecimalConverter()
  final Decimal price;
  @override
  @DecimalConverter()
  final Decimal vatRatePercent;

  /// Create a copy of PriceBand
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$PriceBandCopyWith<_PriceBand> get copyWith =>
      __$PriceBandCopyWithImpl<_PriceBand>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$PriceBandToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _PriceBand &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.minQty, minQty) || other.minQty == minQty) &&
            (identical(other.maxQty, maxQty) || other.maxQty == maxQty) &&
            (identical(other.price, price) || other.price == price) &&
            (identical(other.vatRatePercent, vatRatePercent) ||
                other.vatRatePercent == vatRatePercent));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, channel, currency, minQty, maxQty, price, vatRatePercent);

  @override
  String toString() {
    return 'PriceBand(channel: $channel, currency: $currency, minQty: $minQty, maxQty: $maxQty, price: $price, vatRatePercent: $vatRatePercent)';
  }
}

/// @nodoc
abstract mixin class _$PriceBandCopyWith<$Res>
    implements $PriceBandCopyWith<$Res> {
  factory _$PriceBandCopyWith(
          _PriceBand value, $Res Function(_PriceBand) _then) =
      __$PriceBandCopyWithImpl;
  @override
  @useResult
  $Res call(
      {Channel channel,
      Currency currency,
      int minQty,
      int? maxQty,
      @DecimalConverter() Decimal price,
      @DecimalConverter() Decimal vatRatePercent});
}

/// @nodoc
class __$PriceBandCopyWithImpl<$Res> implements _$PriceBandCopyWith<$Res> {
  __$PriceBandCopyWithImpl(this._self, this._then);

  final _PriceBand _self;
  final $Res Function(_PriceBand) _then;

  /// Create a copy of PriceBand
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? channel = null,
    Object? currency = null,
    Object? minQty = null,
    Object? maxQty = freezed,
    Object? price = null,
    Object? vatRatePercent = null,
  }) {
    return _then(_PriceBand(
      channel: null == channel
          ? _self.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as Channel,
      currency: null == currency
          ? _self.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as Currency,
      minQty: null == minQty
          ? _self.minQty
          : minQty // ignore: cast_nullable_to_non_nullable
              as int,
      maxQty: freezed == maxQty
          ? _self.maxQty
          : maxQty // ignore: cast_nullable_to_non_nullable
              as int?,
      price: null == price
          ? _self.price
          : price // ignore: cast_nullable_to_non_nullable
              as Decimal,
      vatRatePercent: null == vatRatePercent
          ? _self.vatRatePercent
          : vatRatePercent // ignore: cast_nullable_to_non_nullable
              as Decimal,
    ));
  }
}

/// @nodoc
mixin _$ProductVariant {
  String get id;
  String get sku;
  String get nameEn;
  String? get nameAr;

  /// Free-form option values — `{"size": "XL", "voltage": 220}`. The
  /// contract admits string, number or boolean, so this stays
  /// `Map<String, Object?>`: coercing to `Map<String, String>` would print
  /// `220.0` for an integer attribute.
  Map<String, Object?> get attributes;
  List<PriceBand> get prices;
  Availability get availability;
  int get availableQty;

  /// Create a copy of ProductVariant
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $ProductVariantCopyWith<ProductVariant> get copyWith =>
      _$ProductVariantCopyWithImpl<ProductVariant>(
          this as ProductVariant, _$identity);

  /// Serializes this ProductVariant to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is ProductVariant &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.sku, sku) || other.sku == sku) &&
            (identical(other.nameEn, nameEn) || other.nameEn == nameEn) &&
            (identical(other.nameAr, nameAr) || other.nameAr == nameAr) &&
            const DeepCollectionEquality()
                .equals(other.attributes, attributes) &&
            const DeepCollectionEquality().equals(other.prices, prices) &&
            (identical(other.availability, availability) ||
                other.availability == availability) &&
            (identical(other.availableQty, availableQty) ||
                other.availableQty == availableQty));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      sku,
      nameEn,
      nameAr,
      const DeepCollectionEquality().hash(attributes),
      const DeepCollectionEquality().hash(prices),
      availability,
      availableQty);

  @override
  String toString() {
    return 'ProductVariant(id: $id, sku: $sku, nameEn: $nameEn, nameAr: $nameAr, attributes: $attributes, prices: $prices, availability: $availability, availableQty: $availableQty)';
  }
}

/// @nodoc
abstract mixin class $ProductVariantCopyWith<$Res> {
  factory $ProductVariantCopyWith(
          ProductVariant value, $Res Function(ProductVariant) _then) =
      _$ProductVariantCopyWithImpl;
  @useResult
  $Res call(
      {String id,
      String sku,
      String nameEn,
      String? nameAr,
      Map<String, Object?> attributes,
      List<PriceBand> prices,
      Availability availability,
      int availableQty});
}

/// @nodoc
class _$ProductVariantCopyWithImpl<$Res>
    implements $ProductVariantCopyWith<$Res> {
  _$ProductVariantCopyWithImpl(this._self, this._then);

  final ProductVariant _self;
  final $Res Function(ProductVariant) _then;

  /// Create a copy of ProductVariant
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? sku = null,
    Object? nameEn = null,
    Object? nameAr = freezed,
    Object? attributes = null,
    Object? prices = null,
    Object? availability = null,
    Object? availableQty = null,
  }) {
    return _then(_self.copyWith(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      sku: null == sku
          ? _self.sku
          : sku // ignore: cast_nullable_to_non_nullable
              as String,
      nameEn: null == nameEn
          ? _self.nameEn
          : nameEn // ignore: cast_nullable_to_non_nullable
              as String,
      nameAr: freezed == nameAr
          ? _self.nameAr
          : nameAr // ignore: cast_nullable_to_non_nullable
              as String?,
      attributes: null == attributes
          ? _self.attributes
          : attributes // ignore: cast_nullable_to_non_nullable
              as Map<String, Object?>,
      prices: null == prices
          ? _self.prices
          : prices // ignore: cast_nullable_to_non_nullable
              as List<PriceBand>,
      availability: null == availability
          ? _self.availability
          : availability // ignore: cast_nullable_to_non_nullable
              as Availability,
      availableQty: null == availableQty
          ? _self.availableQty
          : availableQty // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// Adds pattern-matching-related methods to [ProductVariant].
extension ProductVariantPatterns on ProductVariant {
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
    TResult Function(_ProductVariant value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _ProductVariant() when $default != null:
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
    TResult Function(_ProductVariant value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ProductVariant():
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
    TResult? Function(_ProductVariant value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ProductVariant() when $default != null:
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
            String id,
            String sku,
            String nameEn,
            String? nameAr,
            Map<String, Object?> attributes,
            List<PriceBand> prices,
            Availability availability,
            int availableQty)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _ProductVariant() when $default != null:
        return $default(
            _that.id,
            _that.sku,
            _that.nameEn,
            _that.nameAr,
            _that.attributes,
            _that.prices,
            _that.availability,
            _that.availableQty);
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
            String id,
            String sku,
            String nameEn,
            String? nameAr,
            Map<String, Object?> attributes,
            List<PriceBand> prices,
            Availability availability,
            int availableQty)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ProductVariant():
        return $default(
            _that.id,
            _that.sku,
            _that.nameEn,
            _that.nameAr,
            _that.attributes,
            _that.prices,
            _that.availability,
            _that.availableQty);
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
            String id,
            String sku,
            String nameEn,
            String? nameAr,
            Map<String, Object?> attributes,
            List<PriceBand> prices,
            Availability availability,
            int availableQty)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ProductVariant() when $default != null:
        return $default(
            _that.id,
            _that.sku,
            _that.nameEn,
            _that.nameAr,
            _that.attributes,
            _that.prices,
            _that.availability,
            _that.availableQty);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _ProductVariant extends ProductVariant {
  const _ProductVariant(
      {required this.id,
      required this.sku,
      required this.nameEn,
      required this.nameAr,
      required final Map<String, Object?> attributes,
      required final List<PriceBand> prices,
      required this.availability,
      required this.availableQty})
      : _attributes = attributes,
        _prices = prices,
        super._();
  factory _ProductVariant.fromJson(Map<String, dynamic> json) =>
      _$ProductVariantFromJson(json);

  @override
  final String id;
  @override
  final String sku;
  @override
  final String nameEn;
  @override
  final String? nameAr;

  /// Free-form option values — `{"size": "XL", "voltage": 220}`. The
  /// contract admits string, number or boolean, so this stays
  /// `Map<String, Object?>`: coercing to `Map<String, String>` would print
  /// `220.0` for an integer attribute.
  final Map<String, Object?> _attributes;

  /// Free-form option values — `{"size": "XL", "voltage": 220}`. The
  /// contract admits string, number or boolean, so this stays
  /// `Map<String, Object?>`: coercing to `Map<String, String>` would print
  /// `220.0` for an integer attribute.
  @override
  Map<String, Object?> get attributes {
    if (_attributes is EqualUnmodifiableMapView) return _attributes;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(_attributes);
  }

  final List<PriceBand> _prices;
  @override
  List<PriceBand> get prices {
    if (_prices is EqualUnmodifiableListView) return _prices;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_prices);
  }

  @override
  final Availability availability;
  @override
  final int availableQty;

  /// Create a copy of ProductVariant
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$ProductVariantCopyWith<_ProductVariant> get copyWith =>
      __$ProductVariantCopyWithImpl<_ProductVariant>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$ProductVariantToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _ProductVariant &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.sku, sku) || other.sku == sku) &&
            (identical(other.nameEn, nameEn) || other.nameEn == nameEn) &&
            (identical(other.nameAr, nameAr) || other.nameAr == nameAr) &&
            const DeepCollectionEquality()
                .equals(other._attributes, _attributes) &&
            const DeepCollectionEquality().equals(other._prices, _prices) &&
            (identical(other.availability, availability) ||
                other.availability == availability) &&
            (identical(other.availableQty, availableQty) ||
                other.availableQty == availableQty));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      sku,
      nameEn,
      nameAr,
      const DeepCollectionEquality().hash(_attributes),
      const DeepCollectionEquality().hash(_prices),
      availability,
      availableQty);

  @override
  String toString() {
    return 'ProductVariant(id: $id, sku: $sku, nameEn: $nameEn, nameAr: $nameAr, attributes: $attributes, prices: $prices, availability: $availability, availableQty: $availableQty)';
  }
}

/// @nodoc
abstract mixin class _$ProductVariantCopyWith<$Res>
    implements $ProductVariantCopyWith<$Res> {
  factory _$ProductVariantCopyWith(
          _ProductVariant value, $Res Function(_ProductVariant) _then) =
      __$ProductVariantCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String id,
      String sku,
      String nameEn,
      String? nameAr,
      Map<String, Object?> attributes,
      List<PriceBand> prices,
      Availability availability,
      int availableQty});
}

/// @nodoc
class __$ProductVariantCopyWithImpl<$Res>
    implements _$ProductVariantCopyWith<$Res> {
  __$ProductVariantCopyWithImpl(this._self, this._then);

  final _ProductVariant _self;
  final $Res Function(_ProductVariant) _then;

  /// Create a copy of ProductVariant
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? id = null,
    Object? sku = null,
    Object? nameEn = null,
    Object? nameAr = freezed,
    Object? attributes = null,
    Object? prices = null,
    Object? availability = null,
    Object? availableQty = null,
  }) {
    return _then(_ProductVariant(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      sku: null == sku
          ? _self.sku
          : sku // ignore: cast_nullable_to_non_nullable
              as String,
      nameEn: null == nameEn
          ? _self.nameEn
          : nameEn // ignore: cast_nullable_to_non_nullable
              as String,
      nameAr: freezed == nameAr
          ? _self.nameAr
          : nameAr // ignore: cast_nullable_to_non_nullable
              as String?,
      attributes: null == attributes
          ? _self._attributes
          : attributes // ignore: cast_nullable_to_non_nullable
              as Map<String, Object?>,
      prices: null == prices
          ? _self._prices
          : prices // ignore: cast_nullable_to_non_nullable
              as List<PriceBand>,
      availability: null == availability
          ? _self.availability
          : availability // ignore: cast_nullable_to_non_nullable
              as Availability,
      availableQty: null == availableQty
          ? _self.availableQty
          : availableQty // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
mixin _$SellerSummary {
  String get id;
  String get businessNameEn;
  String? get businessNameAr;
  SellerTier get tier;
  String get city;

  /// ISO-3166 alpha-2. NOT the [Country] enum: the contract types this as a
  /// bare two-character string, so a seller registered outside the six GCC
  /// markets still parses instead of throwing on a screen that only wanted
  /// to print it.
  String get country;
  RatingSummary? get rating;

  /// Create a copy of SellerSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $SellerSummaryCopyWith<SellerSummary> get copyWith =>
      _$SellerSummaryCopyWithImpl<SellerSummary>(
          this as SellerSummary, _$identity);

  /// Serializes this SellerSummary to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is SellerSummary &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.businessNameEn, businessNameEn) ||
                other.businessNameEn == businessNameEn) &&
            (identical(other.businessNameAr, businessNameAr) ||
                other.businessNameAr == businessNameAr) &&
            (identical(other.tier, tier) || other.tier == tier) &&
            (identical(other.city, city) || other.city == city) &&
            (identical(other.country, country) || other.country == country) &&
            (identical(other.rating, rating) || other.rating == rating));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, businessNameEn,
      businessNameAr, tier, city, country, rating);

  @override
  String toString() {
    return 'SellerSummary(id: $id, businessNameEn: $businessNameEn, businessNameAr: $businessNameAr, tier: $tier, city: $city, country: $country, rating: $rating)';
  }
}

/// @nodoc
abstract mixin class $SellerSummaryCopyWith<$Res> {
  factory $SellerSummaryCopyWith(
          SellerSummary value, $Res Function(SellerSummary) _then) =
      _$SellerSummaryCopyWithImpl;
  @useResult
  $Res call(
      {String id,
      String businessNameEn,
      String? businessNameAr,
      SellerTier tier,
      String city,
      String country,
      RatingSummary? rating});

  $RatingSummaryCopyWith<$Res>? get rating;
}

/// @nodoc
class _$SellerSummaryCopyWithImpl<$Res>
    implements $SellerSummaryCopyWith<$Res> {
  _$SellerSummaryCopyWithImpl(this._self, this._then);

  final SellerSummary _self;
  final $Res Function(SellerSummary) _then;

  /// Create a copy of SellerSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? businessNameEn = null,
    Object? businessNameAr = freezed,
    Object? tier = null,
    Object? city = null,
    Object? country = null,
    Object? rating = freezed,
  }) {
    return _then(_self.copyWith(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      businessNameEn: null == businessNameEn
          ? _self.businessNameEn
          : businessNameEn // ignore: cast_nullable_to_non_nullable
              as String,
      businessNameAr: freezed == businessNameAr
          ? _self.businessNameAr
          : businessNameAr // ignore: cast_nullable_to_non_nullable
              as String?,
      tier: null == tier
          ? _self.tier
          : tier // ignore: cast_nullable_to_non_nullable
              as SellerTier,
      city: null == city
          ? _self.city
          : city // ignore: cast_nullable_to_non_nullable
              as String,
      country: null == country
          ? _self.country
          : country // ignore: cast_nullable_to_non_nullable
              as String,
      rating: freezed == rating
          ? _self.rating
          : rating // ignore: cast_nullable_to_non_nullable
              as RatingSummary?,
    ));
  }

  /// Create a copy of SellerSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $RatingSummaryCopyWith<$Res>? get rating {
    if (_self.rating == null) {
      return null;
    }

    return $RatingSummaryCopyWith<$Res>(_self.rating!, (value) {
      return _then(_self.copyWith(rating: value));
    });
  }
}

/// Adds pattern-matching-related methods to [SellerSummary].
extension SellerSummaryPatterns on SellerSummary {
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
    TResult Function(_SellerSummary value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _SellerSummary() when $default != null:
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
    TResult Function(_SellerSummary value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _SellerSummary():
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
    TResult? Function(_SellerSummary value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _SellerSummary() when $default != null:
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
            String id,
            String businessNameEn,
            String? businessNameAr,
            SellerTier tier,
            String city,
            String country,
            RatingSummary? rating)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _SellerSummary() when $default != null:
        return $default(_that.id, _that.businessNameEn, _that.businessNameAr,
            _that.tier, _that.city, _that.country, _that.rating);
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
    TResult Function(String id, String businessNameEn, String? businessNameAr,
            SellerTier tier, String city, String country, RatingSummary? rating)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _SellerSummary():
        return $default(_that.id, _that.businessNameEn, _that.businessNameAr,
            _that.tier, _that.city, _that.country, _that.rating);
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
            String id,
            String businessNameEn,
            String? businessNameAr,
            SellerTier tier,
            String city,
            String country,
            RatingSummary? rating)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _SellerSummary() when $default != null:
        return $default(_that.id, _that.businessNameEn, _that.businessNameAr,
            _that.tier, _that.city, _that.country, _that.rating);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _SellerSummary implements SellerSummary {
  const _SellerSummary(
      {required this.id,
      required this.businessNameEn,
      required this.businessNameAr,
      required this.tier,
      required this.city,
      required this.country,
      required this.rating});
  factory _SellerSummary.fromJson(Map<String, dynamic> json) =>
      _$SellerSummaryFromJson(json);

  @override
  final String id;
  @override
  final String businessNameEn;
  @override
  final String? businessNameAr;
  @override
  final SellerTier tier;
  @override
  final String city;

  /// ISO-3166 alpha-2. NOT the [Country] enum: the contract types this as a
  /// bare two-character string, so a seller registered outside the six GCC
  /// markets still parses instead of throwing on a screen that only wanted
  /// to print it.
  @override
  final String country;
  @override
  final RatingSummary? rating;

  /// Create a copy of SellerSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$SellerSummaryCopyWith<_SellerSummary> get copyWith =>
      __$SellerSummaryCopyWithImpl<_SellerSummary>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$SellerSummaryToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _SellerSummary &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.businessNameEn, businessNameEn) ||
                other.businessNameEn == businessNameEn) &&
            (identical(other.businessNameAr, businessNameAr) ||
                other.businessNameAr == businessNameAr) &&
            (identical(other.tier, tier) || other.tier == tier) &&
            (identical(other.city, city) || other.city == city) &&
            (identical(other.country, country) || other.country == country) &&
            (identical(other.rating, rating) || other.rating == rating));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, businessNameEn,
      businessNameAr, tier, city, country, rating);

  @override
  String toString() {
    return 'SellerSummary(id: $id, businessNameEn: $businessNameEn, businessNameAr: $businessNameAr, tier: $tier, city: $city, country: $country, rating: $rating)';
  }
}

/// @nodoc
abstract mixin class _$SellerSummaryCopyWith<$Res>
    implements $SellerSummaryCopyWith<$Res> {
  factory _$SellerSummaryCopyWith(
          _SellerSummary value, $Res Function(_SellerSummary) _then) =
      __$SellerSummaryCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String id,
      String businessNameEn,
      String? businessNameAr,
      SellerTier tier,
      String city,
      String country,
      RatingSummary? rating});

  @override
  $RatingSummaryCopyWith<$Res>? get rating;
}

/// @nodoc
class __$SellerSummaryCopyWithImpl<$Res>
    implements _$SellerSummaryCopyWith<$Res> {
  __$SellerSummaryCopyWithImpl(this._self, this._then);

  final _SellerSummary _self;
  final $Res Function(_SellerSummary) _then;

  /// Create a copy of SellerSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? id = null,
    Object? businessNameEn = null,
    Object? businessNameAr = freezed,
    Object? tier = null,
    Object? city = null,
    Object? country = null,
    Object? rating = freezed,
  }) {
    return _then(_SellerSummary(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      businessNameEn: null == businessNameEn
          ? _self.businessNameEn
          : businessNameEn // ignore: cast_nullable_to_non_nullable
              as String,
      businessNameAr: freezed == businessNameAr
          ? _self.businessNameAr
          : businessNameAr // ignore: cast_nullable_to_non_nullable
              as String?,
      tier: null == tier
          ? _self.tier
          : tier // ignore: cast_nullable_to_non_nullable
              as SellerTier,
      city: null == city
          ? _self.city
          : city // ignore: cast_nullable_to_non_nullable
              as String,
      country: null == country
          ? _self.country
          : country // ignore: cast_nullable_to_non_nullable
              as String,
      rating: freezed == rating
          ? _self.rating
          : rating // ignore: cast_nullable_to_non_nullable
              as RatingSummary?,
    ));
  }

  /// Create a copy of SellerSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $RatingSummaryCopyWith<$Res>? get rating {
    if (_self.rating == null) {
      return null;
    }

    return $RatingSummaryCopyWith<$Res>(_self.rating!, (value) {
      return _then(_self.copyWith(rating: value));
    });
  }
}

/// @nodoc
mixin _$ProductCard {
  String get id;
  String get slug;
  String get nameEn;
  String get nameAr;
  ImageRef? get image;

  /// Null when nothing is priced in the requested channel and currency —
  /// which is a real catalogue state, not an error. The card renders
  /// "price on request", it does not render zero.
  CardPrice? get price;
  int get moq;
  Availability get availability;
  bool get priceTiered;
  RatingSummary? get rating;
  String? get brandName;

  /// Create a copy of ProductCard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $ProductCardCopyWith<ProductCard> get copyWith =>
      _$ProductCardCopyWithImpl<ProductCard>(this as ProductCard, _$identity);

  /// Serializes this ProductCard to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is ProductCard &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.slug, slug) || other.slug == slug) &&
            (identical(other.nameEn, nameEn) || other.nameEn == nameEn) &&
            (identical(other.nameAr, nameAr) || other.nameAr == nameAr) &&
            (identical(other.image, image) || other.image == image) &&
            (identical(other.price, price) || other.price == price) &&
            (identical(other.moq, moq) || other.moq == moq) &&
            (identical(other.availability, availability) ||
                other.availability == availability) &&
            (identical(other.priceTiered, priceTiered) ||
                other.priceTiered == priceTiered) &&
            (identical(other.rating, rating) || other.rating == rating) &&
            (identical(other.brandName, brandName) ||
                other.brandName == brandName));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, slug, nameEn, nameAr, image,
      price, moq, availability, priceTiered, rating, brandName);

  @override
  String toString() {
    return 'ProductCard(id: $id, slug: $slug, nameEn: $nameEn, nameAr: $nameAr, image: $image, price: $price, moq: $moq, availability: $availability, priceTiered: $priceTiered, rating: $rating, brandName: $brandName)';
  }
}

/// @nodoc
abstract mixin class $ProductCardCopyWith<$Res> {
  factory $ProductCardCopyWith(
          ProductCard value, $Res Function(ProductCard) _then) =
      _$ProductCardCopyWithImpl;
  @useResult
  $Res call(
      {String id,
      String slug,
      String nameEn,
      String nameAr,
      ImageRef? image,
      CardPrice? price,
      int moq,
      Availability availability,
      bool priceTiered,
      RatingSummary? rating,
      String? brandName});

  $ImageRefCopyWith<$Res>? get image;
  $CardPriceCopyWith<$Res>? get price;
  $RatingSummaryCopyWith<$Res>? get rating;
}

/// @nodoc
class _$ProductCardCopyWithImpl<$Res> implements $ProductCardCopyWith<$Res> {
  _$ProductCardCopyWithImpl(this._self, this._then);

  final ProductCard _self;
  final $Res Function(ProductCard) _then;

  /// Create a copy of ProductCard
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? slug = null,
    Object? nameEn = null,
    Object? nameAr = null,
    Object? image = freezed,
    Object? price = freezed,
    Object? moq = null,
    Object? availability = null,
    Object? priceTiered = null,
    Object? rating = freezed,
    Object? brandName = freezed,
  }) {
    return _then(_self.copyWith(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      slug: null == slug
          ? _self.slug
          : slug // ignore: cast_nullable_to_non_nullable
              as String,
      nameEn: null == nameEn
          ? _self.nameEn
          : nameEn // ignore: cast_nullable_to_non_nullable
              as String,
      nameAr: null == nameAr
          ? _self.nameAr
          : nameAr // ignore: cast_nullable_to_non_nullable
              as String,
      image: freezed == image
          ? _self.image
          : image // ignore: cast_nullable_to_non_nullable
              as ImageRef?,
      price: freezed == price
          ? _self.price
          : price // ignore: cast_nullable_to_non_nullable
              as CardPrice?,
      moq: null == moq
          ? _self.moq
          : moq // ignore: cast_nullable_to_non_nullable
              as int,
      availability: null == availability
          ? _self.availability
          : availability // ignore: cast_nullable_to_non_nullable
              as Availability,
      priceTiered: null == priceTiered
          ? _self.priceTiered
          : priceTiered // ignore: cast_nullable_to_non_nullable
              as bool,
      rating: freezed == rating
          ? _self.rating
          : rating // ignore: cast_nullable_to_non_nullable
              as RatingSummary?,
      brandName: freezed == brandName
          ? _self.brandName
          : brandName // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }

  /// Create a copy of ProductCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ImageRefCopyWith<$Res>? get image {
    if (_self.image == null) {
      return null;
    }

    return $ImageRefCopyWith<$Res>(_self.image!, (value) {
      return _then(_self.copyWith(image: value));
    });
  }

  /// Create a copy of ProductCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $CardPriceCopyWith<$Res>? get price {
    if (_self.price == null) {
      return null;
    }

    return $CardPriceCopyWith<$Res>(_self.price!, (value) {
      return _then(_self.copyWith(price: value));
    });
  }

  /// Create a copy of ProductCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $RatingSummaryCopyWith<$Res>? get rating {
    if (_self.rating == null) {
      return null;
    }

    return $RatingSummaryCopyWith<$Res>(_self.rating!, (value) {
      return _then(_self.copyWith(rating: value));
    });
  }
}

/// Adds pattern-matching-related methods to [ProductCard].
extension ProductCardPatterns on ProductCard {
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
    TResult Function(_ProductCard value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _ProductCard() when $default != null:
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
    TResult Function(_ProductCard value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ProductCard():
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
    TResult? Function(_ProductCard value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ProductCard() when $default != null:
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
            String id,
            String slug,
            String nameEn,
            String nameAr,
            ImageRef? image,
            CardPrice? price,
            int moq,
            Availability availability,
            bool priceTiered,
            RatingSummary? rating,
            String? brandName)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _ProductCard() when $default != null:
        return $default(
            _that.id,
            _that.slug,
            _that.nameEn,
            _that.nameAr,
            _that.image,
            _that.price,
            _that.moq,
            _that.availability,
            _that.priceTiered,
            _that.rating,
            _that.brandName);
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
            String id,
            String slug,
            String nameEn,
            String nameAr,
            ImageRef? image,
            CardPrice? price,
            int moq,
            Availability availability,
            bool priceTiered,
            RatingSummary? rating,
            String? brandName)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ProductCard():
        return $default(
            _that.id,
            _that.slug,
            _that.nameEn,
            _that.nameAr,
            _that.image,
            _that.price,
            _that.moq,
            _that.availability,
            _that.priceTiered,
            _that.rating,
            _that.brandName);
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
            String id,
            String slug,
            String nameEn,
            String nameAr,
            ImageRef? image,
            CardPrice? price,
            int moq,
            Availability availability,
            bool priceTiered,
            RatingSummary? rating,
            String? brandName)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ProductCard() when $default != null:
        return $default(
            _that.id,
            _that.slug,
            _that.nameEn,
            _that.nameAr,
            _that.image,
            _that.price,
            _that.moq,
            _that.availability,
            _that.priceTiered,
            _that.rating,
            _that.brandName);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _ProductCard extends ProductCard {
  const _ProductCard(
      {required this.id,
      required this.slug,
      required this.nameEn,
      required this.nameAr,
      required this.image,
      required this.price,
      required this.moq,
      required this.availability,
      required this.priceTiered,
      required this.rating,
      required this.brandName})
      : super._();
  factory _ProductCard.fromJson(Map<String, dynamic> json) =>
      _$ProductCardFromJson(json);

  @override
  final String id;
  @override
  final String slug;
  @override
  final String nameEn;
  @override
  final String nameAr;
  @override
  final ImageRef? image;

  /// Null when nothing is priced in the requested channel and currency —
  /// which is a real catalogue state, not an error. The card renders
  /// "price on request", it does not render zero.
  @override
  final CardPrice? price;
  @override
  final int moq;
  @override
  final Availability availability;
  @override
  final bool priceTiered;
  @override
  final RatingSummary? rating;
  @override
  final String? brandName;

  /// Create a copy of ProductCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$ProductCardCopyWith<_ProductCard> get copyWith =>
      __$ProductCardCopyWithImpl<_ProductCard>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$ProductCardToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _ProductCard &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.slug, slug) || other.slug == slug) &&
            (identical(other.nameEn, nameEn) || other.nameEn == nameEn) &&
            (identical(other.nameAr, nameAr) || other.nameAr == nameAr) &&
            (identical(other.image, image) || other.image == image) &&
            (identical(other.price, price) || other.price == price) &&
            (identical(other.moq, moq) || other.moq == moq) &&
            (identical(other.availability, availability) ||
                other.availability == availability) &&
            (identical(other.priceTiered, priceTiered) ||
                other.priceTiered == priceTiered) &&
            (identical(other.rating, rating) || other.rating == rating) &&
            (identical(other.brandName, brandName) ||
                other.brandName == brandName));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, slug, nameEn, nameAr, image,
      price, moq, availability, priceTiered, rating, brandName);

  @override
  String toString() {
    return 'ProductCard(id: $id, slug: $slug, nameEn: $nameEn, nameAr: $nameAr, image: $image, price: $price, moq: $moq, availability: $availability, priceTiered: $priceTiered, rating: $rating, brandName: $brandName)';
  }
}

/// @nodoc
abstract mixin class _$ProductCardCopyWith<$Res>
    implements $ProductCardCopyWith<$Res> {
  factory _$ProductCardCopyWith(
          _ProductCard value, $Res Function(_ProductCard) _then) =
      __$ProductCardCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String id,
      String slug,
      String nameEn,
      String nameAr,
      ImageRef? image,
      CardPrice? price,
      int moq,
      Availability availability,
      bool priceTiered,
      RatingSummary? rating,
      String? brandName});

  @override
  $ImageRefCopyWith<$Res>? get image;
  @override
  $CardPriceCopyWith<$Res>? get price;
  @override
  $RatingSummaryCopyWith<$Res>? get rating;
}

/// @nodoc
class __$ProductCardCopyWithImpl<$Res> implements _$ProductCardCopyWith<$Res> {
  __$ProductCardCopyWithImpl(this._self, this._then);

  final _ProductCard _self;
  final $Res Function(_ProductCard) _then;

  /// Create a copy of ProductCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? id = null,
    Object? slug = null,
    Object? nameEn = null,
    Object? nameAr = null,
    Object? image = freezed,
    Object? price = freezed,
    Object? moq = null,
    Object? availability = null,
    Object? priceTiered = null,
    Object? rating = freezed,
    Object? brandName = freezed,
  }) {
    return _then(_ProductCard(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      slug: null == slug
          ? _self.slug
          : slug // ignore: cast_nullable_to_non_nullable
              as String,
      nameEn: null == nameEn
          ? _self.nameEn
          : nameEn // ignore: cast_nullable_to_non_nullable
              as String,
      nameAr: null == nameAr
          ? _self.nameAr
          : nameAr // ignore: cast_nullable_to_non_nullable
              as String,
      image: freezed == image
          ? _self.image
          : image // ignore: cast_nullable_to_non_nullable
              as ImageRef?,
      price: freezed == price
          ? _self.price
          : price // ignore: cast_nullable_to_non_nullable
              as CardPrice?,
      moq: null == moq
          ? _self.moq
          : moq // ignore: cast_nullable_to_non_nullable
              as int,
      availability: null == availability
          ? _self.availability
          : availability // ignore: cast_nullable_to_non_nullable
              as Availability,
      priceTiered: null == priceTiered
          ? _self.priceTiered
          : priceTiered // ignore: cast_nullable_to_non_nullable
              as bool,
      rating: freezed == rating
          ? _self.rating
          : rating // ignore: cast_nullable_to_non_nullable
              as RatingSummary?,
      brandName: freezed == brandName
          ? _self.brandName
          : brandName // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }

  /// Create a copy of ProductCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ImageRefCopyWith<$Res>? get image {
    if (_self.image == null) {
      return null;
    }

    return $ImageRefCopyWith<$Res>(_self.image!, (value) {
      return _then(_self.copyWith(image: value));
    });
  }

  /// Create a copy of ProductCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $CardPriceCopyWith<$Res>? get price {
    if (_self.price == null) {
      return null;
    }

    return $CardPriceCopyWith<$Res>(_self.price!, (value) {
      return _then(_self.copyWith(price: value));
    });
  }

  /// Create a copy of ProductCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $RatingSummaryCopyWith<$Res>? get rating {
    if (_self.rating == null) {
      return null;
    }

    return $RatingSummaryCopyWith<$Res>(_self.rating!, (value) {
      return _then(_self.copyWith(rating: value));
    });
  }
}

/// @nodoc
mixin _$ProductBrandRef {
  String get id;
  String get nameEn;
  String? get nameAr;

  /// Create a copy of ProductBrandRef
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $ProductBrandRefCopyWith<ProductBrandRef> get copyWith =>
      _$ProductBrandRefCopyWithImpl<ProductBrandRef>(
          this as ProductBrandRef, _$identity);

  /// Serializes this ProductBrandRef to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is ProductBrandRef &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.nameEn, nameEn) || other.nameEn == nameEn) &&
            (identical(other.nameAr, nameAr) || other.nameAr == nameAr));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, nameEn, nameAr);

  @override
  String toString() {
    return 'ProductBrandRef(id: $id, nameEn: $nameEn, nameAr: $nameAr)';
  }
}

/// @nodoc
abstract mixin class $ProductBrandRefCopyWith<$Res> {
  factory $ProductBrandRefCopyWith(
          ProductBrandRef value, $Res Function(ProductBrandRef) _then) =
      _$ProductBrandRefCopyWithImpl;
  @useResult
  $Res call({String id, String nameEn, String? nameAr});
}

/// @nodoc
class _$ProductBrandRefCopyWithImpl<$Res>
    implements $ProductBrandRefCopyWith<$Res> {
  _$ProductBrandRefCopyWithImpl(this._self, this._then);

  final ProductBrandRef _self;
  final $Res Function(ProductBrandRef) _then;

  /// Create a copy of ProductBrandRef
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? nameEn = null,
    Object? nameAr = freezed,
  }) {
    return _then(_self.copyWith(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      nameEn: null == nameEn
          ? _self.nameEn
          : nameEn // ignore: cast_nullable_to_non_nullable
              as String,
      nameAr: freezed == nameAr
          ? _self.nameAr
          : nameAr // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// Adds pattern-matching-related methods to [ProductBrandRef].
extension ProductBrandRefPatterns on ProductBrandRef {
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
    TResult Function(_ProductBrandRef value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _ProductBrandRef() when $default != null:
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
    TResult Function(_ProductBrandRef value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ProductBrandRef():
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
    TResult? Function(_ProductBrandRef value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ProductBrandRef() when $default != null:
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
    TResult Function(String id, String nameEn, String? nameAr)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _ProductBrandRef() when $default != null:
        return $default(_that.id, _that.nameEn, _that.nameAr);
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
    TResult Function(String id, String nameEn, String? nameAr) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ProductBrandRef():
        return $default(_that.id, _that.nameEn, _that.nameAr);
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
    TResult? Function(String id, String nameEn, String? nameAr)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ProductBrandRef() when $default != null:
        return $default(_that.id, _that.nameEn, _that.nameAr);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _ProductBrandRef implements ProductBrandRef {
  const _ProductBrandRef(
      {required this.id, required this.nameEn, required this.nameAr});
  factory _ProductBrandRef.fromJson(Map<String, dynamic> json) =>
      _$ProductBrandRefFromJson(json);

  @override
  final String id;
  @override
  final String nameEn;
  @override
  final String? nameAr;

  /// Create a copy of ProductBrandRef
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$ProductBrandRefCopyWith<_ProductBrandRef> get copyWith =>
      __$ProductBrandRefCopyWithImpl<_ProductBrandRef>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$ProductBrandRefToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _ProductBrandRef &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.nameEn, nameEn) || other.nameEn == nameEn) &&
            (identical(other.nameAr, nameAr) || other.nameAr == nameAr));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, nameEn, nameAr);

  @override
  String toString() {
    return 'ProductBrandRef(id: $id, nameEn: $nameEn, nameAr: $nameAr)';
  }
}

/// @nodoc
abstract mixin class _$ProductBrandRefCopyWith<$Res>
    implements $ProductBrandRefCopyWith<$Res> {
  factory _$ProductBrandRefCopyWith(
          _ProductBrandRef value, $Res Function(_ProductBrandRef) _then) =
      __$ProductBrandRefCopyWithImpl;
  @override
  @useResult
  $Res call({String id, String nameEn, String? nameAr});
}

/// @nodoc
class __$ProductBrandRefCopyWithImpl<$Res>
    implements _$ProductBrandRefCopyWith<$Res> {
  __$ProductBrandRefCopyWithImpl(this._self, this._then);

  final _ProductBrandRef _self;
  final $Res Function(_ProductBrandRef) _then;

  /// Create a copy of ProductBrandRef
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? id = null,
    Object? nameEn = null,
    Object? nameAr = freezed,
  }) {
    return _then(_ProductBrandRef(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      nameEn: null == nameEn
          ? _self.nameEn
          : nameEn // ignore: cast_nullable_to_non_nullable
              as String,
      nameAr: freezed == nameAr
          ? _self.nameAr
          : nameAr // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
mixin _$ProductCategoryRef {
  String get id;
  String get slug;
  String get nameEn;
  String get nameAr;

  /// Create a copy of ProductCategoryRef
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $ProductCategoryRefCopyWith<ProductCategoryRef> get copyWith =>
      _$ProductCategoryRefCopyWithImpl<ProductCategoryRef>(
          this as ProductCategoryRef, _$identity);

  /// Serializes this ProductCategoryRef to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is ProductCategoryRef &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.slug, slug) || other.slug == slug) &&
            (identical(other.nameEn, nameEn) || other.nameEn == nameEn) &&
            (identical(other.nameAr, nameAr) || other.nameAr == nameAr));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, slug, nameEn, nameAr);

  @override
  String toString() {
    return 'ProductCategoryRef(id: $id, slug: $slug, nameEn: $nameEn, nameAr: $nameAr)';
  }
}

/// @nodoc
abstract mixin class $ProductCategoryRefCopyWith<$Res> {
  factory $ProductCategoryRefCopyWith(
          ProductCategoryRef value, $Res Function(ProductCategoryRef) _then) =
      _$ProductCategoryRefCopyWithImpl;
  @useResult
  $Res call({String id, String slug, String nameEn, String nameAr});
}

/// @nodoc
class _$ProductCategoryRefCopyWithImpl<$Res>
    implements $ProductCategoryRefCopyWith<$Res> {
  _$ProductCategoryRefCopyWithImpl(this._self, this._then);

  final ProductCategoryRef _self;
  final $Res Function(ProductCategoryRef) _then;

  /// Create a copy of ProductCategoryRef
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? slug = null,
    Object? nameEn = null,
    Object? nameAr = null,
  }) {
    return _then(_self.copyWith(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      slug: null == slug
          ? _self.slug
          : slug // ignore: cast_nullable_to_non_nullable
              as String,
      nameEn: null == nameEn
          ? _self.nameEn
          : nameEn // ignore: cast_nullable_to_non_nullable
              as String,
      nameAr: null == nameAr
          ? _self.nameAr
          : nameAr // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// Adds pattern-matching-related methods to [ProductCategoryRef].
extension ProductCategoryRefPatterns on ProductCategoryRef {
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
    TResult Function(_ProductCategoryRef value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _ProductCategoryRef() when $default != null:
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
    TResult Function(_ProductCategoryRef value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ProductCategoryRef():
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
    TResult? Function(_ProductCategoryRef value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ProductCategoryRef() when $default != null:
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
    TResult Function(String id, String slug, String nameEn, String nameAr)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _ProductCategoryRef() when $default != null:
        return $default(_that.id, _that.slug, _that.nameEn, _that.nameAr);
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
    TResult Function(String id, String slug, String nameEn, String nameAr)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ProductCategoryRef():
        return $default(_that.id, _that.slug, _that.nameEn, _that.nameAr);
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
    TResult? Function(String id, String slug, String nameEn, String nameAr)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ProductCategoryRef() when $default != null:
        return $default(_that.id, _that.slug, _that.nameEn, _that.nameAr);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _ProductCategoryRef implements ProductCategoryRef {
  const _ProductCategoryRef(
      {required this.id,
      required this.slug,
      required this.nameEn,
      required this.nameAr});
  factory _ProductCategoryRef.fromJson(Map<String, dynamic> json) =>
      _$ProductCategoryRefFromJson(json);

  @override
  final String id;
  @override
  final String slug;
  @override
  final String nameEn;
  @override
  final String nameAr;

  /// Create a copy of ProductCategoryRef
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$ProductCategoryRefCopyWith<_ProductCategoryRef> get copyWith =>
      __$ProductCategoryRefCopyWithImpl<_ProductCategoryRef>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$ProductCategoryRefToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _ProductCategoryRef &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.slug, slug) || other.slug == slug) &&
            (identical(other.nameEn, nameEn) || other.nameEn == nameEn) &&
            (identical(other.nameAr, nameAr) || other.nameAr == nameAr));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, slug, nameEn, nameAr);

  @override
  String toString() {
    return 'ProductCategoryRef(id: $id, slug: $slug, nameEn: $nameEn, nameAr: $nameAr)';
  }
}

/// @nodoc
abstract mixin class _$ProductCategoryRefCopyWith<$Res>
    implements $ProductCategoryRefCopyWith<$Res> {
  factory _$ProductCategoryRefCopyWith(
          _ProductCategoryRef value, $Res Function(_ProductCategoryRef) _then) =
      __$ProductCategoryRefCopyWithImpl;
  @override
  @useResult
  $Res call({String id, String slug, String nameEn, String nameAr});
}

/// @nodoc
class __$ProductCategoryRefCopyWithImpl<$Res>
    implements _$ProductCategoryRefCopyWith<$Res> {
  __$ProductCategoryRefCopyWithImpl(this._self, this._then);

  final _ProductCategoryRef _self;
  final $Res Function(_ProductCategoryRef) _then;

  /// Create a copy of ProductCategoryRef
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? id = null,
    Object? slug = null,
    Object? nameEn = null,
    Object? nameAr = null,
  }) {
    return _then(_ProductCategoryRef(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      slug: null == slug
          ? _self.slug
          : slug // ignore: cast_nullable_to_non_nullable
              as String,
      nameEn: null == nameEn
          ? _self.nameEn
          : nameEn // ignore: cast_nullable_to_non_nullable
              as String,
      nameAr: null == nameAr
          ? _self.nameAr
          : nameAr // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
mixin _$ProductDetail {
  String get id;
  String get slug;
  String get sku;
  String get nameEn;
  String get nameAr;
  String? get descriptionEn;
  String? get descriptionAr;
  List<ImageRef> get images;
  List<PriceBand> get prices;
  List<ProductVariant> get variants;
  int get moq;
  Availability get availability;
  int get availableQty;

  /// ISO-3166 alpha-2 country of origin, or null when unrecorded.
  String? get origin;

  /// Shipping weight. An approximate physical quantity, so `double` is
  /// correct here — this is not money and nothing is settled against it.
  double? get weightKg;
  List<String> get tags;
  Channel get channel;
  ProductBrandRef? get brand;
  ProductCategoryRef get category;
  SellerSummary get seller;
  RatingSummary? get rating;

  /// Create a copy of ProductDetail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $ProductDetailCopyWith<ProductDetail> get copyWith =>
      _$ProductDetailCopyWithImpl<ProductDetail>(
          this as ProductDetail, _$identity);

  /// Serializes this ProductDetail to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is ProductDetail &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.slug, slug) || other.slug == slug) &&
            (identical(other.sku, sku) || other.sku == sku) &&
            (identical(other.nameEn, nameEn) || other.nameEn == nameEn) &&
            (identical(other.nameAr, nameAr) || other.nameAr == nameAr) &&
            (identical(other.descriptionEn, descriptionEn) ||
                other.descriptionEn == descriptionEn) &&
            (identical(other.descriptionAr, descriptionAr) ||
                other.descriptionAr == descriptionAr) &&
            const DeepCollectionEquality().equals(other.images, images) &&
            const DeepCollectionEquality().equals(other.prices, prices) &&
            const DeepCollectionEquality().equals(other.variants, variants) &&
            (identical(other.moq, moq) || other.moq == moq) &&
            (identical(other.availability, availability) ||
                other.availability == availability) &&
            (identical(other.availableQty, availableQty) ||
                other.availableQty == availableQty) &&
            (identical(other.origin, origin) || other.origin == origin) &&
            (identical(other.weightKg, weightKg) ||
                other.weightKg == weightKg) &&
            const DeepCollectionEquality().equals(other.tags, tags) &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.brand, brand) || other.brand == brand) &&
            (identical(other.category, category) ||
                other.category == category) &&
            (identical(other.seller, seller) || other.seller == seller) &&
            (identical(other.rating, rating) || other.rating == rating));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hashAll([
        runtimeType,
        id,
        slug,
        sku,
        nameEn,
        nameAr,
        descriptionEn,
        descriptionAr,
        const DeepCollectionEquality().hash(images),
        const DeepCollectionEquality().hash(prices),
        const DeepCollectionEquality().hash(variants),
        moq,
        availability,
        availableQty,
        origin,
        weightKg,
        const DeepCollectionEquality().hash(tags),
        channel,
        brand,
        category,
        seller,
        rating
      ]);

  @override
  String toString() {
    return 'ProductDetail(id: $id, slug: $slug, sku: $sku, nameEn: $nameEn, nameAr: $nameAr, descriptionEn: $descriptionEn, descriptionAr: $descriptionAr, images: $images, prices: $prices, variants: $variants, moq: $moq, availability: $availability, availableQty: $availableQty, origin: $origin, weightKg: $weightKg, tags: $tags, channel: $channel, brand: $brand, category: $category, seller: $seller, rating: $rating)';
  }
}

/// @nodoc
abstract mixin class $ProductDetailCopyWith<$Res> {
  factory $ProductDetailCopyWith(
          ProductDetail value, $Res Function(ProductDetail) _then) =
      _$ProductDetailCopyWithImpl;
  @useResult
  $Res call(
      {String id,
      String slug,
      String sku,
      String nameEn,
      String nameAr,
      String? descriptionEn,
      String? descriptionAr,
      List<ImageRef> images,
      List<PriceBand> prices,
      List<ProductVariant> variants,
      int moq,
      Availability availability,
      int availableQty,
      String? origin,
      double? weightKg,
      List<String> tags,
      Channel channel,
      ProductBrandRef? brand,
      ProductCategoryRef category,
      SellerSummary seller,
      RatingSummary? rating});

  $ProductBrandRefCopyWith<$Res>? get brand;
  $ProductCategoryRefCopyWith<$Res> get category;
  $SellerSummaryCopyWith<$Res> get seller;
  $RatingSummaryCopyWith<$Res>? get rating;
}

/// @nodoc
class _$ProductDetailCopyWithImpl<$Res>
    implements $ProductDetailCopyWith<$Res> {
  _$ProductDetailCopyWithImpl(this._self, this._then);

  final ProductDetail _self;
  final $Res Function(ProductDetail) _then;

  /// Create a copy of ProductDetail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? slug = null,
    Object? sku = null,
    Object? nameEn = null,
    Object? nameAr = null,
    Object? descriptionEn = freezed,
    Object? descriptionAr = freezed,
    Object? images = null,
    Object? prices = null,
    Object? variants = null,
    Object? moq = null,
    Object? availability = null,
    Object? availableQty = null,
    Object? origin = freezed,
    Object? weightKg = freezed,
    Object? tags = null,
    Object? channel = null,
    Object? brand = freezed,
    Object? category = null,
    Object? seller = null,
    Object? rating = freezed,
  }) {
    return _then(_self.copyWith(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      slug: null == slug
          ? _self.slug
          : slug // ignore: cast_nullable_to_non_nullable
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
      descriptionEn: freezed == descriptionEn
          ? _self.descriptionEn
          : descriptionEn // ignore: cast_nullable_to_non_nullable
              as String?,
      descriptionAr: freezed == descriptionAr
          ? _self.descriptionAr
          : descriptionAr // ignore: cast_nullable_to_non_nullable
              as String?,
      images: null == images
          ? _self.images
          : images // ignore: cast_nullable_to_non_nullable
              as List<ImageRef>,
      prices: null == prices
          ? _self.prices
          : prices // ignore: cast_nullable_to_non_nullable
              as List<PriceBand>,
      variants: null == variants
          ? _self.variants
          : variants // ignore: cast_nullable_to_non_nullable
              as List<ProductVariant>,
      moq: null == moq
          ? _self.moq
          : moq // ignore: cast_nullable_to_non_nullable
              as int,
      availability: null == availability
          ? _self.availability
          : availability // ignore: cast_nullable_to_non_nullable
              as Availability,
      availableQty: null == availableQty
          ? _self.availableQty
          : availableQty // ignore: cast_nullable_to_non_nullable
              as int,
      origin: freezed == origin
          ? _self.origin
          : origin // ignore: cast_nullable_to_non_nullable
              as String?,
      weightKg: freezed == weightKg
          ? _self.weightKg
          : weightKg // ignore: cast_nullable_to_non_nullable
              as double?,
      tags: null == tags
          ? _self.tags
          : tags // ignore: cast_nullable_to_non_nullable
              as List<String>,
      channel: null == channel
          ? _self.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as Channel,
      brand: freezed == brand
          ? _self.brand
          : brand // ignore: cast_nullable_to_non_nullable
              as ProductBrandRef?,
      category: null == category
          ? _self.category
          : category // ignore: cast_nullable_to_non_nullable
              as ProductCategoryRef,
      seller: null == seller
          ? _self.seller
          : seller // ignore: cast_nullable_to_non_nullable
              as SellerSummary,
      rating: freezed == rating
          ? _self.rating
          : rating // ignore: cast_nullable_to_non_nullable
              as RatingSummary?,
    ));
  }

  /// Create a copy of ProductDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ProductBrandRefCopyWith<$Res>? get brand {
    if (_self.brand == null) {
      return null;
    }

    return $ProductBrandRefCopyWith<$Res>(_self.brand!, (value) {
      return _then(_self.copyWith(brand: value));
    });
  }

  /// Create a copy of ProductDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ProductCategoryRefCopyWith<$Res> get category {
    return $ProductCategoryRefCopyWith<$Res>(_self.category, (value) {
      return _then(_self.copyWith(category: value));
    });
  }

  /// Create a copy of ProductDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $SellerSummaryCopyWith<$Res> get seller {
    return $SellerSummaryCopyWith<$Res>(_self.seller, (value) {
      return _then(_self.copyWith(seller: value));
    });
  }

  /// Create a copy of ProductDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $RatingSummaryCopyWith<$Res>? get rating {
    if (_self.rating == null) {
      return null;
    }

    return $RatingSummaryCopyWith<$Res>(_self.rating!, (value) {
      return _then(_self.copyWith(rating: value));
    });
  }
}

/// Adds pattern-matching-related methods to [ProductDetail].
extension ProductDetailPatterns on ProductDetail {
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
    TResult Function(_ProductDetail value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _ProductDetail() when $default != null:
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
    TResult Function(_ProductDetail value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ProductDetail():
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
    TResult? Function(_ProductDetail value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ProductDetail() when $default != null:
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
            String id,
            String slug,
            String sku,
            String nameEn,
            String nameAr,
            String? descriptionEn,
            String? descriptionAr,
            List<ImageRef> images,
            List<PriceBand> prices,
            List<ProductVariant> variants,
            int moq,
            Availability availability,
            int availableQty,
            String? origin,
            double? weightKg,
            List<String> tags,
            Channel channel,
            ProductBrandRef? brand,
            ProductCategoryRef category,
            SellerSummary seller,
            RatingSummary? rating)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _ProductDetail() when $default != null:
        return $default(
            _that.id,
            _that.slug,
            _that.sku,
            _that.nameEn,
            _that.nameAr,
            _that.descriptionEn,
            _that.descriptionAr,
            _that.images,
            _that.prices,
            _that.variants,
            _that.moq,
            _that.availability,
            _that.availableQty,
            _that.origin,
            _that.weightKg,
            _that.tags,
            _that.channel,
            _that.brand,
            _that.category,
            _that.seller,
            _that.rating);
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
            String id,
            String slug,
            String sku,
            String nameEn,
            String nameAr,
            String? descriptionEn,
            String? descriptionAr,
            List<ImageRef> images,
            List<PriceBand> prices,
            List<ProductVariant> variants,
            int moq,
            Availability availability,
            int availableQty,
            String? origin,
            double? weightKg,
            List<String> tags,
            Channel channel,
            ProductBrandRef? brand,
            ProductCategoryRef category,
            SellerSummary seller,
            RatingSummary? rating)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ProductDetail():
        return $default(
            _that.id,
            _that.slug,
            _that.sku,
            _that.nameEn,
            _that.nameAr,
            _that.descriptionEn,
            _that.descriptionAr,
            _that.images,
            _that.prices,
            _that.variants,
            _that.moq,
            _that.availability,
            _that.availableQty,
            _that.origin,
            _that.weightKg,
            _that.tags,
            _that.channel,
            _that.brand,
            _that.category,
            _that.seller,
            _that.rating);
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
            String id,
            String slug,
            String sku,
            String nameEn,
            String nameAr,
            String? descriptionEn,
            String? descriptionAr,
            List<ImageRef> images,
            List<PriceBand> prices,
            List<ProductVariant> variants,
            int moq,
            Availability availability,
            int availableQty,
            String? origin,
            double? weightKg,
            List<String> tags,
            Channel channel,
            ProductBrandRef? brand,
            ProductCategoryRef category,
            SellerSummary seller,
            RatingSummary? rating)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _ProductDetail() when $default != null:
        return $default(
            _that.id,
            _that.slug,
            _that.sku,
            _that.nameEn,
            _that.nameAr,
            _that.descriptionEn,
            _that.descriptionAr,
            _that.images,
            _that.prices,
            _that.variants,
            _that.moq,
            _that.availability,
            _that.availableQty,
            _that.origin,
            _that.weightKg,
            _that.tags,
            _that.channel,
            _that.brand,
            _that.category,
            _that.seller,
            _that.rating);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _ProductDetail extends ProductDetail {
  const _ProductDetail(
      {required this.id,
      required this.slug,
      required this.sku,
      required this.nameEn,
      required this.nameAr,
      required this.descriptionEn,
      required this.descriptionAr,
      required final List<ImageRef> images,
      required final List<PriceBand> prices,
      required final List<ProductVariant> variants,
      required this.moq,
      required this.availability,
      required this.availableQty,
      required this.origin,
      required this.weightKg,
      required final List<String> tags,
      required this.channel,
      required this.brand,
      required this.category,
      required this.seller,
      required this.rating})
      : _images = images,
        _prices = prices,
        _variants = variants,
        _tags = tags,
        super._();
  factory _ProductDetail.fromJson(Map<String, dynamic> json) =>
      _$ProductDetailFromJson(json);

  @override
  final String id;
  @override
  final String slug;
  @override
  final String sku;
  @override
  final String nameEn;
  @override
  final String nameAr;
  @override
  final String? descriptionEn;
  @override
  final String? descriptionAr;
  final List<ImageRef> _images;
  @override
  List<ImageRef> get images {
    if (_images is EqualUnmodifiableListView) return _images;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_images);
  }

  final List<PriceBand> _prices;
  @override
  List<PriceBand> get prices {
    if (_prices is EqualUnmodifiableListView) return _prices;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_prices);
  }

  final List<ProductVariant> _variants;
  @override
  List<ProductVariant> get variants {
    if (_variants is EqualUnmodifiableListView) return _variants;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_variants);
  }

  @override
  final int moq;
  @override
  final Availability availability;
  @override
  final int availableQty;

  /// ISO-3166 alpha-2 country of origin, or null when unrecorded.
  @override
  final String? origin;

  /// Shipping weight. An approximate physical quantity, so `double` is
  /// correct here — this is not money and nothing is settled against it.
  @override
  final double? weightKg;
  final List<String> _tags;
  @override
  List<String> get tags {
    if (_tags is EqualUnmodifiableListView) return _tags;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_tags);
  }

  @override
  final Channel channel;
  @override
  final ProductBrandRef? brand;
  @override
  final ProductCategoryRef category;
  @override
  final SellerSummary seller;
  @override
  final RatingSummary? rating;

  /// Create a copy of ProductDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$ProductDetailCopyWith<_ProductDetail> get copyWith =>
      __$ProductDetailCopyWithImpl<_ProductDetail>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$ProductDetailToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _ProductDetail &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.slug, slug) || other.slug == slug) &&
            (identical(other.sku, sku) || other.sku == sku) &&
            (identical(other.nameEn, nameEn) || other.nameEn == nameEn) &&
            (identical(other.nameAr, nameAr) || other.nameAr == nameAr) &&
            (identical(other.descriptionEn, descriptionEn) ||
                other.descriptionEn == descriptionEn) &&
            (identical(other.descriptionAr, descriptionAr) ||
                other.descriptionAr == descriptionAr) &&
            const DeepCollectionEquality().equals(other._images, _images) &&
            const DeepCollectionEquality().equals(other._prices, _prices) &&
            const DeepCollectionEquality().equals(other._variants, _variants) &&
            (identical(other.moq, moq) || other.moq == moq) &&
            (identical(other.availability, availability) ||
                other.availability == availability) &&
            (identical(other.availableQty, availableQty) ||
                other.availableQty == availableQty) &&
            (identical(other.origin, origin) || other.origin == origin) &&
            (identical(other.weightKg, weightKg) ||
                other.weightKg == weightKg) &&
            const DeepCollectionEquality().equals(other._tags, _tags) &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.brand, brand) || other.brand == brand) &&
            (identical(other.category, category) ||
                other.category == category) &&
            (identical(other.seller, seller) || other.seller == seller) &&
            (identical(other.rating, rating) || other.rating == rating));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hashAll([
        runtimeType,
        id,
        slug,
        sku,
        nameEn,
        nameAr,
        descriptionEn,
        descriptionAr,
        const DeepCollectionEquality().hash(_images),
        const DeepCollectionEquality().hash(_prices),
        const DeepCollectionEquality().hash(_variants),
        moq,
        availability,
        availableQty,
        origin,
        weightKg,
        const DeepCollectionEquality().hash(_tags),
        channel,
        brand,
        category,
        seller,
        rating
      ]);

  @override
  String toString() {
    return 'ProductDetail(id: $id, slug: $slug, sku: $sku, nameEn: $nameEn, nameAr: $nameAr, descriptionEn: $descriptionEn, descriptionAr: $descriptionAr, images: $images, prices: $prices, variants: $variants, moq: $moq, availability: $availability, availableQty: $availableQty, origin: $origin, weightKg: $weightKg, tags: $tags, channel: $channel, brand: $brand, category: $category, seller: $seller, rating: $rating)';
  }
}

/// @nodoc
abstract mixin class _$ProductDetailCopyWith<$Res>
    implements $ProductDetailCopyWith<$Res> {
  factory _$ProductDetailCopyWith(
          _ProductDetail value, $Res Function(_ProductDetail) _then) =
      __$ProductDetailCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String id,
      String slug,
      String sku,
      String nameEn,
      String nameAr,
      String? descriptionEn,
      String? descriptionAr,
      List<ImageRef> images,
      List<PriceBand> prices,
      List<ProductVariant> variants,
      int moq,
      Availability availability,
      int availableQty,
      String? origin,
      double? weightKg,
      List<String> tags,
      Channel channel,
      ProductBrandRef? brand,
      ProductCategoryRef category,
      SellerSummary seller,
      RatingSummary? rating});

  @override
  $ProductBrandRefCopyWith<$Res>? get brand;
  @override
  $ProductCategoryRefCopyWith<$Res> get category;
  @override
  $SellerSummaryCopyWith<$Res> get seller;
  @override
  $RatingSummaryCopyWith<$Res>? get rating;
}

/// @nodoc
class __$ProductDetailCopyWithImpl<$Res>
    implements _$ProductDetailCopyWith<$Res> {
  __$ProductDetailCopyWithImpl(this._self, this._then);

  final _ProductDetail _self;
  final $Res Function(_ProductDetail) _then;

  /// Create a copy of ProductDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? id = null,
    Object? slug = null,
    Object? sku = null,
    Object? nameEn = null,
    Object? nameAr = null,
    Object? descriptionEn = freezed,
    Object? descriptionAr = freezed,
    Object? images = null,
    Object? prices = null,
    Object? variants = null,
    Object? moq = null,
    Object? availability = null,
    Object? availableQty = null,
    Object? origin = freezed,
    Object? weightKg = freezed,
    Object? tags = null,
    Object? channel = null,
    Object? brand = freezed,
    Object? category = null,
    Object? seller = null,
    Object? rating = freezed,
  }) {
    return _then(_ProductDetail(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      slug: null == slug
          ? _self.slug
          : slug // ignore: cast_nullable_to_non_nullable
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
      descriptionEn: freezed == descriptionEn
          ? _self.descriptionEn
          : descriptionEn // ignore: cast_nullable_to_non_nullable
              as String?,
      descriptionAr: freezed == descriptionAr
          ? _self.descriptionAr
          : descriptionAr // ignore: cast_nullable_to_non_nullable
              as String?,
      images: null == images
          ? _self._images
          : images // ignore: cast_nullable_to_non_nullable
              as List<ImageRef>,
      prices: null == prices
          ? _self._prices
          : prices // ignore: cast_nullable_to_non_nullable
              as List<PriceBand>,
      variants: null == variants
          ? _self._variants
          : variants // ignore: cast_nullable_to_non_nullable
              as List<ProductVariant>,
      moq: null == moq
          ? _self.moq
          : moq // ignore: cast_nullable_to_non_nullable
              as int,
      availability: null == availability
          ? _self.availability
          : availability // ignore: cast_nullable_to_non_nullable
              as Availability,
      availableQty: null == availableQty
          ? _self.availableQty
          : availableQty // ignore: cast_nullable_to_non_nullable
              as int,
      origin: freezed == origin
          ? _self.origin
          : origin // ignore: cast_nullable_to_non_nullable
              as String?,
      weightKg: freezed == weightKg
          ? _self.weightKg
          : weightKg // ignore: cast_nullable_to_non_nullable
              as double?,
      tags: null == tags
          ? _self._tags
          : tags // ignore: cast_nullable_to_non_nullable
              as List<String>,
      channel: null == channel
          ? _self.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as Channel,
      brand: freezed == brand
          ? _self.brand
          : brand // ignore: cast_nullable_to_non_nullable
              as ProductBrandRef?,
      category: null == category
          ? _self.category
          : category // ignore: cast_nullable_to_non_nullable
              as ProductCategoryRef,
      seller: null == seller
          ? _self.seller
          : seller // ignore: cast_nullable_to_non_nullable
              as SellerSummary,
      rating: freezed == rating
          ? _self.rating
          : rating // ignore: cast_nullable_to_non_nullable
              as RatingSummary?,
    ));
  }

  /// Create a copy of ProductDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ProductBrandRefCopyWith<$Res>? get brand {
    if (_self.brand == null) {
      return null;
    }

    return $ProductBrandRefCopyWith<$Res>(_self.brand!, (value) {
      return _then(_self.copyWith(brand: value));
    });
  }

  /// Create a copy of ProductDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ProductCategoryRefCopyWith<$Res> get category {
    return $ProductCategoryRefCopyWith<$Res>(_self.category, (value) {
      return _then(_self.copyWith(category: value));
    });
  }

  /// Create a copy of ProductDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $SellerSummaryCopyWith<$Res> get seller {
    return $SellerSummaryCopyWith<$Res>(_self.seller, (value) {
      return _then(_self.copyWith(seller: value));
    });
  }

  /// Create a copy of ProductDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $RatingSummaryCopyWith<$Res>? get rating {
    if (_self.rating == null) {
      return null;
    }

    return $RatingSummaryCopyWith<$Res>(_self.rating!, (value) {
      return _then(_self.copyWith(rating: value));
    });
  }
}

/// @nodoc
mixin _$Category {
  String get id;
  String get slug;
  String get nameEn;
  String get nameAr;

  /// Null at the root. The endpoint returns the whole tree FLAT and
  /// unpaginated; assemble it with [parentId] and [depth] rather than
  /// expecting nesting on the wire.
  String? get parentId;
  int get depth;
  ImageRef? get image;
  int get productCount;

  /// Create a copy of Category
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $CategoryCopyWith<Category> get copyWith =>
      _$CategoryCopyWithImpl<Category>(this as Category, _$identity);

  /// Serializes this Category to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is Category &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.slug, slug) || other.slug == slug) &&
            (identical(other.nameEn, nameEn) || other.nameEn == nameEn) &&
            (identical(other.nameAr, nameAr) || other.nameAr == nameAr) &&
            (identical(other.parentId, parentId) ||
                other.parentId == parentId) &&
            (identical(other.depth, depth) || other.depth == depth) &&
            (identical(other.image, image) || other.image == image) &&
            (identical(other.productCount, productCount) ||
                other.productCount == productCount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, slug, nameEn, nameAr,
      parentId, depth, image, productCount);

  @override
  String toString() {
    return 'Category(id: $id, slug: $slug, nameEn: $nameEn, nameAr: $nameAr, parentId: $parentId, depth: $depth, image: $image, productCount: $productCount)';
  }
}

/// @nodoc
abstract mixin class $CategoryCopyWith<$Res> {
  factory $CategoryCopyWith(Category value, $Res Function(Category) _then) =
      _$CategoryCopyWithImpl;
  @useResult
  $Res call(
      {String id,
      String slug,
      String nameEn,
      String nameAr,
      String? parentId,
      int depth,
      ImageRef? image,
      int productCount});

  $ImageRefCopyWith<$Res>? get image;
}

/// @nodoc
class _$CategoryCopyWithImpl<$Res> implements $CategoryCopyWith<$Res> {
  _$CategoryCopyWithImpl(this._self, this._then);

  final Category _self;
  final $Res Function(Category) _then;

  /// Create a copy of Category
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? slug = null,
    Object? nameEn = null,
    Object? nameAr = null,
    Object? parentId = freezed,
    Object? depth = null,
    Object? image = freezed,
    Object? productCount = null,
  }) {
    return _then(_self.copyWith(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      slug: null == slug
          ? _self.slug
          : slug // ignore: cast_nullable_to_non_nullable
              as String,
      nameEn: null == nameEn
          ? _self.nameEn
          : nameEn // ignore: cast_nullable_to_non_nullable
              as String,
      nameAr: null == nameAr
          ? _self.nameAr
          : nameAr // ignore: cast_nullable_to_non_nullable
              as String,
      parentId: freezed == parentId
          ? _self.parentId
          : parentId // ignore: cast_nullable_to_non_nullable
              as String?,
      depth: null == depth
          ? _self.depth
          : depth // ignore: cast_nullable_to_non_nullable
              as int,
      image: freezed == image
          ? _self.image
          : image // ignore: cast_nullable_to_non_nullable
              as ImageRef?,
      productCount: null == productCount
          ? _self.productCount
          : productCount // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }

  /// Create a copy of Category
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ImageRefCopyWith<$Res>? get image {
    if (_self.image == null) {
      return null;
    }

    return $ImageRefCopyWith<$Res>(_self.image!, (value) {
      return _then(_self.copyWith(image: value));
    });
  }
}

/// Adds pattern-matching-related methods to [Category].
extension CategoryPatterns on Category {
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
    TResult Function(_Category value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _Category() when $default != null:
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
    TResult Function(_Category value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Category():
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
    TResult? Function(_Category value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Category() when $default != null:
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
    TResult Function(String id, String slug, String nameEn, String nameAr,
            String? parentId, int depth, ImageRef? image, int productCount)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _Category() when $default != null:
        return $default(_that.id, _that.slug, _that.nameEn, _that.nameAr,
            _that.parentId, _that.depth, _that.image, _that.productCount);
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
    TResult Function(String id, String slug, String nameEn, String nameAr,
            String? parentId, int depth, ImageRef? image, int productCount)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Category():
        return $default(_that.id, _that.slug, _that.nameEn, _that.nameAr,
            _that.parentId, _that.depth, _that.image, _that.productCount);
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
    TResult? Function(String id, String slug, String nameEn, String nameAr,
            String? parentId, int depth, ImageRef? image, int productCount)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Category() when $default != null:
        return $default(_that.id, _that.slug, _that.nameEn, _that.nameAr,
            _that.parentId, _that.depth, _that.image, _that.productCount);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _Category extends Category {
  const _Category(
      {required this.id,
      required this.slug,
      required this.nameEn,
      required this.nameAr,
      required this.parentId,
      required this.depth,
      required this.image,
      required this.productCount})
      : super._();
  factory _Category.fromJson(Map<String, dynamic> json) =>
      _$CategoryFromJson(json);

  @override
  final String id;
  @override
  final String slug;
  @override
  final String nameEn;
  @override
  final String nameAr;

  /// Null at the root. The endpoint returns the whole tree FLAT and
  /// unpaginated; assemble it with [parentId] and [depth] rather than
  /// expecting nesting on the wire.
  @override
  final String? parentId;
  @override
  final int depth;
  @override
  final ImageRef? image;
  @override
  final int productCount;

  /// Create a copy of Category
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$CategoryCopyWith<_Category> get copyWith =>
      __$CategoryCopyWithImpl<_Category>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$CategoryToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _Category &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.slug, slug) || other.slug == slug) &&
            (identical(other.nameEn, nameEn) || other.nameEn == nameEn) &&
            (identical(other.nameAr, nameAr) || other.nameAr == nameAr) &&
            (identical(other.parentId, parentId) ||
                other.parentId == parentId) &&
            (identical(other.depth, depth) || other.depth == depth) &&
            (identical(other.image, image) || other.image == image) &&
            (identical(other.productCount, productCount) ||
                other.productCount == productCount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, slug, nameEn, nameAr,
      parentId, depth, image, productCount);

  @override
  String toString() {
    return 'Category(id: $id, slug: $slug, nameEn: $nameEn, nameAr: $nameAr, parentId: $parentId, depth: $depth, image: $image, productCount: $productCount)';
  }
}

/// @nodoc
abstract mixin class _$CategoryCopyWith<$Res>
    implements $CategoryCopyWith<$Res> {
  factory _$CategoryCopyWith(_Category value, $Res Function(_Category) _then) =
      __$CategoryCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String id,
      String slug,
      String nameEn,
      String nameAr,
      String? parentId,
      int depth,
      ImageRef? image,
      int productCount});

  @override
  $ImageRefCopyWith<$Res>? get image;
}

/// @nodoc
class __$CategoryCopyWithImpl<$Res> implements _$CategoryCopyWith<$Res> {
  __$CategoryCopyWithImpl(this._self, this._then);

  final _Category _self;
  final $Res Function(_Category) _then;

  /// Create a copy of Category
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? id = null,
    Object? slug = null,
    Object? nameEn = null,
    Object? nameAr = null,
    Object? parentId = freezed,
    Object? depth = null,
    Object? image = freezed,
    Object? productCount = null,
  }) {
    return _then(_Category(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      slug: null == slug
          ? _self.slug
          : slug // ignore: cast_nullable_to_non_nullable
              as String,
      nameEn: null == nameEn
          ? _self.nameEn
          : nameEn // ignore: cast_nullable_to_non_nullable
              as String,
      nameAr: null == nameAr
          ? _self.nameAr
          : nameAr // ignore: cast_nullable_to_non_nullable
              as String,
      parentId: freezed == parentId
          ? _self.parentId
          : parentId // ignore: cast_nullable_to_non_nullable
              as String?,
      depth: null == depth
          ? _self.depth
          : depth // ignore: cast_nullable_to_non_nullable
              as int,
      image: freezed == image
          ? _self.image
          : image // ignore: cast_nullable_to_non_nullable
              as ImageRef?,
      productCount: null == productCount
          ? _self.productCount
          : productCount // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }

  /// Create a copy of Category
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ImageRefCopyWith<$Res>? get image {
    if (_self.image == null) {
      return null;
    }

    return $ImageRefCopyWith<$Res>(_self.image!, (value) {
      return _then(_self.copyWith(image: value));
    });
  }
}

/// @nodoc
mixin _$Brand {
  String get id;
  String get slug;
  String get nameEn;
  String? get nameAr;
  ImageRef? get logo;
  int get productCount;

  /// Create a copy of Brand
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $BrandCopyWith<Brand> get copyWith =>
      _$BrandCopyWithImpl<Brand>(this as Brand, _$identity);

  /// Serializes this Brand to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is Brand &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.slug, slug) || other.slug == slug) &&
            (identical(other.nameEn, nameEn) || other.nameEn == nameEn) &&
            (identical(other.nameAr, nameAr) || other.nameAr == nameAr) &&
            (identical(other.logo, logo) || other.logo == logo) &&
            (identical(other.productCount, productCount) ||
                other.productCount == productCount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, slug, nameEn, nameAr, logo, productCount);

  @override
  String toString() {
    return 'Brand(id: $id, slug: $slug, nameEn: $nameEn, nameAr: $nameAr, logo: $logo, productCount: $productCount)';
  }
}

/// @nodoc
abstract mixin class $BrandCopyWith<$Res> {
  factory $BrandCopyWith(Brand value, $Res Function(Brand) _then) =
      _$BrandCopyWithImpl;
  @useResult
  $Res call(
      {String id,
      String slug,
      String nameEn,
      String? nameAr,
      ImageRef? logo,
      int productCount});

  $ImageRefCopyWith<$Res>? get logo;
}

/// @nodoc
class _$BrandCopyWithImpl<$Res> implements $BrandCopyWith<$Res> {
  _$BrandCopyWithImpl(this._self, this._then);

  final Brand _self;
  final $Res Function(Brand) _then;

  /// Create a copy of Brand
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? slug = null,
    Object? nameEn = null,
    Object? nameAr = freezed,
    Object? logo = freezed,
    Object? productCount = null,
  }) {
    return _then(_self.copyWith(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      slug: null == slug
          ? _self.slug
          : slug // ignore: cast_nullable_to_non_nullable
              as String,
      nameEn: null == nameEn
          ? _self.nameEn
          : nameEn // ignore: cast_nullable_to_non_nullable
              as String,
      nameAr: freezed == nameAr
          ? _self.nameAr
          : nameAr // ignore: cast_nullable_to_non_nullable
              as String?,
      logo: freezed == logo
          ? _self.logo
          : logo // ignore: cast_nullable_to_non_nullable
              as ImageRef?,
      productCount: null == productCount
          ? _self.productCount
          : productCount // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }

  /// Create a copy of Brand
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ImageRefCopyWith<$Res>? get logo {
    if (_self.logo == null) {
      return null;
    }

    return $ImageRefCopyWith<$Res>(_self.logo!, (value) {
      return _then(_self.copyWith(logo: value));
    });
  }
}

/// Adds pattern-matching-related methods to [Brand].
extension BrandPatterns on Brand {
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
    TResult Function(_Brand value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _Brand() when $default != null:
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
    TResult Function(_Brand value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Brand():
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
    TResult? Function(_Brand value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Brand() when $default != null:
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
    TResult Function(String id, String slug, String nameEn, String? nameAr,
            ImageRef? logo, int productCount)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _Brand() when $default != null:
        return $default(_that.id, _that.slug, _that.nameEn, _that.nameAr,
            _that.logo, _that.productCount);
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
    TResult Function(String id, String slug, String nameEn, String? nameAr,
            ImageRef? logo, int productCount)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Brand():
        return $default(_that.id, _that.slug, _that.nameEn, _that.nameAr,
            _that.logo, _that.productCount);
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
    TResult? Function(String id, String slug, String nameEn, String? nameAr,
            ImageRef? logo, int productCount)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Brand() when $default != null:
        return $default(_that.id, _that.slug, _that.nameEn, _that.nameAr,
            _that.logo, _that.productCount);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _Brand extends Brand {
  const _Brand(
      {required this.id,
      required this.slug,
      required this.nameEn,
      required this.nameAr,
      required this.logo,
      required this.productCount})
      : super._();
  factory _Brand.fromJson(Map<String, dynamic> json) => _$BrandFromJson(json);

  @override
  final String id;
  @override
  final String slug;
  @override
  final String nameEn;
  @override
  final String? nameAr;
  @override
  final ImageRef? logo;
  @override
  final int productCount;

  /// Create a copy of Brand
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$BrandCopyWith<_Brand> get copyWith =>
      __$BrandCopyWithImpl<_Brand>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$BrandToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _Brand &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.slug, slug) || other.slug == slug) &&
            (identical(other.nameEn, nameEn) || other.nameEn == nameEn) &&
            (identical(other.nameAr, nameAr) || other.nameAr == nameAr) &&
            (identical(other.logo, logo) || other.logo == logo) &&
            (identical(other.productCount, productCount) ||
                other.productCount == productCount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, slug, nameEn, nameAr, logo, productCount);

  @override
  String toString() {
    return 'Brand(id: $id, slug: $slug, nameEn: $nameEn, nameAr: $nameAr, logo: $logo, productCount: $productCount)';
  }
}

/// @nodoc
abstract mixin class _$BrandCopyWith<$Res> implements $BrandCopyWith<$Res> {
  factory _$BrandCopyWith(_Brand value, $Res Function(_Brand) _then) =
      __$BrandCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String id,
      String slug,
      String nameEn,
      String? nameAr,
      ImageRef? logo,
      int productCount});

  @override
  $ImageRefCopyWith<$Res>? get logo;
}

/// @nodoc
class __$BrandCopyWithImpl<$Res> implements _$BrandCopyWith<$Res> {
  __$BrandCopyWithImpl(this._self, this._then);

  final _Brand _self;
  final $Res Function(_Brand) _then;

  /// Create a copy of Brand
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? id = null,
    Object? slug = null,
    Object? nameEn = null,
    Object? nameAr = freezed,
    Object? logo = freezed,
    Object? productCount = null,
  }) {
    return _then(_Brand(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      slug: null == slug
          ? _self.slug
          : slug // ignore: cast_nullable_to_non_nullable
              as String,
      nameEn: null == nameEn
          ? _self.nameEn
          : nameEn // ignore: cast_nullable_to_non_nullable
              as String,
      nameAr: freezed == nameAr
          ? _self.nameAr
          : nameAr // ignore: cast_nullable_to_non_nullable
              as String?,
      logo: freezed == logo
          ? _self.logo
          : logo // ignore: cast_nullable_to_non_nullable
              as ImageRef?,
      productCount: null == productCount
          ? _self.productCount
          : productCount // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }

  /// Create a copy of Brand
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ImageRefCopyWith<$Res>? get logo {
    if (_self.logo == null) {
      return null;
    }

    return $ImageRefCopyWith<$Res>(_self.logo!, (value) {
      return _then(_self.copyWith(logo: value));
    });
  }
}

// dart format on
