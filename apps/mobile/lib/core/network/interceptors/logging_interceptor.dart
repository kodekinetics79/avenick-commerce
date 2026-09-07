import 'dart:developer' as developer;

import 'package:dio/dio.dart';

import 'telemetry_interceptor.dart';

/// Request/response logging that CANNOT leak a credential.
///
/// The redaction is not a courtesy. A logged `Authorization` header is a
/// bearer token in the device console, in a crash report, in a screenshot of a
/// developer's terminal, and — on Android — in `logcat`, which any app with
/// `READ_LOGS` can read on a rooted handset. The same goes for the refresh
/// token in a `/refresh` body and the OTP code in a `/verify` body.
///
/// So this logger works from an ALLOW-list of headers and a DENY-list of body
/// keys, rather than logging everything and trying to remember to strip the
/// dangerous parts. A header nobody has vetted is redacted by default: the
/// failure mode of forgetting to add a header to the allow-list is a less
/// useful log line, and the failure mode of forgetting to add one to a
/// deny-list is a leaked credential.
///
/// Bodies are NOT logged at all beyond their size. A cart body carries the
/// catalogue; a `/me` response carries a name, an email and a phone number.
/// None of that belongs in a log to save a developer one breakpoint.
class LoggingInterceptor extends Interceptor {
  LoggingInterceptor({this.enabled = true, this.log = _defaultLog});

  final bool enabled;
  final void Function(String message) log;

  /// The only headers ever printed verbatim. Everything else — `authorization`,
  /// `cookie`, `set-cookie`, anything a future edge adds — is redacted without
  /// anyone having to think of it first.
  static const Set<String> safeHeaders = <String>{
    'content-type',
    'content-length',
    'accept',
    'accept-language',
    'user-agent',
    'x-request-id',
    'traceparent',
    'retry-after',
    'date',
    'cache-control',
    'etag',
  };

  static void _defaultLog(String message) =>
      developer.log(message, name: 'avenick.http');

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (enabled) {
      log('→ ${options.method} ${options.uri.path}${_query(options)} '
          '${_headers(options.headers)}');
    }
    handler.next(options);
  }

  @override
  void onResponse(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) {
    if (enabled) {
      log('← ${response.statusCode} ${response.requestOptions.method} '
          '${response.requestOptions.uri.path} '
          'req=${_requestIdOf(response.requestOptions)}');
    }
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (enabled) {
      log('✗ ${err.type.name} ${err.response?.statusCode ?? '-'} '
          '${err.requestOptions.method} ${err.requestOptions.uri.path} '
          'req=${_requestIdOf(err.requestOptions)} '
          'serverReq=${err.response?.headers.value('x-request-id') ?? '-'}');
    }
    handler.next(err);
  }

  /// Query strings are logged with their VALUES stripped. `?search=` can carry
  /// whatever the buyer typed, and a `?cursor=` is long and useless in a log.
  String _query(RequestOptions options) {
    final keys = options.uri.queryParameters.keys.toList()..sort();
    return keys.isEmpty ? '' : '?${keys.join('&')}';
  }

  String _headers(Map<String, dynamic> headers) {
    final rendered = <String>[];
    final names = headers.keys.map((k) => k.toLowerCase()).toList()..sort();
    for (final name in names) {
      if (safeHeaders.contains(name)) {
        final value = headers.entries
            .firstWhere((e) => e.key.toLowerCase() == name)
            .value;
        rendered.add('$name=$value');
      } else {
        rendered.add('$name=<redacted>');
      }
    }
    return '[${rendered.join(' ')}]';
  }

  String _requestIdOf(RequestOptions options) =>
      options.extra[TelemetryInterceptor.requestIdExtraKey] as String? ?? '-';
}
