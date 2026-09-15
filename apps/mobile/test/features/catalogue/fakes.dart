import 'dart:async';

import 'package:avenick/api/models/catalogue.dart';
import 'package:avenick/api/models/common.dart';
import 'package:avenick/api/models/decimal.dart';
import 'package:avenick/api/models/enums.dart';
import 'package:avenick/core/error/failures.dart';
import 'package:avenick/core/network/page.dart';
import 'package:avenick/features/catalogue/catalogue.dart';
import 'package:avenick/theme/meridian_theme.dart';
import 'package:avenick/theme/tokens.g.dart';
import 'package:flutter/material.dart' hide Page;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:riverpod/misc.dart' show Override;

/// Test doubles for the catalogue.
///
/// The whole reason `CatalogueRepository` exists as an interface is here: the
/// generated `CatalogueApi` holds a private `_client`, so it cannot be
/// `implements`-ed from another library and there is no way to fake it. This
/// class is what lets a screen test drive all four `AsyncStateView` branches —
/// including the two that never happen on a good day — without a socket.

/// How a fake call should behave.
enum FakeOutcome {
  /// Return the configured data.
  data,

  /// Return a well-formed but empty result.
  empty,

  /// Throw [FakeCatalogueRepository.failure].
  error,

  /// Never complete, so the widget stays on the loading branch. A `Future`
  /// that never resolves is the only honest way to hold a screen there: a
  /// short delay makes the assertion a race against the pump interval.
  pending,
}

class FakeCatalogueRepository implements CatalogueRepository {
  FakeCatalogueRepository({
    this.outcome = FakeOutcome.data,
    List<ProductCard>? cards,
    ProductDetail? detail,
    List<Category>? taxonomy,
    List<Brand>? brandList,
    ApiFailure? failure,
    this.pageSize = 24,
    this.totalPages = 1,
  })  : cards = cards ?? <ProductCard>[fakeProductCard()],
        detail = detail ?? fakeProductDetail(),
        taxonomy = taxonomy ?? fakeCategories(),
        brandList = brandList ?? fakeBrands(),
        failure = failure ??
            const ApiFailure.network(
              kind: NetworkFailureKind.offline,
              message: 'You appear to be offline.',
            );

  FakeOutcome outcome;

  // Named for the DATA they hold rather than for the methods that serve them:
  // a field called `products` beside a method called `products` is a compile
  // error, and renaming the method would break the interface.
  List<ProductCard> cards;
  ProductDetail detail;
  List<Category> taxonomy;
  List<Brand> brandList;
  ApiFailure failure;

  final int pageSize;

  /// How many pages the pager should serve before `hasMore` goes false. Two or
  /// more is what exercises the infinite-scroll path.
  final int totalPages;

  /// Every `products` call this fake has seen, so a test can assert the
  /// debounce fired once rather than five times.
  final List<Map<String, Object?>> productCalls = <Map<String, Object?>>[];

  Future<T> _answer<T>(T value, T emptyValue) {
    switch (outcome) {
      case FakeOutcome.data:
        return Future<T>.value(value);
      case FakeOutcome.empty:
        return Future<T>.value(emptyValue);
      case FakeOutcome.error:
        return Future<T>.error(failure, StackTrace.current);
      case FakeOutcome.pending:
        return Completer<T>().future;
    }
  }

  @override
  Future<Page<ProductCard>> products({
    String? cursor,
    int? limit,
    String? search,
    String? categorySlug,
    String? brandSlug,
    Channel channel = Channel.b2c,
    Currency? currency,
    bool? inStock,
    double? minRating,
    int? moqMin,
    int? moqMax,
    ProductSort sort = ProductSort.newest,
  }) {
    productCalls.add(<String, Object?>{
      'cursor': cursor,
      'limit': limit,
      'search': search,
      'categorySlug': categorySlug,
      'brandSlug': brandSlug,
      'channel': channel,
      'inStock': inStock,
      'minRating': minRating,
      'moqMax': moqMax,
      'sort': sort,
    });

    final int index = cursor == null ? 0 : int.parse(cursor);
    final bool more = index + 1 < totalPages;
    return _answer<Page<ProductCard>>(
      Page<ProductCard>(
        items: cards,
        meta: PageMeta(cursor: more ? '${index + 1}' : null, hasMore: more),
      ),
      const Page<ProductCard>.last(<ProductCard>[]),
    );
  }

