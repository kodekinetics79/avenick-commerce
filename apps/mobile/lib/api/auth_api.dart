import 'package:dio/dio.dart';

import '../core/error/failure_mapper.dart';
import '../core/error/failures.dart';
import '../core/network/interceptors/auth_interceptor.dart';
import '../core/storage/auth_session.dart';
import 'models/auth.dart';
import 'models/requests.dart';

/// ═══════════════════════════════════════════════════════════════════════════
/// NONE OF THESE ENDPOINTS EXIST ON THE SERVER YET.
///
/// `/v1/auth/token`, `/refresh`, `/revoke`, `/otp/request` and `/otp/verify`
/// are specified in `packages/contracts/openapi.json` and implemented nowhere.
/// At the time of writing:
///
///   * there is NO refresh-token table in `schema.prisma`, so nothing can
///     issue, store, rotate or revoke a refresh token;
///   * there is NO OTP model — no challenge row, no code, no SMS provider;
///   * `/api/v1` authenticates with the NextAuth session COOKIE. It does not
///     read `Authorization: Bearer` at all, and the only route implemented
///     under `app/api/v1/` today is `checkout/`.
///
/// Every call in this file will therefore fail — `not_found` at best — until
/// the backend lands. It is written now, against the contract, so that day is
/// a wiring change rather than a rewrite. Do NOT read a passing analyze or a
/// green test suite as evidence that sign-in works: the tests exercise this
/// client against a fake adapter, which is exactly what they claim to do and
/// no more.
/// ═══════════════════════════════════════════════════════════════════════════
///
/// This client sits on the UNAUTHENTICATED Dio on purpose. Its calls carry
/// their credential in the body, not in a header, and a `/refresh` that went
/// through the auth interceptor would try to refresh itself when it failed.
class AuthApi implements TokenRefresher {
  AuthApi(this._dio);

  final Dio _dio;

  static const String tokenPath = '/v1/auth/token';
  static const String refreshPath = '/v1/auth/refresh';
  static const String revokePath = '/v1/auth/revoke';
  static const String otpRequestPath = '/v1/auth/otp/request';
  static const String otpVerifyPath = '/v1/auth/otp/verify';

  /// `POST /v1/auth/token` — email and password for a token pair.
  Future<TokenPair> signIn(PasswordGrantRequest request) =>
      _post(tokenPath, request.toJson(), TokenPair.fromJson);

  /// `POST /v1/auth/refresh`.
  ///
  /// Call this through [AuthSession.refresh], never directly: the session is
  /// what guarantees a single in-flight refresh, and calling here bypasses it.
  /// It is public only because the session needs it.
  @override
  Future<TokenPair> refresh({
    required String refreshToken,
    required String deviceId,
  }) =>
      _post(
        refreshPath,
        RefreshRequest(refreshToken: refreshToken, deviceId: deviceId).toJson(),
        TokenPair.fromJson,
      );

  /// `POST /v1/auth/revoke` — end this session, or all of them.
  Future<Revocation> revoke(RevokeRequest request) =>
      _post(revokePath, request.toJson(), Revocation.fromJson);

  /// `POST /v1/auth/otp/request` — send a code to a phone.
  Future<OtpChallenge> requestOtp(OtpRequest request) =>
      _post(otpRequestPath, request.toJson(), OtpChallenge.fromJson);

  /// `POST /v1/auth/otp/verify` — exchange a code for a token pair.
  Future<TokenPair> verifyOtp(OtpVerifyRequest request) =>
      _post(otpVerifyPath, request.toJson(), TokenPair.fromJson);

  /// The auth calls do not go through [ApiClient] because they must never
  /// acquire a bearer header, and because a refresh has to be callable from
  /// inside the interceptor that would otherwise add one.
  Future<T> _post<T>(
    String path,
    Map<String, Object?> body,
    T Function(Map<String, dynamic> json) decoder,
  ) async {
    Response<dynamic>? response;
    try {
      response = await _dio.post<dynamic>(
        path,
        data: body,
        options: Options(
          extra: <String, dynamic>{AuthInterceptor.skipAuthExtraKey: true},
        ),
      );
      final envelope = response.data;
      if (envelope is! Map) {
        throw FormatException(
          'Expected an envelope object, got ${envelope.runtimeType}',
        );
      }
      final data = envelope['data'];
      if (data is! Map) {
        throw FormatException(
          'Expected "data" to be an object, got ${data.runtimeType}',
        );
      }
      return decoder(<String, dynamic>{
        for (final entry in data.entries) '${entry.key}': entry.value,
      });
    } on DioException catch (error) {
      final mapped = error.error;
      throw mapped is ApiFailure
          ? mapped
          : FailureMapper.fromDioException(error);
    } on ApiFailure {
      rethrow;
    } on Object catch (error, stackTrace) {
      throw FailureMapper.fromDecodeError(
        error,
        stackTrace,
        response: response,
      );
    }
  }
}
