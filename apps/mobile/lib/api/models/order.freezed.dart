// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'order.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$OrderItem {
  String get id;
  String get productId;
  String? get variantId;
  String get sellerId;
  String? get slug;
  String get sku;
  String get nameEn;
  String get nameAr;
  ImageRef? get image;
  int get quantity;
  @DecimalConverter()
  Decimal get unitPrice;
  @DecimalConverter()
  Decimal get vatRatePercent;
  @DecimalConverter()
  Decimal get vatAmount;
  @DecimalConverter()
  Decimal get total;

  /// A line can move independently of the order: one seller ships while
  /// another cancels. Do not read the order's status onto its items.
  OrderStatus get status;

  /// Create a copy of OrderItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $OrderItemCopyWith<OrderItem> get copyWith =>
      _$OrderItemCopyWithImpl<OrderItem>(this as OrderItem, _$identity);

  /// Serializes this OrderItem to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is OrderItem &&
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
            (identical(other.quantity, quantity) ||
                other.quantity == quantity) &&
            (identical(other.unitPrice, unitPrice) ||
                other.unitPrice == unitPrice) &&
            (identical(other.vatRatePercent, vatRatePercent) ||
                other.vatRatePercent == vatRatePercent) &&
            (identical(other.vatAmount, vatAmount) ||
                other.vatAmount == vatAmount) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.status, status) || other.status == status));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
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
      quantity,
      unitPrice,
      vatRatePercent,
      vatAmount,
      total,
      status);

  @override
  String toString() {
    return 'OrderItem(id: $id, productId: $productId, variantId: $variantId, sellerId: $sellerId, slug: $slug, sku: $sku, nameEn: $nameEn, nameAr: $nameAr, image: $image, quantity: $quantity, unitPrice: $unitPrice, vatRatePercent: $vatRatePercent, vatAmount: $vatAmount, total: $total, status: $status)';
  }
}

/// @nodoc
abstract mixin class $OrderItemCopyWith<$Res> {
  factory $OrderItemCopyWith(OrderItem value, $Res Function(OrderItem) _then) =
      _$OrderItemCopyWithImpl;
  @useResult
  $Res call(
      {String id,
      String productId,
      String? variantId,
      String sellerId,
      String? slug,
      String sku,
      String nameEn,
      String nameAr,
      ImageRef? image,
      int quantity,
      @DecimalConverter() Decimal unitPrice,
      @DecimalConverter() Decimal vatRatePercent,
      @DecimalConverter() Decimal vatAmount,
      @DecimalConverter() Decimal total,
      OrderStatus status});

  $ImageRefCopyWith<$Res>? get image;
}

/// @nodoc
class _$OrderItemCopyWithImpl<$Res> implements $OrderItemCopyWith<$Res> {
  _$OrderItemCopyWithImpl(this._self, this._then);

  final OrderItem _self;
  final $Res Function(OrderItem) _then;

  /// Create a copy of OrderItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? productId = null,
    Object? variantId = freezed,
    Object? sellerId = null,
    Object? slug = freezed,
    Object? sku = null,
    Object? nameEn = null,
    Object? nameAr = null,
    Object? image = freezed,
    Object? quantity = null,
    Object? unitPrice = null,
    Object? vatRatePercent = null,
    Object? vatAmount = null,
    Object? total = null,
    Object? status = null,
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
      slug: freezed == slug
          ? _self.slug
          : slug // ignore: cast_nullable_to_non_nullable
              as String?,
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
      total: null == total
          ? _self.total
          : total // ignore: cast_nullable_to_non_nullable
              as Decimal,
      status: null == status
          ? _self.status
          : status // ignore: cast_nullable_to_non_nullable
              as OrderStatus,
    ));
  }

  /// Create a copy of OrderItem
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

/// Adds pattern-matching-related methods to [OrderItem].
extension OrderItemPatterns on OrderItem {
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
    TResult Function(_OrderItem value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _OrderItem() when $default != null:
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
    TResult Function(_OrderItem value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OrderItem():
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
    TResult? Function(_OrderItem value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OrderItem() when $default != null:
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
            String? slug,
            String sku,
            String nameEn,
            String nameAr,
            ImageRef? image,
            int quantity,
            @DecimalConverter() Decimal unitPrice,
            @DecimalConverter() Decimal vatRatePercent,
            @DecimalConverter() Decimal vatAmount,
            @DecimalConverter() Decimal total,
            OrderStatus status)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _OrderItem() when $default != null:
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
            _that.quantity,
            _that.unitPrice,
            _that.vatRatePercent,
            _that.vatAmount,
            _that.total,
            _that.status);
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
            String? slug,
            String sku,
            String nameEn,
            String nameAr,
            ImageRef? image,
            int quantity,
            @DecimalConverter() Decimal unitPrice,
            @DecimalConverter() Decimal vatRatePercent,
            @DecimalConverter() Decimal vatAmount,
            @DecimalConverter() Decimal total,
            OrderStatus status)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OrderItem():
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
            _that.quantity,
            _that.unitPrice,
            _that.vatRatePercent,
            _that.vatAmount,
            _that.total,
            _that.status);
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
            String? slug,
            String sku,
            String nameEn,
            String nameAr,
            ImageRef? image,
            int quantity,
            @DecimalConverter() Decimal unitPrice,
            @DecimalConverter() Decimal vatRatePercent,
            @DecimalConverter() Decimal vatAmount,
            @DecimalConverter() Decimal total,
            OrderStatus status)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OrderItem() when $default != null:
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
            _that.quantity,
            _that.unitPrice,
            _that.vatRatePercent,
            _that.vatAmount,
            _that.total,
            _that.status);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _OrderItem extends OrderItem {
  const _OrderItem(
      {required this.id,
      required this.productId,
      required this.variantId,
      required this.sellerId,
      required this.slug,
      required this.sku,
      required this.nameEn,
      required this.nameAr,
      required this.image,
      required this.quantity,
      @DecimalConverter() required this.unitPrice,
      @DecimalConverter() required this.vatRatePercent,
      @DecimalConverter() required this.vatAmount,
      @DecimalConverter() required this.total,
      required this.status})
      : super._();
  factory _OrderItem.fromJson(Map<String, dynamic> json) =>
      _$OrderItemFromJson(json);

  @override
  final String id;
  @override
  final String productId;
  @override
  final String? variantId;
  @override
  final String sellerId;
  @override
  final String? slug;
  @override
  final String sku;
  @override
  final String nameEn;
  @override
  final String nameAr;
  @override
  final ImageRef? image;
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
  final Decimal total;

  /// A line can move independently of the order: one seller ships while
  /// another cancels. Do not read the order's status onto its items.
  @override
  final OrderStatus status;

  /// Create a copy of OrderItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$OrderItemCopyWith<_OrderItem> get copyWith =>
      __$OrderItemCopyWithImpl<_OrderItem>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$OrderItemToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _OrderItem &&
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
            (identical(other.quantity, quantity) ||
                other.quantity == quantity) &&
            (identical(other.unitPrice, unitPrice) ||
                other.unitPrice == unitPrice) &&
            (identical(other.vatRatePercent, vatRatePercent) ||
                other.vatRatePercent == vatRatePercent) &&
            (identical(other.vatAmount, vatAmount) ||
                other.vatAmount == vatAmount) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.status, status) || other.status == status));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
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
      quantity,
      unitPrice,
      vatRatePercent,
      vatAmount,
      total,
      status);

  @override
  String toString() {
    return 'OrderItem(id: $id, productId: $productId, variantId: $variantId, sellerId: $sellerId, slug: $slug, sku: $sku, nameEn: $nameEn, nameAr: $nameAr, image: $image, quantity: $quantity, unitPrice: $unitPrice, vatRatePercent: $vatRatePercent, vatAmount: $vatAmount, total: $total, status: $status)';
  }
}

