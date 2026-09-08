import 'package:avenick/api/models/account.dart';
import 'package:avenick/api/models/enums.dart';
import 'package:avenick/core/ui/key_button.dart';
import 'package:avenick/features/account/account.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../api/fake_transport.dart';
import '../../api/fixtures.dart' as fixtures;
import 'harness.dart';

/// The GCC-shaped address form.
void main() {
  Finder field(String key) => find.byKey(ValueKey<String>(key));
  Finder save() => find.byKey(const ValueKey<String>('address-save'));

  bool canSave(WidgetTester tester) =>
      tester.widget<KeyButton>(save()).onPressed != null;

  Future<void> fillRequired(WidgetTester tester) async {
    await tester.enterText(field('address-label'), 'Home');
    await tester.enterText(field('address-line1'), 'Al Barsha 1, Street 12');
    await tester.enterText(field('address-city'), 'Dubai');
    await tester.pump();
  }

  group('the four states', () {
    testWidgets('1 · a blank form cannot be saved', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const AddressEditScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(canSave(tester), isFalse);
      expect(harness.adapter.requests, isEmpty);
    });

    testWidgets('2 · the contract-required fields arm the save', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const AddressEditScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await fillRequired(tester);
      expect(canSave(tester), isTrue);
    });

    testWidgets('3 · busy while saving', (WidgetTester tester) async {
      final AccountHarness harness = AccountHarness(
        handler: (RequestOptions options) => FakeResponse(
          200,
          <String, dynamic>{'data': fixtures.address()},
          headers: const <String, String>{'x-request-id': 'req_slow'},
          delay: const Duration(milliseconds: 300),
        ),
      );
      await pumpAccountScreen(
        tester,
        const AddressEditScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await fillRequired(tester);
      await tester.tap(save());
      await tester.pump();

      expect(tester.widget<KeyButton>(save()).busy, isTrue);
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();
    });

    testWidgets('4 · failure names POST /v1/addresses', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const AddressEditScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await fillRequired(tester);
      await tester.tap(save());
      await settleRequests(tester);

      expect(
        find.byKey(const ValueKey<String>('address-failure')),
        findsOneWidget,
      );
      expect(find.textContaining('POST /v1/addresses'), findsOneWidget);
      expect(find.textContaining('req_unbuilt'), findsOneWidget);
    });
  });

  group('the postcode is decorative here, and never blocks', () {
    testWidgets('an empty postcode saves fine', (WidgetTester tester) async {
      final AccountHarness harness = AccountHarness(
        handler: (RequestOptions options) =>
            FakeResponse.data(fixtures.address()),
      );
      await pumpAccountScreen(
        tester,
        const AddressEditScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await fillRequired(tester);
      expect(canSave(tester), isTrue);
      await tester.tap(save());
      await settleRequests(tester);

      final Map<String, dynamic>? body = harness.bodyOf('/v1/addresses');
      expect(body, isNotNull);
      expect(
        body!.containsKey('postalCode'),
        isFalse,
        reason: 'an empty optional is OMITTED, not sent as null — the schema '
            'is .optional() and an explicit null is a 400',
      );
    });

    testWidgets('nonsense in the postcode does not block the save', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness(
        handler: (RequestOptions options) =>
            FakeResponse.data(fixtures.address()),
      );
      await pumpAccountScreen(
        tester,
        const AddressEditScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await fillRequired(tester);
      await tester.enterText(field('address-postal'), 'not a postcode at all');
      await tester.pump();

      expect(
        canSave(tester),
        isTrue,
        reason: 'blocking on a postcode that most GCC couriers ignore is the '
            'single most common way a Western form locks a Gulf customer out '
            'of checkout',
      );
    });
  });

  group('the map pin', () {
    testWidgets('a pasted Google Maps link becomes latitude and longitude', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness(
        handler: (RequestOptions options) =>
            FakeResponse.data(fixtures.address()),
      );
      await pumpAccountScreen(
        tester,
        const AddressEditScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await fillRequired(tester);
      await tester.enterText(
        field('address-pin'),
        'https://www.google.com/maps/place/x/@25.1,55.1,17z/'
        'data=!3m1!4b1!4m5!3m4!8m2!3d25.197197!4d55.274376',
      );
      await tester.pump();

      // Read back, so the person can see what was understood.
      expect(
        find.byKey(const ValueKey<String>('address-pin-readback')),
        findsOneWidget,
      );
      // Twice: once in the field the person pasted into, once in the
      // read-back beneath it.
      expect(find.textContaining('25.197197'), findsNWidgets(2));

      await tester.tap(save());
      await settleRequests(tester);

      final Map<String, dynamic>? body = harness.bodyOf('/v1/addresses');
      expect(body!['latitude'], closeTo(25.197197, 1e-9));
      expect(body['longitude'], closeTo(55.274376, 1e-9));
    });

    testWidgets('an unreadable pin blocks the save and says why', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const AddressEditScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await fillRequired(tester);
      await tester.enterText(field('address-pin'), 'behind the ADNOC station');
      await tester.pump();

      expect(
        canSave(tester),
        isFalse,
        reason: 'silently dropping a pin someone typed is worse than refusing '
            'it',
      );
      expect(
        find.textContaining('could not find coordinates in that'),
        findsOneWidget,
      );
    });

    testWidgets('a pin outside the Gulf warns but still saves', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness(
        handler: (RequestOptions options) =>
            FakeResponse.data(fixtures.address()),
      );
      await pumpAccountScreen(
        tester,
        const AddressEditScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await fillRequired(tester);
      await tester.enterText(field('address-pin'), '51.5074, -0.1278');
      await tester.pump();

      expect(find.textContaining('outside the Gulf'), findsOneWidget);
      expect(find.textContaining('the wrong way round'), findsOneWidget);
      expect(canSave(tester), isTrue);
    });
  });

  group('the landmark', () {
    testWidgets('is stored in line2, and round-trips on edit', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness(
        handler: (RequestOptions options) =>
            FakeResponse.data(fixtures.address()),
      );
      await pumpAccountScreen(
        tester,
        const AddressEditScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await fillRequired(tester);
      await tester.enterText(
        field('address-landmark'),
        'Villa 12, behind ADNOC, near the mosque',
      );
      await tester.pump();
      await tester.tap(save());
      await settleRequests(tester);

      expect(
        harness.bodyOf('/v1/addresses')!['line2'],
        'Villa 12, behind ADNOC, near the mosque',
        reason: 'line2 is the only free-text slot the contract has; a '
            'first-class landmark field is what this screen wants',
      );
    });

    testWidgets('an existing line2 comes back in the landmark field', (
      WidgetTester tester,
    ) async {
      final Address existing = Address.fromJson(<String, dynamic>{
        ...fixtures.address(),
        'line2': 'Villa 12, behind ADNOC',
      });
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        AddressEditScreen(address: existing),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(find.text('Villa 12, behind ADNOC'), findsOneWidget);
      // And the stored coordinates come back in the pin field, with the
      // read-back confirming them.
      expect(find.textContaining('25.346300'), findsNWidgets(2));
    });

    testWidgets('clearing it sends an explicit null, not an omission', (
      WidgetTester tester,
    ) async {
      final Address existing = Address.fromJson(<String, dynamic>{
        ...fixtures.address(),
        'line2': 'Villa 12, behind ADNOC',
      });
      final AccountHarness harness = AccountHarness(
        handler: (RequestOptions options) =>
            FakeResponse.data(fixtures.address()),
      );
      await pumpAccountScreen(
        tester,
        AddressEditScreen(address: existing),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await tester.enterText(field('address-landmark'), '');
      await tester.pump();
      await tester.tap(save());
      await settleRequests(tester);

      final Map<String, dynamic>? body = harness.bodyOf(
        '/v1/addresses/adr_1',
      );
      expect(body, isNotNull);
      expect(
        body!.containsKey('line2'),
        isTrue,
        reason: 'omitting would leave the old landmark in place — that is how '
            'a deleted landmark comes back',
      );
      expect(body['line2'], isNull);
    });
  });

  group('the driver phone has nowhere to go, and says so', () {
    testWidgets('the field is disabled with the contract gap named', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness.unbuiltBackend();
      await pumpAccountScreen(
        tester,
        const AddressEditScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      final TextField phone = tester.widget<TextField>(
        field('address-driver-phone'),
      );
      expect(
        phone.enabled,
        isFalse,
        reason: 'a field that swallows what you type is worse than one that '
            'says it cannot take it yet',
      );
      expect(
        find.byKey(const ValueKey<String>('address-driver-phone-reason')),
        findsOneWidget,
      );
      expect(
        find.textContaining('no field for a contact number'),
        findsOneWidget,
      );
    });
  });

  group('server validation lands on the field it belongs to', () {
    testWidgets('a Zod fieldErrors map is shown per field', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness(
        handler: (RequestOptions options) => FakeResponse.error(
          400,
          'validation_failed',
          message: 'The request is not valid.',
          requestId: 'req_val',
          fieldErrors: <String, dynamic>{
            'city': <String>['We do not deliver to that city.'],
          },
        ),
      );
      await pumpAccountScreen(
        tester,
        const AddressEditScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      await fillRequired(tester);
      await tester.tap(save());
      await settleRequests(tester);

      expect(find.text('We do not deliver to that city.'), findsOneWidget);
      expect(
        find.byKey(const ValueKey<String>('address-failure')),
        findsNothing,
        reason: 'a per-field error shown as one banner makes the user hunt '
            'for which of nine inputs is wrong',
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
        const AddressEditScreen(),
        overrides: harness.overrides,
        locale: const Locale('ar'),
        textScale: 2.0,
      );
      await settleRequests(tester);
      expect(tester.takeException(), isNull);
    });

    testWidgets('the country defaults to the selected market', (
      WidgetTester tester,
    ) async {
      final AccountHarness harness = AccountHarness(
        preferences: const AccountPreferences(market: GccMarket.kw),
        handler: (RequestOptions options) =>
            FakeResponse.data(fixtures.address()),
      );
      await pumpAccountScreen(
        tester,
        const AddressEditScreen(),
        overrides: harness.overrides,
      );
      await settleRequests(tester);

      expect(find.text('Kuwait'), findsOneWidget);

      await fillRequired(tester);
      await tester.tap(save());
      await settleRequests(tester);
      expect(harness.bodyOf('/v1/addresses')!['country'], 'KW');
    });
  });
}
