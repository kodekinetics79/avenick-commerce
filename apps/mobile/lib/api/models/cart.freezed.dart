// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'cart.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$CartLine {
  String get id;
  String get productId;
  String? get variantId;
  String get sellerId;
  String get slug;
  String get sku;
  String get nameEn;
  String get nameAr;
  ImageRef? get image;
  Channel get channel;
  int get qty;

  /// Minimum order quantity. A B2B line below this cannot check out, so the
  /// stepper's floor comes from here, not from 1.
  int get moq;
  @DecimalConverter()
  Decimal get unitPrice;
  Currency get currency;
  @DecimalConverter()
  Decimal get vatRatePercent;

  /// True when the unit price came off a quantity ladder, so it will change
  /// if the quantity does.
  bool get priceTiered;
  Availability get availability;

  /// Whether this line can be ORDERED in [channel] — the platform's
  /// `isB2CEnabled`/`isB2BEnabled` gate, answered for the channel this line
  /// was priced in. See `ProductCard.sellableInChannel` in `catalogue.dart`.
  ///
  /// A line with `false` here is priced, in stock, above its MOQ and still
  /// impossible to buy: `secureCreateOrder` refuses the order. It must be
  /// shown as quote-only in the basket and must not be carried into a
  /// checkout — which is what [Cart.blockingLines] now enforces.
  bool get sellableInChannel;
  @DecimalConverter()
  Decimal get lineTotal;

  /// Create a copy of CartLine
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $CartLineCopyWith<CartLine> get copyWith =>
      _$CartLineCopyWithImpl<CartLine>(this as CartLine, _$identity);

  /// Serializes this CartLine to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is CartLine &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.variantId, variantId) ||
                other.variantId == variantId) &&
            (identical(other.sellerId, sellerId) ||
                other.sellerId == sellerId) &&
            (identical(other.slug, slug) || other.slug == slug) &&
            (identical(other.sku, sku) || other.sku == sku) &&
            (identical(other.nameEn, nameEn) || other.nameEn == nameEn) &&
            (identical(other.nameAr, nameAr) || other.nameAr == nameAr) &&
            (identical(other.image, image) || other.image == image) &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.qty, qty) || other.qty == qty) &&
            (identical(other.moq, moq) || other.moq == moq) &&
            (identical(other.unitPrice, unitPrice) ||
                other.unitPrice == unitPrice) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.vatRatePercent, vatRatePercent) ||
                other.vatRatePercent == vatRatePercent) &&
            (identical(other.priceTiered, priceTiered) ||
                other.priceTiered == priceTiered) &&
            (identical(other.availability, availability) ||
                other.availability == availability) &&
            (identical(other.sellableInChannel, sellableInChannel) ||
                other.sellableInChannel == sellableInChannel) &&
            (identical(other.lineTotal, lineTotal) ||
                other.lineTotal == lineTotal));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hashAll([
        runtimeType,
        id,
        productId,
        variantId,
        sellerId,
        slug,
        sku,
        nameEn,
        nameAr,
        image,
        channel,
        qty,
        moq,
        unitPrice,
        currency,
        vatRatePercent,
        priceTiered,
        availability,
        sellableInChannel,
        lineTotal
      ]);

  @override
  String toString() {
    return 'CartLine(id: $id, productId: $productId, variantId: $variantId, sellerId: $sellerId, slug: $slug, sku: $sku, nameEn: $nameEn, nameAr: $nameAr, image: $image, channel: $channel, qty: $qty, moq: $moq, unitPrice: $unitPrice, currency: $currency, vatRatePercent: $vatRatePercent, priceTiered: $priceTiered, availability: $availability, sellableInChannel: $sellableInChannel, lineTotal: $lineTotal)';
  }
}

/// @nodoc
abstract mixin class $CartLineCopyWith<$Res> {
  factory $CartLineCopyWith(CartLine value, $Res Function(CartLine) _then) =
      _$CartLineCopyWithImpl;
  @useResult
  $Res call(
      {String id,
      String productId,
      String? variantId,
      String sellerId,
      String slug,
      String sku,
      String nameEn,
      String nameAr,
      ImageRef? image,
      Channel channel,
      int qty,
      int moq,
      @DecimalConverter() Decimal unitPrice,
      Currency currency,
      @DecimalConverter() Decimal vatRatePercent,
      bool priceTiered,
      Availability availability,
      bool sellableInChannel,
      @DecimalConverter() Decimal lineTotal});

  $ImageRefCopyWith<$Res>? get image;
}

