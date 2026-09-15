import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/catalogue.dart';
import '../../../core/l10n/numerals.dart';
import '../../../core/ui/async_state_view.dart';
import '../../../core/ui/key_button.dart';
import '../../../theme/elevation.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../catalogue_context.dart';
import '../data/catalogue_providers.dart';
import '../data/category_tree.dart';
import '../data/product_query.dart';
import '../widgets/catalogue_chrome.dart';

/// The facet screen. A **full page**, not a bottom sheet.
///
/// ## Why a page
///
/// Three reasons, in the order they bite.
///
/// 1. **Height.** The GCC B2B facet set — taxonomy, brand, availability,
///    rating, minimum order quantity — does not fit in a comfortable sheet.
///    A sheet that has to be dragged to full height before it can be used is a
///    page with an extra gesture in front of it.
/// 2. **Two scroll axes.** A tall sheet scrolls its own content AND wants to be
///    dragged down to dismiss. Those two gestures share one finger and one
///    direction, so a flick near the top of a facet list either scrolls when
///    the user meant to dismiss or dismisses when they meant to scroll. On a
///    page the list owns the axis outright.
/// 3. **The result count needs a permanent home.** "Show N results" has to be
///    visible while every facet is being touched, and a sheet's action area
///    moves as the sheet resizes.
///
/// The SORT is a sheet, and correctly so — one reversible choice, four options,
/// nothing to confirm. See `showSortSheet`.
///
/// ## Zero-result facets are shown, disabled, with their count
///
/// Never hidden. A facet that disappears between two visits reads as a bug in
/// the app, and the user has no way to tell that from an empty shelf. Dimmed
/// with a `0` beside it says exactly what is true.
///
/// ## What the contract cannot do here
///
/// * **Counts are per-facet totals, not intersections.** `Category.productCount`
///   and `Brand.productCount` are the only counts the catalogue exposes, and
///   they are whole-catalogue figures. There is no facet-count endpoint, so a
///   count that reflected the other four active filters cannot be computed
///   without one request per facet. The section notes say so on screen rather
///   than implying a precision that is not there.
/// * **Availability, rating and MOQ carry no count at all** for the same
///   reason — nothing on the wire counts them.
/// * **Every facet is single-select.** `GET /v1/products` takes ONE
///   `categorySlug` and ONE `brandSlug`, not arrays. Two brands at once is not
///   a UI decision this screen gets to make.
///
/// Pops with the edited [ProductQuery], or with null if the user backed out —
/// which means "leave the filters as they were", never "clear them".
class SearchFilterScreen extends ConsumerStatefulWidget {
  const SearchFilterScreen({required this.initial, super.key});

  final ProductQuery initial;

  @override
  ConsumerState<SearchFilterScreen> createState() => _SearchFilterScreenState();
}

class _SearchFilterScreenState extends ConsumerState<SearchFilterScreen> {
  late ProductQuery _draft = widget.initial;

  /// The rating floors offered. Not a slider: a slider over 1.0–5.0 implies a
  /// precision buyers do not have an opinion about, and "3.7 stars and up" is
  /// not a thought anybody has.
  static const List<double> _ratingFloors = <double>[4.0, 3.0, 2.0];

  /// Minimum-order ceilings. These are the B2B question — "what can I buy in a
  /// small lot" — and they are the reason `moqMax` is surfaced and `moqMin` is
  /// not.
  static const List<int> _moqCeilings = <int>[1, 10, 50, 100];

  void _update(ProductQuery next) => setState(() => _draft = next);

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final AsyncValue<CategoryTree> tree = ref.watch(categoryTreeProvider);
    final AsyncValue<List<Brand>> brands = ref.watch(brandFacetsProvider);

