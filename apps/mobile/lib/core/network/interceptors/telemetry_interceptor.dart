import 'dart:math';

import 'package:dio/dio.dart';

import '../trace_context.dart';

/// Stamps every outgoing request with a client request id and a W3C
/// `traceparent`, and remembers both on the request so the logger and the
/// error mapper can name them.
///
/// The two ids are different things and both are needed:
///
///  * `x-request-id` is what the SERVER echoes on its error envelope. It is
///    the id a support conversation quotes.
///  * `traceparent` is what joins this request to the OpenTelemetry trace the
///    backend already emits, so the seconds spent on the device and the
///    seconds spent in Postgres appear in ONE trace instead of two unrelated
///    ones.
///
/// The client id is a proposal: if the edge assigns its own, the server's wins
/// and comes back on the response. Sending one anyway means a request that
/// never reached the edge — the interesting case — still has an id in the
/// device log.
class TelemetryInterceptor extends Interceptor {
  TelemetryInterceptor({required this.sampleTraces, required this.userAgent});

  final bool sampleTraces;
  final String userAgent;

  static const String requestIdHeader = 'x-request-id';
  static const String traceExtraKey = 'avenick.trace';
  static const String requestIdExtraKey = 'avenick.requestId';

  static final Random _random = Random.secure();

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    // A retry or a replay keeps the trace it was born in; a fresh request gets
    // a new root. Otherwise a replayed 401 shows up as an unrelated trace and
    // the "why did this take 9 seconds" question loses its second half.
    final existing = options.extra[traceExtraKey];
    final trace = existing is TraceContext
        ? existing.childSpan()
        : TraceContext.root(sampled: sampleTraces);

    final requestId =
        options.extra[requestIdExtraKey] as String? ?? _mintRequestId();

    options.extra[traceExtraKey] = trace;
    options.extra[requestIdExtraKey] = requestId;
    options.headers[TraceContext.header] = trace.traceparent;
    options.headers[requestIdHeader] = requestId;
    options.headers['user-agent'] = userAgent;
    handler.next(options);
  }

  static String _mintRequestId() {
    final buffer = StringBuffer('m-');
    for (var i = 0; i < 12; i++) {
      buffer.write(_random.nextInt(256).toRadixString(16).padLeft(2, '0'));
    }
    return buffer.toString();
  }
}
