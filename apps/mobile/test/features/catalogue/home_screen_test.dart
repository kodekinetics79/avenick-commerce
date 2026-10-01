import 'package:avenick/core/ui/async_state_view.dart';
import 'package:avenick/features/catalogue/catalogue.dart';
import 'package:avenick/features/catalogue/widgets/category_strip.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

/// Tall enough for the strip and all three rails to be laid out at once.
/// A sliver outside the viewport's cache extent is never BUILT, so a shorter
/// surface would make "the third rail is missing" indistinguishable from
/// "the third rail is below the fold".
const Size _tallPhone = Size(420, 2000);

void main() {
  group('HomeScreen — the four states', () {
    testWidgets('data: the category strip and every rail render', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const HomeScreen(),
        repository: FakeCatalogueRepository(),
        surfaceSize: _tallPhone,
      );

      expect(find.byType(CategoryStrip), findsOneWidget);
      expect(find.text('Plumbing'), findsOneWidget);
      // A zero-count category is DIMMED, never removed. This is the assertion
      // that stops someone "tidying" the strip with a `.where(count > 0)`.
      expect(find.text('Clearance'), findsOneWidget);

      for (final ProductRail rail in ProductRail.values) {
        expect(find.text(rail.title), findsOneWidget);
      }
      expect(find.byType(ProductCardTile), findsWidgets);
    });

    testWidgets('empty: each section says what is empty, in its own words', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const HomeScreen(),
        repository: FakeCatalogueRepository(outcome: FakeOutcome.empty),
        surfaceSize: _tallPhone,
      );

      expect(
        find.text('No categories have been published yet.'),
        findsOneWidget,
      );
      // Named for the rail, not a generic "nothing here" — the whole reason
      // AsyncStateView makes `empty` a required parameter.
      expect(find.text('Nothing in new arrivals yet.'), findsOneWidget);
      expect(find.text('Nothing in top rated yet.'), findsOneWidget);
      expect(
        find.text('Nothing in small order friendly yet.'),
        findsOneWidget,
      );
      expect(find.byType(ProductCardTile), findsNothing);
    });

    testWidgets('error: one failing rail does not blank the page', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const HomeScreen(),
        repository: FakeCatalogueRepository(outcome: FakeOutcome.error),
        surfaceSize: _tallPhone,
      );

      expect(find.text('Categories could not load.'), findsOneWidget);
      expect(find.text('This row could not load.'), findsNWidgets(3));
      // The chrome survives. Four independent providers is the point.
      expect(find.text('Shop'), findsOneWidget);
      expect(find.text('New arrivals'), findsOneWidget);
    });

    testWidgets('loading: skeletons, never a spinner', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const HomeScreen(),
        repository: FakeCatalogueRepository(outcome: FakeOutcome.pending),
        surfaceSize: _tallPhone,
      );

      expect(find.byType(MeridianSkeleton), findsWidgets);
      // The house rule: a spinner is only for an indeterminate blocking action.
      // A shape that is known gets a skeleton.
      expect(find.byType(MeridianSpinner), findsNothing);
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });
  });

  testWidgets('pull-to-refresh refetches every section', (
    WidgetTester tester,
  ) async {
    final FakeCatalogueRepository repo = FakeCatalogueRepository();
    await pumpCatalogue(
      tester,
      const HomeScreen(),
      repository: repo,
      surfaceSize: _tallPhone,
    );

    final int before = repo.productCalls.length;
    expect(before, ProductRail.values.length);

    // An explicit gesture, moved in steps with a pump between each: a single
    // `fling` is dispatched too fast for RefreshIndicator to accumulate the
    // drag it needs, and the test then passes or fails on frame timing rather
    // than on behaviour.
    //
    // The gesture also has to START somewhere the vertical scrollable owns.
    // The centre of the home screen sits on a horizontal rail, and a drag that
    // begins there enters the arena against that rail's own drag recognizer.
    // The 'Categories' heading is plain content in the outer scroll view.
    final TestGesture gesture =
        await tester.startGesture(tester.getCenter(find.text('Categories')));
    // RefreshIndicator arms at 25% of the VIEWPORT height, and this surface is
    // deliberately tall so all three rails are laid out — so the drag has to be
    // tall too. 800px against a ~1940px viewport clears the ~485px threshold
    // with room to spare.
    for (int i = 0; i < 20; i++) {
      await gesture.moveBy(const Offset(0, 40));
      await tester.pump(const Duration(milliseconds: 16));
    }
    await gesture.up();
    await tester.pump();
    for (int i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 400));
    }

    expect(
      repo.productCalls.length,
      greaterThan(before),
      reason: 'Pull-to-refresh must reload every rail, not just the taxonomy.',
    );
  });
}
