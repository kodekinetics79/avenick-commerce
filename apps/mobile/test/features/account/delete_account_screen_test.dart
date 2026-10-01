import 'package:avenick/api/models/enums.dart';
import 'package:avenick/core/ui/key_button.dart';
import 'package:avenick/features/account/account.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../api/fake_transport.dart';
import '../../api/fixtures.dart' as fixtures;
import 'harness.dart';

/// In-app account deletion is an App Store gate (Guideline 5.1.1(v)), not a
/// feature request. These tests hold the two things that make it honest: the
/// two-step confirm, and the retention copy.
void main() {
  Finder stepOne() => find.byKey(const ValueKey<String>('delete-step-one'));
  Finder stepTwo() => find.byKey(const ValueKey<String>('delete-step-two'));

  AccountHarness servingDeletion() => AccountHarness(
        handler: (RequestOptions options) {
          if (options.method == 'DELETE') {
            return FakeResponse.data(fixtures.accountDeletion());
          }
          return FakeResponse.data(fixtures.me());
        },
      );

  group('the four states', () {
    testWidgets('1 · step one explains, and takes no input', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = servingDeletion();
      await pumpAccountScreen(
        tester,
        const DeleteAccountScreen(email: 'buyer@example.ae'),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(
        find.byKey(const ValueKey<String>('delete-explain')),
        findsOneWidget,
      );
      expect(stepOne(), findsOneWidget);
      expect(
        stepTwo(),
        findsNothing,
        reason: 'the destructive button must not be one tap from arriving',
      );
      expect(
        find.byKey(const ValueKey<String>('delete-email')),
        findsNothing,
      );
      // Nothing has been sent.
      expect(
        harness.adapter.requests
            .where((RequestOptions r) => r.method == 'DELETE')
            .isEmpty,
        isTrue,
      );
    });

    testWidgets('2 · step two demands the email typed back', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = servingDeletion();
      await pumpAccountScreen(
        tester,
        const DeleteAccountScreen(email: 'buyer@example.ae'),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.tap(stepOne());
      await tester.pumpAndSettle();

      expect(
        find.byKey(const ValueKey<String>('delete-confirm')),
        findsOneWidget,
      );
      expect(
        tester.widget<KeyButton>(stepTwo()).onPressed,
        isNull,
        reason: 'the friction is the point — the contract requires a matching '
            'confirmEmail',
      );

      // A near miss is refused, with the reason on the field.
      await tester.enterText(
        find.byKey(const ValueKey<String>('delete-email')),
        'buyer@example.com',
      );
      await tester.pump();
      expect(tester.widget<KeyButton>(stepTwo()).onPressed, isNull);
      expect(
        find.text('That is not the email on this account.'),
        findsOneWidget,
      );

      // The right one, in the wrong case, is accepted — a phone keyboard
      // capitalises and refusing over that is theatre.
      await tester.enterText(
        find.byKey(const ValueKey<String>('delete-email')),
        'Buyer@Example.AE',
      );
      await tester.pump();
      expect(tester.widget<KeyButton>(stepTwo()).onPressed, isNotNull);
    });

    testWidgets('3 · the outcome is SCHEDULED, with the erasure date', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = servingDeletion();
      await pumpAccountScreen(
        tester,
        const DeleteAccountScreen(email: 'buyer@example.ae'),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.tap(stepOne());
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const ValueKey<String>('delete-email')),
        'buyer@example.ae',
      );
      await tester.pump();
      await tester.tap(stepTwo());
      await settleRequests(tester);

      expect(
        find.byKey(const ValueKey<String>('delete-scheduled')),
        findsOneWidget,
      );
      expect(find.text('Deletion scheduled'), findsOneWidget);
      expect(
        find.textContaining('Your account is not deleted yet'),
        findsOneWidget,
        reason: 'saying "deleted" while a grace period runs is a false '
            'statement about a data-protection right',
      );
      // The fixture erases on 2026-10-05, 30 days after the request.
      expect(
        find.byKey(const ValueKey<String>('delete-erases-at')),
        findsOneWidget,
      );
      expect(find.textContaining('October 5, 2026'), findsOneWidget);
      expect(find.textContaining('30 days from now'), findsOneWidget);

      // The body carried what the contract asks for.
      final Map<String, dynamic>? body = harness.bodyOf('/v1/account');
      expect(body!['confirmEmail'], 'buyer@example.ae');
    });

    testWidgets('4 · failure names DELETE /v1/account and keeps the session', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const DeleteAccountScreen(email: 'buyer@example.ae'),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.tap(stepOne());
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const ValueKey<String>('delete-email')),
        'buyer@example.ae',
      );
      await tester.pump();
      await tester.tap(stepTwo());
      await settleRequests(tester);

      expect(
        find.byKey(const ValueKey<String>('delete-failure')),
        findsOneWidget,
      );
      expect(find.textContaining('DELETE /v1/account'), findsOneWidget);
      expect(
        find.byKey(const ValueKey<String>('delete-scheduled')),
        findsNothing,
        reason: 'a failed deletion must never look like a successful one',
      );
      expect(
        harness.tokenStore.clearSessionCalls,
        0,
        reason: 'the device is only torn down AFTER the server acknowledges — '
            'clearing first leaves a live account with no way back into it',
      );
    });
  });

  group('the retention copy is truthful', () {
    testWidgets('both lists are on screen before the first tap', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = servingDeletion();
      await pumpAccountScreen(
        tester,
        const DeleteAccountScreen(email: 'buyer@example.ae'),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(
        find.byKey(const ValueKey<String>('delete-removed')),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey<String>('delete-retained')),
        findsOneWidget,
      );

      expect(find.text('Deleted'), findsOneWidget);
      expect(find.text('Kept, and why'), findsOneWidget);

      // The specific, load-bearing sentences.
      expect(
        find.textContaining('Your orders, and the tax invoices issued'),
        findsOneWidget,
      );
      expect(
        find.textContaining('deleting your account does not lift it'),
        findsOneWidget,
      );
      expect(
        find.textContaining('UNLINKED from your profile'),
        findsOneWidget,
        reason: 'the buyer must be told the records survive AND that their '
            'identity is stripped from them',
      );
      expect(
        find.textContaining('Deletion is scheduled, not instant'),
        findsOneWidget,
      );
    });

    testWidgets('it never claims the data is already gone', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = servingDeletion();
      await pumpAccountScreen(
        tester,
        const DeleteAccountScreen(email: 'buyer@example.ae'),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.tap(stepOne());
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const ValueKey<String>('delete-email')),
        'buyer@example.ae',
      );
      await tester.pump();
      await tester.tap(stepTwo());
      await settleRequests(tester);

      expect(find.textContaining('has been deleted'), findsNothing);
      expect(find.textContaining('All your data'), findsNothing);
    });
  });

  group('deletion stays reachable when /v1/me is down', () {
    testWidgets('which is exactly today, and the gate must still work', (
      WidgetTester tester,
    ) async {
      // `GET /v1/me` 404s, so the screen cannot know the account email. It
      // must NOT block: an App Store gate that only works when an unrelated
      // endpoint is healthy is not a gate.
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const DeleteAccountScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.tap(stepOne());
      await tester.pumpAndSettle();

      expect(
        find.textContaining('We could not load your profile'),
        findsOneWidget,
      );
      await tester.enterText(
        find.byKey(const ValueKey<String>('delete-email')),
        'someone@example.ae',
      );
      await tester.pump();
      expect(
        tester.widget<KeyButton>(stepTwo()).onPressed,
        isNotNull,
        reason: 'the SERVER checks confirmEmail; the client must not be the '
            'thing that makes deletion impossible',
      );
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
        const DeleteAccountScreen(email: 'buyer@example.ae'),
        overrides: harness.overrides,
        locale: const Locale('ar'),
        textScale: 2.0,
      );
      await settleRequests(tester);
      expect(tester.takeException(), isNull);
    });
  });
}
