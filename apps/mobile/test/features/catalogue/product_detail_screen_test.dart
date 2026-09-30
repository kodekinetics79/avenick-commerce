import 'package:avenick/api/models/catalogue.dart';
import 'package:avenick/api/models/enums.dart';
import 'package:avenick/core/ui/async_state_view.dart';
import 'package:avenick/features/catalogue/catalogue.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:riverpod/misc.dart' show Override;

import 'fakes.dart';

/// Tall enough for the buy box, the ladder, the seller card and the specs to
/// be laid out in one pass. `ListView` builds lazily, so a short surface would
/// make "the seller card is missing" indistinguishable from "it is below the
/// fold".
const Size _tallPhone = Size(420, 2400);

Future<void> noopAdd({
  required ProductDetail product,
  required int quantity,
  ProductVariant? variant,
}) async {}

List<Override> withCart() => <Override>[
      addToCartProvider.overrideWith((Ref ref) => noopAdd),
    ];

/// How visible the sticky bar is.
///
/// The bar is ALWAYS in the tree — that is what lets it animate — so its
/// presence proves nothing and `findsOneWidget` on its button is wrong by
/// construction. Its opacity is the actual behaviour under test.
double stickyBarOpacity(WidgetTester tester) =>
    tester.widget<AnimatedOpacity>(find.byType(AnimatedOpacity)).opacity;

