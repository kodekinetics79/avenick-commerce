import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:avenick/core/storage/secure_token_store.dart';
import 'package:dio/dio.dart';

/// A [HttpClientAdapter] that answers from a handler function.
///
/// This is what lets `test/api` exercise the REAL interceptor chain — the real
/// auth interceptor, the real queue, the real error mapper — without a socket
/// and without a server. Mocking one layer up (stubbing `Dio.get`) would test
/// the endpoint clients and skip everything interesting; the single-flight
/// refresh lives entirely in the chain.
class FakeAdapter implements HttpClientAdapter {
  FakeAdapter(this.handler);

  /// Called for every request. Return a [FakeResponse] to answer it.
  final FutureOr<FakeResponse> Function(RequestOptions options) handler;

  /// Every request that reached the transport, in order. The single-flight
  /// assertions count entries here.
  final List<RequestOptions> requests = <RequestOptions>[];

  int countWherePath(String path) =>
      requests.where((r) => r.path == path).length;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final answer = await handler(options);
    if (answer.delay > Duration.zero) {
      await Future<void>.delayed(answer.delay);
    }
    return ResponseBody.fromString(
      jsonEncode(answer.body),
      answer.statusCode,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>[Headers.jsonContentType],
        for (final entry in answer.headers.entries)
          entry.key: <String>[entry.value],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

class FakeResponse {
  const FakeResponse(
    this.statusCode,
    this.body, {
    this.headers = const <String, String>{},
    this.delay = Duration.zero,
  });

  /// `{ data: … }` — the success envelope.
  factory FakeResponse.data(
    Object? data, {
    int statusCode = 200,
    String requestId = 'req_fake',
  }) =>
      FakeResponse(
        statusCode,
        <String, dynamic>{'data': data},
        headers: <String, String>{'x-request-id': requestId},
      );

  /// `{ data: [...], meta: {...} }` — the paginated envelope.
  factory FakeResponse.page(
    List<Object?> data, {
    String? cursor,
    bool hasMore = false,
    String requestId = 'req_fake',
  }) =>
      FakeResponse(
        200,
        <String, dynamic>{
          'data': data,
          'meta': <String, dynamic>{'cursor': cursor, 'hasMore': hasMore},
        },
        headers: <String, String>{'x-request-id': requestId},
      );

  /// `{ error: {...} }` — the failure envelope.
  factory FakeResponse.error(
    int statusCode,
    String code, {
    String message = 'Something went wrong.',
    String requestId = 'req_fake',
    Map<String, dynamic>? fieldErrors,
    Map<String, String> headers = const <String, String>{},
  }) =>
      FakeResponse(
        statusCode,
        <String, dynamic>{
          'error': <String, dynamic>{
            'code': code,
            'message': message,
            'requestId': requestId,
            if (fieldErrors != null) 'fieldErrors': fieldErrors,
          },
        },
        headers: <String, String>{'x-request-id': requestId, ...headers},
      );

  final int statusCode;
  final Object? body;
  final Map<String, String> headers;

  /// Held open for this long before answering — used to overlap requests so
  /// the single-flight test has something to be concurrent about.
  final Duration delay;
}

/// A [TokenStore] that lives in a map.
///
/// The real [SecureTokenStore] talks to the Keychain over a platform channel,
/// which a plain `flutter test` run does not have. Everything else in the auth
/// stack — the session, the interceptor, the queue — is the production code.
class InMemoryTokenStore implements TokenStore {
  InMemoryTokenStore({String? refreshToken, String? deviceId})
      : _refreshToken = refreshToken,
        _deviceId = deviceId;

  String? _refreshToken;
  String? _deviceId;

  /// Every write, so a test can assert that a failed refresh actually cleared
  /// the token rather than merely reporting that it had.
  final List<String?> writes = <String?>[];
  int clearSessionCalls = 0;

  @override
  Future<String?> readRefreshToken() async => _refreshToken;

  @override
  Future<void> writeRefreshToken(String token) async {
    _refreshToken = token;
    writes.add(token);
  }

  @override
  Future<String?> readDeviceId() async => _deviceId;

  @override
  Future<void> writeDeviceId(String deviceId) async => _deviceId = deviceId;

  @override
  Future<void> clearSession() async {
    _refreshToken = null;
    clearSessionCalls += 1;
    writes.add(null);
  }

  @override
  Future<void> clearAll() async {
    await clearSession();
    _deviceId = null;
  }
}
