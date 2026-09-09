import 'package:avenick/api/models/enums.dart';
import 'package:avenick/api/models/requests.dart';
import 'package:avenick/core/error/failures.dart';
import 'package:avenick/core/l10n/directional_text.dart';
import 'package:avenick/core/ui/async_state_view.dart';
import 'package:avenick/core/ui/key_button.dart';
import 'package:avenick/features/rfq/rfq.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'harness.dart';

const QuoteSubject _subject = QuoteSubject(
  productId: 'prd_1',
  slug: 'galvanised-scaffold-tube-48-3mm',
  quantity: 500,
);

void main() {
  Widget screen({
    QuoteSubject subject = _subject,
    void Function(String)? onCreated,
    VoidCallback? onSignInRequired,
  }) =>
      RequestQuoteScreen(
        subject: subject,
        onCreated: onCreated,
        onSignInRequired: onSignInRequired,
      );

  group('RequestQuoteScreen — the product lookup, in four states', () {
    testWidgets('loading — a skeleton, and submit is held back',
        (WidgetTester tester) async {
      await pumpRfq(
        tester,
        screen(),
        overrides: rfqOverrides(
          repository: FakeRfqRepository(),
          productSource: FakeQuotedProductSource(pending: true),
        ),
      );

      expect(find.byType(MeridianSkeleton), findsOneWidget);
      // The MOQ arrives with the product. A request sent before it lands is a
      // request that skipped the one rule this form exists to enforce.
      expect(find.text('Checking the product…'), findsOneWidget);
      final KeyButton submit = tester.widget<KeyButton>(
        find.byKey(const ValueKey<String>('rfq-submit')),
      );
      expect(submit.onPressed, isNull);
    });

    testWidgets('data — the product, its SKU and its minimum',
        (WidgetTester tester) async {
      await pumpRfq(
        tester,
        screen(),
        overrides: rfqOverrides(
          repository: FakeRfqRepository(),
          productSource: FakeQuotedProductSource(product: quotedProduct()),
        ),
      );
      await tester.pump();

      expect(find.text('Galvanised scaffold tube 48.3mm'), findsOneWidget);
      expect(findToken('GST-483', LtrToken.sku), findsOneWidget);
      expect(find.text('Supplied in minimums of 25.'), findsOneWidget);
      // A catalogue line is named by the server, so there is no name field.
      expect(find.byKey(const ValueKey<String>('rfq-item-name')), findsNothing);
    });

    testWidgets('empty — no product resolved, so the form asks in words',
        (WidgetTester tester) async {
      await pumpRfq(
        tester,
        // No productId in the query: `/rfq/new` with nothing on it.
        screen(subject: const QuoteSubject()),
        overrides: rfqOverrides(
          repository: FakeRfqRepository(),
          productSource: FakeQuotedProductSource(),
        ),
      );
      await tester.pump();

      expect(find.text('A request in your own words'), findsOneWidget);
      expect(
        find.byKey(const ValueKey<String>('rfq-item-name')),
        findsOneWidget,
      );
    });

    testWidgets('error — the form still works, and says the MOQ is unchecked',
        (WidgetTester tester) async {
      await pumpRfq(
        tester,
        screen(),
        overrides: rfqOverrides(
          repository: FakeRfqRepository(),
          productSource: FakeQuotedProductSource(
            failure: Exception('catalogue down'),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('The product could not be loaded'), findsOneWidget);
      // The point: a lookup failure must not block the app's primary action.
      final KeyButton submit = tester.widget<KeyButton>(
        find.byKey(const ValueKey<String>('rfq-submit')),
      );
      expect(submit.onPressed, isNotNull);
    });
  });

  group('RequestQuoteScreen — validation', () {
    testWidgets('MOQ: 4 of a product with a minimum of 25 cannot be sent',
        (WidgetTester tester) async {
      final FakeRfqRepository repo = FakeRfqRepository();
      await pumpRfq(
        tester,
        screen(),
        overrides: rfqOverrides(
          repository: repo,
          productSource: FakeQuotedProductSource(product: quotedProduct()),
        ),
      );
      await tester.pump();

      await tester.enterText(
        find.byKey(const ValueKey<String>('rfq-quantity')),
        '4',
      );
      await tester.pump();

      expect(
        find.textContaining('Ask for at least that many'),
        findsOneWidget,
      );
      final KeyButton submit = tester.widget<KeyButton>(
        find.byKey(const ValueKey<String>('rfq-submit')),
      );
      expect(submit.onPressed, isNull, reason: 'submit is disabled below MOQ');
      expect(repo.createCalls, 0);
    });

    testWidgets('the MOQ fix-it raises the quantity to the minimum',
        (WidgetTester tester) async {
      await pumpRfq(
        tester,
        screen(),
        overrides: rfqOverrides(
          repository: FakeRfqRepository(),
          productSource: FakeQuotedProductSource(product: quotedProduct()),
        ),
      );
      await tester.pump();

      await tester.enterText(
        find.byKey(const ValueKey<String>('rfq-quantity')),
        '4',
      );
      await tester.pump();
      await tester.tap(find.text('Ask for 25 instead'));
      await tester.pump();

      final KeyButton submit = tester.widget<KeyButton>(
        find.byKey(const ValueKey<String>('rfq-submit')),
      );
      expect(submit.onPressed, isNotNull);
    });

    testWidgets('the quantity from the buy box is carried in',
        (WidgetTester tester) async {
      await pumpRfq(
        tester,
        screen(),
        overrides: rfqOverrides(
          repository: FakeRfqRepository(),
          productSource: FakeQuotedProductSource(product: quotedProduct()),
        ),
      );
      await tester.pump();

      // `qty=500` from the route. Asking again would be asking the buyer to
      // repeat themselves.
      expect(find.text('500'), findsOneWidget);
    });

    testWidgets('no currency, no submit', (WidgetTester tester) async {
      await pumpRfq(
        tester,
        screen(),
        overrides: rfqOverrides(
          repository: FakeRfqRepository(),
          productSource: FakeQuotedProductSource(product: quotedProduct()),
          // The honest default: the app has not been told the buyer's market.
          currency: null,
        ),
      );
      await tester.pump();

      final KeyButton submit = tester.widget<KeyButton>(
        find.byKey(const ValueKey<String>('rfq-submit')),
      );
      expect(submit.onPressed, isNull);

      await tester.tap(find.byKey(const ValueKey<String>('rfq-submit')));
      await tester.pump();
      // Tapping a disabled key does nothing at all. What must never happen is
      // a send with a currency the buyer did not choose — `createRFQ` would
      // quietly quote it in AED.
      expect(
        findToken('KWD', LtrToken.reference),
        findsOneWidget,
        reason: 'the picker is offered',
      );
    });
  });

  group('RequestQuoteScreen — submission', () {
    testWidgets('sends one request, with the productId and no name',
        (WidgetTester tester) async {
      final FakeRfqRepository repo = FakeRfqRepository(created: rfqDetail());
      String? created;

      await pumpRfq(
        tester,
        screen(onCreated: (String id) => created = id),
        overrides: rfqOverrides(
          repository: repo,
          productSource: FakeQuotedProductSource(product: quotedProduct()),
        ),
      );
      await tester.pump();

      await tester.tap(find.byKey(const ValueKey<String>('rfq-submit')));
      await tester.pump();
      await tester.pump();

      expect(repo.createCalls, 1);
      final CreateRfqRequest sent = repo.createdRequests.single;
      expect(sent.currency, Currency.aed);
      expect(sent.items.single.productId, 'prd_1');
      expect(sent.items.single.nameEn, isNull);
      expect(sent.items.single.quantity, 500);
      expect(created, 'rfq_1');
    });

    testWidgets('THE DOUBLE-SUBMIT GUARD: two taps, one RFQ',
        (WidgetTester tester) async {
      // The button disables itself on rebuild, but a second tap can land in
      // the frame between the first tap and that rebuild. Only the controller's
      // own `_submitting` check stops that becoming a second request — and a
      // duplicate RFQ is a duplicate conversation with a supplier.
      final FakeRfqRepository repo = FakeRfqRepository(pending: true);

      await pumpRfq(
        tester,
        screen(),
        overrides: rfqOverrides(
          repository: repo,
          productSource: FakeQuotedProductSource(product: quotedProduct()),
        ),
      );
      await tester.pump();

      final Finder submit = find.byKey(const ValueKey<String>('rfq-submit'));
      await tester.tap(submit);
      // Deliberately no pump between the taps.
      await tester.tap(submit);
      await tester.pump();

      expect(repo.createCalls, 1);
    });

    testWidgets('while busy the button is busy and cannot be tapped again',
        (WidgetTester tester) async {
      final FakeRfqRepository repo = FakeRfqRepository(pending: true);
      await pumpRfq(
        tester,
        screen(),
        overrides: rfqOverrides(
          repository: repo,
          productSource: FakeQuotedProductSource(product: quotedProduct()),
        ),
      );
      await tester.pump();

      await tester.tap(find.byKey(const ValueKey<String>('rfq-submit')));
      await tester.pump();

      final KeyButton submit = tester.widget<KeyButton>(
        find.byKey(const ValueKey<String>('rfq-submit')),
      );
      expect(submit.busy, isTrue);
      expect(submit.onPressed, isNull);
    });

    testWidgets('a 401 asks the buyer to sign in and KEEPS the draft',
        (WidgetTester tester) async {
      // `/rfq/new` is deliberately not behind the app's auth guard while
      // `POST /v1/rfqs` is `auth: "required"`, so this is a normal path.
      final FakeRfqRepository repo =
          FakeRfqRepository(createFailure: unauthenticated());
      bool asked = false;

      await pumpRfq(
        tester,
        screen(onSignInRequired: () => asked = true),
        overrides: rfqOverrides(
          repository: repo,
          productSource: FakeQuotedProductSource(product: quotedProduct()),
        ),
      );
      await tester.pump();

      await tester.enterText(
        find.byKey(const ValueKey<String>('rfq-note')),
        'Needed in Jebel Ali before the 20th.',
      );
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey<String>('rfq-submit')));
      await tester.pump();
      await tester.pump();

      expect(find.text('Sign in to send this request'), findsOneWidget);
      // The draft survives. Losing what someone typed is how a funnel leaks.
      expect(
        find.text('Needed in Jebel Ali before the 20th.'),
        findsOneWidget,
      );

      await scrollTo(tester, find.text('Sign in'));
      await tester.tap(find.text('Sign in'));
      await tester.pump();
      expect(asked, isTrue);
    });

    testWidgets('a field-level validation failure lands under its field',
        (WidgetTester tester) async {
      final FakeRfqRepository repo = FakeRfqRepository(
        createFailure: const ApiFailure.validation(
          message: 'The request failed validation.',
          fieldErrors: <String, List<String>>{
            'items.0.quantity': <String>['Number must be less than 1000001'],
          },
        ),
      );

      await pumpRfq(
        tester,
        screen(),
        overrides: rfqOverrides(
          repository: repo,
          productSource: FakeQuotedProductSource(product: quotedProduct()),
        ),
      );
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey<String>('rfq-submit')));
      await tester.pump();
      await tester.pump();

      expect(find.text('Number must be less than 1000001'), findsOneWidget);
      // Not a banner: a validation error shown as one banner makes the buyer
      // hunt for which of four inputs is wrong.
      expect(find.text('The request was not sent'), findsNothing);
    });

    testWidgets('a transport failure is stated without losing the form',
        (WidgetTester tester) async {
      final FakeRfqRepository repo = FakeRfqRepository(
        createFailure: const ApiFailure.network(
          kind: NetworkFailureKind.offline,
          message: 'You appear to be offline.',
        ),
      );

      await pumpRfq(
        tester,
        screen(),
        overrides: rfqOverrides(
          repository: repo,
          productSource: FakeQuotedProductSource(product: quotedProduct()),
        ),
      );
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey<String>('rfq-submit')));
      await tester.pump();
      await tester.pump();

      expect(find.text('The request was not sent'), findsOneWidget);
      expect(find.text('You appear to be offline.'), findsOneWidget);
    });
  });

  group('RequestQuoteScreen — RTL and dynamic type', () {
    testWidgets('the SKU is bidi-isolated in Arabic',
        (WidgetTester tester) async {
      await pumpRfq(
        tester,
        screen(),
        overrides: rfqOverrides(
          repository: FakeRfqRepository(),
          productSource: FakeQuotedProductSource(product: quotedProduct()),
        ),
        locale: const Locale('ar'),
      );
      await tester.pump();

      // Not `find.text('GST-483')`: a SKU in an Arabic paragraph is reordered
      // by the bidi algorithm unless it is isolated, and what is on screen
      // would then not be what is in the database.
      expect(find.text('GST-483'), findsNothing);
      expect(findToken('GST-483', LtrToken.sku), findsOneWidget);
    });

    testWidgets('at 200% type the form still lays out and still submits',
        (WidgetTester tester) async {
      final FakeRfqRepository repo = FakeRfqRepository(created: rfqDetail());
      await pumpRfq(
        tester,
        screen(onCreated: (String _) {}),
        overrides: rfqOverrides(
          repository: repo,
          productSource: FakeQuotedProductSource(product: quotedProduct()),
        ),
        // The app-wide cap.
        textScale: 2.0,
      );
      await tester.pump();

      expect(tester.takeException(), isNull);
      await tester.tap(
        find.byKey(const ValueKey<String>('rfq-submit')),
        warnIfMissed: false,
      );
      await tester.pump();
      await tester.pump();
      expect(repo.createCalls, 1);
    });
  });
}
