// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'account.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$CompanyMembership {
  String get companyId;
  String get nameEn;
  String? get nameAr;
  Country get country;
  CompanyStatus get status;

  /// The role INSIDE the company, which can differ from the account's own
  /// [Me.role].
  UserRole get role;

  /// Create a copy of CompanyMembership
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $CompanyMembershipCopyWith<CompanyMembership> get copyWith =>
      _$CompanyMembershipCopyWithImpl<CompanyMembership>(
          this as CompanyMembership, _$identity);

  /// Serializes this CompanyMembership to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is CompanyMembership &&
            (identical(other.companyId, companyId) ||
                other.companyId == companyId) &&
            (identical(other.nameEn, nameEn) || other.nameEn == nameEn) &&
            (identical(other.nameAr, nameAr) || other.nameAr == nameAr) &&
            (identical(other.country, country) || other.country == country) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.role, role) || other.role == role));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, companyId, nameEn, nameAr, country, status, role);

  @override
  String toString() {
    return 'CompanyMembership(companyId: $companyId, nameEn: $nameEn, nameAr: $nameAr, country: $country, status: $status, role: $role)';
  }
}

/// @nodoc
abstract mixin class $CompanyMembershipCopyWith<$Res> {
  factory $CompanyMembershipCopyWith(
          CompanyMembership value, $Res Function(CompanyMembership) _then) =
      _$CompanyMembershipCopyWithImpl;
  @useResult
  $Res call(
      {String companyId,
      String nameEn,
      String? nameAr,
      Country country,
      CompanyStatus status,
      UserRole role});
}

/// @nodoc
class _$CompanyMembershipCopyWithImpl<$Res>
    implements $CompanyMembershipCopyWith<$Res> {
  _$CompanyMembershipCopyWithImpl(this._self, this._then);

  final CompanyMembership _self;
  final $Res Function(CompanyMembership) _then;

  /// Create a copy of CompanyMembership
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? companyId = null,
    Object? nameEn = null,
    Object? nameAr = freezed,
    Object? country = null,
    Object? status = null,
    Object? role = null,
  }) {
    return _then(_self.copyWith(
      companyId: null == companyId
          ? _self.companyId
          : companyId // ignore: cast_nullable_to_non_nullable
              as String,
      nameEn: null == nameEn
          ? _self.nameEn
          : nameEn // ignore: cast_nullable_to_non_nullable
              as String,
      nameAr: freezed == nameAr
          ? _self.nameAr
          : nameAr // ignore: cast_nullable_to_non_nullable
              as String?,
      country: null == country
          ? _self.country
          : country // ignore: cast_nullable_to_non_nullable
              as Country,
      status: null == status
          ? _self.status
          : status // ignore: cast_nullable_to_non_nullable
              as CompanyStatus,
      role: null == role
          ? _self.role
          : role // ignore: cast_nullable_to_non_nullable
              as UserRole,
    ));
  }
}

/// Adds pattern-matching-related methods to [CompanyMembership].
extension CompanyMembershipPatterns on CompanyMembership {
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
    TResult Function(_CompanyMembership value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _CompanyMembership() when $default != null:
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
    TResult Function(_CompanyMembership value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CompanyMembership():
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
    TResult? Function(_CompanyMembership value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CompanyMembership() when $default != null:
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
    TResult Function(String companyId, String nameEn, String? nameAr,
            Country country, CompanyStatus status, UserRole role)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _CompanyMembership() when $default != null:
        return $default(_that.companyId, _that.nameEn, _that.nameAr,
            _that.country, _that.status, _that.role);
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
    TResult Function(String companyId, String nameEn, String? nameAr,
            Country country, CompanyStatus status, UserRole role)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CompanyMembership():
        return $default(_that.companyId, _that.nameEn, _that.nameAr,
            _that.country, _that.status, _that.role);
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
    TResult? Function(String companyId, String nameEn, String? nameAr,
            Country country, CompanyStatus status, UserRole role)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _CompanyMembership() when $default != null:
        return $default(_that.companyId, _that.nameEn, _that.nameAr,
            _that.country, _that.status, _that.role);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _CompanyMembership extends CompanyMembership {
  const _CompanyMembership(
      {required this.companyId,
      required this.nameEn,
      required this.nameAr,
      required this.country,
      required this.status,
      required this.role})
      : super._();
  factory _CompanyMembership.fromJson(Map<String, dynamic> json) =>
      _$CompanyMembershipFromJson(json);

  @override
  final String companyId;
  @override
  final String nameEn;
  @override
  final String? nameAr;
  @override
  final Country country;
  @override
  final CompanyStatus status;

  /// The role INSIDE the company, which can differ from the account's own
  /// [Me.role].
  @override
  final UserRole role;

  /// Create a copy of CompanyMembership
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$CompanyMembershipCopyWith<_CompanyMembership> get copyWith =>
      __$CompanyMembershipCopyWithImpl<_CompanyMembership>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$CompanyMembershipToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _CompanyMembership &&
            (identical(other.companyId, companyId) ||
                other.companyId == companyId) &&
            (identical(other.nameEn, nameEn) || other.nameEn == nameEn) &&
            (identical(other.nameAr, nameAr) || other.nameAr == nameAr) &&
            (identical(other.country, country) || other.country == country) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.role, role) || other.role == role));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, companyId, nameEn, nameAr, country, status, role);

  @override
  String toString() {
    return 'CompanyMembership(companyId: $companyId, nameEn: $nameEn, nameAr: $nameAr, country: $country, status: $status, role: $role)';
  }
}

/// @nodoc
abstract mixin class _$CompanyMembershipCopyWith<$Res>
    implements $CompanyMembershipCopyWith<$Res> {
  factory _$CompanyMembershipCopyWith(
          _CompanyMembership value, $Res Function(_CompanyMembership) _then) =
      __$CompanyMembershipCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String companyId,
      String nameEn,
      String? nameAr,
      Country country,
      CompanyStatus status,
      UserRole role});
}

