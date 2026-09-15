import 'package:avenick/api/avenick_api.dart';
import 'package:avenick/api/orders_api.dart';
import 'package:avenick/api/models/models.dart';
import 'package:avenick/core/network/api_config.dart';
import 'package:avenick/core/network/trace_context.dart';
import 'package:avenick/core/error/failures.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_transport.dart';
import 'fixtures.dart' as f;

/// The endpoint clients, the envelope, the query encoding, the pager and the
/// telemetry headers — exercised through the real interceptor chain.
void main() {
  const config =
      ApiConfig(flavour: ApiFlavour.dev, baseUrl: 'https://example.test');

  (AvenickApi, FakeAdapter) build(
    FakeResponse Function(dynamic options) handler, {
    void Function(String)? log,
  }) {
    final adapter = FakeAdapter(handler);
    final api = AvenickApi.build(
      config: config,
      store: InMemoryTokenStore(),
      adapter: adapter,
      log: log,
    );
    return (api, adapter);
  }

  group('paths match openapi.json verbatim', () {
    test(
        'the /api server prefix is applied and /v1 paths are spelled as specified',
        () async {
      final (api, adapter) =
          build((_) => FakeResponse.page(<Object?>[f.productCard()]));
      addTearDown(api.dispose);

      await api.catalogue.products();

      expect(adapter.requests.single.path, '/v1/products');
      expect(
        adapter.requests.single.uri.toString(),
        startsWith('https://example.test/api/v1/products'),
      );
    });

    test('a slug is percent-encoded into the path', () async {
      final (api, adapter) = build((_) => FakeResponse.data(f.productDetail()));
      addTearDown(api.dispose);

      await api.catalogue.product('brass-gate-valve-2-inch');
      expect(
        adapter.requests.single.path,
        '/v1/products/brass-gate-valve-2-inch',
      );
    });
  });

  group('query encoding', () {
    test('nulls are dropped rather than sent as the string "null"', () async {
      final (api, adapter) = build((_) => FakeResponse.page(<Object?>[]));
      addTearDown(api.dispose);

      await api.catalogue.products(search: 'valve');

      final query = adapter.requests.single.uri.queryParameters;
      expect(query['search'], 'valve');
      // `?currency=null` is a 400 from a filter the caller thought it had left
      // unset.
      expect(query.containsKey('currency'), isFalse);
      expect(query.containsKey('cursor'), isFalse);
      expect(query.containsKey('brandSlug'), isFalse);
    });

    test('a false boolean is sent as "false", not dropped and not "0"',
        () async {
      final (api, adapter) = build((_) => FakeResponse.page(<Object?>[]));
      addTearDown(api.dispose);

      await api.catalogue.products(inStock: false);

      // `z.coerce.boolean()` makes `Boolean("false")` true, which is why the
      // contract compares against the literal. `?inStock=false` filtering to
      // in-stock items would be a filter that means the opposite of what it
      // says.
      expect(adapter.requests.single.uri.queryParameters['inStock'], 'false');
    });

    test('enums are sent in their wire spelling, not their Dart name',
        () async {
      final (api, adapter) = build((_) => FakeResponse.page(<Object?>[]));
      addTearDown(api.dispose);

      await api.catalogue.products(
        channel: Channel.b2b,
        currency: Currency.kwd,
        sort: ProductSort.nameAsc,
      );

      final query = adapter.requests.single.uri.queryParameters;
      expect(query['channel'], 'B2B');
      expect(query['currency'], 'KWD');
      expect(query['sort'], 'name_asc');
    });

    test('an order status filter is sent in SCREAMING_SNAKE', () async {
      final (api, adapter) = build((_) => FakeResponse.page(<Object?>[]));
      addTearDown(api.dispose);

      await api.orders.orders(status: OrderStatus.outForDelivery);
      expect(
        adapter.requests.single.uri.queryParameters['status'],
        'OUT_FOR_DELIVERY',
      );
    });

    test('a device is unregistered by query parameter, not by path or body',
        () async {
      final (api, adapter) = build((_) => FakeResponse.data(f.deviceDeleted()));
      addTearDown(api.dispose);

      await api.devices.unregister('a1b2c3d4e5f6');
      expect(adapter.requests.single.path, '/v1/devices');
      expect(
        adapter.requests.single.uri.queryParameters['deviceId'],
        'a1b2c3d4e5f6',
      );
    });
  });

  group('the envelope', () {
    test('`data` is unwrapped for a single object', () async {
      final (api, _) = build((_) => FakeResponse.data(f.me()));
      addTearDown(api.dispose);

      final me = await api.account.me();
      expect(me.email, 'buyer@example.ae');
    });

    test('`data` and `meta` are unwrapped for a page', () async {
      final (api, _) = build(
        (_) => FakeResponse.page(
          <Object?>[f.productCard(), f.productCardBare()],
          cursor: 'Y3VyOjQy',
          hasMore: true,
        ),
      );
      addTearDown(api.dispose);

      final page = await api.catalogue.products();
      expect(page.items, hasLength(2));
      expect(page.hasMore, isTrue);
      expect(page.nextCursor, 'Y3VyOjQy');
    });

    test('an unpaginated list endpoint returns a plain list', () async {
      final (api, _) = build((_) => FakeResponse.data(<Object?>[f.category()]));
      addTearDown(api.dispose);

      final categories = await api.catalogue.categories();
      expect(categories.single.slug, 'valves');
    });

    test('a paginated response missing `meta` is a failure, not an empty page',
        () async {
      // Defaulting a missing meta to "no more" would turn a server bug into a
      // list that silently stops.
      final (api, _) = build(
        (_) => const FakeResponse(200, <String, dynamic>{'data': <Object?>[]}),
      );
      addTearDown(api.dispose);

      await expectLater(
        api.catalogue.products(),
        throwsA(isA<UnexpectedFailure>()),
      );
    });
  });

  group('CursorPager', () {
    test('walks pages and stops when the server says there is no more',
        () async {
      var call = 0;
      final (api, adapter) = build((options) {
        call += 1;
        return call == 1
            ? FakeResponse.page(
                <Object?>[f.productCard()],
                cursor: 'c1',
                hasMore: true,
              )
            : FakeResponse.page(
                <Object?>[f.productCardBare()],
                cursor: null,
                hasMore: false,
              );
      });
      addTearDown(api.dispose);

      final pager = api.catalogue.productPager(search: 'valve');
      expect(pager.hasMore, isTrue);

      await pager.loadNext();
      expect(pager.items, hasLength(1));
      expect(
        adapter.requests.first.uri.queryParameters.containsKey('cursor'),
        isFalse,
      );

      await pager.loadNext();
      expect(pager.items, hasLength(2));
      expect(adapter.requests[1].uri.queryParameters['cursor'], 'c1');
      expect(pager.hasMore, isFalse);

      // A client that keeps sending the last cursor after `hasMore` went false
      // loops over the final page forever. This one stops.
      await pager.loadNext();
      expect(adapter.requests, hasLength(2));
    });

    test('overlapping loads collapse into one request', () async {
      final (api, adapter) = build(
        (_) => const FakeResponse(
          200,
          <String, dynamic>{
            'data': <Object?>[],
            'meta': <String, dynamic>{'cursor': null, 'hasMore': false},
          },
          delay: Duration(milliseconds: 20),
        ),
      );
      addTearDown(api.dispose);

      final pager = api.catalogue.productPager();
      // A list view fires one from onScroll and another from a
      // RefreshIndicator without much difficulty; two in-flight requests with
      // the same cursor append the same rows twice.
      await Future.wait<void>(<Future<void>>[
        pager.loadNext(),
        pager.loadNext(),
        pager.loadNext(),
      ]);
      expect(adapter.requests, hasLength(1));
    });

    test('refresh() starts over from the first page', () async {
      final (api, adapter) = build(
        (_) => FakeResponse.page(
          <Object?>[f.productCard()],
          cursor: 'c1',
          hasMore: true,
        ),
      );
      addTearDown(api.dispose);

      final pager = api.catalogue.productPager();
      await pager.loadNext();
      await pager.loadNext();
      expect(pager.items, hasLength(2));

      await pager.refresh();
      expect(pager.items, hasLength(1));
      // A cursor is minted against the query that produced it.
      expect(
        adapter.requests.last.uri.queryParameters.containsKey('cursor'),
        isFalse,
      );
    });
  });

  group('telemetry headers', () {
    test('every request carries a valid traceparent and a request id',
        () async {
      final (api, adapter) = build((_) => FakeResponse.data(f.me()));
      addTearDown(api.dispose);

      await api.account.me();

      final headers = adapter.requests.single.headers;
      final traceparent = headers[TraceContext.header] as String;
      expect(TraceContext.tryParse(traceparent), isNotNull);
      expect(
        traceparent,
        matches(RegExp(r'^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$')),
      );
      expect(headers['x-request-id'], startsWith('m-'));
      expect(headers['user-agent'], 'AvenickCommerce/mobile');
    });

    test('two requests do not share a trace id', () async {
      final (api, adapter) = build((_) => FakeResponse.data(f.me()));
      addTearDown(api.dispose);

      await api.account.me();
      await api.account.me();

      final first = TraceContext.tryParse(
        adapter.requests[0].headers[TraceContext.header]! as String,
      )!;
      final second = TraceContext.tryParse(
        adapter.requests[1].headers[TraceContext.header]! as String,
      )!;
      expect(first.traceId, isNot(second.traceId));
    });

    test('a malformed or all-zero traceparent is rejected', () {
      expect(TraceContext.tryParse('nonsense'), isNull);
      expect(TraceContext.tryParse('00-${'0' * 32}-${'1' * 16}-01'), isNull);
      expect(TraceContext.tryParse('00-${'a' * 32}-${'0' * 16}-01'), isNull);
      final valid = TraceContext.tryParse('00-${'a' * 32}-${'b' * 16}-01')!;
      expect(valid.sampled, isTrue);
      expect(valid.childSpan().traceId, valid.traceId);
      expect(valid.childSpan().spanId, isNot(valid.spanId));
    });
  });

  group('logging never leaks a credential', () {
    test('the Authorization header is redacted', () async {
      final lines = <String>[];
      final adapter = FakeAdapter((_) => FakeResponse.data(f.me()));
      final api = AvenickApi.build(
        config: config,
        store: InMemoryTokenStore(),
        adapter: adapter,
        log: lines.add,
      );
      addTearDown(api.dispose);
      await api.session.adopt(
        TokenPair.fromJson(
          f.tokenPair(accessToken: 'super-secret-access-token'),
        ),
      );

      await api.account.me();

      expect(lines, isNotEmpty);
      final joined = lines.join('\n');
      // A logged bearer token is a credential in logcat, in a crash report,
      // and in a screenshot of somebody's terminal.
      expect(joined, isNot(contains('super-secret-access-token')));
      expect(joined, contains('authorization=<redacted>'));
      // The useful parts still get logged.
      expect(joined, contains('/v1/me'));
      expect(joined, contains('x-request-id='));
    });

    test('query VALUES are stripped, keys are kept', () async {
      final lines = <String>[];
      final api = AvenickApi.build(
        config: config,
        store: InMemoryTokenStore(),
        adapter: FakeAdapter((_) => FakeResponse.page(<Object?>[])),
        log: lines.add,
      );
      addTearDown(api.dispose);

      await api.catalogue.products(search: 'a-buyers-private-search-term');

      final joined = lines.join('\n');
      expect(joined, isNot(contains('a-buyers-private-search-term')));
      expect(joined, contains('search'));
    });
  });

  group('request bodies', () {
    test('a PATCH omits fields it was not asked to change', () async {
      final (api, adapter) = build((_) => FakeResponse.data(f.me()));
      addTearDown(api.dispose);

      await api.account.updateMe(
        const UpdateMeRequest(firstName: Patch<String>.set('Salim')),
      );

      final body = adapter.requests.single.data! as Map<String, Object?>;
      expect(body, <String, Object?>{'firstName': 'Salim'});
      // A "save profile" that round-trips fields the user never touched is how
      // one screen quietly reverts another's edit.
      expect(body.containsKey('lastName'), isFalse);
      expect(body.containsKey('phone'), isFalse);
    });

    test('a PATCH can explicitly CLEAR a nullable field', () async {
      final (api, adapter) = build((_) => FakeResponse.data(f.me()));
      addTearDown(api.dispose);

      await api.account
          .updateMe(const UpdateMeRequest(firstNameAr: Patch<String>.clear()));

      final body = adapter.requests.single.data! as Map<String, Object?>;
      // Present and null — "remove it" — which is a different request from
      // omitting the key.
      expect(body.containsKey('firstNameAr'), isTrue);
      expect(body['firstNameAr'], isNull);
    });

    test('a checkout quote sends no prices at all', () async {
      final (api, adapter) = build((_) => FakeResponse.data(f.checkoutQuote()));
      addTearDown(api.dispose);

      final quote = await api.checkout.quote(
        const CheckoutQuoteRequest(
          items: <QuoteLineInput>[
            QuoteLineInput(productId: 'prd_1', quantity: 2),
          ],
          shippingAddress: ShippingAddressInput(
            label: 'Warehouse',
            line1: 'Plot 42',
            city: 'Sharjah',
            country: Country.ae,
          ),
          currency: Currency.aed,
        ),
      );

      final body = adapter.requests.single.data! as Map<String, Object?>;
      // A shipping figure the client can influence is a discount the client
      // can grant itself.
      expect(body.keys, isNot(contains('unitPrice')));
      expect(body.keys, isNot(contains('shippingAmount')));
      expect(body.keys, isNot(contains('totals')));
      expect(body['currency'], 'AED');
      expect(body['channel'], 'B2C');
      // The optional line2/postalCode are omitted, not sent as null: the
      // schema is `.optional()`, so an explicit null is a 400.
      final address = body['shippingAddress']! as Map<String, Object?>;
      expect(address.containsKey('line2'), isFalse);
      expect(address.containsKey('postalCode'), isFalse);

      expect(quote.money.total.format(), '44.32 AED');
    });

    test('a cart merge sends its strategy and lines', () async {
      final (api, adapter) =
          build((_) => FakeResponse.data(f.cartMergeResult()));
      addTearDown(api.dispose);

      final result = await api.cart.merge(
        const CartMergeRequest(
          strategy: CartMergeStrategy.sum,
          lines: <CartLineInput>[CartLineInput(productId: 'prd_1', qty: 2)],
        ),
      );

      final body = adapter.requests.single.data! as Map<String, Object?>;
      expect(body['strategy'], 'sum');
      expect((body['lines']! as List<Object?>).single, containsPair('qty', 2));
      expect(result.rejected, hasLength(1));
    });

    test('a device registration never prints its push token', () {
      const request = RegisterDeviceRequest(
        deviceId: 'dev-1',
        pushToken: 'apns-token-that-must-not-be-logged',
        platform: DevicePlatform.ios,
        appVersion: '1.2.3',
      );
      expect(
        request.toString(),
        isNot(contains('apns-token-that-must-not-be-logged')),
      );
      expect(request.toString(), contains('<redacted>'));
      // It still goes UP — it is only the logging that is redacted.
      expect(
        request.toJson()['pushToken'],
        'apns-token-that-must-not-be-logged',
      );
    });
  });

  group('configuration', () {
    test('a prod build refuses a plaintext origin', () {
      expect(
        () => ApiConfig.defaultBaseUrlFor(ApiFlavour.prod),
        throwsStateError,
      );
      expect(
        ApiConfig.defaultBaseUrlFor(ApiFlavour.staging),
        startsWith('https://'),
      );
      expect(ApiFlavour.parse('staging'), ApiFlavour.staging);
      expect(() => ApiFlavour.parse('preprod'), throwsArgumentError);
    });

    test('the api base url is the origin plus /api', () {
      expect(config.apiBaseUrl, 'https://example.test/api');
    });
  });

  group('cart and orders', () {
    test('a cart mutation returns the whole cart', () async {
      final (api, adapter) = build((_) => FakeResponse.data(f.cart()));
      addTearDown(api.dispose);

      final cart = await api.cart.setQuantity(lineId: 'cl_1', qty: 5);
      expect(adapter.requests.single.path, '/v1/cart/items/cl_1');
      expect(adapter.requests.single.data, containsPair('qty', 5));
      expect(cart.lines, hasLength(1));
    });

    test('an order without a VAT breakdown still loads', () async {
      final (api, _) = build(
        (_) => FakeResponse.data(
          f.orderDetail(totals: f.persistedOrderTotalsWithoutBreakdown()),
        ),
      );
      addTearDown(api.dispose);

      final order = await api.orders.order('ord_1');
      expect(order.hasVatBreakdown, isFalse);
      expect(order.money.goodsVatAmount, isNull);
      expect(order.money.total.format(), '44.32 AED');
    });
  });

  group('POST /v1/orders', () {
    PlaceOrderRequest request({
      PaymentMethod method = PaymentMethod.bankTransfer,
    }) =>
        PlaceOrderRequest(
          items: const <OrderLineInput>[
            OrderLineInput(productId: 'prd_1', quantity: 2),
          ],
          shippingAddress: const ShippingAddressInput(
            label: 'Warehouse',
            line1: 'Plot 42, Industrial Area 3',
            city: 'Sharjah',
            country: Country.ae,
          ),
          paymentMethod: method,
          currency: Currency.aed,
        );

    test('places the order and carries no money in the body', () async {
      final (api, adapter) = build((_) => FakeResponse.data(f.placedOrder()));
      addTearDown(api.dispose);

      final placed = await api.orders.placeOrder(request());

      expect(adapter.requests.single.path, '/v1/orders');
      expect(adapter.requests.single.method, 'POST');

      final body = adapter.requests.single.data! as Map<String, Object?>;
      // Prices, discounts, VAT and freight are resolved server-side. A client
      // that could name a price is a client that could name a lower one.
      expect(body.keys, isNot(contains('unitPrice')));
      expect(body.keys, isNot(contains('totals')));
      expect(body.keys, isNot(contains('total')));
      expect(body['currency'], 'AED');
      expect(body['paymentMethod'], 'BANK_TRANSFER');
      expect((body['items']! as List<Object?>).single, <String, Object?>{
        'productId': 'prd_1',
        'quantity': 2,
      });

      expect(placed.replayed, isFalse);
      expect(placed.isNew, isTrue);
      expect(placed.order.orderNumber, 'AVN-2026-000123');
    });

    test('an order line and a quote line serialise identically', () {
      // `OrderLineInput` is a typedef, not a copy. If the two schemas ever
      // diverge this is where it shows up, rather than in one of two
      // hand-written classes that somebody forgot.
      const order = OrderLineInput(
        productId: 'prd_1',
        variantId: 'var_1',
        quantity: 7,
      );
      const quote = QuoteLineInput(
        productId: 'prd_1',
        variantId: 'var_1',
        quantity: 7,
      );
      expect(order.toJson(), quote.toJson());
    });

    test('an Idempotency-Key is always sent, and the caller can pin it',
        () async {
      final (api, adapter) = build((_) => FakeResponse.data(f.placedOrder()));
      addTearDown(api.dispose);

      await api.orders.placeOrder(request());
      final minted = adapter.requests.single.headers['Idempotency-Key'];
      expect(minted, isA<String>());
      expect((minted! as String).isNotEmpty, isTrue);

      // The key belongs to the SUBMISSION. A retry that mints a fresh one is
      // how one basket becomes two orders, so a caller that retries passes
      // its own — and it must arrive verbatim.
      await api.orders.placeOrder(request(), idempotencyKey: 'sub-42');
      expect(adapter.requests.last.headers['Idempotency-Key'], 'sub-42');
    });

    test('two minted keys never collide', () {
      final Set<String> keys = <String>{
        for (int i = 0; i < 200; i++) OrdersApi.newIdempotencyKey(),
      };
      expect(keys, hasLength(200));
    });

    test('a replay is a success the app can tell apart from a purchase',
        () async {
      final (api, _) =
          build((_) => FakeResponse.data(f.placedOrder(replayed: true)));
      addTearDown(api.dispose);

      final placed =
          await api.orders.placeOrder(request(), idempotencyKey: 'sub-42');

      // Both are 200s. Only one of them is a purchase that just happened, and
      // a confirmation screen that cannot tell them apart tells a buyer who
      // tapped twice that they bought two.
      expect(placed.replayed, isTrue);
      expect(placed.isNew, isFalse);
      expect(placed.order.id, 'ord_1');
    });

    test('the Idempotency-Key survives a refresh replay', () async {
      // The auth interceptor replays a 401ed request after refreshing. If the
      // key were dropped there, an expired token in the middle of a checkout
      // would write the order twice.
      var placements = 0;
      final adapter = FakeAdapter((options) {
        if (options.path == '/v1/auth/refresh') {
          return FakeResponse.data(f.tokenPair(accessToken: 'access-2'));
        }
        placements += 1;
        return placements == 1
            ? FakeResponse.error(401, 'unauthenticated')
            : FakeResponse.data(f.placedOrder(replayed: true));
      });
      final api = AvenickApi.build(
        config: config,
        store: InMemoryTokenStore(refreshToken: 'refresh-1'),
        adapter: adapter,
      );
      addTearDown(api.dispose);
      await api.session
          .adopt(TokenPair.fromJson(f.tokenPair(accessToken: 'access-1')));

      final placed =
          await api.orders.placeOrder(request(), idempotencyKey: 'sub-42');

      expect(placed.replayed, isTrue);
      final List<RequestOptionsLike> attempts = adapter.requests
          .where((r) => r.path == '/v1/orders')
          .map((r) => (path: r.path, key: r.headers['Idempotency-Key']))
          .toList();
      expect(attempts, hasLength(2));
      // Both attempts, the original and the replay, carry the SAME key.
      expect(attempts.every((a) => a.key == 'sub-42'), isTrue);
    });

    test('a card method is a distinguishable 503, not a generic outage',
        () async {
      // Card and wallet methods are refused with 503 / upstream_unavailable
      // until a payment-session flow exists. The UI must EXPLAIN that, which
      // it can only do if the failure is distinguishable from every other
      // one — and from a dependency that is merely down.
      final (api, _) = build(
        (_) => FakeResponse.error(
          503,
          'upstream_unavailable',
          message: 'Card payments are not available yet.',
          requestId: 'req_503',
        ),
      );
      addTearDown(api.dispose);

      final Object failure = await api.orders
          .placeOrder(request(method: PaymentMethod.creditCard))
          .then<Object>((v) => v)
          .onError<ApiFailure>((e, _) => e);

      expect(failure, isA<ServerFailure>());
      final server = failure as ServerFailure;
      expect(server.code, ApiErrorCode.upstreamUnavailable);
      expect(server.isUpstreamUnavailable, isTrue);
      // NOT one of the other five variants, and not a bare "something went
      // wrong" — the message and the request id are both intact.
      expect(server.isNotFound, isFalse);
      expect(server.isConflict, isFalse);
      expect(server.isInternal, isFalse);
      expect(server.statusCode, 503);
      expect(server.requestId, 'req_503');
      expect(server.displayMessage, 'Card payments are not available yet.');

      // THE TRAP, pinned so nobody wires a spinner to it. The sealed family
      // reports `upstream_unavailable` as retryable in general, and in
      // general it is — a dependency that is down comes back. Here the
      // dependency has not been BUILT, so a retry can only ever end in the
      // same 503. The code is what a caller must branch on; `isRetryable`
      // alone is not enough to decide what to do on this route.
      expect(server.isRetryable, isTrue);
    });

    test('totals that do not add up never reach the confirmation screen',
        () async {
      final (api, _) = build(
        (_) => FakeResponse.data(<String, dynamic>{
          'order': f.orderDetail(
            totals: f.persistedOrderTotals()..['total'] = 99.99,
          ),
          'replayed': false,
        }),
      );
      addTearDown(api.dispose);

      final Object failure = await api.orders
          .placeOrder(request())
          .then<Object>((v) => v)
          .onError<ApiFailure>((e, _) => e);

      // A 200 whose arithmetic the contract forbids. The bytes were fine; the
      // numbers were not, and the buyer is never shown the figure.
      expect(failure, isA<UnexpectedFailure>());
      expect((failure as UnexpectedFailure).cause, isA<ContractViolation>());
    });

    test('the request knows which methods can settle before it is sent', () {
      // The check that stops the buyer meeting the 503 at all.
      expect(request().isSettleableMethod, isTrue);
      expect(
        request(method: PaymentMethod.mock).isSettleableMethod,
        isTrue,
      );
      for (final PaymentMethod card in <PaymentMethod>[
        PaymentMethod.mada,
        PaymentMethod.applePay,
        PaymentMethod.creditCard,
        PaymentMethod.stcPay,
      ]) {
        expect(request(method: card).isSettleableMethod, isFalse);
      }
    });
  });

  group('/v1/rfqs', () {
    test('the list is unpaginated — no meta, and no invented page', () async {
      final (api, adapter) = build(
        (_) => FakeResponse.data(<Object?>[f.rfqCard(), f.rfqCardUnquoted()]),
      );
      addTearDown(api.dispose);

      final List<RfqCard> rfqs = await api.rfqs.rfqs();

      expect(adapter.requests.single.path, '/v1/rfqs');
      expect(rfqs, hasLength(2));
      expect(rfqs.first.awaitsDecision, isTrue);
      expect(rfqs.last.seller, isNull);
    });

    test('one request comes back whole, with no quotes array', () async {
      final (api, adapter) = build((_) => FakeResponse.data(f.rfqDetail()));
      addTearDown(api.dispose);

      final RfqDetail rfq = await api.rfqs.rfq('rfq_1');

      expect(adapter.requests.single.path, '/v1/rfqs/rfq_1');
      expect(rfq.items, hasLength(2));
      expect(rfq.seller!.businessNameEn, 'Gulf Valve Trading');
      // One RFQ, one supplier. There is nothing to compare and this client
      // does not pretend otherwise.
      expect(rfq.toJson().containsKey('quotes'), isFalse);
    });

    test('creating an RFQ sends catalogue and free-text lines', () async {
      final (api, adapter) = build((_) => FakeResponse.data(f.rfqDetail()));
      addTearDown(api.dispose);

      await api.rfqs.create(
        CreateRfqRequest(
          items: const <RfqLineInput>[
            RfqLineInput.product(productId: 'prd_1', quantity: 250),
            RfqLineInput.freeText(
              nameEn: 'DN200 butterfly valve, lugged',
              quantity: 40,
            ),
          ],
          currency: Currency.aed,
          requiredBy: DateTime.utc(2026, 10),
        ),
      );

      expect(adapter.requests.single.path, '/v1/rfqs');
      expect(adapter.requests.single.method, 'POST');
      final body = adapter.requests.single.data! as Map<String, Object?>;
      expect(body['currency'], 'AED');
      expect(body['requiredBy'], '2026-10-01T00:00:00.000Z');

      final lines = body['items']! as List<Object?>;
      // A catalogue line omits `nameEn` — the server takes it from the
      // catalogue — and a free-text line omits `productId`. Neither sends an
      // explicit null: every one of these is `.optional()`.
      expect(lines.first, <String, Object?>{
        'productId': 'prd_1',
        'quantity': 250,
      });
      expect(lines.last, <String, Object?>{
        'nameEn': 'DN200 butterfly valve, lugged',
        'quantity': 40,
      });
    });

    test('a line that names nothing is caught before the round trip', () {
      const bad = CreateRfqRequest(
        items: <RfqLineInput>[RfqLineInput(quantity: 5)],
        currency: Currency.aed,
      );
      expect(bad.isWellFormed, isFalse);

      const good = CreateRfqRequest(
        items: <RfqLineInput>[
          RfqLineInput.product(productId: 'prd_1', quantity: 5),
        ],
        currency: Currency.aed,
      );
      expect(good.isWellFormed, isTrue);
    });

    test('a decision carries the version it was made against', () async {
      final (api, adapter) = build(
        (_) => FakeResponse.data(f.rfqDetail(status: 'ACCEPTED')),
      );
      addTearDown(api.dispose);

      final RfqDetail before = RfqDetail.fromJson(f.rfqDetail());
      final RfqDetail after = await api.rfqs.decide(
        before.id,
        RfqDecisionRequest.accept(before.quoteVersion),
      );

      expect(adapter.requests.single.path, '/v1/rfqs/rfq_1/decision');
      expect(adapter.requests.single.data, <String, Object?>{
        'decision': 'ACCEPTED',
        // The version the buyer was LOOKING AT. Re-reading it at the moment
        // of the tap would accept whatever the supplier had just changed the
        // price to.
        'expectedQuoteVersion': 2,
      });
      expect(after.status, RfqStatus.accepted);
    });

    test('a stale decision is a conflict the buyer is told about', () async {
      final (api, _) = build(
        (_) => FakeResponse.error(
          409,
          'conflict',
          message: 'The supplier has revised this quote.',
        ),
      );
      addTearDown(api.dispose);

      final Object failure = await api.rfqs
          .decide('rfq_1', const RfqDecisionRequest.accept(1))
          .then<Object>((v) => v)
          .onError<ApiFailure>((e, _) => e);

      expect(failure, isA<ServerFailure>());
      expect((failure as ServerFailure).isConflict, isTrue);
    });
  });
}

/// The two fields of a captured request this suite compares.
typedef RequestOptionsLike = ({String path, Object? key});
