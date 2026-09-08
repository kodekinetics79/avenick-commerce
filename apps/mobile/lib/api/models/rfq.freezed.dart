// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'rfq.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$RfqSeller {
  String get businessNameEn;
  SellerTier get tier;

  /// Create a copy of RfqSeller
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $RfqSellerCopyWith<RfqSeller> get copyWith =>
      _$RfqSellerCopyWithImpl<RfqSeller>(this as RfqSeller, _$identity);

  /// Serializes this RfqSeller to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is RfqSeller &&
            (identical(other.businessNameEn, businessNameEn) ||
                other.businessNameEn == businessNameEn) &&
            (identical(other.tier, tier) || other.tier == tier));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, businessNameEn, tier);

  @override
  String toString() {
    return 'RfqSeller(businessNameEn: $businessNameEn, tier: $tier)';
  }
}

/// @nodoc
abstract mixin class $RfqSellerCopyWith<$Res> {
  factory $RfqSellerCopyWith(RfqSeller value, $Res Function(RfqSeller) _then) =
      _$RfqSellerCopyWithImpl;
  @useResult
  $Res call({String businessNameEn, SellerTier tier});
}

/// @nodoc
class _$RfqSellerCopyWithImpl<$Res> implements $RfqSellerCopyWith<$Res> {
  _$RfqSellerCopyWithImpl(this._self, this._then);

  final RfqSeller _self;
  final $Res Function(RfqSeller) _then;

  /// Create a copy of RfqSeller
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? businessNameEn = null,
    Object? tier = null,
  }) {
    return _then(_self.copyWith(
      businessNameEn: null == businessNameEn
          ? _self.businessNameEn
          : businessNameEn // ignore: cast_nullable_to_non_nullable
              as String,
      tier: null == tier
          ? _self.tier
          : tier // ignore: cast_nullable_to_non_nullable
              as SellerTier,
    ));
  }
}

/// Adds pattern-matching-related methods to [RfqSeller].
extension RfqSellerPatterns on RfqSeller {
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
    TResult Function(_RfqSeller value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _RfqSeller() when $default != null:
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
    TResult Function(_RfqSeller value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _RfqSeller():
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
    TResult? Function(_RfqSeller value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _RfqSeller() when $default != null:
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
    TResult Function(String businessNameEn, SellerTier tier)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _RfqSeller() when $default != null:
        return $default(_that.businessNameEn, _that.tier);
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
    TResult Function(String businessNameEn, SellerTier tier) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _RfqSeller():
        return $default(_that.businessNameEn, _that.tier);
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
    TResult? Function(String businessNameEn, SellerTier tier)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _RfqSeller() when $default != null:
        return $default(_that.businessNameEn, _that.tier);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _RfqSeller implements RfqSeller {
  const _RfqSeller({required this.businessNameEn, required this.tier});
  factory _RfqSeller.fromJson(Map<String, dynamic> json) =>
      _$RfqSellerFromJson(json);

  @override
  final String businessNameEn;
  @override
  final SellerTier tier;

  /// Create a copy of RfqSeller
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$RfqSellerCopyWith<_RfqSeller> get copyWith =>
      __$RfqSellerCopyWithImpl<_RfqSeller>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$RfqSellerToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _RfqSeller &&
            (identical(other.businessNameEn, businessNameEn) ||
                other.businessNameEn == businessNameEn) &&
            (identical(other.tier, tier) || other.tier == tier));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, businessNameEn, tier);

  @override
  String toString() {
    return 'RfqSeller(businessNameEn: $businessNameEn, tier: $tier)';
  }
}

/// @nodoc
abstract mixin class _$RfqSellerCopyWith<$Res>
    implements $RfqSellerCopyWith<$Res> {
  factory _$RfqSellerCopyWith(
          _RfqSeller value, $Res Function(_RfqSeller) _then) =
      __$RfqSellerCopyWithImpl;
  @override
  @useResult
  $Res call({String businessNameEn, SellerTier tier});
}

/// @nodoc
class __$RfqSellerCopyWithImpl<$Res> implements _$RfqSellerCopyWith<$Res> {
  __$RfqSellerCopyWithImpl(this._self, this._then);

  final _RfqSeller _self;
  final $Res Function(_RfqSeller) _then;

  /// Create a copy of RfqSeller
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? businessNameEn = null,
    Object? tier = null,
  }) {
    return _then(_RfqSeller(
      businessNameEn: null == businessNameEn
          ? _self.businessNameEn
          : businessNameEn // ignore: cast_nullable_to_non_nullable
              as String,
      tier: null == tier
          ? _self.tier
          : tier // ignore: cast_nullable_to_non_nullable
              as SellerTier,
    ));
  }
}

