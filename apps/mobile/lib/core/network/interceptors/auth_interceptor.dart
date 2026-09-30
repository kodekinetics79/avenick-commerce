import 'package:dio/dio.dart';

import '../../../api/models/enums.dart';
import '../../error/failure_mapper.dart';
import '../../error/failures.dart';
import '../../storage/auth_session.dart';

/// Attaches the bearer token, and turns a 401 into exactly one refresh.
///
/// ═══════════════════════════════════════════════════════════════════════════
/// THE BACKEND DOES NOT SUPPORT THIS YET. `/api/v1` authenticates with the
/// NextAuth session COOKIE today; it does not read `Authorization: Bearer`,
/// and `/v1/auth/refresh` is not implemented. See the header of
/// `lib/core/storage/auth_session.dart`. This is written to the contract so
/// the app is ready the day the endpoints land.
/// ═══════════════════════════════════════════════════════════════════════════
///
/// WHY [QueuedInterceptor]. A plain [Interceptor] handles errors concurrently:
/// ten requests that 401 together enter `onError` together, and ten refreshes
/// race. `QueuedInterceptor` serialises the callbacks, so the second 401 is
/// not even looked at until the first has finished being handled — by which
/// time the token has been rotated and the second one does not need a refresh
/// at all.
///
/// Serialisation alone is not enough, though: it would produce ten SEQUENTIAL
/// refreshes rather than ten parallel ones. The second guard is
/// [_tokenUsedExtraKey] — each request records the access token it actually
/// went out with, and on a 401 the interceptor compares that against the token
/// the session holds NOW. If they differ, somebody else already refreshed and
/// this request simply replays with the new one. Together the two give exactly
/// one refresh for any number of simultaneous 401s, which is what
/// `test/api/auth_refresh_test.dart` asserts.
class AuthInterceptor extends QueuedInterceptor {
  AuthInterceptor({required this.session, required Dio replayClient})
      : _replayClient = replayClient;

  final AuthSession session;

  /// A Dio WITHOUT this interceptor, used to replay a request after a refresh.
  ///
  /// Replaying through the main client would re-enter this queue from inside
  /// the queue's own callback and deadlock: the replay's `onRequest` would sit
  /// behind the `onError` that is waiting for it.
  final Dio _replayClient;

  /// Set on a request to say "do not attach a token" — the auth endpoints
  /// themselves, which authenticate with a body rather than a header.
  static const String skipAuthExtraKey = 'avenick.skipAuth';

  /// The access token this request actually went out with.
  static const String _tokenUsedExtraKey = 'avenick.tokenUsed';

  /// Set once a request has been replayed, so a 401 on the replay is final
  /// rather than the start of an infinite refresh loop.
  static const String _retriedExtraKey = 'avenick.authRetried';

  static bool _skipsAuth(RequestOptions options) =>
      options.extra[skipAuthExtraKey] == true;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (_skipsAuth(options)) {
      handler.next(options);
      return;
    }
    final token = session.accessToken;
    if (token != null) {
      options.headers['authorization'] = 'Bearer $token';
      options.extra[_tokenUsedExtraKey] = token;
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final options = err.requestOptions;

    if (!_shouldAttemptRefresh(err)) {
      handler.next(err);
      return;
    }

    // Somebody refreshed while this request was in the air or waiting in the
    // queue. No second refresh: just replay with what the session holds now.
    final tokenUsed = options.extra[_tokenUsedExtraKey] as String?;
    final current = session.accessToken;
    if (current != null && current != tokenUsed) {
      await _replay(options, current, handler, err);
      return;
    }

    try {
      final pair = await session.refresh();
      await _replay(options, pair.accessToken, handler, err);
    } on ApiFailure catch (failure) {
      // The refresh failed. `AuthSession` has already cleared the keystore and
      // emitted `SignedOut` if the server refused it, so the app's listener is
      // what navigates — this interceptor does not touch navigation.
      //
      // The ORIGINAL request's failure is what the caller gets, not the
      // refresh's: a screen asked for the cart, and "the cart needs you to
      // sign in" is the truthful answer.
      handler.next(err.copyWith(error: _signInRequired(err, failure)));
    } on Object catch (error, stackTrace) {
      handler.next(
        err.copyWith(
          error: FailureMapper.fromDecodeError(
            error,
            stackTrace,
            response: err.response,
          ),
        ),
      );
    }
  }

  /// Only an `unauthenticated` CODE earns a refresh — never a bare 401 status.
  ///
  /// `forbidden` also arrives with a credential attached and would look like an
  /// auth problem to a status-based check, but refreshing cannot help: the
  /// token is valid and simply not allowed to do this. Refreshing on a 403
  /// spends a round trip to arrive at the same 403, and on a rotating-refresh
  /// server it burns a refresh token per attempt.
  bool _shouldAttemptRefresh(DioException err) {
    final options = err.requestOptions;
    if (_skipsAuth(options)) return false;
    if (options.extra[_retriedExtraKey] == true) return false;
    if (err.response?.statusCode != 401) return false;

    final failure = err.error;
    if (failure is AuthFailure) return failure.requiresReauth;

    // The mapper has not run yet at this point in the chain, so read the
    // envelope directly. A 401 whose body is NOT a recognisable
    // `unauthenticated` envelope is not refreshed: an HTML 401 from a proxy is
    // an infrastructure problem, not an expired token.
    final mapped = FailureMapper.fromResponse(err.response, err);
    return mapped is AuthFailure && mapped.code == ApiErrorCode.unauthenticated;
  }

  Future<void> _replay(
    RequestOptions options,
    String accessToken,
    ErrorInterceptorHandler handler,
    DioException original,
  ) async {
    final replayed = options.copyWith()
      ..headers['authorization'] = 'Bearer $accessToken'
      ..extra[_retriedExtraKey] = true
      ..extra[_tokenUsedExtraKey] = accessToken;

    try {
      final response = await _replayClient.fetch<dynamic>(replayed);
      handler.resolve(response);
    } on DioException catch (error) {
      handler.next(error);
    } on Object catch (error, stackTrace) {
      handler.next(
        original.copyWith(
          error: FailureMapper.fromDecodeError(
            error,
            stackTrace,
            response: original.response,
          ),
        ),
      );
    }
  }

  ApiFailure _signInRequired(DioException original, ApiFailure refreshFailure) {
    // A refresh that failed because the phone is offline is NOT a sign-out,
    // and must not be reported as one: the session is intact, the network is
    // not.
    if (refreshFailure is NetworkFailure) return refreshFailure;
    final mapped = FailureMapper.fromResponse(original.response, original);
    if (mapped is AuthFailure) return mapped;
    return const ApiFailure.auth(
      code: ApiErrorCode.unauthenticated,
      message: 'Your session has expired. Sign in to continue.',
      requiresReauth: true,
    );
  }
}
