import 'dart:async';

import 'package:avenick/api/models/cart.dart';
import 'package:avenick/api/models/checkout.dart';
import 'package:avenick/api/models/enums.dart';
import 'package:avenick/api/models/order.dart';
import 'package:avenick/api/models/requests.dart';
import 'package:avenick/api/models/common.dart' show PageMeta;
import 'package:avenick/core/l10n/directional_text.dart';
import 'package:avenick/core/network/page.dart' as net;
import 'package:avenick/features/commerce/commerce.dart';
import 'package:avenick/theme/meridian_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:riverpod/misc.dart' show Override;

// ---------------------------------------------------------------------------
// FIXTURES
//
// Shapes taken from `packages/contracts/openapi.json` — the same payloads
// `test/api/fixtures.dart` is built from, restated here so this feature's
// tests own their own data. Every money field is a JSON number in major units
// with two decimal places, which is what `composeOrderTotals`'s
// `Number(v.toFixed(2))` actually produces.
// ---------------------------------------------------------------------------

Map<String, dynamic> imageJson() => <String, dynamic>{
      'url': 'https://cdn.avenick.com/p/valve-01.jpg',
      'width': 1200,
      'height': 1200,
      'blurhash': 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
      'alt': 'Brass gate valve',
    };

Map<String, dynamic> cartLineJson({
  /// Quote-only lines are the production default, so a fixture must be able to
  /// say so — the real catalogue answers false for every row.
  bool sellableInChannel = true,
  String id = 'cl_1',
  String productId = 'prd_1',
  String sellerId = 'sel_1',
  String sku = 'BGV-2',
  String nameEn = 'Brass gate valve 2"',
  int qty = 2,
  int moq = 1,
  num unitPrice = 12.34,
  num lineTotal = 24.68,
  String currency = 'AED',
  bool priceTiered = false,
  String availability = 'IN_STOCK',
}) =>
    <String, dynamic>{
      'id': id,
      'productId': productId,
      'variantId': null,
      'sellerId': sellerId,
      'slug': 'brass-gate-valve-2-inch',
      'sku': sku,
      'nameEn': nameEn,
      'nameAr': 'محبس نحاسي ٢ بوصة',
      'image': null,
      'channel': 'B2C',
      'qty': qty,
      'moq': moq,
      'unitPrice': unitPrice,
      'currency': currency,
      'vatRatePercent': 5,
      'priceTiered': priceTiered,
      'availability': availability,
      // Required on `CartLine` as of the regenerated contract: whether this
      // line can be ORDERED in the channel it was priced in. These fixtures
      // are the sellable case; the quote-only case in this suite is driven
      // through the `B2CEligibility` port, which can now be wired to this
      // field instead of answering `unstated` — see commerce_gateways.dart.
      'sellableInChannel': sellableInChannel,
      'lineTotal': lineTotal,
    };

CartLine cartLine({
  bool sellableInChannel = true,
  String id = 'cl_1',
  String sellerId = 'sel_1',
  String sku = 'BGV-2',
  String nameEn = 'Brass gate valve 2"',
  int qty = 2,
  int moq = 1,
  num unitPrice = 12.34,
  num lineTotal = 24.68,
  String currency = 'AED',
  bool priceTiered = false,
  String availability = 'IN_STOCK',
}) =>
    CartLine.fromJson(
      cartLineJson(
        sellableInChannel: sellableInChannel,
        id: id,
        productId: 'prd_$id',
        sellerId: sellerId,
        sku: sku,
        nameEn: nameEn,
        qty: qty,
        moq: moq,
        unitPrice: unitPrice,
        lineTotal: lineTotal,
        currency: currency,
        priceTiered: priceTiered,
        availability: availability,
      ),
    );

/// A basket touching two sellers — the case the whole cart screen is shaped
/// around.
LocalCart twoSellerCart() => LocalCart(
      lines: <LocalCartLine>[
        LocalCartLine(snapshot: cartLine(), qty: 2),
        LocalCartLine(
          snapshot: cartLine(
            id: 'cl_2',
            sellerId: 'sel_2',
            sku: 'PMP-9',
            nameEn: 'Centrifugal pump',
            qty: 1,
            unitPrice: 400.00,
            lineTotal: 400.00,
          ),
          qty: 1,
        ),
      ],
      updatedAt: DateTime.utc(2026, 9, 5),
    );

