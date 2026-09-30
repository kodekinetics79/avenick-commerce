// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$AuthPrincipal {
  String get id;
  String get email;
  String get firstName;
  String get lastName;
  UserRole get role;
  Language get language;

  /// Create a copy of AuthPrincipal
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $AuthPrincipalCopyWith<AuthPrincipal> get copyWith =>
      _$AuthPrincipalCopyWithImpl<AuthPrincipal>(
          this as AuthPrincipal, _$identity);

  /// Serializes this AuthPrincipal to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is AuthPrincipal &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName) &&
            (identical(other.role, role) || other.role == role) &&
            (identical(other.language, language) ||
                other.language == language));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, email, firstName, lastName, role, language);

  @override
  String toString() {
    return 'AuthPrincipal(id: $id, email: $email, firstName: $firstName, lastName: $lastName, role: $role, language: $language)';
  }
}

/// @nodoc
abstract mixin class $AuthPrincipalCopyWith<$Res> {
  factory $AuthPrincipalCopyWith(
          AuthPrincipal value, $Res Function(AuthPrincipal) _then) =
      _$AuthPrincipalCopyWithImpl;
  @useResult
  $Res call(
      {String id,
      String email,
      String firstName,
      String lastName,
      UserRole role,
      Language language});
}

/// @nodoc
class _$AuthPrincipalCopyWithImpl<$Res>
    implements $AuthPrincipalCopyWith<$Res> {
  _$AuthPrincipalCopyWithImpl(this._self, this._then);

  final AuthPrincipal _self;
  final $Res Function(AuthPrincipal) _then;

  /// Create a copy of AuthPrincipal
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? email = null,
    Object? firstName = null,
    Object? lastName = null,
    Object? role = null,
    Object? language = null,
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
      firstName: null == firstName
          ? _self.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String,
      lastName: null == lastName
          ? _self.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String,
      role: null == role
          ? _self.role
          : role // ignore: cast_nullable_to_non_nullable
              as UserRole,
      language: null == language
          ? _self.language
          : language // ignore: cast_nullable_to_non_nullable
              as Language,
    ));
  }
}

/// Adds pattern-matching-related methods to [AuthPrincipal].
extension AuthPrincipalPatterns on AuthPrincipal {
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
    TResult Function(_AuthPrincipal value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _AuthPrincipal() when $default != null:
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
    TResult Function(_AuthPrincipal value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _AuthPrincipal():
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
    TResult? Function(_AuthPrincipal value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _AuthPrincipal() when $default != null:
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
    TResult Function(String id, String email, String firstName, String lastName,
            UserRole role, Language language)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _AuthPrincipal() when $default != null:
        return $default(_that.id, _that.email, _that.firstName, _that.lastName,
            _that.role, _that.language);
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
    TResult Function(String id, String email, String firstName, String lastName,
            UserRole role, Language language)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _AuthPrincipal():
        return $default(_that.id, _that.email, _that.firstName, _that.lastName,
            _that.role, _that.language);
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
    TResult? Function(String id, String email, String firstName,
            String lastName, UserRole role, Language language)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _AuthPrincipal() when $default != null:
        return $default(_that.id, _that.email, _that.firstName, _that.lastName,
            _that.role, _that.language);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _AuthPrincipal extends AuthPrincipal {
  const _AuthPrincipal(
      {required this.id,
      required this.email,
      required this.firstName,
      required this.lastName,
      required this.role,
      required this.language})
      : super._();
  factory _AuthPrincipal.fromJson(Map<String, dynamic> json) =>
      _$AuthPrincipalFromJson(json);

  @override
  final String id;
  @override
  final String email;
  @override
  final String firstName;
  @override
  final String lastName;
  @override
  final UserRole role;
  @override
  final Language language;

  /// Create a copy of AuthPrincipal
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$AuthPrincipalCopyWith<_AuthPrincipal> get copyWith =>
      __$AuthPrincipalCopyWithImpl<_AuthPrincipal>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$AuthPrincipalToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _AuthPrincipal &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName) &&
            (identical(other.role, role) || other.role == role) &&
            (identical(other.language, language) ||
                other.language == language));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, email, firstName, lastName, role, language);

  @override
  String toString() {
    return 'AuthPrincipal(id: $id, email: $email, firstName: $firstName, lastName: $lastName, role: $role, language: $language)';
  }
}

/// @nodoc
abstract mixin class _$AuthPrincipalCopyWith<$Res>
    implements $AuthPrincipalCopyWith<$Res> {
  factory _$AuthPrincipalCopyWith(
          _AuthPrincipal value, $Res Function(_AuthPrincipal) _then) =
      __$AuthPrincipalCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String id,
      String email,
      String firstName,
      String lastName,
      UserRole role,
      Language language});
}

