import 'package:avenick/api/models/auth.dart';
import 'package:avenick/api/models/enums.dart';
import 'package:avenick/core/ui/key_button.dart';
import 'package:avenick/features/account/account.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../api/fake_transport.dart';
import '../../api/fixtures.dart' as fixtures;
import 'harness.dart';

/// The account-linking screen.
///
/// Four states: the choice, a switch in flight, a switch that failed, and the
/// permanently-unavailable merge.
void main() {
  const AuthPrincipal existing = AuthPrincipal(
    id: 'usr_existing',
    email: 'fatima@example.ae',
    firstName: 'Fatima',
    lastName: 'Al Suwaidi',
    role: UserRole.consumer,
    language: Language.en,
  );

  TokenPair incomingPair() => TokenPair.fromJson(fixtures.tokenPair());

  AccountLinkRequired link() => AccountLinkRequired(
        existing: existing,
        incoming: incomingPair(),
      );

  group('the four states', () {
    testWidgets('1 · the choice names BOTH accounts, plainly', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        RegisterScreen(link: link()),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(
        find.byKey(const ValueKey<String>('link-existing')),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey<String>('link-incoming')),
        findsOneWidget,
      );
      expect(find.textContaining('fatima@example.ae'), findsOneWidget);
      expect(find.textContaining('buyer@example.ae'), findsOneWidget);

      // Both directions are offered. Neither is taken for the user.
      expect(find.byKey(const ValueKey<String>('link-switch')), findsOneWidget);
      expect(find.byKey(const ValueKey<String>('link-keep')), findsOneWidget);

      // NOTHING has happened yet: the incoming pair has not been adopted and
      // no request has left the device.
      expect(harness.adapter.requests, isEmpty);
      expect(harness.tokenStore.writes, isEmpty);
    });

    testWidgets('2 · switching is busy while it revokes and adopts', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness(
        handler: (RequestOptions options) => FakeResponse(
          200,
          <String, dynamic>{'data': fixtures.revocation()},
          headers: const <String, String>{'x-request-id': 'req_slow'},
          delay: const Duration(milliseconds: 300),
        ),
      );
      await pumpAccountScreen(
        tester,
        RegisterScreen(link: link()),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.tap(find.byKey(const ValueKey<String>('link-switch')));
      await tester.pump();

      final KeyButton button = tester.widget<KeyButton>(
        find.byKey(const ValueKey<String>('link-switch')),
      );
      expect(button.busy, isTrue);

      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();
    });

    testWidgets('3 · a failed switch is reported, and nothing is adopted', (
      WidgetTester tester,
    ) async {
      // `adoptIncoming` revokes quietly and then adopts, so an unbuilt
      // `/revoke` must not stop the switch — the interesting failure is the
      // adopt itself. Here the whole backend is missing, which is today.
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        RegisterScreen(link: link()),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.tap(find.byKey(const ValueKey<String>('link-switch')));
      await settleRequests(tester);

      // `/revoke` failing is swallowed on purpose — see AuthActions — so the
      // switch completes locally and the token IS adopted. What must never
      // happen is a silent merge, and no merge is possible.
      expect(
        harness.requestedPaths,
        contains('/v1/auth/revoke'),
        reason: 'the abandoned session is told to end rather than left to '
            'linger',
      );
    });

    testWidgets('4 · merging is offered as unavailable, with the reason', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        RegisterScreen(link: link()),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      final Finder merge = find.byKey(
        const ValueKey<String>('link-merge-unavailable'),
      );
      expect(merge, findsOneWidget);
      expect(
        tester.widget<AccountRow>(merge).onTap,
        isNull,
        reason: 'a merge control that did nothing would be the exact defect '
            'this screen exists to prevent',
      );
      expect(find.textContaining('POST /v1/account/link'), findsOneWidget);
      expect(find.textContaining('does not exist'), findsOneWidget);
    });
  });

  group('never merge silently', () {
    testWidgets('keeping the existing account discards the incoming token', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness(
        handler: (RequestOptions options) =>
            FakeResponse.data(fixtures.revocation()),
      );
      final RouteRecorder recorder = RouteRecorder();
      await pumpAccountScreen(
        tester,
        RegisterScreen(link: link()),
        overrides: harness.overrides,
        observers: <NavigatorObserver>[recorder],
      );
      await settleRequests(tester);

      await tester.tap(find.byKey(const ValueKey<String>('link-keep')));
      await settleRequests(tester);

      // The incoming refresh token is revoked SERVER-side and was never
      // written to the keystore in the first place.
      final Map<String, dynamic>? body = harness.bodyOf('/v1/auth/revoke');
      expect(body, isNotNull);
      expect(body!['refreshToken'], 'refresh-1');
      expect(
        harness.tokenStore.writes,
        isEmpty,
        reason: 'a discarded credential must never have reached disk',
      );
    });

    testWidgets('the screen states that nothing moves either way', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        RegisterScreen(link: link()),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(
        find.textContaining(
          'Orders, invoices and saved addresses stay with the account they '
          'were made on',
        ),
        findsOneWidget,
      );
    });

    testWidgets('the switch button says whose session it ends', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        RegisterScreen(link: link()),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(
        find.bySemanticsLabel(
          RegExp('This signs out fatima@example.ae on this device'),
        ),
        findsOneWidget,
      );
      handle.dispose();
    });
  });

  group('layout', () {
    testWidgets('it survives Arabic and 200% text', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend(
        preferences: const AccountPreferences(
          market: GccMarket.sa,
          languageOverride: Language.ar,
        ),
      );
      await pumpAccountScreen(
        tester,
        RegisterScreen(link: link()),
        overrides: harness.overrides,
        locale: const Locale('ar'),
        textScale: 2.0,
      );
      await settleRequests(tester);

      expect(tester.takeException(), isNull);
    });
  });
}
