/// The catalogue feature, in one import.
///
/// The router needs four screens and nothing else from here:
///
///     HomeScreen()                          → Routes.home       '/'
///     SearchScreen(initialQuery:, initialSort:)
///                                           → Routes.search     '/search'
///     CategoryScreen(slug:)                 → Routes.category   '/categories/:slug'
///     ProductDetailScreen(slug:)            → Routes.product    '/products/:slug'
///
/// `SearchScreen`'s two arguments are both optional and both come off the query
/// string: `?q=` and `?sort=` (a `ProductSort` wire value — `newest`,
/// `name_asc`, `moq_asc`, `rating`). The home rails link to `/search?sort=…`,
/// so wiring them is what makes "See all" work.
///
/// One route this feature expects and does not own: [kRequestQuoteRoute],
/// `/rfq/new?productId=…&slug=…`. `ProductDetailScreen` pushes it for a
/// quote-only product and for a deep link the channel 404s. It is not in
/// `Routes` yet and the RFQ screen is not built here.
///
/// Two providers are meant to be overridden at the app root:
///
///  * [addToCartProvider] — null by default, so the buy box says the basket is
///    not connected instead of failing silently.
///  * [catalogueChannelProvider] / [catalogueCurrencyProvider] — B2C and the
///    server's market default. The account feature overrides them once a
///    company membership is known.
///
/// And one is meant to be overridden in tests:
/// [catalogueRepositoryProvider].
library;

export 'catalogue_context.dart'
    show kRequestQuoteRoute, openCategory, openProduct, openQuoteRequest;
export 'data/catalogue_offer.dart'
    show CatalogueOffer, OfferMode, QuoteReason;
export 'data/catalogue_providers.dart'
    show
        AddToCartAction,
        ProductRail,
        ResultCount,
        addToCartProvider,
        avenickApiProvider,
        baseQueryProvider,
        brandFacetsProvider,
        catalogueChannelProvider,
        catalogueCurrencyProvider,
        catalogueRepositoryProvider,
        categoryTreeProvider,
        debouncedSearchTermProvider,
        pagedProductsProvider,
        productDetailProvider,
        productRailProvider,
        recentSearchesProvider,
        resultCountProvider,
        searchSuggestionsProvider;
export 'data/catalogue_repository.dart'
    show ApiCatalogueRepository, CatalogueRepository;
export 'data/category_tree.dart' show CategoryTree;
export 'data/display_price.dart' show DisplayPrice, MoneyFormat;
export 'data/paged_products.dart' show PagedProducts;
export 'data/product_query.dart'
    show ProductQuery, ProductSortLabel, QueryRelaxation;
export 'screens/category_screen.dart' show CategoryScreen;
export 'screens/home_screen.dart' show HomeScreen;
export 'screens/product_detail_screen.dart' show ProductDetailScreen;
export 'screens/search_filter_screen.dart' show SearchFilterScreen;
export 'screens/search_screen.dart' show SearchScreen;
export 'widgets/availability_label.dart' show AvailabilityLabel;
export 'widgets/price_block.dart' show PriceBlock, PriceBlockVariant;
export 'widgets/price_ladder.dart' show PriceLadder;
export 'widgets/product_card.dart' show ProductCardTile;
export 'widgets/product_image.dart'
    show ProductImage, RemoteImageBuilder, remoteImageBuilderProvider;
export 'widgets/rating_row.dart' show RatingRow;
export 'widgets/sort_sheet.dart' show SortButton, showSortSheet;