/// @nodoc
class __$AuthPrincipalCopyWithImpl<$Res>
    implements _$AuthPrincipalCopyWith<$Res> {
  __$AuthPrincipalCopyWithImpl(this._self, this._then);

  final _AuthPrincipal _self;
  final $Res Function(_AuthPrincipal) _then;

  /// Create a copy of AuthPrincipal
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? id = null,
    Object? email = null,
    Object? firstName = null,
    Object? lastName = null,
    Object? role = null,
    Object? language = null,
  }) {
    return _then(_AuthPrincipal(
      id: null == id
          ? _self.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      email: null == email
          ? _self.email
          : email // ignore: cast_nullable_to_non_nullable
              as String,
      firstName: null == firstName
          ? _self.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String,
      lastName: null == lastName
          ? _self.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String,
      role: null == role
          ? _self.role
          : role // ignore: cast_nullable_to_non_nullable
              as UserRole,
      language: null == language
          ? _self.language
          : language // ignore: cast_nullable_to_non_nullable
              as Language,
    ));
  }
}

/// @nodoc
mixin _$TokenPair {
  TokenType get tokenType;
  String get accessToken;

  /// Access-token lifetime in seconds, from the moment the server issued it.
  int get expiresIn;
  String get refreshToken;
  int get refreshExpiresIn;
  AuthPrincipal get principal;

  /// Create a copy of TokenPair
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $TokenPairCopyWith<TokenPair> get copyWith =>
      _$TokenPairCopyWithImpl<TokenPair>(this as TokenPair, _$identity);

  /// Serializes this TokenPair to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is TokenPair &&
            (identical(other.tokenType, tokenType) ||
                other.tokenType == tokenType) &&
            (identical(other.accessToken, accessToken) ||
                other.accessToken == accessToken) &&
            (identical(other.expiresIn, expiresIn) ||
                other.expiresIn == expiresIn) &&
            (identical(other.refreshToken, refreshToken) ||
                other.refreshToken == refreshToken) &&
            (identical(other.refreshExpiresIn, refreshExpiresIn) ||
                other.refreshExpiresIn == refreshExpiresIn) &&
            (identical(other.principal, principal) ||
                other.principal == principal));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, tokenType, accessToken,
      expiresIn, refreshToken, refreshExpiresIn, principal);
}

/// @nodoc
abstract mixin class $TokenPairCopyWith<$Res> {
  factory $TokenPairCopyWith(TokenPair value, $Res Function(TokenPair) _then) =
      _$TokenPairCopyWithImpl;
  @useResult
  $Res call(
      {TokenType tokenType,
      String accessToken,
      int expiresIn,
      String refreshToken,
      int refreshExpiresIn,
      AuthPrincipal principal});

  $AuthPrincipalCopyWith<$Res> get principal;
}

/// @nodoc
class _$TokenPairCopyWithImpl<$Res> implements $TokenPairCopyWith<$Res> {
  _$TokenPairCopyWithImpl(this._self, this._then);

  final TokenPair _self;
  final $Res Function(TokenPair) _then;