/// @nodoc
mixin _$RfqItem {
  String get id;

  /// The catalogue product this line names, or null for a free-text line.
  String? get productId;
  String get nameEn;
  int get quantity;

  /// The supplier's unit price. NULL until they have quoted, and null is not
  /// zero: a line with no price yet must render as awaiting a quote, never
  /// as free.
  @NullableDecimalConverter()
  Decimal? get unitQuoted;
  String? get notes;

  /// Create a copy of RfqItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $RfqItemCopyWith<RfqItem> get copyWith =>
      _$RfqItemCopyWithImpl<RfqItem>(this as RfqItem, _$identity);

  /// Serializes this RfqItem to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is RfqItem &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.nameEn, nameEn) || other.nameEn == nameEn) &&
            (identical(other.quantity, quantity) ||
                other.quantity == quantity) &&
            (identical(other.unitQuoted, unitQuoted) ||
                other.unitQuoted == unitQuoted) &&
            (identical(other.notes, notes) || other.notes == notes));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, id, productId, nameEn, quantity, unitQuoted, notes);

  @override
  String toString() {
    return 'RfqItem(id: $id, productId: $productId, nameEn: $nameEn, quantity: $quantity, unitQuoted: $unitQuoted, notes: $notes)';
  }
}

/// @nodoc
abstract mixin class $RfqItemCopyWith<$Res> {
  factory $RfqItemCopyWith(RfqItem value, $Res Function(RfqItem) _then) =
      _$RfqItemCopyWithImpl;
  @useResult
  $Res call(
      {String id,
      String? productId,
      String nameEn,
      int quantity,
      @NullableDecimalConverter() Decimal? unitQuoted,
      String? notes});
}

/// @nodoc
class _$RfqItemCopyWithImpl<$Res> implements $RfqItemCopyWith<$Res> {
  _$RfqItemCopyWithImpl(this._self, this._then);

  final RfqItem _self;
  final $Res Function(RfqItem) _then;

  /// Create a copy of RfqItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? productId = freezed,
    Object? nameEn = null,
    Object? quantity = null,
    Object? unitQuoted = freezed,
    Object? notes = freezed,
  }) {
    return _then(_self.copyWith(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      productId: freezed == productId
          ? _self.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String?,
      nameEn: null == nameEn
          ? _self.nameEn
          : nameEn // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _self.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      unitQuoted: freezed == unitQuoted
          ? _self.unitQuoted
          : unitQuoted // ignore: cast_nullable_to_non_nullable
              as Decimal?,
      notes: freezed == notes
          ? _self.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// Adds pattern-matching-related methods to [RfqItem].
extension RfqItemPatterns on RfqItem {
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
    TResult Function(_RfqItem value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _RfqItem() when $default != null:
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
    TResult Function(_RfqItem value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _RfqItem():
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
    TResult? Function(_RfqItem value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _RfqItem() when $default != null:
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
    TResult Function(String id, String? productId, String nameEn, int quantity,
            @NullableDecimalConverter() Decimal? unitQuoted, String? notes)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _RfqItem() when $default != null:
        return $default(_that.id, _that.productId, _that.nameEn, _that.quantity,
            _that.unitQuoted, _that.notes);
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
    TResult Function(String id, String? productId, String nameEn, int quantity,
            @NullableDecimalConverter() Decimal? unitQuoted, String? notes)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _RfqItem():
        return $default(_that.id, _that.productId, _that.nameEn, _that.quantity,
            _that.unitQuoted, _that.notes);
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
    TResult? Function(String id, String? productId, String nameEn, int quantity,
            @NullableDecimalConverter() Decimal? unitQuoted, String? notes)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _RfqItem() when $default != null:
        return $default(_that.id, _that.productId, _that.nameEn, _that.quantity,
            _that.unitQuoted, _that.notes);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _RfqItem extends RfqItem {
  const _RfqItem(
      {required this.id,
      required this.productId,
      required this.nameEn,
      required this.quantity,
      @NullableDecimalConverter() required this.unitQuoted,
      required this.notes})
      : super._();
  factory _RfqItem.fromJson(Map<String, dynamic> json) =>
      _$RfqItemFromJson(json);

  @override
  final String id;

  /// The catalogue product this line names, or null for a free-text line.
  @override
  final String? productId;
  @override
  final String nameEn;
  @override
  final int quantity;

  /// The supplier's unit price. NULL until they have quoted, and null is not
  /// zero: a line with no price yet must render as awaiting a quote, never
  /// as free.
  @override
  @NullableDecimalConverter()
  final Decimal? unitQuoted;
  @override
  final String? notes;

  /// Create a copy of RfqItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$RfqItemCopyWith<_RfqItem> get copyWith =>
      __$RfqItemCopyWithImpl<_RfqItem>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$RfqItemToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _RfqItem &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.nameEn, nameEn) || other.nameEn == nameEn) &&
            (identical(other.quantity, quantity) ||
                other.quantity == quantity) &&
            (identical(other.unitQuoted, unitQuoted) ||
                other.unitQuoted == unitQuoted) &&
            (identical(other.notes, notes) || other.notes == notes));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, id, productId, nameEn, quantity, unitQuoted, notes);

  @override
  String toString() {
    return 'RfqItem(id: $id, productId: $productId, nameEn: $nameEn, quantity: $quantity, unitQuoted: $unitQuoted, notes: $notes)';
  }
}

/// @nodoc
abstract mixin class _$RfqItemCopyWith<$Res> implements $RfqItemCopyWith<$Res> {
  factory _$RfqItemCopyWith(_RfqItem value, $Res Function(_RfqItem) _then) =
      __$RfqItemCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String id,
      String? productId,
      String nameEn,
      int quantity,
      @NullableDecimalConverter() Decimal? unitQuoted,
      String? notes});
}

/// @nodoc
class __$RfqItemCopyWithImpl<$Res> implements _$RfqItemCopyWith<$Res> {
  __$RfqItemCopyWithImpl(this._self, this._then);

  final _RfqItem _self;
  final $Res Function(_RfqItem) _then;

  /// Create a copy of RfqItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? id = null,
    Object? productId = freezed,
    Object? nameEn = null,
    Object? quantity = null,
    Object? unitQuoted = freezed,
    Object? notes = freezed,
  }) {
    return _then(_RfqItem(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      productId: freezed == productId
          ? _self.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String?,
      nameEn: null == nameEn
          ? _self.nameEn
          : nameEn // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _self.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      unitQuoted: freezed == unitQuoted
          ? _self.unitQuoted
          : unitQuoted // ignore: cast_nullable_to_non_nullable
              as Decimal?,
      notes: freezed == notes
          ? _self.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
mixin _$RfqCard {
  String get id;
  String get rfqNumber;
  RfqStatus get status;
  Currency get currency;
  int get itemCount;

  /// What the supplier has quoted for the whole request, or null before
  /// they have. Null means "not yet quoted", never "nothing to pay".
  @NullableDecimalConverter()
  Decimal? get totalQuoted;

  /// Bumped every time the supplier revises the quote. It is the value a
  /// decision is made AGAINST — see [RfqDetail].
  int get quoteVersion;

  /// The supplier who picked this request up, or null while none has.
  RfqSeller? get seller;
  @NullableUtcDateTimeConverter()
  DateTime? get requiredBy;
  @UtcDateTimeConverter()
  DateTime get createdAt;
  int get messageCount;

  /// Create a copy of RfqCard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $RfqCardCopyWith<RfqCard> get copyWith =>
      _$RfqCardCopyWithImpl<RfqCard>(this as RfqCard, _$identity);

  /// Serializes this RfqCard to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is RfqCard &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.rfqNumber, rfqNumber) ||
                other.rfqNumber == rfqNumber) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.itemCount, itemCount) ||
                other.itemCount == itemCount) &&
            (identical(other.totalQuoted, totalQuoted) ||
                other.totalQuoted == totalQuoted) &&
            (identical(other.quoteVersion, quoteVersion) ||
                other.quoteVersion == quoteVersion) &&
            (identical(other.seller, seller) || other.seller == seller) &&
            (identical(other.requiredBy, requiredBy) ||
                other.requiredBy == requiredBy) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.messageCount, messageCount) ||
                other.messageCount == messageCount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      rfqNumber,
      status,
      currency,
      itemCount,
      totalQuoted,
      quoteVersion,
      seller,
      requiredBy,
      createdAt,
      messageCount);

  @override
  String toString() {
    return 'RfqCard(id: $id, rfqNumber: $rfqNumber, status: $status, currency: $currency, itemCount: $itemCount, totalQuoted: $totalQuoted, quoteVersion: $quoteVersion, seller: $seller, requiredBy: $requiredBy, createdAt: $createdAt, messageCount: $messageCount)';
  }
}