/// @nodoc
class __$CompanyMembershipCopyWithImpl<$Res>
    implements _$CompanyMembershipCopyWith<$Res> {
  __$CompanyMembershipCopyWithImpl(this._self, this._then);

  final _CompanyMembership _self;
  final $Res Function(_CompanyMembership) _then;

  /// Create a copy of CompanyMembership
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? companyId = null,
    Object? nameEn = null,
    Object? nameAr = freezed,
    Object? country = null,
    Object? status = null,
    Object? role = null,
  }) {
    return _then(_CompanyMembership(
      companyId: null == companyId
          ? _self.companyId
          : companyId // ignore: cast_nullable_to_non_nullable
              as String,
      nameEn: null == nameEn
          ? _self.nameEn
          : nameEn // ignore: cast_nullable_to_non_nullable
              as String,
      nameAr: freezed == nameAr
          ? _self.nameAr
          : nameAr // ignore: cast_nullable_to_non_nullable
              as String?,
      country: null == country
          ? _self.country
          : country // ignore: cast_nullable_to_non_nullable
              as Country,
      status: null == status
          ? _self.status
          : status // ignore: cast_nullable_to_non_nullable
              as CompanyStatus,
      role: null == role
          ? _self.role
          : role // ignore: cast_nullable_to_non_nullable
              as UserRole,
    ));
  }
}

/// @nodoc
mixin _$Me {
  String get id;
  String get email;

  /// International format, `+9715xxxxxxx`. Null until the buyer adds one.
  String? get phone;
  String get firstName;
  String get lastName;
  String? get firstNameAr;
  String? get lastNameAr;
  ImageRef? get avatar;
  UserRole get role;
  UserStatus get status;
  Language get language;
  bool get emailVerified;
  bool get phoneVerified;
  CompanyMembership? get company;
  @UtcDateTimeConverter()
  DateTime get createdAt;

  /// Create a copy of Me
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $MeCopyWith<Me> get copyWith => _$MeCopyWithImpl<Me>(this as Me, _$identity);

  /// Serializes this Me to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is Me &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName) &&
            (identical(other.firstNameAr, firstNameAr) ||
                other.firstNameAr == firstNameAr) &&
            (identical(other.lastNameAr, lastNameAr) ||
                other.lastNameAr == lastNameAr) &&
            (identical(other.avatar, avatar) || other.avatar == avatar) &&
            (identical(other.role, role) || other.role == role) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.language, language) ||
                other.language == language) &&
            (identical(other.emailVerified, emailVerified) ||
                other.emailVerified == emailVerified) &&
            (identical(other.phoneVerified, phoneVerified) ||
                other.phoneVerified == phoneVerified) &&
            (identical(other.company, company) || other.company == company) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      email,
      phone,
      firstName,
      lastName,
      firstNameAr,
      lastNameAr,
      avatar,
      role,
      status,
      language,
      emailVerified,
      phoneVerified,
      company,
      createdAt);

  @override
  String toString() {
    return 'Me(id: $id, email: $email, phone: $phone, firstName: $firstName, lastName: $lastName, firstNameAr: $firstNameAr, lastNameAr: $lastNameAr, avatar: $avatar, role: $role, status: $status, language: $language, emailVerified: $emailVerified, phoneVerified: $phoneVerified, company: $company, createdAt: $createdAt)';
  }
}

/// @nodoc
abstract mixin class $MeCopyWith<$Res> {
  factory $MeCopyWith(Me value, $Res Function(Me) _then) = _$MeCopyWithImpl;
  @useResult
  $Res call(
      {String id,
      String email,
      String? phone,
      String firstName,
      String lastName,
      String? firstNameAr,
      String? lastNameAr,
      ImageRef? avatar,
      UserRole role,
      UserStatus status,
      Language language,
      bool emailVerified,
      bool phoneVerified,
      CompanyMembership? company,
      @UtcDateTimeConverter() DateTime createdAt});

  $ImageRefCopyWith<$Res>? get avatar;
  $CompanyMembershipCopyWith<$Res>? get company;
}

/// @nodoc
class _$MeCopyWithImpl<$Res> implements $MeCopyWith<$Res> {
  _$MeCopyWithImpl(this._self, this._then);

  final Me _self;
  final $Res Function(Me) _then;

