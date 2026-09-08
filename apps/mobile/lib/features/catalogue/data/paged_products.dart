import 'package:flutter/foundation.dart' show immutable;

import '../../../api/models/catalogue.dart';

/// One product grid's worth of state: the rows loaded so far, whether there is
/// another page, and what the *next* page is doing.
///
/// The last part is why this is a class and not a bare `List<ProductCard>`.
/// A second page failing is not the same event as the first page failing:
/// the first leaves an empty screen and belongs in `AsyncValue.error`, where
/// [AsyncStateView] renders the whole-screen error state. The second happens
/// while twenty-four products are on screen being read, and routing it to the
/// same place would blank them. So [loadMoreError] rides on the DATA branch and
/// the grid renders it as a retry footer under rows that are still there.
@immutable
class PagedProducts {
  const PagedProducts({
    required this.items,
    required this.hasMore,
    this.loadingMore = false,
    this.loadMoreError,
  });

  /// Everything loaded so far, in server order.
  final List<ProductCard> items;

  /// True until the server says otherwise.
  final bool hasMore;

  /// A page is in flight below the fold.
  final bool loadingMore;

  /// The failure from the last [loadingMore] attempt, if it failed. Null once a
  /// retry succeeds.
  final Object? loadMoreError;

  /// Loaded successfully with zero rows. The predicate [AsyncStateView]
  /// requires — and the reason it requires one: an empty list arrives at the
  /// data branch and renders a blank screen with a working scrollbar.
  bool get isEmpty => items.isEmpty;

  int get length => items.length;

  PagedProducts loading() => PagedProducts(
        items: items,
        hasMore: hasMore,
        loadingMore: true,
      );

  PagedProducts failedToLoadMore(Object error) => PagedProducts(
        items: items,
        hasMore: hasMore,
        loadMoreError: error,
      );

  @override
  String toString() =>
      'PagedProducts(${items.length} items, hasMore: $hasMore, '
      'loadingMore: $loadingMore, loadMoreError: $loadMoreError)';
}
