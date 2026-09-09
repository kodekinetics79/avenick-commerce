import 'package:dio/dio.dart';

import '../../api/models/common.dart';
import '../error/failure_mapper.dart';
import '../error/failures.dart';
import '../storage/auth_session.dart';
import '../storage/secure_token_store.dart';
import 'api_config.dart';
import 'interceptors/auth_interceptor.dart';
import 'interceptors/error_mapping_interceptor.dart';
import 'interceptors/logging_interceptor.dart';
import 'interceptors/telemetry_interceptor.dart';
import 'page.dart';

/// Decodes one `data` payload into a model.
typedef JsonDecoderFn<T> = T Function(Map<String, dynamic> json);

/// The transport every endpoint client sits on.
///
/// It owns three things and nothing else: the envelope, the failure boundary,
/// and the query-string encoding. Endpoint clients above it deal only in
/// models and [ApiFailure]; nothing above this file imports `package:dio`.
///
/// THE ENVELOPE. Every `/v1` success is `{ data, meta? }` and every failure is
/// `{ error: { code, message, requestId, fieldErrors? } }`. Unwrapping happens
/// here, once. The alternative — each client reaching for `response.data`
/// itself — is exactly how the existing `/api/products` grew three different
/// success shapes.
///
/// THE FAILURE BOUNDARY. Every method either returns a model or throws an
/// [ApiFailure]. Never a `DioException`, never a `TypeError` from a cast,
/// never a raw `FormatException`. A `catch (e)` in a widget that renders
/// `e.toString()` is how a stack trace reaches a phone screen; there is
/// nothing here that could put one there.
class ApiClient {
  ApiClient({
    required this.config,
    required Dio dio,
    required Dio unauthenticatedDio,
    required this.session,
  })  : _dio = dio,
        _unauthenticatedDio = unauthenticatedDio;

  final ApiConfig config;
  final AuthSession session;
  final Dio _dio;

  /// A client with no auth interceptor, for the auth endpoints themselves and
  /// for replaying a request after a refresh.
  final Dio _unauthenticatedDio;

  Dio get raw => _dio;
  Dio get unauthenticated => _unauthenticatedDio;

  /// Build the whole stack: two Dio instances, the session, and the wiring
  /// between them.
  ///
  /// The order of the interceptor list is load-bearing. Dio walks it forwards
  /// for requests AND forwards for errors, so:
  ///
  ///   1. [TelemetryInterceptor] first — everything downstream, including the
  ///      logger, needs the request id and traceparent to exist.
  ///   2. [AuthInterceptor] next — it must see the RAW `DioException` to
  ///      decide whether a 401 is worth a refresh. Putting the mapper before
  ///      it would hand it an `ApiFailure` and a rewritten status.
  ///   3. [LoggingInterceptor] — after auth, so a replayed request is logged
  ///      as the retry it is.
  ///   4. [ErrorMappingInterceptor] LAST — it is the boundary. Nothing after
  ///      it should exist.
  ///
  /// [refresherFactory] closes the loop between the session and the auth
  /// endpoints: the session needs something that can call `/v1/auth/refresh`,
  /// and that call must go out on the client WITHOUT the auth interceptor, or
  /// a failing refresh would try to refresh itself.
  factory ApiClient.build({
    required ApiConfig config,
    required TokenStore store,
    required TokenRefresher Function(Dio unauthenticatedDio) refresherFactory,
    HttpClientAdapter? adapter,
    void Function(String message)? log,
  }) {
    BaseOptions options() => BaseOptions(
          baseUrl: config.apiBaseUrl,
          connectTimeout: config.connectTimeout,
          sendTimeout: config.sendTimeout,
          receiveTimeout: config.receiveTimeout,
          contentType: Headers.jsonContentType,
          responseType: ResponseType.json,
          headers: <String, dynamic>{'accept': Headers.jsonContentType},
          // Non-2xx must reach the interceptor chain as a DioException rather
          // than as a Response the caller has to inspect. That is what makes
          // "every failure is an ApiFailure" true.
          validateStatus: (status) =>
              status != null && status >= 200 && status < 300,
        );

    final unauthenticatedDio = Dio(options());
    final authenticatedDio = Dio(options());
    if (adapter != null) {
      unauthenticatedDio.httpClientAdapter = adapter;
      authenticatedDio.httpClientAdapter = adapter;
    }

    LoggingInterceptor logger() => LoggingInterceptor(
          enabled: config.enableRequestLogging,
          log: log ?? LoggingInterceptor(enabled: false).log,
        );

    final telemetry = TelemetryInterceptor(
      sampleTraces: config.sampleTraces,
      userAgent: config.userAgent,
    );

    unauthenticatedDio.interceptors.addAll(<Interceptor>[
      telemetry,
      logger(),
      const ErrorMappingInterceptor(),
    ]);

    final session = AuthSession(
      store: store,
      refresher: refresherFactory(unauthenticatedDio),
    );

    authenticatedDio.interceptors.addAll(<Interceptor>[
      telemetry,
      AuthInterceptor(session: session, replayClient: unauthenticatedDio),
      logger(),
      const ErrorMappingInterceptor(),
    ]);

    return ApiClient(
      config: config,
      dio: authenticatedDio,
      unauthenticatedDio: unauthenticatedDio,
      session: session,
    );
  }

