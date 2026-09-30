import '../../../api/catalogue_api.dart';
import '../../../api/models/catalogue.dart';
import '../../../api/models/enums.dart';
import '../../../core/network/page.dart';

/// The catalogue as this feature consumes it.
///
/// It exists for one reason that is worth the extra file: [CatalogueApi] holds
/// a private `_client` field, and a Dart class with a private member cannot be
/// `implements`-ed from another library. So there is no way to hand a screen a
/// fake [CatalogueApi] — the analyzer refuses with "missing concrete
/// implementation of CatalogueApi._client" — and every widget test of a
/// catalogue screen would need a live socket or a Dio adapter.
///
/// This interface is the seam. [ApiCatalogueRepository] is the only
/// implementation that ships; `test/features/catalogue/fakes.dart` is the only
/// other one that exists. Nothing is re-specified here: every parameter and
/// return type is [CatalogueApi]'s, verbatim, so the day the generated client
/// grows a member this file fails to compile rather than silently diverging.
abstract interface class CatalogueRepository {
  /// `GET /v1/products`. See [CatalogueApi.products] for what each filter
  /// selects — in particular that [channel] and [currency] choose a PRICE
  /// BAND, so a card fetched in the wrong channel quotes the wrong buyer.
  Future<Page<ProductCard>> products({
    String? cursor,
    int? limit,
    String? search,
    String? categorySlug,
    String? brandSlug,
    Channel channel,
    Currency? currency,
    bool? inStock,
    double? minRating,
    int? moqMin,
    int? moqMax,
    ProductSort sort,
  });

  /// `GET /v1/products/{slug}`.
  Future<ProductDetail> product(
    String slug, {
    Channel channel,
    Currency? currency,
  });

  /// `GET /v1/categories` — the whole tree, FLAT and unpaginated.
  Future<List<Category>> categories();

  /// `GET /v1/brands` — paginated, unlike categories.
  Future<Page<Brand>> brands({String? cursor, int? limit});
}

/// The shipping implementation: a thin pass-through to [CatalogueApi].
///
/// Deliberately has no logic of its own. A repository that "helpfully" merged,
/// cached or defaulted anything here would be a second source of truth sitting
/// between the contract and the screen, and the first symptom would be a card
/// showing a price the checkout does not honour.
class ApiCatalogueRepository implements CatalogueRepository {
  const ApiCatalogueRepository(this._api);

  final CatalogueApi _api;

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
  }) =>
      _api.products(
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
      );

  @override
  Future<ProductDetail> product(
    String slug, {
    Channel channel = Channel.b2c,
    Currency? currency,
  }) =>
      _api.product(slug, channel: channel, currency: currency);

  @override
  Future<List<Category>> categories() => _api.categories();

  @override
  Future<Page<Brand>> brands({String? cursor, int? limit}) =>
      _api.brands(cursor: cursor, limit: limit);
}