/// @nodoc
abstract mixin class _$OrderItemCopyWith<$Res>
    implements $OrderItemCopyWith<$Res> {
  factory _$OrderItemCopyWith(
          _OrderItem value, $Res Function(_OrderItem) _then) =
      __$OrderItemCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String id,
      String productId,
      String? variantId,
      String sellerId,
      String? slug,
      String sku,
      String nameEn,
      String nameAr,
      ImageRef? image,
      int quantity,
      @DecimalConverter() Decimal unitPrice,
      @DecimalConverter() Decimal vatRatePercent,
      @DecimalConverter() Decimal vatAmount,
      @DecimalConverter() Decimal total,
      OrderStatus status});

  @override
  $ImageRefCopyWith<$Res>? get image;
}

/// @nodoc
class __$OrderItemCopyWithImpl<$Res> implements _$OrderItemCopyWith<$Res> {
  __$OrderItemCopyWithImpl(this._self, this._then);

  final _OrderItem _self;
  final $Res Function(_OrderItem) _then;

  /// Create a copy of OrderItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? id = null,
    Object? productId = null,
    Object? variantId = freezed,
    Object? sellerId = null,
    Object? slug = freezed,
    Object? sku = null,
    Object? nameEn = null,
    Object? nameAr = null,
    Object? image = freezed,
    Object? quantity = null,
    Object? unitPrice = null,
    Object? vatRatePercent = null,
    Object? vatAmount = null,
    Object? total = null,
    Object? status = null,
  }) {
    return _then(_OrderItem(
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
      slug: freezed == slug
          ? _self.slug
          : slug // ignore: cast_nullable_to_non_nullable
              as String?,
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
      total: null == total
          ? _self.total
          : total // ignore: cast_nullable_to_non_nullable
              as Decimal,
      status: null == status
          ? _self.status
          : status // ignore: cast_nullable_to_non_nullable
              as OrderStatus,
    ));
  }

  /// Create a copy of OrderItem
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
mixin _$OrderStatusEvent {
  OrderStatus get status;
  String? get message;
  @UtcDateTimeConverter()
  DateTime get occurredAt;

  /// Create a copy of OrderStatusEvent
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $OrderStatusEventCopyWith<OrderStatusEvent> get copyWith =>
      _$OrderStatusEventCopyWithImpl<OrderStatusEvent>(
          this as OrderStatusEvent, _$identity);

  /// Serializes this OrderStatusEvent to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is OrderStatusEvent &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.message, message) || other.message == message) &&
            (identical(other.occurredAt, occurredAt) ||
                other.occurredAt == occurredAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, status, message, occurredAt);

  @override
  String toString() {
    return 'OrderStatusEvent(status: $status, message: $message, occurredAt: $occurredAt)';
  }
}

/// @nodoc
abstract mixin class $OrderStatusEventCopyWith<$Res> {
  factory $OrderStatusEventCopyWith(
          OrderStatusEvent value, $Res Function(OrderStatusEvent) _then) =
      _$OrderStatusEventCopyWithImpl;
  @useResult
  $Res call(
      {OrderStatus status,
      String? message,
      @UtcDateTimeConverter() DateTime occurredAt});
}

