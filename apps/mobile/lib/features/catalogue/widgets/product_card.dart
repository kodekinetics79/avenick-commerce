import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/catalogue.dart';
import '../../../api/models/enums.dart';
import '../../../api/models/money.dart';
import '../../../core/l10n/numerals.dart';
import '../../../theme/elevation.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../catalogue_context.dart';
import '../data/catalogue_offer.dart';
import '../data/catalogue_providers.dart';
import '../data/display_price.dart';
import 'availability_label.dart';
import 'price_block.dart';
import 'product_image.dart';
import 'rating_row.dart';

/// One product, as a list shows it.
///
/// ## The name
///
/// This is *the* product card widget. It is not called `ProductCard` because
/// the contract model already is — `lib/api/models/catalogue.dart` — and two
/// classes of that name cannot coexist in a file that mentions both, which
/// every screen in this feature does. Prefixing the import at a dozen call
/// sites to save four characters here is the worse trade.
///
/// ## The imagery is 4/5 portrait, from `--img-ratio-card`
///
/// [MeridianTokens.imgRatioCard] is 0.8 — width over height. Portrait reads as
/// considered; a square reads as a thumbnail sheet, which is what a catalogue
/// stops being the moment it wants to be a shop. It is a token rather than a
/// number here so a change in `globals.css` reaches the phone.
///
/// ## The saving carries no fill
///
/// See [PriceBlock]. A soft fill on this card would make a "Save AED 40" chip
/// indistinguishable from the "Delivered" chip in the orders list — same green,
/// same pill, same ink. Availability keeps its fill because availability is a
/// status. A discount is not.
///
/// ## Quote-only cards carry no quick-add
///
/// When [CatalogueOffer] resolves to `quote` — no price in the active channel —
/// the card says "Priced by quotation" and offers **nothing that looks like a
/// purchase**. There is no quick-add on this card in either mode, and that is
/// now a deliberate constraint rather than an omission: the order service
/// refuses a B2C order for a product without `isB2CEnabled`
/// (`orders.ts:288`), and the pilot importer writes that flag false on every
/// row, so a one-tap add here would be a one-tap failure.
class ProductCardTile extends ConsumerWidget {
  const ProductCardTile({
    required this.product,
    this.onTap,
    this.wasPrice,
    super.key,
  });

  final ProductCard product;

  /// Defaults to pushing the product page. Injectable so a rail inside a
  /// bottom sheet can close itself first.
  final VoidCallback? onTap;

  /// The previous price, struck through. **Nothing on the wire fills this in**
  /// — see [PriceBlock] for the full note. It is here so the card is ready the
  /// day the contract grows a compare-at field, and so the golden proves the
  /// typography now.
  final Money? wasPrice;