/// @nodoc
class _$CartLineCopyWithImpl<$Res> implements $CartLineCopyWith<$Res> {
  _$CartLineCopyWithImpl(this._self, this._then);

  final CartLine _self;
  final $Res Function(CartLine) _then;

  /// Create a copy of CartLine
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? productId = null,
    Object? variantId = freezed,
    Object? sellerId = null,
    Object? slug = null,
    Object? sku = null,
    Object? nameEn = null,
    Object? nameAr = null,
    Object? image = freezed,
    Object? channel = null,
    Object? qty = null,
    Object? moq = null,
    Object? unitPrice = null,
    Object? currency = null,
    Object? vatRatePercent = null,
    Object? priceTiered = null,
    Object? availability = null,
    Object? sellableInChannel = null,
    Object? lineTotal = null,
  }) {
    return _then(_self.copyWith(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
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
      image: freezed == image
          ? _self.image
          : image // ignore: cast_nullable_to_non_nullable
              as ImageRef?,
      channel: null == channel
          ? _self.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as Channel,
      qty: null == qty
          ? _self.qty
          : qty // ignore: cast_nullable_to_non_nullable
              as int,
      moq: null == moq
          ? _self.moq
          : moq // ignore: cast_nullable_to_non_nullable
              as int,
      unitPrice: null == unitPrice
          ? _self.unitPrice
          : unitPrice // ignore: cast_nullable_to_non_nullable
              as Decimal,
      currency: null == currency
          ? _self.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as Currency,
      vatRatePercent: null == vatRatePercent
          ? _self.vatRatePercent
          : vatRatePercent // ignore: cast_nullable_to_non_nullable
              as Decimal,
      priceTiered: null == priceTiered
          ? _self.priceTiered
          : priceTiered // ignore: cast_nullable_to_non_nullable
              as bool,
      availability: null == availability
          ? _self.availability
          : availability // ignore: cast_nullable_to_non_nullable
              as Availability,
      sellableInChannel: null == sellableInChannel
          ? _self.sellableInChannel
          : sellableInChannel // ignore: cast_nullable_to_non_nullable
              as bool,
      lineTotal: null == lineTotal
          ? _self.lineTotal
          : lineTotal // ignore: cast_nullable_to_non_nullable
              as Decimal,
    ));
  }

  /// Create a copy of CartLine
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

