// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'failures.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$ApiFailure {
  String get message;

  /// Create a copy of ApiFailure
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $ApiFailureCopyWith<ApiFailure> get copyWith =>
      _$ApiFailureCopyWithImpl<ApiFailure>(this as ApiFailure, _$identity);

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is ApiFailure &&
            (identical(other.message, message) || other.message == message));
  }

  @override
  int get hashCode => Object.hash(runtimeType, message);

  @override
  String toString() {
    return 'ApiFailure(message: $message)';
  }
}

/// @nodoc
abstract mixin class $ApiFailureCopyWith<$Res> {
  factory $ApiFailureCopyWith(
          ApiFailure value, $Res Function(ApiFailure) _then) =
      _$ApiFailureCopyWithImpl;
  @useResult
  $Res call({String message});
}

/// @nodoc
class _$ApiFailureCopyWithImpl<$Res> implements $ApiFailureCopyWith<$Res> {
  _$ApiFailureCopyWithImpl(this._self, this._then);

  final ApiFailure _self;
  final $Res Function(ApiFailure) _then;

  /// Create a copy of ApiFailure
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? message = null,
  }) {
    return _then(_self.copyWith(
      message: null == message
          ? _self.message
          : message // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// Adds pattern-matching-related methods to [ApiFailure].
extension ApiFailurePatterns on ApiFailure {
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
  TResult maybeMap<TResult extends Object?>({
    TResult Function(NetworkFailure value)? network,
    TResult Function(AuthFailure value)? auth,
    TResult Function(ValidationFailure value)? validation,
    TResult Function(RateLimitFailure value)? rateLimit,
    TResult Function(ServerFailure value)? server,
    TResult Function(UnexpectedFailure value)? unexpected,
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case NetworkFailure() when network != null:
        return network(_that);
      case AuthFailure() when auth != null:
        return auth(_that);
      case ValidationFailure() when validation != null:
        return validation(_that);
      case RateLimitFailure() when rateLimit != null:
        return rateLimit(_that);
      case ServerFailure() when server != null:
        return server(_that);
      case UnexpectedFailure() when unexpected != null:
        return unexpected(_that);
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
  TResult map<TResult extends Object?>({
    required TResult Function(NetworkFailure value) network,
    required TResult Function(AuthFailure value) auth,
    required TResult Function(ValidationFailure value) validation,
    required TResult Function(RateLimitFailure value) rateLimit,
    required TResult Function(ServerFailure value) server,
    required TResult Function(UnexpectedFailure value) unexpected,
  }) {
    final _that = this;
    switch (_that) {
      case NetworkFailure():
        return network(_that);
      case AuthFailure():
        return auth(_that);
      case ValidationFailure():
        return validation(_that);
      case RateLimitFailure():
        return rateLimit(_that);
      case ServerFailure():
        return server(_that);
      case UnexpectedFailure():
        return unexpected(_that);
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
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(NetworkFailure value)? network,
    TResult? Function(AuthFailure value)? auth,
    TResult? Function(ValidationFailure value)? validation,
    TResult? Function(RateLimitFailure value)? rateLimit,
    TResult? Function(ServerFailure value)? server,
    TResult? Function(UnexpectedFailure value)? unexpected,
  }) {
    final _that = this;
    switch (_that) {
      case NetworkFailure() when network != null:
        return network(_that);
      case AuthFailure() when auth != null:
        return auth(_that);
      case ValidationFailure() when validation != null:
        return validation(_that);
      case RateLimitFailure() when rateLimit != null:
        return rateLimit(_that);
      case ServerFailure() when server != null:
        return server(_that);
      case UnexpectedFailure() when unexpected != null:
        return unexpected(_that);
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
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(NetworkFailureKind kind, String message, Object? cause)?
        network,
    TResult Function(ApiErrorCode code, String message, bool requiresReauth,
            String? requestId)?
        auth,
    TResult Function(String message, Map<String, List<String>> fieldErrors,
            String? requestId)?
        validation,
    TResult Function(String message, Duration? retryAfter, String? requestId)?
        rateLimit,
    TResult Function(ApiErrorCode code, String message, String requestId,
            int? statusCode)?
        server,
    TResult Function(String message, Object? cause, StackTrace? stackTrace,
            String? requestId, int? statusCode)?
        unexpected,
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case NetworkFailure() when network != null:
        return network(_that.kind, _that.message, _that.cause);
      case AuthFailure() when auth != null:
        return auth(
            _that.code, _that.message, _that.requiresReauth, _that.requestId);
      case ValidationFailure() when validation != null:
        return validation(_that.message, _that.fieldErrors, _that.requestId);
      case RateLimitFailure() when rateLimit != null:
        return rateLimit(_that.message, _that.retryAfter, _that.requestId);
      case ServerFailure() when server != null:
        return server(
            _that.code, _that.message, _that.requestId, _that.statusCode);
      case UnexpectedFailure() when unexpected != null:
        return unexpected(_that.message, _that.cause, _that.stackTrace,
            _that.requestId, _that.statusCode);
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
  TResult when<TResult extends Object?>({
    required TResult Function(
            NetworkFailureKind kind, String message, Object? cause)
        network,
    required TResult Function(ApiErrorCode code, String message,
            bool requiresReauth, String? requestId)
        auth,
    required TResult Function(String message,
            Map<String, List<String>> fieldErrors, String? requestId)
        validation,
    required TResult Function(
            String message, Duration? retryAfter, String? requestId)
        rateLimit,
    required TResult Function(ApiErrorCode code, String message,
            String requestId, int? statusCode)
        server,
    required TResult Function(String message, Object? cause,
            StackTrace? stackTrace, String? requestId, int? statusCode)
        unexpected,
  }) {
    final _that = this;
    switch (_that) {
      case NetworkFailure():
        return network(_that.kind, _that.message, _that.cause);
      case AuthFailure():
        return auth(
            _that.code, _that.message, _that.requiresReauth, _that.requestId);
      case ValidationFailure():
        return validation(_that.message, _that.fieldErrors, _that.requestId);
      case RateLimitFailure():
        return rateLimit(_that.message, _that.retryAfter, _that.requestId);
      case ServerFailure():
        return server(
            _that.code, _that.message, _that.requestId, _that.statusCode);
      case UnexpectedFailure():
        return unexpected(_that.message, _that.cause, _that.stackTrace,
            _that.requestId, _that.statusCode);
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
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(NetworkFailureKind kind, String message, Object? cause)?
        network,
    TResult? Function(ApiErrorCode code, String message, bool requiresReauth,
            String? requestId)?
        auth,
    TResult? Function(String message, Map<String, List<String>> fieldErrors,
            String? requestId)?
        validation,
    TResult? Function(String message, Duration? retryAfter, String? requestId)?
        rateLimit,
    TResult? Function(ApiErrorCode code, String message, String requestId,
            int? statusCode)?
        server,
    TResult? Function(String message, Object? cause, StackTrace? stackTrace,
            String? requestId, int? statusCode)?
        unexpected,
  }) {
    final _that = this;
    switch (_that) {
      case NetworkFailure() when network != null:
        return network(_that.kind, _that.message, _that.cause);
      case AuthFailure() when auth != null:
        return auth(
            _that.code, _that.message, _that.requiresReauth, _that.requestId);
      case ValidationFailure() when validation != null:
        return validation(_that.message, _that.fieldErrors, _that.requestId);
      case RateLimitFailure() when rateLimit != null:
        return rateLimit(_that.message, _that.retryAfter, _that.requestId);
      case ServerFailure() when server != null:
        return server(
            _that.code, _that.message, _that.requestId, _that.statusCode);
      case UnexpectedFailure() when unexpected != null:
        return unexpected(_that.message, _that.cause, _that.stackTrace,
            _that.requestId, _that.statusCode);
      case _:
        return null;
    }
  }
}

/// @nodoc

class NetworkFailure extends ApiFailure {
  const NetworkFailure({required this.kind, required this.message, this.cause})
      : super._();

  final NetworkFailureKind kind;
  @override
  final String message;
  final Object? cause;

  /// Create a copy of ApiFailure
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $NetworkFailureCopyWith<NetworkFailure> get copyWith =>
      _$NetworkFailureCopyWithImpl<NetworkFailure>(this, _$identity);

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is NetworkFailure &&
            (identical(other.kind, kind) || other.kind == kind) &&
            (identical(other.message, message) || other.message == message) &&
            const DeepCollectionEquality().equals(other.cause, cause));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType, kind, message, const DeepCollectionEquality().hash(cause));

  @override
  String toString() {
    return 'ApiFailure.network(kind: $kind, message: $message, cause: $cause)';
  }
}

/// @nodoc
abstract mixin class $NetworkFailureCopyWith<$Res>
    implements $ApiFailureCopyWith<$Res> {
  factory $NetworkFailureCopyWith(
          NetworkFailure value, $Res Function(NetworkFailure) _then) =
      _$NetworkFailureCopyWithImpl;
  @override
  @useResult
  $Res call({NetworkFailureKind kind, String message, Object? cause});
}

/// @nodoc
class _$NetworkFailureCopyWithImpl<$Res>
    implements $NetworkFailureCopyWith<$Res> {
  _$NetworkFailureCopyWithImpl(this._self, this._then);

  final NetworkFailure _self;
  final $Res Function(NetworkFailure) _then;

  /// Create a copy of ApiFailure
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? kind = null,
    Object? message = null,
    Object? cause = freezed,
  }) {
    return _then(NetworkFailure(
      kind: null == kind
          ? _self.kind
          : kind // ignore: cast_nullable_to_non_nullable
              as NetworkFailureKind,
      message: null == message
          ? _self.message
          : message // ignore: cast_nullable_to_non_nullable
              as String,
      cause: freezed == cause ? _self.cause : cause,
    ));
  }
}

/// @nodoc

class AuthFailure extends ApiFailure {
  const AuthFailure(
      {required this.code,
      required this.message,
      required this.requiresReauth,
      this.requestId})
      : super._();

  final ApiErrorCode code;
  @override
  final String message;
  final bool requiresReauth;
  final String? requestId;

  /// Create a copy of ApiFailure
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $AuthFailureCopyWith<AuthFailure> get copyWith =>
      _$AuthFailureCopyWithImpl<AuthFailure>(this, _$identity);

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is AuthFailure &&
            (identical(other.code, code) || other.code == code) &&
            (identical(other.message, message) || other.message == message) &&
            (identical(other.requiresReauth, requiresReauth) ||
                other.requiresReauth == requiresReauth) &&
            (identical(other.requestId, requestId) ||
                other.requestId == requestId));
  }

  @override
  int get hashCode =>
      Object.hash(runtimeType, code, message, requiresReauth, requestId);

  @override
  String toString() {
    return 'ApiFailure.auth(code: $code, message: $message, requiresReauth: $requiresReauth, requestId: $requestId)';
  }
}

/// @nodoc
abstract mixin class $AuthFailureCopyWith<$Res>
    implements $ApiFailureCopyWith<$Res> {
  factory $AuthFailureCopyWith(
          AuthFailure value, $Res Function(AuthFailure) _then) =
      _$AuthFailureCopyWithImpl;
  @override
  @useResult
  $Res call(
      {ApiErrorCode code,
      String message,
      bool requiresReauth,
      String? requestId});
}

/// @nodoc
class _$AuthFailureCopyWithImpl<$Res> implements $AuthFailureCopyWith<$Res> {
  _$AuthFailureCopyWithImpl(this._self, this._then);

  final AuthFailure _self;
  final $Res Function(AuthFailure) _then;

  /// Create a copy of ApiFailure
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? code = null,
    Object? message = null,
    Object? requiresReauth = null,
    Object? requestId = freezed,
  }) {
    return _then(AuthFailure(
      code: null == code
          ? _self.code
          : code // ignore: cast_nullable_to_non_nullable
              as ApiErrorCode,
      message: null == message
          ? _self.message
          : message // ignore: cast_nullable_to_non_nullable
              as String,
      requiresReauth: null == requiresReauth
          ? _self.requiresReauth
          : requiresReauth // ignore: cast_nullable_to_non_nullable
              as bool,
      requestId: freezed == requestId
          ? _self.requestId
          : requestId // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc

class ValidationFailure extends ApiFailure {
  const ValidationFailure(
      {required this.message,
      required final Map<String, List<String>> fieldErrors,
      this.requestId})
      : _fieldErrors = fieldErrors,
        super._();

  @override
  final String message;

  /// Keyed by the dotted path into the request body, exactly as the server
  /// built it from Zod: `items.2.quantity`, `shippingAddress.country`. Each
  /// path carries one or more messages, because Zod reports several issues
  /// on one field routinely.
  ///
  /// Never empty when present: the server omits the map entirely rather than
  /// sending `{}` as a claim that nothing is wrong.
  final Map<String, List<String>> _fieldErrors;

  /// Keyed by the dotted path into the request body, exactly as the server
  /// built it from Zod: `items.2.quantity`, `shippingAddress.country`. Each
  /// path carries one or more messages, because Zod reports several issues
  /// on one field routinely.
  ///
  /// Never empty when present: the server omits the map entirely rather than
  /// sending `{}` as a claim that nothing is wrong.
  Map<String, List<String>> get fieldErrors {
    if (_fieldErrors is EqualUnmodifiableMapView) return _fieldErrors;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(_fieldErrors);
  }

  final String? requestId;

  /// Create a copy of ApiFailure
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $ValidationFailureCopyWith<ValidationFailure> get copyWith =>
      _$ValidationFailureCopyWithImpl<ValidationFailure>(this, _$identity);

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is ValidationFailure &&
            (identical(other.message, message) || other.message == message) &&
            const DeepCollectionEquality()
                .equals(other._fieldErrors, _fieldErrors) &&
            (identical(other.requestId, requestId) ||
                other.requestId == requestId));
  }

  @override
  int get hashCode => Object.hash(runtimeType, message,
      const DeepCollectionEquality().hash(_fieldErrors), requestId);

  @override
  String toString() {
    return 'ApiFailure.validation(message: $message, fieldErrors: $fieldErrors, requestId: $requestId)';
  }
}

/// @nodoc
abstract mixin class $ValidationFailureCopyWith<$Res>
    implements $ApiFailureCopyWith<$Res> {
  factory $ValidationFailureCopyWith(
          ValidationFailure value, $Res Function(ValidationFailure) _then) =
      _$ValidationFailureCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String message,
      Map<String, List<String>> fieldErrors,
      String? requestId});
}

