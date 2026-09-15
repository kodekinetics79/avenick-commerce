import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/catalogue.dart';
import '../../../api/models/enums.dart';
import '../../../core/l10n/numerals.dart';
import '../../../core/ui/async_state_view.dart';
import '../../../core/ui/key_button.dart';
import '../../../theme/elevation.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../catalogue_context.dart';
import '../data/catalogue_providers.dart';
import '../data/display_price.dart';
import '../data/product_query.dart';
import '../widgets/availability_label.dart';
import '../widgets/catalogue_chrome.dart';
import '../widgets/product_grid.dart';
import '../widgets/product_image.dart';
import '../widgets/sort_sheet.dart';
import 'search_filter_screen.dart';

/// Search: entry, recents, debounced suggestions, results, facets, sort.
///
/// ## Three phases, and the rule that keeps them straight
///
/// * **Idle** — nothing typed. Recent searches.
/// * **Suggesting** — something typed, nothing submitted. Type-ahead, debounced
///   at [kSearchDebounce] (250ms).
/// * **Results** — submitted. The paged grid, with the filter and sort bar.
///
/// The rule: **editing the text after a search drops back to suggesting.** A
/// results grid that keeps showing "valve" while the field says "valv" is two
/// screens claiming different things at once, and the user cannot tell which
/// one the Filter button is about to act on.
///
/// ## What the contract does not have
///
/// There is no `/v1/search/suggest`. The suggestions here are real products
/// from `GET /v1/products?search=&limit=8`, which is why tapping one opens the
/// product rather than re-running the query — it is a product, not a completion.
///
/// Recent searches live in memory for the session. See [recentSearchesProvider]
/// for why, and for the one-line seam that fixes it.
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({this.initialQuery, this.initialSort, super.key});

  /// Pre-fills the field and goes straight to results. Wired from `?q=` so a
  /// share link, a push notification or a "See all" from the home rails lands
  /// on a populated screen.
  final String? initialQuery;

  /// Pre-selects the sort, from `?sort=`. The home rails use this to hand their
  /// ordering over to the search screen rather than inventing a browse route
  /// the web does not serve.
  final ProductSort? initialSort;

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  late final TextEditingController _text =
      TextEditingController(text: widget.initialQuery ?? '');
  final FocusNode _focus = FocusNode();

  late ProductQuery _query = ProductQuery(
    search: widget.initialQuery,
    sort: widget.initialSort ?? ProductSort.newest,
  );

  late bool _showingResults = (widget.initialQuery ?? '').trim().isNotEmpty;

  @override
  void initState() {
    super.initState();
    final String? initial = widget.initialQuery?.trim();
    if (initial != null && initial.isNotEmpty) {
      // Seed the debounced term too, so backing out of results into suggesting
      // does not show an empty list for 250ms.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ref.read(debouncedSearchTermProvider.notifier).commit(initial);
      });
    }
  }

  @override
  void dispose() {
    _text.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    ref.read(debouncedSearchTermProvider.notifier).input(value);
    if (_showingResults && value.trim() != (_query.normalisedSearch ?? '')) {
      setState(() => _showingResults = false);
    } else if (!_showingResults) {
      // Rebuild so the idle/suggesting switch follows the field.
      setState(() {});
    }
  }

  void _submit(String value) {
    final String term = value.trim();
    if (term.isEmpty) return;
    ref.read(debouncedSearchTermProvider.notifier).commit(term);
    ref.read(recentSearchesProvider.notifier).record(term);
    _text.value = TextEditingValue(
      text: term,
      selection: TextSelection.collapsed(offset: term.length),
    );
    _focus.unfocus();
    setState(() {
      _query = _query.copyWith(search: term);
      _showingResults = true;
    });
  }

  void _clear() {
    _text.clear();
    ref.read(debouncedSearchTermProvider.notifier).clear();
    setState(() {
      _query = _query.copyWith(search: null);
      _showingResults = false;
    });
    _focus.requestFocus();
  }

  Future<void> _openFilters(ProductQuery effective) async {
    final ProductQuery? next = await Navigator.of(context).push<ProductQuery>(
      MaterialPageRoute<ProductQuery>(
        builder: (BuildContext context) =>
            SearchFilterScreen(initial: effective),
      ),
    );
    // Null means the user backed out. Leave the filters as they were — never
    // clear them, and never apply a half-edited draft.
    if (next == null || !mounted) return;
    setState(() => _query = next);
  }

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final ProductQuery base = ref.watch(baseQueryProvider);
    final ProductQuery effective = _query.copyWith(
      channel: base.channel,
      currency: base.currency,
    );

    return Scaffold(
      backgroundColor: t.surface0,
      appBar: AppBar(
        titleSpacing: 0,
        title: Padding(
          padding: EdgeInsetsDirectional.only(end: t.spaceStack),
          child: _SearchField(
            controller: _text,
            focusNode: _focus,
            onChanged: _onChanged,
            onSubmitted: _submit,
            onClear: _clear,
          ),
        ),
      ),
      body: _showingResults
          ? _Results(
              query: effective,
              onSortChanged: (ProductSort sort) =>
                  setState(() => _query = _query.copyWith(sort: sort)),
              onOpenFilters: () => _openFilters(effective),
              onRelax: (ProductQuery relaxed) =>
                  setState(() => _query = relaxed),
            )
          : _text.text.trim().isEmpty
              ? _RecentSearches(onPick: _submit)
              : _Suggestions(onSubmitTerm: _submit),
    );
  }
}