  /// Create a copy of TokenPair
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? tokenType = null,
    Object? accessToken = null,
    Object? expiresIn = null,
    Object? refreshToken = null,
    Object? refreshExpiresIn = null,
    Object? principal = null,
  }) {
    return _then(_self.copyWith(
      tokenType: null == tokenType
          ? _self.tokenType
          : tokenType // ignore: cast_nullable_to_non_nullable
              as TokenType,
      accessToken: null == accessToken
          ? _self.accessToken
          : accessToken // ignore: cast_nullable_to_non_nullable
              as String,
      expiresIn: null == expiresIn
          ? _self.expiresIn
          : expiresIn // ignore: cast_nullable_to_non_nullable
              as int,
      refreshToken: null == refreshToken
          ? _self.refreshToken
          : refreshToken // ignore: cast_nullable_to_non_nullable
              as String,
      refreshExpiresIn: null == refreshExpiresIn
          ? _self.refreshExpiresIn
          : refreshExpiresIn // ignore: cast_nullable_to_non_nullable
              as int,
      principal: null == principal
          ? _self.principal
          : principal // ignore: cast_nullable_to_non_nullable
              as AuthPrincipal,
    ));
  }

  /// Create a copy of TokenPair
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $AuthPrincipalCopyWith<$Res> get principal {
    return $AuthPrincipalCopyWith<$Res>(_self.principal, (value) {
      return _then(_self.copyWith(principal: value));
    });
  }
}

/// Adds pattern-matching-related methods to [TokenPair].
extension TokenPairPatterns on TokenPair {
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
    TResult Function(_TokenPair value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _TokenPair() when $default != null:
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
    TResult Function(_TokenPair value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _TokenPair():
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
    TResult? Function(_TokenPair value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _TokenPair() when $default != null:
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
    TResult Function(TokenType tokenType, String accessToken, int expiresIn,
            String refreshToken, int refreshExpiresIn, AuthPrincipal principal)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _TokenPair() when $default != null:
        return $default(_that.tokenType, _that.accessToken, _that.expiresIn,
            _that.refreshToken, _that.refreshExpiresIn, _that.principal);
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
    TResult Function(TokenType tokenType, String accessToken, int expiresIn,
            String refreshToken, int refreshExpiresIn, AuthPrincipal principal)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _TokenPair():
        return $default(_that.tokenType, _that.accessToken, _that.expiresIn,
            _that.refreshToken, _that.refreshExpiresIn, _that.principal);
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
    TResult? Function(TokenType tokenType, String accessToken, int expiresIn,
            String refreshToken, int refreshExpiresIn, AuthPrincipal principal)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _TokenPair() when $default != null:
        return $default(_that.tokenType, _that.accessToken, _that.expiresIn,
            _that.refreshToken, _that.refreshExpiresIn, _that.principal);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _TokenPair extends TokenPair {
  const _TokenPair(
      {required this.tokenType,
      required this.accessToken,
      required this.expiresIn,
      required this.refreshToken,
      required this.refreshExpiresIn,
      required this.principal})
      : super._();
  factory _TokenPair.fromJson(Map<String, dynamic> json) =>
      _$TokenPairFromJson(json);

  @override
  final TokenType tokenType;
  @override
  final String accessToken;

  /// Access-token lifetime in seconds, from the moment the server issued it.
  @override
  final int expiresIn;
  @override
  final String refreshToken;
  @override
  final int refreshExpiresIn;
  @override
  final AuthPrincipal principal;

  /// Create a copy of TokenPair
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$TokenPairCopyWith<_TokenPair> get copyWith =>
      __$TokenPairCopyWithImpl<_TokenPair>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$TokenPairToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _TokenPair &&
            (identical(other.tokenType, tokenType) ||
                other.tokenType == tokenType) &&
            (identical(other.accessToken, accessToken) ||
                other.accessToken == accessToken) &&
            (identical(other.expiresIn, expiresIn) ||
                other.expiresIn == expiresIn) &&
            (identical(other.refreshToken, refreshToken) ||
                other.refreshToken == refreshToken) &&
            (identical(other.refreshExpiresIn, refreshExpiresIn) ||
                other.refreshExpiresIn == refreshExpiresIn) &&
            (identical(other.principal, principal) ||
                other.principal == principal));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, tokenType, accessToken,
      expiresIn, refreshToken, refreshExpiresIn, principal);
}

/// @nodoc
abstract mixin class _$TokenPairCopyWith<$Res>
    implements $TokenPairCopyWith<$Res> {
  factory _$TokenPairCopyWith(
          _TokenPair value, $Res Function(_TokenPair) _then) =
      __$TokenPairCopyWithImpl;
  @override
  @useResult
  $Res call(
      {TokenType tokenType,
      String accessToken,
      int expiresIn,
      String refreshToken,
      int refreshExpiresIn,
      AuthPrincipal principal});

  @override
  $AuthPrincipalCopyWith<$Res> get principal;
}

/// @nodoc
class __$TokenPairCopyWithImpl<$Res> implements _$TokenPairCopyWith<$Res> {
  __$TokenPairCopyWithImpl(this._self, this._then);

  final _TokenPair _self;
  final $Res Function(_TokenPair) _then;

  /// Create a copy of TokenPair
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? tokenType = null,
    Object? accessToken = null,
    Object? expiresIn = null,
    Object? refreshToken = null,
    Object? refreshExpiresIn = null,
    Object? principal = null,
  }) {
    return _then(_TokenPair(
      tokenType: null == tokenType
          ? _self.tokenType
          : tokenType // ignore: cast_nullable_to_non_nullable
              as TokenType,
      accessToken: null == accessToken
          ? _self.accessToken
          : accessToken // ignore: cast_nullable_to_non_nullable
              as String,
      expiresIn: null == expiresIn
          ? _self.expiresIn
          : expiresIn // ignore: cast_nullable_to_non_nullable
              as int,
      refreshToken: null == refreshToken
          ? _self.refreshToken
          : refreshToken // ignore: cast_nullable_to_non_nullable
              as String,
      refreshExpiresIn: null == refreshExpiresIn
          ? _self.refreshExpiresIn
          : refreshExpiresIn // ignore: cast_nullable_to_non_nullable
              as int,
      principal: null == principal
          ? _self.principal
          : principal // ignore: cast_nullable_to_non_nullable
              as AuthPrincipal,
    ));
  }

