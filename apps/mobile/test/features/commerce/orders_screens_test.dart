import 'package:avenick/api/models/enums.dart';
import 'package:avenick/api/models/order.dart';
import 'package:avenick/core/l10n/directional_text.dart';
import 'package:avenick/core/ui/async_state_view.dart';
import 'package:avenick/features/commerce/commerce.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'harness.dart';

void main() {
  group('OrdersListScreen — the four states', () {
    testWidgets('loading', (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const OrdersListScreen(),
        overrides: commerceOverrides(
          orders: FakeOrdersGateway(pending: true),
        ),
      );
      expect(find.byType(MeridianSkeleton), findsOneWidget);
    });

    testWidgets('empty — and still refreshable', (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const OrdersListScreen(),
        overrides: commerceOverrides(orders: FakeOrdersGateway()),
      );
      await tester.pump();
      expect(find.text('No orders yet'), findsOneWidget);
      // The gesture must work in the state that most needs it. An empty list
      // with no scrollable is where pull-to-refresh usually dies.
      expect(find.byType(RefreshIndicator), findsOneWidget);
    });

    testWidgets('error', (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const OrdersListScreen(),
        overrides: commerceOverrides(
          orders: FakeOrdersGateway(failure: Exception('gateway down')),
        ),
      );
      await tester.pump();
      expect(find.text('Something went wrong'), findsOneWidget);
    });

    testWidgets('data', (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const OrdersListScreen(),
        overrides: commerceOverrides(
          orders: FakeOrdersGateway(cards: <OrderCard>[orderCard()]),
        ),
      );
      await tester.pump();
      expect(find.text('Shipped'), findsOneWidget);
      expect(findMoney('44.32 AED'), findsOneWidget);
    });
  });

  group('OrdersListScreen — behaviour', () {
    testWidgets('pull-to-refresh re-asks the server',
        (WidgetTester tester) async {
      final FakeOrdersGateway gateway =
          FakeOrdersGateway(cards: <OrderCard>[orderCard()]);
      await pumpCommerce(
        tester,
        const OrdersListScreen(),
        overrides: commerceOverrides(orders: gateway),
      );
      await tester.pump();
      expect(gateway.orderCalls, 1);

      await tester.fling(find.byType(RefreshIndicator), const Offset(0, 300), 1000);
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(seconds: 1));

      expect(gateway.orderCalls, 2);
    });

    testWidgets('the order number is bidi-isolated in Arabic',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const OrdersListScreen(),
        overrides: commerceOverrides(
          orders: FakeOrdersGateway(cards: <OrderCard>[orderCard()]),
        ),
        locale: const Locale('ar'),
      );
      await tester.pump();

      // Not `find.text('AVN-2026-000123')`: an order number embedded in an
      // Arabic paragraph is reordered by the bidi algorithm unless it is
      // isolated, and what is on screen would not be what is in the database.
      expect(find.text('AVN-2026-000123'), findsNothing);
      expect(findToken('AVN-2026-000123', LtrToken.orderId), findsOneWidget);
    });
  });

  group('OrderStatusPill — the tone map is the tone map', () {
    void expectTone(OrderStatus status, CommerceTone tone) {
      expect(presentationFor(status).tone, tone, reason: status.name);
    }

    test('waiting on the BUYER is warning', () {
      expectTone(OrderStatus.pendingPayment, CommerceTone.warning);
      expectTone(OrderStatus.returnRequested, CommerceTone.warning);
    });

    test('in progress is accent, told apart by icon and never by a fifth hue',
        () {
      const List<OrderStatus> inProgress = <OrderStatus>[
        OrderStatus.paymentConfirmed,
        OrderStatus.confirmed,
        OrderStatus.shipped,
        OrderStatus.outForDelivery,
      ];
      for (final OrderStatus status in inProgress) {
        expectTone(status, CommerceTone.accent);
      }
      final Set<IconData> icons = inProgress
          .map((OrderStatus s) => presentationFor(s).icon)
          .toSet();
      expect(icons, hasLength(4));
    });

    test('delivered is success and cancelled is danger', () {
      expectTone(OrderStatus.delivered, CommerceTone.success);
      expectTone(OrderStatus.cancelled, CommerceTone.danger);
    });

    test('REFUNDED is neutral — money returned is terminal, not an error', () {
      expectTone(OrderStatus.refunded, CommerceTone.neutral);
      expectTone(OrderStatus.processing, CommerceTone.neutral);
      expectTone(OrderStatus.returned, CommerceTone.neutral);
    });

    test('every status has a presentation', () {
      for (final OrderStatus status in OrderStatus.values) {
        expect(presentationFor(status).label, isNotEmpty);
      }
    });
  });

  group('OrderDetailScreen — the four states', () {
    testWidgets('loading', (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const OrderDetailScreen(orderId: 'ord_1'),
        overrides: commerceOverrides(
          orders: FakeOrdersGateway(pending: true),
        ),
      );
      expect(find.byType(MeridianSkeleton), findsOneWidget);
    });

    testWidgets('empty — an order with no lines is a reportable state',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const OrderDetailScreen(orderId: 'ord_1'),
        overrides: commerceOverrides(
          orders: FakeOrdersGateway(
            detail: orderDetail(items: const <Map<String, dynamic>>[]),
          ),
        ),
      );
      await tester.pump();
      expect(find.text('This order has no lines'), findsOneWidget);
    });

    testWidgets('error', (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const OrderDetailScreen(orderId: 'ord_1'),
        overrides: commerceOverrides(
          orders: FakeOrdersGateway(failure: Exception('not found')),
        ),
      );
      await tester.pump();
      expect(find.text('Something went wrong'), findsOneWidget);
    });

    testWidgets('data', (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const OrderDetailScreen(orderId: 'ord_1'),
        overrides: commerceOverrides(
          orders: FakeOrdersGateway(detail: orderDetail()),
        ),
      );
      await tester.pump();
      expect(findToken('AVN-2026-000123', LtrToken.orderId), findsOneWidget);
      expect(find.byType(RefreshIndicator), findsOneWidget);
    });
  });

  group('OrderDetailScreen — the persisted totals', () {
    testWidgets('a recorded VAT split is shown as two components',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const OrderDetailScreen(orderId: 'ord_1'),
        overrides: commerceOverrides(
          orders: FakeOrdersGateway(detail: orderDetail()),
        ),
      );
      await tester.pump();
      await scrollTo(tester, find.text('VAT total'));

      expect(findMoney('1.11 AED'), findsWidgets);
      expect(findMoney('1.00 AED'), findsOneWidget);
      expect(find.text('Not recorded'), findsNothing);
    });

    testWidgets('an unrecorded split reads "Not recorded", never zero',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const OrderDetailScreen(orderId: 'ord_1'),
        overrides: commerceOverrides(
          orders: FakeOrdersGateway(
            detail: orderDetail(
              totals: persistedTotalsWithoutBreakdownJson(),
            ),
          ),
        ),
      );
      await tester.pump();
      await scrollTo(tester, find.text('VAT total'));

      // "VAT on delivery: 0.00" is the exact claim PR #21 shipped by accident.
      expect(find.text('Not recorded'), findsNWidgets(2));
      expect(findMoney('0.00 AED'), findsNothing);
      expect(
        find.text('This order did not record how its VAT split'),
        findsOneWidget,
      );
      // The aggregate is still exact and still shown.
      expect(findMoney('2.11 AED'), findsOneWidget);
    });

    testWidgets('the status history is a timeline, oldest first',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const OrderDetailScreen(orderId: 'ord_1'),
        overrides: commerceOverrides(
          orders: FakeOrdersGateway(detail: orderDetail()),
        ),
      );
      await tester.pump();
      await scrollTo(tester, find.text('History'));

      expect(find.text('Awaiting bank transfer.'), findsOneWidget);
      expect(find.text('Handed to the carrier.'), findsOneWidget);
      final double first = tester
          .getTopLeft(find.text('Awaiting bank transfer.'))
          .dy;
      final double second =
          tester.getTopLeft(find.text('Handed to the carrier.')).dy;
      expect(first, lessThan(second));
    });
  });

  group('OrderConfirmedScreen', () {
    testWidgets('loading', (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const OrderConfirmedScreen(orderId: 'ord_1'),
        overrides: commerceOverrides(
          orders: FakeOrdersGateway(pending: true),
        ),
      );
      expect(find.byType(MeridianSkeleton), findsOneWidget);
    });

    testWidgets('error', (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const OrderConfirmedScreen(orderId: 'ord_1'),
        overrides: commerceOverrides(
          orders: FakeOrdersGateway(failure: Exception('gone')),
        ),
      );
      await tester.pump();
      expect(find.text('Something went wrong'), findsOneWidget);
    });

    testWidgets('empty', (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const OrderConfirmedScreen(orderId: 'ord_1'),
        overrides: commerceOverrides(
          orders: FakeOrdersGateway(
            detail: orderDetail(items: const <Map<String, dynamic>>[]),
          ),
        ),
      );
      await tester.pump();
      expect(
        find.text('The order was placed but came back with no lines'),
        findsOneWidget,
      );
    });

    testWidgets('data — the order number is the first thing said',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const OrderConfirmedScreen(orderId: 'ord_1'),
        overrides: commerceOverrides(
          orders: FakeOrdersGateway(detail: orderDetail()),
        ),
      );
      await tester.pump();
      expect(find.text('Thank you — the order is in'), findsOneWidget);
      expect(findToken('AVN-2026-000123', LtrToken.orderId), findsOneWidget);
    });

    testWidgets('two sellers means two deliveries and TWO dates',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const OrderConfirmedScreen(orderId: 'ord_1'),
        overrides: commerceOverrides(
          orders: FakeOrdersGateway(detail: twoSellerOrder()),
          sellerNames: const <String, String>{
            'sel_1': 'Gulf Valve Trading',
            'sel_2': 'Emirates Pumps',
          },
        ),
      );
      await tester.pump();

      expect(
        find.textContaining('there is no single arrival date for the order'),
        findsOneWidget,
      );
      // Each delivery carries its own estimate. Never one blended date.
      expect(find.text('Delivery 1 — In transit'), findsOneWidget);
      expect(find.text('Delivery 2 — Not dispatched yet'), findsOneWidget);
      expect(find.text('Sep 7, 2026'), findsOneWidget);
      expect(find.text('Sep 19, 2026'), findsOneWidget);
    });

    testWidgets('with no shipment yet, no date is guessed',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const OrderConfirmedScreen(orderId: 'ord_1'),
        overrides: commerceOverrides(
          orders: FakeOrdersGateway(
            detail: orderDetail(shipments: const <Map<String, dynamic>>[]),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('No delivery has been created yet'), findsOneWidget);
      expect(
        find.textContaining('will not guess one'),
        findsOneWidget,
      );
    });

    testWidgets('items are grouped by seller, and the parcels listed apart',
        (WidgetTester tester) async {
      await pumpCommerce(
        tester,
        const OrderConfirmedScreen(orderId: 'ord_1'),
        overrides: commerceOverrides(
          orders: FakeOrdersGateway(detail: twoSellerOrder()),
          sellerNames: const <String, String>{
            'sel_1': 'Gulf Valve Trading',
            'sel_2': 'Emirates Pumps',
          },
        ),
      );
      await tester.pump();

      // The contract does not say which parcel carries which line, so the app
      // does not pretend it does. This sits with the deliveries, above the
      // groups.
      expect(find.byType(ShipmentLinkageNote), findsWidgets);

      await scrollTo(tester, find.text('Gulf Valve Trading'));
      expect(find.text('Dispatch 1 of 2'), findsOneWidget);

      await scrollTo(tester, find.text('Emirates Pumps'));
      expect(find.text('Dispatch 2 of 2'), findsOneWidget);
    });
  });
}