  @override
  Future<ProductDetail> product(
    String slug, {
    Channel channel = Channel.b2c,
    Currency? currency,
  }) {
    // A product page has no "loaded successfully with nothing in it" that a
    // list has, so `empty` here means the hollow record the screen's isEmpty
    // predicate is written for.
    return _answer<ProductDetail>(detail, hollowProductDetail());
  }

  @override
  Future<List<Category>> categories() =>
      _answer<List<Category>>(taxonomy, const <Category>[]);

  @override
  Future<Page<Brand>> brands({String? cursor, int? limit}) =>
      _answer<Page<Brand>>(
        Page<Brand>.last(brandList),
        const Page<Brand>.last(<Brand>[]),
      );
}

// ---------------------------------------------------------------------------
// Model builders — every required field present, matching the contract shapes.
// ---------------------------------------------------------------------------

ImageRef fakeImage({String url = 'https://cdn.avenick.test/p/valve.jpg'}) =>
    ImageRef(url: url, width: 1200, height: 1500, alt: 'Brass gate valve');

CardPrice fakeCardPrice({
  String amount = '12.34',
  Currency currency = Currency.aed,
  String vat = '5',
  bool isFrom = false,
}) =>
    CardPrice(
      amount: Decimal.parse(amount),
      currency: currency,
      vatRatePercent: Decimal.parse(vat),
      isFrom: isFrom,
    );

PriceBand fakeBand({
  int minQty = 1,
  int? maxQty,
  String price = '12.34',
  Channel channel = Channel.b2c,
  Currency currency = Currency.aed,
  String vat = '5',
}) =>
    PriceBand(
      channel: channel,
      currency: currency,
      minQty: minQty,
      maxQty: maxQty,
      price: Decimal.parse(price),
      vatRatePercent: Decimal.parse(vat),
    );

ProductCard fakeProductCard({
  String id = 'prd_1',
  String slug = 'brass-gate-valve-2-inch',
  String nameEn = 'Brass gate valve 2 inch',
  String nameAr = 'محبس نحاسي ٢ بوصة',
  CardPrice? price,
  bool priced = true,
  bool sellableInChannel = true,
  int moq = 1,
  Availability availability = Availability.inStock,
  RatingSummary? rating = const RatingSummary(average: 4.4, count: 128),
  String? brandName = 'Aldrich',
  ImageRef? image,
}) =>
    ProductCard(
      id: id,
      slug: slug,
      nameEn: nameEn,
      nameAr: nameAr,
      image: image ?? fakeImage(),
      price: priced ? price ?? fakeCardPrice() : null,
      moq: moq,
      availability: availability,
      priceTiered: false,
      rating: rating,
      brandName: brandName,
      sellableInChannel: sellableInChannel,
    );

/// A card the server flags unsellable AND has not priced. Both signals agree.
ProductCard fakeQuoteOnlyCard() => fakeProductCard(
      id: 'prd_quote',
      slug: 'industrial-butterfly-valve-dn200',
      nameEn: 'Industrial butterfly valve DN200',
      nameAr: 'صمام فراشة صناعي',
      priced: false,
      sellableInChannel: false,
      moq: 25,
      availability: Availability.unconfirmed,
      rating: null,
    );

/// THE PRODUCTION ROW, and the one the old inference got wrong.
///
/// Priced in B2C — a real, resolved `CardPrice` — and `sellableInChannel:
/// false`, which is exactly what `pilot-catalog.ts` writes for all 1,172 rows
/// in the live catalogue. A client that reads sellability off the price shows
/// **Add to cart** here, and `secureCreateOrder` then refuses the order.
ProductCard fakePricedButUnsellableCard() => fakeProductCard(
      id: 'prd_pilot',
      slug: 'pilot-cast-iron-y-strainer',
      nameEn: 'Cast iron Y-strainer DN100',
      nameAr: 'مصفاة حديد زهر',
      sellableInChannel: false,
      moq: 25,
      rating: null,
    );

