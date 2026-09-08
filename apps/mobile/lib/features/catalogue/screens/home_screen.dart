import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/routes.dart';
import '../../../core/ui/async_state_view.dart';
import '../../../core/ui/key_button.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../catalogue_context.dart';
import '../data/catalogue_providers.dart';
import '../data/category_tree.dart';
import '../widgets/catalogue_chrome.dart';
import '../widgets/category_strip.dart';
import '../widgets/product_rail.dart';

/// The shop front: the taxonomy strip, then the rails.
///
/// ## Why each rail owns its own async state
///
/// Four providers back this screen — the taxonomy and one per rail — and each
/// renders its own four branches. One provider for the whole page would be
/// simpler to write and strictly worse to use: a server that has lost its
/// rating index would blank the home screen instead of dropping one row out of
/// three, and the home screen is the most expensive screen in the app to blank.
///
/// ## Pull-to-refresh
///
/// Invalidates all four and waits for all four, individually guarded. A single
/// `Future.wait` would surface the first failure and leave the spinner spinning
/// on a screen where three of the four sections had already refreshed fine.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final AsyncValue<CategoryTree> tree = ref.watch(categoryTreeProvider);

    return Scaffold(
      backgroundColor: t.surface0,
      appBar: AppBar(
        title: const Text('Shop'),
        actions: <Widget>[
          IconAction(
            icon: LucideIcons.search,
            // Never mirrors: the magnifier's handle is where it is because most
            // people are right-handed, not because of reading order.
            iconName: 'search',
            label: 'Search the catalogue',
            onPressed: () => GoRouter.of(context).go(Routes.search),
          ),
          SizedBox(width: t.spaceTight),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => _refresh(ref),
        color: t.primary,
        backgroundColor: t.surface2,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: <Widget>[
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsetsDirectional.fromSTEB(
                  t.spaceStack,
                  t.spaceStack,
                  t.spaceStack,
                  0,
                ),
                child: Semantics(
                  header: true,
                  child: Text('Categories', style: type.h3),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsetsDirectional.only(top: t.spaceTight),
                child: AsyncStateView<CategoryTree>(
                  value: tree,
                  isEmpty: (CategoryTree c) => c.roots.isEmpty,
                  data: (BuildContext context, CategoryTree c) => CategoryStrip(
                    categories: c.roots,
                    onTap: (category) => openCategory(context, category.slug),
                  ),
                  empty: (BuildContext context) => const _InlineNote(
                    text: 'No categories have been published yet.',
                  ),
                  error: (BuildContext context, Object e, StackTrace? s) =>
                      _InlineNote(
                    text: 'Categories could not load.',
                    onRetry: () => ref.invalidate(categoryTreeProvider),
                  ),
                  loading: (BuildContext context) =>
                      const _CategoryStripSkeleton(),
                ),
              ),
            ),
            for (final ProductRail rail in ProductRail.values)
              SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsetsDirectional.only(top: t.spaceStack),
                  child: ProductRailSection(
                    rail: rail,
                    // Lands on the search tab with this rail's sort already
                    // applied. `?sort=` rather than a new route: `Routes.search`
                    // is what the web serves and what a share link carries, and
                    // inventing `/browse/rating` here would dead-end every link
                    // minted by the other client.
                    onSeeAll: () => GoRouter.of(context)
                        .go('${Routes.search}?sort=${rail.sort.wire}'),
                  ),
                ),
              ),
            SliverToBoxAdapter(child: SizedBox(height: t.spaceBlock)),
          ],
        ),
      ),
    );
  }

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(categoryTreeProvider);
    for (final ProductRail rail in ProductRail.values) {
      ref.invalidate(productRailProvider(rail));
    }
    // Each awaited on its own and each failure swallowed HERE rather than at
    // the RefreshIndicator: the provider has already stored the error and the
    // section is already rendering it, so rethrowing would only leave the
    // spinner turning over a screen that has finished refreshing.
    Future<void> settle(Future<Object?> future) async {
      try {
        await future;
      } on Object catch (_) {
        // Rendered by the section's own error branch.
      }
    }

    await Future.wait(<Future<void>>[
      settle(ref.read(categoryTreeProvider.future)),
      for (final ProductRail rail in ProductRail.values)
        settle(ref.read(productRailProvider(rail).future)),
    ]);
  }
}

/// A skeleton the shape of the strip — square plates in a row, not a spinner.
class _CategoryStripSkeleton extends StatelessWidget {
  const _CategoryStripSkeleton();

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    return SizedBox(
      height: 140,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsetsDirectional.symmetric(horizontal: t.spaceStack),
        itemCount: 4,
        itemBuilder: (BuildContext context, int index) => Padding(
          padding: EdgeInsetsDirectional.only(end: t.spaceTight + t.spaceUnit),
          child: const SizedBox(
            width: 96,
            child: MeridianSkeleton(
              shape: MeridianSkeletonShape.grid,
              itemCount: 1,
              padding: EdgeInsets.zero,
            ),
          ),
        ),
      ),
    );
  }
}

/// One quiet line for a section that is empty or broken, at the section's own
/// scale. A full-bleed error card in a home-screen slot is louder than the
/// content it replaced.
class _InlineNote extends StatelessWidget {
  const _InlineNote({required this.text, this.onRetry});

  final String text;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    return Padding(
      padding: EdgeInsetsDirectional.symmetric(
        horizontal: t.spaceStack,
        vertical: t.spaceTight,
      ),
      child: Row(
        children: <Widget>[
          Flexible(
            child: Text(
              text,
              style: context.type.meta.copyWith(color: t.ink3),
            ),
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
      ),
    );
  }
}