/// @nodoc
class _$ValidationFailureCopyWithImpl<$Res>
    implements $ValidationFailureCopyWith<$Res> {
  _$ValidationFailureCopyWithImpl(this._self, this._then);

  final ValidationFailure _self;
  final $Res Function(ValidationFailure) _then;

  /// Create a copy of ApiFailure
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? message = null,
    Object? fieldErrors = null,
    Object? requestId = freezed,
  }) {
    return _then(ValidationFailure(
      message: null == message
          ? _self.message
          : message // ignore: cast_nullable_to_non_nullable
              as String,
      fieldErrors: null == fieldErrors
          ? _self._fieldErrors
          : fieldErrors // ignore: cast_nullable_to_non_nullable
              as Map<String, List<String>>,
      requestId: freezed == requestId
          ? _self.requestId
          : requestId // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc

class RateLimitFailure extends ApiFailure {
  const RateLimitFailure(
      {required this.message, this.retryAfter, this.requestId})
      : super._();

  @override
  final String message;

  /// Null when the server sent no `Retry-After`. Do NOT substitute a guess:
  /// a client-invented backoff is how a throttled app turns into a
  /// synchronised thundering herd.
  final Duration? retryAfter;
  final String? requestId;

  /// Create a copy of ApiFailure
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $RateLimitFailureCopyWith<RateLimitFailure> get copyWith =>
      _$RateLimitFailureCopyWithImpl<RateLimitFailure>(this, _$identity);

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is RateLimitFailure &&
            (identical(other.message, message) || other.message == message) &&
            (identical(other.retryAfter, retryAfter) ||
                other.retryAfter == retryAfter) &&
            (identical(other.requestId, requestId) ||
                other.requestId == requestId));
  }

  @override
  int get hashCode => Object.hash(runtimeType, message, retryAfter, requestId);

  @override
  String toString() {
    return 'ApiFailure.rateLimit(message: $message, retryAfter: $retryAfter, requestId: $requestId)';
  }
}

/// @nodoc
abstract mixin class $RateLimitFailureCopyWith<$Res>
    implements $ApiFailureCopyWith<$Res> {
  factory $RateLimitFailureCopyWith(
          RateLimitFailure value, $Res Function(RateLimitFailure) _then) =
      _$RateLimitFailureCopyWithImpl;
  @override
  @useResult
  $Res call({String message, Duration? retryAfter, String? requestId});
}

/// @nodoc
class _$RateLimitFailureCopyWithImpl<$Res>
    implements $RateLimitFailureCopyWith<$Res> {
  _$RateLimitFailureCopyWithImpl(this._self, this._then);

  final RateLimitFailure _self;
  final $Res Function(RateLimitFailure) _then;

  /// Create a copy of ApiFailure
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? message = null,
    Object? retryAfter = freezed,
    Object? requestId = freezed,
  }) {
    return _then(RateLimitFailure(
      message: null == message
          ? _self.message
          : message // ignore: cast_nullable_to_non_nullable
              as String,
      retryAfter: freezed == retryAfter
          ? _self.retryAfter
          : retryAfter // ignore: cast_nullable_to_non_nullable
              as Duration?,
      requestId: freezed == requestId
          ? _self.requestId
          : requestId // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc

class ServerFailure extends ApiFailure {
  const ServerFailure(
      {required this.code,
      required this.message,
      required this.requestId,
      this.statusCode})
      : super._();

  final ApiErrorCode code;
  @override
  final String message;

  /// The server-assigned id for this exact request. This is the field that
  /// makes a user-visible error traceable to a server log line, so it is
  /// required here — a support conversation that starts with "it failed" and
  /// cannot name the request has no evidence in it.
  final String requestId;
  final int? statusCode;

  /// Create a copy of ApiFailure
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $ServerFailureCopyWith<ServerFailure> get copyWith =>
      _$ServerFailureCopyWithImpl<ServerFailure>(this, _$identity);

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is ServerFailure &&
            (identical(other.code, code) || other.code == code) &&
            (identical(other.message, message) || other.message == message) &&
            (identical(other.requestId, requestId) ||
                other.requestId == requestId) &&
            (identical(other.statusCode, statusCode) ||
                other.statusCode == statusCode));
  }

  @override
  int get hashCode =>
      Object.hash(runtimeType, code, message, requestId, statusCode);

  @override
  String toString() {
    return 'ApiFailure.server(code: $code, message: $message, requestId: $requestId, statusCode: $statusCode)';
  }
}

/// @nodoc
abstract mixin class $ServerFailureCopyWith<$Res>
    implements $ApiFailureCopyWith<$Res> {
  factory $ServerFailureCopyWith(
          ServerFailure value, $Res Function(ServerFailure) _then) =
      _$ServerFailureCopyWithImpl;
  @override
  @useResult
  $Res call(
      {ApiErrorCode code, String message, String requestId, int? statusCode});
}

/// @nodoc
class _$ServerFailureCopyWithImpl<$Res>
    implements $ServerFailureCopyWith<$Res> {
  _$ServerFailureCopyWithImpl(this._self, this._then);

  final ServerFailure _self;
  final $Res Function(ServerFailure) _then;

  /// Create a copy of ApiFailure
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? code = null,
    Object? message = null,
    Object? requestId = null,
    Object? statusCode = freezed,
  }) {
    return _then(ServerFailure(
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
      statusCode: freezed == statusCode
          ? _self.statusCode
          : statusCode // ignore: cast_nullable_to_non_nullable
              as int?,
    ));
  }
}

