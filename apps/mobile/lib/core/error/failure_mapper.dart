import 'dart:io' show HttpDate, SocketException;

import 'package:dio/dio.dart';

import '../../api/models/common.dart';
import '../../api/models/enums.dart';
import '../../api/models/order_totals.dart' show ContractViolation;
import 'failures.dart';

/// The ONE place a transport error or an error envelope becomes an
/// [ApiFailure].
///
/// It is deliberately a pure function of the [DioException] so it can be unit
/// tested without a socket, and it is wired into exactly one interceptor
/// (`ErrorMappingInterceptor`) so there is no second, drifting copy of the
/// table. Adding a code to `ERROR_CODE_VALUES` on the server should break
/// exactly one `switch` here, and the analyzer will say where.
abstract final class FailureMapper {
  /// Header the API sets on every response, error or not.
  static const String requestIdHeader = 'x-request-id';

  static ApiFailure fromDioException(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      // Dio 5.9 added this: the body arrived but decoding it exceeded the
      // transform budget. It is a timeout from the caller's point of view.
      case DioExceptionType.transformTimeout:
        return ApiFailure.network(
          kind: NetworkFailureKind.timeout,
          message: 'The connection timed out. Check your signal and try again.',
          cause: error,
        );
      case DioExceptionType.connectionError:
        return ApiFailure.network(
          kind: NetworkFailureKind.offline,
          message: 'You appear to be offline.',
          cause: error,
        );
      case DioExceptionType.badCertificate:
        return ApiFailure.network(
          kind: NetworkFailureKind.badCertificate,
          message: 'The secure connection could not be verified.',
          cause: error,
        );
      case DioExceptionType.cancel:
        return ApiFailure.network(
          kind: NetworkFailureKind.cancelled,
          message: 'The request was cancelled.',
          cause: error,
        );
      case DioExceptionType.badResponse:
        return fromResponse(error.response, error);
      case DioExceptionType.unknown:
        final cause = error.error;
        if (cause is SocketException) {
          return ApiFailure.network(
            kind: NetworkFailureKind.offline,
            message: 'You appear to be offline.',
            cause: cause,
          );
        }
        if (cause is ContractViolation) {
          // The bytes parsed; the arithmetic did not. Never show the figure.
          return ApiFailure.unexpected(
            message:
                'The server sent totals that do not add up. Nothing was charged.',
            cause: cause,
            stackTrace: error.stackTrace,
            requestId: _requestIdOf(error.response),
          );
        }
        if (cause is ApiFailure) return cause;
        return ApiFailure.unexpected(
          message: 'Something went wrong.',
          cause: cause ?? error,
          stackTrace: error.stackTrace,
          requestId: _requestIdOf(error.response),
        );
    }
  }

  /// Map a response body that is (or should be) an error envelope.
  static ApiFailure fromResponse(
    Response<dynamic>? response, [
    DioException? source,
  ]) {
    final status = response?.statusCode;
    final headerRequestId = _requestIdOf(response);
    final envelope = _readEnvelope(response?.data);

    if (envelope == null) {
      // A body that is not an error envelope: an HTML error page from a proxy,
      // a truncated response, a 502 from the edge that never reached the app.
      // It is NOT guessed into a code — pretending a 404 page is `not_found`
      // would let an infrastructure fault masquerade as a business outcome.
      return ApiFailure.unexpected(
        message: status == null
            ? 'The server sent a response this app could not read.'
            : 'The server sent a $status this app could not read.',
        cause: source ?? response?.data,
        stackTrace: source?.stackTrace,
        requestId: headerRequestId,
        statusCode: status,
      );
    }

    return fromApiError(
      envelope,
      statusCode: status,
      retryAfter: _retryAfterOf(response),
    );
  }

  /// The table. Nine codes in, six failures out — see [ApiFailure] for why
  /// `not_found`, `conflict` and `payment_required` land on [ServerFailure]
  /// with their code intact rather than on a variant of their own.
  static ApiFailure fromApiError(
    ApiError error, {
    int? statusCode,
    Duration? retryAfter,
  }) {
    switch (error.code) {
      case ApiErrorCode.unauthenticated:
        return ApiFailure.auth(
          code: error.code,
          message: error.message,
          // The credential is missing or expired. Refreshing, or signing in,
          // is a route out of this.
          requiresReauth: true,
          requestId: error.requestId,
        );
      case ApiErrorCode.forbidden:
        return ApiFailure.auth(
          code: error.code,
          message: error.message,
          // A valid credential that is not permitted. Signing in again would
          // land in exactly the same place, so do not send them there.
          requiresReauth: false,
          requestId: error.requestId,
        );
      case ApiErrorCode.validationFailed:
        return ApiFailure.validation(
          message: error.message,
          fieldErrors: error.fieldErrors ?? const <String, List<String>>{},
          requestId: error.requestId,
        );
      case ApiErrorCode.rateLimited:
        return ApiFailure.rateLimit(
          message: error.message,
          retryAfter: retryAfter,
          requestId: error.requestId,
        );
      case ApiErrorCode.notFound:
      case ApiErrorCode.conflict:
      case ApiErrorCode.paymentRequired:
      case ApiErrorCode.upstreamUnavailable:
      case ApiErrorCode.internal:
        return ApiFailure.server(
          code: error.code,
          message: error.message,
          requestId: error.requestId,
          statusCode: statusCode,
        );
    }
  }

  /// Wrap anything thrown while turning a 2xx body into a model.
  ///
  /// A [ContractViolation] is the interesting case: the response was a 200
  /// whose arithmetic the contract forbids. It becomes an [UnexpectedFailure]
  /// carrying the violation and the request id, so the number is never shown
  /// and the server log line can be found.
  static ApiFailure fromDecodeError(
    Object error,
    StackTrace stackTrace, {
    Response<dynamic>? response,
  }) {
    if (error is ApiFailure) return error;
    if (error is ContractViolation) {
      return ApiFailure.unexpected(
        message: 'The server sent figures that do not add up.',
        cause: error,
        stackTrace: stackTrace,
        requestId: _requestIdOf(response),
        statusCode: response?.statusCode,
      );
    }
    return ApiFailure.unexpected(
      message: 'The server sent a response this app could not read.',
      cause: error,
      stackTrace: stackTrace,
      requestId: _requestIdOf(response),
      statusCode: response?.statusCode,
    );
  }

  static ApiError? _readEnvelope(Object? data) {
    final map = _asJsonMap(data);
    if (map == null) return null;
    final error = map['error'];
    if (error is! Map) return null;
    final asMap = <String, dynamic>{
      for (final entry in error.entries) '${entry.key}': entry.value,
    };
    // An unknown code is not an envelope this client understands. Falling back
    // to `internal` would be a guess that reads as a server fault.
    if (ApiErrorCode.tryParse(asMap['code'] as String?) == null) return null;
    if (asMap['message'] is! String || asMap['requestId'] is! String) {
      return null;
    }
    try {
      return ApiError.fromJson(asMap);
    } on Object {
      return null;
    }
  }

  static Map<String, dynamic>? _asJsonMap(Object? data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) {
      return <String, dynamic>{
        for (final e in data.entries) '${e.key}': e.value,
      };
    }
    return null;
  }

  static String? _requestIdOf(Response<dynamic>? response) =>
      response?.headers.value(requestIdHeader);

  /// `Retry-After` as RFC 9110 defines it: either delta-seconds or an
  /// HTTP-date. Both spellings are accepted; anything else yields null rather
  /// than a fabricated backoff.
  static Duration? _retryAfterOf(Response<dynamic>? response) {
    final raw = response?.headers.value('retry-after');
    if (raw == null) return null;
    final seconds = int.tryParse(raw.trim());
    if (seconds != null) return Duration(seconds: seconds < 0 ? 0 : seconds);
    try {
      final until = HttpDate.parse(raw.trim());
      final delta = until.difference(DateTime.now().toUtc());
      return delta.isNegative ? Duration.zero : delta;
    } on Object {
      return null;
    }
  }
}
