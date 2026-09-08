import 'package:flutter/material.dart';

import '../../../api/models/common.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../core/l10n/numerals.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import 'product_image.dart';

/// The product page's image gallery.
///
/// A [PageView] rather than a horizontal list: on a product page the image is
/// the subject, and a paged swipe with a position indicator answers "how many
/// pictures are there" without the user having to scroll to find out.
///
/// It needs no mirroring work of its own. [PageView] derives its axis direction
/// from the ambient [Directionality], so in Arabic the first image is on the
/// right and the swipe runs the other way — and the dot row, being an ordinary
/// [Row], reverses with it. The COUNTER does not reverse: "1 / 5" is a figure,
/// and it is forced LTR for the same reason every other figure in this feature
/// is.
class ProductGallery extends StatefulWidget {
  const ProductGallery({
    required this.images,
    required this.productName,
    super.key,
  });

  final List<ImageRef> images;
  final String productName;

  @override
  State<ProductGallery> createState() => _ProductGalleryState();
}

class _ProductGalleryState extends State<ProductGallery> {
  final PageController _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final int count = widget.images.length;

    if (count == 0) {
      // No photographs is a real catalogue state. The plate on its own, at the
      // gallery's size — not an error, not a blank.
      return AspectRatio(
        aspectRatio: t.imgRatioCard,
        child: ProductImage(
          image: null,
          productName: widget.productName,
          radius: 0,
        ),
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Stack(
          children: <Widget>[
            AspectRatio(
              aspectRatio: t.imgRatioCard,
              child: PageView.builder(
                controller: _controller,
                itemCount: count,
                onPageChanged: (int i) => setState(() => _index = i),
                itemBuilder: (BuildContext context, int i) => ProductImage(
                  image: widget.images[i],
                  productName: widget.productName,
                  fit: BoxFit.contain,
                  radius: 0,
                ),
              ),
            ),
            if (count > 1)
              PositionedDirectional(
                end: t.spaceStack,
                top: t.spaceStack,
                child: Semantics(
                  label: 'Image ${_index + 1} of $count',
                  liveRegion: true,
                  excludeSemantics: true,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: t.ink1.withValues(alpha: 0.72),
                      borderRadius: BorderRadius.circular(t.radiusPill),
                    ),
                    child: Padding(
                      padding: EdgeInsetsDirectional.symmetric(
                        horizontal: t.spaceTight,
                        vertical: t.spaceUnit / 2,
                      ),
                      child: Text(
                        Bidi.ltr(
                          '${Numerals.integer(_index + 1)} / '
                          '${Numerals.integer(count)}',
                        ),
                        style: type.micro.copyWith(color: t.inkInv),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
        if (count > 1) ...<Widget>[
          SizedBox(height: t.spaceTight),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              for (int i = 0; i < count; i++)
                Padding(
                  padding: EdgeInsetsDirectional.symmetric(
                    horizontal: t.spaceUnit / 2,
                  ),
                  child: AnimatedContainer(
                    duration: context.motion.hover,
                    curve: context.motion.standard,
                    width: i == _index ? 18 : 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: i == _index ? t.primary : t.border,
                      borderRadius: BorderRadius.circular(t.radiusPill),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }
}
