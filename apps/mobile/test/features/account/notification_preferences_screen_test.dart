import 'package:avenick/api/models/enums.dart';
import 'package:avenick/core/ui/async_state_view.dart';
import 'package:avenick/core/ui/key_button.dart';
import 'package:avenick/features/account/account.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:riverpod/misc.dart' show Override;

import '../../api/fake_transport.dart';
import 'harness.dart';

void main() {
  Map<String, dynamic> prefs(Map<String, bool> categories) =>
      <String, dynamic>{'categories': categories};

  AccountHarness serving(Map<String, bool> categories) => AccountHarness(
        handler: (RequestOptions options) =>
            FakeResponse.data(prefs(categories)),
      );

  group('the four states', () {
    testWidgets('1 · loading shows a skeleton', (WidgetTester tester) async {
      final AccountHarness harness = AccountHarness(
        handler: (RequestOptions options) => FakeResponse(
          200,
          <String, dynamic>{
            'data': prefs(const <String, bool>{'orders': true}),
          },
          headers: const <String, String>{'x-request-id': 'req_slow'},
          delay: const Duration(milliseconds: 300),
        ),
      );
      await pumpAccountScreen(
        tester,
        const NotificationPreferencesScreen(),
        overrides: harness.overrides,
      );

      expect(find.byType(MeridianSkeleton), findsOneWidget);
      expect(
        find.byKey(const ValueKey<String>('notifications-toggles')),
        findsNothing,
      );

      await tester.pump(const Duration(milliseconds: 400));
      await settleRequests(tester);
      expect(find.byType(MeridianSkeleton), findsNothing);
    });

    testWidgets('2 · data draws one toggle per category', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = serving(const <String, bool>{
        'orders': true,
        'stock': false,
        'offers': false,
        'security': true,
      });
      await pumpAccountScreen(
        tester,
        const NotificationPreferencesScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(
        find.byKey(const ValueKey<String>('notifications-toggles')),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey<String>('notification-orders')),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey<String>('notification-offers')),
        findsOneWidget,
      );
      // B2B-only categories stay off a consumer's screen.
      expect(
        find.byKey(const ValueKey<String>('notification-b2b_approvals')),
        findsNothing,
      );

      expect(
        tester
            .widget<Switch>(
              find.byKey(const ValueKey<String>('notification-orders')),
            )
            .value,
        isTrue,
      );
      expect(
        tester
            .widget<Switch>(
              find.byKey(const ValueKey<String>('notification-offers')),
            )
            .value,
        isFalse,
      );
    });

    testWidgets('3 · empty: the server holds no preferences yet', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = serving(const <String, bool>{});
      await pumpAccountScreen(
        tester,
        const NotificationPreferencesScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(
        find.byKey(const ValueKey<String>('notifications-empty')),
        findsOneWidget,
      );
      expect(find.text('Nothing chosen yet'), findsOneWidget);
    });

    testWidgets('4 · error draws NO toggles at all', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const NotificationPreferencesScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(
        find.textContaining('GET /v1/me/notification-preferences'),
        findsWidgets,
      );
      expect(find.textContaining('req_unbuilt'), findsOneWidget);
      expect(
        find.byKey(const ValueKey<String>('notifications-toggles')),
        findsNothing,
        reason: 'a switch that slides and changes nothing is the worst '
            'possible outcome on this screen',
      );
      expect(find.byType(Switch), findsNothing);
      // And the contract gap is stated in every state.
      expect(
        find.byKey(const ValueKey<String>('notifications-contract-gap')),
        findsOneWidget,
      );
    });
  });

  group('a category the server refuses does not flip', () {
    testWidgets('the switch stays where it was, and the failure is named', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness(
        handler: (RequestOptions options) {
          if (options.method == 'PATCH') {
            return FakeResponse.error(
              404,
              'not_found',
              message: 'Not found.',
              requestId: 'req_patch',
            );
          }
          return FakeResponse.data(
            prefs(const <String, bool>{'orders': true, 'offers': false}),
          );
        },
      );
      await pumpAccountScreen(
        tester,
        const NotificationPreferencesScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.tap(
        find.byKey(const ValueKey<String>('notification-offers')),
      );
      await settleRequests(tester);

      expect(
        find.byKey(const ValueKey<String>('notifications-save-failure')),
        findsOneWidget,
      );
      // Twice: in the failure notice, and in the standing contract-gap note
      // that is shown in every state.
      expect(
        find.textContaining('PATCH /v1/me/notification-preferences'),
        findsNWidgets(2),
      );
      expect(
        find.textContaining('"Offers and promotions" is unchanged'),
        findsOneWidget,
      );
      expect(
        tester
            .widget<Switch>(
              find.byKey(const ValueKey<String>('notification-offers')),
            )
            .value,
        isFalse,
        reason: 'the SERVER decides what the switch shows; an optimistic flip '
            'the server rejects leaves a setting nobody has',
      );
    });
  });

  group('security alerts cannot be turned off', () {
    testWidgets('the switch is on and disabled, with the reason', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = serving(const <String, bool>{
        'orders': true,
        'security': false,
      });
      await pumpAccountScreen(
        tester,
        const NotificationPreferencesScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      final Switch security = tester.widget<Switch>(
        find.byKey(const ValueKey<String>('notification-security')),
      );
      expect(
        security.value,
        isTrue,
        reason: 'alwaysOn wins over whatever the server stored',
      );
      expect(security.onChanged, isNull);
      expect(find.textContaining('cannot be turned off'), findsOneWidget);
    });
  });

  group('the OS permission is never asked for on arrival', () {
    testWidgets('no primer until a value moment has been reached', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = serving(const <String, bool>{
        'orders': true,
      });
      await pumpAccountScreen(
        tester,
        const NotificationPreferencesScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(
        find.byKey(const ValueKey<String>('notifications-primer')),
        findsNothing,
        reason: 'the system prompt is one-shot per install; asking on arrival '
            'and being denied costs every delivery notification forever',
      );
    });

    testWidgets('after a value moment the primer appears — and only then', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = serving(const <String, bool>{
        'orders': true,
      });
      await pumpAccountScreen(
        tester,
        const NotificationPreferencesScreen(),
        overrides: <Override>[
          ...harness.overrides,
          // Set by whichever feature reached the value moment — an order
          // placed, a stock alert asked for. Never by this screen.
          notificationValueMomentProvider.overrideWith(
            () => _ReachedValueMoment(),
          ),
        ],
      );
      await settleRequests(tester);

      expect(
        find.byKey(const ValueKey<String>('notifications-primer')),
        findsOneWidget,
      );
    });

    testWidgets('"Not now" dismisses and fires NOTHING', (
      WidgetTester tester,
    ) async {
      int asked = 0;
      final AccountHarness harness = serving(const <String, bool>{
        'orders': true,
      });
      await pumpAccountScreen(
        tester,
        NotificationPreferencesScreen(
          onRequestSystemPermission: () async => asked++,
        ),
        overrides: <Override>[
          ...harness.overrides,
          notificationValueMomentProvider.overrideWith(
            () => _ReachedValueMoment(),
          ),
        ],
      );
      await settleRequests(tester);

      await tester.tap(find.byKey(const ValueKey<String>('primer-not-now')));
      await tester.pumpAndSettle();

      expect(
        asked,
        0,
        reason: 'the whole point of a pre-permission explainer is that "no" '
            'does not spend the one OS prompt this install gets',
      );
      expect(
        find.byKey(const ValueKey<String>('notifications-primer')),
        findsNothing,
      );
    });

    testWidgets('"Yes" calls the platform, once', (WidgetTester tester) async {
      int asked = 0;
      final AccountHarness harness = serving(const <String, bool>{
        'orders': true,
      });
      await pumpAccountScreen(
        tester,
        NotificationPreferencesScreen(
          onRequestSystemPermission: () async => asked++,
        ),
        overrides: <Override>[
          ...harness.overrides,
          notificationValueMomentProvider.overrideWith(
            () => _ReachedValueMoment(),
          ),
        ],
      );
      await settleRequests(tester);

      await tester.tap(find.byKey(const ValueKey<String>('primer-ask')));
      await tester.pumpAndSettle();
      expect(asked, 1);
    });

    testWidgets('with no platform hook the ask button is disabled, not inert', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = serving(const <String, bool>{
        'orders': true,
      });
      await pumpAccountScreen(
        tester,
        // No callback — which is today: there is no push plugin in
        // pubspec.yaml, so nothing in this binary can ask the OS.
        const NotificationPreferencesScreen(),
        overrides: <Override>[
          ...harness.overrides,
          notificationValueMomentProvider.overrideWith(
            () => _ReachedValueMoment(),
          ),
        ],
      );
      await settleRequests(tester);

      expect(
        tester
            .widget<KeyButton>(
              find.byKey(const ValueKey<String>('primer-ask')),
            )
            .onPressed,
        isNull,
      );
      expect(
        find.byKey(const ValueKey<String>('primer-cannot-ask')),
        findsOneWidget,
      );
      expect(
        find.textContaining('no push plugin in pubspec.yaml'),
        findsOneWidget,
      );
    });
  });

  group('B2B', () {
    testWidgets('a company buyer gets the approvals category', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = serving(const <String, bool>{
        'orders': true,
        'b2b_approvals': true,
      });
      await pumpAccountScreen(
        tester,
        const NotificationPreferencesScreen(isB2b: true),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(
        find.byKey(const ValueKey<String>('notification-b2b_approvals')),
        findsOneWidget,
      );
    });
  });

  group('layout', () {
    testWidgets('it survives Arabic and 200% text', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness(
        preferences: const AccountPreferences(
          market: GccMarket.sa,
          languageOverride: Language.ar,
        ),
        handler: (RequestOptions options) => FakeResponse.data(
          prefs(const <String, bool>{
            'orders': true,
            'stock': false,
            'offers': false,
            'security': true,
            'b2b_approvals': true,
          }),
        ),
      );
      await pumpAccountScreen(
        tester,
        const NotificationPreferencesScreen(isB2b: true),
        overrides: <Override>[
          ...harness.overrides,
          notificationValueMomentProvider.overrideWith(
            () => _ReachedValueMoment(),
          ),
        ],
        locale: const Locale('ar'),
        textScale: 2.0,
      );
      await settleRequests(tester);

      expect(tester.takeException(), isNull);
    });
  });
}

/// The app AFTER a value moment. Nothing in the account feature ever produces
/// this state on its own — commerce does, once an order is placed.
class _ReachedValueMoment extends NotificationValueMoment {
  @override
  bool build() => true;
}