/// @nodoc
class _$OrderStatusEventCopyWithImpl<$Res>
    implements $OrderStatusEventCopyWith<$Res> {
  _$OrderStatusEventCopyWithImpl(this._self, this._then);

  final OrderStatusEvent _self;
  final $Res Function(OrderStatusEvent) _then;

  /// Create a copy of OrderStatusEvent
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? status = null,
    Object? message = freezed,
    Object? occurredAt = null,
  }) {
    return _then(_self.copyWith(
      status: null == status
          ? _self.status
          : status // ignore: cast_nullable_to_non_nullable
              as OrderStatus,
      message: freezed == message
          ? _self.message
          : message // ignore: cast_nullable_to_non_nullable
              as String?,
      occurredAt: null == occurredAt
          ? _self.occurredAt
          : occurredAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }
}

/// Adds pattern-matching-related methods to [OrderStatusEvent].
extension OrderStatusEventPatterns on OrderStatusEvent {
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
    TResult Function(_OrderStatusEvent value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _OrderStatusEvent() when $default != null:
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
    TResult Function(_OrderStatusEvent value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OrderStatusEvent():
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
    TResult? Function(_OrderStatusEvent value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OrderStatusEvent() when $default != null:
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
    TResult Function(OrderStatus status, String? message,
            @UtcDateTimeConverter() DateTime occurredAt)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _OrderStatusEvent() when $default != null:
        return $default(_that.status, _that.message, _that.occurredAt);
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
    TResult Function(OrderStatus status, String? message,
            @UtcDateTimeConverter() DateTime occurredAt)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OrderStatusEvent():
        return $default(_that.status, _that.message, _that.occurredAt);
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
    TResult? Function(OrderStatus status, String? message,
            @UtcDateTimeConverter() DateTime occurredAt)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OrderStatusEvent() when $default != null:
        return $default(_that.status, _that.message, _that.occurredAt);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _OrderStatusEvent implements OrderStatusEvent {
  const _OrderStatusEvent(
      {required this.status,
      required this.message,
      @UtcDateTimeConverter() required this.occurredAt});
  factory _OrderStatusEvent.fromJson(Map<String, dynamic> json) =>
      _$OrderStatusEventFromJson(json);

  @override
  final OrderStatus status;
  @override
  final String? message;
  @override
  @UtcDateTimeConverter()
  final DateTime occurredAt;

  /// Create a copy of OrderStatusEvent
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$OrderStatusEventCopyWith<_OrderStatusEvent> get copyWith =>
      __$OrderStatusEventCopyWithImpl<_OrderStatusEvent>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$OrderStatusEventToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _OrderStatusEvent &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.message, message) || other.message == message) &&
            (identical(other.occurredAt, occurredAt) ||
                other.occurredAt == occurredAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, status, message, occurredAt);

  @override
  String toString() {
    return 'OrderStatusEvent(status: $status, message: $message, occurredAt: $occurredAt)';
  }
}

/// @nodoc
abstract mixin class _$OrderStatusEventCopyWith<$Res>
    implements $OrderStatusEventCopyWith<$Res> {
  factory _$OrderStatusEventCopyWith(
          _OrderStatusEvent value, $Res Function(_OrderStatusEvent) _then) =
      __$OrderStatusEventCopyWithImpl;
  @override
  @useResult
  $Res call(
      {OrderStatus status,
      String? message,
      @UtcDateTimeConverter() DateTime occurredAt});
}

/// @nodoc
class __$OrderStatusEventCopyWithImpl<$Res>
    implements _$OrderStatusEventCopyWith<$Res> {
  __$OrderStatusEventCopyWithImpl(this._self, this._then);

  final _OrderStatusEvent _self;
  final $Res Function(_OrderStatusEvent) _then;

  /// Create a copy of OrderStatusEvent
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? status = null,
    Object? message = freezed,
    Object? occurredAt = null,
  }) {
    return _then(_OrderStatusEvent(
      status: null == status
          ? _self.status
          : status // ignore: cast_nullable_to_non_nullable
              as OrderStatus,
      message: freezed == message
          ? _self.message
          : message // ignore: cast_nullable_to_non_nullable
              as String?,
      occurredAt: null == occurredAt
          ? _self.occurredAt
          : occurredAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }
}

/// @nodoc
mixin _$Shipment {
  String get id;
  ShipmentStatus get status;
  String? get carrier;
  String? get trackingNumber;
  String? get trackingUrl;
  @NullableUtcDateTimeConverter()
  DateTime? get estimatedDelivery;

  /// Create a copy of Shipment
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $ShipmentCopyWith<Shipment> get copyWith =>
      _$ShipmentCopyWithImpl<Shipment>(this as Shipment, _$identity);

  /// Serializes this Shipment to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is Shipment &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.carrier, carrier) || other.carrier == carrier) &&
            (identical(other.trackingNumber, trackingNumber) ||
                other.trackingNumber == trackingNumber) &&
            (identical(other.trackingUrl, trackingUrl) ||
                other.trackingUrl == trackingUrl) &&
            (identical(other.estimatedDelivery, estimatedDelivery) ||
                other.estimatedDelivery == estimatedDelivery));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, status, carrier,
      trackingNumber, trackingUrl, estimatedDelivery);

  @override
  String toString() {
    return 'Shipment(id: $id, status: $status, carrier: $carrier, trackingNumber: $trackingNumber, trackingUrl: $trackingUrl, estimatedDelivery: $estimatedDelivery)';
  }
}

/// @nodoc
abstract mixin class $ShipmentCopyWith<$Res> {
  factory $ShipmentCopyWith(Shipment value, $Res Function(Shipment) _then) =
      _$ShipmentCopyWithImpl;
  @useResult
  $Res call(
      {String id,
      ShipmentStatus status,
      String? carrier,
      String? trackingNumber,
      String? trackingUrl,
      @NullableUtcDateTimeConverter() DateTime? estimatedDelivery});
}

/// @nodoc
class _$ShipmentCopyWithImpl<$Res> implements $ShipmentCopyWith<$Res> {
  _$ShipmentCopyWithImpl(this._self, this._then);

  final Shipment _self;
  final $Res Function(Shipment) _then;

  /// Create a copy of Shipment
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? status = null,
    Object? carrier = freezed,
    Object? trackingNumber = freezed,
    Object? trackingUrl = freezed,
    Object? estimatedDelivery = freezed,
  }) {
    return _then(_self.copyWith(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _self.status
          : status // ignore: cast_nullable_to_non_nullable
              as ShipmentStatus,
      carrier: freezed == carrier
          ? _self.carrier
          : carrier // ignore: cast_nullable_to_non_nullable
              as String?,
      trackingNumber: freezed == trackingNumber
          ? _self.trackingNumber
          : trackingNumber // ignore: cast_nullable_to_non_nullable
              as String?,
      trackingUrl: freezed == trackingUrl
          ? _self.trackingUrl
          : trackingUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      estimatedDelivery: freezed == estimatedDelivery
          ? _self.estimatedDelivery
          : estimatedDelivery // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// Adds pattern-matching-related methods to [Shipment].
extension ShipmentPatterns on Shipment {
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
    TResult Function(_Shipment value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _Shipment() when $default != null:
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
    TResult Function(_Shipment value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Shipment():
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
    TResult? Function(_Shipment value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Shipment() when $default != null:
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
            ShipmentStatus status,
            String? carrier,
            String? trackingNumber,
            String? trackingUrl,
            @NullableUtcDateTimeConverter() DateTime? estimatedDelivery)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _Shipment() when $default != null:
        return $default(_that.id, _that.status, _that.carrier,
            _that.trackingNumber, _that.trackingUrl, _that.estimatedDelivery);
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
            ShipmentStatus status,
            String? carrier,
            String? trackingNumber,
            String? trackingUrl,
            @NullableUtcDateTimeConverter() DateTime? estimatedDelivery)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Shipment():
        return $default(_that.id, _that.status, _that.carrier,
            _that.trackingNumber, _that.trackingUrl, _that.estimatedDelivery);
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
            ShipmentStatus status,
            String? carrier,
            String? trackingNumber,
            String? trackingUrl,
            @NullableUtcDateTimeConverter() DateTime? estimatedDelivery)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Shipment() when $default != null:
        return $default(_that.id, _that.status, _that.carrier,
            _that.trackingNumber, _that.trackingUrl, _that.estimatedDelivery);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _Shipment extends Shipment {
  const _Shipment(
      {required this.id,
      required this.status,
      required this.carrier,
      required this.trackingNumber,
      required this.trackingUrl,
      @NullableUtcDateTimeConverter() required this.estimatedDelivery})
      : super._();
  factory _Shipment.fromJson(Map<String, dynamic> json) =>
      _$ShipmentFromJson(json);

  @override
  final String id;
  @override
  final ShipmentStatus status;
  @override
  final String? carrier;
  @override
  final String? trackingNumber;
  @override
  final String? trackingUrl;
  @override
  @NullableUtcDateTimeConverter()
  final DateTime? estimatedDelivery;

  /// Create a copy of Shipment
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$ShipmentCopyWith<_Shipment> get copyWith =>
      __$ShipmentCopyWithImpl<_Shipment>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$ShipmentToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _Shipment &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.carrier, carrier) || other.carrier == carrier) &&
            (identical(other.trackingNumber, trackingNumber) ||
                other.trackingNumber == trackingNumber) &&
            (identical(other.trackingUrl, trackingUrl) ||
                other.trackingUrl == trackingUrl) &&
            (identical(other.estimatedDelivery, estimatedDelivery) ||
                other.estimatedDelivery == estimatedDelivery));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, status, carrier,
      trackingNumber, trackingUrl, estimatedDelivery);

  @override
  String toString() {
    return 'Shipment(id: $id, status: $status, carrier: $carrier, trackingNumber: $trackingNumber, trackingUrl: $trackingUrl, estimatedDelivery: $estimatedDelivery)';
  }
}