void main() {
  group('ProductDetailScreen — the four states', () {
    testWidgets('data: gallery, VAT price, ladder, seller, specs, delivery', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const ProductDetailScreen(slug: 'brass-gate-valve-2-inch'),
        repository: FakeCatalogueRepository(),
        extraOverrides: withCart(),
        surfaceSize: _tallPhone,
      );

      expect(find.text('Brass gate valve 2 inch'), findsWidgets);
      // 12.34 net + 5% VAT = 12.957, rounded the server's way to 12.96.
      expect(find.textContaining('AED 12.96'), findsWidgets);
      // The net is printed beside it, because the gross is this client's
      // arithmetic and the net is the figure the checkout will use.
      expect(find.textContaining('AED 12.34'), findsWidgets);
      expect(find.text('Volume pricing'), findsOneWidget);
      expect(find.text('Sold by'), findsOneWidget);
      expect(find.text('Gulf Industrial Supply'), findsOneWidget);
      expect(find.text('Specifications'), findsOneWidget);
      expect(find.text('Ratings'), findsOneWidget);
      expect(find.text('Delivery'), findsOneWidget);
      // Two: the buy box's and the sticky bar's. The bar is in the tree from
      // the first frame and hidden by opacity, not by absence.
      expect(find.text('Add to cart'), findsNWidgets(2));
      expect(stickyBarOpacity(tester), 0.0);
    });

    testWidgets('empty: a hollow record is named, not blanked', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const ProductDetailScreen(slug: 'unfinished-listing'),
        repository: FakeCatalogueRepository(outcome: FakeOutcome.empty),
        surfaceSize: _tallPhone,
      );

      expect(find.text('This listing is not finished'), findsOneWidget);
      expect(find.text('Add to cart'), findsNothing);
    });

    testWidgets('error: a generic failure gets the error state and a retry', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const ProductDetailScreen(slug: 'brass-gate-valve-2-inch'),
        repository: FakeCatalogueRepository(outcome: FakeOutcome.error),
        surfaceSize: _tallPhone,
      );

      expect(find.byType(MeridianErrorState), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('loading: a detail-shaped skeleton', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const ProductDetailScreen(slug: 'brass-gate-valve-2-inch'),
        repository: FakeCatalogueRepository(outcome: FakeOutcome.pending),
        surfaceSize: _tallPhone,
      );

      expect(find.byType(MeridianSkeleton), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });
  });

  group('the channel rule', () {
    testWidgets('purchasable: Add to cart, and no quote action', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const ProductDetailScreen(slug: 'brass-gate-valve-2-inch'),
        repository: FakeCatalogueRepository(),
        extraOverrides: withCart(),
        surfaceSize: _tallPhone,
      );

      expect(find.text('Add to cart'), findsNWidgets(2));
      expect(find.text('Request a quote'), findsNothing);
    });

    testWidgets('quote-only: Request a quote, and NO add-to-cart anywhere', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const ProductDetailScreen(slug: 'brass-gate-valve-2-inch'),
        repository: FakeCatalogueRepository(detail: fakeQuoteOnlyDetail()),
        extraOverrides: withCart(),
        surfaceSize: _tallPhone,
      );

      expect(find.text('Request a quote'), findsWidgets);
      // Not greyed out, not hidden behind a tap. ABSENT — the order service
      // refuses a B2C order without `isB2CEnabled` (orders.ts:288), so a cart
      // button here would be a button that cannot work.
      expect(find.text('Add to cart'), findsNothing);
      expect(find.text('Out of stock'), findsNothing);
      // The price area states the mode rather than showing a confident
      // consumer figure.
      expect(find.text('Priced by quotation'), findsNWidgets(2));
      expect(find.text('Volume pricing'), findsNothing);
    });

    testWidgets(
        'PRICED and not sellable: still a quote, never a cart button', (
      WidgetTester tester,
    ) async {
      // THE REGRESSION, on the product page. A full B2C price ladder, and
      // `sellableInChannel: false`. Deriving the mode from the bands — which
      // is what this screen used to do — puts Add to cart on every product in
      // the pilot catalogue, and `secureCreateOrder` then refuses the order
      // after the buyer has committed to it.
      await pumpCatalogue(
        tester,
        const ProductDetailScreen(slug: 'brass-gate-valve-2-inch'),
        repository: FakeCatalogueRepository(
          detail: fakePricedButUnsellableDetail(),
        ),
        extraOverrides: withCart(),
        surfaceSize: _tallPhone,
      );

      expect(find.text('Request a quote'), findsWidgets);
      expect(find.text('Add to cart'), findsNothing);
      // The price ladder is real and stays on screen. It is not permission to
      // buy, and the primary action is what says so.
      expect(find.textContaining('AED'), findsWidgets);
      expect(
        find.textContaining('The seller confirms the price'),
        findsWidgets,
      );
    });

    testWidgets('a channel 404 becomes a quote invitation, not an error', (
      WidgetTester tester,
    ) async {
      // `/v1/products/[slug]` throws not_found when the channel flag is false
      // (route.ts:52). With the pilot importer writing isB2CEnabled: false on
      // every row, this is the most likely answer a B2C deep link gets.
      await pumpCatalogue(
        tester,
        const ProductDetailScreen(slug: 'brass-gate-valve-2-inch'),
        repository: FakeCatalogueRepository(
          outcome: FakeOutcome.error,
          failure: notFoundFailure(),
        ),
        surfaceSize: _tallPhone,
      );

      expect(find.text('Not sold on this channel'), findsOneWidget);
      expect(find.text('Request a quote'), findsOneWidget);
      expect(find.byType(MeridianErrorState), findsNothing);
    });
  });

  group('the buy box', () {
    testWidgets('the quantity starts at the MOQ, never at 1', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const ProductDetailScreen(slug: 'brass-gate-valve-2-inch'),
        repository: FakeCatalogueRepository(
          detail: fakeProductDetail(moq: 50),
        ),
        extraOverrides: withCart(),
        surfaceSize: _tallPhone,
      );

      expect(find.text('Quantity'), findsOneWidget);
      expect(find.text('50'), findsWidgets);
      // Starting at 1 on a product with a minimum of 50 is a number the
      // checkout rejects, presented to the buyer as if it were an offer.
      expect(find.text('Minimum order 50'), findsOneWidget);
    });

    testWidgets('the ladder marks the band the quantity actually falls in', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const ProductDetailScreen(slug: 'brass-gate-valve-2-inch'),
        repository: FakeCatalogueRepository(
          detail: fakeProductDetail(moq: 50),
        ),
        extraOverrides: withCart(),
        surfaceSize: _tallPhone,
      );

      expect(find.text('Your price'), findsOneWidget);
      // 9.90 + 5% = 10.395 → 10.40 by the server's half-up rule.
      expect(find.textContaining('AED 10.40'), findsWidgets);
    });

    testWidgets('availability is stated in words, never in colour alone', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const ProductDetailScreen(slug: 'brass-gate-valve-2-inch'),
        repository: FakeCatalogueRepository(),
        extraOverrides: withCart(),
        surfaceSize: _tallPhone,
      );

      expect(find.text('In stock'), findsWidgets);
    });

    testWidgets('with no cart wired the button says so instead of failing', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const ProductDetailScreen(slug: 'brass-gate-valve-2-inch'),
        repository: FakeCatalogueRepository(),
        surfaceSize: _tallPhone,
      );

      expect(
        find.text('The basket is not connected in this build.'),
        findsOneWidget,
      );
    });

    testWidgets('the variant sheet opens and swaps the price', (
      WidgetTester tester,
    ) async {
      await pumpCatalogue(
        tester,
        const ProductDetailScreen(slug: 'brass-gate-valve-2-inch'),
        repository: FakeCatalogueRepository(
          detail: fakeProductDetail(
            variants: <ProductVariant>[
              fakeVariant(),
              fakeVariant(
                id: 'var_2',
                nameEn: '3 inch · 380V',
                prices: <PriceBand>[fakeBand(price: '19.00')],
                availability: Availability.outOfStock,
                availableQty: 0,
              ),
            ],
          ),
        ),
        extraOverrides: withCart(),
        surfaceSize: _tallPhone,
      );

      expect(find.text('Choose an option'), findsOneWidget);
      await tester.tap(find.text('Choose an option'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      // An out-of-stock variant stays SELECTABLE: seeing its price is how the
      // buyer decides whether to wait for it.
      expect(find.text('3 inch · 380V'), findsOneWidget);
      expect(find.text('Out of stock'), findsWidgets);

      await tester.tap(find.text('3 inch · 380V'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      // 19.00 + 5% = 19.95, exact.
      expect(find.textContaining('AED 19.95'), findsWidgets);
    });
  });

  testWidgets('the sticky bar appears only once the buy box scrolls away', (
    WidgetTester tester,
  ) async {
    await pumpCatalogue(
      tester,
      const ProductDetailScreen(slug: 'brass-gate-valve-2-inch'),
      repository: FakeCatalogueRepository(),
      extraOverrides: withCart(),
      surfaceSize: const Size(420, 700),
    );

    // Present but invisible while the buy box is on screen.
    expect(stickyBarOpacity(tester), 0.0);

    // Driven through the position rather than by a drag: the gallery is a
    // PageView sitting over the middle of the list, so a synthetic drag from
    // the list's centre lands in another scrollable's arena.
    final ScrollableState list = tester.state<ScrollableState>(
      find
          .descendant(
            of: find.byType(ListView),
            // `.first` — the gallery's PageView is itself a descendant of the
            // list, so this matcher finds two scrollables and the outer one is the
            // list's own.
            matching: find.byType(Scrollable),
          )
          .first,
    );
    list.position.jumpTo(1400);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    // The buy box is off the top and the bar has taken over. It carries the
    // price and the availability too, not just a button — a bar that says only
    // 'Add to cart' asks the buyer to scroll back to remember what it costs.
    expect(stickyBarOpacity(tester), 1.0);
    expect(find.text('Add to cart'), findsNWidgets(2));
    expect(find.text('In stock'), findsWidgets);
  });
}