    return Scaffold(
      backgroundColor: t.surface0,
      appBar: AppBar(
        leading: const CatalogueBackButton(),
        title: const Text('Filters'),
        actions: <Widget>[
          TextButton(
            // Resets the FACETS only. The search term and the sort survive —
            // clearing a word the user typed because they asked to clear
            // filters is the kind of helpfulness that loses work.
            onPressed:
                _draft.hasFacets ? () => _update(_draft.withoutFacets) : null,
            child: const Text('Reset'),
          ),
          SizedBox(width: t.spaceTight),
        ],
      ),
      body: ListView(
        padding: EdgeInsetsDirectional.only(bottom: t.spaceBlock),
        children: <Widget>[
          _FacetSection(
            title: 'Category',
            note: 'Counts are the category total across the whole catalogue.',
            child: AsyncStateView<CategoryTree>(
              value: tree,
              isEmpty: (CategoryTree c) => c.facetCandidates().isEmpty,
              data: (BuildContext context, CategoryTree c) => _FacetWrap(
                children: <Widget>[
                  _FacetChip(
                    label: 'Any category',
                    selected: _draft.categorySlug == null,
                    onTap: () => _update(_draft.copyWith(categorySlug: null)),
                  ),
                  for (final Category category in c.facetCandidates())
                    _FacetChip(
                      label: category.name(languageOf(context)),
                      count: category.productCount,
                      selected: _draft.categorySlug == category.slug,
                      onTap: () => _update(
                        _draft.copyWith(categorySlug: category.slug),
                      ),
                    ),
                ],
              ),
              empty: (BuildContext context) =>
                  const _FacetNote(text: 'No categories are published yet.'),
              error: (BuildContext context, Object e, StackTrace? s) =>
                  _FacetNote(
                text: 'Categories could not load.',
                onRetry: () => ref.invalidate(categoryTreeProvider),
              ),
              loading: (BuildContext context) => const _FacetSkeleton(),
            ),
          ),
          _FacetSection(
            title: 'Brand',
            note: 'One brand at a time — the catalogue endpoint takes a single '
                'brand, not a list.',
            child: AsyncStateView<List<Brand>>(
              value: brands,
              isEmpty: (List<Brand> b) => b.isEmpty,
              data: (BuildContext context, List<Brand> b) => _FacetWrap(
                children: <Widget>[
                  _FacetChip(
                    label: 'Any brand',
                    selected: _draft.brandSlug == null,
                    onTap: () => _update(_draft.copyWith(brandSlug: null)),
                  ),
                  for (final Brand brand in b)
                    _FacetChip(
                      label: brand.name(languageOf(context)),
                      count: brand.productCount,
                      selected: _draft.brandSlug == brand.slug,
                      onTap: () =>
                          _update(_draft.copyWith(brandSlug: brand.slug)),
                    ),
                ],
              ),
              empty: (BuildContext context) =>
                  const _FacetNote(text: 'No brands are published yet.'),
              error: (BuildContext context, Object e, StackTrace? s) =>
                  _FacetNote(
                text: 'Brands could not load.',
                onRetry: () => ref.invalidate(brandFacetsProvider),
              ),
              loading: (BuildContext context) => const _FacetSkeleton(),
            ),
          ),
          _FacetSection(
            title: 'Availability',
            child: _SwitchRow(
              label: 'In stock only',
              // The third availability state is why this sentence exists.
              // UNCONFIRMED is not out-of-stock, and a buyer ticking this box
              // is choosing to hide it too.
              helper: 'Hides items whose stock the seller has not confirmed.',
              value: _draft.inStockOnly,
              onChanged: (bool value) =>
                  _update(_draft.copyWith(inStockOnly: value)),
            ),
          ),
          _FacetSection(
            title: 'Customer rating',
            child: _FacetWrap(
              children: <Widget>[
                _FacetChip(
                  label: 'Any rating',
                  selected: _draft.minRating == null,
                  onTap: () => _update(_draft.copyWith(minRating: null)),
                ),
                for (final double floor in _ratingFloors)
                  _FacetChip(
                    label:
                        '${Numerals.decimal(floor, fractionDigits: 0)}★ & up',
                    selected: _draft.minRating == floor,
                    onTap: () => _update(_draft.copyWith(minRating: floor)),
                  ),
              ],
            ),
          ),
          _FacetSection(
            title: 'Minimum order quantity',
            note: 'The largest first order you are willing to place.',
            child: _FacetWrap(
              children: <Widget>[
                _FacetChip(
                  label: 'Any quantity',
                  selected: _draft.moqMax == null,
                  onTap: () => _update(_draft.copyWith(moqMax: null)),
                ),
                for (final int ceiling in _moqCeilings)
                  _FacetChip(
                    label: ceiling == 1
                        ? 'Single units'
                        : '${Numerals.quantity(ceiling)} or fewer',
                    selected: _draft.moqMax == ceiling,
                    onTap: () => _update(_draft.copyWith(moqMax: ceiling)),
                  ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: _ApplyBar(
        draft: _draft,
        onApply: () => Navigator.of(context).pop(_draft),
      ),
    );
  }
}

/// The live "Show N results" bar.
///
/// N is a **bounded probe**, not a count. `PageMeta` is `{cursor, hasMore}` and
/// carries no total — `envelope.ts` refuses to run an unbounded `count()`
/// beside every page query on the pool checkout transactions share. So this
/// asks for [kResultProbeLimit] rows and reports what came back: an exact
/// figure below the cap, and `60+` above it. That is honest. A number invented
/// to look like a count would not be, and nothing on screen would say which one
/// the user was reading.
class _ApplyBar extends ConsumerWidget {
  const _ApplyBar({required this.draft, required this.onApply});

  final ProductQuery draft;
  final VoidCallback onApply;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final AsyncValue<ResultCount> count = ref.watch(resultCountProvider(draft));

    final String label = count.when(
      skipLoadingOnRefresh: true,
      skipLoadingOnReload: true,
      // While the probe is in flight the button still applies — it just cannot
      // promise a figure yet. A disabled Apply button is a filter screen the
      // user cannot leave.
      loading: () => 'Show results',
      error: (Object e, StackTrace s) => 'Show results',
      data: (ResultCount c) {
        if (c.isZero) return 'No matching products';
        final String n = Numerals.integer(c.count);
        return c.isAtLeast
            ? 'Show $n+ results'
            : 'Show $n ${c.count == 1 ? 'result' : 'results'}';
      },
    );

    return DecoratedBox(
      decoration: BoxDecoration(
        // Opaque, like the tab bar and for the same reason: this bar carries a
        // number, and a number in chrome must be exactly as readable over a
        // dense facet list as over an empty one.
        color: t.surface2,
        border: Border(top: BorderSide(color: t.hairline)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsetsDirectional.all(t.spaceStack),
          child: KeyButton(
            label: label,
            expand: true,
            size: KeyButtonSize.large,
            // Never disabled on a zero count. "No matching products" applies
            // the filter and lands on the empty state, which is where the
            // broaden-your-search options live — the one screen that can
            // actually help.
            onPressed: onApply,
          ),
        ),
      ),
    );
  }
}

/// A titled block of facets, with an optional honesty note under the title.
class _FacetSection extends StatelessWidget {
  const _FacetSection({required this.title, required this.child, this.note});

  final String title;
  final String? note;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return Padding(
      padding: EdgeInsetsDirectional.fromSTEB(
        t.spaceStack,
        t.spaceStack,
        t.spaceStack,
        0,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Semantics(header: true, child: Text(title, style: type.h3)),
          if (note != null) ...<Widget>[
            SizedBox(height: t.spaceUnit),
            Text(note!, style: type.micro.copyWith(color: t.ink3)),
          ],
          SizedBox(height: t.spaceTight + t.spaceUnit),
          child,
          const SectionRule(),
        ],
      ),
    );
  }
}

class _FacetWrap extends StatelessWidget {
  const _FacetWrap({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    return Wrap(
      spacing: t.spaceTight,
      runSpacing: t.spaceTight,
      children: children,
    );
  }
}

/// One facet value.
///
/// A count of zero does not hide it and does not remove the number: the chip is
/// dimmed, its tap is dropped, and it still reads "Valves 0". That is a shelf
/// the buyer can see is empty, which is information; a missing chip is not.
class _FacetChip extends StatelessWidget {
  const _FacetChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.count,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  /// Null where the contract offers no count — availability, rating, MOQ. A
  /// chip with no number is not the same as a chip with a zero, and neither is
  /// invented from the other.
  final int? count;

  bool get _disabled => count == 0;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    final String semantics = <String>[
      label,
      if (count != null) '${Numerals.integer(count!)} products',
      if (_disabled) 'unavailable',
    ].join(', ');

    return Semantics(
      button: !_disabled,
      enabled: !_disabled,
      selected: selected,
      inMutuallyExclusiveGroup: true,
      label: semantics,
      excludeSemantics: true,
      child: Opacity(
        opacity: _disabled ? 0.45 : 1.0,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: _disabled ? null : onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: kMinTouchTarget),
            child: MeridianSurface(
              rung: MeridianRung.card,
              radius: t.radiusPill,
              fill: selected ? t.primarySoft : null,
              padding: EdgeInsetsDirectional.symmetric(
                horizontal: t.spaceTight + t.spaceUnit,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  if (selected) ...<Widget>[
                    // Selection is stated by the tick AND the fill, never by
                    // the fill alone.
                    Icon(LucideIcons.check, size: 14, color: t.primaryInk),
                    SizedBox(width: t.spaceUnit + 2),
                  ],
                  Text(
                    label,
                    style: type.ui.copyWith(
                      color: selected ? t.primaryInk : t.ink1,
                    ),
                  ),
                  if (count != null) ...<Widget>[
                    SizedBox(width: t.spaceUnit + 2),
                    Text(
                      Numerals.integer(count!),
                      style: type.micro.copyWith(color: t.ink3),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SwitchRow extends StatelessWidget {
  const _SwitchRow({
    required this.label,
    required this.value,
    required this.onChanged,
    this.helper,
  });

  final String label;
  final String? helper;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return Semantics(
      toggled: value,
      label: helper == null ? label : '$label. $helper',
      excludeSemantics: true,
      child: InkWell(
        onTap: () => onChanged(!value),
        splashFactory: NoSplash.splashFactory,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: kMinTouchTarget),
          child: Row(
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Text(label, style: type.body),
                    if (helper != null) ...<Widget>[
                      SizedBox(height: t.spaceUnit / 2),
                      Text(
                        helper!,
                        style: type.meta.copyWith(color: t.ink3),
                      ),
                    ],
                  ],
                ),
              ),
              Switch(
                value: value,
                onChanged: onChanged,
                activeThumbColor: t.primaryForeground,
                activeTrackColor: t.primary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FacetNote extends StatelessWidget {
  const _FacetNote({required this.text, this.onRetry});

  final String text;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    return Row(
      children: <Widget>[
        Flexible(
          child: Text(text, style: context.type.meta.copyWith(color: t.ink3)),
        ),
        if (onRetry != null) ...<Widget>[
          SizedBox(width: t.spaceTight),
          BoundedAction(
            maxWidth: 96,
            child: KeyButton(
              label: 'Retry',
              tone: KeyButtonTone.ghost,
              size: KeyButtonSize.small,
              expand: true,
              onPressed: onRetry,
            ),
          ),
        ],
      ],
    );
  }
}

class _FacetSkeleton extends StatelessWidget {
  const _FacetSkeleton();

  @override
  Widget build(BuildContext context) => const MeridianSkeleton(
        shape: MeridianSkeletonShape.text,
        padding: EdgeInsets.zero,
      );
}