/// The B2B case: a line sitting under a minimum the seller raised after it was
/// added.
LocalCart cartBelowMoq() => LocalCart(
      lines: <LocalCartLine>[
        LocalCartLine(
          snapshot: cartLine(qty: 4, moq: 25, lineTotal: 49.36),
          qty: 4,
        ),
      ],
      updatedAt: DateTime.utc(2026, 9, 5),
    );

/// CORRECT totals — VAT on the goods AND on the delivery, and the two
/// components sum to `vatAmount`.
Map<String, dynamic> orderTotalsJson() => <String, dynamic>{
      'subtotal': 24.68,
      'discountAmount': 2.47,
      'goodsVatAmount': 1.11,
      'shippingAmount': 20.00,
      'shippingVatAmount': 1.00,
      'vatAmount': 2.11,
      'total': 44.32,
    };

/// A quote where no zone covers the address: `amount` is 0 because freight is
/// UNKNOWN, not because delivery is free.
Map<String, dynamic> totalsWithoutFreightJson() => <String, dynamic>{
      'subtotal': 24.68,
      'discountAmount': 0.00,
      'goodsVatAmount': 1.23,
      'shippingAmount': 0.00,
      'shippingVatAmount': 0.00,
      'vatAmount': 1.23,
      'total': 25.91,
    };

CheckoutQuote checkoutQuote({
  Map<String, dynamic>? totals,
  String shippingStatus = 'priced',
  num shippingAmount = 20.00,
  List<Map<String, dynamic>>? lines,
  DateTime? expiresAt,
}) =>
    CheckoutQuote.fromJson(<String, dynamic>{
      'quoteId': 'quo_1',
      'currency': 'AED',
      'channel': 'B2C',
      'vatRatePercent': 5,
      'lines': lines ??
          <dynamic>[
            <String, dynamic>{
              'productId': 'prd_1',
              'variantId': null,
              'sellerId': 'sel_1',
              'sku': 'BGV-2',
              'nameEn': 'Brass gate valve 2"',
              'nameAr': 'محبس نحاسي ٢ بوصة',
              'quantity': 2,
              'unitPrice': 12.34,
              'vatRatePercent': 5,
              'vatAmount': 1.23,
              'lineTotal': 24.68,
            },
          ],
      'shipping': <String, dynamic>{
        'status': shippingStatus,
        'zoneName': shippingStatus == 'priced' ? 'Northern Emirates' : null,
        'amount': shippingAmount,
        'vatRatePercent': 5,
        'estimatedDaysMin': shippingStatus == 'priced' ? 2 : null,
        'estimatedDaysMax': shippingStatus == 'priced' ? 4 : null,
      },
      'promotions': <dynamic>[],
      'totals': totals ?? orderTotalsJson(),
      'expiresAt':
          (expiresAt ?? DateTime.utc(2099, 1, 1)).toIso8601String(),
    });

Map<String, dynamic> orderCardJson({
  String id = 'ord_1',
  String orderNumber = 'AVN-2026-000123',
  String status = 'SHIPPED',
}) =>
    <String, dynamic>{
      'id': id,
      'orderNumber': orderNumber,
      'status': status,
      'paymentStatus': 'PAID',
      'type': 'B2C',
      'currency': 'AED',
      'total': 44.32,
      'itemCount': 2,
      'thumbnail': null,
      'placedAt': '2026-09-03T07:30:00.000Z',
    };

OrderCard orderCard({
  String id = 'ord_1',
  String orderNumber = 'AVN-2026-000123',
  String status = 'SHIPPED',
}) =>
    OrderCard.fromJson(
      orderCardJson(id: id, orderNumber: orderNumber, status: status),
    );

