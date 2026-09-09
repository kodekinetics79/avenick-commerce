import 'dart:math';

/// A W3C Trace Context header pair, so a request from a phone joins the
/// OpenTelemetry trace the backend already emits.
///
/// Without this, a mobile request starts a NEW root trace at the edge and the
/// two halves of a slow checkout — the seconds spent on the device and the
/// seconds spent in the database — sit in two unrelated traces that nobody can
/// join. With it, the server span is a child of the span the app started, and
/// "checkout took 9 seconds" becomes answerable.
///
/// Format (W3C Trace Context, version 00):
///
///     traceparent: 00-<32 hex trace-id>-<16 hex span-id>-<2 hex flags>
///
/// The app is the ROOT of each trace it starts: it has no inbound traceparent
/// to continue, so it mints a trace id per request and a span id inside it.
/// `flags` is `01` when this trace is sampled, `00` when it is not — the
/// server's sampler is free to override, this is only the client's proposal.
class TraceContext {
  const TraceContext({
    required this.traceId,
    required this.spanId,
    required this.sampled,
  });

  /// 32 lowercase hex characters, never all zero.
  final String traceId;

  /// 16 lowercase hex characters, never all zero.
  final String spanId;

  final bool sampled;

  static const String header = 'traceparent';
  static const String stateHeader = 'tracestate';

  static final Random _random = Random.secure();

  /// Mint a new root trace.
  factory TraceContext.root({required bool sampled}) => TraceContext(
        traceId: _hex(16),
        spanId: _hex(8),
        sampled: sampled,
      );

  /// A child span of the same trace — for a retry or a refresh that should be
  /// attributed to the request that triggered it rather than to a new trace.
  TraceContext childSpan() =>
      TraceContext(traceId: traceId, spanId: _hex(8), sampled: sampled);

  String get traceparent => '00-$traceId-$spanId-${sampled ? '01' : '00'}';

  static final RegExp _syntax =
      RegExp(r'^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$');

  /// Parse an inbound header, rejecting the all-zero ids the spec forbids.
  static TraceContext? tryParse(String value) {
    final match = _syntax.firstMatch(value.trim());
    if (match == null) return null;
    final traceId = match.group(1)!;
    final spanId = match.group(2)!;
    if (traceId == '0' * 32 || spanId == '0' * 16) return null;
    final flags = int.parse(match.group(3)!, radix: 16);
    return TraceContext(
      traceId: traceId,
      spanId: spanId,
      sampled: flags & 0x01 != 0,
    );
  }

  /// [bytes] random bytes as lowercase hex. `Random.secure()` because a
  /// guessable trace id lets an outsider correlate requests they did not make.
  static String _hex(int bytes) {
    final buffer = StringBuffer();
    for (var i = 0; i < bytes; i++) {
      buffer.write(_random.nextInt(256).toRadixString(16).padLeft(2, '0'));
    }
    final value = buffer.toString();
    // The spec forbids an all-zero id. One retry is enough: the odds are 2^-128.
    return value.replaceAll('0', '').isEmpty ? _hex(bytes) : value;
  }

  @override
  String toString() => traceparent;
}
