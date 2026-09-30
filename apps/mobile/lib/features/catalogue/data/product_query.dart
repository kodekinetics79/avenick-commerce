import 'package:flutter/foundation.dart' show immutable;

import '../../../api/models/enums.dart';

/// One complete, immutable statement of "which products, in what order".
///
/// Every field here is a parameter `GET /v1/products` actually accepts. There
/// is no client-side facet in this class and there is not going to be one: a
/// filter the server does not know about can only be applied to the page that
/// happens to be loaded, which produces a list that changes as you scroll and
/// a result count that is wrong by an unknowable amount.
///
/// It is also the FAMILY KEY for the paged product provider, which is why the
/// value equality below is load-bearing rather than a convenience. Riverpod
/// keys a family by `==`, so two queries that differ only in sort must not
/// compare equal — and two that are genuinely identical must, or every rebuild
/// mints a fresh pager and refetches page one.
@immutable
class ProductQuery {
  const ProductQuery({
    this.search,
    this.categorySlug,
    this.brandSlug,
    this.channel = Channel.b2c,
    this.currency,
    this.inStockOnly = false,
    this.minRating,
    this.moqMax,
    this.sort = ProductSort.newest,
  });

  /// Free-text search. Null and empty are the same thing to the server; this
  /// class normalises to null so `''` and `null` do not key two identical
  /// providers.
  final String? search;

  final String? categorySlug;
  final String? brandSlug;

  /// B2C or B2B. Selects the price band, not just a label.
  final Channel channel;

  /// Null lets the server pick the market default for the caller.
  final Currency? currency;

  /// Maps to `inStock=true`. Sent as null when false, never as `false`:
  /// `inStock=false` would ask the server for the out-of-stock products, which
  /// is the opposite of an unticked checkbox.
  final bool inStockOnly;

  /// 1.0 – 5.0, or null for "any".
  final double? minRating;

  /// The upper bound on minimum order quantity — "shows me things I can buy in
  /// small lots". `moqMin` exists on the endpoint too but is deliberately not
  /// surfaced: a buyer asking for a *higher* floor is not a journey anyone has,
  /// and an unused filter still costs a row of screen and a wrong result.
  final int? moqMax;

  final ProductSort sort;

  /// A sentinel that lets [copyWith] tell "leave it alone" from "set it to
  /// null". Without one there is no way to CLEAR a facet through copyWith, and
  /// clearing is exactly what the filter screen's Reset does.
  static const Object _keep = Object();

  ProductQuery copyWith({
    Object? search = _keep,
    Object? categorySlug = _keep,
    Object? brandSlug = _keep,
    Channel? channel,
    Object? currency = _keep,
    bool? inStockOnly,
    Object? minRating = _keep,
    Object? moqMax = _keep,
    ProductSort? sort,
  }) {
    return ProductQuery(
      search: identical(search, _keep) ? this.search : search as String?,
      categorySlug: identical(categorySlug, _keep)
          ? this.categorySlug
          : categorySlug as String?,
      brandSlug:
          identical(brandSlug, _keep) ? this.brandSlug : brandSlug as String?,
      channel: channel ?? this.channel,
      currency:
          identical(currency, _keep) ? this.currency : currency as Currency?,
      inStockOnly: inStockOnly ?? this.inStockOnly,
      minRating:
          identical(minRating, _keep) ? this.minRating : minRating as double?,
      moqMax: identical(moqMax, _keep) ? this.moqMax : moqMax as int?,
      sort: sort ?? this.sort,
    );
  }

  /// The search term with `''` folded to null.
  String? get normalisedSearch {
    final String? s = search?.trim();
    return s == null || s.isEmpty ? null : s;
  }

  /// What `inStock` should actually be sent as. See [inStockOnly].
  bool? get inStockParam => inStockOnly ? true : null;

  /// How many facets the user has turned on, for the badge on the Filter
  /// button. Sort is NOT a facet: it never removes a result, so counting it
  /// would tell the user they have narrowed something when they have not.
  int get activeFacetCount {
    int n = 0;
    if (categorySlug != null) n++;
    if (brandSlug != null) n++;
    if (inStockOnly) n++;
    if (minRating != null) n++;
    if (moqMax != null) n++;
    return n;
  }

  bool get hasFacets => activeFacetCount > 0;

  /// The query with every facet dropped but the search term and sort kept.
  ProductQuery get withoutFacets => ProductQuery(
        search: search,
        channel: channel,
        currency: currency,
        sort: sort,
      );

  /// The single-facet relaxations to offer on a zero-result screen.
  ///
  /// A "no results" page that only says "no results" makes the user guess
  /// which of their five choices was the fatal one. Each entry here is one
  /// facet dropped, with the words for the button, so the screen can offer
  /// "Show items out of stock too" rather than "Clear all filters" — which
  /// throws away four correct choices to fix one.
  List<QueryRelaxation> get relaxations {
    final List<QueryRelaxation> out = <QueryRelaxation>[];
    if (inStockOnly) {
      out.add(
        QueryRelaxation(
          label: 'Include items that are out of stock',
          query: copyWith(inStockOnly: false),
        ),
      );
    }
    if (minRating != null) {
      out.add(
        QueryRelaxation(
          label: 'Any customer rating',
          query: copyWith(minRating: null),
        ),
      );
    }
    if (moqMax != null) {
      out.add(
        QueryRelaxation(
          label: 'Any minimum order quantity',
          query: copyWith(moqMax: null),
        ),
      );
    }
    if (brandSlug != null) {
      out.add(
        QueryRelaxation(label: 'Any brand', query: copyWith(brandSlug: null)),
      );
    }
    if (categorySlug != null) {
      out.add(
        QueryRelaxation(
          label: 'Search the whole catalogue',
          query: copyWith(categorySlug: null),
        ),
      );
    }
    return out;
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ProductQuery &&
          other.normalisedSearch == normalisedSearch &&
          other.categorySlug == categorySlug &&
          other.brandSlug == brandSlug &&
          other.channel == channel &&
          other.currency == currency &&
          other.inStockOnly == inStockOnly &&
          other.minRating == minRating &&
          other.moqMax == moqMax &&
          other.sort == sort;

  @override
  int get hashCode => Object.hash(
        normalisedSearch,
        categorySlug,
        brandSlug,
        channel,
        currency,
        inStockOnly,
        minRating,
        moqMax,
        sort,
      );

  @override
  String toString() => 'ProductQuery(search: $normalisedSearch, '
      'category: $categorySlug, brand: $brandSlug, channel: ${channel.wire}, '
      'inStock: $inStockOnly, minRating: $minRating, moqMax: $moqMax, '
      'sort: ${sort.wire})';
}

/// One facet the user could drop to widen a zero-result search.
@immutable
class QueryRelaxation {
  const QueryRelaxation({required this.label, required this.query});

  final String label;
  final ProductQuery query;
}

/// The words for each sort, in one place so the sheet and the button agree.
extension ProductSortLabel on ProductSort {
  String get label => switch (this) {
        ProductSort.newest => 'Newest first',
        ProductSort.nameAsc => 'Name A–Z',
        ProductSort.moqAsc => 'Lowest minimum order',
        ProductSort.rating => 'Highest rated',
      };

  /// The one-line reason, shown under each option. A sort list with four bare
  /// nouns makes the user open all four to find out what they do.
  String get explanation => switch (this) {
        ProductSort.newest => 'Most recently listed products first.',
        ProductSort.nameAsc => 'Alphabetical, by product name.',
        ProductSort.moqAsc => 'Smallest order you can place, first.',
        ProductSort.rating => 'Best customer rating first.',
      };
}
