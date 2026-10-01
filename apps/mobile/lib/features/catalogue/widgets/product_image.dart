import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/common.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';

/// Paints a remote image into a box the caller has already sized.
///
/// A seam, and one worth the indirection: [CachedNetworkImage] opens a socket
/// and reaches for `path_provider` through `flutter_cache_manager`, neither of
/// which exists in a widget test. Left alone, every golden of a product card
/// would be a race between the rasteriser and a failed DNS lookup — which is
/// the definition of a flaky golden.
///
/// Overriding [remoteImageBuilderProvider] in a test swaps the whole loader for
/// something deterministic. Production never overrides it.
typedef RemoteImageBuilder = Widget Function(
  BuildContext context,
  ImageRef image,
  BoxFit fit,
  Widget placeholder,
  Widget error,
);

/// The shipping loader: `cached_network_image`, with the design system's plate
/// as its placeholder and its error state.
Widget cachedNetworkRemoteImage(
  BuildContext context,
  ImageRef image,
  BoxFit fit,
  Widget placeholder,
  Widget error,
) {
  return CachedNetworkImage(
    imageUrl: image.url,
    fit: fit,
    // The intrinsic size is on the wire precisely so the box can be reserved
    // before the bytes land. Handing it to the decoder as well keeps a 4000px
    // seller upload from being decoded at full resolution into a 180px card.
    memCacheWidth: image.width,
    // No fade. A cross-fade on a grid of twelve cards is twelve simultaneous
    // opacity animations over decoded bitmaps, and it arrives exactly when the
    // user has started scrolling.
    fadeInDuration: Duration.zero,
    fadeOutDuration: Duration.zero,
    placeholder: (BuildContext context, String url) => placeholder,
    errorWidget: (BuildContext context, String url, Object err) => error,
  );
}

final Provider<RemoteImageBuilder> remoteImageBuilderProvider =
    Provider<RemoteImageBuilder>((Ref ref) => cachedNetworkRemoteImage);

/// A product photograph on its plate.
///
/// Three states, all designed rather than defaulted:
///
///  * **loading** — the sunken plate with a centred glyph. Not a spinner and
///    not a shimmer: a grid of twelve shimmering rectangles is twelve
///    animations competing with the scroll, and a shimmer that outlasts the
///    fetch is a broken image that looks busy.
///  * **no image at all** (`image == null`) — the same plate. A seller who has
///    not uploaded a photograph is a real catalogue state, and it should look
///    identical to the moment before a photograph arrives, because to the user
///    it is the same thing: no picture yet.
///  * **failed** — the plate, a struck-through image glyph, and **the product
///    name in `meta`**. This is the one that has to read as deliberate. A bare
///    grey square says the app is broken; a grey square with the product's name
///    in it says the picture is missing and the product is not.
class ProductImage extends ConsumerWidget {
  const ProductImage({
    required this.image,
    required this.productName,
    this.fit = BoxFit.cover,
    this.radius,
    super.key,
  });

  final ImageRef? image;

  /// Shown on the plate when the fetch fails, and used as the semantic label
  /// when the seller supplied no alt text.
  final String productName;

  final BoxFit fit;
  final double? radius;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final double r = radius ?? t.radius;
    final ImageRef? ref0 = image;

    final Widget content = ref0 == null
        ? _Plate(icon: LucideIcons.image, radius: r)
        : ref.watch(remoteImageBuilderProvider)(
            context,
            ref0,
            fit,
            _Plate(icon: LucideIcons.image, radius: r),
            _FailedPlate(productName: productName, radius: r),
          );

    return Semantics(
      image: true,
      // Alt text from the seller when there is any; the product name otherwise.
      // An unlabelled product photograph is a card a screen reader announces as
      // a price with no subject.
      label: ref0?.alt ?? productName,
      excludeSemantics: true,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(r),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: t.imgPlate,
            borderRadius: BorderRadius.circular(r),
          ),
          child: Center(
            // `--img-inset` from the design system, applied as a FRACTION of
            // the box rather than as a fixed pad: the same token has to look
            // right on a 160px card and on a 390px gallery, and 9% of each is
            // the only reading of it that does. The photograph never runs to
            // the plate's edge, so a white product on a white ground still
            // reads as an object sitting on something.
            child: FractionallySizedBox(
              widthFactor: 1.0 - t.imgInset,
              heightFactor: 1.0 - t.imgInset,
              child: content,
            ),
          ),
        ),
      ),
    );
  }
}

/// The plate: the sunken fill and one centred glyph. Used for both "loading"
/// and "no photograph", because those look the same to the person waiting.
class _Plate extends StatelessWidget {
  const _Plate({required this.icon, required this.radius});

  final IconData icon;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: t.imgPlate,
        borderRadius: BorderRadius.circular(radius),
      ),
      child: Center(
        // `image` is on the never-mirrored list — it depicts an object.
        child: Icon(icon, size: 22, color: t.ink3.withValues(alpha: 0.55)),
      ),
    );
  }
}

/// The failed-fetch plate. Glyph plus the product name, in `meta`.
class _FailedPlate extends StatelessWidget {
  const _FailedPlate({required this.productName, required this.radius});

  final String productName;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: t.imgPlate,
        borderRadius: BorderRadius.circular(radius),
      ),
      child: Padding(
        padding: EdgeInsetsDirectional.all(t.spaceTight),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: <Widget>[
            Icon(
              LucideIcons.imageOff,
              size: 20,
              color: t.ink3.withValues(alpha: 0.55),
            ),
            SizedBox(height: t.spaceTight),
            Text(
              productName,
              style: type.meta.copyWith(color: t.ink2),
              textAlign: TextAlign.center,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