  // ── Verbs ────────────────────────────────────────────────────────────────

  Future<T> get<T>(
    String path, {
    required JsonDecoderFn<T> decoder,
    Map<String, Object?>? query,
    bool skipAuth = false,
    CancelToken? cancelToken,
  }) =>
      _send<T>(
        'GET',
        path,
        decoder: decoder,
        query: query,
        skipAuth: skipAuth,
        cancelToken: cancelToken,
      );

  /// [headers] are per-request additions to what the interceptors already set.
  ///
  /// It exists for `Idempotency-Key` on `POST /v1/orders`, which is the one
  /// header on this surface that is part of the REQUEST'S MEANING rather than
  /// of the transport: it is what makes a retry of a placement return the
  /// original order instead of writing a second one. A header like that cannot
  /// live in an interceptor, because the interceptor does not know which
  /// submission this is a retry of.
  Future<T> post<T>(
    String path, {
    required JsonDecoderFn<T> decoder,
    Object? body,
    Map<String, Object?>? query,
    Map<String, String>? headers,
    bool skipAuth = false,
    CancelToken? cancelToken,
  }) =>
      _send<T>(
        'POST',
        path,
        decoder: decoder,
        body: body,
        query: query,
        headers: headers,
        skipAuth: skipAuth,
        cancelToken: cancelToken,
      );

  Future<T> patch<T>(
    String path, {
    required JsonDecoderFn<T> decoder,
    Object? body,
    bool skipAuth = false,
    CancelToken? cancelToken,
  }) =>
      _send<T>(
        'PATCH',
        path,
        decoder: decoder,
        body: body,
        skipAuth: skipAuth,
        cancelToken: cancelToken,
      );

  Future<T> delete<T>(
    String path, {
    required JsonDecoderFn<T> decoder,
    Object? body,
    Map<String, Object?>? query,
    bool skipAuth = false,
    CancelToken? cancelToken,
  }) =>
      _send<T>(
        'DELETE',
        path,
        decoder: decoder,
        body: body,
        query: query,
        skipAuth: skipAuth,
        cancelToken: cancelToken,
      );

  /// A cursor-paginated GET: `{ data: [...], meta: { cursor, hasMore } }`.
  ///
  /// The `meta` block is REQUIRED on these endpoints, so its absence is a
  /// contract violation and not a quietly-empty page. Defaulting it to
  /// "no more" would turn a server bug into a list that silently stops.
  Future<Page<T>> getPage<T>(
    String path, {
    required JsonDecoderFn<T> itemDecoder,
    Map<String, Object?>? query,
    bool skipAuth = false,
    CancelToken? cancelToken,
  }) async {
    final response = await _request(
      'GET',
      path,
      query: query,
      skipAuth: skipAuth,
      cancelToken: cancelToken,
    );
    try {
      final envelope = _asMap(response.data, response);
      final data = envelope['data'];
      if (data is! List) {
        throw FormatException(
          'Expected a list under "data", got ${data.runtimeType}',
        );
      }
      final meta = envelope['meta'];
      if (meta is! Map) {
        throw const FormatException(
          'A paginated response must carry "meta"; this one did not',
        );
      }
      return Page<T>(
        items: <T>[
          for (final item in data) itemDecoder(_asMap(item, response)),
        ],
        meta: PageMeta.fromJson(_asMap(meta, response)),
      );
    } on Object catch (error, stackTrace) {
      throw FailureMapper.fromDecodeError(
        error,
        stackTrace,
        response: response,
      );
    }
  }

