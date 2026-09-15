import 'package:avenick/api/models/checkout.dart';
import 'package:avenick/api/models/enums.dart';
import 'package:avenick/core/ui/async_state_view.dart';
import 'package:avenick/features/commerce/commerce.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:riverpod/misc.dart' show Override;

import 'harness.dart';

const ShippingAddress _warehouse = ShippingAddress(
  label: 'Warehouse',
  line1: 'Plot 42, Industrial Area 3',
  city: 'Sharjah',
  country: Country.ae,
);

List<Override> _checkoutOverrides({
  required FakeCheckoutGateway checkout,
  OrderPlacement? placement,
}) =>
    commerceOverrides(
      checkout: checkout,
      cartStore: FakeCartStore(cart: twoSellerCart()),
      placement: placement,
      addresses: const <ShippingAddress>[_warehouse],
    );

Future<void> _tapText(WidgetTester tester, String label) async {
  final Finder finder = find.text(label);
  await scrollTo(tester, finder);
  await tester.tap(finder);
  await tester.pump();
  await tester.pump();
}

/// Walks the address step by choosing the saved address, which is what a
/// returning buyer does.
Future<void> _useSavedAddress(WidgetTester tester) async {
  await _tapText(tester, 'Deliver here');
}

Future<void> _reachReview(WidgetTester tester) async {
  await _useSavedAddress(tester);
  await _tapText(tester, 'Continue to payment');
  await _tapText(tester, 'Bank transfer');
}