SellerSummary fakeSeller() => const SellerSummary(
      id: 'sel_1',
      businessNameEn: 'Gulf Industrial Supply',
      businessNameAr: 'الخليج للتوريدات الصناعية',
      tier: SellerTier.gold,
      city: 'Dubai',
      country: 'AE',
      rating: RatingSummary(average: 4.7, count: 312),
    );

ProductVariant fakeVariant({
  String id = 'var_1',
  String nameEn = '2 inch · 220V',
  List<PriceBand>? prices,
  Availability availability = Availability.inStock,
  int availableQty = 42,
}) =>
    ProductVariant(
      id: id,
      sku: 'BGV-2-220',
      nameEn: nameEn,
      nameAr: null,
      attributes: const <String, Object?>{'size': '2 inch', 'voltage': 220},
      prices: prices ?? <PriceBand>[fakeBand()],
      availability: availability,
      availableQty: availableQty,
    );

ProductDetail fakeProductDetail({
  List<PriceBand>? prices,
  List<ProductVariant>? variants,
  Channel channel = Channel.b2c,
  RatingSummary? rating = const RatingSummary(average: 4.4, count: 128),
  int moq = 1,
  bool sellableInChannel = true,
}) =>
    ProductDetail(
      id: 'prd_1',
      slug: 'brass-gate-valve-2-inch',
      sku: 'BGV-2',
      nameEn: 'Brass gate valve 2 inch',
      nameAr: 'محبس نحاسي ٢ بوصة',
      descriptionEn: 'A forged brass gate valve rated to 16 bar.',
      descriptionAr: null,
      images: <ImageRef>[fakeImage()],
      prices: prices ??
          <PriceBand>[
            fakeBand(maxQty: 9),
            fakeBand(minQty: 10, maxQty: 49, price: '11.20'),
            fakeBand(minQty: 50, price: '9.90'),
          ],
      variants: variants ?? const <ProductVariant>[],
      moq: moq,
      availability: Availability.inStock,
      availableQty: 240,
      origin: 'AE',
      weightKg: 2.4,
      tags: const <String>['valve', 'brass'],
      channel: channel,
      brand: const ProductBrandRef(
        id: 'brd_1',
        nameEn: 'Aldrich',
        nameAr: null,
      ),
      category: const ProductCategoryRef(
        id: 'cat_2',
        slug: 'valves',
        nameEn: 'Valves',
        nameAr: 'صمامات',
      ),
      seller: fakeSeller(),
      rating: rating,
      sellableInChannel: sellableInChannel,
    );

/// A product page the server flags unsellable AND has not priced in its own
/// channel. Both signals agree.
ProductDetail fakeQuoteOnlyDetail() => fakeProductDetail(
      prices: const <PriceBand>[],
      variants: const <ProductVariant>[],
      rating: null,
      moq: 25,
      sellableInChannel: false,
    );

/// THE PRODUCTION ROW as a product page: a full B2C price ladder, and
/// `sellableInChannel: false`. See [fakePricedButUnsellableCard].
ProductDetail fakePricedButUnsellableDetail() => fakeProductDetail(
      rating: null,
      moq: 25,
      sellableInChannel: false,
    );

/// The hollow record the PDP's `isEmpty` predicate is written for: no images,
/// no prices, no variants, no description.
ProductDetail hollowProductDetail() => ProductDetail(
      id: 'prd_hollow',
      slug: 'unfinished-listing',
      sku: 'UNF-1',
      nameEn: 'Unfinished listing',
      nameAr: 'قائمة غير مكتملة',
      descriptionEn: null,
      descriptionAr: null,
      images: const <ImageRef>[],
      prices: const <PriceBand>[],
      variants: const <ProductVariant>[],
      moq: 1,
      availability: Availability.unconfirmed,
      availableQty: 0,
      origin: null,
      weightKg: null,
      tags: const <String>[],
      channel: Channel.b2c,
      brand: null,
      category: const ProductCategoryRef(
        id: 'cat_2',
        slug: 'valves',
        nameEn: 'Valves',
        nameAr: 'صمامات',
      ),
      seller: fakeSeller(),
      rating: null,
      // An unfinished listing is not one the order service will accept.
      sellableInChannel: false,
    );