  /// Create a copy of Me
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? email = null,
    Object? phone = freezed,
    Object? firstName = null,
    Object? lastName = null,
    Object? firstNameAr = freezed,
    Object? lastNameAr = freezed,
    Object? avatar = freezed,
    Object? role = null,
    Object? status = null,
    Object? language = null,
    Object? emailVerified = null,
    Object? phoneVerified = null,
    Object? company = freezed,
    Object? createdAt = null,
  }) {
    return _then(_self.copyWith(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      email: null == email
          ? _self.email
          : email // ignore: cast_nullable_to_non_nullable
              as String,
      phone: freezed == phone
          ? _self.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      firstName: null == firstName
          ? _self.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String,
      lastName: null == lastName
          ? _self.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String,
      firstNameAr: freezed == firstNameAr
          ? _self.firstNameAr
          : firstNameAr // ignore: cast_nullable_to_non_nullable
              as String?,
      lastNameAr: freezed == lastNameAr
          ? _self.lastNameAr
          : lastNameAr // ignore: cast_nullable_to_non_nullable
              as String?,
      avatar: freezed == avatar
          ? _self.avatar
          : avatar // ignore: cast_nullable_to_non_nullable
              as ImageRef?,
      role: null == role
          ? _self.role
          : role // ignore: cast_nullable_to_non_nullable
              as UserRole,
      status: null == status
          ? _self.status
          : status // ignore: cast_nullable_to_non_nullable
              as UserStatus,
      language: null == language
          ? _self.language
          : language // ignore: cast_nullable_to_non_nullable
              as Language,
      emailVerified: null == emailVerified
          ? _self.emailVerified
          : emailVerified // ignore: cast_nullable_to_non_nullable
              as bool,
      phoneVerified: null == phoneVerified
          ? _self.phoneVerified
          : phoneVerified // ignore: cast_nullable_to_non_nullable
              as bool,
      company: freezed == company
          ? _self.company
          : company // ignore: cast_nullable_to_non_nullable
              as CompanyMembership?,
      createdAt: null == createdAt
          ? _self.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }

  /// Create a copy of Me
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ImageRefCopyWith<$Res>? get avatar {
    if (_self.avatar == null) {
      return null;
    }

    return $ImageRefCopyWith<$Res>(_self.avatar!, (value) {
      return _then(_self.copyWith(avatar: value));
    });
  }

  /// Create a copy of Me
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $CompanyMembershipCopyWith<$Res>? get company {
    if (_self.company == null) {
      return null;
    }

    return $CompanyMembershipCopyWith<$Res>(_self.company!, (value) {
      return _then(_self.copyWith(company: value));
    });
  }
}

/// Adds pattern-matching-related methods to [Me].
extension MePatterns on Me {
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
    TResult Function(_Me value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _Me() when $default != null:
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
    TResult Function(_Me value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Me():
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
    TResult? Function(_Me value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Me() when $default != null:
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
            String email,
            String? phone,
            String firstName,
            String lastName,
            String? firstNameAr,
            String? lastNameAr,
            ImageRef? avatar,
            UserRole role,
            UserStatus status,
            Language language,
            bool emailVerified,
            bool phoneVerified,
            CompanyMembership? company,
            @UtcDateTimeConverter() DateTime createdAt)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _Me() when $default != null:
        return $default(
            _that.id,
            _that.email,
            _that.phone,
            _that.firstName,
            _that.lastName,
            _that.firstNameAr,
            _that.lastNameAr,
            _that.avatar,
            _that.role,
            _that.status,
            _that.language,
            _that.emailVerified,
            _that.phoneVerified,
            _that.company,
            _that.createdAt);
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
            String email,
            String? phone,
            String firstName,
            String lastName,
            String? firstNameAr,
            String? lastNameAr,
            ImageRef? avatar,
            UserRole role,
            UserStatus status,
            Language language,
            bool emailVerified,
            bool phoneVerified,
            CompanyMembership? company,
            @UtcDateTimeConverter() DateTime createdAt)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Me():
        return $default(
            _that.id,
            _that.email,
            _that.phone,
            _that.firstName,
            _that.lastName,
            _that.firstNameAr,
            _that.lastNameAr,
            _that.avatar,
            _that.role,
            _that.status,
            _that.language,
            _that.emailVerified,
            _that.phoneVerified,
            _that.company,
            _that.createdAt);
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
            String email,
            String? phone,
            String firstName,
            String lastName,
            String? firstNameAr,
            String? lastNameAr,
            ImageRef? avatar,
            UserRole role,
            UserStatus status,
            Language language,
            bool emailVerified,
            bool phoneVerified,
            CompanyMembership? company,
            @UtcDateTimeConverter() DateTime createdAt)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Me() when $default != null:
        return $default(
            _that.id,
            _that.email,
            _that.phone,
            _that.firstName,
            _that.lastName,
            _that.firstNameAr,
            _that.lastNameAr,
            _that.avatar,
            _that.role,
            _that.status,
            _that.language,
            _that.emailVerified,
            _that.phoneVerified,
            _that.company,
            _that.createdAt);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _Me extends Me {
  const _Me(
      {required this.id,
      required this.email,
      required this.phone,
      required this.firstName,
      required this.lastName,
      required this.firstNameAr,
      required this.lastNameAr,
      required this.avatar,
      required this.role,
      required this.status,
      required this.language,
      required this.emailVerified,
      required this.phoneVerified,
      required this.company,
      @UtcDateTimeConverter() required this.createdAt})
      : super._();
  factory _Me.fromJson(Map<String, dynamic> json) => _$MeFromJson(json);

  @override
  final String id;
  @override
  final String email;

  /// International format, `+9715xxxxxxx`. Null until the buyer adds one.
  @override
  final String? phone;
  @override
  final String firstName;
  @override
  final String lastName;
  @override
  final String? firstNameAr;
  @override
  final String? lastNameAr;
  @override
  final ImageRef? avatar;
  @override
  final UserRole role;
  @override
  final UserStatus status;
  @override
  final Language language;
  @override
  final bool emailVerified;
  @override
  final bool phoneVerified;
  @override
  final CompanyMembership? company;
  @override
  @UtcDateTimeConverter()
  final DateTime createdAt;

  /// Create a copy of Me
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$MeCopyWith<_Me> get copyWith => __$MeCopyWithImpl<_Me>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$MeToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _Me &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName) &&
            (identical(other.firstNameAr, firstNameAr) ||
                other.firstNameAr == firstNameAr) &&
            (identical(other.lastNameAr, lastNameAr) ||
                other.lastNameAr == lastNameAr) &&
            (identical(other.avatar, avatar) || other.avatar == avatar) &&
            (identical(other.role, role) || other.role == role) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.language, language) ||
                other.language == language) &&
            (identical(other.emailVerified, emailVerified) ||
                other.emailVerified == emailVerified) &&
            (identical(other.phoneVerified, phoneVerified) ||
                other.phoneVerified == phoneVerified) &&
            (identical(other.company, company) || other.company == company) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      email,
      phone,
      firstName,
      lastName,
      firstNameAr,
      lastNameAr,
      avatar,
      role,
      status,
      language,
      emailVerified,
      phoneVerified,
      company,
      createdAt);

  @override
  String toString() {
    return 'Me(id: $id, email: $email, phone: $phone, firstName: $firstName, lastName: $lastName, firstNameAr: $firstNameAr, lastNameAr: $lastNameAr, avatar: $avatar, role: $role, status: $status, language: $language, emailVerified: $emailVerified, phoneVerified: $phoneVerified, company: $company, createdAt: $createdAt)';
  }
}

/// @nodoc
abstract mixin class _$MeCopyWith<$Res> implements $MeCopyWith<$Res> {
  factory _$MeCopyWith(_Me value, $Res Function(_Me) _then) = __$MeCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String id,
      String email,
      String? phone,
      String firstName,
      String lastName,
      String? firstNameAr,
      String? lastNameAr,
      ImageRef? avatar,
      UserRole role,
      UserStatus status,
      Language language,
      bool emailVerified,
      bool phoneVerified,
      CompanyMembership? company,
      @UtcDateTimeConverter() DateTime createdAt});

  @override
  $ImageRefCopyWith<$Res>? get avatar;
  @override
  $CompanyMembershipCopyWith<$Res>? get company;
}

/// @nodoc
class __$MeCopyWithImpl<$Res> implements _$MeCopyWith<$Res> {
  __$MeCopyWithImpl(this._self, this._then);

  final _Me _self;
  final $Res Function(_Me) _then;

