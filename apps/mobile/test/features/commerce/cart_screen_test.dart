import 'package:avenick/core/ui/async_state_view.dart';
import 'package:avenick/features/commerce/commerce.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'harness.dart';

void main() {
  group('CartScreen — the four states', () {
    testWidgets('loading shows a skeleton of the shape that is coming',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CartScreen(),
        overrides: commerceOverrides(
          cartStore: FakeCartStore(pending: true),
        ),
      );
      expect(find.byType(MeridianSkeleton), findsOneWidget);
    });

    testWidgets('empty says what a basket is here, not "nothing found"',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CartScreen(),
        overrides: commerceOverrides(cartStore: FakeCartStore()),
      );
      await tester.pump();
      expect(find.text('Nothing in the basket yet'), findsOneWidget);
      // The empty state carries the device-local truth too — it is the first
      // place a buyer could form the wrong expectation.
      expect(
        find.textContaining('kept on this device'),
        findsOneWidget,
      );
    });

    testWidgets('error offers a retry rather than a blank screen',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CartScreen(),
        overrides: commerceOverrides(
          cartStore: FakeCartStore(failure: Exception('disk is gone')),
        ),
      );
      await tester.pump();
      expect(find.text('Something went wrong'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('data groups the lines by seller', (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CartScreen(),
        overrides: commerceOverrides(
          cartStore: FakeCartStore(cart: twoSellerCart()),
          sellerNames: const <String, String>{
            'sel_1': 'Gulf Valve Trading',
            'sel_2': 'Emirates Pumps',
          },
        ),
      );
      await tester.pump();

      // Two sellers, two groups, each with its own delivery statement.
      expect(find.text('Gulf Valve Trading'), findsOneWidget);
      expect(find.text('Emirates Pumps'), findsOneWidget);
      expect(
        find.textContaining('Delivery for this seller is priced and dated'),
        findsNWidgets(2),
      );
    });
  });

  group('CartScreen — money', () {
    testWidgets('the subtotal is the sum of the server’s own line totals',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CartScreen(),
        overrides: commerceOverrides(
          cartStore: FakeCartStore(cart: twoSellerCart()),
        ),
      );
      await tester.pump();
      // 24.68 + 400.00, added as exact minor units by Money — never as
      // doubles, and never by multiplying a unit price.
      expect(findMoney('424.68 AED'), findsOneWidget);
    });

    testWidgets(
        'changing a quantity withdraws the line total rather than guessing it',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CartScreen(),
        overrides: commerceOverrides(
          cartStore: FakeCartStore(cart: twoSellerCart()),
        ),
      );
      await tester.pump();
      // The line total AND that seller's group subtotal, which is the same
      // figure while the group holds one line.
      expect(findMoney('24.68 AED'), findsNWidgets(2));

      await tester.tap(find.bySemanticsLabel('Increase quantity').first);
      await tester.pump();

      // The server priced 2 units at 24.68. It has said nothing about 3, and
      // this app does not multiply — a tiered product would re-band.
      expect(findMoney('24.68 AED'), findsNothing);
      expect(find.text('Re-priced at checkout'), findsOneWidget);
      // …and the subtotal says out loud that it is now partial.
      expect(
        find.textContaining('re-price at checkout'),
        findsOneWidget,
      );
    });

    testWidgets('a three-decimal currency keeps its third decimal',
        (WidgetTester tester) async {
      // KWD is a three-digit currency. The wire only ever carries two places
      // (every money column is Decimal(12,2)), so widening is exact — but
      // formatting 12.50 KWD as "12.50" is the wrong number by a factor of ten
      // in the last place a buyer reads.
      final LocalCart cart = LocalCart(
        lines: <LocalCartLine>[
          LocalCartLine(
            snapshot: cartLine(
              currency: 'KWD',
              unitPrice: 12.50,
              lineTotal: 12.50,
              qty: 1,
            ),
            qty: 1,
          ),
        ],
        updatedAt: DateTime.utc(2026, 9, 5),
      );
      await pumpCommerce(
        tester,
        const CartScreen(),
        overrides: commerceOverrides(cartStore: FakeCartStore(cart: cart)),
      );
      await tester.pump();
      expect(findMoney('12.500 KWD'), findsWidgets);
    });
  });

  group('CartScreen — minimum order quantities', () {
    testWidgets('a line below its minimum is flagged, never silently bumped',
        (WidgetTester tester) async {
      final FakeCartStore store = FakeCartStore(cart: cartBelowMoq());
      await pumpCommerce(
        tester,
        const CartScreen(),
        overrides: commerceOverrides(cartStore: store),
      );
      await tester.pump();

      expect(
        find.text('Below the minimum order for this product'),
        findsOneWidget,
      );
      // The quantity is still the buyer's 4. Nothing rewrote it on load.
      expect(find.text('4'), findsOneWidget);
      expect(store.saved, isNull);
    });

    testWidgets('the fix-it action raises the line, on the buyer’s tap',
        (WidgetTester tester) async {
      final FakeCartStore store = FakeCartStore(cart: cartBelowMoq());
      await pumpCommerce(
        tester,
        const CartScreen(),
        overrides: commerceOverrides(cartStore: store),
      );
      await tester.pump();

      await tester.tap(find.text('Raise to 25'));
      await tester.pump();

      expect(find.text('25'), findsOneWidget);
      expect(store.saved!.lines.single.qty, 25);
    });

    testWidgets('the stepper floor is the MOQ, not 1',
        (WidgetTester tester) async {
      final LocalCart atFloor = LocalCart(
        lines: <LocalCartLine>[
          LocalCartLine(snapshot: cartLine(qty: 25, moq: 25), qty: 25),
        ],
        updatedAt: DateTime.utc(2026, 9, 5),
      );
      final FakeCartStore store = FakeCartStore(cart: atFloor);
      await pumpCommerce(
        tester,
        const CartScreen(),
        overrides: commerceOverrides(cartStore: store),
      );
      await tester.pump();

      // The minus button states the floor rather than disappearing.
      expect(find.bySemanticsLabel('Minimum order is 25'), findsOneWidget);
      await tester.tap(find.bySemanticsLabel('Minimum order is 25'));
      await tester.pump();
      expect(find.text('25'), findsOneWidget);
      expect(store.saved, isNull);
    });

    testWidgets('checkout is blocked while a line is below its minimum',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CartScreen(),
        overrides: commerceOverrides(
          cartStore: FakeCartStore(cart: cartBelowMoq()),
        ),
      );
      await tester.pump();
      expect(
        find.textContaining('needs attention before checkout'),
        findsOneWidget,
      );
    });
  });

  group('CartScreen — the rules it must not break', () {
    testWidgets('there is no pull-to-refresh on the basket',
        (WidgetTester tester) async {
      // Re-pricing or re-ordering a basket under the user's thumb, mid
      // purchase, is hostile. The gesture is not offered at all.
      await pumpCommerce(
        tester,
        const CartScreen(),
        overrides: commerceOverrides(
          cartStore: FakeCartStore(cart: twoSellerCart()),
        ),
      );
      await tester.pump();
      expect(find.byType(RefreshIndicator), findsNothing);
    });

    testWidgets('every stepper control is at least 48dp',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CartScreen(),
        overrides: commerceOverrides(
          cartStore: FakeCartStore(cart: twoSellerCart()),
        ),
      );
      await tester.pump();

      for (final Element element
          in find.bySemanticsLabel('Increase quantity').evaluate()) {
        final Size size = element.size!;
        expect(size.width, greaterThanOrEqualTo(48.0));
        expect(size.height, greaterThanOrEqualTo(48.0));
      }
    });

    testWidgets('the subtotal survives 200% dynamic type',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CartScreen(),
        overrides: commerceOverrides(
          cartStore: FakeCartStore(cart: twoSellerCart()),
        ),
        textScale: 2.0,
      );
      await tester.pump();

      // Present, un-ellipsed, and nothing overflowed while drawing it.
      expect(findMoney('424.68 AED'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('it renders right-to-left without laying out backwards',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CartScreen(),
        overrides: commerceOverrides(
          cartStore: FakeCartStore(cart: twoSellerCart()),
        ),
        locale: const Locale('ar'),
      );
      await tester.pump();

      expect(
        Directionality.of(tester.element(find.byType(CartScreen))),
        TextDirection.rtl,
      );
      // Western digits in both locales, and the figure is bidi-isolated.
      expect(findMoney('424.68 AED'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