/// @nodoc

class UnexpectedFailure extends ApiFailure {
  const UnexpectedFailure(
      {required this.message,
      this.cause,
      this.stackTrace,
      this.requestId,
      this.statusCode})
      : super._();

  @override
  final String message;
  final Object? cause;
  final StackTrace? stackTrace;
  final String? requestId;
  final int? statusCode;

  /// Create a copy of ApiFailure
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $UnexpectedFailureCopyWith<UnexpectedFailure> get copyWith =>
      _$UnexpectedFailureCopyWithImpl<UnexpectedFailure>(this, _$identity);

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is UnexpectedFailure &&
            (identical(other.message, message) || other.message == message) &&
            const DeepCollectionEquality().equals(other.cause, cause) &&
            (identical(other.stackTrace, stackTrace) ||
                other.stackTrace == stackTrace) &&
            (identical(other.requestId, requestId) ||
                other.requestId == requestId) &&
            (identical(other.statusCode, statusCode) ||
                other.statusCode == statusCode));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType,
      message,
      const DeepCollectionEquality().hash(cause),
      stackTrace,
      requestId,
      statusCode);

  @override
  String toString() {
    return 'ApiFailure.unexpected(message: $message, cause: $cause, stackTrace: $stackTrace, requestId: $requestId, statusCode: $statusCode)';
  }
}