  /// Create a copy of Me
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? id = null,
    Object? email = null,
    Object? phone = freezed,
    Object? firstName = null,
    Object? lastName = null,
    Object? firstNameAr = freezed,
    Object? lastNameAr = freezed,
    Object? avatar = freezed,
    Object? role = null,
    Object? status = null,
    Object? language = null,
    Object? emailVerified = null,
    Object? phoneVerified = null,
    Object? company = freezed,
    Object? createdAt = null,
  }) {
    return _then(_Me(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      email: null == email
          ? _self.email
          : email // ignore: cast_nullable_to_non_nullable
              as String,
      phone: freezed == phone
          ? _self.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      firstName: null == firstName
          ? _self.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String,
      lastName: null == lastName
          ? _self.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String,
      firstNameAr: freezed == firstNameAr
          ? _self.firstNameAr
          : firstNameAr // ignore: cast_nullable_to_non_nullable
              as String?,
      lastNameAr: freezed == lastNameAr
          ? _self.lastNameAr
          : lastNameAr // ignore: cast_nullable_to_non_nullable
              as String?,
      avatar: freezed == avatar
          ? _self.avatar
          : avatar // ignore: cast_nullable_to_non_nullable
              as ImageRef?,
      role: null == role
          ? _self.role
          : role // ignore: cast_nullable_to_non_nullable
              as UserRole,
      status: null == status
          ? _self.status
          : status // ignore: cast_nullable_to_non_nullable
              as UserStatus,
      language: null == language
          ? _self.language
          : language // ignore: cast_nullable_to_non_nullable
              as Language,
      emailVerified: null == emailVerified
          ? _self.emailVerified
          : emailVerified // ignore: cast_nullable_to_non_nullable
              as bool,
      phoneVerified: null == phoneVerified
          ? _self.phoneVerified
          : phoneVerified // ignore: cast_nullable_to_non_nullable
              as bool,
      company: freezed == company
          ? _self.company
          : company // ignore: cast_nullable_to_non_nullable
              as CompanyMembership?,
      createdAt: null == createdAt
          ? _self.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }

  /// Create a copy of Me
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ImageRefCopyWith<$Res>? get avatar {
    if (_self.avatar == null) {
      return null;
    }

    return $ImageRefCopyWith<$Res>(_self.avatar!, (value) {
      return _then(_self.copyWith(avatar: value));
    });
  }

  /// Create a copy of Me
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $CompanyMembershipCopyWith<$Res>? get company {
    if (_self.company == null) {
      return null;
    }

    return $CompanyMembershipCopyWith<$Res>(_self.company!, (value) {
      return _then(_self.copyWith(company: value));
    });
  }
}

/// @nodoc
mixin _$AccountDeletion {
  AccountDeletionStatus get status;
  @UtcDateTimeConverter()
  DateTime get requestedAt;
  @UtcDateTimeConverter()
  DateTime get erasesAt;

  /// Create a copy of AccountDeletion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $AccountDeletionCopyWith<AccountDeletion> get copyWith =>
      _$AccountDeletionCopyWithImpl<AccountDeletion>(
          this as AccountDeletion, _$identity);

  /// Serializes this AccountDeletion to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is AccountDeletion &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.requestedAt, requestedAt) ||
                other.requestedAt == requestedAt) &&
            (identical(other.erasesAt, erasesAt) ||
                other.erasesAt == erasesAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, status, requestedAt, erasesAt);

  @override
  String toString() {
    return 'AccountDeletion(status: $status, requestedAt: $requestedAt, erasesAt: $erasesAt)';
  }
}

/// @nodoc
abstract mixin class $AccountDeletionCopyWith<$Res> {
  factory $AccountDeletionCopyWith(
          AccountDeletion value, $Res Function(AccountDeletion) _then) =
      _$AccountDeletionCopyWithImpl;
  @useResult
  $Res call(
      {AccountDeletionStatus status,
      @UtcDateTimeConverter() DateTime requestedAt,
      @UtcDateTimeConverter() DateTime erasesAt});
}

/// @nodoc
class _$AccountDeletionCopyWithImpl<$Res>
    implements $AccountDeletionCopyWith<$Res> {
  _$AccountDeletionCopyWithImpl(this._self, this._then);

  final AccountDeletion _self;
  final $Res Function(AccountDeletion) _then;

  /// Create a copy of AccountDeletion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? status = null,
    Object? requestedAt = null,
    Object? erasesAt = null,
  }) {
    return _then(_self.copyWith(
      status: null == status
          ? _self.status
          : status // ignore: cast_nullable_to_non_nullable
              as AccountDeletionStatus,
      requestedAt: null == requestedAt
          ? _self.requestedAt
          : requestedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      erasesAt: null == erasesAt
          ? _self.erasesAt
          : erasesAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }
}

/// Adds pattern-matching-related methods to [AccountDeletion].
extension AccountDeletionPatterns on AccountDeletion {
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
    TResult Function(_AccountDeletion value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _AccountDeletion() when $default != null:
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
    TResult Function(_AccountDeletion value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _AccountDeletion():
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
    TResult? Function(_AccountDeletion value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _AccountDeletion() when $default != null:
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
            AccountDeletionStatus status,
            @UtcDateTimeConverter() DateTime requestedAt,
            @UtcDateTimeConverter() DateTime erasesAt)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _AccountDeletion() when $default != null:
        return $default(_that.status, _that.requestedAt, _that.erasesAt);
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
            AccountDeletionStatus status,
            @UtcDateTimeConverter() DateTime requestedAt,
            @UtcDateTimeConverter() DateTime erasesAt)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _AccountDeletion():
        return $default(_that.status, _that.requestedAt, _that.erasesAt);
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
            AccountDeletionStatus status,
            @UtcDateTimeConverter() DateTime requestedAt,
            @UtcDateTimeConverter() DateTime erasesAt)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _AccountDeletion() when $default != null:
        return $default(_that.status, _that.requestedAt, _that.erasesAt);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _AccountDeletion extends AccountDeletion {
  const _AccountDeletion(
      {required this.status,
      @UtcDateTimeConverter() required this.requestedAt,
      @UtcDateTimeConverter() required this.erasesAt})
      : super._();
  factory _AccountDeletion.fromJson(Map<String, dynamic> json) =>
      _$AccountDeletionFromJson(json);

  @override
  final AccountDeletionStatus status;
  @override
  @UtcDateTimeConverter()
  final DateTime requestedAt;
  @override
  @UtcDateTimeConverter()
  final DateTime erasesAt;

  /// Create a copy of AccountDeletion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$AccountDeletionCopyWith<_AccountDeletion> get copyWith =>
      __$AccountDeletionCopyWithImpl<_AccountDeletion>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$AccountDeletionToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _AccountDeletion &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.requestedAt, requestedAt) ||
                other.requestedAt == requestedAt) &&
            (identical(other.erasesAt, erasesAt) ||
                other.erasesAt == erasesAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, status, requestedAt, erasesAt);

  @override
  String toString() {
    return 'AccountDeletion(status: $status, requestedAt: $requestedAt, erasesAt: $erasesAt)';
  }
}