Map<String, dynamic> orderItemJson({
  String id = 'oi_1',
  String sellerId = 'sel_1',
  String sku = 'BGV-2',
  String nameEn = 'Brass gate valve 2"',
  String status = 'SHIPPED',
}) =>
    <String, dynamic>{
      'id': id,
      'productId': 'prd_1',
      'variantId': null,
      'sellerId': sellerId,
      'slug': 'brass-gate-valve-2-inch',
      'sku': sku,
      'nameEn': nameEn,
      'nameAr': 'محبس نحاسي ٢ بوصة',
      'image': null,
      'quantity': 2,
      'unitPrice': 12.34,
      'vatRatePercent': 5,
      'vatAmount': 1.11,
      'total': 24.68,
      'status': status,
    };

Map<String, dynamic> shipmentJson({
  String id = 'shp_1',
  String status = 'IN_TRANSIT',
  String? estimatedDelivery = '2026-09-07T12:00:00.000Z',
  String? trackingUrl = 'https://www.aramex.com/track/1234567890',
}) =>
    <String, dynamic>{
      'id': id,
      'status': status,
      'carrier': 'Aramex',
      'trackingNumber': '1234567890',
      'trackingUrl': trackingUrl,
      'estimatedDelivery': estimatedDelivery,
    };

/// An order recorded WITH the goods/shipping VAT split.
Map<String, dynamic> persistedTotalsJson() => <String, dynamic>{
      'subtotal': 24.68,
      'discountAmount': 2.47,
      'shippingAmount': 20.00,
      'vatAmount': 2.11,
      'goodsVatAmount': 1.11,
      'shippingVatAmount': 1.00,
      'total': 44.32,
    };

/// An order placed BEFORE the `Order` table had columns for the split. The
/// aggregate VAT is known; how it divided is not.
Map<String, dynamic> persistedTotalsWithoutBreakdownJson() =>
    <String, dynamic>{
      'subtotal': 24.68,
      'discountAmount': 2.47,
      'shippingAmount': 20.00,
      'vatAmount': 2.11,
      'goodsVatAmount': null,
      'shippingVatAmount': null,
      'total': 44.32,
    };

OrderDetail orderDetail({
  Map<String, dynamic>? totals,
  List<Map<String, dynamic>>? items,
  List<Map<String, dynamic>>? shipments,
  List<Map<String, dynamic>>? statusHistory,
  String status = 'SHIPPED',
  String? paymentMethod = 'BANK_TRANSFER',
}) =>
    OrderDetail.fromJson(<String, dynamic>{
      'id': 'ord_1',
      'orderNumber': 'AVN-2026-000123',
      'status': status,
      'paymentStatus': 'PAID',
      'paymentMethod': paymentMethod,
      'type': 'B2C',
      'currency': 'AED',
      'totals': totals ?? persistedTotalsJson(),
      'items': items ?? <dynamic>[orderItemJson()],
      'shippingAddress': <String, dynamic>{
        'label': 'Warehouse',
        'line1': 'Plot 42, Industrial Area 3',
        'line2': 'Gate B',
        'city': 'Sharjah',
        'country': 'AE',
        'postalCode': '00000',
      },
      'shipments': shipments ?? <dynamic>[shipmentJson()],
      'statusHistory': statusHistory ??
          <dynamic>[
            <String, dynamic>{
              'status': 'PENDING_PAYMENT',
              'message': 'Awaiting bank transfer.',
              'occurredAt': '2026-09-03T07:30:00.000Z',
            },
            <String, dynamic>{
              'status': 'SHIPPED',
              'message': 'Handed to the carrier.',
              'occurredAt': '2026-09-04T08:00:00.000Z',
            },
          ],
      'notes': null,
      'vatInvoiceUrl':
          'https://cdn.avenick.com/invoices/AVN-2026-000123.pdf',
      'placedAt': '2026-09-03T07:30:00.000Z',
      'updatedAt': '2026-09-04T08:00:00.000Z',
    });