/// @nodoc
abstract mixin class $RfqCardCopyWith<$Res> {
  factory $RfqCardCopyWith(RfqCard value, $Res Function(RfqCard) _then) =
      _$RfqCardCopyWithImpl;
  @useResult
  $Res call(
      {String id,
      String rfqNumber,
      RfqStatus status,
      Currency currency,
      int itemCount,
      @NullableDecimalConverter() Decimal? totalQuoted,
      int quoteVersion,
      RfqSeller? seller,
      @NullableUtcDateTimeConverter() DateTime? requiredBy,
      @UtcDateTimeConverter() DateTime createdAt,
      int messageCount});

  $RfqSellerCopyWith<$Res>? get seller;
}

/// @nodoc
class _$RfqCardCopyWithImpl<$Res> implements $RfqCardCopyWith<$Res> {
  _$RfqCardCopyWithImpl(this._self, this._then);

  final RfqCard _self;
  final $Res Function(RfqCard) _then;

  /// Create a copy of RfqCard
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? rfqNumber = null,
    Object? status = null,
    Object? currency = null,
    Object? itemCount = null,
    Object? totalQuoted = freezed,
    Object? quoteVersion = null,
    Object? seller = freezed,
    Object? requiredBy = freezed,
    Object? createdAt = null,
    Object? messageCount = null,
  }) {
    return _then(_self.copyWith(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      rfqNumber: null == rfqNumber
          ? _self.rfqNumber
          : rfqNumber // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _self.status
          : status // ignore: cast_nullable_to_non_nullable
              as RfqStatus,
      currency: null == currency
          ? _self.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as Currency,
      itemCount: null == itemCount
          ? _self.itemCount
          : itemCount // ignore: cast_nullable_to_non_nullable
              as int,
      totalQuoted: freezed == totalQuoted
          ? _self.totalQuoted
          : totalQuoted // ignore: cast_nullable_to_non_nullable
              as Decimal?,
      quoteVersion: null == quoteVersion
          ? _self.quoteVersion
          : quoteVersion // ignore: cast_nullable_to_non_nullable
              as int,
      seller: freezed == seller
          ? _self.seller
          : seller // ignore: cast_nullable_to_non_nullable
              as RfqSeller?,
      requiredBy: freezed == requiredBy
          ? _self.requiredBy
          : requiredBy // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      createdAt: null == createdAt
          ? _self.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      messageCount: null == messageCount
          ? _self.messageCount
          : messageCount // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }

  /// Create a copy of RfqCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $RfqSellerCopyWith<$Res>? get seller {
    if (_self.seller == null) {
      return null;
    }

    return $RfqSellerCopyWith<$Res>(_self.seller!, (value) {
      return _then(_self.copyWith(seller: value));
    });
  }
}

/// Adds pattern-matching-related methods to [RfqCard].
extension RfqCardPatterns on RfqCard {
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
    TResult Function(_RfqCard value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _RfqCard() when $default != null:
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
    TResult Function(_RfqCard value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _RfqCard():
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
    TResult? Function(_RfqCard value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _RfqCard() when $default != null:
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
            String rfqNumber,
            RfqStatus status,
            Currency currency,
            int itemCount,
            @NullableDecimalConverter() Decimal? totalQuoted,
            int quoteVersion,
            RfqSeller? seller,
            @NullableUtcDateTimeConverter() DateTime? requiredBy,
            @UtcDateTimeConverter() DateTime createdAt,
            int messageCount)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _RfqCard() when $default != null:
        return $default(
            _that.id,
            _that.rfqNumber,
            _that.status,
            _that.currency,
            _that.itemCount,
            _that.totalQuoted,
            _that.quoteVersion,
            _that.seller,
            _that.requiredBy,
            _that.createdAt,
            _that.messageCount);
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
            String rfqNumber,
            RfqStatus status,
            Currency currency,
            int itemCount,
            @NullableDecimalConverter() Decimal? totalQuoted,
            int quoteVersion,
            RfqSeller? seller,
            @NullableUtcDateTimeConverter() DateTime? requiredBy,
            @UtcDateTimeConverter() DateTime createdAt,
            int messageCount)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _RfqCard():
        return $default(
            _that.id,
            _that.rfqNumber,
            _that.status,
            _that.currency,
            _that.itemCount,
            _that.totalQuoted,
            _that.quoteVersion,
            _that.seller,
            _that.requiredBy,
            _that.createdAt,
            _that.messageCount);
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
            String rfqNumber,
            RfqStatus status,
            Currency currency,
            int itemCount,
            @NullableDecimalConverter() Decimal? totalQuoted,
            int quoteVersion,
            RfqSeller? seller,
            @NullableUtcDateTimeConverter() DateTime? requiredBy,
            @UtcDateTimeConverter() DateTime createdAt,
            int messageCount)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _RfqCard() when $default != null:
        return $default(
            _that.id,
            _that.rfqNumber,
            _that.status,
            _that.currency,
            _that.itemCount,
            _that.totalQuoted,
            _that.quoteVersion,
            _that.seller,
            _that.requiredBy,
            _that.createdAt,
            _that.messageCount);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _RfqCard extends RfqCard {
  const _RfqCard(
      {required this.id,
      required this.rfqNumber,
      required this.status,
      required this.currency,
      required this.itemCount,
      @NullableDecimalConverter() required this.totalQuoted,
      required this.quoteVersion,
      required this.seller,
      @NullableUtcDateTimeConverter() required this.requiredBy,
      @UtcDateTimeConverter() required this.createdAt,
      required this.messageCount})
      : super._();
  factory _RfqCard.fromJson(Map<String, dynamic> json) =>
      _$RfqCardFromJson(json);

  @override
  final String id;
  @override
  final String rfqNumber;
  @override
  final RfqStatus status;
  @override
  final Currency currency;
  @override
  final int itemCount;

  /// What the supplier has quoted for the whole request, or null before
  /// they have. Null means "not yet quoted", never "nothing to pay".
  @override
  @NullableDecimalConverter()
  final Decimal? totalQuoted;

  /// Bumped every time the supplier revises the quote. It is the value a
  /// decision is made AGAINST — see [RfqDetail].
  @override
  final int quoteVersion;

  /// The supplier who picked this request up, or null while none has.
  @override
  final RfqSeller? seller;
  @override
  @NullableUtcDateTimeConverter()
  final DateTime? requiredBy;
  @override
  @UtcDateTimeConverter()
  final DateTime createdAt;
  @override
  final int messageCount;

  /// Create a copy of RfqCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$RfqCardCopyWith<_RfqCard> get copyWith =>
      __$RfqCardCopyWithImpl<_RfqCard>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$RfqCardToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _RfqCard &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.rfqNumber, rfqNumber) ||
                other.rfqNumber == rfqNumber) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.itemCount, itemCount) ||
                other.itemCount == itemCount) &&
            (identical(other.totalQuoted, totalQuoted) ||
                other.totalQuoted == totalQuoted) &&
            (identical(other.quoteVersion, quoteVersion) ||
                other.quoteVersion == quoteVersion) &&
            (identical(other.seller, seller) || other.seller == seller) &&
            (identical(other.requiredBy, requiredBy) ||
                other.requiredBy == requiredBy) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.messageCount, messageCount) ||
                other.messageCount == messageCount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      rfqNumber,
      status,
      currency,
      itemCount,
      totalQuoted,
      quoteVersion,
      seller,
      requiredBy,
      createdAt,
      messageCount);

  @override
  String toString() {
    return 'RfqCard(id: $id, rfqNumber: $rfqNumber, status: $status, currency: $currency, itemCount: $itemCount, totalQuoted: $totalQuoted, quoteVersion: $quoteVersion, seller: $seller, requiredBy: $requiredBy, createdAt: $createdAt, messageCount: $messageCount)';
  }
}

