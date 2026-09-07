import 'package:avenick/api/avenick_api.dart';
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
}
