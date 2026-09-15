import 'package:avenick/api/models/catalogue.dart';
import 'package:avenick/api/models/enums.dart';
import 'package:avenick/core/ui/async_state_view.dart';
import 'package:avenick/core/ui/key_button.dart';
import 'package:avenick/features/catalogue/catalogue.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

void main() {
  group('SearchScreen — the four states of the results grid', () {
    testWidgets('data: the toolbar and the grid', (WidgetTester tester) async {
      await pumpCatalogue(
        tester,
        const SearchScreen(initialQuery: 'valve'),
        repository: FakeCatalogueRepository(
          cards: <ProductCard>[fakeProductCard(), fakeProductCard(id: 'p2')],
        ),
      );

      expect(find.byType(ProductCardTile), findsNWidgets(2));
      expect(find.text('Filters'), findsOneWidget);
      expect(find.text('Newest first'), findsOneWidget);
      // The bounded probe, not a count — the envelope carries no total.
      expect(find.text('2 results'), findsOneWidget);
    });

    testWidgets('empty: the term is named and each facet can be relaxed', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const SearchScreen(initialQuery: 'unobtainium'),
        repository: FakeCatalogueRepository(outcome: FakeOutcome.empty),
      );

      expect(find.text('No results for "unobtainium"'), findsOneWidget);
      // No facets are on, so there is nothing to relax and nothing is offered.
      // The screen must not print an empty "try widening" heading.
      expect(find.text('Try widening the search'), findsNothing);
    });

    testWidgets('error: the grid surfaces it with a retry', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const SearchScreen(initialQuery: 'valve'),
        repository: FakeCatalogueRepository(outcome: FakeOutcome.error),
      );

      expect(find.byType(MeridianErrorState), findsOneWidget);
    });

    testWidgets('loading: a grid skeleton, never a spinner', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const SearchScreen(initialQuery: 'valve'),
        repository: FakeCatalogueRepository(outcome: FakeOutcome.pending),
      );

      expect(find.byType(MeridianSkeleton), findsWidgets);
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });
  });

  group('SearchScreen — entry', () {
    testWidgets('idle with no history shows the invitation, not a blank', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const SearchScreen(),
        repository: FakeCatalogueRepository(),
      );

      expect(find.text('Search the catalogue'), findsOneWidget);
      expect(find.byType(ProductCardTile), findsNothing);
    });

    testWidgets('suggestions are debounced at 250ms, not fired per keystroke', (
      WidgetTester tester,
    ) async {
      final FakeCatalogueRepository repo = FakeCatalogueRepository();
      await pumpCatalogue(
        tester,
        const SearchScreen(),
        repository: repo,
      );
      expect(repo.productCalls, isEmpty);

      await tester.enterText(find.byType(TextField), 'v');
      await tester.pump(const Duration(milliseconds: 80));
      await tester.enterText(find.byType(TextField), 'va');
      await tester.pump(const Duration(milliseconds: 80));
      await tester.enterText(find.byType(TextField), 'val');
      await tester.pump(const Duration(milliseconds: 80));

      // Three keystrokes inside one debounce window: still nothing on the wire.
      expect(repo.productCalls, isEmpty);

      await tester.pump(const Duration(milliseconds: 300));
      await tester.pump();

      expect(repo.productCalls.length, 1);
      expect(repo.productCalls.single['search'], 'val');
      expect(repo.productCalls.single['limit'], 8);
    });

    testWidgets('clearing is instant — no 250ms wait to empty a list', (
      WidgetTester tester,
    ) async {
      final FakeCatalogueRepository repo = FakeCatalogueRepository();
      await pumpCatalogue(tester, const SearchScreen(), repository: repo);

      await tester.enterText(find.byType(TextField), 'valve');
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pump();
      expect(find.byType(ProductCardTile), findsNothing);
      expect(repo.productCalls.length, 1);

      await tester.enterText(find.byType(TextField), '');
      await tester.pump();
      expect(find.text('Search the catalogue'), findsOneWidget);
    });

    testWidgets('submitting records a recent search and shows results', (
      WidgetTester tester,
    ) async {
      final FakeCatalogueRepository repo = FakeCatalogueRepository();
      await pumpCatalogue(tester, const SearchScreen(), repository: repo);

      await tester.enterText(find.byType(TextField), 'brass valve');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(ProductCardTile), findsWidgets);

      // Clearing drops back to idle, where the recent search is now waiting.
      await tester.enterText(find.byType(TextField), '');
      await tester.pump();
      expect(find.text('Recent searches'), findsOneWidget);
      expect(find.text('brass valve'), findsOneWidget);
    });

    testWidgets('editing after a search drops back to suggestions', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const SearchScreen(initialQuery: 'valve'),
        repository: FakeCatalogueRepository(),
      );
      expect(find.text('Filters'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'valv');
      await tester.pump();

      // The results toolbar is gone: a grid that still says "valve" while the
      // field says "valv" is two screens disagreeing about what was searched.
      expect(find.text('Filters'), findsNothing);
    });
  });

  group('the sort sheet', () {
    testWidgets('is a sheet, states why there is no price sort, and applies', (
      WidgetTester tester,
    ) async {
      final FakeCatalogueRepository repo = FakeCatalogueRepository();
      await pumpCatalogue(
        tester,
        const SearchScreen(initialQuery: 'valve'),
        repository: repo,
      );

      await tester.tap(find.text('Newest first'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.text('Sort by'), findsOneWidget);
      expect(
        find.textContaining('Sorting by price is not available'),
        findsOneWidget,
      );

      await tester.tap(find.text('Lowest minimum order'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(repo.productCalls.last['sort'], ProductSort.moqAsc);
    });
  });

  group('the filter screen', () {
    Future<void> openFilters(WidgetTester tester) async {
      await tester.tap(find.text('Filters'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
    }

    testWidgets('is a full page, not a bottom sheet', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const SearchScreen(initialQuery: 'valve'),
        repository: FakeCatalogueRepository(),
      );
      await openFilters(tester);

      expect(find.byType(SearchFilterScreen), findsOneWidget);
      // The facet surface must never be a sheet: the GCC B2B facet set exceeds
      // a comfortable sheet height and a sheet's drag fights the list's scroll.
      expect(find.byType(BottomSheet), findsNothing);
    });

    testWidgets('a zero-count facet is DISABLED and still shows its count', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const SearchScreen(initialQuery: 'valve'),
        repository: FakeCatalogueRepository(),
      );
      await openFilters(tester);

      // Kaveri has productCount 0 in the fixture.
      expect(find.text('Kaveri'), findsOneWidget);
      expect(find.text('0'), findsWidgets);

      final Semantics node = tester.widget<Semantics>(
        find
            .ancestor(
              of: find.text('Kaveri'),
              matching: find.byType(Semantics),
            )
            .first,
      );
      expect(node.properties.enabled, isFalse);
      expect(node.properties.label, contains('unavailable'));
    });

    testWidgets('the apply bar carries a live, bounded result count', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const SearchScreen(initialQuery: 'valve'),
        repository: FakeCatalogueRepository(
          cards: <ProductCard>[fakeProductCard(), fakeProductCard(id: 'p2')],
        ),
      );
      await openFilters(tester);

      expect(find.text('Show 2 results'), findsOneWidget);
    });

    testWidgets('Reset clears the facets and KEEPS the search term', (
      WidgetTester tester,
    ) async {
      final FakeCatalogueRepository repo = FakeCatalogueRepository();
      await pumpCatalogue(
        tester,
        const SearchScreen(initialQuery: 'valve'),
        repository: repo,
      );
      await openFilters(tester);

      await tester.tap(find.text('In stock only'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      await tester.tap(find.text('Reset'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      // The apply bar is the filter screen's only KeyButton, and its LABEL
      // moves with the live count — so it is found by type, not by words.
      await tester.tap(find.byType(KeyButton));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      // The word the user typed survives a filter reset. Clearing it would
      // throw away work they did not ask to undo.
      //
      // Asserted against the GRID's fetch (limit 24), not the count probe
      // (limit 60): both are in flight and either can land last.
      final Map<String, Object?> gridCall = repo.productCalls
          .lastWhere((Map<String, Object?> c) => c['limit'] == 24);
      expect(gridCall['search'], 'valve');
      expect(gridCall['inStock'], isNull);
    });

    testWidgets('an applied facet sends `inStock: true`, never `false`', (
      WidgetTester tester,
    ) async {
      final FakeCatalogueRepository repo = FakeCatalogueRepository();
      await pumpCatalogue(
        tester,
        const SearchScreen(initialQuery: 'valve'),
        repository: repo,
      );
      await openFilters(tester);

      await tester.tap(find.text('In stock only'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));
      await tester.tap(find.byType(KeyButton));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      final Map<String, Object?> gridCall = repo.productCalls
          .lastWhere((Map<String, Object?> c) => c['limit'] == 24);
      // `inStock: true`, never `false`. Sending false would ask the server for
      // the OUT-of-stock products, which is the opposite of an unticked box.
      expect(gridCall['inStock'], isTrue);
    });
  });

  testWidgets('a zero-result search with facets offers one relaxation each', (
    WidgetTester tester,
  ) async {
    final FakeCatalogueRepository repo = FakeCatalogueRepository();
    await pumpCatalogue(
      tester,
      const SearchScreen(initialQuery: 'valve'),
      repository: repo,
    );

    await tester.tap(find.text('Filters'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    await tester.tap(find.text('In stock only'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));

    repo.outcome = FakeOutcome.empty;
    await tester.tap(find.byType(KeyButton));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('Try widening the search'), findsOneWidget);
    // ONE facet dropped, named. Not "clear all filters", which throws away the
    // four choices that were right to fix the one that was not.
    expect(find.text('Include items that are out of stock'), findsOneWidget);
  });
}