/// Adds pattern-matching-related methods to [CartLine].
extension CartLinePatterns on CartLine {
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
    TResult Function(_CartLine value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _CartLine() when $default != null:
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
    TResult Function(_CartLine value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CartLine():
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
    TResult? Function(_CartLine value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CartLine() when $default != null:
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
            String productId,
            String? variantId,
            String sellerId,
            String slug,
            String sku,
            String nameEn,
            String nameAr,
            ImageRef? image,
            Channel channel,
            int qty,
            int moq,
            @DecimalConverter() Decimal unitPrice,
            Currency currency,
            @DecimalConverter() Decimal vatRatePercent,
            bool priceTiered,
            Availability availability,
            bool sellableInChannel,
            @DecimalConverter() Decimal lineTotal)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _CartLine() when $default != null:
        return $default(
            _that.id,
            _that.productId,
            _that.variantId,
            _that.sellerId,
            _that.slug,
            _that.sku,
            _that.nameEn,
            _that.nameAr,
            _that.image,
            _that.channel,
            _that.qty,
            _that.moq,
            _that.unitPrice,
            _that.currency,
            _that.vatRatePercent,
            _that.priceTiered,
            _that.availability,
            _that.sellableInChannel,
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
            String id,
            String productId,
            String? variantId,
            String sellerId,
            String slug,
            String sku,
            String nameEn,
            String nameAr,
            ImageRef? image,
            Channel channel,
            int qty,
            int moq,
            @DecimalConverter() Decimal unitPrice,
            Currency currency,
            @DecimalConverter() Decimal vatRatePercent,
            bool priceTiered,
            Availability availability,
            bool sellableInChannel,
            @DecimalConverter() Decimal lineTotal)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CartLine():
        return $default(
            _that.id,
            _that.productId,
            _that.variantId,
            _that.sellerId,
            _that.slug,
            _that.sku,
            _that.nameEn,
            _that.nameAr,
            _that.image,
            _that.channel,
            _that.qty,
            _that.moq,
            _that.unitPrice,
            _that.currency,
            _that.vatRatePercent,
            _that.priceTiered,
            _that.availability,
            _that.sellableInChannel,
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
            String id,
            String productId,
            String? variantId,
            String sellerId,
            String slug,
            String sku,
            String nameEn,
            String nameAr,
            ImageRef? image,
            Channel channel,
            int qty,
            int moq,
            @DecimalConverter() Decimal unitPrice,
            Currency currency,
            @DecimalConverter() Decimal vatRatePercent,
            bool priceTiered,
            Availability availability,
            bool sellableInChannel,
            @DecimalConverter() Decimal lineTotal)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CartLine() when $default != null:
        return $default(
            _that.id,
            _that.productId,
            _that.variantId,
            _that.sellerId,
            _that.slug,
            _that.sku,
            _that.nameEn,
            _that.nameAr,
            _that.image,
            _that.channel,
            _that.qty,
            _that.moq,
            _that.unitPrice,
            _that.currency,
            _that.vatRatePercent,
            _that.priceTiered,
            _that.availability,
            _that.sellableInChannel,
            _that.lineTotal);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _CartLine extends CartLine {
  const _CartLine(
      {required this.id,
      required this.productId,
      required this.variantId,
      required this.sellerId,
      required this.slug,
      required this.sku,
      required this.nameEn,
      required this.nameAr,
      required this.image,
      required this.channel,
      required this.qty,
      required this.moq,
      @DecimalConverter() required this.unitPrice,
      required this.currency,
      @DecimalConverter() required this.vatRatePercent,
      required this.priceTiered,
      required this.availability,
      required this.sellableInChannel,
      @DecimalConverter() required this.lineTotal})
      : super._();
  factory _CartLine.fromJson(Map<String, dynamic> json) =>
      _$CartLineFromJson(json);

  @override
  final String id;
  @override
  final String productId;
  @override
  final String? variantId;
  @override
  final String sellerId;
  @override
  final String slug;
  @override
  final String sku;
  @override
  final String nameEn;
  @override
  final String nameAr;
  @override
  final ImageRef? image;
  @override
  final Channel channel;
  @override
  final int qty;

  /// Minimum order quantity. A B2B line below this cannot check out, so the
  /// stepper's floor comes from here, not from 1.
  @override
  final int moq;
  @override
  @DecimalConverter()
  final Decimal unitPrice;
  @override
  final Currency currency;
  @override
  @DecimalConverter()
  final Decimal vatRatePercent;

  /// True when the unit price came off a quantity ladder, so it will change
  /// if the quantity does.
  @override
  final bool priceTiered;
  @override
  final Availability availability;

  /// Whether this line can be ORDERED in [channel] — the platform's
  /// `isB2CEnabled`/`isB2BEnabled` gate, answered for the channel this line
  /// was priced in. See `ProductCard.sellableInChannel` in `catalogue.dart`.
  ///
  /// A line with `false` here is priced, in stock, above its MOQ and still
  /// impossible to buy: `secureCreateOrder` refuses the order. It must be
  /// shown as quote-only in the basket and must not be carried into a
  /// checkout — which is what [Cart.blockingLines] now enforces.
  @override
  final bool sellableInChannel;
  @override
  @DecimalConverter()
  final Decimal lineTotal;

  /// Create a copy of CartLine
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$CartLineCopyWith<_CartLine> get copyWith =>
      __$CartLineCopyWithImpl<_CartLine>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$CartLineToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _CartLine &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.variantId, variantId) ||
                other.variantId == variantId) &&
            (identical(other.sellerId, sellerId) ||
                other.sellerId == sellerId) &&
            (identical(other.slug, slug) || other.slug == slug) &&
            (identical(other.sku, sku) || other.sku == sku) &&
            (identical(other.nameEn, nameEn) || other.nameEn == nameEn) &&
            (identical(other.nameAr, nameAr) || other.nameAr == nameAr) &&
            (identical(other.image, image) || other.image == image) &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.qty, qty) || other.qty == qty) &&
            (identical(other.moq, moq) || other.moq == moq) &&
            (identical(other.unitPrice, unitPrice) ||
                other.unitPrice == unitPrice) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.vatRatePercent, vatRatePercent) ||
                other.vatRatePercent == vatRatePercent) &&
            (identical(other.priceTiered, priceTiered) ||
                other.priceTiered == priceTiered) &&
            (identical(other.availability, availability) ||
                other.availability == availability) &&
            (identical(other.sellableInChannel, sellableInChannel) ||
                other.sellableInChannel == sellableInChannel) &&
            (identical(other.lineTotal, lineTotal) ||
                other.lineTotal == lineTotal));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hashAll([
        runtimeType,
        id,
        productId,
        variantId,
        sellerId,
        slug,
        sku,
        nameEn,
        nameAr,
        image,
        channel,
        qty,
        moq,
        unitPrice,
        currency,
        vatRatePercent,
        priceTiered,
        availability,
        sellableInChannel,
        lineTotal
      ]);

  @override
  String toString() {
    return 'CartLine(id: $id, productId: $productId, variantId: $variantId, sellerId: $sellerId, slug: $slug, sku: $sku, nameEn: $nameEn, nameAr: $nameAr, image: $image, channel: $channel, qty: $qty, moq: $moq, unitPrice: $unitPrice, currency: $currency, vatRatePercent: $vatRatePercent, priceTiered: $priceTiered, availability: $availability, sellableInChannel: $sellableInChannel, lineTotal: $lineTotal)';
  }
}

