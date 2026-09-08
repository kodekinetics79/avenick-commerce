import 'package:avenick/api/models/catalogue.dart';
import 'package:avenick/api/models/enums.dart';
import 'package:avenick/features/catalogue/catalogue.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

/// The non-negotiables, asserted rather than asserted-to.
void main() {
  testWidgets('at 200% type the grid reflows to one column and nothing clips', (
    WidgetTester tester,
  ) async {
    // 2.0 is the ceiling the brief names. Above kSingleColumnTextScale (1.6)
    // the grid must drop to a single column: past that point the choice is a
    // taller row or a truncated price, and a truncated price is a different
    // number.
    tester.platformDispatcher.textScaleFactorTestValue = 2.0;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await pumpCatalogue(
      tester,
      const CategoryScreen(slug: 'plumbing'),
      repository: FakeCatalogueRepository(
        cards: <ProductCard>[
          fakeProductCard(),
          fakeProductCard(id: 'p2', slug: 'p2', nameEn: 'Ball valve DN50'),
          fakeProductCard(id: 'p3', slug: 'p3', nameEn: 'Check valve'),
        ],
      ),
      surfaceSize: const Size(420, 1600),
    );

    // Any RenderFlex overflow raises a FlutterError that the test binding
    // records; reaching this line with cards on screen is the assertion.
    expect(find.byType(ProductCardTile), findsWidgets);

    final List<ProductCardTile> tiles = tester
        .widgetList<ProductCardTile>(find.byType(ProductCardTile))
        .toList();
    expect(tiles, isNotEmpty);

    // One column: every visible card starts at the same x, and each is wider
    // than half the viewport.
    final List<Rect> boxes = <Rect>[
      for (final ProductCardTile tile in tiles)
        tester.getRect(find.byWidget(tile)),
    ];
    expect(boxes.map((Rect r) => r.left).toSet().length, 1);
    expect(boxes.first.width, greaterThan(210));
  });

  testWidgets('every icon-only control is at least 48dp and labelled', (
    WidgetTester tester,
  ) async {
    await pumpCatalogue(
      tester,
      const SearchScreen(initialQuery: 'valve'),
      repository: FakeCatalogueRepository(),
    );
    await tester.enterText(find.byType(TextField), 'valve');
    await tester.pump();

    // The clear button is the icon-only control on this screen.
    final Finder clear = find.bySemanticsLabel('Clear search');
    expect(clear, findsOneWidget);
    final Size size = tester.getSize(clear);
    expect(size.width, greaterThanOrEqualTo(48));
    expect(size.height, greaterThanOrEqualTo(48));
  });

  testWidgets('availability is announced in words, not implied by colour', (
    WidgetTester tester,
  ) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    await pumpCatalogue(
      tester,
      const CategoryScreen(slug: 'plumbing'),
      repository: FakeCatalogueRepository(
        cards: <ProductCard>[
          fakeProductCard(availability: Availability.outOfStock),
        ],
      ),
    );

    // The card's single announcement carries the stock position as a phrase.
    expect(
      find.bySemanticsLabel(RegExp('out of stock')),
      findsWidgets,
    );
    handle.dispose();
  });

  testWidgets('the quote-only card offers no purchase affordance', (
    WidgetTester tester,
  ) async {
    await pumpCatalogue(
      tester,
      const CategoryScreen(slug: 'plumbing'),
      repository: FakeCatalogueRepository(
        cards: <ProductCard>[fakeQuoteOnlyCard()],
      ),
    );

    expect(find.text('Quote only'), findsOneWidget);
    expect(find.text('Priced by quotation'), findsOneWidget);
    // No quick-add anywhere on a card the order service would refuse.
    expect(find.text('Add to cart'), findsNothing);
    expect(find.byIcon(Icons.add_shopping_cart), findsNothing);
  });

  testWidgets('a PRICED quote-only card offers no purchase affordance either', (
    WidgetTester tester,
  ) async {
    // THE REGRESSION. This card carries a resolved B2C price and
    // `sellableInChannel: false` — the shape of all 1,172 rows in the live
    // catalogue. A client that reads sellability off the price renders
    // Add to cart here, and `secureCreateOrder` refuses the order.
    await pumpCatalogue(
      tester,
      const CategoryScreen(slug: 'plumbing'),
      repository: FakeCatalogueRepository(
        cards: <ProductCard>[fakePricedButUnsellableCard()],
      ),
    );

    expect(find.text('Quote only'), findsOneWidget);
    expect(find.text('Add to cart'), findsNothing);
    expect(find.byIcon(Icons.add_shopping_cart), findsNothing);
    // The price is still shown — it is a true statement about the product —
    // and it is not an offer to sell.
    expect(find.textContaining('AED'), findsWidgets);
  });
}