/// The field. A well — rung 1, recessed — with the search glyph inside it.
class _SearchField extends StatelessWidget {
  const _SearchField({
    required this.controller,
    required this.focusNode,
    required this.onChanged,
    required this.onSubmitted,
    required this.onClear,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onChanged;
  final ValueChanged<String> onSubmitted;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;

    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (BuildContext context, TextEditingValue value, Widget? child) {
        return TextField(
          controller: controller,
          focusNode: focusNode,
          autofocus: false,
          textInputAction: TextInputAction.search,
          onChanged: onChanged,
          onSubmitted: onSubmitted,
          style: context.type.body,
          decoration: InputDecoration(
            hintText: 'Search products, brands, SKUs',
            // Never mirrors. A left-handed magnifier is the single most common
            // RTL mistake in shipped apps.
            prefixIcon: Padding(
              padding: EdgeInsetsDirectional.only(
                start: t.spaceTight + t.spaceUnit,
                end: t.spaceTight,
              ),
              child: Icon(LucideIcons.search, size: 18, color: t.ink3),
            ),
            prefixIconConstraints: BoxConstraints(
              minWidth: t.spaceStack + 18 + t.spaceTight,
              minHeight: kMinTouchTarget,
            ),
            suffixIcon: value.text.isEmpty
                ? null
                : IconAction(
                    icon: LucideIcons.x,
                    iconName: 'x',
                    label: 'Clear search',
                    onPressed: onClear,
                  ),
            suffixIconConstraints: const BoxConstraints(
              minWidth: kMinTouchTarget,
              minHeight: kMinTouchTarget,
            ),
          ),
        );
      },
    );
  }
}

/// Phase one: nothing typed.
class _RecentSearches extends ConsumerWidget {
  const _RecentSearches({required this.onPick});

  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final List<String> recents = ref.watch(recentSearchesProvider);

    if (recents.isEmpty) {
      return const MeridianEmptyState(
        icon: Icon(LucideIcons.search),
        title: 'Search the catalogue',
        body: 'Find products by name, brand or SKU. Filter by category, '
            'availability, rating and minimum order quantity.',
      );
    }