/// @nodoc
abstract mixin class _$CartLineCopyWith<$Res>
    implements $CartLineCopyWith<$Res> {
  factory _$CartLineCopyWith(_CartLine value, $Res Function(_CartLine) _then) =
      __$CartLineCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String id,
      String productId,
      String? variantId,
      String sellerId,
      String slug,
      String sku,
      String nameEn,
      String nameAr,
      ImageRef? image,
      Channel channel,
      int qty,
      int moq,
      @DecimalConverter() Decimal unitPrice,
      Currency currency,
      @DecimalConverter() Decimal vatRatePercent,
      bool priceTiered,
      Availability availability,
      bool sellableInChannel,
      @DecimalConverter() Decimal lineTotal});

  @override
  $ImageRefCopyWith<$Res>? get image;
}

/// @nodoc
class __$CartLineCopyWithImpl<$Res> implements _$CartLineCopyWith<$Res> {
  __$CartLineCopyWithImpl(this._self, this._then);

  final _CartLine _self;
  final $Res Function(_CartLine) _then;

  /// Create a copy of CartLine
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? id = null,
    Object? productId = null,
    Object? variantId = freezed,
    Object? sellerId = null,
    Object? slug = null,
    Object? sku = null,
    Object? nameEn = null,
    Object? nameAr = null,
    Object? image = freezed,
    Object? channel = null,
    Object? qty = null,
    Object? moq = null,
    Object? unitPrice = null,
    Object? currency = null,
    Object? vatRatePercent = null,
    Object? priceTiered = null,
    Object? availability = null,
    Object? sellableInChannel = null,
    Object? lineTotal = null,
  }) {
    return _then(_CartLine(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
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
      image: freezed == image
          ? _self.image
          : image // ignore: cast_nullable_to_non_nullable
              as ImageRef?,
      channel: null == channel
          ? _self.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as Channel,
      qty: null == qty
          ? _self.qty
          : qty // ignore: cast_nullable_to_non_nullable
              as int,
      moq: null == moq
          ? _self.moq
          : moq // ignore: cast_nullable_to_non_nullable
              as int,
      unitPrice: null == unitPrice
          ? _self.unitPrice
          : unitPrice // ignore: cast_nullable_to_non_nullable
              as Decimal,
      currency: null == currency
          ? _self.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as Currency,
      vatRatePercent: null == vatRatePercent
          ? _self.vatRatePercent
          : vatRatePercent // ignore: cast_nullable_to_non_nullable
              as Decimal,
      priceTiered: null == priceTiered
          ? _self.priceTiered
          : priceTiered // ignore: cast_nullable_to_non_nullable
              as bool,
      availability: null == availability
          ? _self.availability
          : availability // ignore: cast_nullable_to_non_nullable
              as Availability,
      sellableInChannel: null == sellableInChannel
          ? _self.sellableInChannel
          : sellableInChannel // ignore: cast_nullable_to_non_nullable
              as bool,
      lineTotal: null == lineTotal
          ? _self.lineTotal
          : lineTotal // ignore: cast_nullable_to_non_nullable
              as Decimal,
    ));
  }

  /// Create a copy of CartLine
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
mixin _$Cart {
  String get id;

  /// A cart is single-currency by contract. Every [CartLine] repeats it, and
  /// they always agree — [assertSingleCurrency] is the check that says so.
  Currency get currency;
  List<CartLine> get lines;
  int get itemCount;
  @DecimalConverter()
  Decimal get subtotal;
  @UtcDateTimeConverter()
  DateTime get updatedAt;

  /// Create a copy of Cart
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $CartCopyWith<Cart> get copyWith =>
      _$CartCopyWithImpl<Cart>(this as Cart, _$identity);

  /// Serializes this Cart to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is Cart &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            const DeepCollectionEquality().equals(other.lines, lines) &&
            (identical(other.itemCount, itemCount) ||
                other.itemCount == itemCount) &&
            (identical(other.subtotal, subtotal) ||
                other.subtotal == subtotal) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      currency,
      const DeepCollectionEquality().hash(lines),
      itemCount,
      subtotal,
      updatedAt);

  @override
  String toString() {
    return 'Cart(id: $id, currency: $currency, lines: $lines, itemCount: $itemCount, subtotal: $subtotal, updatedAt: $updatedAt)';
  }
}

