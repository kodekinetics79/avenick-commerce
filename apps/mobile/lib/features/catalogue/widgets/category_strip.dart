import 'package:flutter/material.dart';

import '../../../api/models/catalogue.dart';
import '../../../core/l10n/numerals.dart';
import '../../../theme/elevation.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../catalogue_context.dart';
import 'product_image.dart';

/// The horizontal taxonomy strip at the top of the home screen.
///
/// Each tile carries the category's own image, its name, and **its product
/// count**. The count is the only number the taxonomy endpoint gives away and
/// it is worth showing: it is the difference between a shelf and a sign, and it
/// tells a buyer which branch of the tree is worth opening before they open it.
///
/// A category with zero products is still drawn, dimmed and non-tappable, with
/// its `0`. Hiding it would make the strip's contents change between visits for
/// a reason the user cannot see, and "the app lost a category" is a support
/// ticket where "that shelf is empty" is not.
class CategoryStrip extends StatelessWidget {
  const CategoryStrip({
    required this.categories,
    this.selectedSlug,
    this.onTap,
    super.key,
  });

  final List<Category> categories;
  final String? selectedSlug;
  final void Function(Category category)? onTap;

  static const double _tileWidth = 96;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final TextScaler scaler = MediaQuery.textScalerOf(context);

    // The strip's height tracks dynamic type: the image is fixed, the two text
    // lines are not, and a fixed 140 here is a clipped label at 200%.
    final double labelBlock =
        scaler.scale(type.micro.fontSize!) * (type.micro.height ?? 1.0) * 2 +
            t.spaceUnit * 3;
    final double height = _tileWidth + labelBlock;

    return SizedBox(
      height: height,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsetsDirectional.symmetric(horizontal: t.spaceStack),
        itemCount: categories.length,
        separatorBuilder: (BuildContext context, int i) =>
            SizedBox(width: t.spaceTight + t.spaceUnit),
        itemBuilder: (BuildContext context, int index) {
          final Category category = categories[index];
          return _CategoryTile(
            category: category,
            width: _tileWidth,
            selected: category.slug == selectedSlug,
            onTap: onTap,
          );
        },
      ),
    );
  }
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile({
    required this.category,
    required this.width,
    required this.selected,
    required this.onTap,
  });

  final Category category;
  final double width;
  final bool selected;
  final void Function(Category category)? onTap;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final String name = category.name(languageOf(context));
    final bool empty = category.productCount == 0;
    final String count = Numerals.integer(category.productCount);

    return Semantics(
      button: !empty,
      enabled: !empty,
      selected: selected,
      label: empty
          ? '$name, no products'
          : '$name, $count ${category.productCount == 1 ? 'product' : 'products'}',
      excludeSemantics: true,
      child: Opacity(
        // Dimmed, not hidden. See the class doc.
        opacity: empty ? 0.45 : 1.0,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: empty || onTap == null ? null : () => onTap!(category),
          child: SizedBox(
            width: width,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                SizedBox(
                  width: width,
                  height: width,
                  child: MeridianSurface(
                    rung: MeridianRung.card,
                    radius: t.radius,
                    clipContent: true,
                    fill: selected ? t.primarySoft : null,
                    child: ProductImage(
                      image: category.image,
                      productName: name,
                      radius: t.radius,
                    ),
                  ),
                ),
                SizedBox(height: t.spaceUnit + 2),
                Text(
                  name,
                  style: type.micro.copyWith(
                    color: selected ? t.primaryInk : t.ink1,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  count,
                  style: type.micro.copyWith(color: t.ink3),
                  maxLines: 1,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