List<Category> fakeCategories() => <Category>[
      Category(
        id: 'cat_1',
        slug: 'plumbing',
        nameEn: 'Plumbing',
        nameAr: 'السباكة',
        parentId: null,
        depth: 0,
        image: fakeImage(url: 'https://cdn.avenick.test/c/plumbing.jpg'),
        productCount: 412,
      ),
      const Category(
        id: 'cat_2',
        slug: 'valves',
        nameEn: 'Valves',
        nameAr: 'صمامات',
        parentId: 'cat_1',
        depth: 1,
        image: null,
        productCount: 87,
      ),
      // A zero-count node. It must still be RENDERED — dimmed, with its 0 —
      // never filtered out.
      const Category(
        id: 'cat_3',
        slug: 'gaskets',
        nameEn: 'Gaskets',
        nameAr: 'حشيات',
        parentId: 'cat_1',
        depth: 1,
        image: null,
        productCount: 0,
      ),
      const Category(
        id: 'cat_4',
        slug: 'electrical',
        nameEn: 'Electrical',
        nameAr: 'كهرباء',
        parentId: null,
        depth: 0,
        image: null,
        productCount: 205,
      ),
      // A zero-count ROOT, so the home strip exercises the dimmed-not-hidden
      // rule and not just the filter screen.
      const Category(
        id: 'cat_5',
        slug: 'clearance',
        nameEn: 'Clearance',
        nameAr: 'تصفية',
        parentId: null,
        depth: 0,
        image: null,
        productCount: 0,
      ),
    ];

List<Brand> fakeBrands() => const <Brand>[
      Brand(
        id: 'brd_1',
        slug: 'aldrich',
        nameEn: 'Aldrich',
        nameAr: null,
        logo: null,
        productCount: 64,
      ),
      Brand(
        id: 'brd_2',
        slug: 'kaveri',
        nameEn: 'Kaveri',
        nameAr: null,
        logo: null,
        productCount: 0,
      ),
    ];

ApiFailure notFoundFailure() => const ApiFailure.server(
      code: ApiErrorCode.notFound,
      message: 'Product not found.',
      requestId: 'req_01HZY8',
      statusCode: 404,
    );

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

/// A deterministic stand-in for `cached_network_image`.
///
/// Every golden and every widget test overrides [remoteImageBuilderProvider]
/// with this. Without it a card's picture is a race between the rasteriser and
/// a DNS lookup that cannot succeed in a test binding, and the golden captures
/// whichever won.
Widget fakeRemoteImage(
  BuildContext context,
  ImageRef image,
  BoxFit fit,
  Widget placeholder,
  Widget error,
) {
  final MeridianTokens t = context.tokens;
  return ColoredBox(color: t.neutralRule);
}

/// The overrides every catalogue test needs.
List<Override> catalogueOverrides(CatalogueRepository repository) => <Override>[
      catalogueRepositoryProvider.overrideWith(
        (Ref ref) => repository,
      ),
      remoteImageBuilderProvider.overrideWith(
        (Ref ref) => fakeRemoteImage,
      ),
    ];

/// Pump a catalogue screen with the theme, the localisations and the fake
/// repository in place.
Future<void> pumpCatalogue(
  WidgetTester tester,
  Widget screen, {
  required CatalogueRepository repository,
  List<Override> extraOverrides = const <Override>[],
  Locale locale = const Locale('en'),
  Size surfaceSize = const Size(420, 900),
}) async {
  await tester.binding.setSurfaceSize(surfaceSize);
  addTearDown(() => tester.binding.setSurfaceSize(null));

  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        ...catalogueOverrides(repository),
        ...extraOverrides,
      ],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        locale: locale,
        supportedLocales: const <Locale>[Locale('en'), Locale('ar')],
        localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        theme: MeridianTheme.light(viewportWidth: surfaceSize.width),
        home: screen,
      ),
    ),
  );
  // Not pumpAndSettle: the skeleton shimmer repeats forever by design, so
  // settling would time out on exactly the branch these tests are checking.
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}
