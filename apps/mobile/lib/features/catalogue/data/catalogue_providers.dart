import 'dart:async';

import 'package:flutter/foundation.dart' show immutable;
import 'package:flutter_riverpod/flutter_riverpod.dart';
// The two *Family types are `@publicInMisc` in Riverpod 3 and are not
// re-exported from the flutter_riverpod barrel. Naming a family's type
// explicitly is worth one extra import: an inferred `final x = ...` hides which
// of a dozen provider kinds each of these is at the one place it matters.
import 'package:riverpod/misc.dart'
    show AsyncNotifierProviderFamily, FutureProviderFamily;

import '../../../api/avenick_api.dart';
import '../../../api/models/catalogue.dart';
import '../../../api/models/enums.dart';
import '../../../core/network/api_config.dart';
import '../../../core/network/page.dart';
import 'catalogue_repository.dart';
import 'category_tree.dart';
import 'paged_products.dart';
import 'product_query.dart';

/// The assembled API surface.
///
/// Declared here because nothing above this feature declares one yet. It is
/// deliberately trivial so it can be lifted to the app root the moment the
/// networking engineer lands a real one — every consumer below reads
/// [catalogueRepositoryProvider], not this, so moving it is a one-line change
/// in one file rather than an edit to every screen.
final Provider<AvenickApi> avenickApiProvider = Provider<AvenickApi>((Ref ref) {
  final AvenickApi api = AvenickApi.build(config: ApiConfig.fromEnvironment());
  ref.onDispose(api.dispose);
  return api;
});

/// The catalogue, as every screen in this feature sees it.
///
/// **This is the override point for tests.** See
/// `test/features/catalogue/fakes.dart`; overriding it is what lets a screen
/// test drive all four AsyncStateView branches without a socket.
final Provider<CatalogueRepository> catalogueRepositoryProvider =
    Provider<CatalogueRepository>(
  (Ref ref) => ApiCatalogueRepository(ref.watch(avenickApiProvider).catalogue),
);

/// Which channel this session's prices are resolved in.
///
/// Not cosmetic and not a preference: it picks the price BAND, so a card
/// fetched in the wrong channel quotes a B2C price to a B2B buyer. It lives in
/// a provider rather than being passed down because it has to be identical on
/// the rail, the grid and the product page — three screens that would otherwise
/// each default it themselves.
///
/// Defaults to B2C. The account feature overrides it once a company membership
/// is known.
final Provider<Channel> catalogueChannelProvider =
    Provider<Channel>((Ref ref) => Channel.b2c);

/// The currency to resolve prices in, or null to let the server pick the
/// market default for the caller. Null is the right default: a client that
/// guesses AED for a Saudi buyer is wrong in a way the buyer cannot correct.
final Provider<Currency?> catalogueCurrencyProvider =
    Provider<Currency?>((Ref ref) => null);

/// The base query every screen starts from, with the session's channel and
/// currency already in it.
final Provider<ProductQuery> baseQueryProvider = Provider<ProductQuery>(
  (Ref ref) => ProductQuery(
    channel: ref.watch(catalogueChannelProvider),
    currency: ref.watch(catalogueCurrencyProvider),
  ),
);

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

/// The whole taxonomy, assembled into a tree.
///
/// NOT auto-disposed. The taxonomy is small, bounded and read by three screens;
/// re-fetching it every time the user leaves the home tab is a request that
/// buys nothing.
final FutureProvider<CategoryTree> categoryTreeProvider =
    FutureProvider<CategoryTree>((Ref ref) async {
  final List<Category> flat =
      await ref.watch(catalogueRepositoryProvider).categories();
  return CategoryTree(flat);
});

/// Brands, for the brand facet. One page is enough for a filter list; the
/// endpoint is paginated because the brand list grows with the seller base,
/// and a filter screen that pages is a filter screen nobody finishes.
final FutureProvider<List<Brand>> brandFacetsProvider =
    FutureProvider<List<Brand>>((Ref ref) async {
  final Page<Brand> page =
      await ref.watch(catalogueRepositoryProvider).brands(limit: 50);
  return page.items;
});

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