  /// How tall this card renders at [width], for the fixed-extent grid and rail
  /// delegates that have to know before they lay anything out.
  ///
  /// It is an OVER-estimate on purpose. A grid cell that is a few pixels too
  /// tall shows a few pixels of the card's own ground; one that is a few pixels
  /// too short is a `RenderFlex overflowed` stripe across the bottom of every
  /// card in the row. Only one of those two is recoverable.
  ///
  /// Every term is read from the live type ramp and put through the ambient
  /// [TextScaler], which is what makes the grid honour dynamic type all the way
  /// to 200% instead of clipping at it. Above [kSingleColumnTextScale] the grid
  /// also drops to one column — see [gridColumnsFor] — so this figure grows
  /// while the cell grows with it.
  static double estimatedHeight(
    BuildContext context, {
    required double width,
    bool withWasPrice = false,
  }) {
    // The quote-only line is one `micro` row plus its gap. It is added
    // UNCONDITIONALLY rather than per-card: a grid delegate resolves one extent
    // for every cell in the row, so sizing to the cards that happen not to have
    // it overflows the ones that do.
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final TextScaler scaler = MediaQuery.textScalerOf(context);

    double lineOf(TextStyle style) =>
        scaler.scale(style.fontSize!) * (style.height ?? 1.0);

    final double micro = lineOf(type.micro);
    final double ui = lineOf(type.ui);
    final double figure = lineOf(type.figCard);

    final double image = width / t.imgRatioCard;
    final double pad = (t.spaceTight + t.spaceUnit) * 2;

    final double text = micro +
        t.spaceUnit // brand
        +
        ui * 2 // name, two lines
        +
        t.spaceUnit +
        2 +
        micro // rating
        +
        t.spaceTight +
        figure +
        t.spaceUnit / 2 +
        micro // price and its VAT line
        +
        (withWasPrice ? t.spaceUnit + 2 + micro : 0.0) +
        t.spaceTight +
        t.spaceUnit +
        micro // "Quote only", when the card is quote-only
        +
        micro +
        t.spaceUnit +
        2 // availability pill, incl. its own padding
        +
        t.spaceUnit +
        2 +
        micro; // minimum order

    // Slack. See the doc above: too tall is whitespace, too short is a stripe.
    return image + pad + text + t.spaceTight;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final Language language = languageOf(context);
    final String name = product.name(language);
    final CardPrice? price = product.price;
    final CatalogueOffer offer = CatalogueOffer.forCard(
      product,
      channel: ref.watch(catalogueChannelProvider),
    );

    return Semantics(
      button: true,
      // One announcement for the whole card. Without it a screen reader walks
      // an image, a brand, a name, two numbers and a pill as six separate
      // stops, and the user has to assemble the product themselves.
      label: _semanticLabel(name, price, offer),
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap ?? () => openProduct(context, product.slug),
        child: MeridianSurface(
          rung: MeridianRung.card,
          clipContent: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              AspectRatio(
                aspectRatio: t.imgRatioCard,
                child: ProductImage(
                  image: product.image,
                  productName: name,
                  radius: t.radius,
                ),
              ),
              Padding(
                padding: EdgeInsetsDirectional.fromSTEB(
                  t.spaceTight + t.spaceUnit,
                  t.spaceTight + t.spaceUnit,
                  t.spaceTight + t.spaceUnit,
                  t.spaceTight + t.spaceUnit,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    if (product.brandName != null) ...<Widget>[
                      Text(
                        product.brandName!.toUpperCase(),
                        style: type.micro.copyWith(color: t.ink3),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      SizedBox(height: t.spaceUnit),
                    ],
                    Text(
                      name,
                      style: type.ui.copyWith(color: t.ink1),
                      // The NAME may ellipsise. It is the one field on the card
                      // where a truncation still leaves a usable read, and
                      // letting it run to four lines at 200% pushes the price
                      // off the bottom of every card in the row.
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (product.rating != null) ...<Widget>[
                      SizedBox(height: t.spaceUnit + 2),
                      RatingRow(rating: product.rating, compact: true),
                    ],
                    SizedBox(height: t.spaceTight),
                    PriceBlock(
                      price:
                          price == null ? null : DisplayPrice.fromCard(price),
                      wasPrice: wasPrice,
                      quoteOnly: offer.isQuoteOnly,
                    ),
                    if (offer.isQuoteOnly) ...<Widget>[
                      SizedBox(height: t.spaceUnit),
                      Row(
                        children: <Widget>[
                          // A tag depicts an object; it does not mirror.
                          Icon(LucideIcons.tag, size: 12, color: t.accentInk),
                          SizedBox(width: t.spaceUnit),
                          Flexible(
                            child: Text(
                              'Quote only',
                              // Plain text, no fill — the same rule the saving
                              // follows. A soft fill here would read as a
                              // status pill next to the availability pill, and
                              // the two mean different kinds of thing.
                              style: type.micro.copyWith(color: t.accentInk),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                    SizedBox(height: t.spaceTight),
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: AvailabilityLabel(
                        availability: product.availability,
                        compact: true,
                      ),
                    ),
                    if (product.moq > 1) ...<Widget>[
                      SizedBox(height: t.spaceUnit + 2),
                      Text(
                        'Min. order ${Numerals.quantity(product.moq)}',
                        style: type.micro.copyWith(color: t.ink3),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// The whole card in one sentence, in the order a buyer decides in: what it
  /// is, what it costs, whether they can have it.
  String _semanticLabel(String name, CardPrice? price, CatalogueOffer offer) {
    final StringBuffer out = StringBuffer(name);
    if (product.brandName != null) out.write(', by ${product.brandName}');
    if (price == null) {
      out.write(
        offer.isQuoteOnly ? ', priced by quotation' : ', price on request',
      );
    } else {
      final DisplayPrice display = DisplayPrice.fromCard(price);
      out.write(
        ', ${display.isFrom ? 'from ' : ''}'
        '${MoneyFormat.format(display.gross)} including VAT',
      );
    }
    out.write(', ${_availabilityWords(product.availability)}');
    final RatingSummary? rating = product.rating;
    if (rating != null) {
      out.write(
        ', rated ${Numerals.decimal(rating.average, fractionDigits: 1)} '
        'out of 5 from ${Numerals.integer(rating.count)} reviews',
      );
    }
    if (product.moq > 1) {
      out.write(', minimum order ${Numerals.quantity(product.moq)}');
    }
    return out.toString();
  }

  static String _availabilityWords(Availability availability) =>
      switch (availability) {
        Availability.inStock => 'in stock',
        Availability.outOfStock => 'out of stock',
        Availability.unconfirmed => 'stock not confirmed',
      };
}