/// @nodoc
abstract mixin class $CartCopyWith<$Res> {
  factory $CartCopyWith(Cart value, $Res Function(Cart) _then) =
      _$CartCopyWithImpl;
  @useResult
  $Res call(
      {String id,
      Currency currency,
      List<CartLine> lines,
      int itemCount,
      @DecimalConverter() Decimal subtotal,
      @UtcDateTimeConverter() DateTime updatedAt});
}

/// @nodoc
class _$CartCopyWithImpl<$Res> implements $CartCopyWith<$Res> {
  _$CartCopyWithImpl(this._self, this._then);

  final Cart _self;
  final $Res Function(Cart) _then;

  /// Create a copy of Cart
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? currency = null,
    Object? lines = null,
    Object? itemCount = null,
    Object? subtotal = null,
    Object? updatedAt = null,
  }) {
    return _then(_self.copyWith(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      currency: null == currency
          ? _self.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as Currency,
      lines: null == lines
          ? _self.lines
          : lines // ignore: cast_nullable_to_non_nullable
              as List<CartLine>,
      itemCount: null == itemCount
          ? _self.itemCount
          : itemCount // ignore: cast_nullable_to_non_nullable
              as int,
      subtotal: null == subtotal
          ? _self.subtotal
          : subtotal // ignore: cast_nullable_to_non_nullable
              as Decimal,
      updatedAt: null == updatedAt
          ? _self.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }
}

/// Adds pattern-matching-related methods to [Cart].
extension CartPatterns on Cart {
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
    TResult Function(_Cart value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _Cart() when $default != null:
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
    TResult Function(_Cart value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Cart():
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
    TResult? Function(_Cart value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Cart() when $default != null:
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
            Currency currency,
            List<CartLine> lines,
            int itemCount,
            @DecimalConverter() Decimal subtotal,
            @UtcDateTimeConverter() DateTime updatedAt)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _Cart() when $default != null:
        return $default(_that.id, _that.currency, _that.lines, _that.itemCount,
            _that.subtotal, _that.updatedAt);
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
            Currency currency,
            List<CartLine> lines,
            int itemCount,
            @DecimalConverter() Decimal subtotal,
            @UtcDateTimeConverter() DateTime updatedAt)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Cart():
        return $default(_that.id, _that.currency, _that.lines, _that.itemCount,
            _that.subtotal, _that.updatedAt);
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
            Currency currency,
            List<CartLine> lines,
            int itemCount,
            @DecimalConverter() Decimal subtotal,
            @UtcDateTimeConverter() DateTime updatedAt)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Cart() when $default != null:
        return $default(_that.id, _that.currency, _that.lines, _that.itemCount,
            _that.subtotal, _that.updatedAt);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _Cart extends Cart {
  const _Cart(
      {required this.id,
      required this.currency,
      required final List<CartLine> lines,
      required this.itemCount,
      @DecimalConverter() required this.subtotal,
      @UtcDateTimeConverter() required this.updatedAt})
      : _lines = lines,
        super._();
  factory _Cart.fromJson(Map<String, dynamic> json) => _$CartFromJson(json);

  @override
  final String id;

  /// A cart is single-currency by contract. Every [CartLine] repeats it, and
  /// they always agree — [assertSingleCurrency] is the check that says so.
  @override
  final Currency currency;
  final List<CartLine> _lines;
  @override
  List<CartLine> get lines {
    if (_lines is EqualUnmodifiableListView) return _lines;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_lines);
  }

  @override
  final int itemCount;
  @override
  @DecimalConverter()
  final Decimal subtotal;
  @override
  @UtcDateTimeConverter()
  final DateTime updatedAt;

  /// Create a copy of Cart
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$CartCopyWith<_Cart> get copyWith =>
      __$CartCopyWithImpl<_Cart>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$CartToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _Cart &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            const DeepCollectionEquality().equals(other._lines, _lines) &&
            (identical(other.itemCount, itemCount) ||
                other.itemCount == itemCount) &&
            (identical(other.subtotal, subtotal) ||
                other.subtotal == subtotal) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      currency,
      const DeepCollectionEquality().hash(_lines),
      itemCount,
      subtotal,
      updatedAt);

  @override
  String toString() {
    return 'Cart(id: $id, currency: $currency, lines: $lines, itemCount: $itemCount, subtotal: $subtotal, updatedAt: $updatedAt)';
  }
}

