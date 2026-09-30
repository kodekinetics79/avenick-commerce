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

/// A clock a test can wind forward.
///
/// `Timer` is faked by the widget-test binding but `DateTime.now` is not, so a
/// countdown read off the wall clock is untestable: pumping 31 seconds of fake
/// time fires 31 ticks while `now` has barely moved. `OtpVerifyScreen` takes
/// its clock as a parameter for exactly this reason.
class FakeClock {
  FakeClock(this._now);
  DateTime _now;
  DateTime call() => _now;
  void advance(Duration by) => _now = _now.add(by);
}

void main() {
  final DateTime t0 = DateTime.utc(2026, 9, 8, 10);

  OtpChallenge challengeAt(
    DateTime now, {
    Duration resendIn = const Duration(seconds: 30),
    Duration expiresIn = const Duration(minutes: 5),
    int codeLength = 6,
  }) =>
      OtpChallenge(
        challengeId: 'otp_test',
        codeLength: codeLength,
        expiresAt: now.add(expiresIn),
        resendAfter: now.add(resendIn),
      );

  final PhoneNumber phone = PhoneNumber.parse(
    '501234567',
    market: GccMarket.ae,
  );

  Finder resend() => find.byKey(const ValueKey<String>('otp-resend'));

  /// A server that reads the code and rejects it — as opposed to one that has
  /// never heard of the route.
  AccountHarness rejectingServer() => AccountHarness(
        handler: (RequestOptions options) => FakeResponse.error(
          400,
          'validation_failed',
          message: 'That code is not right.',
          requestId: 'req_wrong_code',
        ),
      );

  group('the four states', () {
    testWidgets('1 · idle: six empty boxes, each announcing its position', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      final FakeClock clock = FakeClock(t0);

      await pumpAccountScreen(
        tester,
        OtpVerifyScreen(
          challenge: challengeAt(t0),
          phone: phone,
          clock: clock.call,
        ),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      for (int i = 1; i <= 6; i++) {
        expect(
          find.bySemanticsLabel('Digit $i of 6'),
          findsOneWidget,
          reason: 'a screen-reader user who cannot see six boxes still needs '
              'to know which one they are on',
        );
      }
      // And nothing has been verified.
      expect(harness.adapter.requests, isEmpty);
      handle.dispose();
    });

    testWidgets('2 · a complete code submits itself', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      final FakeClock clock = FakeClock(t0);

      await pumpAccountScreen(
        tester,
        OtpVerifyScreen(
          challenge: challengeAt(t0),
          phone: phone,
          clock: clock.call,
        ),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.enterText(
        find.byKey(const ValueKey<String>('otp-hidden-field')),
        '123456',
      );
      await settleRequests(tester);

      expect(
        harness.requestedPaths,
        contains('/v1/auth/otp/verify'),
        reason: 'nobody should have to find a submit button hidden under the '
            'keyboard',
      );
    });

    testWidgets('3 · busy while the code is being checked', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness(
        handler: (RequestOptions options) => FakeResponse(
          200,
          <String, dynamic>{'data': fixtures.tokenPair()},
          headers: const <String, String>{'x-request-id': 'req_slow'},
          delay: const Duration(milliseconds: 300),
        ),
      );
      final FakeClock clock = FakeClock(t0);

      await pumpAccountScreen(
        tester,
        OtpVerifyScreen(
          challenge: challengeAt(t0),
          phone: phone,
          clock: clock.call,
        ),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.enterText(
        find.byKey(const ValueKey<String>('otp-hidden-field')),
        '123456',
      );
      await tester.pump();

      expect(find.text('Checking your code'), findsOneWidget);

      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();
    });

    testWidgets('4 · an unbuilt endpoint says so, and is NOT a wrong code', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      final FakeClock clock = FakeClock(t0);

      await pumpAccountScreen(
        tester,
        OtpVerifyScreen(
          challenge: challengeAt(t0),
          phone: phone,
          clock: clock.call,
        ),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.enterText(
        find.byKey(const ValueKey<String>('otp-hidden-field')),
        '123456',
      );
      await settleRequests(tester);

      expect(find.byKey(const ValueKey<String>('otp-failure')), findsOneWidget);
      expect(find.textContaining('POST /v1/auth/otp/verify'), findsOneWidget);
      expect(find.textContaining('req_unbuilt'), findsOneWidget);
      // The crucial half: the user is NOT told they mistyped, and no attempt
      // has been spent.
      expect(find.byKey(const ValueKey<String>('otp-rejection')), findsNothing);
      expect(
        find.byKey(const ValueKey<String>('otp-locked-out')),
        findsNothing,
      );
    });
  });

  group('the resend timer', () {
    testWidgets('starts at the server\'s resendAfter, not at build time', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      final FakeClock clock = FakeClock(t0);

      await pumpAccountScreen(
        tester,
        OtpVerifyScreen(
          // The server said 30 seconds, so the screen says 30 seconds.
          challenge: challengeAt(t0),
          phone: phone,
          clock: clock.call,
        ),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(find.text('Send a new code in 30s'), findsOneWidget);
      expect(tester.widget<KeyButton>(resend()).onPressed, isNull);
    });

    testWidgets('counts down and then arms the button', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      final FakeClock clock = FakeClock(t0);

      await pumpAccountScreen(
        tester,
        OtpVerifyScreen(
          challenge: challengeAt(t0),
          phone: phone,
          clock: clock.call,
        ),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      clock.advance(const Duration(seconds: 10));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Send a new code in 20s'), findsOneWidget);
      expect(tester.widget<KeyButton>(resend()).onPressed, isNull);

      clock.advance(const Duration(seconds: 20));
      await tester.pump(const Duration(seconds: 1));

      expect(find.text('Send a new code'), findsOneWidget);
      expect(
        tester.widget<KeyButton>(resend()).onPressed,
        isNotNull,
        reason: 'after the server\'s own instant, and not a second before',
      );
    });

    testWidgets('a resend asks for a NEW challenge and restarts the clock', (
      WidgetTester tester,
    ) async {
      // A server that issues challenges with a fresh 30s window each time.
      final AccountHarness harness = AccountHarness(
        handler: (RequestOptions options) =>
            FakeResponse.data(<String, dynamic>{
          'challengeId': 'otp_second',
          'codeLength': 6,
          'expiresAt': t0.add(const Duration(minutes: 10)).toIso8601String(),
          'resendAfter': t0.add(const Duration(seconds: 60)).toIso8601String(),
        }),
      );
      final FakeClock clock = FakeClock(t0);

      await pumpAccountScreen(
        tester,
        OtpVerifyScreen(
          challenge: challengeAt(t0),
          phone: phone,
          clock: clock.call,
        ),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      clock.advance(const Duration(seconds: 31));
      await tester.pump(const Duration(seconds: 1));
      await tester.tap(resend());
      await settleRequests(tester);

      expect(harness.requestedPaths, contains('/v1/auth/otp/request'));
      // The NEW challenge's window is what is showing: 60s from t0, and 31
      // seconds have passed.
      expect(find.text('Send a new code in 29s'), findsOneWidget);
    });

    testWidgets('the countdown is announced, not only drawn', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      final FakeClock clock = FakeClock(t0);

      await pumpAccountScreen(
        tester,
        OtpVerifyScreen(
          challenge: challengeAt(t0),
          phone: phone,
          clock: clock.call,
        ),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      // KeyButton's Semantics node merges its own label with the visible
      // text, so the announcement is the explanatory sentence PLUS the button
      // face — which is exactly what a screen reader should read out.
      expect(
        find.bySemanticsLabel(
          RegExp('You can ask for a new code in 30 seconds'),
        ),
        findsOneWidget,
      );
      handle.dispose();
    });
  });

  group('the attempt limit', () {
    testWidgets('three rejected codes fall back to email', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = rejectingServer();
      final FakeClock clock = FakeClock(t0);

      await pumpAccountScreen(
        tester,
        OtpVerifyScreen(
          challenge: challengeAt(t0),
          phone: phone,
          clock: clock.call,
        ),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      final Finder field = find.byKey(
        const ValueKey<String>('otp-hidden-field'),
      );

      // Attempt 1.
      await tester.enterText(field, '111111');
      await settleRequests(tester);
      expect(
        find.byKey(const ValueKey<String>('otp-rejection')),
        findsOneWidget,
      );
      expect(find.textContaining('2 tries left'), findsOneWidget);

      // Attempt 2.
      await tester.enterText(field, '222222');
      await settleRequests(tester);
      expect(
        find.textContaining('One more try before we switch you to email'),
        findsOneWidget,
      );

      // Attempt 3 — the limit.
      await tester.enterText(field, '333333');
      await settleRequests(tester);

      expect(
        find.byKey(const ValueKey<String>('otp-locked-out')),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey<String>('otp-use-email')),
        findsOneWidget,
        reason: 'a dead end here loses the account; an SMS that never arrives '
            'is common in the Gulf',
      );
      expect(
        resend(),
        findsNothing,
        reason: 'resending a code to a handset that is not receiving them is '
            'not the way out',
      );
    });

    testWidgets('a fourth code is not even sent', (WidgetTester tester) async {
      final AccountHarness harness = rejectingServer();
      final FakeClock clock = FakeClock(t0);

      await pumpAccountScreen(
        tester,
        OtpVerifyScreen(
          challenge: challengeAt(t0),
          phone: phone,
          clock: clock.call,
        ),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      final Finder field = find.byKey(
        const ValueKey<String>('otp-hidden-field'),
      );
      for (final String code in <String>['111111', '222222', '333333']) {
        await tester.enterText(field, code);
        await settleRequests(tester);
      }
      final int sent = harness.requestedPaths
          .where((String p) => p == '/v1/auth/otp/verify')
          .length;
      expect(sent, 3);

      // The input is disabled, so there is nothing to type into.
      final OtpInput input = tester.widget<OtpInput>(
        find.byKey(const ValueKey<String>('otp-input')),
      );
      expect(input.enabled, isFalse);
    });

    testWidgets('an OUTAGE does not spend an attempt', (
      WidgetTester tester,
    ) async {
      // The distinction the whole limit rests on: three tries are for three
      // wrong codes, not for three bad minutes on the network.
      final AccountHarness harness = AccountHarness(
        handler: (RequestOptions options) => FakeResponse.error(
          503,
          'upstream_unavailable',
          message: 'The service is unavailable.',
          requestId: 'req_outage',
        ),
      );
      final FakeClock clock = FakeClock(t0);

      await pumpAccountScreen(
        tester,
        OtpVerifyScreen(
          challenge: challengeAt(t0),
          phone: phone,
          clock: clock.call,
        ),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      final Finder field = find.byKey(
        const ValueKey<String>('otp-hidden-field'),
      );
      for (final String code in <String>['111111', '222222', '333333']) {
        await tester.enterText(field, code);
        await settleRequests(tester);
      }

      expect(
        find.byKey(const ValueKey<String>('otp-locked-out')),
        findsNothing,
      );
      expect(find.byKey(const ValueKey<String>('otp-failure')), findsOneWidget);
    });
  });

  group('the code input itself', () {
    testWidgets('the box count follows the challenge, not a hardcoded six', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      final FakeClock clock = FakeClock(t0);

      await pumpAccountScreen(
        tester,
        OtpVerifyScreen(
          challenge: challengeAt(t0, codeLength: 4),
          phone: phone,
          clock: clock.call,
        ),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(find.bySemanticsLabel('Digit 4 of 4'), findsOneWidget);
      expect(find.bySemanticsLabel('Digit 5 of 4'), findsNothing);
      handle.dispose();
    });

    testWidgets('the field carries the one-time-code autofill hint', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      final FakeClock clock = FakeClock(t0);

      await pumpAccountScreen(
        tester,
        OtpVerifyScreen(
          challenge: challengeAt(t0),
          phone: phone,
          clock: clock.call,
        ),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      final TextField field = tester.widget<TextField>(
        find.byKey(const ValueKey<String>('otp-hidden-field')),
      );
      expect(
        field.autofillHints,
        contains(AutofillHints.oneTimeCode),
        reason: 'both platforms deliver an SMS code only to a field carrying '
            'this hint — it is the entire reason for the one-field design',
      );
    });

    testWidgets('the masked number is shown, never the whole one', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      final FakeClock clock = FakeClock(t0);

      await pumpAccountScreen(
        tester,
        OtpVerifyScreen(
          challenge: challengeAt(t0),
          phone: phone,
          clock: clock.call,
        ),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(find.textContaining('50 123 4567'), findsNothing);
      expect(find.textContaining('•'), findsOneWidget);
    });

    testWidgets('it survives an Arabic layout and 200% text', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend(
        preferences: const AccountPreferences(
          market: GccMarket.sa,
          languageOverride: Language.ar,
        ),
      );
      final FakeClock clock = FakeClock(t0);

      await pumpAccountScreen(
        tester,
        OtpVerifyScreen(
          // Eight boxes, Arabic, 200% type, narrow handset — the worst case
          // for a fixed-width box row.
          challenge: challengeAt(t0, codeLength: 8),
          phone: phone,
          clock: clock.call,
        ),
        overrides: harness.overrides,
        locale: const Locale('ar'),
        textScale: 2.0,
      );
      await settleRequests(tester);

      expect(tester.takeException(), isNull);
    });
  });
}