/// @nodoc
abstract mixin class _$RfqCardCopyWith<$Res> implements $RfqCardCopyWith<$Res> {
  factory _$RfqCardCopyWith(_RfqCard value, $Res Function(_RfqCard) _then) =
      __$RfqCardCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String id,
      String rfqNumber,
      RfqStatus status,
      Currency currency,
      int itemCount,
      @NullableDecimalConverter() Decimal? totalQuoted,
      int quoteVersion,
      RfqSeller? seller,
      @NullableUtcDateTimeConverter() DateTime? requiredBy,
      @UtcDateTimeConverter() DateTime createdAt,
      int messageCount});

  @override
  $RfqSellerCopyWith<$Res>? get seller;
}

/// @nodoc
class __$RfqCardCopyWithImpl<$Res> implements _$RfqCardCopyWith<$Res> {
  __$RfqCardCopyWithImpl(this._self, this._then);

  final _RfqCard _self;
  final $Res Function(_RfqCard) _then;

  /// Create a copy of RfqCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? id = null,
    Object? rfqNumber = null,
    Object? status = null,
    Object? currency = null,
    Object? itemCount = null,
    Object? totalQuoted = freezed,
    Object? quoteVersion = null,
    Object? seller = freezed,
    Object? requiredBy = freezed,
    Object? createdAt = null,
    Object? messageCount = null,
  }) {
    return _then(_RfqCard(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      rfqNumber: null == rfqNumber
          ? _self.rfqNumber
          : rfqNumber // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _self.status
          : status // ignore: cast_nullable_to_non_nullable
              as RfqStatus,
      currency: null == currency
          ? _self.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as Currency,
      itemCount: null == itemCount
          ? _self.itemCount
          : itemCount // ignore: cast_nullable_to_non_nullable
              as int,
      totalQuoted: freezed == totalQuoted
          ? _self.totalQuoted
          : totalQuoted // ignore: cast_nullable_to_non_nullable
              as Decimal?,
      quoteVersion: null == quoteVersion
          ? _self.quoteVersion
          : quoteVersion // ignore: cast_nullable_to_non_nullable
              as int,
      seller: freezed == seller
          ? _self.seller
          : seller // ignore: cast_nullable_to_non_nullable
              as RfqSeller?,
      requiredBy: freezed == requiredBy
          ? _self.requiredBy
          : requiredBy // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      createdAt: null == createdAt
          ? _self.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      messageCount: null == messageCount
          ? _self.messageCount
          : messageCount // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }

  /// Create a copy of RfqCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $RfqSellerCopyWith<$Res>? get seller {
    if (_self.seller == null) {
      return null;
    }

    return $RfqSellerCopyWith<$Res>(_self.seller!, (value) {
      return _then(_self.copyWith(seller: value));
    });
  }
}

/// @nodoc
mixin _$RfqDetail {
  String get id;
  String get rfqNumber;
  RfqStatus get status;
  Currency get currency;
  int get itemCount;

  /// The quoted total, or null before the supplier has priced the request.
  @NullableDecimalConverter()
  Decimal? get totalQuoted;
  int get quoteVersion;
  RfqSeller? get seller;
  @NullableUtcDateTimeConverter()
  DateTime? get requiredBy;
  @UtcDateTimeConverter()
  DateTime get createdAt;
  int get messageCount;
  List<RfqItem> get items;
  String? get notes;

  /// When the supplier's price stops standing. Null when they set no expiry.
  @NullableUtcDateTimeConverter()
  DateTime? get expiresAt;
  @UtcDateTimeConverter()
  DateTime get updatedAt;

  /// Create a copy of RfqDetail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $RfqDetailCopyWith<RfqDetail> get copyWith =>
      _$RfqDetailCopyWithImpl<RfqDetail>(this as RfqDetail, _$identity);

  /// Serializes this RfqDetail to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is RfqDetail &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.rfqNumber, rfqNumber) ||
                other.rfqNumber == rfqNumber) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.itemCount, itemCount) ||
                other.itemCount == itemCount) &&
            (identical(other.totalQuoted, totalQuoted) ||
                other.totalQuoted == totalQuoted) &&
            (identical(other.quoteVersion, quoteVersion) ||
                other.quoteVersion == quoteVersion) &&
            (identical(other.seller, seller) || other.seller == seller) &&
            (identical(other.requiredBy, requiredBy) ||
                other.requiredBy == requiredBy) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.messageCount, messageCount) ||
                other.messageCount == messageCount) &&
            const DeepCollectionEquality().equals(other.items, items) &&
            (identical(other.notes, notes) || other.notes == notes) &&
            (identical(other.expiresAt, expiresAt) ||
                other.expiresAt == expiresAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      rfqNumber,
      status,
      currency,
      itemCount,
      totalQuoted,
      quoteVersion,
      seller,
      requiredBy,
      createdAt,
      messageCount,
      const DeepCollectionEquality().hash(items),
      notes,
      expiresAt,
      updatedAt);

  @override
  String toString() {
    return 'RfqDetail(id: $id, rfqNumber: $rfqNumber, status: $status, currency: $currency, itemCount: $itemCount, totalQuoted: $totalQuoted, quoteVersion: $quoteVersion, seller: $seller, requiredBy: $requiredBy, createdAt: $createdAt, messageCount: $messageCount, items: $items, notes: $notes, expiresAt: $expiresAt, updatedAt: $updatedAt)';
  }
}

