import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/enums.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../catalogue_context.dart';
import '../data/product_query.dart';

/// Choose a sort. A bottom sheet, and the one place in this feature that is.
///
/// ## Why this is a sheet and the filter screen is not
///
/// A sort is **one reversible choice out of four**, applied the instant it is
/// tapped and undone by tapping another. There is nothing to confirm, nothing
/// to scroll past, and no state to lose — so the cheapest possible surface is
/// the right one, and a sheet that costs one tap to open and one to answer is
/// cheaper than a page transition.
///
/// The filter screen is the opposite on every count: a dozen facets that
/// exceed a comfortable sheet height, a list that has to scroll inside a sheet
/// that also wants to scroll, and a set of choices that only make sense applied
/// together. See `SearchFilterScreen`.
///
/// Returns the chosen sort, or null if the sheet was dismissed — dismissal is
/// "leave it as it was", never "reset to newest".
Future<ProductSort?> showSortSheet(
  BuildContext context, {
  required ProductSort current,
}) {
  return showModalBottomSheet<ProductSort>(
    context: context,
    useSafeArea: true,
    // The sheet is short and the list inside it does not scroll, so it does not
    // need to be draggable — and a draggable sheet whose content fits is a
    // gesture that does nothing on the first try.
    isScrollControlled: false,
    builder: (BuildContext context) => _SortSheet(current: current),
  );
}

class _SortSheet extends StatelessWidget {
  const _SortSheet({required this.current});

  final ProductSort current;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsetsDirectional.only(bottom: t.spaceStack),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            // The grabber. Centred and symmetric, so it needs no mirroring.
            Padding(
              padding: EdgeInsetsDirectional.only(top: t.spaceTight),
              child: Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: t.border,
                    borderRadius: BorderRadius.circular(t.radiusPill),
                  ),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsetsDirectional.fromSTEB(
                t.spaceStack,
                t.spaceStack,
                t.spaceStack,
                t.spaceTight,
              ),
              child: Semantics(
                header: true,
                child: Text('Sort by', style: type.h3),
              ),
            ),
            for (final ProductSort sort in ProductSort.values)
              _SortOption(
                sort: sort,
                selected: sort == current,
                onTap: () => Navigator.of(context).pop(sort),
              ),
            Padding(
              padding: EdgeInsetsDirectional.fromSTEB(
                t.spaceStack,
                t.spaceTight,
                t.spaceStack,
                0,
              ),
              child: Text(
                // Said out loud because its absence is otherwise read as a bug.
                // `ProductSort` genuinely has no price option: the catalogue
                // resolves a price per channel AND per currency, so there is no
                // single column to order by.
                'Sorting by price is not available: prices are resolved per '
                'channel and per currency, so the catalogue has no single '
                'price to order by.',
                style: type.micro.copyWith(color: t.ink3),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SortOption extends StatelessWidget {
  const _SortOption({
    required this.sort,
    required this.selected,
    required this.onTap,
  });

  final ProductSort sort;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return Semantics(
      inMutuallyExclusiveGroup: true,
      selected: selected,
      button: true,
      label: '${sort.label}. ${sort.explanation}',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        splashFactory: NoSplash.splashFactory,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: kMinTouchTarget),
          child: Padding(
            padding: EdgeInsetsDirectional.symmetric(
              horizontal: t.spaceStack,
              vertical: t.spaceTight + t.spaceUnit,
            ),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Text(
                        sort.label,
                        style: type.body.copyWith(
                          color: selected ? t.primaryInk : t.ink1,
                        ),
                      ),
                      SizedBox(height: t.spaceUnit / 2),
                      Text(
                        sort.explanation,
                        style: type.meta.copyWith(color: t.ink3),
                      ),
                    ],
                  ),
                ),
                if (selected)
                  // A checkmark never mirrors — it is a mark, not an arrow.
                  Icon(LucideIcons.check, size: 18, color: t.primaryInk),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The button that opens the sheet, with the current sort written on it.
///
/// The label carries the CHOICE, not the word "Sort": a control that says
/// "Sort" tells the user there is a sort, which they knew; one that says
/// "Newest first" tells them what they are looking at.
class SortButton extends StatelessWidget {
  const SortButton({required this.sort, required this.onChanged, super.key});

  final ProductSort sort;
  final ValueChanged<ProductSort> onChanged;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return Semantics(
      button: true,
      label: 'Sort by, currently ${sort.label}',
      excludeSemantics: true,
      child: InkWell(
        onTap: () async {
          final ProductSort? picked =
              await showSortSheet(context, current: sort);
          if (picked != null && picked != sort) onChanged(picked);
        },
        borderRadius: BorderRadius.circular(t.radiusPill),
        splashFactory: NoSplash.splashFactory,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: kMinTouchTarget),
          child: Padding(
            padding: EdgeInsetsDirectional.symmetric(
              horizontal: t.spaceTight + t.spaceUnit,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                // `arrow-up-down` is vertical: nothing about it reverses in an
                // RTL layout, so it is not on the mirrored list.
                Icon(LucideIcons.arrowUpDown, size: 16, color: t.ink2),
                SizedBox(width: t.spaceUnit + 2),
                Flexible(
                  child: Text(
                    sort.label,
                    style: type.ui.copyWith(color: t.ink1),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