/// @nodoc
abstract mixin class $UnexpectedFailureCopyWith<$Res>
    implements $ApiFailureCopyWith<$Res> {
  factory $UnexpectedFailureCopyWith(
          UnexpectedFailure value, $Res Function(UnexpectedFailure) _then) =
      _$UnexpectedFailureCopyWithImpl;
  @override
  @useResult
  $Res call(
      {String message,
      Object? cause,
      StackTrace? stackTrace,
      String? requestId,
      int? statusCode});
}

/// @nodoc
class _$UnexpectedFailureCopyWithImpl<$Res>
    implements $UnexpectedFailureCopyWith<$Res> {
  _$UnexpectedFailureCopyWithImpl(this._self, this._then);

  final UnexpectedFailure _self;
  final $Res Function(UnexpectedFailure) _then;

  /// Create a copy of ApiFailure
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? message = null,
    Object? cause = freezed,
    Object? stackTrace = freezed,
    Object? requestId = freezed,
    Object? statusCode = freezed,
  }) {
    return _then(UnexpectedFailure(
      message: null == message
          ? _self.message
          : message // ignore: cast_nullable_to_non_nullable
              as String,
      cause: freezed == cause ? _self.cause : cause,
      stackTrace: freezed == stackTrace
          ? _self.stackTrace
          : stackTrace // ignore: cast_nullable_to_non_nullable
              as StackTrace?,
      requestId: freezed == requestId
          ? _self.requestId
          : requestId // ignore: cast_nullable_to_non_nullable
              as String?,
      statusCode: freezed == statusCode
          ? _self.statusCode
          : statusCode // ignore: cast_nullable_to_non_nullable
              as int?,
    ));
  }
}

// dart format on