/// @nodoc
abstract mixin class _$CartCopyWith<$Res> implements $CartCopyWith<$Res> {
  factory _$CartCopyWith(_Cart value, $Res Function(_Cart) _then) =
      __$CartCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String id,
      Currency currency,
      List<CartLine> lines,
      int itemCount,
      @DecimalConverter() Decimal subtotal,
      @UtcDateTimeConverter() DateTime updatedAt});
}

/// @nodoc
class __$CartCopyWithImpl<$Res> implements _$CartCopyWith<$Res> {
  __$CartCopyWithImpl(this._self, this._then);

  final _Cart _self;
  final $Res Function(_Cart) _then;

  /// Create a copy of Cart
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? id = null,
    Object? currency = null,
    Object? lines = null,
    Object? itemCount = null,
    Object? subtotal = null,
    Object? updatedAt = null,
  }) {
    return _then(_Cart(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      currency: null == currency
          ? _self.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as Currency,
      lines: null == lines
          ? _self._lines
          : lines // ignore: cast_nullable_to_non_nullable
              as List<CartLine>,
      itemCount: null == itemCount
          ? _self.itemCount
          : itemCount // ignore: cast_nullable_to_non_nullable
              as int,
      subtotal: null == subtotal
          ? _self.subtotal
          : subtotal // ignore: cast_nullable_to_non_nullable
              as Decimal,
      updatedAt: null == updatedAt
          ? _self.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }
}

/// @nodoc
mixin _$CartMergeRejection {
  String get productId;
  String? get variantId;
  CartMergeRejectionReason get reason;
  int? get acceptedQty;

  /// Create a copy of CartMergeRejection
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $CartMergeRejectionCopyWith<CartMergeRejection> get copyWith =>
      _$CartMergeRejectionCopyWithImpl<CartMergeRejection>(
          this as CartMergeRejection, _$identity);

  /// Serializes this CartMergeRejection to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is CartMergeRejection &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.variantId, variantId) ||
                other.variantId == variantId) &&
            (identical(other.reason, reason) || other.reason == reason) &&
            (identical(other.acceptedQty, acceptedQty) ||
                other.acceptedQty == acceptedQty));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, productId, variantId, reason, acceptedQty);

  @override
  String toString() {
    return 'CartMergeRejection(productId: $productId, variantId: $variantId, reason: $reason, acceptedQty: $acceptedQty)';
  }
}

/// @nodoc
abstract mixin class $CartMergeRejectionCopyWith<$Res> {
  factory $CartMergeRejectionCopyWith(
          CartMergeRejection value, $Res Function(CartMergeRejection) _then) =
      _$CartMergeRejectionCopyWithImpl;
  @useResult
  $Res call(
      {String productId,
      String? variantId,
      CartMergeRejectionReason reason,
      int? acceptedQty});
}

/// @nodoc
class _$CartMergeRejectionCopyWithImpl<$Res>
    implements $CartMergeRejectionCopyWith<$Res> {
  _$CartMergeRejectionCopyWithImpl(this._self, this._then);

  final CartMergeRejection _self;
  final $Res Function(CartMergeRejection) _then;

  /// Create a copy of CartMergeRejection
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? productId = null,
    Object? variantId = freezed,
    Object? reason = null,
    Object? acceptedQty = freezed,
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
      reason: null == reason
          ? _self.reason
          : reason // ignore: cast_nullable_to_non_nullable
              as CartMergeRejectionReason,
      acceptedQty: freezed == acceptedQty
          ? _self.acceptedQty
          : acceptedQty // ignore: cast_nullable_to_non_nullable
              as int?,
    ));
  }
}