/// @nodoc
abstract mixin class $RfqDetailCopyWith<$Res> {
  factory $RfqDetailCopyWith(RfqDetail value, $Res Function(RfqDetail) _then) =
      _$RfqDetailCopyWithImpl;
  @useResult
  $Res call(
      {String id,
      String rfqNumber,
      RfqStatus status,
      Currency currency,
      int itemCount,
      @NullableDecimalConverter() Decimal? totalQuoted,
      int quoteVersion,
      RfqSeller? seller,
      @NullableUtcDateTimeConverter() DateTime? requiredBy,
      @UtcDateTimeConverter() DateTime createdAt,
      int messageCount,
      List<RfqItem> items,
      String? notes,
      @NullableUtcDateTimeConverter() DateTime? expiresAt,
      @UtcDateTimeConverter() DateTime updatedAt});

  $RfqSellerCopyWith<$Res>? get seller;
}

/// @nodoc
class _$RfqDetailCopyWithImpl<$Res> implements $RfqDetailCopyWith<$Res> {
  _$RfqDetailCopyWithImpl(this._self, this._then);

  final RfqDetail _self;
  final $Res Function(RfqDetail) _then;

  /// Create a copy of RfqDetail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? rfqNumber = null,
    Object? status = null,
    Object? currency = null,
    Object? itemCount = null,
    Object? totalQuoted = freezed,
    Object? quoteVersion = null,
    Object? seller = freezed,
    Object? requiredBy = freezed,
    Object? createdAt = null,
    Object? messageCount = null,
    Object? items = null,
    Object? notes = freezed,
    Object? expiresAt = freezed,
    Object? updatedAt = null,
  }) {
    return _then(_self.copyWith(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      rfqNumber: null == rfqNumber
          ? _self.rfqNumber
          : rfqNumber // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _self.status
          : status // ignore: cast_nullable_to_non_nullable
              as RfqStatus,
      currency: null == currency
          ? _self.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as Currency,
      itemCount: null == itemCount
          ? _self.itemCount
          : itemCount // ignore: cast_nullable_to_non_nullable
              as int,
      totalQuoted: freezed == totalQuoted
          ? _self.totalQuoted
          : totalQuoted // ignore: cast_nullable_to_non_nullable
              as Decimal?,
      quoteVersion: null == quoteVersion
          ? _self.quoteVersion
          : quoteVersion // ignore: cast_nullable_to_non_nullable
              as int,
      seller: freezed == seller
          ? _self.seller
          : seller // ignore: cast_nullable_to_non_nullable
              as RfqSeller?,
      requiredBy: freezed == requiredBy
          ? _self.requiredBy
          : requiredBy // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      createdAt: null == createdAt
          ? _self.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      messageCount: null == messageCount
          ? _self.messageCount
          : messageCount // ignore: cast_nullable_to_non_nullable
              as int,
      items: null == items
          ? _self.items
          : items // ignore: cast_nullable_to_non_nullable
              as List<RfqItem>,
      notes: freezed == notes
          ? _self.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      expiresAt: freezed == expiresAt
          ? _self.expiresAt
          : expiresAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      updatedAt: null == updatedAt
          ? _self.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }

  /// Create a copy of RfqDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $RfqSellerCopyWith<$Res>? get seller {
    if (_self.seller == null) {
      return null;
    }

    return $RfqSellerCopyWith<$Res>(_self.seller!, (value) {
      return _then(_self.copyWith(seller: value));
    });
  }
}