/// A two-seller order: the marketplace case the confirmation screen exists for.
OrderDetail twoSellerOrder() => orderDetail(
      items: <Map<String, dynamic>>[
        orderItemJson(),
        orderItemJson(
          id: 'oi_2',
          sellerId: 'sel_2',
          sku: 'PMP-9',
          nameEn: 'Centrifugal pump',
          status: 'PROCESSING',
        ),
      ],
      shipments: <Map<String, dynamic>>[
        shipmentJson(),
        shipmentJson(
          id: 'shp_2',
          status: 'PENDING',
          estimatedDelivery: '2026-09-19T12:00:00.000Z',
          trackingUrl: null,
        ),
      ],
    );

// ---------------------------------------------------------------------------
// FAKE GATEWAYS
// ---------------------------------------------------------------------------

/// Answers with whatever it was built with. `pending` never completes, which
/// is how the loading branch is held open for an assertion.
class FakeOrdersGateway implements OrdersGateway {
  FakeOrdersGateway({
    this.cards = const <OrderCard>[],
    this.detail,
    this.failure,
    this.pending = false,
    this.hasMore = false,
  });

  final List<OrderCard> cards;
  final OrderDetail? detail;
  final Object? failure;
  final bool pending;
  final bool hasMore;

  int orderCalls = 0;
  int detailCalls = 0;

  @override
  Future<net.Page<OrderCard>> orders({
    String? cursor,
    int? limit,
    OrderStatus? status,
  }) {
    orderCalls++;
    if (pending) return Completer<net.Page<OrderCard>>().future;
    if (failure != null) return Future<net.Page<OrderCard>>.error(failure!);
    return Future<net.Page<OrderCard>>.value(
      net.Page<OrderCard>(
        items: cards,
        meta: PageMeta(cursor: hasMore ? 'cur_2' : null, hasMore: hasMore),
      ),
    );
  }

  @override
  Future<OrderDetail> order(String id) {
    detailCalls++;
    if (pending) return Completer<OrderDetail>().future;
    if (failure != null) return Future<OrderDetail>.error(failure!);
    return Future<OrderDetail>.value(detail!);
  }
}

class FakeCheckoutGateway implements CheckoutGateway {
  FakeCheckoutGateway({this.result, this.failure, this.pending = false});

  final CheckoutQuote? result;
  final Object? failure;
  final bool pending;

  final List<CheckoutQuoteRequest> requests = <CheckoutQuoteRequest>[];

  @override
  Future<CheckoutQuote> quote(CheckoutQuoteRequest request) {
    requests.add(request);
    if (pending) return Completer<CheckoutQuote>().future;
    if (failure != null) return Future<CheckoutQuote>.error(failure!);
    return Future<CheckoutQuote>.value(result!);
  }
}

/// A cart store that can be empty, full, slow or broken — the four states the
/// cart screen has to render.
class FakeCartStore implements CartStore {
  FakeCartStore({this.cart, this.failure, this.pending = false});

  final LocalCart? cart;
  final Object? failure;
  final bool pending;

  LocalCart? saved;

  @override
  Future<LocalCart> load() {
    if (pending) return Completer<LocalCart>().future;
    if (failure != null) return Future<LocalCart>.error(failure!);
    return Future<LocalCart>.value(cart ?? const LocalCart.empty());
  }

  @override
  Future<void> save(LocalCart cart) async {
    saved = cart;
  }
}

/// An order placement that succeeds, for the one test that needs the review
/// step to have a button at all.
class FakeOrderPlacement implements OrderPlacement {
  FakeOrderPlacement({this.orderId = 'ord_1', this.failure});

  final String orderId;
  final Object? failure;

  int calls = 0;

  @override
  Future<String> place({
    required CheckoutQuote quote,
    required PaymentMethod method,
    required ShippingAddress address,
  }) async {
    calls++;
    if (failure != null) throw failure!;
    return orderId;
  }
}

/// Answers the B2C question for a named set of products.
///
/// The real answer is not on the wire — see [B2CEligibility] — so the tests
/// state it explicitly, which is exactly what the app will have to do until
/// the contract carries the flag.
class FakeB2CEligibility implements B2CEligibility {
  const FakeB2CEligibility({
    this.quoteOnlyProductIds = const <String>{},
    this.fallback = B2CSellability.sellable,
  });