/// @nodoc
abstract mixin class _$AccountDeletionCopyWith<$Res>
    implements $AccountDeletionCopyWith<$Res> {
  factory _$AccountDeletionCopyWith(
          _AccountDeletion value, $Res Function(_AccountDeletion) _then) =
      __$AccountDeletionCopyWithImpl;
  @override
  @useResult
  $Res call(
      {AccountDeletionStatus status,
      @UtcDateTimeConverter() DateTime requestedAt,
      @UtcDateTimeConverter() DateTime erasesAt});
}

/// @nodoc
class __$AccountDeletionCopyWithImpl<$Res>
    implements _$AccountDeletionCopyWith<$Res> {
  __$AccountDeletionCopyWithImpl(this._self, this._then);

  final _AccountDeletion _self;
  final $Res Function(_AccountDeletion) _then;

  /// Create a copy of AccountDeletion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? status = null,
    Object? requestedAt = null,
    Object? erasesAt = null,
  }) {
    return _then(_AccountDeletion(
      status: null == status
          ? _self.status
          : status // ignore: cast_nullable_to_non_nullable
              as AccountDeletionStatus,
      requestedAt: null == requestedAt
          ? _self.requestedAt
          : requestedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      erasesAt: null == erasesAt
          ? _self.erasesAt
          : erasesAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }
}

/// @nodoc
mixin _$Address {
  String get id;
  String get label;
  String get line1;
  String? get line2;
  String get city;
  Country get country;
  String? get postalCode;

  /// Map coordinates. Genuinely approximate quantities, so `double` is the
  /// right type — unlike money, nothing is settled against them.
  double? get latitude;
  double? get longitude;
  bool get isDefault;

  /// Create a copy of Address
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $AddressCopyWith<Address> get copyWith =>
      _$AddressCopyWithImpl<Address>(this as Address, _$identity);

  /// Serializes this Address to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is Address &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.line1, line1) || other.line1 == line1) &&
            (identical(other.line2, line2) || other.line2 == line2) &&
            (identical(other.city, city) || other.city == city) &&
            (identical(other.country, country) || other.country == country) &&
            (identical(other.postalCode, postalCode) ||
                other.postalCode == postalCode) &&
            (identical(other.latitude, latitude) ||
                other.latitude == latitude) &&
            (identical(other.longitude, longitude) ||
                other.longitude == longitude) &&
            (identical(other.isDefault, isDefault) ||
                other.isDefault == isDefault));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, label, line1, line2, city,
      country, postalCode, latitude, longitude, isDefault);

  @override
  String toString() {
    return 'Address(id: $id, label: $label, line1: $line1, line2: $line2, city: $city, country: $country, postalCode: $postalCode, latitude: $latitude, longitude: $longitude, isDefault: $isDefault)';
  }
}

/// @nodoc
abstract mixin class $AddressCopyWith<$Res> {
  factory $AddressCopyWith(Address value, $Res Function(Address) _then) =
      _$AddressCopyWithImpl;
  @useResult
  $Res call(
      {String id,
      String label,
      String line1,
      String? line2,
      String city,
      Country country,
      String? postalCode,
      double? latitude,
      double? longitude,
      bool isDefault});
}

/// @nodoc
class _$AddressCopyWithImpl<$Res> implements $AddressCopyWith<$Res> {
  _$AddressCopyWithImpl(this._self, this._then);

  final Address _self;
  final $Res Function(Address) _then;

  /// Create a copy of Address
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? label = null,
    Object? line1 = null,
    Object? line2 = freezed,
    Object? city = null,
    Object? country = null,
    Object? postalCode = freezed,
    Object? latitude = freezed,
    Object? longitude = freezed,
    Object? isDefault = null,
  }) {
    return _then(_self.copyWith(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      label: null == label
          ? _self.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      line1: null == line1
          ? _self.line1
          : line1 // ignore: cast_nullable_to_non_nullable
              as String,
      line2: freezed == line2
          ? _self.line2
          : line2 // ignore: cast_nullable_to_non_nullable
              as String?,
      city: null == city
          ? _self.city
          : city // ignore: cast_nullable_to_non_nullable
              as String,
      country: null == country
          ? _self.country
          : country // ignore: cast_nullable_to_non_nullable
              as Country,
      postalCode: freezed == postalCode
          ? _self.postalCode
          : postalCode // ignore: cast_nullable_to_non_nullable
              as String?,
      latitude: freezed == latitude
          ? _self.latitude
          : latitude // ignore: cast_nullable_to_non_nullable
              as double?,
      longitude: freezed == longitude
          ? _self.longitude
          : longitude // ignore: cast_nullable_to_non_nullable
              as double?,
      isDefault: null == isDefault
          ? _self.isDefault
          : isDefault // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// Adds pattern-matching-related methods to [Address].
extension AddressPatterns on Address {
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
    TResult Function(_Address value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _Address() when $default != null:
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
    TResult Function(_Address value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Address():
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
    TResult? Function(_Address value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Address() when $default != null:
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
            String label,
            String line1,
            String? line2,
            String city,
            Country country,
            String? postalCode,
            double? latitude,
            double? longitude,
            bool isDefault)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _Address() when $default != null:
        return $default(
            _that.id,
            _that.label,
            _that.line1,
            _that.line2,
            _that.city,
            _that.country,
            _that.postalCode,
            _that.latitude,
            _that.longitude,
            _that.isDefault);
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
            String label,
            String line1,
            String? line2,
            String city,
            Country country,
            String? postalCode,
            double? latitude,
            double? longitude,
            bool isDefault)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Address():
        return $default(
            _that.id,
            _that.label,
            _that.line1,
            _that.line2,
            _that.city,
            _that.country,
            _that.postalCode,
            _that.latitude,
            _that.longitude,
            _that.isDefault);
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
            String label,
            String line1,
            String? line2,
            String city,
            Country country,
            String? postalCode,
            double? latitude,
            double? longitude,
            bool isDefault)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Address() when $default != null:
        return $default(
            _that.id,
            _that.label,
            _that.line1,
            _that.line2,
            _that.city,
            _that.country,
            _that.postalCode,
            _that.latitude,
            _that.longitude,
            _that.isDefault);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _Address extends Address {
  const _Address(
      {required this.id,
      required this.label,
      required this.line1,
      required this.line2,
      required this.city,
      required this.country,
      required this.postalCode,
      required this.latitude,
      required this.longitude,
      required this.isDefault})
      : super._();
  factory _Address.fromJson(Map<String, dynamic> json) =>
      _$AddressFromJson(json);

  @override
  final String id;
  @override
  final String label;
  @override
  final String line1;
  @override
  final String? line2;
  @override
  final String city;
  @override
  final Country country;
  @override
  final String? postalCode;

  /// Map coordinates. Genuinely approximate quantities, so `double` is the
  /// right type — unlike money, nothing is settled against them.
  @override
  final double? latitude;
  @override
  final double? longitude;
  @override
  final bool isDefault;

  /// Create a copy of Address
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$AddressCopyWith<_Address> get copyWith =>
      __$AddressCopyWithImpl<_Address>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$AddressToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _Address &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.line1, line1) || other.line1 == line1) &&
            (identical(other.line2, line2) || other.line2 == line2) &&
            (identical(other.city, city) || other.city == city) &&
            (identical(other.country, country) || other.country == country) &&
            (identical(other.postalCode, postalCode) ||
                other.postalCode == postalCode) &&
            (identical(other.latitude, latitude) ||
                other.latitude == latitude) &&
            (identical(other.longitude, longitude) ||
                other.longitude == longitude) &&
            (identical(other.isDefault, isDefault) ||
                other.isDefault == isDefault));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, label, line1, line2, city,
      country, postalCode, latitude, longitude, isDefault);

  @override
  String toString() {
    return 'Address(id: $id, label: $label, line1: $line1, line2: $line2, city: $city, country: $country, postalCode: $postalCode, latitude: $latitude, longitude: $longitude, isDefault: $isDefault)';
  }
}