/// Adds pattern-matching-related methods to [RfqDetail].
extension RfqDetailPatterns on RfqDetail {
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
    TResult Function(_RfqDetail value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _RfqDetail() when $default != null:
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
    TResult Function(_RfqDetail value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _RfqDetail():
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
    TResult? Function(_RfqDetail value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _RfqDetail() when $default != null:
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
            String rfqNumber,
            RfqStatus status,
            Currency currency,
            int itemCount,
            @NullableDecimalConverter() Decimal? totalQuoted,
            int quoteVersion,
            RfqSeller? seller,
            @NullableUtcDateTimeConverter() DateTime? requiredBy,
            @UtcDateTimeConverter() DateTime createdAt,
            int messageCount,
            List<RfqItem> items,
            String? notes,
            @NullableUtcDateTimeConverter() DateTime? expiresAt,
            @UtcDateTimeConverter() DateTime updatedAt)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _RfqDetail() when $default != null:
        return $default(
            _that.id,
            _that.rfqNumber,
            _that.status,
            _that.currency,
            _that.itemCount,
            _that.totalQuoted,
            _that.quoteVersion,
            _that.seller,
            _that.requiredBy,
            _that.createdAt,
            _that.messageCount,
            _that.items,
            _that.notes,
            _that.expiresAt,
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
            String rfqNumber,
            RfqStatus status,
            Currency currency,
            int itemCount,
            @NullableDecimalConverter() Decimal? totalQuoted,
            int quoteVersion,
            RfqSeller? seller,
            @NullableUtcDateTimeConverter() DateTime? requiredBy,
            @UtcDateTimeConverter() DateTime createdAt,
            int messageCount,
            List<RfqItem> items,
            String? notes,
            @NullableUtcDateTimeConverter() DateTime? expiresAt,
            @UtcDateTimeConverter() DateTime updatedAt)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _RfqDetail():
        return $default(
            _that.id,
            _that.rfqNumber,
            _that.status,
            _that.currency,
            _that.itemCount,
            _that.totalQuoted,
            _that.quoteVersion,
            _that.seller,
            _that.requiredBy,
            _that.createdAt,
            _that.messageCount,
            _that.items,
            _that.notes,
            _that.expiresAt,
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
            String rfqNumber,
            RfqStatus status,
            Currency currency,
            int itemCount,
            @NullableDecimalConverter() Decimal? totalQuoted,
            int quoteVersion,
            RfqSeller? seller,
            @NullableUtcDateTimeConverter() DateTime? requiredBy,
            @UtcDateTimeConverter() DateTime createdAt,
            int messageCount,
            List<RfqItem> items,
            String? notes,
            @NullableUtcDateTimeConverter() DateTime? expiresAt,
            @UtcDateTimeConverter() DateTime updatedAt)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _RfqDetail() when $default != null:
        return $default(
            _that.id,
            _that.rfqNumber,
            _that.status,
            _that.currency,
            _that.itemCount,
            _that.totalQuoted,
            _that.quoteVersion,
            _that.seller,
            _that.requiredBy,
            _that.createdAt,
            _that.messageCount,
            _that.items,
            _that.notes,
            _that.expiresAt,
            _that.updatedAt);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _RfqDetail extends RfqDetail {
  const _RfqDetail(
      {required this.id,
      required this.rfqNumber,
      required this.status,
      required this.currency,
      required this.itemCount,
      @NullableDecimalConverter() required this.totalQuoted,
      required this.quoteVersion,
      required this.seller,
      @NullableUtcDateTimeConverter() required this.requiredBy,
      @UtcDateTimeConverter() required this.createdAt,
      required this.messageCount,
      required final List<RfqItem> items,
      required this.notes,
      @NullableUtcDateTimeConverter() required this.expiresAt,
      @UtcDateTimeConverter() required this.updatedAt})
      : _items = items,
        super._();
  factory _RfqDetail.fromJson(Map<String, dynamic> json) =>
      _$RfqDetailFromJson(json);

  @override
  final String id;
  @override
  final String rfqNumber;
  @override
  final RfqStatus status;
  @override
  final Currency currency;
  @override
  final int itemCount;

  /// The quoted total, or null before the supplier has priced the request.
  @override
  @NullableDecimalConverter()
  final Decimal? totalQuoted;
  @override
  final int quoteVersion;
  @override
  final RfqSeller? seller;
  @override
  @NullableUtcDateTimeConverter()
  final DateTime? requiredBy;
  @override
  @UtcDateTimeConverter()
  final DateTime createdAt;
  @override
  final int messageCount;
  final List<RfqItem> _items;
  @override
  List<RfqItem> get items {
    if (_items is EqualUnmodifiableListView) return _items;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_items);
  }

  @override
  final String? notes;

  /// When the supplier's price stops standing. Null when they set no expiry.
  @override
  @NullableUtcDateTimeConverter()
  final DateTime? expiresAt;
  @override
  @UtcDateTimeConverter()
  final DateTime updatedAt;

  /// Create a copy of RfqDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$RfqDetailCopyWith<_RfqDetail> get copyWith =>
      __$RfqDetailCopyWithImpl<_RfqDetail>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$RfqDetailToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _RfqDetail &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.rfqNumber, rfqNumber) ||
                other.rfqNumber == rfqNumber) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.itemCount, itemCount) ||
                other.itemCount == itemCount) &&
            (identical(other.totalQuoted, totalQuoted) ||
                other.totalQuoted == totalQuoted) &&
            (identical(other.quoteVersion, quoteVersion) ||
                other.quoteVersion == quoteVersion) &&
            (identical(other.seller, seller) || other.seller == seller) &&
            (identical(other.requiredBy, requiredBy) ||
                other.requiredBy == requiredBy) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.messageCount, messageCount) ||
                other.messageCount == messageCount) &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            (identical(other.notes, notes) || other.notes == notes) &&
            (identical(other.expiresAt, expiresAt) ||
                other.expiresAt == expiresAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      rfqNumber,
      status,
      currency,
      itemCount,
      totalQuoted,
      quoteVersion,
      seller,
      requiredBy,
      createdAt,
      messageCount,
      const DeepCollectionEquality().hash(_items),
      notes,
      expiresAt,
      updatedAt);

  @override
  String toString() {
    return 'RfqDetail(id: $id, rfqNumber: $rfqNumber, status: $status, currency: $currency, itemCount: $itemCount, totalQuoted: $totalQuoted, quoteVersion: $quoteVersion, seller: $seller, requiredBy: $requiredBy, createdAt: $createdAt, messageCount: $messageCount, items: $items, notes: $notes, expiresAt: $expiresAt, updatedAt: $updatedAt)';
  }
}