  /// Create a copy of TokenPair
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $AuthPrincipalCopyWith<$Res> get principal {
    return $AuthPrincipalCopyWith<$Res>(_self.principal, (value) {
      return _then(_self.copyWith(principal: value));
    });
  }
}

/// @nodoc
mixin _$OtpChallenge {
  String get challengeId;

  /// How many digits the input should accept — 4 to 8. Not hardcoded in the
  /// UI: the server decides, and a fixed six-box input would break the day
  /// it changes.
  int get codeLength;
  @UtcDateTimeConverter()
  DateTime get expiresAt;

  /// The earliest instant a resend will be accepted. Drive the countdown
  /// from this, not from a local timer started at send time.
  @UtcDateTimeConverter()
  DateTime get resendAfter;

  /// Create a copy of OtpChallenge
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $OtpChallengeCopyWith<OtpChallenge> get copyWith =>
      _$OtpChallengeCopyWithImpl<OtpChallenge>(
          this as OtpChallenge, _$identity);

  /// Serializes this OtpChallenge to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is OtpChallenge &&
            (identical(other.challengeId, challengeId) ||
                other.challengeId == challengeId) &&
            (identical(other.codeLength, codeLength) ||
                other.codeLength == codeLength) &&
            (identical(other.expiresAt, expiresAt) ||
                other.expiresAt == expiresAt) &&
            (identical(other.resendAfter, resendAfter) ||
                other.resendAfter == resendAfter));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, challengeId, codeLength, expiresAt, resendAfter);

  @override
  String toString() {
    return 'OtpChallenge(challengeId: $challengeId, codeLength: $codeLength, expiresAt: $expiresAt, resendAfter: $resendAfter)';
  }
}

/// @nodoc
abstract mixin class $OtpChallengeCopyWith<$Res> {
  factory $OtpChallengeCopyWith(
          OtpChallenge value, $Res Function(OtpChallenge) _then) =
      _$OtpChallengeCopyWithImpl;
  @useResult
  $Res call(
      {String challengeId,
      int codeLength,
      @UtcDateTimeConverter() DateTime expiresAt,
      @UtcDateTimeConverter() DateTime resendAfter});
}

/// @nodoc
class _$OtpChallengeCopyWithImpl<$Res> implements $OtpChallengeCopyWith<$Res> {
  _$OtpChallengeCopyWithImpl(this._self, this._then);

  final OtpChallenge _self;
  final $Res Function(OtpChallenge) _then;

