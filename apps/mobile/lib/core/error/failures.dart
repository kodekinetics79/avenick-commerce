import 'package:freezed_annotation/freezed_annotation.dart';

import '../../api/models/enums.dart';

part 'failures.freezed.dart';

/// How a request failed before any server got to answer.
enum NetworkFailureKind {
  /// No usable route to the host: airplane mode, no signal, DNS, a captive
  /// portal. Retrying immediately will fail the same way; retrying when
  /// connectivity returns will not.
  offline,

  /// A connection, send or receive timeout. The request MAY have been applied
  /// server-side — a timeout is not a rollback — so a non-idempotent call must
  /// not be blindly retried.
  timeout,

  /// The socket failed mid-flight.
  connectionError,

  /// TLS could not be established or the certificate was rejected. On a
  /// consumer network this is usually interception, so it is NOT folded into
  /// `offline`: it deserves a different message.
  badCertificate,

  /// The caller cancelled. Not an error to show anyone.
  cancelled,
}

/// EVERY failure this app's API layer produces, as one sealed family.
///
/// The whole point is that it is sealed and mapped in ONE place
/// (`FailureMapper`, wired into a single Dio interceptor). A screen that
/// switches on this gets exhaustiveness from the compiler, and a new server
/// error code cannot quietly reach a `catch (e)` that renders
/// `e.toString()` — which is how a stack trace, a SQL fragment or a
/// connection string ends up on a phone.
///
/// MAPPING IS FROM `ApiError.code`, NOT FROM THE HTTP STATUS. The status is
/// carried for logs, but it is never the thing branched on: the same 400 is a
/// field-level validation failure and a malformed cursor, and the same 409 is
/// a stock conflict and an idempotent replay disagreeing. `code` distinguishes
/// them; the status does not.
///
/// WHY NINE CODES MAP ONTO SIX FAILURES. `not_found`, `conflict` and
/// `payment_required` are business outcomes rather than faults, and they have
/// no dedicated variant here. Rather than invent one and diverge from the
/// agreed family — or, worse, flatten them into `UnexpectedFailure` and lose
/// them — they land on [ServerFailure], which carries the original
/// [ApiErrorCode] verbatim plus [ServerFailure.isNotFound],
/// [ServerFailure.isConflict] and [ServerFailure.isPaymentRequired] so a
/// caller can branch precisely. Nothing from the wire is discarded.
@freezed
sealed class ApiFailure with _$ApiFailure implements Exception {
  const ApiFailure._();

  /// The request never reached a server, or its answer never came back.
  const factory ApiFailure.network({
    required NetworkFailureKind kind,
    required String message,
    Object? cause,
  }) = NetworkFailure;

  /// `unauthenticated` or `forbidden`.
  ///
  /// [requiresReauth] is the difference that matters and it comes from the
  /// code, never from the status: `unauthenticated` means the credential is
  /// missing or expired, so refreshing or signing in fixes it; `forbidden`
  /// means a valid credential that is not allowed to do this, and signing in
  /// again will fail in exactly the same way. Bouncing a `forbidden` to the
  /// login screen is an infinite loop the user cannot escape.
  const factory ApiFailure.auth({
    required ApiErrorCode code,
    required String message,
    required bool requiresReauth,
    String? requestId,
  }) = AuthFailure;

  /// `validation_failed`, with per-field detail.
  const factory ApiFailure.validation({
    required String message,

    /// Keyed by the dotted path into the request body, exactly as the server
    /// built it from Zod: `items.2.quantity`, `shippingAddress.country`. Each
    /// path carries one or more messages, because Zod reports several issues
    /// on one field routinely.
    ///
    /// Never empty when present: the server omits the map entirely rather than
    /// sending `{}` as a claim that nothing is wrong.
    required Map<String, List<String>> fieldErrors,
    String? requestId,
  }) = ValidationFailure;