/// @nodoc
abstract mixin class _$ShipmentCopyWith<$Res>
    implements $ShipmentCopyWith<$Res> {
  factory _$ShipmentCopyWith(_Shipment value, $Res Function(_Shipment) _then) =
      __$ShipmentCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String id,
      ShipmentStatus status,
      String? carrier,
      String? trackingNumber,
      String? trackingUrl,
      @NullableUtcDateTimeConverter() DateTime? estimatedDelivery});
}

/// @nodoc
class __$ShipmentCopyWithImpl<$Res> implements _$ShipmentCopyWith<$Res> {
  __$ShipmentCopyWithImpl(this._self, this._then);

  final _Shipment _self;
  final $Res Function(_Shipment) _then;

  /// Create a copy of Shipment
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? id = null,
    Object? status = null,
    Object? carrier = freezed,
    Object? trackingNumber = freezed,
    Object? trackingUrl = freezed,
    Object? estimatedDelivery = freezed,
  }) {
    return _then(_Shipment(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _self.status
          : status // ignore: cast_nullable_to_non_nullable
              as ShipmentStatus,
      carrier: freezed == carrier
          ? _self.carrier
          : carrier // ignore: cast_nullable_to_non_nullable
              as String?,
      trackingNumber: freezed == trackingNumber
          ? _self.trackingNumber
          : trackingNumber // ignore: cast_nullable_to_non_nullable
              as String?,
      trackingUrl: freezed == trackingUrl
          ? _self.trackingUrl
          : trackingUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      estimatedDelivery: freezed == estimatedDelivery
          ? _self.estimatedDelivery
          : estimatedDelivery // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
mixin _$OrderCard {
  String get id;
  String get orderNumber;
  OrderStatus get status;
  PaymentStatus get paymentStatus;

  /// B2C or B2B. `OrderType` in Prisma; the same value set as [Channel], so
  /// the mobile surface names it once.
  Channel get type;
  Currency get currency;
  @DecimalConverter()
  Decimal get total;
  int get itemCount;
  ImageRef? get thumbnail;
  @UtcDateTimeConverter()
  DateTime get placedAt;

  /// Create a copy of OrderCard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $OrderCardCopyWith<OrderCard> get copyWith =>
      _$OrderCardCopyWithImpl<OrderCard>(this as OrderCard, _$identity);

  /// Serializes this OrderCard to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is OrderCard &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.orderNumber, orderNumber) ||
                other.orderNumber == orderNumber) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.paymentStatus, paymentStatus) ||
                other.paymentStatus == paymentStatus) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.itemCount, itemCount) ||
                other.itemCount == itemCount) &&
            (identical(other.thumbnail, thumbnail) ||
                other.thumbnail == thumbnail) &&
            (identical(other.placedAt, placedAt) ||
                other.placedAt == placedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, orderNumber, status,
      paymentStatus, type, currency, total, itemCount, thumbnail, placedAt);

  @override
  String toString() {
    return 'OrderCard(id: $id, orderNumber: $orderNumber, status: $status, paymentStatus: $paymentStatus, type: $type, currency: $currency, total: $total, itemCount: $itemCount, thumbnail: $thumbnail, placedAt: $placedAt)';
  }
}

/// @nodoc
abstract mixin class $OrderCardCopyWith<$Res> {
  factory $OrderCardCopyWith(OrderCard value, $Res Function(OrderCard) _then) =
      _$OrderCardCopyWithImpl;
  @useResult
  $Res call(
      {String id,
      String orderNumber,
      OrderStatus status,
      PaymentStatus paymentStatus,
      Channel type,
      Currency currency,
      @DecimalConverter() Decimal total,
      int itemCount,
      ImageRef? thumbnail,
      @UtcDateTimeConverter() DateTime placedAt});

  $ImageRefCopyWith<$Res>? get thumbnail;
}

/// @nodoc
class _$OrderCardCopyWithImpl<$Res> implements $OrderCardCopyWith<$Res> {
  _$OrderCardCopyWithImpl(this._self, this._then);

  final OrderCard _self;
  final $Res Function(OrderCard) _then;

