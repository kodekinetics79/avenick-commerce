import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show SliverConstraints;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../api/models/catalogue.dart';
import '../../../core/ui/async_state_view.dart';
import '../../../core/ui/key_button.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../catalogue_context.dart';
import 'catalogue_chrome.dart';
import '../data/catalogue_providers.dart';
import '../data/paged_products.dart';
import '../data/product_query.dart';
import 'product_card.dart';

/// A cursor-paginated product grid with the scroll view it lives in.
///
/// It owns the whole surface rather than just the grid because the three things
/// that make an infinite list behave — the scroll controller, the
/// pull-to-refresh, and the "am I near the bottom" trigger — are one mechanism,
/// and splitting them across a screen and a widget is how a list ends up
/// refreshing without resetting its pager.
///
/// [leadingSlivers] is how a caller puts its own content above the grid inside
/// the SAME scrollable — the subcategory row on a category page, the facet
/// summary on a search page. A separate `Column` above a scrolling grid would
/// give the page two scroll axes fighting each other, which is exactly the
/// complaint that put the filter on a full screen instead of in a sheet.
class PagedProductGrid extends ConsumerStatefulWidget {
  const PagedProductGrid({
    required this.query,
    required this.emptyTitle,
    required this.emptyBody,
    this.emptyAction,
    this.leadingSlivers = const <Widget>[],
    this.onProductTap,
    this.scrollController,
    super.key,
  });

  final ProductQuery query;

  /// The words for the empty branch. Required, and not defaulted, for the
  /// reason [AsyncStateView] gives: a generic "Nothing here" is how an empty
  /// category and a failed filter end up looking identical.
  final String emptyTitle;
  final String emptyBody;

  /// What to offer when there is nothing — "Browse all products", or the list
  /// of facets to relax on a search page.
  final Widget? emptyAction;

  final List<Widget> leadingSlivers;

  final void Function(ProductCard product)? onProductTap;

  final ScrollController? scrollController;

  @override
  ConsumerState<PagedProductGrid> createState() => _PagedProductGridState();
}

class _PagedProductGridState extends ConsumerState<PagedProductGrid> {
  ScrollController? _owned;

  ScrollController get _controller =>
      widget.scrollController ?? (_owned ??= ScrollController());

  /// How close to the bottom the user has to get before the next page starts.
  ///
  /// Two screens' worth. Less than that and the spinner is visible on every
  /// page boundary, which turns an infinite list into a series of small waits;
  /// much more and a slow connection is prefetching pages nobody reaches.
  static const double _prefetchExtent = 1200;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onScroll);
  }

  @override
  void dispose() {
    _controller.removeListener(_onScroll);
    _owned?.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_controller.hasClients) return;
    final ScrollPosition p = _controller.position;
    if (p.pixels < p.maxScrollExtent - _prefetchExtent) return;
    // The notifier is the guard, not this: it refuses a second page while one
    // is in flight, so firing this on every scroll frame is cheap and correct.
    ref.read(pagedProductsProvider(widget.query).notifier).loadMore();
  }

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final AsyncValue<PagedProducts> state =
        ref.watch(pagedProductsProvider(widget.query));

    return RefreshIndicator(
      onRefresh: () =>
          ref.read(pagedProductsProvider(widget.query).notifier).refresh(),
      color: t.primary,
      backgroundColor: t.surface2,
      child: CustomScrollView(
        controller: _controller,
        // Always scrollable, so pull-to-refresh works on a screen whose content
        // is shorter than the viewport — which is every empty state.
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: <Widget>[
          ...widget.leadingSlivers,
          // Every branch below returns a SLIVER, which is what lets the four
          // required states share one scroll view with the grid instead of the
          // grid being wrapped in a box that cannot virtualise.
          AsyncStateView<PagedProducts>(
            value: state,
            isEmpty: (PagedProducts p) => p.isEmpty,
            data: (BuildContext context, PagedProducts page) =>
                SliverMainAxisGroup(
              slivers: <Widget>[
                _ProductSliverGrid(
                  products: page.items,
                  onProductTap: widget.onProductTap,
                ),
                SliverToBoxAdapter(
                  child: _GridFooter(
                    page: page,
                    onRetry: () => ref
                        .read(pagedProductsProvider(widget.query).notifier)
                        .loadMore(),
                  ),
                ),
              ],
            ),
            empty: (BuildContext context) => SliverFillRemaining(
              hasScrollBody: false,
              child: MeridianEmptyState(
                title: widget.emptyTitle,
                body: widget.emptyBody,
                action: widget.emptyAction,
              ),
            ),
            error: (BuildContext context, Object error, StackTrace? stack) =>
                SliverFillRemaining(
              hasScrollBody: false,
              child: MeridianErrorState(
                error: error,
                onRetry: () => ref
                    .read(pagedProductsProvider(widget.query).notifier)
                    .refresh(),
              ),
            ),
            loading: (BuildContext context) => SliverToBoxAdapter(
              // A skeleton in the shape of a grid, not a spinner: the user can
              // see what is coming and nothing jumps when it lands.
              child: MeridianSkeleton(
                shape: MeridianSkeletonShape.grid,
                itemCount: gridColumnsFor(context) * 3,
              ),
            ),
          ),
          SliverToBoxAdapter(child: SizedBox(height: t.spaceBlock)),
        ],
      ),
    );
  }
}

