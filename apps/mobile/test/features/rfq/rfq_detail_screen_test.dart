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

void main() {
  const Widget screen = RfqDetailScreen(rfqId: 'rfq_1');

  group('RfqDetailScreen — the four states', () {
    testWidgets('loading', (WidgetTester tester) async {
      await pumpRfq(
        tester,
        screen,
        overrides: rfqOverrides(repository: FakeRfqRepository(pending: true)),
      );
      expect(find.byType(MeridianSkeleton), findsOneWidget);
    });

    testWidgets('empty — a request with no lines is a record worth reporting',
        (WidgetTester tester) async {
      // The contract requires at least one line, so this is not a normal
      // state; it is a data fault, and it must not render as a blank screen
      // with a working scrollbar.
      await pumpRfq(
        tester,
        screen,
        overrides: rfqOverrides(
          repository: FakeRfqRepository(
            detail: rfqDetail(items: <Map<String, dynamic>>[]),
          ),
        ),
      );
      await tester.pump();
      expect(find.text('This request has no lines'), findsOneWidget);
    });

    testWidgets('error', (WidgetTester tester) async {
      await pumpRfq(
        tester,
        screen,
        overrides: rfqOverrides(
          repository: FakeRfqRepository(detailFailure: Exception('boom')),
        ),
      );
      await tester.pump();
      expect(find.text('Something went wrong'), findsOneWidget);
    });

    testWidgets('data', (WidgetTester tester) async {
      await pumpRfq(
        tester,
        screen,
        overrides: rfqOverrides(repository: FakeRfqRepository()),
      );
      await tester.pump();

      expect(
        findToken('RFQ-2026-K3P9X441', LtrToken.reference),
        findsOneWidget,
      );
      expect(find.text('Quote received'), findsOneWidget);
      expect(find.text('Gulf Steel Trading LLC'), findsOneWidget);
      expect(findMoney('24.90 AED'), findsOneWidget, reason: 'unit price');
      expect(findMoney('12,450.00 AED'), findsOneWidget, reason: 'total');
    });
  });

  group('RfqDetailScreen — what it refuses to invent', () {
    testWidgets('NO per-line total is rendered', (WidgetTester tester) async {
      await pumpRfq(
        tester,
        screen,
        overrides: rfqOverrides(repository: FakeRfqRepository()),
      );
      await tester.pump();

      // 500 × 24.90 = 12,450.00, which happens to equal the server's total
      // here. What must not appear is a SECOND 12,450.00 computed on this
      // side: `submitQuote` rounds the aggregate once, and a client that
      // rounds each line again can produce a figure the invoice disagrees
      // with. The contract omits `lineTotal` for exactly this reason.
      expect(findMoney('12,450.00 AED'), findsOneWidget);
      expect(
        find.textContaining('Prices shown are per unit'),
        findsOneWidget,
      );
    });

    testWidgets('an unquoted line says "not priced", never a zero',
        (WidgetTester tester) async {
      await pumpRfq(
        tester,
        screen,
        overrides:
            rfqOverrides(repository: FakeRfqRepository(detail: unquotedDetail())),
      );
      await tester.pump();

      expect(find.text('Not priced yet'), findsOneWidget);
      expect(findMoney('0.00 AED'), findsNothing);
      expect(
        find.textContaining('No supplier has picked this request up yet'),
        findsOneWidget,
      );
      // Nothing to decide, so nothing is offered.
      expect(find.byKey(const ValueKey<String>('rfq-accept')), findsNothing);
    });

    testWidgets('a KWD quote keeps its third decimal',
        (WidgetTester tester) async {
      // The wire carries two places even for a three-decimal currency;
      // `Money` widens exactly. Formatting 1234.50 KWD as "1,234.50" would be
      // wrong by a factor of ten in the last place a buyer reads.
      await pumpRfq(
        tester,
        screen,
        overrides:
            rfqOverrides(repository: FakeRfqRepository(detail: kuwaitiDetail())),
      );
      await tester.pump();

      expect(findMoney('1,234.500 KWD'), findsOneWidget);
      expect(findMoney('2.470 KWD'), findsOneWidget);
    });

    testWidgets('no expiry is ever shown', (WidgetTester tester) async {
      // `RFQRequest.expiresAt` has no writer. Nothing may be rendered from it.
      await pumpRfq(
        tester,
        screen,
        overrides: rfqOverrides(repository: FakeRfqRepository()),
      );
      await tester.pump();
      expect(find.textContaining('xpire'), findsNothing);
      expect(find.textContaining('valid until'), findsNothing);
    });
  });

  group('RfqDetailScreen — accepting', () {
    testWidgets('Accept posts the version the buyer READ',
        (WidgetTester tester) async {
      final FakeRfqRepository repo = FakeRfqRepository(
        detail: rfqDetail(quoteVersion: 3),
        decideResult: rfqDetail(status: 'ACCEPTED', quoteVersion: 3),
      );
      await pumpRfq(
        tester,
        screen,
        overrides: rfqOverrides(repository: repo),
      );
      await tester.pump();

      await scrollTo(tester, find.byKey(const ValueKey<String>('rfq-accept')));
      await tester.tap(find.byKey(const ValueKey<String>('rfq-accept')));
      await tester.pump();
      await tester.pump();

      expect(repo.decideCalls, 1);
      final RfqDecisionRequest sent = repo.decisions.single;
      expect(sent.decision, RfqDecision.accepted);
      expect(sent.expectedQuoteVersion, 3);
      expect(find.text('Quote accepted'), findsOneWidget);
    });

    testWidgets('Decline posts REJECTED with the same version',
        (WidgetTester tester) async {
      final FakeRfqRepository repo = FakeRfqRepository(
        decideResult: rfqDetail(status: 'REJECTED'),
      );
      await pumpRfq(
        tester,
        screen,
        overrides: rfqOverrides(repository: repo),
      );
      await tester.pump();

      await scrollTo(tester, find.byKey(const ValueKey<String>('rfq-decline')));
      await tester.tap(find.byKey(const ValueKey<String>('rfq-decline')));
      await tester.pump();
      await tester.pump();

      expect(repo.decisions.single.decision, RfqDecision.rejected);
      expect(find.text('Quote declined'), findsOneWidget);
    });

    testWidgets('a transport failure is stated and the buttons come back',
        (WidgetTester tester) async {
      final FakeRfqRepository repo = FakeRfqRepository(
        decideFailure: const ApiFailure.network(
          kind: NetworkFailureKind.timeout,
          message: 'The connection timed out. Check your signal and try again.',
        ),
      );
      await pumpRfq(
        tester,
        screen,
        overrides: rfqOverrides(repository: repo),
      );
      await tester.pump();

      await scrollTo(tester, find.byKey(const ValueKey<String>('rfq-accept')));
      await tester.tap(find.byKey(const ValueKey<String>('rfq-accept')));
      await tester.pump();
      await tester.pump();

      expect(find.text('The decision was not sent'), findsOneWidget);
      final KeyButton accept = tester.widget<KeyButton>(
        find.byKey(const ValueKey<String>('rfq-accept')),
      );
      expect(accept.onPressed, isNotNull);
    });
  });

  group('RfqDetailScreen — THE STALE QUOTE', () {
    testWidgets(
        'a version mismatch is not a generic error: it shows what changed and '
        'asks again', (WidgetTester tester) async {
      // The buyer opened a quote for 12,450.00. The supplier revised it to
      // 14,900.00 while the screen was open. The server refuses the accept.
      final FakeRfqRepository repo = FakeRfqRepository(
        detail: rfqDetail(quoteVersion: 1, totalQuoted: 12450.00),
        decideFailure: staleQuoteConflict(),
      );

      await pumpRfq(
        tester,
        screen,
        overrides: rfqOverrides(repository: repo),
        size: const Size(420, 1400),
      );
      await tester.pump();

      // What the server now holds, which the controller will re-read.
      repo.detail = rfqDetail(quoteVersion: 2, totalQuoted: 14900.00);

      await scrollTo(tester, find.byKey(const ValueKey<String>('rfq-accept')));
      await tester.tap(find.byKey(const ValueKey<String>('rfq-accept')));
      await tester.pump();
      await tester.pump();
      await tester.pump();

      expect(repo.decideCalls, 1);
      expect(find.text('The supplier changed this quote'), findsOneWidget);
      expect(
        find.textContaining('Your acceptance was not sent'),
        findsOneWidget,
      );
      // BOTH figures, so the buyer can see what moved. Neither is computed —
      // each is a `totalQuoted` the server sent. The old one appears twice:
      // once struck through in the comparison, and once in the total panel,
      // which still shows the quote the buyer opened. The screen deliberately
      // does not swap that out underneath them mid-decision.
      expect(findMoney('12,450.00 AED'), findsWidgets);
      expect(findMoney('14,900.00 AED'), findsOneWidget);
    });

    testWidgets('re-confirming sends the NEW version, and only on a second tap',
        (WidgetTester tester) async {
      final FakeRfqRepository repo = FakeRfqRepository(
        detail: rfqDetail(quoteVersion: 1, totalQuoted: 12450.00),
        decideFailure: staleQuoteConflict(),
      );

      await pumpRfq(
        tester,
        screen,
        overrides: rfqOverrides(repository: repo),
        size: const Size(420, 1400),
      );
      await tester.pump();
      repo.detail = rfqDetail(quoteVersion: 2, totalQuoted: 14900.00);

      await scrollTo(tester, find.byKey(const ValueKey<String>('rfq-accept')));
      await tester.tap(find.byKey(const ValueKey<String>('rfq-accept')));
      await tester.pump();
      await tester.pump();
      await tester.pump();

      // The server accepts the revised version now.
      repo
        ..decideFailure = null
        ..decideResult = rfqDetail(status: 'ACCEPTED', quoteVersion: 2);

      await scrollTo(tester, find.byKey(const ValueKey<String>('rfq-accept')));
      await tester.tap(find.byKey(const ValueKey<String>('rfq-accept')));
      await tester.pump();
      await tester.pump();

      expect(repo.decideCalls, 2);
      expect(repo.decisions.first.expectedQuoteVersion, 1);
      expect(repo.decisions.last.decision, RfqDecision.accepted);
      // THE POINT: the second POST carries the version the buyer was actually
      // shown, and it took a deliberate second tap to send it. Re-reading the
      // version at the moment of the first tap would have bound the buyer to a
      // price they never saw.
      expect(repo.decisions.last.expectedQuoteVersion, 2);
      expect(find.text('Quote accepted'), findsOneWidget);
    });

    testWidgets('after a move the buyer may DECLINE the revised price',
        (WidgetTester tester) async {
      // Seeing the new number is exactly when someone changes their mind. The
      // revised quote must be declinable here, not only acceptable-or-abandon.
      final FakeRfqRepository repo = FakeRfqRepository(
        detail: rfqDetail(quoteVersion: 1, totalQuoted: 12450.00),
        decideFailure: staleQuoteConflict(),
      );

      await pumpRfq(
        tester,
        screen,
        overrides: rfqOverrides(repository: repo),
        size: const Size(420, 1400),
      );
      await tester.pump();
      repo.detail = rfqDetail(quoteVersion: 2, totalQuoted: 14900.00);

      await scrollTo(tester, find.byKey(const ValueKey<String>('rfq-accept')));
      await tester.tap(find.byKey(const ValueKey<String>('rfq-accept')));
      await tester.pump();
      await tester.pump();
      await tester.pump();

      repo
        ..decideFailure = null
        ..decideResult = rfqDetail(status: 'REJECTED', quoteVersion: 2);

      await scrollTo(tester, find.byKey(const ValueKey<String>('rfq-decline')));
      await tester.tap(find.byKey(const ValueKey<String>('rfq-decline')));
      await tester.pump();
      await tester.pump();

      expect(repo.decisions.last.decision, RfqDecision.rejected);
      expect(repo.decisions.last.expectedQuoteVersion, 2);
      expect(find.text('Quote declined'), findsOneWidget);
    });

    testWidgets('"show me the new quote first" sends nothing',
        (WidgetTester tester) async {
      final FakeRfqRepository repo = FakeRfqRepository(
        detail: rfqDetail(quoteVersion: 1),
        decideFailure: staleQuoteConflict(),
      );

      await pumpRfq(
        tester,
        screen,
        overrides: rfqOverrides(repository: repo),
        size: const Size(420, 1400),
      );
      await tester.pump();
      repo.detail = rfqDetail(quoteVersion: 2, totalQuoted: 14900.00);

      await scrollTo(tester, find.byKey(const ValueKey<String>('rfq-accept')));
      await tester.tap(find.byKey(const ValueKey<String>('rfq-accept')));
      await tester.pump();
      await tester.pump();
      await tester.pump();

      await scrollTo(
        tester,
        find.byKey(const ValueKey<String>('rfq-moved-dismiss')),
      );
      await tester.tap(
        find.byKey(const ValueKey<String>('rfq-moved-dismiss')),
      );
      await tester.pump();
      await tester.pump();

      expect(repo.decideCalls, 1);
      expect(find.text('The supplier changed this quote'), findsNothing);
      // The screen now shows the revised quote it just read.
      expect(findMoney('14,900.00 AED'), findsOneWidget);
    });

    testWidgets(
        'a conflict that is NOT a version move says what the server said',
        (WidgetTester tester) async {
      // Same HTTP code, different meaning: the request is no longer in a state
      // `decideRFQ` accepts. There is nothing to re-confirm.
      final FakeRfqRepository repo = FakeRfqRepository(
        detail: rfqDetail(quoteVersion: 1),
        decideFailure: notDecidableConflict(),
      );

      await pumpRfq(
        tester,
        screen,
        overrides: rfqOverrides(repository: repo),
        size: const Size(420, 1400),
      );
      await tester.pump();

      await scrollTo(tester, find.byKey(const ValueKey<String>('rfq-accept')));
      await tester.tap(find.byKey(const ValueKey<String>('rfq-accept')));
      await tester.pump();
      await tester.pump();
      await tester.pump();

      expect(find.text('This request has moved on'), findsOneWidget);
      expect(
        find.text('Only quoted RFQs can be accepted or rejected'),
        findsOneWidget,
      );
      expect(find.text('The supplier changed this quote'), findsNothing);
    });

    testWidgets('THE DOUBLE-SUBMIT GUARD: two taps on Accept, one decision',
        (WidgetTester tester) async {
      // The decision is held in flight so the second tap lands while the first
      // is still outstanding — which is the only moment the guard matters, and
      // exactly what a buyer with a slow connection does.
      final FakeRfqRepository repo = FakeRfqRepository(decidePending: true);
      await pumpRfq(
        tester,
        screen,
        overrides: rfqOverrides(repository: repo),
      );
      await tester.pump();

      final Finder accept = find.byKey(const ValueKey<String>('rfq-accept'));
      await scrollTo(tester, accept);
      await tester.tap(accept);
      // No pump between the taps: the second lands before the rebuild that
      // would disable the button.
      await tester.tap(accept);
      await tester.pump();

      expect(repo.decideCalls, 1);
    });
  });

  group('RfqDetailScreen — dynamic type', () {
    testWidgets('at 200% the two decisions stack instead of ellipsing',
        (WidgetTester tester) async {
      await pumpRfq(
        tester,
        screen,
        overrides: rfqOverrides(repository: FakeRfqRepository()),
        textScale: 2.0,
        size: const Size(420, 2000),
      );
      await tester.pump();

      expect(tester.takeException(), isNull);
      await scrollTo(tester, find.byKey(const ValueKey<String>('rfq-accept')));
      expect(find.text('Accept this quote'), findsOneWidget);
      expect(find.text('Decline'), findsOneWidget);
    });
  });
}