  /// Create a copy of OrderCard
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? orderNumber = null,
    Object? status = null,
    Object? paymentStatus = null,
    Object? type = null,
    Object? currency = null,
    Object? total = null,
    Object? itemCount = null,
    Object? thumbnail = freezed,
    Object? placedAt = null,
  }) {
    return _then(_self.copyWith(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      orderNumber: null == orderNumber
          ? _self.orderNumber
          : orderNumber // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _self.status
          : status // ignore: cast_nullable_to_non_nullable
              as OrderStatus,
      paymentStatus: null == paymentStatus
          ? _self.paymentStatus
          : paymentStatus // ignore: cast_nullable_to_non_nullable
              as PaymentStatus,
      type: null == type
          ? _self.type
          : type // ignore: cast_nullable_to_non_nullable
              as Channel,
      currency: null == currency
          ? _self.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as Currency,
      total: null == total
          ? _self.total
          : total // ignore: cast_nullable_to_non_nullable
              as Decimal,
      itemCount: null == itemCount
          ? _self.itemCount
          : itemCount // ignore: cast_nullable_to_non_nullable
              as int,
      thumbnail: freezed == thumbnail
          ? _self.thumbnail
          : thumbnail // ignore: cast_nullable_to_non_nullable
              as ImageRef?,
      placedAt: null == placedAt
          ? _self.placedAt
          : placedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }

  /// Create a copy of OrderCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ImageRefCopyWith<$Res>? get thumbnail {
    if (_self.thumbnail == null) {
      return null;
    }

    return $ImageRefCopyWith<$Res>(_self.thumbnail!, (value) {
      return _then(_self.copyWith(thumbnail: value));
    });
  }
}

/// Adds pattern-matching-related methods to [OrderCard].
extension OrderCardPatterns on OrderCard {
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
    TResult Function(_OrderCard value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _OrderCard() when $default != null:
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
    TResult Function(_OrderCard value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OrderCard():
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
    TResult? Function(_OrderCard value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OrderCard() when $default != null:
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
            String orderNumber,
            OrderStatus status,
            PaymentStatus paymentStatus,
            Channel type,
            Currency currency,
            @DecimalConverter() Decimal total,
            int itemCount,
            ImageRef? thumbnail,
            @UtcDateTimeConverter() DateTime placedAt)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _OrderCard() when $default != null:
        return $default(
            _that.id,
            _that.orderNumber,
            _that.status,
            _that.paymentStatus,
            _that.type,
            _that.currency,
            _that.total,
            _that.itemCount,
            _that.thumbnail,
            _that.placedAt);
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
            String orderNumber,
            OrderStatus status,
            PaymentStatus paymentStatus,
            Channel type,
            Currency currency,
            @DecimalConverter() Decimal total,
            int itemCount,
            ImageRef? thumbnail,
            @UtcDateTimeConverter() DateTime placedAt)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OrderCard():
        return $default(
            _that.id,
            _that.orderNumber,
            _that.status,
            _that.paymentStatus,
            _that.type,
            _that.currency,
            _that.total,
            _that.itemCount,
            _that.thumbnail,
            _that.placedAt);
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
            String orderNumber,
            OrderStatus status,
            PaymentStatus paymentStatus,
            Channel type,
            Currency currency,
            @DecimalConverter() Decimal total,
            int itemCount,
            ImageRef? thumbnail,
            @UtcDateTimeConverter() DateTime placedAt)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OrderCard() when $default != null:
        return $default(
            _that.id,
            _that.orderNumber,
            _that.status,
            _that.paymentStatus,
            _that.type,
            _that.currency,
            _that.total,
            _that.itemCount,
            _that.thumbnail,
            _that.placedAt);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _OrderCard extends OrderCard {
  const _OrderCard(
      {required this.id,
      required this.orderNumber,
      required this.status,
      required this.paymentStatus,
      required this.type,
      required this.currency,
      @DecimalConverter() required this.total,
      required this.itemCount,
      required this.thumbnail,
      @UtcDateTimeConverter() required this.placedAt})
      : super._();
  factory _OrderCard.fromJson(Map<String, dynamic> json) =>
      _$OrderCardFromJson(json);

  @override
  final String id;
  @override
  final String orderNumber;
  @override
  final OrderStatus status;
  @override
  final PaymentStatus paymentStatus;

  /// B2C or B2B. `OrderType` in Prisma; the same value set as [Channel], so
  /// the mobile surface names it once.
  @override
  final Channel type;
  @override
  final Currency currency;
  @override
  @DecimalConverter()
  final Decimal total;
  @override
  final int itemCount;
  @override
  final ImageRef? thumbnail;
  @override
  @UtcDateTimeConverter()
  final DateTime placedAt;

  /// Create a copy of OrderCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$OrderCardCopyWith<_OrderCard> get copyWith =>
      __$OrderCardCopyWithImpl<_OrderCard>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$OrderCardToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _OrderCard &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.orderNumber, orderNumber) ||
                other.orderNumber == orderNumber) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.paymentStatus, paymentStatus) ||
                other.paymentStatus == paymentStatus) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.itemCount, itemCount) ||
                other.itemCount == itemCount) &&
            (identical(other.thumbnail, thumbnail) ||
                other.thumbnail == thumbnail) &&
            (identical(other.placedAt, placedAt) ||
                other.placedAt == placedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, orderNumber, status,
      paymentStatus, type, currency, total, itemCount, thumbnail, placedAt);

  @override
  String toString() {
    return 'OrderCard(id: $id, orderNumber: $orderNumber, status: $status, paymentStatus: $paymentStatus, type: $type, currency: $currency, total: $total, itemCount: $itemCount, thumbnail: $thumbnail, placedAt: $placedAt)';
  }
}

/// @nodoc
abstract mixin class _$OrderCardCopyWith<$Res>
    implements $OrderCardCopyWith<$Res> {
  factory _$OrderCardCopyWith(
          _OrderCard value, $Res Function(_OrderCard) _then) =
      __$OrderCardCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String id,
      String orderNumber,
      OrderStatus status,
      PaymentStatus paymentStatus,
      Channel type,
      Currency currency,
      @DecimalConverter() Decimal total,
      int itemCount,
      ImageRef? thumbnail,
      @UtcDateTimeConverter() DateTime placedAt});

  @override
  $ImageRefCopyWith<$Res>? get thumbnail;
}

/// @nodoc
class __$OrderCardCopyWithImpl<$Res> implements _$OrderCardCopyWith<$Res> {
  __$OrderCardCopyWithImpl(this._self, this._then);

  final _OrderCard _self;
  final $Res Function(_OrderCard) _then;

