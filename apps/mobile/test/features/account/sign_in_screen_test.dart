import 'package:avenick/api/models/enums.dart';
import 'package:avenick/api/models/requests.dart';
import 'package:avenick/core/ui/key_button.dart';
import 'package:avenick/features/account/account.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../api/fake_transport.dart';
import '../../api/fixtures.dart' as fixtures;
import 'harness.dart';

/// The four states of the sign-in screen.
///
///   1. IDLE, EMPTY   — no number typed; the primary action is disabled.
///   2. READY         — a valid number; the primary action is live.
///   3. BUSY          — the request is in flight.
///   4. FAILED        — the truthful `not_found` notice naming the endpoint.
void main() {
  Finder sendCode() => find.byKey(const ValueKey<String>('sign-in-send-code'));
  Finder failure() => find.byKey(const ValueKey<String>('sign-in-failure'));

  bool isEnabled(WidgetTester tester, Finder finder) =>
      tester.widget<KeyButton>(finder).onPressed != null;

  group('the four states', () {
    testWidgets('1 · idle and empty: the primary action is disabled', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const SignInScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(sendCode(), findsOneWidget);
      expect(
        isEnabled(tester, sendCode()),
        isFalse,
        reason: 'a live button that silently does nothing is the one thing '
            'this feature must never ship',
      );
      expect(failure(), findsNothing);
      // And nothing has been sent anywhere.
      expect(harness.adapter.requests, isEmpty);
    });

    testWidgets('2 · a valid number arms the primary action', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const SignInScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.enterText(find.byType(TextField).first, '501234567');
      await tester.pump();

      expect(isEnabled(tester, sendCode()), isTrue);
    });

    testWidgets('3 · busy while the request is in flight', (
      WidgetTester tester,
    ) async {
      // The adapter holds the response open, so there is a frame to observe.
      final AccountHarness harness = AccountHarness(
        handler: (RequestOptions options) => FakeResponse(
          200,
          <String, dynamic>{'data': fixtures.otpChallenge()},
          headers: const <String, String>{'x-request-id': 'req_slow'},
          delay: const Duration(milliseconds: 300),
        ),
      );

      await pumpAccountScreen(
        tester,
        const SignInScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.enterText(find.byType(TextField).first, '501234567');
      await tester.pump();
      await tester.tap(sendCode());
      await tester.pump();

      expect(
        tester.widget<KeyButton>(sendCode()).busy,
        isTrue,
        reason: 'the key keeps its measured width while busy so the layout '
            'does not jump under the thumb',
      );
      expect(isEnabled(tester, sendCode()), isFalse);

      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();
    });

    testWidgets('4 · failure names the endpoint and shows the request id', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const SignInScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.enterText(find.byType(TextField).first, '501234567');
      await tester.pump();
      await tester.tap(sendCode());
      await settleRequests(tester);

      expect(failure(), findsOneWidget);

      // The whole honesty requirement, asserted as text on a screen.
      expect(
        find.textContaining('POST /v1/auth/otp/request'),
        findsOneWidget,
        reason: 'the screen must name the route it needed',
      );
      expect(
        find.textContaining('no such route'),
        findsOneWidget,
        reason: 'an unimplemented endpoint is not "something went wrong"',
      );
      expect(
        find.textContaining('req_unbuilt'),
        findsOneWidget,
        reason: 'the requestId is the only thing joining this screen to a '
            'server log line',
      );
      // And it does not offer a retry, because retrying cannot help.
      expect(find.text('Try again'), findsNothing);
    });
  });

  group('phone first', () {
    testWidgets('the dial code is prefilled from the selected market', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend(
        preferences: const AccountPreferences(market: GccMarket.sa),
      );
      await pumpAccountScreen(
        tester,
        const SignInScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      // A Saudi shopper should not have to know their own country code.
      expect(find.textContaining('+966'), findsOneWidget);
      expect(find.textContaining('+971'), findsNothing);
    });

    testWidgets('every market can be chosen from the sign-in screen', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const SignInScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.tap(find.textContaining('+971'));
      await tester.pumpAndSettle();

      for (final GccMarket market in GccMarket.values) {
        expect(
          find.byKey(ValueKey<String>('market-${market.country.code}')),
          findsOneWidget,
          reason: '${market.nameEn} must be reachable',
        );
      }

      await tester.tap(
        find.byKey(const ValueKey<String>('market-QA')),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('+974'), findsOneWidget);
    });

    testWidgets('the number goes up in E.164 with the device id', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const SignInScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.enterText(find.byType(TextField).first, '050 123 4567');
      await tester.pump();
      await tester.tap(sendCode());
      await settleRequests(tester);

      final Map<String, dynamic>? body = harness.bodyOf(
        '/v1/auth/otp/request',
      );
      expect(body, isNotNull);
      expect(
        body!['phone'],
        '+971501234567',
        reason: 'the trunk zero and the spaces must not reach the wire; the '
            'web enforces exactly this format',
      );
      expect(body['deviceId'], 'test-device');
    });

    testWidgets('a pasted +966 moves the picker with it', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const SignInScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.enterText(find.byType(TextField).first, '966501234567');
      await tester.pump();
      await tester.tap(sendCode());
      await settleRequests(tester);

      expect(harness.bodyOf('/v1/auth/otp/request')!['phone'], '+966501234567');
    });

    testWidgets('a landline-looking number warns but is not blocked', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const SignInScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.enterText(find.byType(TextField).first, '441234567');
      await tester.pump();

      expect(
        find.textContaining('does not look like a mobile'),
        findsOneWidget,
      );
      expect(
        isEnabled(tester, sendCode()),
        isTrue,
        reason: 'numbering plans grow; a client-side prefix list must not lock '
            'a real customer out',
      );
    });
  });

  group('the email path is second, and complete', () {
    testWidgets('it is closed until asked for', (WidgetTester tester) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const SignInScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(find.byKey(const ValueKey<String>('sign-in-email')), findsNothing);
      expect(
        find.byKey(const ValueKey<String>('sign-in-open-email')),
        findsOneWidget,
      );
    });

    testWidgets('opening it reveals a working email and password form', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const SignInScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.tap(
        find.byKey(const ValueKey<String>('sign-in-open-email')),
      );
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const ValueKey<String>('sign-in-email')),
        'buyer@example.ae',
      );
      await tester.enterText(
        find.byKey(const ValueKey<String>('sign-in-password')),
        'hunter2',
      );
      await tester.pump();

      final Finder submit = find.byKey(
        const ValueKey<String>('sign-in-submit-password'),
      );
      expect(isEnabled(tester, submit), isTrue);

      await tester.tap(submit);
      await settleRequests(tester);

      expect(harness.requestedPaths, contains('/v1/auth/token'));
      expect(find.textContaining('POST /v1/auth/token'), findsOneWidget);
    });

    testWidgets('the password is obscured and never printable', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const SignInScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester
          .tap(find.byKey(const ValueKey<String>('sign-in-open-email')));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const ValueKey<String>('sign-in-email')),
        'buyer@example.ae',
      );
      await tester.enterText(
        find.byKey(const ValueKey<String>('sign-in-password')),
        'hunter2',
      );
      await tester.pump();
      await tester.tap(
        find.byKey(const ValueKey<String>('sign-in-submit-password')),
      );
      await settleRequests(tester);

      final TextField password = tester.widget<TextField>(
        find.byKey(const ValueKey<String>('sign-in-password')),
      );
      expect(password.obscureText, isTrue);

      // The password DOES go up in the body — that is the point of the
      // endpoint — but the request object's own description redacts it, so a
      // logging interceptor or a crash report cannot carry it out.
      expect(harness.bodyOf('/v1/auth/token')!['password'], 'hunter2');
      const PasswordGrantRequest request = PasswordGrantRequest(
        email: 'buyer@example.ae',
        password: 'hunter2',
        deviceId: 'test-device',
      );
      expect(request.toString(), contains('<redacted>'));
      expect(request.toString(), isNot(contains('hunter2')));
    });
  });

  group('accessibility and RTL', () {
    testWidgets('the primary action is at least 48dp tall', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const SignInScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(
        tester.getSize(sendCode()).height,
        greaterThanOrEqualTo(48.0),
        reason: 'controlHLg (46) plus keyDepth (3) clears the floor; a medium '
            'key would not',
      );
    });

    testWidgets('the dial-code button announces what it is', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const SignInScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(
        find.bySemanticsLabel(
          RegExp('Country code .*971.*United Arab Emirates'),
        ),
        findsOneWidget,
      );
      handle.dispose();
    });

    testWidgets('it survives an Arabic layout', (WidgetTester tester) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend(
        preferences: const AccountPreferences(
          market: GccMarket.sa,
          languageOverride: Language.ar,
        ),
      );
      await pumpAccountScreen(
        tester,
        const SignInScreen(),
        overrides: harness.overrides,
        locale: const Locale('ar'),
      );
      await settleRequests(tester);

      expect(tester.takeException(), isNull);
      // The dial code is inside an LTR isolate, so it renders as +966 and not
      // as 966+.
      expect(find.textContaining('+966'), findsOneWidget);
    });

    testWidgets('it survives 200% text without overflowing', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const SignInScreen(),
        overrides: harness.overrides,
        textScale: 2.0,
      );
      await settleRequests(tester);

      expect(
        tester.takeException(),
        isNull,
        reason: 'a RenderFlex overflow at large type is invisible in an '
            'English screenshot at default type',
      );
    });
  });
}