/// The rails on the home screen.
///
/// Each is a real `sort` the endpoint accepts. There is no "trending",
/// "recommended" or "recently viewed" rail, because the contract has no
/// endpoint that could fill one and a rail filled with `newest` wearing a
/// "Trending" label is a lie with a heading on it.
///
/// Note what is missing and why: there is no "Best value" or "Cheapest" rail.
/// [ProductSort] has no price sort at all — the catalogue cannot order by a
/// price it resolves per channel and per currency — so a price rail cannot be
/// built without sorting one loaded page client-side and calling it a ranking.
enum ProductRail {
  newArrivals(
    title: 'New arrivals',
    subtitle: 'The most recently listed products',
    sort: ProductSort.newest,
  ),
  topRated(
    title: 'Top rated',
    subtitle: 'Highest rated by buyers',
    sort: ProductSort.rating,
  ),
  lowMinimumOrder(
    title: 'Small order friendly',
    subtitle: 'Lowest minimum order quantity',
    sort: ProductSort.moqAsc,
  );

  const ProductRail({
    required this.title,
    required this.subtitle,
    required this.sort,
  });

  final String title;
  final String subtitle;
  final ProductSort sort;
}

/// How many cards a rail asks for. Twelve is two screens' worth of horizontal
/// scroll on a phone; asking for more is payload nobody scrolls to.
const int kRailPageSize = 12;

final FutureProviderFamily<List<ProductCard>, ProductRail> productRailProvider =
    FutureProvider.family<List<ProductCard>, ProductRail>(
  (Ref ref, ProductRail rail) async {
    final ProductQuery base = ref.watch(baseQueryProvider);
    final Page<ProductCard> page =
        await ref.watch(catalogueRepositoryProvider).products(
              limit: kRailPageSize,
              channel: base.channel,
              currency: base.currency,
              sort: rail.sort,
            );
    return page.items;
  },
);

// ---------------------------------------------------------------------------
// Product detail
// ---------------------------------------------------------------------------

/// One product page, keyed by SLUG — matching the web routes, so a deep link
/// from a share sheet or a push notification resolves without a lookup.
///
/// Auto-disposed: a product page is a leaf, and holding every product a user
/// has ever opened is an unbounded cache with images attached.
final FutureProviderFamily<ProductDetail, String> productDetailProvider =
    FutureProvider.autoDispose.family<ProductDetail, String>(
  (Ref ref, String slug) {
    final ProductQuery base = ref.watch(baseQueryProvider);
    return ref.watch(catalogueRepositoryProvider).product(
          slug,
          channel: base.channel,
          currency: base.currency,
        );
  },
);

// ---------------------------------------------------------------------------
// Paged grids
// ---------------------------------------------------------------------------

/// A cursor-paginated product list for one [ProductQuery].
///
/// Keyed by the whole query, which is what makes the cursor rule safe: a cursor
/// is minted against the query that produced it, and replaying it under a
/// different filter asks the server to continue a list it never sent. Because
/// the family key IS the query, changing a facet does not mutate this
/// provider — it selects a different one, with its own pager, starting at page
/// one. There is no code path here that can send a stale cursor.
final AsyncNotifierProviderFamily<PagedProductsNotifier, PagedProducts,
        ProductQuery> pagedProductsProvider =
    AsyncNotifierProvider.autoDispose
        .family<PagedProductsNotifier, PagedProducts, ProductQuery>(
  PagedProductsNotifier.new,
);

/// How many products one page of a grid asks for.
const int kGridPageSize = 24;

class PagedProductsNotifier extends AsyncNotifier<PagedProducts> {
  PagedProductsNotifier(this.query);

  final ProductQuery query;

  CursorPager<ProductCard>? _pager;

  @override
  Future<PagedProducts> build() async {
    final CatalogueRepository repo = ref.watch(catalogueRepositoryProvider);
    final CursorPager<ProductCard> pager = CursorPager<ProductCard>(
      fetch: ({String? cursor}) => repo.products(
        cursor: cursor,
        limit: kGridPageSize,
        search: query.normalisedSearch,
        categorySlug: query.categorySlug,
        brandSlug: query.brandSlug,
        channel: query.channel,
        currency: query.currency,
        inStock: query.inStockParam,
        minRating: query.minRating,
        moqMax: query.moqMax,
        sort: query.sort,
      ),
    );
    _pager = pager;
    await pager.loadNext();
    return PagedProducts(items: pager.items, hasMore: pager.hasMore);
  }