  /// Create a copy of OrderCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? id = null,
    Object? orderNumber = null,
    Object? status = null,
    Object? paymentStatus = null,
    Object? type = null,
    Object? currency = null,
    Object? total = null,
    Object? itemCount = null,
    Object? thumbnail = freezed,
    Object? placedAt = null,
  }) {
    return _then(_OrderCard(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      orderNumber: null == orderNumber
          ? _self.orderNumber
          : orderNumber // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _self.status
          : status // ignore: cast_nullable_to_non_nullable
              as OrderStatus,
      paymentStatus: null == paymentStatus
          ? _self.paymentStatus
          : paymentStatus // ignore: cast_nullable_to_non_nullable
              as PaymentStatus,
      type: null == type
          ? _self.type
          : type // ignore: cast_nullable_to_non_nullable
              as Channel,
      currency: null == currency
          ? _self.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as Currency,
      total: null == total
          ? _self.total
          : total // ignore: cast_nullable_to_non_nullable
              as Decimal,
      itemCount: null == itemCount
          ? _self.itemCount
          : itemCount // ignore: cast_nullable_to_non_nullable
              as int,
      thumbnail: freezed == thumbnail
          ? _self.thumbnail
          : thumbnail // ignore: cast_nullable_to_non_nullable
              as ImageRef?,
      placedAt: null == placedAt
          ? _self.placedAt
          : placedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }

  /// Create a copy of OrderCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ImageRefCopyWith<$Res>? get thumbnail {
    if (_self.thumbnail == null) {
      return null;
    }

    return $ImageRefCopyWith<$Res>(_self.thumbnail!, (value) {
      return _then(_self.copyWith(thumbnail: value));
    });
  }
}

/// @nodoc
mixin _$OrderDetail {
  String get id;
  String get orderNumber;
  OrderStatus get status;
  PaymentStatus get paymentStatus;

  /// Null until a payment is attempted.
  PaymentMethod? get paymentMethod;
  Channel get type;
  Currency get currency;
  PersistedOrderTotals get totals;
  List<OrderItem> get items;
  ShippingAddress get shippingAddress;
  List<Shipment> get shipments;
  List<OrderStatusEvent> get statusHistory;
  String? get notes;
  String? get vatInvoiceUrl;
  @UtcDateTimeConverter()
  DateTime get placedAt;
  @UtcDateTimeConverter()
  DateTime get updatedAt;

  /// Create a copy of OrderDetail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $OrderDetailCopyWith<OrderDetail> get copyWith =>
      _$OrderDetailCopyWithImpl<OrderDetail>(this as OrderDetail, _$identity);

  /// Serializes this OrderDetail to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is OrderDetail &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.orderNumber, orderNumber) ||
                other.orderNumber == orderNumber) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.paymentStatus, paymentStatus) ||
                other.paymentStatus == paymentStatus) &&
            (identical(other.paymentMethod, paymentMethod) ||
                other.paymentMethod == paymentMethod) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.totals, totals) || other.totals == totals) &&
            const DeepCollectionEquality().equals(other.items, items) &&
            (identical(other.shippingAddress, shippingAddress) ||
                other.shippingAddress == shippingAddress) &&
            const DeepCollectionEquality().equals(other.shipments, shipments) &&
            const DeepCollectionEquality()
                .equals(other.statusHistory, statusHistory) &&
            (identical(other.notes, notes) || other.notes == notes) &&
            (identical(other.vatInvoiceUrl, vatInvoiceUrl) ||
                other.vatInvoiceUrl == vatInvoiceUrl) &&
            (identical(other.placedAt, placedAt) ||
                other.placedAt == placedAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      orderNumber,
      status,
      paymentStatus,
      paymentMethod,
      type,
      currency,
      totals,
      const DeepCollectionEquality().hash(items),
      shippingAddress,
      const DeepCollectionEquality().hash(shipments),
      const DeepCollectionEquality().hash(statusHistory),
      notes,
      vatInvoiceUrl,
      placedAt,
      updatedAt);

  @override
  String toString() {
    return 'OrderDetail(id: $id, orderNumber: $orderNumber, status: $status, paymentStatus: $paymentStatus, paymentMethod: $paymentMethod, type: $type, currency: $currency, totals: $totals, items: $items, shippingAddress: $shippingAddress, shipments: $shipments, statusHistory: $statusHistory, notes: $notes, vatInvoiceUrl: $vatInvoiceUrl, placedAt: $placedAt, updatedAt: $updatedAt)';
  }
}

/// @nodoc
abstract mixin class $OrderDetailCopyWith<$Res> {
  factory $OrderDetailCopyWith(
          OrderDetail value, $Res Function(OrderDetail) _then) =
      _$OrderDetailCopyWithImpl;
  @useResult
  $Res call(
      {String id,
      String orderNumber,
      OrderStatus status,
      PaymentStatus paymentStatus,
      PaymentMethod? paymentMethod,
      Channel type,
      Currency currency,
      PersistedOrderTotals totals,
      List<OrderItem> items,
      ShippingAddress shippingAddress,
      List<Shipment> shipments,
      List<OrderStatusEvent> statusHistory,
      String? notes,
      String? vatInvoiceUrl,
      @UtcDateTimeConverter() DateTime placedAt,
      @UtcDateTimeConverter() DateTime updatedAt});

  $PersistedOrderTotalsCopyWith<$Res> get totals;
  $ShippingAddressCopyWith<$Res> get shippingAddress;
}

/// @nodoc
class _$OrderDetailCopyWithImpl<$Res> implements $OrderDetailCopyWith<$Res> {
  _$OrderDetailCopyWithImpl(this._self, this._then);

  final OrderDetail _self;
  final $Res Function(OrderDetail) _then;

