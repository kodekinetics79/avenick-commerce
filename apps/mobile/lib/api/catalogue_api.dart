import '../core/network/api_client.dart';
import '../core/network/page.dart';
import 'models/catalogue.dart';
import 'models/enums.dart';

/// The public catalogue: `/v1/products`, `/v1/products/{slug}`,
/// `/v1/categories`, `/v1/brands`.
///
/// These are the only endpoints on the whole surface that work without a
/// credential, which — until the auth endpoints land — makes them the only
/// endpoints a screen can usefully be built against today.
class CatalogueApi {
  const CatalogueApi(this._client);

  final ApiClient _client;

  static const String productsPath = '/v1/products';
  static const String categoriesPath = '/v1/categories';
  static const String brandsPath = '/v1/brands';

  /// `GET /v1/products` — one page of the catalogue.
  ///
  /// [currency] and [channel] are not cosmetic: they select which price band
  /// is resolved, and a card fetched in the wrong channel shows a B2C price to
  /// a B2B buyer. Passing [currency] as null lets the server pick the market
  /// default for the caller.
  ///
  /// There is no price sort in [ProductSort] and no `total` in the response —
  /// both deliberate, see `catalogue.ts` and `envelope.ts`.
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
  }) =>
      _client.getPage<ProductCard>(
        productsPath,
        itemDecoder: ProductCard.fromJson,
        skipAuth: true,
        query: <String, Object?>{
          'cursor': cursor,
          'limit': limit,
          'search': search,
          'categorySlug': categorySlug,
          'brandSlug': brandSlug,
          'channel': channel.wire,
          'currency': currency?.code,
          'inStock': inStock,
          'minRating': minRating,
          'moqMin': moqMin,
          'moqMax': moqMax,
          'sort': sort.wire,
        },
      );

  /// `GET /v1/products/{slug}` — the product page.
  ///
  /// Keyed by SLUG rather than id, matching the web routes, so a deep link
  /// from a share sheet or a push notification resolves without a lookup.
  Future<ProductDetail> product(
    String slug, {
    Channel channel = Channel.b2c,
    Currency? currency,
  }) =>
      _client.get<ProductDetail>(
        '$productsPath/${Uri.encodeComponent(slug)}',
        decoder: ProductDetail.fromJson,
        skipAuth: true,
        query: <String, Object?>{
          'channel': channel.wire,
          'currency': currency?.code,
        },
      );

  /// `GET /v1/categories` — the whole tree, FLAT and unpaginated.
  ///
  /// There is no cursor here because the taxonomy is small and bounded, and a
  /// half-loaded navigation tree is worse than a slightly larger response.
  /// Assemble the nesting client-side from `parentId` and `depth`.
  Future<List<Category>> categories() => _client.getList<Category>(
        categoriesPath,
        itemDecoder: Category.fromJson,
        skipAuth: true,
      );

  /// `GET /v1/brands` — paginated, unlike categories: the brand list grows
  /// with the seller base and has no natural ceiling.
  Future<Page<Brand>> brands({String? cursor, int? limit}) =>
      _client.getPage<Brand>(
        brandsPath,
        itemDecoder: Brand.fromJson,
        skipAuth: true,
        query: <String, Object?>{'cursor': cursor, 'limit': limit},
      );

  /// A pager over [products] with one filter set held fixed.
  ///
  /// Build a NEW pager when a filter changes: a cursor is minted against the
  /// query that produced it, and replaying it under a different filter asks
  /// the server to continue a list it never sent.
  CursorPager<ProductCard> productPager({
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
    int? limit,
  }) =>
      CursorPager<ProductCard>(
        fetch: ({String? cursor}) => products(
          cursor: cursor,
          limit: limit,
          search: search,
          categorySlug: categorySlug,
          brandSlug: brandSlug,
          channel: channel,
          currency: currency,
          inStock: inStock,
          minRating: minRating,
          moqMin: moqMin,
          moqMax: moqMax,
          sort: sort,
        ),
      );
}
