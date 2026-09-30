import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../api/models/catalogue.dart';
import '../../../core/ui/async_state_view.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../data/catalogue_providers.dart';
import 'catalogue_chrome.dart';
import 'product_card.dart';

/// One horizontal rail of products, with its own four states.
///
/// A rail is a small enough surface that a failure inside it must NOT take the
/// home screen with it: three rails, three independent [AsyncStateView]s, and a
/// server that has lost its rating index still shows New Arrivals. The
/// alternative — one provider for the whole page — turns any single rail's
/// failure into a blank home screen, which is the most expensive screen in the
/// app to blank.
class ProductRailSection extends ConsumerWidget {
  const ProductRailSection({required this.rail, this.onSeeAll, super.key});

  final ProductRail rail;
  final VoidCallback? onSeeAll;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final AsyncValue<List<ProductCard>> state =
        ref.watch(productRailProvider(rail));

    // Cards in a rail are narrower than in a grid — the point of a rail is that
    // the next one is visibly cut off, so the user knows to push it sideways.
    final double screen = MediaQuery.sizeOf(context).width;
    final double cardWidth = (screen * 0.42).clamp(150.0, 220.0);
    final double railHeight =
        ProductCardTile.estimatedHeight(context, width: cardWidth);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        SectionHeader(
          title: rail.title,
          subtitle: rail.subtitle,
          actionLabel: onSeeAll == null ? null : 'See all',
          onAction: onSeeAll,
        ),
        SizedBox(
          height: railHeight,
          child: AsyncStateView<List<ProductCard>>(
            value: state,
            isEmpty: (List<ProductCard> items) => items.isEmpty,
            data: (BuildContext context, List<ProductCard> items) =>
                ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsetsDirectional.symmetric(
                horizontal: t.spaceStack,
              ),
              itemCount: items.length,
              separatorBuilder: (BuildContext context, int i) =>
                  SizedBox(width: t.spaceTight + t.spaceUnit),
              itemBuilder: (BuildContext context, int index) => SizedBox(
                width: cardWidth,
                child: ProductCardTile(product: items[index]),
              ),
            ),
            empty: (BuildContext context) => _RailNote(
              // Named for THIS rail, not "no products": an empty Top Rated rail
              // on a live catalogue means nobody has reviewed anything yet,
              // which is a different fact from an empty shop.
              text: 'Nothing in ${rail.title.toLowerCase()} yet.',
            ),
            error: (BuildContext context, Object error, StackTrace? stack) =>
                _RailNote(
              text: 'This row could not load.',
              onRetry: () => ref.invalidate(productRailProvider(rail)),
            ),
            loading: (BuildContext context) => ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsetsDirectional.symmetric(
                horizontal: t.spaceStack,
              ),
              itemCount: 3,
              separatorBuilder: (BuildContext context, int i) =>
                  SizedBox(width: t.spaceTight + t.spaceUnit),
              itemBuilder: (BuildContext context, int index) => SizedBox(
                width: cardWidth,
                child: const MeridianSkeleton(
                  shape: MeridianSkeletonShape.grid,
                  itemCount: 1,
                  padding: EdgeInsets.zero,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// A rail's empty and error branches: one quiet line, inline, at the rail's own
/// height. A full-bleed error card here would be louder than the rail it
/// replaced.
class _RailNote extends StatelessWidget {
  const _RailNote({required this.text, this.onRetry});

  final String text;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    return Padding(
      padding: EdgeInsetsDirectional.symmetric(horizontal: t.spaceStack),
      child: Align(
        alignment: AlignmentDirectional.centerStart,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Flexible(
              child: Text(
                text,
                style: context.type.meta.copyWith(color: t.ink3),
              ),
            ),
            if (onRetry != null) ...<Widget>[
              SizedBox(width: t.spaceTight),
              TextButton(onPressed: onRetry, child: const Text('Retry')),
            ],
          ],
        ),
      ),
    );
  }
}