/// The grid itself, sized so a card never overflows its cell at any text scale.
class _ProductSliverGrid extends StatelessWidget {
  const _ProductSliverGrid({required this.products, this.onProductTap});

  final List<ProductCard> products;
  final void Function(ProductCard product)? onProductTap;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final double gutter = t.spaceStack;

    return SliverPadding(
      padding: EdgeInsetsDirectional.symmetric(horizontal: gutter),
      // The cell size is computed from the extent the sliver is REALLY given,
      // not from `MediaQuery.sizeOf`. Those two are not the same number — the
      // padding above removes two gutters, and a split view, a tablet
      // master/detail or a scrollbar removes more — and sizing a fixed-extent
      // grid off the wrong one is a `RenderFlex overflowed` stripe across the
      // bottom of every card in every row.
      sliver: SliverLayoutBuilder(
        builder: (BuildContext context, SliverConstraints constraints) {
          final double inner = constraints.crossAxisExtent;
          final int columns = gridColumnsFor(
            context,
            width: inner + gutter * 2,
          );
          final double cellWidth = (inner - gutter * (columns - 1)) / columns;
          final double cellHeight =
              ProductCardTile.estimatedHeight(context, width: cellWidth);

          return SliverGrid(
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: columns,
              mainAxisSpacing: gutter,
              crossAxisSpacing: gutter,
              // An ABSOLUTE extent, not a ratio. A ratio is re-derived from
              // whatever width the delegate resolves, so any disagreement
              // between the measured width and the delegate's own arithmetic
              // reappears as a proportional error in the HEIGHT.
              mainAxisExtent: cellHeight,
            ),
            delegate: SliverChildBuilderDelegate(
              (BuildContext context, int index) {
                final ProductCard product = products[index];
                return ProductCardTile(
                  product: product,
                  onTap: onProductTap == null
                      ? null
                      : () => onProductTap!(product),
                );
              },
              childCount: products.length,
            ),
          );
        },
      ),
    );
  }
}

/// What sits under the last row: nothing, a page loading, a page that failed,
/// or the end of the list.
class _GridFooter extends StatelessWidget {
  const _GridFooter({required this.page, required this.onRetry});

  final PagedProducts page;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    if (page.loadMoreError != null) {
      // Note where this renders: UNDER the products already on screen, not
      // instead of them. A second page failing must never blank the first.
      return Padding(
        padding: EdgeInsetsDirectional.all(t.spaceStack),
        child: Column(
          children: <Widget>[
            Text(
              'Could not load more products.',
              style: type.meta.copyWith(color: t.ink2),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: t.spaceTight),
            BoundedAction(
              maxWidth: 160,
              child: KeyButton(
                label: 'Try again',
                tone: KeyButtonTone.ghost,
                size: KeyButtonSize.small,
                expand: true,
                onPressed: onRetry,
              ),
            ),
          ],
        ),
      );
    }

    if (page.loadingMore) {
      return Padding(
        padding: EdgeInsetsDirectional.all(t.spaceStack),
        child: const Center(
          // A spinner is right HERE and nowhere else on this screen: the page
          // boundary is an indeterminate wait with no shape to show, and the
          // shape above it is already drawn.
          child: MeridianSpinner(label: 'Loading more products'),
        ),
      );
    }

    if (!page.hasMore && page.length > 0) {
      return Padding(
        padding: EdgeInsetsDirectional.all(t.spaceStack),
        child: Center(
          child: Text(
            'End of results',
            style: type.meta.copyWith(color: t.ink3),
          ),
        ),
      );
    }

    return SizedBox(height: t.spaceStack);
  }
}
