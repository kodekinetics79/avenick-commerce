import 'dart:io';

import 'package:avenick/api/avenick_api.dart';
import 'package:avenick/api/models/models.dart';
import 'package:avenick/core/error/failures.dart';
import 'package:avenick/core/network/api_config.dart';
import 'package:avenick/core/storage/auth_session.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_transport.dart';
import 'fixtures.dart' as f;

/// Single-flight refresh: ten simultaneous 401s cause exactly ONE call to
/// `/v1/auth/refresh`.
///
/// This is the behaviour a cold app start depends on. The catalogue, the cart,
/// `/me` and the address book all fire at once; if the access token has
/// expired they all 401 within a few milliseconds of each other. Refreshing
/// per-401 means N refreshes racing, and on a server that ROTATES refresh
/// tokens on use — which this one should — N-1 of them present an
/// already-consumed token and the user is signed out in the middle of a
/// working session.
///
/// Two mechanisms combine to give exactly one refresh, and both are tested:
///
///   1. `AuthSession.refresh()` keeps one in-flight future and hands the same
///      one to every caller.
///   2. `AuthInterceptor` records the token each request went out with, and on
///      a 401 replays WITHOUT refreshing if the session's token has already
///      moved on.
///
/// NOTE: `/v1/auth/refresh` does not exist on the server. This exercises the
/// client against a fake transport, which is all it claims to do.
void main() {
  const config =
      ApiConfig(flavour: ApiFlavour.dev, baseUrl: 'https://example.test');

  /// A transport that 401s anything not carrying [validToken], answers
  /// `/v1/auth/refresh` with a fresh pair, and counts both.
  ({FakeAdapter adapter, List<String> refreshBodies}) transport({
    required String validToken,
    String newAccessToken = 'access-2',
    Duration refreshDelay = const Duration(milliseconds: 20),
    FakeResponse? refreshAnswer,
  }) {
    final bodies = <String>[];
    final adapter = FakeAdapter((options) {
      if (options.path == '/v1/auth/refresh') {
        bodies.add('${options.data}');
        return refreshAnswer ??
            FakeResponse(
              200,
              <String, dynamic>{
                'data': f.tokenPair(
                  accessToken: newAccessToken,
                  refreshToken: 'refresh-2',
                ),
              },
              headers: const <String, String>{'x-request-id': 'req_refresh'},
              // Held open so the other nine 401s are genuinely concurrent with
              // the refresh rather than tidily sequential after it.
              delay: refreshDelay,
            );
      }
      final auth = options.headers['authorization'];
      if (auth == 'Bearer $validToken') {
        return FakeResponse.data(f.me());
      }
      return FakeResponse.error(
        401,
        'unauthenticated',
        message: 'Sign in to continue.',
      );
    });
    return (adapter: adapter, refreshBodies: bodies);
  }

  Future<AvenickApi> signedInApi(
    FakeAdapter adapter,
    InMemoryTokenStore store,
  ) async {
    final api =
        AvenickApi.build(config: config, store: store, adapter: adapter);
    await api.session.adopt(
      TokenPair.fromJson(
        f.tokenPair(accessToken: 'access-1', refreshToken: 'refresh-1'),
      ),
    );
    return api;
  }

  test('ten concurrent 401s cause exactly one refresh, and all ten succeed',
      () async {
    final t = transport(validToken: 'access-2');
    final store = InMemoryTokenStore();
    final api = await signedInApi(t.adapter, store);
    addTearDown(api.dispose);

    final results = await Future.wait<Me>(
      List<Future<Me>>.generate(10, (_) => api.account.me()),
    );

    expect(results, hasLength(10));
    for (final me in results) {
      expect(me.id, 'usr_01HZ');
    }

    // THE ASSERTION. One refresh, not ten.
    expect(
      t.adapter.countWherePath('/v1/auth/refresh'),
      1,
      reason: 'ten simultaneous 401s must collapse into a single refresh',
    );

    // Ten original attempts + ten replays = twenty calls to /v1/me.
    expect(t.adapter.countWherePath('/v1/me'), 20);

    // The rotated refresh token was persisted, and the new access token is the
    // one the session now holds — in memory only.
    expect(api.session.accessToken, 'access-2');
    expect(await store.readRefreshToken(), 'refresh-2');
  });

  test('the refresh carries the stored refresh token and the device id',
      () async {
    final t = transport(validToken: 'access-2');
    final store = InMemoryTokenStore(deviceId: 'dev-fixed');
    final api = await signedInApi(t.adapter, store);
    addTearDown(api.dispose);

    await api.account.me();

    expect(t.refreshBodies, hasLength(1));
    expect(t.refreshBodies.single, contains('refresh-1'));
    expect(t.refreshBodies.single, contains('dev-fixed'));
  });

  test('a device id is minted once and reused across refreshes', () async {
    final store = InMemoryTokenStore();
    final t = transport(validToken: 'access-2');
    final api = await signedInApi(t.adapter, store);
    addTearDown(api.dispose);

    final first = await api.session.deviceId();
    final second = await api.session.deviceId();
    expect(first, second);
    expect(await store.readDeviceId(), first);
    expect(first, hasLength(32));
  });

  test('AuthSession.refresh() hands every concurrent caller the same future',
      () async {
    final t = transport(validToken: 'access-2');
    final api = await signedInApi(t.adapter, InMemoryTokenStore());
    addTearDown(api.dispose);

    final pairs = await Future.wait<TokenPair>(
      List<Future<TokenPair>>.generate(10, (_) => api.session.refresh()),
    );

    expect(t.adapter.countWherePath('/v1/auth/refresh'), 1);
    for (final pair in pairs) {
      expect(identical(pair, pairs.first), isTrue);
    }
  });

  test('a later 401 starts a NEW refresh — the in-flight slot is released',
      () async {
    final t = transport(validToken: 'access-2');
    final api = await signedInApi(t.adapter, InMemoryTokenStore());
    addTearDown(api.dispose);

    await api.session.refresh();
    expect(t.adapter.countWherePath('/v1/auth/refresh'), 1);

    // A stuck non-null in-flight future here would wedge every authenticated
    // request in the app forever, so this is not a redundant assertion.
    await api.session.refresh();
    expect(t.adapter.countWherePath('/v1/auth/refresh'), 2);
  });

  test('a failed refresh clears the keystore and signals sign-out', () async {
    final t = transport(
      validToken: 'never-valid',
      refreshAnswer: FakeResponse.error(
        401,
        'unauthenticated',
        message: 'That refresh token has been revoked.',
      ),
    );
    final store = InMemoryTokenStore();
    final api = await signedInApi(t.adapter, store);
    addTearDown(api.dispose);

    final statuses = <AuthStatus>[];
    final subscription = api.session.statusChanges.listen(statuses.add);
    addTearDown(subscription.cancel);

    await expectLater(api.account.me(), throwsA(isA<AuthFailure>()));

    // Exactly one refresh was attempted, and it was not retried.
    expect(t.adapter.countWherePath('/v1/auth/refresh'), 1);

    // The keystore is actually empty — not merely reported as such.
    expect(await store.readRefreshToken(), isNull);
    expect(store.clearSessionCalls, 1);
    expect(api.session.accessToken, isNull);

    await Future<void>.delayed(Duration.zero);
    expect(statuses.whereType<SignedOut>(), isNotEmpty);
    expect(statuses.whereType<SignedOut>().last.reason, isA<AuthFailure>());
  });

  test('a refresh that fails on the NETWORK does not sign the user out',
      () async {
    // An aeroplane is not a revoked session. Clearing the keystore here would
    // make a tunnel into a forced re-login.
    final store = InMemoryTokenStore(refreshToken: 'refresh-1');
    final api = AvenickApi.build(
      config: config,
      store: store,
      adapter: FakeAdapter(
        (options) => throw const SocketException('Network is unreachable'),
      ),
    );
    addTearDown(api.dispose);
    await api.session
        .adopt(TokenPair.fromJson(f.tokenPair(refreshToken: 'refresh-1')));

    await expectLater(api.session.refresh(), throwsA(isA<NetworkFailure>()));

    expect(await store.readRefreshToken(), isNotNull);
    expect(store.clearSessionCalls, 0);
  });

  test('a refresh that 500s does not sign the user out either', () async {
    // The auth service having a bad minute is not a statement about this
    // user's token. Nor is `not_found` — which is what /v1/auth/refresh
    // answers today, because it has not been built.
    final store = InMemoryTokenStore(refreshToken: 'refresh-1');
    final t = transport(
      validToken: 'never-valid',
      refreshAnswer: FakeResponse.error(500, 'internal'),
    );
    final api = await signedInApi(t.adapter, store);
    addTearDown(api.dispose);

    await expectLater(api.session.refresh(), throwsA(isA<ServerFailure>()));

    expect(await store.readRefreshToken(), isNotNull);
    expect(store.clearSessionCalls, 0);
  });

  test('a 403 is NOT refreshed — signing in again would land in the same place',
      () async {
    final adapter = FakeAdapter((options) {
      if (options.path == '/v1/auth/refresh') {
        return FakeResponse(200, <String, dynamic>{'data': f.tokenPair()});
      }
      return FakeResponse.error(403, 'forbidden', message: 'Not permitted.');
    });
    final api = await signedInApi(adapter, InMemoryTokenStore());
    addTearDown(api.dispose);

    await expectLater(api.account.me(), throwsA(isA<AuthFailure>()));
    expect(adapter.countWherePath('/v1/auth/refresh'), 0);
    expect(adapter.countWherePath('/v1/me'), 1);
  });

  test('a 401 whose body is not an envelope is not refreshed either', () async {
    // An HTML 401 from a proxy is an infrastructure fault. Burning a refresh
    // token on it helps nobody.
    final adapter = FakeAdapter((options) {
      if (options.path == '/v1/auth/refresh') {
        return FakeResponse(200, <String, dynamic>{'data': f.tokenPair()});
      }
      return const FakeResponse(401, '<html>401</html>');
    });
    final api = await signedInApi(adapter, InMemoryTokenStore());
    addTearDown(api.dispose);

    await expectLater(api.account.me(), throwsA(isA<UnexpectedFailure>()));
    expect(adapter.countWherePath('/v1/auth/refresh'), 0);
  });

  test('a replay that 401s again is final, not an infinite refresh loop',
      () async {
    var refreshes = 0;
    final adapter = FakeAdapter((options) {
      if (options.path == '/v1/auth/refresh') {
        refreshes += 1;
        return FakeResponse(200, <String, dynamic>{
          'data': f.tokenPair(accessToken: 'still-wrong-$refreshes'),
        });
      }
      return FakeResponse.error(401, 'unauthenticated');
    });
    final api = await signedInApi(adapter, InMemoryTokenStore());
    addTearDown(api.dispose);

    await expectLater(api.account.me(), throwsA(isA<AuthFailure>()));
    expect(refreshes, 1);
    // One original attempt plus one replay. No third.
    expect(adapter.countWherePath('/v1/me'), 2);
  });

  test('the auth endpoints themselves never carry a bearer header', () async {
    final adapter = FakeAdapter(
      (options) => FakeResponse(200, <String, dynamic>{'data': f.tokenPair()}),
    );
    final api = await signedInApi(adapter, InMemoryTokenStore());
    addTearDown(api.dispose);

    await api.auth.signIn(
      const PasswordGrantRequest(
        email: 'buyer@example.ae',
        password: 'hunter2hunter2',
        deviceId: 'dev-1',
      ),
    );

    final request = adapter.requests.single;
    expect(request.path, '/v1/auth/token');
    // A refresh that went through the auth interceptor would try to refresh
    // itself when it failed.
    expect(request.headers.containsKey('authorization'), isFalse);
  });

  test(
      'the access token is never written to storage; only the refresh token is',
      () async {
    final store = InMemoryTokenStore();
    final t = transport(validToken: 'access-2');
    final api = await signedInApi(t.adapter, store);
    addTearDown(api.dispose);

    await api.account.me();

    // An access token is a bearer credential with no revocation list in front
    // of it. It stays in memory and dies with the process.
    expect(store.writes, isNot(contains('access-1')));
    expect(store.writes, isNot(contains('access-2')));
    expect(store.writes, contains('refresh-1'));
    expect(store.writes, contains('refresh-2'));
  });

  test('signOut clears the session but keeps the device id', () async {
    final store = InMemoryTokenStore(deviceId: 'dev-keep');
    final t = transport(validToken: 'access-1');
    final api = await signedInApi(t.adapter, store);
    addTearDown(api.dispose);

    await api.session.signOut();

    expect(await store.readRefreshToken(), isNull);
    // Not a credential, and keeping it means the next sign-in on this handset
    // is recognisably the same device.
    expect(await store.readDeviceId(), 'dev-keep');
    expect(api.session.status, isA<SignedOut>());
  });

  test('restore() reads the keystore without spending a refresh round trip',
      () async {
    final t = transport(validToken: 'access-2');
    final api = AvenickApi.build(
      config: config,
      store: InMemoryTokenStore(refreshToken: 'refresh-1'),
      adapter: t.adapter,
    );
    addTearDown(api.dispose);

    final status = await api.session.restore();

    expect(status, isA<SignedInPendingRefresh>());
    // Refreshing eagerly on launch spends a round trip a browsing-only session
    // never needed.
    expect(t.adapter.requests, isEmpty);
  });

  test('restore() with an empty keystore reports signed out', () async {
    final api = AvenickApi.build(
      config: config,
      store: InMemoryTokenStore(),
      adapter: FakeAdapter((_) => FakeResponse.data(f.me())),
    );
    addTearDown(api.dispose);

    expect(await api.session.restore(), isA<SignedOut>());
  });
}