/// @nodoc
abstract mixin class _$AddressCopyWith<$Res> implements $AddressCopyWith<$Res> {
  factory _$AddressCopyWith(_Address value, $Res Function(_Address) _then) =
      __$AddressCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String id,
      String label,
      String line1,
      String? line2,
      String city,
      Country country,
      String? postalCode,
      double? latitude,
      double? longitude,
      bool isDefault});
}

/// @nodoc
class __$AddressCopyWithImpl<$Res> implements _$AddressCopyWith<$Res> {
  __$AddressCopyWithImpl(this._self, this._then);

  final _Address _self;
  final $Res Function(_Address) _then;

  /// Create a copy of Address
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? id = null,
    Object? label = null,
    Object? line1 = null,
    Object? line2 = freezed,
    Object? city = null,
    Object? country = null,
    Object? postalCode = freezed,
    Object? latitude = freezed,
    Object? longitude = freezed,
    Object? isDefault = null,
  }) {
    return _then(_Address(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      label: null == label
          ? _self.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      line1: null == line1
          ? _self.line1
          : line1 // ignore: cast_nullable_to_non_nullable
              as String,
      line2: freezed == line2
          ? _self.line2
          : line2 // ignore: cast_nullable_to_non_nullable
              as String?,
      city: null == city
          ? _self.city
          : city // ignore: cast_nullable_to_non_nullable
              as String,
      country: null == country
          ? _self.country
          : country // ignore: cast_nullable_to_non_nullable
              as Country,
      postalCode: freezed == postalCode
          ? _self.postalCode
          : postalCode // ignore: cast_nullable_to_non_nullable
              as String?,
      latitude: freezed == latitude
          ? _self.latitude
          : latitude // ignore: cast_nullable_to_non_nullable
              as double?,
      longitude: freezed == longitude
          ? _self.longitude
          : longitude // ignore: cast_nullable_to_non_nullable
              as double?,
      isDefault: null == isDefault
          ? _self.isDefault
          : isDefault // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
mixin _$AddressDeleted {
  String get id;
  bool get deleted;

  /// Create a copy of AddressDeleted
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $AddressDeletedCopyWith<AddressDeleted> get copyWith =>
      _$AddressDeletedCopyWithImpl<AddressDeleted>(
          this as AddressDeleted, _$identity);

  /// Serializes this AddressDeleted to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is AddressDeleted &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.deleted, deleted) || other.deleted == deleted));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, deleted);

  @override
  String toString() {
    return 'AddressDeleted(id: $id, deleted: $deleted)';
  }
}

/// @nodoc
abstract mixin class $AddressDeletedCopyWith<$Res> {
  factory $AddressDeletedCopyWith(
          AddressDeleted value, $Res Function(AddressDeleted) _then) =
      _$AddressDeletedCopyWithImpl;
  @useResult
  $Res call({String id, bool deleted});
}

/// @nodoc
class _$AddressDeletedCopyWithImpl<$Res>
    implements $AddressDeletedCopyWith<$Res> {
  _$AddressDeletedCopyWithImpl(this._self, this._then);

  final AddressDeleted _self;
  final $Res Function(AddressDeleted) _then;

  /// Create a copy of AddressDeleted
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? deleted = null,
  }) {
    return _then(_self.copyWith(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      deleted: null == deleted
          ? _self.deleted
          : deleted // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// Adds pattern-matching-related methods to [AddressDeleted].
extension AddressDeletedPatterns on AddressDeleted {
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
    TResult Function(_AddressDeleted value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _AddressDeleted() when $default != null:
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
    TResult Function(_AddressDeleted value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _AddressDeleted():
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
    TResult? Function(_AddressDeleted value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _AddressDeleted() when $default != null:
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
    TResult Function(String id, bool deleted)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _AddressDeleted() when $default != null:
        return $default(_that.id, _that.deleted);
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
    TResult Function(String id, bool deleted) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _AddressDeleted():
        return $default(_that.id, _that.deleted);
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
    TResult? Function(String id, bool deleted)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _AddressDeleted() when $default != null:
        return $default(_that.id, _that.deleted);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _AddressDeleted implements AddressDeleted {
  const _AddressDeleted({required this.id, required this.deleted});
  factory _AddressDeleted.fromJson(Map<String, dynamic> json) =>
      _$AddressDeletedFromJson(json);

  @override
  final String id;
  @override
  final bool deleted;

  /// Create a copy of AddressDeleted
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$AddressDeletedCopyWith<_AddressDeleted> get copyWith =>
      __$AddressDeletedCopyWithImpl<_AddressDeleted>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$AddressDeletedToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _AddressDeleted &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.deleted, deleted) || other.deleted == deleted));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, deleted);

  @override
  String toString() {
    return 'AddressDeleted(id: $id, deleted: $deleted)';
  }
}

/// @nodoc
abstract mixin class _$AddressDeletedCopyWith<$Res>
    implements $AddressDeletedCopyWith<$Res> {
  factory _$AddressDeletedCopyWith(
          _AddressDeleted value, $Res Function(_AddressDeleted) _then) =
      __$AddressDeletedCopyWithImpl;
  @override
  @useResult
  $Res call({String id, bool deleted});
}

/// @nodoc
class __$AddressDeletedCopyWithImpl<$Res>
    implements _$AddressDeletedCopyWith<$Res> {
  __$AddressDeletedCopyWithImpl(this._self, this._then);

  final _AddressDeleted _self;
  final $Res Function(_AddressDeleted) _then;

  /// Create a copy of AddressDeleted
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? id = null,
    Object? deleted = null,
  }) {
    return _then(_AddressDeleted(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      deleted: null == deleted
          ? _self.deleted
          : deleted // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
mixin _$Device {
  String get id;
  String get deviceId;
  DevicePlatform get platform;
  String get appVersion;
  Language get language;
  @UtcDateTimeConverter()
  DateTime get registeredAt;
  @UtcDateTimeConverter()
  DateTime get lastSeenAt;

  /// Create a copy of Device
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $DeviceCopyWith<Device> get copyWith =>
      _$DeviceCopyWithImpl<Device>(this as Device, _$identity);

  /// Serializes this Device to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is Device &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.deviceId, deviceId) ||
                other.deviceId == deviceId) &&
            (identical(other.platform, platform) ||
                other.platform == platform) &&
            (identical(other.appVersion, appVersion) ||
                other.appVersion == appVersion) &&
            (identical(other.language, language) ||
                other.language == language) &&
            (identical(other.registeredAt, registeredAt) ||
                other.registeredAt == registeredAt) &&
            (identical(other.lastSeenAt, lastSeenAt) ||
                other.lastSeenAt == lastSeenAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, deviceId, platform,
      appVersion, language, registeredAt, lastSeenAt);

  @override
  String toString() {
    return 'Device(id: $id, deviceId: $deviceId, platform: $platform, appVersion: $appVersion, language: $language, registeredAt: $registeredAt, lastSeenAt: $lastSeenAt)';
  }
}

/// @nodoc
abstract mixin class $DeviceCopyWith<$Res> {
  factory $DeviceCopyWith(Device value, $Res Function(Device) _then) =
      _$DeviceCopyWithImpl;
  @useResult
  $Res call(
      {String id,
      String deviceId,
      DevicePlatform platform,
      String appVersion,
      Language language,
      @UtcDateTimeConverter() DateTime registeredAt,
      @UtcDateTimeConverter() DateTime lastSeenAt});
}

/// @nodoc
class _$DeviceCopyWithImpl<$Res> implements $DeviceCopyWith<$Res> {
  _$DeviceCopyWithImpl(this._self, this._then);

  final Device _self;
  final $Res Function(Device) _then;

  /// Create a copy of Device
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? deviceId = null,
    Object? platform = null,
    Object? appVersion = null,
    Object? language = null,
    Object? registeredAt = null,
    Object? lastSeenAt = null,
  }) {
    return _then(_self.copyWith(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      deviceId: null == deviceId
          ? _self.deviceId
          : deviceId // ignore: cast_nullable_to_non_nullable
              as String,
      platform: null == platform
          ? _self.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as DevicePlatform,
      appVersion: null == appVersion
          ? _self.appVersion
          : appVersion // ignore: cast_nullable_to_non_nullable
              as String,
      language: null == language
          ? _self.language
          : language // ignore: cast_nullable_to_non_nullable
              as Language,
      registeredAt: null == registeredAt
          ? _self.registeredAt
          : registeredAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      lastSeenAt: null == lastSeenAt
          ? _self.lastSeenAt
          : lastSeenAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }
}

/// Adds pattern-matching-related methods to [Device].
extension DevicePatterns on Device {
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
    TResult Function(_Device value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _Device() when $default != null:
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
    TResult Function(_Device value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Device():
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
    TResult? Function(_Device value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Device() when $default != null:
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
            String deviceId,
            DevicePlatform platform,
            String appVersion,
            Language language,
            @UtcDateTimeConverter() DateTime registeredAt,
            @UtcDateTimeConverter() DateTime lastSeenAt)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _Device() when $default != null:
        return $default(
            _that.id,
            _that.deviceId,
            _that.platform,
            _that.appVersion,
            _that.language,
            _that.registeredAt,
            _that.lastSeenAt);
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
            String deviceId,
            DevicePlatform platform,
            String appVersion,
            Language language,
            @UtcDateTimeConverter() DateTime registeredAt,
            @UtcDateTimeConverter() DateTime lastSeenAt)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Device():
        return $default(
            _that.id,
            _that.deviceId,
            _that.platform,
            _that.appVersion,
            _that.language,
            _that.registeredAt,
            _that.lastSeenAt);
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
            String deviceId,
            DevicePlatform platform,
            String appVersion,
            Language language,
            @UtcDateTimeConverter() DateTime registeredAt,
            @UtcDateTimeConverter() DateTime lastSeenAt)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Device() when $default != null:
        return $default(
            _that.id,
            _that.deviceId,
            _that.platform,
            _that.appVersion,
            _that.language,
            _that.registeredAt,
            _that.lastSeenAt);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _Device implements Device {
  const _Device(
      {required this.id,
      required this.deviceId,
      required this.platform,
      required this.appVersion,
      required this.language,
      @UtcDateTimeConverter() required this.registeredAt,
      @UtcDateTimeConverter() required this.lastSeenAt});
  factory _Device.fromJson(Map<String, dynamic> json) => _$DeviceFromJson(json);

  @override
  final String id;
  @override
  final String deviceId;
  @override
  final DevicePlatform platform;
  @override
  final String appVersion;
  @override
  final Language language;
  @override
  @UtcDateTimeConverter()
  final DateTime registeredAt;
  @override
  @UtcDateTimeConverter()
  final DateTime lastSeenAt;

  /// Create a copy of Device
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$DeviceCopyWith<_Device> get copyWith =>
      __$DeviceCopyWithImpl<_Device>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$DeviceToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _Device &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.deviceId, deviceId) ||
                other.deviceId == deviceId) &&
            (identical(other.platform, platform) ||
                other.platform == platform) &&
            (identical(other.appVersion, appVersion) ||
                other.appVersion == appVersion) &&
            (identical(other.language, language) ||
                other.language == language) &&
            (identical(other.registeredAt, registeredAt) ||
                other.registeredAt == registeredAt) &&
            (identical(other.lastSeenAt, lastSeenAt) ||
                other.lastSeenAt == lastSeenAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, deviceId, platform,
      appVersion, language, registeredAt, lastSeenAt);

  @override
  String toString() {
    return 'Device(id: $id, deviceId: $deviceId, platform: $platform, appVersion: $appVersion, language: $language, registeredAt: $registeredAt, lastSeenAt: $lastSeenAt)';
  }
}

/// @nodoc
abstract mixin class _$DeviceCopyWith<$Res> implements $DeviceCopyWith<$Res> {
  factory _$DeviceCopyWith(_Device value, $Res Function(_Device) _then) =
      __$DeviceCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String id,
      String deviceId,
      DevicePlatform platform,
      String appVersion,
      Language language,
      @UtcDateTimeConverter() DateTime registeredAt,
      @UtcDateTimeConverter() DateTime lastSeenAt});
}

/// @nodoc
class __$DeviceCopyWithImpl<$Res> implements _$DeviceCopyWith<$Res> {
  __$DeviceCopyWithImpl(this._self, this._then);

  final _Device _self;
  final $Res Function(_Device) _then;

  /// Create a copy of Device
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? id = null,
    Object? deviceId = null,
    Object? platform = null,
    Object? appVersion = null,
    Object? language = null,
    Object? registeredAt = null,
    Object? lastSeenAt = null,
  }) {
    return _then(_Device(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      deviceId: null == deviceId
          ? _self.deviceId
          : deviceId // ignore: cast_nullable_to_non_nullable
              as String,
      platform: null == platform
          ? _self.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as DevicePlatform,
      appVersion: null == appVersion
          ? _self.appVersion
          : appVersion // ignore: cast_nullable_to_non_nullable
              as String,
      language: null == language
          ? _self.language
          : language // ignore: cast_nullable_to_non_nullable
              as Language,
      registeredAt: null == registeredAt
          ? _self.registeredAt
          : registeredAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      lastSeenAt: null == lastSeenAt
          ? _self.lastSeenAt
          : lastSeenAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }
}

/// @nodoc
mixin _$DeviceDeleted {
  String get deviceId;
  bool get deleted;

  /// Create a copy of DeviceDeleted
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $DeviceDeletedCopyWith<DeviceDeleted> get copyWith =>
      _$DeviceDeletedCopyWithImpl<DeviceDeleted>(
          this as DeviceDeleted, _$identity);

  /// Serializes this DeviceDeleted to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is DeviceDeleted &&
            (identical(other.deviceId, deviceId) ||
                other.deviceId == deviceId) &&
            (identical(other.deleted, deleted) || other.deleted == deleted));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, deviceId, deleted);

  @override
  String toString() {
    return 'DeviceDeleted(deviceId: $deviceId, deleted: $deleted)';
  }
}

/// @nodoc
abstract mixin class $DeviceDeletedCopyWith<$Res> {
  factory $DeviceDeletedCopyWith(
          DeviceDeleted value, $Res Function(DeviceDeleted) _then) =
      _$DeviceDeletedCopyWithImpl;
  @useResult
  $Res call({String deviceId, bool deleted});
}

/// @nodoc
class _$DeviceDeletedCopyWithImpl<$Res>
    implements $DeviceDeletedCopyWith<$Res> {
  _$DeviceDeletedCopyWithImpl(this._self, this._then);

  final DeviceDeleted _self;
  final $Res Function(DeviceDeleted) _then;

  /// Create a copy of DeviceDeleted
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? deviceId = null,
    Object? deleted = null,
  }) {
    return _then(_self.copyWith(
      deviceId: null == deviceId
          ? _self.deviceId
          : deviceId // ignore: cast_nullable_to_non_nullable
              as String,
      deleted: null == deleted
          ? _self.deleted
          : deleted // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// Adds pattern-matching-related methods to [DeviceDeleted].
extension DeviceDeletedPatterns on DeviceDeleted {
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
    TResult Function(_DeviceDeleted value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _DeviceDeleted() when $default != null:
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
    TResult Function(_DeviceDeleted value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _DeviceDeleted():
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
    TResult? Function(_DeviceDeleted value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _DeviceDeleted() when $default != null:
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
    TResult Function(String deviceId, bool deleted)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _DeviceDeleted() when $default != null:
        return $default(_that.deviceId, _that.deleted);
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
    TResult Function(String deviceId, bool deleted) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _DeviceDeleted():
        return $default(_that.deviceId, _that.deleted);
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
    TResult? Function(String deviceId, bool deleted)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _DeviceDeleted() when $default != null:
        return $default(_that.deviceId, _that.deleted);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _DeviceDeleted implements DeviceDeleted {
  const _DeviceDeleted({required this.deviceId, required this.deleted});
  factory _DeviceDeleted.fromJson(Map<String, dynamic> json) =>
      _$DeviceDeletedFromJson(json);

  @override
  final String deviceId;
  @override
  final bool deleted;

  /// Create a copy of DeviceDeleted
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$DeviceDeletedCopyWith<_DeviceDeleted> get copyWith =>
      __$DeviceDeletedCopyWithImpl<_DeviceDeleted>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$DeviceDeletedToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _DeviceDeleted &&
            (identical(other.deviceId, deviceId) ||
                other.deviceId == deviceId) &&
            (identical(other.deleted, deleted) || other.deleted == deleted));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, deviceId, deleted);

  @override
  String toString() {
    return 'DeviceDeleted(deviceId: $deviceId, deleted: $deleted)';
  }
}

/// @nodoc
abstract mixin class _$DeviceDeletedCopyWith<$Res>
    implements $DeviceDeletedCopyWith<$Res> {
  factory _$DeviceDeletedCopyWith(
          _DeviceDeleted value, $Res Function(_DeviceDeleted) _then) =
      __$DeviceDeletedCopyWithImpl;
  @override
  @useResult
  $Res call({String deviceId, bool deleted});
}

/// @nodoc
class __$DeviceDeletedCopyWithImpl<$Res>
    implements _$DeviceDeletedCopyWith<$Res> {
  __$DeviceDeletedCopyWithImpl(this._self, this._then);

  final _DeviceDeleted _self;
  final $Res Function(_DeviceDeleted) _then;

  /// Create a copy of DeviceDeleted
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? deviceId = null,
    Object? deleted = null,
  }) {
    return _then(_DeviceDeleted(
      deviceId: null == deviceId
          ? _self.deviceId
          : deviceId // ignore: cast_nullable_to_non_nullable
              as String,
      deleted: null == deleted
          ? _self.deleted
          : deleted // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

// dart format on