  /// Create a copy of OrderDetail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? orderNumber = null,
    Object? status = null,
    Object? paymentStatus = null,
    Object? paymentMethod = freezed,
    Object? type = null,
    Object? currency = null,
    Object? totals = null,
    Object? items = null,
    Object? shippingAddress = null,
    Object? shipments = null,
    Object? statusHistory = null,
    Object? notes = freezed,
    Object? vatInvoiceUrl = freezed,
    Object? placedAt = null,
    Object? updatedAt = null,
  }) {
    return _then(_self.copyWith(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      orderNumber: null == orderNumber
          ? _self.orderNumber
          : orderNumber // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _self.status
          : status // ignore: cast_nullable_to_non_nullable
              as OrderStatus,
      paymentStatus: null == paymentStatus
          ? _self.paymentStatus
          : paymentStatus // ignore: cast_nullable_to_non_nullable
              as PaymentStatus,
      paymentMethod: freezed == paymentMethod
          ? _self.paymentMethod
          : paymentMethod // ignore: cast_nullable_to_non_nullable
              as PaymentMethod?,
      type: null == type
          ? _self.type
          : type // ignore: cast_nullable_to_non_nullable
              as Channel,
      currency: null == currency
          ? _self.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as Currency,
      totals: null == totals
          ? _self.totals
          : totals // ignore: cast_nullable_to_non_nullable
              as PersistedOrderTotals,
      items: null == items
          ? _self.items
          : items // ignore: cast_nullable_to_non_nullable
              as List<OrderItem>,
      shippingAddress: null == shippingAddress
          ? _self.shippingAddress
          : shippingAddress // ignore: cast_nullable_to_non_nullable
              as ShippingAddress,
      shipments: null == shipments
          ? _self.shipments
          : shipments // ignore: cast_nullable_to_non_nullable
              as List<Shipment>,
      statusHistory: null == statusHistory
          ? _self.statusHistory
          : statusHistory // ignore: cast_nullable_to_non_nullable
              as List<OrderStatusEvent>,
      notes: freezed == notes
          ? _self.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      vatInvoiceUrl: freezed == vatInvoiceUrl
          ? _self.vatInvoiceUrl
          : vatInvoiceUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      placedAt: null == placedAt
          ? _self.placedAt
          : placedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: null == updatedAt
          ? _self.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }

  /// Create a copy of OrderDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $PersistedOrderTotalsCopyWith<$Res> get totals {
    return $PersistedOrderTotalsCopyWith<$Res>(_self.totals, (value) {
      return _then(_self.copyWith(totals: value));
    });
  }

  /// Create a copy of OrderDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ShippingAddressCopyWith<$Res> get shippingAddress {
    return $ShippingAddressCopyWith<$Res>(_self.shippingAddress, (value) {
      return _then(_self.copyWith(shippingAddress: value));
    });
  }
}

/// Adds pattern-matching-related methods to [OrderDetail].
extension OrderDetailPatterns on OrderDetail {
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
    TResult Function(_OrderDetail value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _OrderDetail() when $default != null:
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
    TResult Function(_OrderDetail value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OrderDetail():
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
    TResult? Function(_OrderDetail value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OrderDetail() when $default != null:
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
            String orderNumber,
            OrderStatus status,
            PaymentStatus paymentStatus,
            PaymentMethod? paymentMethod,
            Channel type,
            Currency currency,
            PersistedOrderTotals totals,
            List<OrderItem> items,
            ShippingAddress shippingAddress,
            List<Shipment> shipments,
            List<OrderStatusEvent> statusHistory,
            String? notes,
            String? vatInvoiceUrl,
            @UtcDateTimeConverter() DateTime placedAt,
            @UtcDateTimeConverter() DateTime updatedAt)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _OrderDetail() when $default != null:
        return $default(
            _that.id,
            _that.orderNumber,
            _that.status,
            _that.paymentStatus,
            _that.paymentMethod,
            _that.type,
            _that.currency,
            _that.totals,
            _that.items,
            _that.shippingAddress,
            _that.shipments,
            _that.statusHistory,
            _that.notes,
            _that.vatInvoiceUrl,
            _that.placedAt,
            _that.updatedAt);
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
            String orderNumber,
            OrderStatus status,
            PaymentStatus paymentStatus,
            PaymentMethod? paymentMethod,
            Channel type,
            Currency currency,
            PersistedOrderTotals totals,
            List<OrderItem> items,
            ShippingAddress shippingAddress,
            List<Shipment> shipments,
            List<OrderStatusEvent> statusHistory,
            String? notes,
            String? vatInvoiceUrl,
            @UtcDateTimeConverter() DateTime placedAt,
            @UtcDateTimeConverter() DateTime updatedAt)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OrderDetail():
        return $default(
            _that.id,
            _that.orderNumber,
            _that.status,
            _that.paymentStatus,
            _that.paymentMethod,
            _that.type,
            _that.currency,
            _that.totals,
            _that.items,
            _that.shippingAddress,
            _that.shipments,
            _that.statusHistory,
            _that.notes,
            _that.vatInvoiceUrl,
            _that.placedAt,
            _that.updatedAt);
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
            String orderNumber,
            OrderStatus status,
            PaymentStatus paymentStatus,
            PaymentMethod? paymentMethod,
            Channel type,
            Currency currency,
            PersistedOrderTotals totals,
            List<OrderItem> items,
            ShippingAddress shippingAddress,
            List<Shipment> shipments,
            List<OrderStatusEvent> statusHistory,
            String? notes,
            String? vatInvoiceUrl,
            @UtcDateTimeConverter() DateTime placedAt,
            @UtcDateTimeConverter() DateTime updatedAt)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OrderDetail() when $default != null:
        return $default(
            _that.id,
            _that.orderNumber,
            _that.status,
            _that.paymentStatus,
            _that.paymentMethod,
            _that.type,
            _that.currency,
            _that.totals,
            _that.items,
            _that.shippingAddress,
            _that.shipments,
            _that.statusHistory,
            _that.notes,
            _that.vatInvoiceUrl,
            _that.placedAt,
            _that.updatedAt);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _OrderDetail extends OrderDetail {
  const _OrderDetail(
      {required this.id,
      required this.orderNumber,
      required this.status,
      required this.paymentStatus,
      required this.paymentMethod,
      required this.type,
      required this.currency,
      required this.totals,
      required final List<OrderItem> items,
      required this.shippingAddress,
      required final List<Shipment> shipments,
      required final List<OrderStatusEvent> statusHistory,
      required this.notes,
      required this.vatInvoiceUrl,
      @UtcDateTimeConverter() required this.placedAt,
      @UtcDateTimeConverter() required this.updatedAt})
      : _items = items,
        _shipments = shipments,
        _statusHistory = statusHistory,
        super._();
  factory _OrderDetail.fromJson(Map<String, dynamic> json) =>
      _$OrderDetailFromJson(json);

  @override
  final String id;
  @override
  final String orderNumber;
  @override
  final OrderStatus status;
  @override
  final PaymentStatus paymentStatus;

  /// Null until a payment is attempted.
  @override
  final PaymentMethod? paymentMethod;
  @override
  final Channel type;
  @override
  final Currency currency;
  @override
  final PersistedOrderTotals totals;
  final List<OrderItem> _items;
  @override
  List<OrderItem> get items {
    if (_items is EqualUnmodifiableListView) return _items;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_items);
  }

