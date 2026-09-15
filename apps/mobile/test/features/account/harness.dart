import 'dart:async';

import 'package:avenick/api/avenick_api.dart';
import 'package:avenick/core/network/api_config.dart';
import 'package:avenick/features/account/account.dart';
import 'package:avenick/theme/meridian_theme.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:riverpod/misc.dart' show Override;

import '../../api/fake_transport.dart';

/// The account tests run the REAL stack.
///
/// `AvenickApi.build` here is the same factory `main` uses: the real
/// interceptor chain, the real envelope unwrapping, the real `FailureMapper`.
/// Only two things are swapped — the HTTP adapter for a [FakeAdapter], and the
/// Keychain for an [InMemoryTokenStore] — because a socket and a platform
/// channel are the two things a `flutter test` run genuinely does not have.
///
/// The consequence that matters: when a test asserts the screen says
/// "the server answered that there is no such route", that sentence was
/// produced by mapping a real `{ error: { code: 'not_found', … } }` envelope
/// through the production failure mapper. It is not a stub agreeing with
/// itself.
class AccountHarness {
  AccountHarness._({
    required this.api,
    required this.adapter,
    required this.tokenStore,
    required this.preferencesStore,
  });

  factory AccountHarness({
    required FutureOr<FakeResponse> Function(RequestOptions options) handler,
    AccountPreferences preferences = AccountPreferences.fallback,
    String? refreshToken,
  }) {
    final FakeAdapter adapter = FakeAdapter(handler);
    final InMemoryTokenStore tokenStore = InMemoryTokenStore(
      refreshToken: refreshToken,
      deviceId: 'test-device',
    );
    final AvenickApi api = AvenickApi.build(
      config: const ApiConfig(
        flavour: ApiFlavour.dev,
        baseUrl: 'http://localhost:3000',
        enableRequestLogging: false,
        sampleTraces: false,
      ),
      store: tokenStore,
      adapter: adapter,
    );
    return AccountHarness._(
      api: api,
      adapter: adapter,
      tokenStore: tokenStore,
      preferencesStore: InMemoryPreferencesStore(preferences),
    );
  }

  /// Everything answers `not_found` — the state the whole backend is actually
  /// in today. The default, so a test has to opt IN to a working server.
  factory AccountHarness.unbuiltBackend({
    AccountPreferences preferences = AccountPreferences.fallback,
  }) =>
      AccountHarness(
        preferences: preferences,
        handler: (RequestOptions options) => FakeResponse.error(
          404,
          'not_found',
          message: 'Not found.',
          requestId: 'req_unbuilt',
        ),
      );

  final AvenickApi api;
  final FakeAdapter adapter;
  final InMemoryTokenStore tokenStore;
  final InMemoryPreferencesStore preferencesStore;

  List<Override> get overrides => <Override>[
        avenickApiProvider.overrideWithValue(api),
        accountPreferencesStoreProvider.overrideWithValue(preferencesStore),
      ];

  /// Paths that actually reached the transport, in order.
  List<String> get requestedPaths =>
      adapter.requests.map((RequestOptions r) => r.path).toList();

  Map<String, dynamic>? bodyOf(String path) {
    for (final RequestOptions r in adapter.requests.reversed) {
      if (r.path == path && r.data is Map) {
        return <String, dynamic>{
          for (final MapEntry<Object?, Object?> e
              in (r.data as Map<Object?, Object?>).entries)
            '${e.key}': e.value,
        };
      }
    }
    return null;
  }
}

/// Pump a screen inside the app's real theme and localisations.
///
/// [textScale] defaults to 1.0; the accessibility tests raise it to 2.0. Note
/// that `lib/main.dart` clamps the app's own scaler to 1.3 — a decision that
/// belongs to another engineer — so 2.0 here is testing that THESE screens
/// survive it if that cap is ever lifted, which is the part this feature can
/// actually control.
Future<void> pumpAccountScreen(
  WidgetTester tester,
  Widget screen, {
  required List<Override> overrides,
  Locale locale = const Locale('en'),
  double textScale = 1.0,
  Size surfaceSize = const Size(390, 844),
  List<NavigatorObserver> observers = const <NavigatorObserver>[],
}) async {
  await tester.binding.setSurfaceSize(surfaceSize);
  addTearDown(() => tester.binding.setSurfaceSize(null));

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        locale: locale,
        supportedLocales: const <Locale>[Locale('en'), Locale('ar')],
        localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        theme: MeridianTheme.light(viewportWidth: surfaceSize.width),
        darkTheme: MeridianTheme.dark(viewportWidth: surfaceSize.width),
        navigatorObservers: observers,
        builder: (BuildContext context, Widget? child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(textScale)),
          child: child ?? const SizedBox.shrink(),
        ),
        home: screen,
      ),
    ),
  );
  // One pump, not pumpAndSettle: the skeleton shimmer repeats forever by
  // design, so settling would hang.
  await tester.pump();
}

/// Let every in-flight future and its rebuild land.
Future<void> settleRequests(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  await tester.pump();
}

/// Records what a screen navigated to, so a test can assert a flow step
/// happened without building the whole router.
class RouteRecorder extends NavigatorObserver {
  final List<Route<dynamic>> pushed = <Route<dynamic>>[];
  final List<Route<dynamic>> popped = <Route<dynamic>>[];

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      pushed.add(route);

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      popped.add(route);
}