/// Adds pattern-matching-related methods to [CartMergeRejection].
extension CartMergeRejectionPatterns on CartMergeRejection {
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
    TResult Function(_CartMergeRejection value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _CartMergeRejection() when $default != null:
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
    TResult Function(_CartMergeRejection value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CartMergeRejection():
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
    TResult? Function(_CartMergeRejection value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CartMergeRejection() when $default != null:
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
    TResult Function(String productId, String? variantId,
            CartMergeRejectionReason reason, int? acceptedQty)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _CartMergeRejection() when $default != null:
        return $default(
            _that.productId, _that.variantId, _that.reason, _that.acceptedQty);
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
    TResult Function(String productId, String? variantId,
            CartMergeRejectionReason reason, int? acceptedQty)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CartMergeRejection():
        return $default(
            _that.productId, _that.variantId, _that.reason, _that.acceptedQty);
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
    TResult? Function(String productId, String? variantId,
            CartMergeRejectionReason reason, int? acceptedQty)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CartMergeRejection() when $default != null:
        return $default(
            _that.productId, _that.variantId, _that.reason, _that.acceptedQty);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _CartMergeRejection implements CartMergeRejection {
  const _CartMergeRejection(
      {required this.productId,
      required this.variantId,
      required this.reason,
      required this.acceptedQty});
  factory _CartMergeRejection.fromJson(Map<String, dynamic> json) =>
      _$CartMergeRejectionFromJson(json);

  @override
  final String productId;
  @override
  final String? variantId;
  @override
  final CartMergeRejectionReason reason;
  @override
  final int? acceptedQty;

  /// Create a copy of CartMergeRejection
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$CartMergeRejectionCopyWith<_CartMergeRejection> get copyWith =>
      __$CartMergeRejectionCopyWithImpl<_CartMergeRejection>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$CartMergeRejectionToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _CartMergeRejection &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.variantId, variantId) ||
                other.variantId == variantId) &&
            (identical(other.reason, reason) || other.reason == reason) &&
            (identical(other.acceptedQty, acceptedQty) ||
                other.acceptedQty == acceptedQty));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, productId, variantId, reason, acceptedQty);

  @override
  String toString() {
    return 'CartMergeRejection(productId: $productId, variantId: $variantId, reason: $reason, acceptedQty: $acceptedQty)';
  }
}

/// @nodoc
abstract mixin class _$CartMergeRejectionCopyWith<$Res>
    implements $CartMergeRejectionCopyWith<$Res> {
  factory _$CartMergeRejectionCopyWith(
          _CartMergeRejection value, $Res Function(_CartMergeRejection) _then) =
      __$CartMergeRejectionCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String productId,
      String? variantId,
      CartMergeRejectionReason reason,
      int? acceptedQty});
}

/// @nodoc
class __$CartMergeRejectionCopyWithImpl<$Res>
    implements _$CartMergeRejectionCopyWith<$Res> {
  __$CartMergeRejectionCopyWithImpl(this._self, this._then);

  final _CartMergeRejection _self;
  final $Res Function(_CartMergeRejection) _then;

  /// Create a copy of CartMergeRejection
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? productId = null,
    Object? variantId = freezed,
    Object? reason = null,
    Object? acceptedQty = freezed,
  }) {
    return _then(_CartMergeRejection(
      productId: null == productId
          ? _self.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      variantId: freezed == variantId
          ? _self.variantId
          : variantId // ignore: cast_nullable_to_non_nullable
              as String?,
      reason: null == reason
          ? _self.reason
          : reason // ignore: cast_nullable_to_non_nullable
              as CartMergeRejectionReason,
      acceptedQty: freezed == acceptedQty
          ? _self.acceptedQty
          : acceptedQty // ignore: cast_nullable_to_non_nullable
              as int?,
    ));
  }
}

/// @nodoc
mixin _$CartMergeResult {
  Cart get cart;
  List<CartMergeRejection> get rejected;

  /// Create a copy of CartMergeResult
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $CartMergeResultCopyWith<CartMergeResult> get copyWith =>
      _$CartMergeResultCopyWithImpl<CartMergeResult>(
          this as CartMergeResult, _$identity);

  /// Serializes this CartMergeResult to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is CartMergeResult &&
            (identical(other.cart, cart) || other.cart == cart) &&
            const DeepCollectionEquality().equals(other.rejected, rejected));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, cart, const DeepCollectionEquality().hash(rejected));

  @override
  String toString() {
    return 'CartMergeResult(cart: $cart, rejected: $rejected)';
  }
}

/// @nodoc
abstract mixin class $CartMergeResultCopyWith<$Res> {
  factory $CartMergeResultCopyWith(
          CartMergeResult value, $Res Function(CartMergeResult) _then) =
      _$CartMergeResultCopyWithImpl;
  @useResult
  $Res call({Cart cart, List<CartMergeRejection> rejected});

  $CartCopyWith<$Res> get cart;
}

