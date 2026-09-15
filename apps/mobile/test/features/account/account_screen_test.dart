import 'package:avenick/api/models/enums.dart';
import 'package:avenick/core/ui/async_state_view.dart';
import 'package:avenick/features/account/account.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../api/fake_transport.dart';
import '../../api/fixtures.dart' as fixtures;
import 'harness.dart';

/// The account hub, in all four states of `GET /v1/me`.
void main() {
  AccountHarness servingMe([Map<String, dynamic>? me]) => AccountHarness(
        handler: (RequestOptions options) =>
            FakeResponse.data(me ?? fixtures.me()),
      );

  group('the four states', () {
    testWidgets('1 · loading shows a list skeleton, not a spinner', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness(
        handler: (RequestOptions options) => FakeResponse(
          200,
          <String, dynamic>{'data': fixtures.me()},
          headers: const <String, String>{'x-request-id': 'req_slow'},
          delay: const Duration(milliseconds: 300),
        ),
      );
      await pumpAccountScreen(
        tester,
        const AccountScreen(),
        overrides: harness.overrides,
      );

      expect(find.byType(MeridianSkeleton), findsOneWidget);
      expect(
        find.byType(CircularProgressIndicator),
        findsNothing,
        reason: 'a skeleton for a known shape reserves the space and says what '
            'is coming; a spinner is for a blocking action with no shape',
      );

      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump();
      await tester.pumpAndSettle();
    });

    testWidgets('2 · data shows the identity and the links', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = servingMe();
      await pumpAccountScreen(
        tester,
        const AccountScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(
        find.byKey(const ValueKey<String>('account-name')),
        findsOneWidget,
      );
      expect(find.text('Salim Al Habsi'), findsOneWidget);
      expect(find.textContaining('buyer@example.ae'), findsOneWidget);
      // The phone comes back as +971501234567 and is rendered grouped.
      expect(find.textContaining('+971 50 123 4567'), findsOneWidget);

      for (final String key in <String>[
        'account-orders',
        'account-addresses',
        'account-wishlist',
        'account-support',
        'account-language',
        'account-market',
        'account-notifications',
        'account-sign-out',
        'account-delete',
      ]) {
        expect(
          find.byKey(ValueKey<String>(key)),
          findsOneWidget,
          reason: '$key must be on the hub',
        );
      }
    });

    testWidgets('3 · empty: a profile with no name and no phone', (
      WidgetTester tester,
    ) async {
      // An account imported from an email list. Not a failure, and not a blank
      // screen — a third thing, which is why AsyncStateView demands a branch.
      final Map<String, dynamic> bare = <String, dynamic>{
        ...fixtures.me(),
        'firstName': '',
        'lastName': '',
        'firstNameAr': null,
        'lastNameAr': null,
        'phone': null,
      };
      final AccountHarness harness = servingMe(bare);
      await pumpAccountScreen(
        tester,
        const AccountScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(
        find.byKey(const ValueKey<String>('account-empty-profile')),
        findsOneWidget,
      );
      expect(find.text('Your profile is empty'), findsOneWidget);
      // And the settings are still reachable, because that is what someone in
      // this state needs.
      expect(
        find.byKey(const ValueKey<String>('account-sign-out')),
        findsOneWidget,
      );
      expect(find.textContaining('PATCH /v1/me'), findsOneWidget);
    });

    testWidgets('4 · error names GET /v1/me and draws no rows', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const AccountScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(find.textContaining('GET /v1/me'), findsOneWidget);
      expect(find.textContaining('no such route'), findsOneWidget);
      expect(find.textContaining('req_unbuilt'), findsOneWidget);
      expect(
        find.byKey(const ValueKey<String>('account-sign-out')),
        findsNothing,
        reason: 'a settings list over an identity nobody could load is a list '
            'of controls acting on an unknown account',
      );
    });
  });

  group('rows that cannot work say why', () {
    testWidgets('the wishlist row is disabled with its reason on it', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = servingMe();
      await pumpAccountScreen(
        tester,
        const AccountScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      final AccountRow row = tester.widget<AccountRow>(
        find.byKey(const ValueKey<String>('account-wishlist')),
      );
      expect(row.onTap, isNull);
      expect(row.disabledReason, isNotNull);
      expect(
        find.textContaining('no wishlist endpoint in the contract'),
        findsOneWidget,
      );
    });

    testWidgets('a wired callback makes the row live', (
      WidgetTester tester,
    ) async {
      int opened = 0;
      final AccountHarness harness = servingMe();
      await pumpAccountScreen(
        tester,
        AccountScreen(onOpenOrders: () => opened++),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.tap(find.byKey(const ValueKey<String>('account-orders')));
      await tester.pump();
      expect(opened, 1);
    });
  });

  group('the device-local preferences DO work', () {
    testWidgets('choosing a market persists it and updates the row', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = servingMe();
      await pumpAccountScreen(
        tester,
        const AccountScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(find.textContaining('United Arab Emirates'), findsOneWidget);

      await tester.ensureVisible(
        find.byKey(const ValueKey<String>('account-market')),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey<String>('account-market')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey<String>('market-SA')));
      await tester.pumpAndSettle();

      expect(find.textContaining('Saudi Arabia'), findsOneWidget);
      expect(find.textContaining('SAR'), findsOneWidget);
      expect(
        harness.preferencesStore.writes.last.market,
        GccMarket.sa,
        reason: 'the choice must survive a cold start, not just a rebuild',
      );
    });

    testWidgets('choosing Arabic mirrors the account screens immediately', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = servingMe();
      await pumpAccountScreen(
        tester,
        const AccountScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.ensureVisible(
        find.byKey(const ValueKey<String>('account-language')),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey<String>('account-language')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey<String>('language-AR')));
      await tester.pumpAndSettle();

      expect(
        harness.preferencesStore.writes.last.languageOverride,
        Language.ar,
      );

      // The subtree is genuinely mirrored — this is not a preference written
      // to a file nobody reads.
      final Directionality directionality = tester.widget<Directionality>(
        find
            .descendant(
              of: find.byType(AccountLocaleScope),
              matching: find.byType(Directionality),
            )
            .first,
      );
      expect(directionality.textDirection, TextDirection.rtl);
      // The Arabic name from `Me` is what shows now.
      expect(find.text('سالم الحبسي'), findsOneWidget);
    });

    testWidgets('"follow my device" is the default and overrides nothing', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = servingMe();
      await pumpAccountScreen(
        tester,
        const AccountScreen(),
        overrides: harness.overrides,
        locale: const Locale('ar'),
      );
      await settleRequests(tester);

      // The device says Arabic and nothing has been chosen, so the app is in
      // Arabic without anybody choosing anything.
      expect(find.text('Follow my device'), findsOneWidget);
      expect(
        find.byType(AccountLocaleScope),
        findsWidgets,
        reason: 'the scope is present but transparent when nothing is chosen',
      );
    });
  });

  group('a suspended account is told before checkout, not at it', () {
    testWidgets('the status notice appears for a suspended user', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = servingMe(<String, dynamic>{
        ...fixtures.me(),
        'status': 'SUSPENDED',
      });
      await pumpAccountScreen(
        tester,
        const AccountScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(
        find.byKey(const ValueKey<String>('account-status-notice')),
        findsOneWidget,
      );
      expect(find.textContaining('cannot place an order'), findsOneWidget);
    });
  });

  group('layout', () {
    testWidgets('every row clears 48dp', (WidgetTester tester) async {
      final AccountHarness harness = servingMe();
      await pumpAccountScreen(
        tester,
        const AccountScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      for (final Element element in find.byType(AccountRow).evaluate()) {
        final Size size = tester.getSize(
          find.byElementPredicate((Element e) => identical(e, element)),
        );
        expect(
          size.height,
          greaterThanOrEqualTo(48.0),
          reason: 'rowH in the tokens is 44 — four short of the platform floor',
        );
      }
    });

    testWidgets('it survives Arabic and 200% text', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = servingMe();
      await pumpAccountScreen(
        tester,
        const AccountScreen(),
        overrides: harness.overrides,
        locale: const Locale('ar'),
        textScale: 2.0,
      );
      await settleRequests(tester);
      expect(tester.takeException(), isNull);
    });
  });
}
