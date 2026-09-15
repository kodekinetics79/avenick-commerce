import 'package:avenick/api/models/catalogue.dart';
import 'package:avenick/api/models/enums.dart';
import 'package:avenick/core/ui/async_state_view.dart';
import 'package:avenick/features/catalogue/catalogue.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

void main() {
  group('CategoryScreen — the four states', () {
    testWidgets('data: subcategories, the count, the sort and the grid', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const CategoryScreen(slug: 'plumbing'),
        repository: FakeCatalogueRepository(
          cards: <ProductCard>[
            fakeProductCard(),
            fakeProductCard(id: 'prd_2', slug: 'p2', nameEn: 'Ball valve'),
          ],
        ),
      );

      expect(find.text('Plumbing'), findsOneWidget);
      expect(find.text('Subcategories'), findsOneWidget);
      expect(find.text('Valves'), findsOneWidget);
      // The zero-count child stays on screen, dimmed, with its count. A facet
      // that vanishes reads as a bug in the app.
      expect(find.text('Gaskets'), findsOneWidget);
      // `Category.productCount` — the only real count the catalogue exposes.
      expect(find.text('412 products'), findsOneWidget);
      expect(find.text('Newest first'), findsOneWidget);
      expect(find.byType(ProductCardTile), findsNWidgets(2));
    });

    testWidgets('empty: the shelf is named, and a subcategory is offered', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const CategoryScreen(slug: 'plumbing'),
        repository: FakeCatalogueRepository(outcome: FakeOutcome.empty),
      );

      expect(find.text('Nothing in this category yet'), findsOneWidget);
      expect(find.byType(ProductCardTile), findsNothing);
    });

    testWidgets('error: the grid shows the failure with a retry', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const CategoryScreen(slug: 'plumbing'),
        repository: FakeCatalogueRepository(outcome: FakeOutcome.error),
      );

      expect(find.byType(MeridianErrorState), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('loading: a grid-shaped skeleton', (WidgetTester tester) async {
      await pumpCatalogue(
        tester,
        const CategoryScreen(slug: 'plumbing'),
        repository: FakeCatalogueRepository(outcome: FakeOutcome.pending),
      );

      expect(find.byType(MeridianSkeleton), findsWidgets);
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });
  });

  testWidgets('the slug is humanised while the taxonomy is still in flight', (
    WidgetTester tester,
  ) async {
    // A deep link into a node this build's taxonomy does not carry must still
    // put something readable in the app bar, and the URL already says it.
    await pumpCatalogue(
      tester,
      const CategoryScreen(slug: 'power-tools'),
      repository: FakeCatalogueRepository(),
    );
    expect(find.text('Power tools'), findsOneWidget);
  });

  testWidgets('infinite scroll asks for the next page with the CURSOR', (
    WidgetTester tester,
  ) async {
    final FakeCatalogueRepository repo = FakeCatalogueRepository(
      totalPages: 3,
      cards: <ProductCard>[
        for (int i = 0; i < 8; i++)
          fakeProductCard(id: 'prd_$i', slug: 'p$i', nameEn: 'Valve $i'),
      ],
    );
    await pumpCatalogue(
      tester,
      const CategoryScreen(slug: 'plumbing'),
      repository: repo,
    );

    expect(repo.productCalls.single['cursor'], isNull);

    await tester.drag(find.byType(CustomScrollView), const Offset(0, -2000));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(repo.productCalls.length, greaterThan(1));
    // The cursor is echoed back, not re-derived. A page-number client against
    // a cursor server is how a list repeats or skips rows.
    expect(repo.productCalls.last['cursor'], '1');
    expect(repo.productCalls.last['categorySlug'], 'plumbing');
  });

  testWidgets('changing the sort mints a new pager rather than reusing one', (
    WidgetTester tester,
  ) async {
    final FakeCatalogueRepository repo = FakeCatalogueRepository();
    await pumpCatalogue(
      tester,
      const CategoryScreen(slug: 'plumbing'),
      repository: repo,
    );

    await tester.tap(find.text('Newest first'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    await tester.tap(find.text('Highest rated'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    // A fresh page one under the new sort, with a NULL cursor: a cursor is
    // minted against the query that produced it, and replaying it under a
    // different sort asks the server to continue a list it never sent.
    expect(repo.productCalls.last['sort'], ProductSort.rating);
    expect(repo.productCalls.last['cursor'], isNull);
  });
}