  /// Create a copy of OtpChallenge
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? challengeId = null,
    Object? codeLength = null,
    Object? expiresAt = null,
    Object? resendAfter = null,
  }) {
    return _then(_self.copyWith(
      challengeId: null == challengeId
          ? _self.challengeId
          : challengeId // ignore: cast_nullable_to_non_nullable
              as String,
      codeLength: null == codeLength
          ? _self.codeLength
          : codeLength // ignore: cast_nullable_to_non_nullable
              as int,
      expiresAt: null == expiresAt
          ? _self.expiresAt
          : expiresAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      resendAfter: null == resendAfter
          ? _self.resendAfter
          : resendAfter // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }
}

/// Adds pattern-matching-related methods to [OtpChallenge].
extension OtpChallengePatterns on OtpChallenge {
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
    TResult Function(_OtpChallenge value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _OtpChallenge() when $default != null:
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
    TResult Function(_OtpChallenge value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OtpChallenge():
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
    TResult? Function(_OtpChallenge value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OtpChallenge() when $default != null:
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
            String challengeId,
            int codeLength,
            @UtcDateTimeConverter() DateTime expiresAt,
            @UtcDateTimeConverter() DateTime resendAfter)?
        $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _OtpChallenge() when $default != null:
        return $default(_that.challengeId, _that.codeLength, _that.expiresAt,
            _that.resendAfter);
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
            String challengeId,
            int codeLength,
            @UtcDateTimeConverter() DateTime expiresAt,
            @UtcDateTimeConverter() DateTime resendAfter)
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OtpChallenge():
        return $default(_that.challengeId, _that.codeLength, _that.expiresAt,
            _that.resendAfter);
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
            String challengeId,
            int codeLength,
            @UtcDateTimeConverter() DateTime expiresAt,
            @UtcDateTimeConverter() DateTime resendAfter)?
        $default,
  ) {
    final _that = this;
    switch (_that) {
      case _OtpChallenge() when $default != null:
        return $default(_that.challengeId, _that.codeLength, _that.expiresAt,
            _that.resendAfter);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _OtpChallenge extends OtpChallenge {
  const _OtpChallenge(
      {required this.challengeId,
      required this.codeLength,
      @UtcDateTimeConverter() required this.expiresAt,
      @UtcDateTimeConverter() required this.resendAfter})
      : super._();
  factory _OtpChallenge.fromJson(Map<String, dynamic> json) =>
      _$OtpChallengeFromJson(json);

  @override
  final String challengeId;

  /// How many digits the input should accept — 4 to 8. Not hardcoded in the
  /// UI: the server decides, and a fixed six-box input would break the day
  /// it changes.
  @override
  final int codeLength;
  @override
  @UtcDateTimeConverter()
  final DateTime expiresAt;

  /// The earliest instant a resend will be accepted. Drive the countdown
  /// from this, not from a local timer started at send time.
  @override
  @UtcDateTimeConverter()
  final DateTime resendAfter;

  /// Create a copy of OtpChallenge
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$OtpChallengeCopyWith<_OtpChallenge> get copyWith =>
      __$OtpChallengeCopyWithImpl<_OtpChallenge>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$OtpChallengeToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _OtpChallenge &&
            (identical(other.challengeId, challengeId) ||
                other.challengeId == challengeId) &&
            (identical(other.codeLength, codeLength) ||
                other.codeLength == codeLength) &&
            (identical(other.expiresAt, expiresAt) ||
                other.expiresAt == expiresAt) &&
            (identical(other.resendAfter, resendAfter) ||
                other.resendAfter == resendAfter));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, challengeId, codeLength, expiresAt, resendAfter);

  @override
  String toString() {
    return 'OtpChallenge(challengeId: $challengeId, codeLength: $codeLength, expiresAt: $expiresAt, resendAfter: $resendAfter)';
  }
}

/// @nodoc
abstract mixin class _$OtpChallengeCopyWith<$Res>
    implements $OtpChallengeCopyWith<$Res> {
  factory _$OtpChallengeCopyWith(
          _OtpChallenge value, $Res Function(_OtpChallenge) _then) =
      __$OtpChallengeCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String challengeId,
      int codeLength,
      @UtcDateTimeConverter() DateTime expiresAt,
      @UtcDateTimeConverter() DateTime resendAfter});
}