  /// Append the next page.
  ///
  /// A no-op while one is in flight, while the server has said there is no
  /// more, or while the first page has not landed — a scroll listener and a
  /// refresh indicator both fire this without much difficulty, and two
  /// in-flight requests on the same cursor append the same rows twice.
  /// [CursorPager] guards the request; this guards the state.
  Future<void> loadMore() async {
    final CursorPager<ProductCard>? pager = _pager;
    final PagedProducts? current = state.value;
    if (pager == null || current == null) return;
    if (!pager.hasMore || pager.isLoading || current.loadingMore) return;

    state = AsyncData<PagedProducts>(current.loading());
    try {
      await pager.loadNext();
      state = AsyncData<PagedProducts>(
        PagedProducts(items: pager.items, hasMore: pager.hasMore),
      );
    } on Object catch (error) {
      // A failed SECOND page must not blank the rows already on screen. The
      // error rides on the data instead, and the grid renders it as a retry
      // footer under the products the user is still reading.
      state = AsyncData<PagedProducts>(current.failedToLoadMore(error));
    }
  }

  /// Pull-to-refresh: throw everything away and start from page one.
  Future<void> refresh() async {
    _pager = null;
    state = const AsyncLoading<PagedProducts>();
    state = await AsyncValue.guard(build);
  }
}

// ---------------------------------------------------------------------------
// The result count behind "Show N results"
// ---------------------------------------------------------------------------

/// How far the count probe is willing to look before it says "60+".
///
/// The catalogue envelope carries NO total — `PageMeta` is `{cursor, hasMore}`
/// and `envelope.ts` says why: an unbounded `count()` runs beside every page
/// query on the pool checkout transactions share. So a live "Show N results"
/// button cannot be a count; it can only be a bounded probe. This is that
/// bound. Beyond it the button says "Show 60+ results", which is honest, and
/// the alternative — a number that is silently wrong — is not.
const int kResultProbeLimit = 60;

/// The answer to "how many products match this, right now".
@immutable
class ResultCount {
  const ResultCount({required this.count, required this.isAtLeast});

  /// Matches found by the probe, capped at [kResultProbeLimit].
  final int count;

  /// True when the server said there was more behind the probe, so [count] is
  /// a floor and must be rendered as `60+`.
  final bool isAtLeast;

  bool get isZero => count == 0 && !isAtLeast;
}

final FutureProviderFamily<ResultCount, ProductQuery> resultCountProvider =
    FutureProvider.autoDispose.family<ResultCount, ProductQuery>(
  (Ref ref, ProductQuery query) async {
    final Page<ProductCard> page =
        await ref.watch(catalogueRepositoryProvider).products(
              limit: kResultProbeLimit,
              search: query.normalisedSearch,
              categorySlug: query.categorySlug,
              brandSlug: query.brandSlug,
              channel: query.channel,
              currency: query.currency,
              inStock: query.inStockParam,
              minRating: query.minRating,
              moqMax: query.moqMax,
              sort: query.sort,
            );
    return ResultCount(count: page.length, isAtLeast: page.hasMore);
  },
);

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/// How long the search box waits before it asks the server anything.
///
/// 250ms is the interval where a fast typist produces one request per word
/// rather than one per keystroke, and a slow one still sees suggestions before
/// they look up from the keyboard.
const Duration kSearchDebounce = Duration(milliseconds: 250);

/// How many suggestions to fetch. Eight fits above the keyboard on the
/// smallest supported phone without the list needing to scroll — a suggestion
/// list you have to scroll is slower than finishing the word.
const int kSuggestionLimit = 8;

/// The search term, debounced.
///
/// Held in a notifier rather than in the field's own state because two things
/// read it — the suggestion list and the results grid — and they must never
/// disagree about what was searched for.
final NotifierProvider<DebouncedSearchTerm, String>
    debouncedSearchTermProvider =
    NotifierProvider<DebouncedSearchTerm, String>(DebouncedSearchTerm.new);