  @override
  final ShippingAddress shippingAddress;
  final List<Shipment> _shipments;
  @override
  List<Shipment> get shipments {
    if (_shipments is EqualUnmodifiableListView) return _shipments;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_shipments);
  }

  final List<OrderStatusEvent> _statusHistory;
  @override
  List<OrderStatusEvent> get statusHistory {
    if (_statusHistory is EqualUnmodifiableListView) return _statusHistory;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_statusHistory);
  }

  @override
  final String? notes;
  @override
  final String? vatInvoiceUrl;
  @override
  @UtcDateTimeConverter()
  final DateTime placedAt;
  @override
  @UtcDateTimeConverter()
  final DateTime updatedAt;

  /// Create a copy of OrderDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$OrderDetailCopyWith<_OrderDetail> get copyWith =>
      __$OrderDetailCopyWithImpl<_OrderDetail>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$OrderDetailToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _OrderDetail &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.orderNumber, orderNumber) ||
                other.orderNumber == orderNumber) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.paymentStatus, paymentStatus) ||
                other.paymentStatus == paymentStatus) &&
            (identical(other.paymentMethod, paymentMethod) ||
                other.paymentMethod == paymentMethod) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.totals, totals) || other.totals == totals) &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            (identical(other.shippingAddress, shippingAddress) ||
                other.shippingAddress == shippingAddress) &&
            const DeepCollectionEquality()
                .equals(other._shipments, _shipments) &&
            const DeepCollectionEquality()
                .equals(other._statusHistory, _statusHistory) &&
            (identical(other.notes, notes) || other.notes == notes) &&
            (identical(other.vatInvoiceUrl, vatInvoiceUrl) ||
                other.vatInvoiceUrl == vatInvoiceUrl) &&
            (identical(other.placedAt, placedAt) ||
                other.placedAt == placedAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      orderNumber,
      status,
      paymentStatus,
      paymentMethod,
      type,
      currency,
      totals,
      const DeepCollectionEquality().hash(_items),
      shippingAddress,
      const DeepCollectionEquality().hash(_shipments),
      const DeepCollectionEquality().hash(_statusHistory),
      notes,
      vatInvoiceUrl,
      placedAt,
      updatedAt);

  @override
  String toString() {
    return 'OrderDetail(id: $id, orderNumber: $orderNumber, status: $status, paymentStatus: $paymentStatus, paymentMethod: $paymentMethod, type: $type, currency: $currency, totals: $totals, items: $items, shippingAddress: $shippingAddress, shipments: $shipments, statusHistory: $statusHistory, notes: $notes, vatInvoiceUrl: $vatInvoiceUrl, placedAt: $placedAt, updatedAt: $updatedAt)';
  }
}

/// @nodoc
abstract mixin class _$OrderDetailCopyWith<$Res>
    implements $OrderDetailCopyWith<$Res> {
  factory _$OrderDetailCopyWith(
          _OrderDetail value, $Res Function(_OrderDetail) _then) =
      __$OrderDetailCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String id,
      String orderNumber,
      OrderStatus status,
      PaymentStatus paymentStatus,
      PaymentMethod? paymentMethod,
      Channel type,
      Currency currency,
      PersistedOrderTotals totals,
      List<OrderItem> items,
      ShippingAddress shippingAddress,
      List<Shipment> shipments,
      List<OrderStatusEvent> statusHistory,
      String? notes,
      String? vatInvoiceUrl,
      @UtcDateTimeConverter() DateTime placedAt,
      @UtcDateTimeConverter() DateTime updatedAt});

  @override
  $PersistedOrderTotalsCopyWith<$Res> get totals;
  @override
  $ShippingAddressCopyWith<$Res> get shippingAddress;
}

/// @nodoc
class __$OrderDetailCopyWithImpl<$Res> implements _$OrderDetailCopyWith<$Res> {
  __$OrderDetailCopyWithImpl(this._self, this._then);

  final _OrderDetail _self;
  final $Res Function(_OrderDetail) _then;

  /// Create a copy of OrderDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? id = null,
    Object? orderNumber = null,
    Object? status = null,
    Object? paymentStatus = null,
    Object? paymentMethod = freezed,
    Object? type = null,
    Object? currency = null,
    Object? totals = null,
    Object? items = null,
    Object? shippingAddress = null,
    Object? shipments = null,
    Object? statusHistory = null,
    Object? notes = freezed,
    Object? vatInvoiceUrl = freezed,
    Object? placedAt = null,
    Object? updatedAt = null,
  }) {
    return _then(_OrderDetail(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      orderNumber: null == orderNumber
          ? _self.orderNumber
          : orderNumber // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _self.status
          : status // ignore: cast_nullable_to_non_nullable
              as OrderStatus,
      paymentStatus: null == paymentStatus
          ? _self.paymentStatus
          : paymentStatus // ignore: cast_nullable_to_non_nullable
              as PaymentStatus,
      paymentMethod: freezed == paymentMethod
          ? _self.paymentMethod
          : paymentMethod // ignore: cast_nullable_to_non_nullable
              as PaymentMethod?,
      type: null == type
          ? _self.type
          : type // ignore: cast_nullable_to_non_nullable
              as Channel,
      currency: null == currency
          ? _self.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as Currency,
      totals: null == totals
          ? _self.totals
          : totals // ignore: cast_nullable_to_non_nullable
              as PersistedOrderTotals,
      items: null == items
          ? _self._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<OrderItem>,
      shippingAddress: null == shippingAddress
          ? _self.shippingAddress
          : shippingAddress // ignore: cast_nullable_to_non_nullable
              as ShippingAddress,
      shipments: null == shipments
          ? _self._shipments
          : shipments // ignore: cast_nullable_to_non_nullable
              as List<Shipment>,
      statusHistory: null == statusHistory
          ? _self._statusHistory
          : statusHistory // ignore: cast_nullable_to_non_nullable
              as List<OrderStatusEvent>,
      notes: freezed == notes
          ? _self.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      vatInvoiceUrl: freezed == vatInvoiceUrl
          ? _self.vatInvoiceUrl
          : vatInvoiceUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      placedAt: null == placedAt
          ? _self.placedAt
          : placedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: null == updatedAt
          ? _self.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }

  /// Create a copy of OrderDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $PersistedOrderTotalsCopyWith<$Res> get totals {
    return $PersistedOrderTotalsCopyWith<$Res>(_self.totals, (value) {
      return _then(_self.copyWith(totals: value));
    });
  }

  /// Create a copy of OrderDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ShippingAddressCopyWith<$Res> get shippingAddress {
    return $ShippingAddressCopyWith<$Res>(_self.shippingAddress, (value) {
      return _then(_self.copyWith(shippingAddress: value));
    });
  }
}

// dart format on