  final Set<String> quoteOnlyProductIds;
  final B2CSellability fallback;

  @override
  B2CSellability of(CartLine line) =>
      quoteOnlyProductIds.contains(line.productId)
          ? B2CSellability.quoteOnly
          : fallback;
}

// ---------------------------------------------------------------------------
// PUMP
// ---------------------------------------------------------------------------

/// Puts one commerce screen on screen with the real theme, the real
/// localizations and a real `ProviderScope`.
///
/// [textScale] is a first-class parameter because "does the total survive 200%
/// dynamic type" is a question this feature has to answer, and it cannot be
/// answered by looking at a widget tree built at 1.0.
Future<void> pumpCommerce(
  WidgetTester tester,
  Widget screen, {
  List<Override> overrides = const <Override>[],
  Locale locale = const Locale('en'),
  double textScale = 1.0,
  Size size = const Size(420, 900),
  Brightness brightness = Brightness.light,
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        locale: locale,
        supportedLocales: const <Locale>[Locale('en'), Locale('ar')],
        localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        theme: brightness == Brightness.dark
            ? MeridianTheme.dark(viewportWidth: size.width)
            : MeridianTheme.light(viewportWidth: size.width),
        builder: (BuildContext context, Widget? child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(textScale),
          ),
          child: child ?? const SizedBox.shrink(),
        ),
        home: screen,
      ),
    ),
  );
  // Not `pumpAndSettle`: the skeleton shimmer repeats forever by design and
  // would hang it.
  await tester.pump();
}

/// Everything a commerce screen needs, wired to fakes.
List<Override> commerceOverrides({
  OrdersGateway? orders,
  CheckoutGateway? checkout,
  CartStore? cartStore,
  OrderPlacement? placement,
  Map<String, String> sellerNames = const <String, String>{},
  List<ShippingAddress> addresses = const <ShippingAddress>[],
  bool mockPayments = false,
  B2CEligibility? eligibility,
}) =>
    <Override>[
      if (orders != null) ordersGatewayProvider.overrideWithValue(orders),
      if (checkout != null) checkoutGatewayProvider.overrideWithValue(checkout),
      if (cartStore != null) cartStoreProvider.overrideWithValue(cartStore),
      orderPlacementProvider.overrideWithValue(placement),
      sellerNamesProvider.overrideWithValue(sellerNames),
      savedAddressesProvider.overrideWithValue(addresses),
      mockPaymentsEnabledProvider.overrideWithValue(mockPayments),
      if (eligibility != null)
        b2cEligibilityProvider.overrideWithValue(eligibility),
    ];

/// Finds a machine-readable token the way it is actually rendered.
///
/// The isolate marks are written as `LtrToken.wrap` rather than as literal
/// U+2066/U+2069 characters: those are invisible in an editor, so a literal
/// here is a character no reviewer can see in a diff — the same property that
/// makes Trojan Source attacks work, and the analyzer flags it.
Finder findToken(String value, LtrToken kind) => find.text(kind.wrap(value));

/// Finds a money figure the way it is actually rendered.
///
/// [MoneyText] wraps every figure in a left-to-right isolate — U+2066 … U+2069
/// — so `find.text('424.68 AED')` matches nothing. Tests go through here so a
/// missing isolate fails loudly instead of a test quietly asserting the
/// unisolated form.
Finder findMoney(String formatted) => find.text(Bidi.ltr(formatted));

/// Brings [finder] into view, whether it is merely off-screen or not built
/// yet — a lazily built `ListView` does neither for free, and at 200% dynamic
/// type almost everything is below the fold.
Future<void> scrollTo(WidgetTester tester, Finder finder) async {
  final Finder viewport = find.byType(Scrollable).first;
  for (int i = 0; i < 20 && !tester.any(finder); i++) {
    await tester.drag(viewport, const Offset(0, -300));
    await tester.pump();
  }
  if (tester.any(finder)) {
    await tester.ensureVisible(finder.first);
    await tester.pump(const Duration(milliseconds: 400));
  }
}