class DebouncedSearchTerm extends Notifier<String> {
  Timer? _timer;

  @override
  String build() {
    // Without this the timer outlives the screen and calls `state =` on a
    // disposed notifier — which in release mode is a silent no-op and in debug
    // is a crash on a screen the user has already left.
    ref.onDispose(() => _timer?.cancel());
    return '';
  }

  /// A keystroke. Restarts the clock.
  void input(String value) {
    _timer?.cancel();
    final String next = value.trim();
    if (next == state) return;
    if (next.isEmpty) {
      // Clearing is instant. Waiting 250ms to empty a list the user has
      // already emptied reads as lag, and there is no request to save.
      state = '';
      return;
    }
    _timer = Timer(kSearchDebounce, () => state = next);
  }

  /// Submit, or a tap on a recent search — no wait at all.
  void commit(String value) {
    _timer?.cancel();
    state = value.trim();
  }

  void clear() {
    _timer?.cancel();
    state = '';
  }
}

/// Type-ahead suggestions.
///
/// There is no `/v1/search/suggest` endpoint in the contract, so these are real
/// products from `GET /v1/products?search=`, capped at [kSuggestionLimit]. That
/// is worth knowing when reading the screen: a suggestion here is a product,
/// not a query completion, so tapping one can go straight to the product page
/// rather than re-running the search.
final FutureProviderFamily<List<ProductCard>, String>
    searchSuggestionsProvider =
    FutureProvider.autoDispose.family<List<ProductCard>, String>(
  (Ref ref, String term) async {
    if (term.trim().isEmpty) return const <ProductCard>[];
    final ProductQuery base = ref.watch(baseQueryProvider);
    final Page<ProductCard> page =
        await ref.watch(catalogueRepositoryProvider).products(
              search: term.trim(),
              limit: kSuggestionLimit,
              channel: base.channel,
              currency: base.currency,
            );
    return page.items;
  },
);

/// The most recent searches, newest first.
///
/// SESSION-SCOPED, and that is a known gap rather than a decision: the app has
/// `flutter_secure_storage` for tokens and nothing else for ordinary
/// preferences, and adding a persistence package is a `pubspec.yaml` edit this
/// feature does not own. [RecentSearches] is the whole seam — give it a store
/// and nothing above it changes.
final NotifierProvider<RecentSearches, List<String>> recentSearchesProvider =
    NotifierProvider<RecentSearches, List<String>>(RecentSearches.new);

/// How many recent searches to keep. Beyond about six the list stops being a
/// shortcut and becomes a second thing to read.
const int kRecentSearchLimit = 6;

class RecentSearches extends Notifier<List<String>> {
  @override
  List<String> build() => const <String>[];

  void record(String term) {
    final String value = term.trim();
    if (value.isEmpty) return;
    // Case-insensitive de-duplication, but the NEW casing wins: a user who
    // retypes a term with different capitals has told you how they think of it.
    final List<String> next = <String>[
      value,
      ...state.where((String s) => s.toLowerCase() != value.toLowerCase()),
    ];
    state = List<String>.unmodifiable(
      next.take(kRecentSearchLimit).toList(growable: false),
    );
  }

  void remove(String term) {
    state = List<String>.unmodifiable(
      state.where((String s) => s != term).toList(growable: false),
    );
  }

  void clear() => state = const <String>[];
}

// ---------------------------------------------------------------------------
// The seam into the cart
// ---------------------------------------------------------------------------

/// What "Add to cart" does.
///
/// The catalogue owns the buy box and the cart owns the basket, and neither
/// should import the other — a product page that imports a cart controller is a
/// product page that cannot be tested, screenshotted or shipped while the cart
/// is half-written. This is the join: the cart feature overrides it at the app
/// root, the product page calls it, and nothing in this directory knows what a
/// cart line looks like.
///
/// Null until it is overridden, and the buy box says so rather than pretending:
/// a button that silently does nothing is worse than a button that explains
/// itself.
typedef AddToCartAction = Future<void> Function({
  required ProductDetail product,
  required int quantity,
  ProductVariant? variant,
});

final Provider<AddToCartAction?> addToCartProvider =
    Provider<AddToCartAction?>((Ref ref) => null);