/// @nodoc
class _$CartMergeResultCopyWithImpl<$Res>
    implements $CartMergeResultCopyWith<$Res> {
  _$CartMergeResultCopyWithImpl(this._self, this._then);

  final CartMergeResult _self;
  final $Res Function(CartMergeResult) _then;

  /// Create a copy of CartMergeResult
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? cart = null,
    Object? rejected = null,
  }) {
    return _then(_self.copyWith(
      cart: null == cart
          ? _self.cart
          : cart // ignore: cast_nullable_to_non_nullable
              as Cart,
      rejected: null == rejected
          ? _self.rejected
          : rejected // ignore: cast_nullable_to_non_nullable
              as List<CartMergeRejection>,
    ));
  }

  /// Create a copy of CartMergeResult
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $CartCopyWith<$Res> get cart {
    return $CartCopyWith<$Res>(_self.cart, (value) {
      return _then(_self.copyWith(cart: value));
    });
  }
}

/// Adds pattern-matching-related methods to [CartMergeResult].
extension CartMergeResultPatterns on CartMergeResult {
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
    TResult Function(_CartMergeResult value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _CartMergeResult() when $default != null:
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
    TResult Function(_CartMergeResult value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CartMergeResult():
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
    TResult? Function(_CartMergeResult value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CartMergeResult() when $default != null:
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
    TResult Function(Cart cart, List<CartMergeRejection> rejected)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _CartMergeResult() when $default != null:
        return $default(_that.cart, _that.rejected);
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
    TResult Function(Cart cart, List<CartMergeRejection> rejected) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CartMergeResult():
        return $default(_that.cart, _that.rejected);
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
    TResult? Function(Cart cart, List<CartMergeRejection> rejected)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CartMergeResult() when $default != null:
        return $default(_that.cart, _that.rejected);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _CartMergeResult extends CartMergeResult {
  const _CartMergeResult(
      {required this.cart, required final List<CartMergeRejection> rejected})
      : _rejected = rejected,
        super._();
  factory _CartMergeResult.fromJson(Map<String, dynamic> json) =>
      _$CartMergeResultFromJson(json);

  @override
  final Cart cart;
  final List<CartMergeRejection> _rejected;
  @override
  List<CartMergeRejection> get rejected {
    if (_rejected is EqualUnmodifiableListView) return _rejected;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_rejected);
  }

  /// Create a copy of CartMergeResult
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$CartMergeResultCopyWith<_CartMergeResult> get copyWith =>
      __$CartMergeResultCopyWithImpl<_CartMergeResult>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$CartMergeResultToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _CartMergeResult &&
            (identical(other.cart, cart) || other.cart == cart) &&
            const DeepCollectionEquality().equals(other._rejected, _rejected));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, cart, const DeepCollectionEquality().hash(_rejected));

  @override
  String toString() {
    return 'CartMergeResult(cart: $cart, rejected: $rejected)';
  }
}

/// @nodoc
abstract mixin class _$CartMergeResultCopyWith<$Res>
    implements $CartMergeResultCopyWith<$Res> {
  factory _$CartMergeResultCopyWith(
          _CartMergeResult value, $Res Function(_CartMergeResult) _then) =
      __$CartMergeResultCopyWithImpl;
  @override
  @useResult
  $Res call({Cart cart, List<CartMergeRejection> rejected});

  @override
  $CartCopyWith<$Res> get cart;
}

/// @nodoc
class __$CartMergeResultCopyWithImpl<$Res>
    implements _$CartMergeResultCopyWith<$Res> {
  __$CartMergeResultCopyWithImpl(this._self, this._then);

  final _CartMergeResult _self;
  final $Res Function(_CartMergeResult) _then;

  /// Create a copy of CartMergeResult
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? cart = null,
    Object? rejected = null,
  }) {
    return _then(_CartMergeResult(
      cart: null == cart
          ? _self.cart
          : cart // ignore: cast_nullable_to_non_nullable
              as Cart,
      rejected: null == rejected
          ? _self._rejected
          : rejected // ignore: cast_nullable_to_non_nullable
              as List<CartMergeRejection>,
    ));
  }

  /// Create a copy of CartMergeResult
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $CartCopyWith<$Res> get cart {
    return $CartCopyWith<$Res>(_self.cart, (value) {
      return _then(_self.copyWith(cart: value));
    });
  }
}

// dart format on
