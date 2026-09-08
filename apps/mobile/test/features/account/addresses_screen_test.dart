import 'package:avenick/api/models/enums.dart';
import 'package:avenick/core/ui/async_state_view.dart';
import 'package:avenick/features/account/account.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../api/fake_transport.dart';
import '../../api/fixtures.dart' as fixtures;
import 'harness.dart';

void main() {
  Map<String, dynamic> addressWith({
    String id = 'adr_1',
    String label = 'Warehouse',
    String? line2,
    bool isDefault = true,
    double? latitude = 25.3463,
    double? longitude = 55.4209,
  }) =>
      <String, dynamic>{
        ...fixtures.address(),
        'id': id,
        'label': label,
        'line2': line2,
        'isDefault': isDefault,
        'latitude': latitude,
        'longitude': longitude,
      };

  AccountHarness serving(List<Map<String, dynamic>> book) => AccountHarness(
        handler: (RequestOptions options) =>
            FakeResponse.data(<Map<String, dynamic>>[...book]),
      );

  group('the four states', () {
    testWidgets('1 · loading shows a list skeleton', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness(
        handler: (RequestOptions options) => FakeResponse(
          200,
          <String, dynamic>{
            'data': <Map<String, dynamic>>[fixtures.address()],
          },
          headers: const <String, String>{'x-request-id': 'req_slow'},
          delay: const Duration(milliseconds: 300),
        ),
      );
      await pumpAccountScreen(
        tester,
        const AddressesScreen(),
        overrides: harness.overrides,
      );

      expect(find.byType(MeridianSkeleton), findsOneWidget);
      // No pumpAndSettle: the skeleton's shimmer repeats forever by design.
      await tester.pump(const Duration(milliseconds: 400));
      await settleRequests(tester);
      expect(find.byType(MeridianSkeleton), findsNothing);
    });

    testWidgets('2 · data puts the LANDMARK above the street line', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = serving(<Map<String, dynamic>>[
        addressWith(line2: 'Villa 12, behind ADNOC, near the mosque'),
      ]);
      await pumpAccountScreen(
        tester,
        const AddressesScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      final Finder landmark = find.text(
        'Villa 12, behind ADNOC, near the mosque',
      );
      final Finder street = find.textContaining('Plot 42, Industrial Area 3');
      expect(landmark, findsOneWidget);
      expect(street, findsOneWidget);
      expect(
        tester.getTopLeft(landmark).dy,
        lessThan(tester.getTopLeft(street).dy),
        reason: 'the landmark is what actually finds the door here, so it '
            'reads first',
      );
      expect(
        find.byKey(const ValueKey<String>('address-default')),
        findsOneWidget,
      );
    });

    testWidgets('3 · empty says what an address here is made of', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = serving(const <Map<String, dynamic>>[]);
      await pumpAccountScreen(
        tester,
        const AddressesScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(
        find.byKey(const ValueKey<String>('addresses-empty')),
        findsOneWidget,
      );
      expect(find.text('No addresses saved'), findsOneWidget);
      expect(
        find.textContaining(
          'A landmark and a dropped pin matter more here than a street name',
        ),
        findsOneWidget,
      );
      // The way out is still on screen.
      expect(
        find.byKey(const ValueKey<String>('addresses-add')),
        findsOneWidget,
      );
    });

    testWidgets('4 · error names GET /v1/addresses with the request id', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const AddressesScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(find.textContaining('GET /v1/addresses'), findsOneWidget);
      expect(find.textContaining('req_unbuilt'), findsOneWidget);
      expect(find.textContaining('Nothing was saved'), findsOneWidget);
    });
  });

  group('an address with no pin is flagged', () {
    testWidgets('because a driver will have to call', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = serving(<Map<String, dynamic>>[
        addressWith(latitude: null, longitude: null),
      ]);
      await pumpAccountScreen(
        tester,
        const AddressesScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(
        find.text('No map pin. A driver will have to call.'),
        findsOneWidget,
      );
    });
  });

  group('destructive actions confirm first', () {
    testWidgets('delete asks, and a refusal sends nothing', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = serving(<Map<String, dynamic>>[
        addressWith(),
      ]);
      await pumpAccountScreen(
        tester,
        const AddressesScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.tap(find.byTooltip('Delete Warehouse'));
      await tester.pumpAndSettle();
      expect(find.text('Delete this address?'), findsOneWidget);

      await tester.tap(find.text('Keep it'));
      await tester.pumpAndSettle();

      expect(
        harness.adapter.requests
            .where((RequestOptions r) => r.method == 'DELETE')
            .isEmpty,
        isTrue,
      );
    });

    testWidgets('confirming reports the unbuilt endpoint rather than lying', (
      WidgetTester tester,
    ) async {
      // The book loads, the DELETE 404s. The row must not vanish from the list
      // as though it had worked.
      final AccountHarness harness = AccountHarness(
        handler: (RequestOptions options) {
          if (options.method == 'DELETE') {
            return FakeResponse.error(
              404,
              'not_found',
              message: 'Not found.',
              requestId: 'req_del',
            );
          }
          return FakeResponse.data(<Map<String, dynamic>>[addressWith()]);
        },
      );
      await pumpAccountScreen(
        tester,
        const AddressesScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.tap(find.byTooltip('Delete Warehouse'));
      await tester.pumpAndSettle();
      await tester.tap(
        find.byKey(const ValueKey<String>('address-delete-confirm')),
      );
      await settleRequests(tester);

      expect(
        find.textContaining('DELETE /v1/addresses/{id}'),
        findsOneWidget,
      );
      expect(find.textContaining('Nothing changed'), findsOneWidget);
      expect(
        find.text('Warehouse'),
        findsOneWidget,
        reason: 'the row must still be there — nothing was deleted',
      );
    });
  });

  group('accessibility', () {
    testWidgets('the icon-only delete button is labelled', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = serving(<Map<String, dynamic>>[
        addressWith(label: 'Home'),
      ]);
      await pumpAccountScreen(
        tester,
        const AddressesScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(
        find.byTooltip('Delete Home'),
        findsOneWidget,
        reason: 'an unlabelled icon button is announced as "button" beside '
            'four other unnamed buttons',
      );
      expect(
        tester.getSize(find.byTooltip('Delete Home')).height,
        greaterThanOrEqualTo(48.0),
      );
    });

    testWidgets('it survives Arabic and 200% text', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness(
        preferences: const AccountPreferences(
          market: GccMarket.sa,
          languageOverride: Language.ar,
        ),
        handler: (RequestOptions options) =>
            FakeResponse.data(<Map<String, dynamic>>[
          addressWith(line2: 'فيلا ١٢، خلف أدنوك'),
        ]),
      );
      await pumpAccountScreen(
        tester,
        const AddressesScreen(),
        overrides: harness.overrides,
        locale: const Locale('ar'),
        textScale: 2.0,
      );
      await settleRequests(tester);

      expect(tester.takeException(), isNull);
    });
  });
}