    return ListView(
      padding: EdgeInsetsDirectional.only(bottom: t.spaceBlock),
      children: <Widget>[
        Padding(
          padding: EdgeInsetsDirectional.fromSTEB(
            t.spaceStack,
            t.spaceStack,
            t.spaceTight,
            t.spaceTight,
          ),
          child: Row(
            children: <Widget>[
              Expanded(
                child: Semantics(
                  header: true,
                  child: Text('Recent searches', style: type.h3),
                ),
              ),
              TextButton(
                onPressed: () =>
                    ref.read(recentSearchesProvider.notifier).clear(),
                child: const Text('Clear all'),
              ),
            ],
          ),
        ),
        for (final String term in recents)
          Semantics(
            button: true,
            label: 'Search again for $term',
            excludeSemantics: true,
            child: InkWell(
              onTap: () => onPick(term),
              splashFactory: NoSplash.splashFactory,
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: kMinTouchTarget),
                child: Padding(
                  padding: EdgeInsetsDirectional.only(start: t.spaceStack),
                  child: Row(
                    children: <Widget>[
                      // A clock never mirrors: a clock face runs clockwise in
                      // every country on earth.
                      Icon(LucideIcons.history, size: 16, color: t.ink3),
                      SizedBox(width: t.spaceTight + t.spaceUnit),
                      Expanded(
                        child: Text(
                          term,
                          style: type.body,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      IconAction(
                        icon: LucideIcons.x,
                        iconName: 'x',
                        label: 'Remove $term from recent searches',
                        onPressed: () => ref
                            .read(recentSearchesProvider.notifier)
                            .remove(term),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Phase two: typed, not submitted. Debounced type-ahead.
class _Suggestions extends ConsumerWidget {
  const _Suggestions({required this.onSubmitTerm});

  final ValueChanged<String> onSubmitTerm;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final String term = ref.watch(debouncedSearchTermProvider);

    if (term.isEmpty) {
      // The 250ms window after the first keystroke. A skeleton here — not a
      // spinner and not a blank — so the list does not flash empty on the way
      // to being full.
      return const MeridianSkeleton(shape: MeridianSkeletonShape.list);
    }

    final AsyncValue<List<ProductCard>> suggestions =
        ref.watch(searchSuggestionsProvider(term));

    return AsyncStateView<List<ProductCard>>(
      value: suggestions,
      isEmpty: (List<ProductCard> items) => items.isEmpty,
      data: (BuildContext context, List<ProductCard> items) => ListView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: EdgeInsetsDirectional.only(bottom: t.spaceBlock),
        children: <Widget>[
          for (final ProductCard product in items)
            _SuggestionRow(product: product),
          const SectionRule(),
          Padding(
            padding: EdgeInsetsDirectional.symmetric(
              horizontal: t.spaceStack,
            ),
            child: KeyButton(
              label: 'See all results for "$term"',
              tone: KeyButtonTone.accent,
              expand: true,
              onPressed: () => onSubmitTerm(term),
            ),
          ),
        ],
      ),
      empty: (BuildContext context) => MeridianEmptyState(
        title: 'No matches for "$term"',
        body: 'Check the spelling, or search for the brand or the SKU '
            'instead.',
        action: KeyButton(
          label: 'Search anyway',
          tone: KeyButtonTone.ghost,
          onPressed: () => onSubmitTerm(term),
        ),
      ),
      error: (BuildContext context, Object error, StackTrace? stack) =>
          MeridianErrorState(
        error: error,
        onRetry: () => ref.invalidate(searchSuggestionsProvider(term)),
      ),
      loading: (BuildContext context) =>
          const MeridianSkeleton(shape: MeridianSkeletonShape.list),
    );
  }
}

/// One suggestion. A product, so it shows a product's minimum: picture, name,
/// price, availability. A bare string here would make the user tap to find out
/// what they were being offered.
class _SuggestionRow extends StatelessWidget {
  const _SuggestionRow({required this.product});

  final ProductCard product;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final String name = product.name(languageOf(context));
    final CardPrice? price = product.price;

    return Semantics(
      button: true,
      label: name,
      excludeSemantics: true,
      child: InkWell(
        onTap: () => openProduct(context, product.slug),
        splashFactory: NoSplash.splashFactory,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: kMinTouchTarget),
          child: Padding(
            padding: EdgeInsetsDirectional.symmetric(
              horizontal: t.spaceStack,
              vertical: t.spaceTight,
            ),
            child: Row(
              children: <Widget>[
                SizedBox(
                  width: t.rowH,
                  height: t.rowH,
                  child: ProductImage(
                    image: product.image,
                    productName: name,
                    radius: t.radiusSm,
                  ),
                ),
                SizedBox(width: t.spaceTight + t.spaceUnit),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Text(
                        name,
                        style: type.body,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      SizedBox(height: t.spaceUnit / 2),
                      Text(
                        price == null
                            ? 'Price on request'
                            : MoneyFormat.format(
                                DisplayPrice.fromCard(price).gross,
                              ),
                        style: type.meta.copyWith(color: t.ink2),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                SizedBox(width: t.spaceTight),
                AvailabilityLabel(
                  availability: product.availability,
                  compact: true,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Phase three: submitted. The grid, with the toolbar above it inside the same
/// scrollable.
class _Results extends StatelessWidget {
  const _Results({
    required this.query,
    required this.onSortChanged,
    required this.onOpenFilters,
    required this.onRelax,
  });

  final ProductQuery query;
  final ValueChanged<ProductSort> onSortChanged;
  final VoidCallback onOpenFilters;
  final ValueChanged<ProductQuery> onRelax;

  @override
  Widget build(BuildContext context) {
    return PagedProductGrid(
      query: query,
      emptyTitle: 'No results for "${query.normalisedSearch ?? ''}"',
      emptyBody: query.hasFacets
          ? 'Nothing matches this search with the filters you have on.'
          : 'Nothing in the catalogue matches that. Try the brand name or '
              'the SKU.',
      emptyAction: _BroadenActions(query: query, onRelax: onRelax),
      leadingSlivers: <Widget>[
        SliverToBoxAdapter(
          child: _ResultsToolbar(
            query: query,
            onSortChanged: onSortChanged,
            onOpenFilters: onOpenFilters,
          ),
        ),
      ],
    );
  }
}

/// The offer on a zero-result screen: drop ONE facet at a time.
///
/// Not "Clear all filters". A buyer who set five facets and got nothing has
/// four correct choices and one fatal one, and a single button that throws away
/// all five makes them start again. Each row here names the facet it would
/// relax, so the fatal one can be found in one tap.
class _BroadenActions extends StatelessWidget {
  const _BroadenActions({required this.query, required this.onRelax});

  final ProductQuery query;
  final ValueChanged<ProductQuery> onRelax;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final List<QueryRelaxation> options = query.relaxations;

    if (options.isEmpty) return const SizedBox.shrink();

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Text(
          'Try widening the search',
          style: type.ui.copyWith(color: t.ink2),
        ),
        SizedBox(height: t.spaceTight),
        for (final QueryRelaxation option in options) ...<Widget>[
          KeyButton(
            label: option.label,
            tone: KeyButtonTone.ghost,
            onPressed: () => onRelax(option.query),
          ),
          SizedBox(height: t.spaceTight),
        ],
      ],
    );
  }
}

/// Filter and sort, above the grid, in the grid's own scroll view.
class _ResultsToolbar extends ConsumerWidget {
  const _ResultsToolbar({
    required this.query,
    required this.onSortChanged,
    required this.onOpenFilters,
  });

  final ProductQuery query;
  final ValueChanged<ProductSort> onSortChanged;
  final VoidCallback onOpenFilters;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final AsyncValue<ResultCount> count = ref.watch(resultCountProvider(query));
    final int facets = query.activeFacetCount;

    return Padding(
      padding: EdgeInsetsDirectional.fromSTEB(
        t.spaceStack,
        t.spaceTight,
        t.spaceTight,
        t.spaceTight,
      ),
      child: Row(
        children: <Widget>[
          // Expanded and Flexible share the free space, so a long sort label —
          // 'Lowest minimum order' — shrinks the count and ellipsises itself
          // instead of pushing the Filters chip off the end of the row. An
          // intrinsically-sized SortButton here overflows at 420dp.
          Expanded(
            child: Text(
              count.when(
                skipLoadingOnRefresh: true,
                skipLoadingOnReload: true,
                loading: () => 'Searching…',
                error: (Object e, StackTrace s) => '',
                data: (ResultCount c) => c.isZero
                    ? 'No results'
                    : c.isAtLeast
                        ? '${Numerals.integer(c.count)}+ results'
                        : '${Numerals.integer(c.count)} '
                            '${c.count == 1 ? 'result' : 'results'}',
              ),
              style: type.meta.copyWith(color: t.ink2),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Flexible(
            child: SortButton(sort: query.sort, onChanged: onSortChanged),
          ),
          SizedBox(width: t.spaceUnit),
          Semantics(
            button: true,
            label:
                facets > 0 ? 'Filters, $facets active' : 'Filters, none active',
            excludeSemantics: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onOpenFilters,
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: kMinTouchTarget),
                child: MeridianSurface(
                  rung: MeridianRung.card,
                  radius: t.radiusPill,
                  fill: facets > 0 ? t.primarySoft : null,
                  padding: EdgeInsetsDirectional.symmetric(
                    horizontal: t.spaceTight + t.spaceUnit,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Icon(
                        LucideIcons.slidersHorizontal,
                        size: 16,
                        color: facets > 0 ? t.primaryInk : t.ink2,
                      ),
                      SizedBox(width: t.spaceUnit + 2),
                      Text(
                        facets > 0
                            ? 'Filters ${Numerals.integer(facets)}'
                            : 'Filters',
                        style: type.ui.copyWith(
                          color: facets > 0 ? t.primaryInk : t.ink1,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