  /// A GET returning an unpaginated list — `/v1/categories`, `/v1/addresses`.
  /// Both are bounded collections the server sends whole; there is no `meta`
  /// on either and inventing one would be a lie about a second page.
  Future<List<T>> getList<T>(
    String path, {
    required JsonDecoderFn<T> itemDecoder,
    Map<String, Object?>? query,
    bool skipAuth = false,
    CancelToken? cancelToken,
  }) async {
    final response = await _request(
      'GET',
      path,
      query: query,
      skipAuth: skipAuth,
      cancelToken: cancelToken,
    );
    try {
      final envelope = _asMap(response.data, response);
      final data = envelope['data'];
      if (data is! List) {
        throw FormatException(
          'Expected a list under "data", got ${data.runtimeType}',
        );
      }
      return <T>[
        for (final item in data) itemDecoder(_asMap(item, response)),
      ];
    } on Object catch (error, stackTrace) {
      throw FailureMapper.fromDecodeError(
        error,
        stackTrace,
        response: response,
      );
    }
  }

  Future<T> _send<T>(
    String method,
    String path, {
    required JsonDecoderFn<T> decoder,
    Object? body,
    Map<String, Object?>? query,
    Map<String, String>? headers,
    bool skipAuth = false,
    CancelToken? cancelToken,
  }) async {
    final response = await _request(
      method,
      path,
      body: body,
      query: query,
      headers: headers,
      skipAuth: skipAuth,
      cancelToken: cancelToken,
    );
    try {
      final envelope = _asMap(response.data, response);
      if (!envelope.containsKey('data')) {
        throw const FormatException(
          'A success response must carry "data"; this one did not',
        );
      }
      return decoder(_asMap(envelope['data'], response));
    } on Object catch (error, stackTrace) {
      throw FailureMapper.fromDecodeError(
        error,
        stackTrace,
        response: response,
      );
    }
  }

  Future<Response<dynamic>> _request(
    String method,
    String path, {
    Object? body,
    Map<String, Object?>? query,
    Map<String, String>? headers,
    bool skipAuth = false,
    CancelToken? cancelToken,
  }) async {
    final client = skipAuth ? _unauthenticatedDio : _dio;
    try {
      return await client.request<dynamic>(
        path,
        data: body,
        queryParameters: query == null ? null : encodeQuery(query),
        cancelToken: cancelToken,
        options: Options(
          method: method,
          headers: headers == null || headers.isEmpty
              ? null
              : <String, dynamic>{...headers},
          extra: <String, dynamic>{
            if (skipAuth) AuthInterceptor.skipAuthExtraKey: true,
          },
        ),
      );
    } on DioException catch (error) {
      final mapped = error.error;
      throw mapped is ApiFailure
          ? mapped
          : FailureMapper.fromDioException(error);
    }
  }

  /// Query encoding, with the two traps the contract calls out.
  ///
  ///  * A null value is DROPPED, not sent as the string "null". `?currency=null`
  ///    is a 400 from a filter the caller thought it had left unset.
  ///  * A bool is sent as the literal `true`/`false`, because the server
  ///    compares against those exact strings. `QueryBooleanSchema` exists
  ///    precisely because `z.coerce.boolean()` makes `"false"` mean true, and
  ///    `?inStock=false` filtering to in-stock items is a filter that means the
  ///    opposite of what it says.
  static Map<String, dynamic> encodeQuery(Map<String, Object?> query) {
    final encoded = <String, dynamic>{};
    for (final entry in query.entries) {
      final value = entry.value;
      if (value == null) continue;
      encoded[entry.key] = switch (value) {
        bool() => value ? 'true' : 'false',
        int() => value.toString(),
        double() => value.toString(),
        String() => value,
        Enum() => value.toString(),
        _ => value.toString(),
      };
    }
    return encoded;
  }

  Map<String, dynamic> _asMap(Object? value, Response<dynamic> response) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) {
      return <String, dynamic>{
        for (final e in value.entries) '${e.key}': e.value,
      };
    }
    throw FormatException('Expected a JSON object, got ${value.runtimeType}');
  }

  void close({bool force = false}) {
    _dio.close(force: force);
    _unauthenticatedDio.close(force: force);
  }
}