void main() {
  group('CheckoutScreen — the four states', () {
    testWidgets('loading', (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CheckoutScreen(),
        overrides: _checkoutOverrides(
          checkout: FakeCheckoutGateway(pending: true),
        ),
      );
      await tester.pump();
      await _useSavedAddress(tester);
      expect(find.byType(MeridianSkeleton), findsOneWidget);
    });

    testWidgets('error', (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CheckoutScreen(),
        overrides: _checkoutOverrides(
          checkout: FakeCheckoutGateway(failure: Exception('quote refused')),
        ),
      );
      await tester.pump();
      await _useSavedAddress(tester);
      expect(find.text('Something went wrong'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('empty — a quote that priced no lines',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CheckoutScreen(),
        overrides: _checkoutOverrides(
          checkout: FakeCheckoutGateway(
            result: checkoutQuote(lines: const <Map<String, dynamic>>[]),
          ),
        ),
      );
      await tester.pump();
      await _useSavedAddress(tester);
      expect(find.text('This quote priced nothing'), findsOneWidget);
    });

    testWidgets('data', (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CheckoutScreen(),
        overrides: _checkoutOverrides(
          checkout: FakeCheckoutGateway(result: checkoutQuote()),
        ),
      );
      await tester.pump();
      await _useSavedAddress(tester);
      expect(find.text('Delivery is priced for this address'), findsOneWidget);
      expect(find.text('2–4 days'), findsOneWidget);
    });
  });

  group('CheckoutScreen — the money rules', () {
    testWidgets('the VAT split is on screen, both components and the sum',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CheckoutScreen(),
        overrides: _checkoutOverrides(
          checkout: FakeCheckoutGateway(result: checkoutQuote()),
        ),
      );
      await tester.pump();
      await _reachReview(tester);
      await scrollTo(tester, find.text('VAT total'));

      // PR #21 was VAT on the goods and not on the delivery. A single "VAT"
      // line is indistinguishable from a correct one, so both components are
      // rendered beside the aggregate.
      expect(find.text('VAT on the items'), findsOneWidget);
      expect(findMoney('1.11 AED'), findsOneWidget);
      expect(find.text('VAT on delivery'), findsOneWidget);
      expect(findMoney('1.00 AED'), findsOneWidget);
      expect(find.text('VAT total'), findsOneWidget);
      expect(findMoney('2.11 AED'), findsOneWidget);
    });

    testWidgets('every figure is the quote’s own, rendered unmodified',
        (WidgetTester tester) async {
      final CheckoutQuote quote = checkoutQuote();
      await pumpCommerce(
        tester,
        const CheckoutScreen(),
        overrides: _checkoutOverrides(
          checkout: FakeCheckoutGateway(result: quote),
        ),
      );
      await tester.pump();
      await _reachReview(tester);

      // Not "44.32" typed into the test — the model's own formatting of the
      // model's own field. If the screen computed anything, these diverge.
      await scrollTo(tester, find.text('VAT total'));
      // The subtotal figure appears twice — as the line total and as the
      // "Items" row — because this quote has one line. Both are the same
      // field of the same object, which is the point.
      expect(findMoney(quote.money.total.format()), findsOneWidget);
      expect(findMoney(quote.money.subtotal.format()), findsWidgets);
      expect(findMoney(quote.money.vatAmount.format()), findsOneWidget);
      expect(
        findMoney(quote.money.goodsVatAmount.format()),
        findsOneWidget,
      );
      expect(
        findMoney(quote.money.shippingVatAmount.format()),
        findsOneWidget,
      );
    });

    testWidgets(
        'unpriced freight is "quoted separately", never zero and never free',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CheckoutScreen(),
        overrides: _checkoutOverrides(
          checkout: FakeCheckoutGateway(
            result: checkoutQuote(
              totals: totalsWithoutFreightJson(),
              shippingStatus: 'unpriced_no_zones',
              shippingAmount: 0,
            ),
          ),
        ),
      );
      await tester.pump();
      await _reachReview(tester);
      await scrollTo(tester, find.text('VAT total'));

      // `unpriced_no_zones` sends amount: 0. Zero-because-unknown is on the
      // wire as zero-because-free, and only the status tells them apart.
      expect(find.text('Quoted separately'), findsOneWidget);
      expect(find.text('Not yet priced'), findsOneWidget);
      expect(find.textContaining('Free'), findsNothing);
      expect(
        find.text('Delivery is not included in this total'),
        findsOneWidget,
      );
      expect(findMoney('0.00 AED'), findsNothing);
    });

    testWidgets('a zero-rated market shows a stated zero, not an absence',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CheckoutScreen(),
        overrides: _checkoutOverrides(
          checkout: FakeCheckoutGateway(
            result: checkoutQuote(
              totals: <String, dynamic>{
                'subtotal': 100.00,
                'discountAmount': 0.00,
                'goodsVatAmount': 0.00,
                'shippingAmount': 15.00,
                'shippingVatAmount': 0.00,
                'vatAmount': 0.00,
                'total': 115.00,
              },
              shippingAmount: 15.00,
            ),
          ),
        ),
      );
      await tester.pump();
      await _reachReview(tester);
      await scrollTo(tester, find.text('VAT total'));

      expect(
        find.textContaining('Delivery is zero-rated in this market'),
        findsOneWidget,
      );
      expect(find.text('Not recorded'), findsNothing);
    });

    testWidgets('the quote request carries no money at all',
        (WidgetTester tester) async {
      final FakeCheckoutGateway gateway =
          FakeCheckoutGateway(result: checkoutQuote());
      await pumpCommerce(
        tester,
        const CheckoutScreen(),
        overrides: _checkoutOverrides(checkout: gateway),
      );
      await tester.pump();
      await _useSavedAddress(tester);

      final Map<String, Object?> body = gateway.requests.single.toJson();
      // A shipping figure the client can influence is a discount the client
      // can grant itself.
      for (final String forbidden in <String>[
        'unitPrice',
        'price',
        'total',
        'vatAmount',
        'shippingAmount',
        'discountAmount',
      ]) {
        expect(body.containsKey(forbidden), isFalse);
      }
      expect(body['currency'], 'AED');
      expect(body['items'], isA<List<Map<String, Object?>>>());
    });
  });

  group('CheckoutScreen — payment methods are what the server accepts', () {
    testWidgets('only bank transfer is offered; the cards state their reason',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CheckoutScreen(),
        overrides: _checkoutOverrides(
          checkout: FakeCheckoutGateway(result: checkoutQuote()),
        ),
      );
      await tester.pump();
      await _useSavedAddress(tester);
      await _tapText(tester, 'Continue to payment');

      expect(find.text('How you will pay'), findsOneWidget);
      expect(find.text('Bank transfer'), findsOneWidget);

      // The four card methods 503 on the order route. They are shown with the
      // reason rather than as buttons that fail at the last step of a
      // purchase.
      expect(find.text('Not available yet'), findsOneWidget);
      for (final String method in <String>[
        'mada',
        'Apple Pay',
        'Credit or debit card',
        'STC Pay',
      ]) {
        await scrollTo(tester, find.text(method));
        expect(find.text(method), findsOneWidget);
      }
      expect(
        find.text(kCertificationReason),
        findsNWidgets(4),
      );
    });

    testWidgets('an unavailable method cannot be selected by tapping it',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CheckoutScreen(),
        overrides: _checkoutOverrides(
          checkout: FakeCheckoutGateway(result: checkoutQuote()),
        ),
      );
      await tester.pump();
      await _useSavedAddress(tester);
      await _tapText(tester, 'Continue to payment');

      await _tapText(tester, 'Apple Pay');

      // Still on the payment step: the tap did nothing, which is the whole
      // point.
      expect(find.text('How you will pay'), findsOneWidget);
      expect(find.text('Total'), findsNothing);
    });

    testWidgets('the pilot mock method appears only where it is enabled',
        (WidgetTester tester) async {
      final List<PaymentMethodOption> off =
          paymentMethodsFor(mockPaymentsEnabled: false);
      final List<PaymentMethodOption> on =
          paymentMethodsFor(mockPaymentsEnabled: true);

      expect(
        off.where((PaymentMethodOption o) => o.method == PaymentMethod.mock),
        isEmpty,
      );
      expect(on.first.method, PaymentMethod.mock);
      expect(on.first.enabled, isTrue);
    });
  });

  group('CheckoutScreen — placing the order', () {
    testWidgets('with no place-order endpoint there is no button, only a why',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CheckoutScreen(),
        overrides: _checkoutOverrides(
          checkout: FakeCheckoutGateway(result: checkoutQuote()),
        ),
      );
      await tester.pump();
      await _reachReview(tester);
      await scrollTo(tester, find.text('This build cannot place the order'));

      expect(find.text('This build cannot place the order'), findsOneWidget);
      expect(find.text('Place order'), findsNothing);
    });

    testWidgets('with one wired, it places and lands on the confirmation',
        (WidgetTester tester) async {
      final FakeOrderPlacement placement = FakeOrderPlacement();
      await pumpCommerce(
        tester,
        const CheckoutScreen(),
        overrides: <Override>[
          ..._checkoutOverrides(
            checkout: FakeCheckoutGateway(result: checkoutQuote()),
            placement: placement,
          ),
          ordersGatewayProvider.overrideWithValue(
            FakeOrdersGateway(detail: orderDetail()),
          ),
        ],
      );
      await tester.pump();
      await _reachReview(tester);

      await scrollTo(tester, find.text('Place order'));
      expect(find.text('Place order'), findsOneWidget);
      await tester.tap(find.text('Place order'));
      await tester.pump();
      await tester.pump();

      expect(placement.calls, 1);
      expect(find.byType(OrderConfirmedScreen), findsOneWidget);
    });
  });

  group('CheckoutScreen — the rules it must not break', () {
    testWidgets('there is no pull-to-refresh mid-purchase',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CheckoutScreen(),
        overrides: _checkoutOverrides(
          checkout: FakeCheckoutGateway(result: checkoutQuote()),
        ),
      );
      await tester.pump();
      await _reachReview(tester);
      expect(find.byType(RefreshIndicator), findsNothing);
    });

    testWidgets('the total does not truncate at 200% dynamic type',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const CheckoutScreen(),
        overrides: _checkoutOverrides(
          checkout: FakeCheckoutGateway(result: checkoutQuote()),
        ),
        textScale: 2.0,
      );
      await tester.pump();
      await _reachReview(tester);
      await scrollTo(tester, findMoney('44.32 AED'));

      expect(findMoney('44.32 AED'), findsOneWidget);
      final Text total = tester.widget<Text>(findMoney('44.32 AED'));
      expect(total.overflow, isNot(TextOverflow.ellipsis));
      expect(total.maxLines, isNull);
      expect(tester.takeException(), isNull);
    });

    testWidgets('an expired quote is not silently re-priced',
        (WidgetTester tester) async {
      final FakeCheckoutGateway gateway = FakeCheckoutGateway(
        result: checkoutQuote(expiresAt: DateTime.utc(2020, 1, 1)),
      );
      await pumpCommerce(
        tester,
        const CheckoutScreen(),
        overrides: _checkoutOverrides(checkout: gateway),
      );
      await tester.pump();
      await _reachReview(tester);

      expect(find.text('This price has expired'), findsOneWidget);
      expect(find.text('Get a new price'), findsOneWidget);
      // One request so far — nothing re-quoted itself behind the buyer.
      expect(gateway.requests.length, 1);
    });
  });
}