/// @nodoc
abstract mixin class _$RfqDetailCopyWith<$Res>
    implements $RfqDetailCopyWith<$Res> {
  factory _$RfqDetailCopyWith(
          _RfqDetail value, $Res Function(_RfqDetail) _then) =
      __$RfqDetailCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String id,
      String rfqNumber,
      RfqStatus status,
      Currency currency,
      int itemCount,
      @NullableDecimalConverter() Decimal? totalQuoted,
      int quoteVersion,
      RfqSeller? seller,
      @NullableUtcDateTimeConverter() DateTime? requiredBy,
      @UtcDateTimeConverter() DateTime createdAt,
      int messageCount,
      List<RfqItem> items,
      String? notes,
      @NullableUtcDateTimeConverter() DateTime? expiresAt,
      @UtcDateTimeConverter() DateTime updatedAt});

  @override
  $RfqSellerCopyWith<$Res>? get seller;
}

/// @nodoc
class __$RfqDetailCopyWithImpl<$Res> implements _$RfqDetailCopyWith<$Res> {
  __$RfqDetailCopyWithImpl(this._self, this._then);

  final _RfqDetail _self;
  final $Res Function(_RfqDetail) _then;

  /// Create a copy of RfqDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? id = null,
    Object? rfqNumber = null,
    Object? status = null,
    Object? currency = null,
    Object? itemCount = null,
    Object? totalQuoted = freezed,
    Object? quoteVersion = null,
    Object? seller = freezed,
    Object? requiredBy = freezed,
    Object? createdAt = null,
    Object? messageCount = null,
    Object? items = null,
    Object? notes = freezed,
    Object? expiresAt = freezed,
    Object? updatedAt = null,
  }) {
    return _then(_RfqDetail(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      rfqNumber: null == rfqNumber
          ? _self.rfqNumber
          : rfqNumber // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _self.status
          : status // ignore: cast_nullable_to_non_nullable
              as RfqStatus,
      currency: null == currency
          ? _self.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as Currency,
      itemCount: null == itemCount
          ? _self.itemCount
          : itemCount // ignore: cast_nullable_to_non_nullable
              as int,
      totalQuoted: freezed == totalQuoted
          ? _self.totalQuoted
          : totalQuoted // ignore: cast_nullable_to_non_nullable
              as Decimal?,
      quoteVersion: null == quoteVersion
          ? _self.quoteVersion
          : quoteVersion // ignore: cast_nullable_to_non_nullable
              as int,
      seller: freezed == seller
          ? _self.seller
          : seller // ignore: cast_nullable_to_non_nullable
              as RfqSeller?,
      requiredBy: freezed == requiredBy
          ? _self.requiredBy
          : requiredBy // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      createdAt: null == createdAt
          ? _self.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      messageCount: null == messageCount
          ? _self.messageCount
          : messageCount // ignore: cast_nullable_to_non_nullable
              as int,
      items: null == items
          ? _self._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<RfqItem>,
      notes: freezed == notes
          ? _self.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      expiresAt: freezed == expiresAt
          ? _self.expiresAt
          : expiresAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      updatedAt: null == updatedAt
          ? _self.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }

  /// Create a copy of RfqDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $RfqSellerCopyWith<$Res>? get seller {
    if (_self.seller == null) {
      return null;
    }

    return $RfqSellerCopyWith<$Res>(_self.seller!, (value) {
      return _then(_self.copyWith(seller: value));
    });
  }
}

// dart format on
