import 'package:avenick/api/models/cart.dart';
import 'package:avenick/api/models/checkout.dart';
import 'package:avenick/api/models/enums.dart';
import 'package:avenick/core/ui/key_button.dart';
import 'package:avenick/features/commerce/commerce.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:riverpod/misc.dart' show Override;

import 'harness.dart';

/// CHANNEL AWARENESS — a quote-only product can never be bought.
///
/// `pilot-catalog.ts` imports the whole catalogue with `isB2CEnabled: false`
/// and `orders.ts` refuses a B2C order containing such a product, so a basket
/// holding one is a basket that cannot check out. These tests pin the three
/// behaviours that follow: the guard is in the state layer, a basket restored
/// with one is fixable rather than fatal, and the checkout never asks how the
/// buyer would like to pay for it.
///
/// The flag itself is NOT on the wire — see [B2CEligibility]. The tests state
/// it explicitly through the port, which is exactly what the app must do until
/// the contract carries it.
void main() {
  const FakeB2CEligibility quoteOnlyCatalogue = FakeB2CEligibility(
    quoteOnlyProductIds: <String>{'prd_cl_1'},
  );

  group('the guard lives in the cart state layer', () {
    test('add() refuses a quote-only line outright', () async {
      final ProviderContainer container = ProviderContainer(
        overrides: <Override>[
          cartStoreProvider.overrideWithValue(FakeCartStore()),
          b2cEligibilityProvider.overrideWithValue(quoteOnlyCatalogue),
        ],
      );
      addTearDown(container.dispose);
      await container.read(cartControllerProvider.future);

      final CartAddOutcome outcome =
          await container.read(cartControllerProvider.notifier).add(cartLine());

      // Not "added and then flagged": refused. A deep link, another feature or
      // a restored basket all pass through this one door.
      expect(outcome, CartAddOutcome.refusedQuoteOnly);
      expect(container.read(cartControllerProvider).value!.lines, isEmpty);
    });

    test('a sellable line is admitted and marked as such', () async {
      final ProviderContainer container = ProviderContainer(
        overrides: <Override>[
          cartStoreProvider.overrideWithValue(FakeCartStore()),
          b2cEligibilityProvider.overrideWithValue(
            const FakeB2CEligibility(),
          ),
        ],
      );
      addTearDown(container.dispose);
      await container.read(cartControllerProvider.future);

      final CartAddOutcome outcome =
          await container.read(cartControllerProvider.notifier).add(cartLine());

      expect(outcome, CartAddOutcome.added);
      expect(
        container.read(cartControllerProvider).value!.lines.single.sellability,
        B2CSellability.sellable,
      );
    });

    test('a restored basket is re-appraised, not trusted', () async {
      // The line was saved when it was sellable. The flag lives on the server
      // and has flipped since.
      final FakeCartStore store = FakeCartStore(
        cart: LocalCart(
          lines: <LocalCartLine>[
            LocalCartLine(
              snapshot: cartLine(),
              qty: 2,
              sellability: B2CSellability.sellable,
            ),
          ],
          updatedAt: DateTime.utc(2026, 9, 5),
        ),
      );
      final ProviderContainer container = ProviderContainer(
        overrides: <Override>[
          cartStoreProvider.overrideWithValue(store),
          b2cEligibilityProvider.overrideWithValue(quoteOnlyCatalogue),
        ],
      );
      addTearDown(container.dispose);

      final LocalCart cart = await container.read(cartControllerProvider.future);

      expect(cart.lines.single.sellability, B2CSellability.quoteOnly);
      // Kept, not dropped: a basket that silently loses a line is a basket the
      // buyer stops trusting.
      expect(cart.lines, hasLength(1));
      expect(cart.hasQuoteOnlyLines, isTrue);
      expect(cart.canCheckOut, isFalse);
    });

    test('the default eligibility states nothing rather than guessing', () {
      // `CartLine.channel` says which channel the line was PRICED in, which is
      // a different fact from whether the product may be sold in it. The
      // default port does not read it.
      const B2CEligibility eligibility = UnstatedB2CEligibility();
      expect(eligibility.of(cartLine()), B2CSellability.unstated);
      final CartLine b2bLine = CartLine.fromJson(<String, dynamic>{
        ...cartLineJson(),
        'channel': 'B2B',
      });
      expect(eligibility.of(b2bLine), B2CSellability.unstated);
    });
  });

  group('CartScreen — the quote-only state is distinct and fixable', () {
    testWidgets('the line is named, explained, and offers both ways out',
        (WidgetTester tester) async {
      final FakeCartStore store = FakeCartStore(cart: twoSellerCart());
      await pumpCommerce(
        tester,
        CartScreen(onRequestQuote: (String _) {}),
        overrides: commerceOverrides(
          cartStore: store,
          eligibility: quoteOnlyCatalogue,
        ),
      );
      await tester.pump();

      expect(find.text('This item is quote-only now'), findsOneWidget);
      expect(
        find.textContaining('Brass gate valve 2" can no longer be bought'),
        findsOneWidget,
      );
      expect(find.text('Remove it'), findsOneWidget);
      expect(find.text('Ask for a quote'), findsOneWidget);
    });

    testWidgets('the quote action is omitted when there is nowhere to send it',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CartScreen(),
        overrides: commerceOverrides(
          cartStore: FakeCartStore(cart: twoSellerCart()),
          eligibility: quoteOnlyCatalogue,
        ),
      );
      await tester.pump();

      expect(find.text('Remove it'), findsOneWidget);
      expect(find.text('Ask for a quote'), findsNothing);
    });

    testWidgets('it is named separately from an MOQ problem, not lumped in',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CartScreen(),
        overrides: commerceOverrides(
          cartStore: FakeCartStore(cart: twoSellerCart()),
          eligibility: quoteOnlyCatalogue,
        ),
      );
      await tester.pump();
      await scrollTo(tester, find.textContaining('1 item is quote-only'));

      expect(find.textContaining('1 item is quote-only'), findsOneWidget);
      expect(
        find.textContaining('lines need attention before checkout'),
        findsNothing,
      );
    });

    testWidgets('checkout is blocked, and the rest of the basket is not',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CartScreen(),
        overrides: commerceOverrides(
          cartStore: FakeCartStore(cart: twoSellerCart()),
          eligibility: quoteOnlyCatalogue,
        ),
      );
      await tester.pump();

      // The other seller's line is untouched — still priced, still steppable.
      await scrollTo(tester, find.text('Centrifugal pump'));
      expect(findMoney('400.00 AED'), findsWidgets);
      expect(find.text('Check out'), findsOneWidget);
    });

    testWidgets('removing the line clears the block',
        (WidgetTester tester) async {
      final FakeCartStore store = FakeCartStore(cart: twoSellerCart());
      await pumpCommerce(
        tester,
        const CartScreen(),
        overrides: commerceOverrides(
          cartStore: store,
          eligibility: quoteOnlyCatalogue,
        ),
      );
      await tester.pump();

      await scrollTo(tester, find.text('Remove it'));
      await tester.tap(find.text('Remove it'));
      await tester.pump();

      expect(find.text('This item is quote-only now'), findsNothing);
      expect(store.saved!.lines, hasLength(1));
      expect(store.saved!.hasQuoteOnlyLines, isFalse);
    });
  });

  group('CheckoutScreen — no payment step for a basket that cannot be sold',
      () {
    testWidgets('the payment step is unreachable and says why',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CheckoutScreen(),
        overrides: commerceOverrides(
          checkout: FakeCheckoutGateway(result: checkoutQuote()),
          cartStore: FakeCartStore(cart: twoSellerCart()),
          eligibility: quoteOnlyCatalogue,
          addresses: const <ShippingAddress>[
            ShippingAddress(
              label: 'Warehouse',
              line1: 'Plot 42, Industrial Area 3',
              city: 'Sharjah',
              country: Country.ae,
            ),
          ],
        ),
      );
      await tester.pump();
      await tester.tap(find.text('Deliver here'));
      await tester.pump();
      await tester.pump();

      // The price is still shown — it is real and it came from the server.
      expect(find.text('Delivery is priced for this address'), findsOneWidget);
      // But the way on is closed, with the reason beside it.
      expect(
        find.text('A quote-only item is still in the basket'),
        findsOneWidget,
      );
      await scrollTo(tester, find.text('Continue to payment'));
      final KeyButton onwards = tester.widget<KeyButton>(
        find.widgetWithText(KeyButton, 'Continue to payment'),
      );
      expect(onwards.onPressed, isNull);
    });

    testWidgets('the step bar will not open payment either',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CheckoutScreen(),
        overrides: commerceOverrides(
          checkout: FakeCheckoutGateway(result: checkoutQuote()),
          cartStore: FakeCartStore(cart: twoSellerCart()),
          eligibility: quoteOnlyCatalogue,
          addresses: const <ShippingAddress>[
            ShippingAddress(
              label: 'Warehouse',
              line1: 'Plot 42, Industrial Area 3',
              city: 'Sharjah',
              country: Country.ae,
            ),
          ],
        ),
      );
      await tester.pump();
      await tester.tap(find.text('Deliver here'));
      await tester.pump();
      await tester.pump();

      await tester.tap(find.text('3. Payment'));
      await tester.pump();

      expect(find.text('How you will pay'), findsNothing);
      expect(find.text('Bank transfer'), findsNothing);
    });
  });
}
