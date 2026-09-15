import 'package:avenick/api/models/rfq.dart';
import 'package:avenick/core/l10n/directional_text.dart';
import 'package:avenick/core/ui/async_state_view.dart';
import 'package:avenick/features/rfq/rfq.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'harness.dart';

void main() {
  group('RfqListScreen — the four states', () {
    testWidgets('loading', (WidgetTester tester) async {
      await pumpRfq(
        tester,
        const RfqListScreen(),
        overrides: rfqOverrides(repository: FakeRfqRepository(pending: true)),
      );
      expect(find.byType(MeridianSkeleton), findsOneWidget);
    });

    testWidgets('empty — a first-run screen, and still refreshable',
        (WidgetTester tester) async {
      await pumpRfq(
        tester,
        const RfqListScreen(),
        overrides: rfqOverrides(repository: FakeRfqRepository()),
      );
      await tester.pump();

      expect(find.text('No quote requests yet'), findsOneWidget);
      // Almost nothing in this catalogue can be bought outright, so this is
      // where a new buyer lands. It must read as a beginning, not a fault.
      expect(
        find.textContaining('Open a product and tap Request a quote'),
        findsOneWidget,
      );
      // The gesture must work in the state that most needs it.
      expect(find.byType(RefreshIndicator), findsOneWidget);
    });

    testWidgets('error', (WidgetTester tester) async {
      await pumpRfq(
        tester,
        const RfqListScreen(),
        overrides: rfqOverrides(
          repository: FakeRfqRepository(listFailure: Exception('gateway down')),
        ),
      );
      await tester.pump();
      expect(find.text('Something went wrong'), findsOneWidget);
    });

    testWidgets('data', (WidgetTester tester) async {
      await pumpRfq(
        tester,
        const RfqListScreen(),
        overrides: rfqOverrides(
          repository: FakeRfqRepository(cards: <RfqCard>[rfqCard()]),
        ),
      );
      await tester.pump();

      expect(find.text('Quote received'), findsOneWidget);
      expect(findMoney('12,450.00 AED'), findsOneWidget);
      expect(find.text('Gulf Steel Trading LLC'), findsOneWidget);
    });
  });

  group('RfqListScreen — what the rows say', () {
    testWidgets('an unclaimed request says so, and shows NO zero price',
        (WidgetTester tester) async {
      await pumpRfq(
        tester,
        const RfqListScreen(),
        overrides: rfqOverrides(
          repository: FakeRfqRepository(cards: <RfqCard>[unclaimedCard()]),
        ),
      );
      await tester.pump();

      expect(find.text('No supplier yet'), findsOneWidget);
      expect(find.text('Not quoted yet'), findsOneWidget);
      // `totalQuoted` is null, which means "not yet quoted". A 0.00 here would
      // say a supplier answered "free".
      expect(findMoney('0.00 AED'), findsNothing);
    });

    testWidgets('the RFQ number is bidi-isolated in Arabic',
        (WidgetTester tester) async {
      await pumpRfq(
        tester,
        const RfqListScreen(),
        overrides: rfqOverrides(
          repository: FakeRfqRepository(cards: <RfqCard>[rfqCard()]),
        ),
        locale: const Locale('ar'),
      );
      await tester.pump();

      expect(find.text('RFQ-2026-K3P9X441'), findsNothing);
      expect(
        findToken('RFQ-2026-K3P9X441', LtrToken.reference),
        findsOneWidget,
      );
    });

    testWidgets('tapping a row opens it', (WidgetTester tester) async {
      String? opened;
      await pumpRfq(
        tester,
        RfqListScreen(onOpenRfq: (String id) => opened = id),
        overrides: rfqOverrides(
          repository: FakeRfqRepository(cards: <RfqCard>[rfqCard()]),
        ),
      );
      await tester.pump();
      await tester.tap(find.text('Gulf Steel Trading LLC'));
      await tester.pump();
      expect(opened, 'rfq_1');
    });
  });

  group('RfqListScreen — THE FIFTY-ROW CAP', () {
    testWidgets('below the cap, nothing is claimed about older requests',
        (WidgetTester tester) async {
      await pumpRfq(
        tester,
        const RfqListScreen(),
        overrides: rfqOverrides(
          repository: FakeRfqRepository(
            cards: <RfqCard>[
              for (int i = 0; i < 3; i++) rfqCard(id: 'rfq_$i'),
            ],
          ),
        ),
      );
      await tester.pump();
      expect(find.textContaining('most recent requests'), findsNothing);
    });

    testWidgets('at the cap the boundary is stated, and there is no Load more',
        (WidgetTester tester) async {
      await pumpRfq(
        tester,
        const RfqListScreen(),
        overrides: rfqOverrides(
          repository: FakeRfqRepository(
            cards: <RfqCard>[
              for (int i = 0; i < kRfqListMax; i++) rfqCard(id: 'rfq_$i'),
            ],
          ),
        ),
        size: const Size(420, 2400),
      );
      await tester.pump();

      await scrollTo(tester, find.textContaining('most recent requests'));
      expect(
        find.text('Showing your 50 most recent requests'),
        findsOneWidget,
      );
      // There is no second page to ask for: the endpoint takes no cursor and
      // sends no `meta`. A "load more" here would re-read the same fifty rows
      // forever, which looks like a working list and is a lie.
      expect(find.textContaining('Load'), findsNothing);
    });

    testWidgets('the notice names the same number the cap uses',
        (WidgetTester tester) async {
      // If the constant and the copy could disagree, the screen would tell the
      // buyer their whole record is on screen when it is not.
      expect(kRfqListMax, 50);
    });
  });
}
