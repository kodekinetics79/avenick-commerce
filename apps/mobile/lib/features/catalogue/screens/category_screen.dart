import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/catalogue.dart';
import '../../../api/models/enums.dart';
import '../../../core/l10n/numerals.dart';
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
import '../widgets/product_grid.dart';
import '../widgets/sort_sheet.dart';

/// One node of the taxonomy: its children, then its products.
///
/// ## Two independent loads, on purpose
///
/// The subcategory row comes from the taxonomy; the grid comes from
/// `GET /v1/products?categorySlug=`. They are separate providers and the grid
/// does NOT wait for the tree, because the grid already has everything it needs
/// — the slug came in on the route. Chaining them would mean a product grid
/// that cannot start until an unrelated request finishes, and a taxonomy
/// failure that empties a shelf full of products.
///
/// The consequence is visible and deliberate: on a cold open the products can
/// land before the breadcrumb does.
class CategoryScreen extends ConsumerStatefulWidget {
  const CategoryScreen({required this.slug, super.key});

  /// The taxonomy node's slug, from `/categories/:slug`. Slug rather than id,
  /// matching the web route, so a shared link resolves without a lookup.
  final String slug;

  @override
  ConsumerState<CategoryScreen> createState() => _CategoryScreenState();
}

class _CategoryScreenState extends ConsumerState<CategoryScreen> {
  ProductSort _sort = ProductSort.newest;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final AsyncValue<CategoryTree> tree = ref.watch(categoryTreeProvider);
    final Category? node = tree.value?.bySlug(widget.slug);
    final List<Category> children =
        node == null ? const <Category>[] : tree.value!.childrenOf(node.id);

    final ProductQuery query = ref.watch(baseQueryProvider).copyWith(
          categorySlug: widget.slug,
          sort: _sort,
        );

    return Scaffold(
      backgroundColor: t.surface0,
      appBar: AppBar(
        leading: const CatalogueBackButton(),
        title: Text(
          // The slug is a readable fallback while the taxonomy is in flight —
          // better than an empty bar, and it is what the URL says anyway.
          node?.name(languageOf(context)) ?? _humanise(widget.slug),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
      body: PagedProductGrid(
        query: query,
        emptyTitle: 'Nothing in this category yet',
        emptyBody: node == null
            ? 'No products are listed here at the moment.'
            : 'No products are listed under '
                '${node.name(languageOf(context))} at the moment. The '
                'subcategories above may have stock.',
        emptyAction: children.isEmpty
            ? null
            : KeyButton(
                label: 'Browse ${children.first.name(languageOf(context))}',
                tone: KeyButtonTone.accent,
                onPressed: () => openCategory(context, children.first.slug),
              ),
        leadingSlivers: <Widget>[
          if (children.isNotEmpty)
            SliverToBoxAdapter(
              child: _SubcategoryRow(children: children),
            ),
          SliverToBoxAdapter(
            child: _CategoryToolbar(
              node: node,
              sort: _sort,
              onSortChanged: (ProductSort next) => setState(() => _sort = next),
            ),
          ),
        ],
      ),
    );
  }

  /// `power-tools` → `Power tools`. Only ever seen for the handful of frames
  /// before the taxonomy lands, or on a deep link into a node this build's
  /// taxonomy does not have.
  static String _humanise(String slug) {
    final String spaced = slug.replaceAll('-', ' ');
    if (spaced.isEmpty) return spaced;
    return spaced[0].toUpperCase() + spaced.substring(1);
  }
}

/// The children of this node, as a horizontal chip row.
///
/// Chips rather than a second grid: the subcategories are navigation, and
/// giving them cards would make them compete with the products for the same
/// read. A node with zero products is still shown — dimmed, with its count —
/// for the same reason the home strip does it.
class _SubcategoryRow extends StatelessWidget {
  const _SubcategoryRow({required this.children});

  final List<Category> children;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return Padding(
      padding: EdgeInsetsDirectional.only(top: t.spaceTight),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Padding(
            padding: EdgeInsetsDirectional.fromSTEB(
              t.spaceStack,
              0,
              t.spaceStack,
              t.spaceTight,
            ),
            child: Semantics(
              header: true,
              child: Text(
                'Subcategories',
                style: type.ui.copyWith(color: t.ink2),
              ),
            ),
          ),
          SizedBox(
            height: kMinTouchTarget,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsetsDirectional.symmetric(
                horizontal: t.spaceStack,
              ),
              itemCount: children.length,
              separatorBuilder: (BuildContext context, int i) =>
                  SizedBox(width: t.spaceTight),
              itemBuilder: (BuildContext context, int index) {
                final Category child = children[index];
                final bool empty = child.productCount == 0;
                final String name = child.name(languageOf(context));
                return Semantics(
                  button: !empty,
                  enabled: !empty,
                  label: empty
                      ? '$name, no products'
                      : '$name, ${Numerals.integer(child.productCount)} products',
                  excludeSemantics: true,
                  child: Opacity(
                    opacity: empty ? 0.45 : 1.0,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: empty
                          ? null
                          : () => openCategory(context, child.slug),
                      child: MeridianSurface(
                        rung: MeridianRung.card,
                        radius: t.radiusPill,
                        padding: EdgeInsetsDirectional.symmetric(
                          horizontal: t.spaceTight + t.spaceUnit,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: <Widget>[
                            Text(
                              name,
                              style: type.ui.copyWith(color: t.ink1),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            SizedBox(width: t.spaceUnit + 2),
                            Text(
                              Numerals.integer(child.productCount),
                              style: type.micro.copyWith(color: t.ink3),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// The bar above the grid: how many products this shelf claims to hold, and
/// the sort.
///
/// The figure is `Category.productCount` from the taxonomy — a real count from
/// the contract, and the ONLY count the catalogue surface exposes. It is the
/// shelf's total, not the current page's, which is what a buyer means by "how
/// much is in here".
class _CategoryToolbar extends StatelessWidget {
  const _CategoryToolbar({
    required this.node,
    required this.sort,
    required this.onSortChanged,
  });

  final Category? node;
  final ProductSort sort;
  final ValueChanged<ProductSort> onSortChanged;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final Category? c = node;

    return Padding(
      padding: EdgeInsetsDirectional.fromSTEB(
        t.spaceStack,
        t.spaceStack,
        t.spaceTight,
        t.spaceTight,
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: c == null
                ? const SizedBox.shrink()
                : Row(
                    children: <Widget>[
                      Icon(LucideIcons.boxes, size: 16, color: t.ink3),
                      SizedBox(width: t.spaceUnit + 2),
                      Flexible(
                        child: Text(
                          '${Numerals.integer(c.productCount)} '
                          '${c.productCount == 1 ? 'product' : 'products'}',
                          style: type.meta.copyWith(color: t.ink2),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
          ),
          SortButton(sort: sort, onChanged: onSortChanged),
        ],
      ),
    );
  }
}