  /// `rate_limited`. [retryAfter] comes from the `Retry-After` header.
  const factory ApiFailure.rateLimit({
    required String message,

    /// Null when the server sent no `Retry-After`. Do NOT substitute a guess:
    /// a client-invented backoff is how a throttled app turns into a
    /// synchronised thundering herd.
    Duration? retryAfter,
    String? requestId,
  }) = RateLimitFailure;

  /// A well-formed error envelope that is neither auth, validation nor a rate
  /// limit: `internal`, `upstream_unavailable`, `not_found`, `conflict`,
  /// `payment_required`.
  const factory ApiFailure.server({
    required ApiErrorCode code,
    required String message,

    /// The server-assigned id for this exact request. This is the field that
    /// makes a user-visible error traceable to a server log line, so it is
    /// required here — a support conversation that starts with "it failed" and
    /// cannot name the request has no evidence in it.
    required String requestId,
    int? statusCode,
  }) = ServerFailure;

  /// Anything the contract does not describe: a body that is not an error
  /// envelope, HTML from a proxy, a response that parses but violates an
  /// invariant (see `ContractViolation`), a bug in this client.
  ///
  /// It carries [requestId] when one was recoverable from the response
  /// headers, because a malformed answer is exactly when a trace is most
  /// wanted and least available.
  const factory ApiFailure.unexpected({
    required String message,
    Object? cause,
    StackTrace? stackTrace,
    String? requestId,
    int? statusCode,
  }) = UnexpectedFailure;

  /// The request id, wherever this variant happens to keep one.
  String? get traceId => switch (this) {
        AuthFailure(:final requestId) => requestId,
        ValidationFailure(:final requestId) => requestId,
        RateLimitFailure(:final requestId) => requestId,
        ServerFailure(:final requestId) => requestId,
        UnexpectedFailure(:final requestId) => requestId,
        NetworkFailure() => null,
      };

  /// Safe to show a user as-is. Every variant carries a message the server
  /// marked human-readable, or one this client wrote.
  String get displayMessage => switch (this) {
        NetworkFailure(:final message) => message,
        AuthFailure(:final message) => message,
        ValidationFailure(:final message) => message,
        RateLimitFailure(:final message) => message,
        ServerFailure(:final message) => message,
        UnexpectedFailure(:final message) => message,
      };

  /// Whether trying the same request again could plausibly succeed.
  ///
  /// Note that "retryable" is not "safe to retry automatically": a timeout on
  /// a POST may have been applied. Callers must still respect idempotency.
  bool get isRetryable => switch (this) {
        NetworkFailure(:final kind) => kind != NetworkFailureKind.cancelled,
        RateLimitFailure() => true,
        ServerFailure(:final code) => code == ApiErrorCode.internal ||
            code == ApiErrorCode.upstreamUnavailable,
        AuthFailure() => false,
        ValidationFailure() => false,
        UnexpectedFailure() => false,
      };
}

extension ServerFailureCodes on ServerFailure {
  bool get isNotFound => code == ApiErrorCode.notFound;
  bool get isConflict => code == ApiErrorCode.conflict;
  bool get isPaymentRequired => code == ApiErrorCode.paymentRequired;
  bool get isUpstreamUnavailable => code == ApiErrorCode.upstreamUnavailable;
  bool get isInternal => code == ApiErrorCode.internal;
}

extension ValidationFailureLookup on ValidationFailure {
  /// Messages for one dotted path, e.g. `items.2.quantity`.
  List<String> messagesFor(String path) =>
      fieldErrors[path] ?? const <String>[];

  /// Messages for a whole line of a repeated field: `messagesForIndex('items', 2)`
  /// returns everything under `items.2.`.
  Map<String, List<String>> messagesForIndex(String field, int index) {
    final prefix = '$field.$index.';
    return <String, List<String>>{
      for (final entry in fieldErrors.entries)
        if (entry.key.startsWith(prefix))
          entry.key.substring(prefix.length): entry.value,
    };
  }

  /// The first message, for a single-line banner.
  String? get firstMessage {
    for (final messages in fieldErrors.values) {
      if (messages.isNotEmpty) return messages.first;
    }
    return null;
  }
}
