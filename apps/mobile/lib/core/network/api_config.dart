/// Which deployment this build talks to.
enum ApiFlavour {
  dev('dev'),
  staging('staging'),
  prod('prod');

  const ApiFlavour(this.wire);
  final String wire;

  static ApiFlavour parse(String value) {
    for (final flavour in ApiFlavour.values) {
      if (flavour.wire == value) return flavour;
    }
    throw ArgumentError.value(
      value,
      'AVENICK_FLAVOUR',
      'must be one of ${ApiFlavour.values.map((f) => f.wire).join(', ')}',
    );
  }
}

/// Where this build points, and how patient it is.
///
/// Everything comes from `--dart-define`, resolved at COMPILE time by
/// `String.fromEnvironment`. That is the point: a base URL read from a
/// `.env` asset at runtime ships inside the bundle anyway, and a base URL read
/// from a debug menu is a production build one tap away from a staging
/// database. A const here cannot be repointed by anything at runtime.
///
///     flutter run \
///       --dart-define=AVENICK_FLAVOUR=staging \
///       --dart-define=AVENICK_API_BASE_URL=https://staging.avenick.com
///
/// Only the base URL is overridable per build; the rest are defaults a flavour
/// may adjust. If nothing is defined the build is `dev` against the loopback
/// address the Next.js app serves on, which fails fast and locally rather than
/// silently reaching production.
class ApiConfig {
  const ApiConfig({
    required this.flavour,
    required this.baseUrl,
    this.connectTimeout = const Duration(seconds: 10),
    this.sendTimeout = const Duration(seconds: 20),
    this.receiveTimeout = const Duration(seconds: 20),
    this.userAgent = 'AvenickCommerce/mobile',
    this.enableRequestLogging = true,
    this.sampleTraces = true,
  });

  final ApiFlavour flavour;

  /// The ORIGIN only — `https://…`, no `/api` and no trailing slash.
  ///
  /// The OpenAPI document declares its server as `/api` and every path under
  /// it as `/v1/...`, so [apiPrefix] is `/api` and endpoint clients spell the
  /// path exactly as the spec does. A path in this codebase can be grepped for
  /// verbatim in `openapi.json`, which is the point.
  final String baseUrl;

  final Duration connectTimeout;
  final Duration sendTimeout;
  final Duration receiveTimeout;
  final String userAgent;

  /// Request/response logging. Never logs a token — see `LoggingInterceptor` —
  /// but it does log paths and status codes, so it is off in release.
  final bool enableRequestLogging;

  /// Whether to mark outgoing traces as sampled in the `traceparent` flags.
  final bool sampleTraces;

  static const String apiPrefix = '/api';

  /// The full prefix every endpoint client hangs off. Paths passed to
  /// [ApiClient] start at `/v1`.
  String get apiBaseUrl => '$baseUrl$apiPrefix';

  static const String _flavourDefine = String.fromEnvironment(
    'AVENICK_FLAVOUR',
    defaultValue: 'dev',
  );

  static const String _baseUrlDefine =
      String.fromEnvironment('AVENICK_API_BASE_URL');

  /// The default base URL per flavour, used when `AVENICK_API_BASE_URL` is not
  /// defined. There is deliberately no production default that a debug build
  /// could fall into by accident: a prod build MUST define its URL explicitly.
  static String defaultBaseUrlFor(ApiFlavour flavour) => switch (flavour) {
        // 10.0.2.2 is the Android emulator's route to the host. An iOS
        // simulator shares the host's loopback, so localhost works there; set
        // AVENICK_API_BASE_URL to switch.
        ApiFlavour.dev => 'http://10.0.2.2:3000',
        ApiFlavour.staging => 'https://staging.avenick.com',
        ApiFlavour.prod => throw StateError(
            'A prod build must pass --dart-define=AVENICK_API_BASE_URL. '
            'There is no baked-in production URL on purpose.',
          ),
      };

  /// Build the configuration this binary was compiled with.
  factory ApiConfig.fromEnvironment() {
    final flavour = ApiFlavour.parse(_flavourDefine);
    final baseUrl =
        _baseUrlDefine.isNotEmpty ? _baseUrlDefine : defaultBaseUrlFor(flavour);
    final normalised = baseUrl.endsWith('/')
        ? baseUrl.substring(0, baseUrl.length - 1)
        : baseUrl;

    if (flavour == ApiFlavour.prod && normalised.startsWith('http://')) {
      throw StateError(
        'A prod build must not talk to a plaintext origin: $normalised',
      );
    }

    return ApiConfig(
      flavour: flavour,
      baseUrl: normalised,
      enableRequestLogging: flavour != ApiFlavour.prod,
      // Sampling every trace from every phone in production is a bill, not a
      // signal. The backend's tail sampler decides; the app only proposes.
      sampleTraces: flavour != ApiFlavour.prod,
    );
  }
}