/// @nodoc
class __$OtpChallengeCopyWithImpl<$Res>
    implements _$OtpChallengeCopyWith<$Res> {
  __$OtpChallengeCopyWithImpl(this._self, this._then);

  final _OtpChallenge _self;
  final $Res Function(_OtpChallenge) _then;

  /// Create a copy of OtpChallenge
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? challengeId = null,
    Object? codeLength = null,
    Object? expiresAt = null,
    Object? resendAfter = null,
  }) {
    return _then(_OtpChallenge(
      challengeId: null == challengeId
          ? _self.challengeId
          : challengeId // ignore: cast_nullable_to_non_nullable
              as String,
      codeLength: null == codeLength
          ? _self.codeLength
          : codeLength // ignore: cast_nullable_to_non_nullable
              as int,
      expiresAt: null == expiresAt
          ? _self.expiresAt
          : expiresAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      resendAfter: null == resendAfter
          ? _self.resendAfter
          : resendAfter // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }
}

/// @nodoc
mixin _$Revocation {
  int get revokedCount;

  /// Create a copy of Revocation
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $RevocationCopyWith<Revocation> get copyWith =>
      _$RevocationCopyWithImpl<Revocation>(this as Revocation, _$identity);

  /// Serializes this Revocation to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is Revocation &&
            (identical(other.revokedCount, revokedCount) ||
                other.revokedCount == revokedCount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, revokedCount);

  @override
  String toString() {
    return 'Revocation(revokedCount: $revokedCount)';
  }
}

/// @nodoc
abstract mixin class $RevocationCopyWith<$Res> {
  factory $RevocationCopyWith(
          Revocation value, $Res Function(Revocation) _then) =
      _$RevocationCopyWithImpl;
  @useResult
  $Res call({int revokedCount});
}

/// @nodoc
class _$RevocationCopyWithImpl<$Res> implements $RevocationCopyWith<$Res> {
  _$RevocationCopyWithImpl(this._self, this._then);

  final Revocation _self;
  final $Res Function(Revocation) _then;

  /// Create a copy of Revocation
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? revokedCount = null,
  }) {
    return _then(_self.copyWith(
      revokedCount: null == revokedCount
          ? _self.revokedCount
          : revokedCount // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// Adds pattern-matching-related methods to [Revocation].
extension RevocationPatterns on Revocation {
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
    TResult Function(_Revocation value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _Revocation() when $default != null:
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
    TResult Function(_Revocation value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Revocation():
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
    TResult? Function(_Revocation value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Revocation() when $default != null:
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
    TResult Function(int revokedCount)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _Revocation() when $default != null:
        return $default(_that.revokedCount);
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
    TResult Function(int revokedCount) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Revocation():
        return $default(_that.revokedCount);
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
    TResult? Function(int revokedCount)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _Revocation() when $default != null:
        return $default(_that.revokedCount);
      case _:
        return null;
    }
  }
}

/// @nodoc
@JsonSerializable()
class _Revocation implements Revocation {
  const _Revocation({required this.revokedCount});
  factory _Revocation.fromJson(Map<String, dynamic> json) =>
      _$RevocationFromJson(json);

  @override
  final int revokedCount;

  /// Create a copy of Revocation
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$RevocationCopyWith<_Revocation> get copyWith =>
      __$RevocationCopyWithImpl<_Revocation>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$RevocationToJson(
      this,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _Revocation &&
            (identical(other.revokedCount, revokedCount) ||
                other.revokedCount == revokedCount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, revokedCount);

  @override
  String toString() {
    return 'Revocation(revokedCount: $revokedCount)';
  }
}

/// @nodoc
abstract mixin class _$RevocationCopyWith<$Res>
    implements $RevocationCopyWith<$Res> {
  factory _$RevocationCopyWith(
          _Revocation value, $Res Function(_Revocation) _then) =
      __$RevocationCopyWithImpl;
  @override
  @useResult
  $Res call({int revokedCount});
}

/// @nodoc
class __$RevocationCopyWithImpl<$Res> implements _$RevocationCopyWith<$Res> {
  __$RevocationCopyWithImpl(this._self, this._then);

  final _Revocation _self;
  final $Res Function(_Revocation) _then;

  /// Create a copy of Revocation
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? revokedCount = null,
  }) {
    return _then(_Revocation(
      revokedCount: null == revokedCount
          ? _self.revokedCount
          : revokedCount // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

// dart format on
