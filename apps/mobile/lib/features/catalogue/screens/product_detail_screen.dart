import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderAbstractViewport;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/catalogue.dart';
import '../../../api/models/enums.dart';
import '../../../core/error/failures.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../core/l10n/numerals.dart';
import '../../../core/ui/async_state_view.dart';
import '../../../core/ui/key_button.dart';
import '../../../theme/elevation.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/motion.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../catalogue_context.dart';
import '../data/catalogue_offer.dart';
import '../data/catalogue_providers.dart';
import '../data/display_price.dart';
import '../widgets/availability_label.dart';
import '../widgets/catalogue_chrome.dart';
import '../widgets/price_block.dart';
import '../widgets/price_ladder.dart';
import '../widgets/product_gallery.dart';
import '../widgets/rating_row.dart';
import '../widgets/seller_card.dart';
import '../widgets/spec_table.dart';
import '../widgets/variant_sheet.dart';

/// The product page.
///
/// ## The sticky bar
///
/// It appears when the buy box scrolls off the top, and it carries the **price
/// and the availability**, not just a button. A bar that says only "Add to
/// cart" asks the buyer to scroll back up to remember what it costs and whether
/// it is in stock — which is the exact moment a purchase is abandoned. The
/// stickiness is measured against the real buy box through a [GlobalKey], not
/// against a guessed scroll offset, so it stays correct at 200% dynamic type
/// when the buy box is twice as tall.
///
/// The visibility flag is a [ValueNotifier] driven from the scroll listener,
/// not `setState`. A `setState` on every scroll frame rebuilds the whole page —
/// gallery, ladder, specs — sixty times a second to move one bar.
///
/// ## What the contract could not give this screen
///
/// * **No review list.** `RatingSummary` is `{average, count}` and there is no
///   `/v1/products/{slug}/reviews`. The Ratings section shows the aggregate
///   honestly and does not draw an empty review list to imply one is coming.
/// * **No shipping detail.** `ProductDetail` carries `origin` and `weightKg`
///   and nothing else that bears on delivery; freight is priced at
///   `/v1/checkout/quote` against a destination this screen does not have. The
///   Delivery section says exactly that rather than inventing an estimate.
/// * **No gross price.** See [DisplayPrice] — the VAT-inclusive figure is
///   computed here, and the net is printed beside it.
/// * **No channel flag.** `isB2CEnabled` is what the order service actually
///   enforces (`orders.ts:288`) and it is on NEITHER catalogue DTO. See
///   [CatalogueOffer] for the derivation used instead, and the report for the
///   contract change that would remove the guesswork.
///
/// ## The primary action is channel-aware
///
/// `Add to cart` appears only when a price resolves in the product's channel.
/// Otherwise the product is quote-only and the primary action is
/// `Request a quote` — and there is then **no add-to-cart anywhere on the
/// screen**, in the buy box or the sticky bar. Not disabled, not hidden behind
/// a tap: absent. A button that the order service will refuse is worse than no
/// button, because the refusal arrives after the buyer has committed.
class ProductDetailScreen extends ConsumerStatefulWidget {
  const ProductDetailScreen({required this.slug, super.key});

  /// From `/products/:slug`. Slug rather than id, matching the web route, so a
  /// deep link out of a share sheet or a push notification resolves directly.
  final String slug;

  @override
  ConsumerState<ProductDetailScreen> createState() =>
      _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  final ScrollController _scroll = ScrollController();
  final GlobalKey _buyBoxKey = GlobalKey(debugLabel: 'buy-box');
  final ValueNotifier<bool> _buyBoxOffScreen = ValueNotifier<bool>(false);

  ProductVariant? _variant;
  int? _quantity;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_measure);
  }

  @override
  void dispose() {
    _scroll.removeListener(_measure);
    _scroll.dispose();
    _buyBoxOffScreen.dispose();
    super.dispose();
  }

  /// Has the buy box left the top of the viewport?
  ///
  /// Measured from VIEWPORT GEOMETRY, not from the paint transform.
  ///
  /// `localToGlobal` was the obvious implementation and it is wrong here in a
  /// way that only shows up at the end of a scroll: a `ScrollPosition`
  /// notifies its listeners inside `setPixels`, which runs BEFORE the viewport
  /// lays out at the new offset — so a listener asking a render object where it
  /// is on screen gets the answer for the PREVIOUS frame. During a continuous
  /// drag that is invisible, because the next frame corrects it. At the end of
  /// a fling, or after a `jumpTo`, there is no next scroll event and the bar is
  /// left showing the wrong state until the user touches the screen again.
  ///
  /// `getOffsetToReveal` asks a different question — "at what scroll offset
  /// does this child reach the top of the viewport" — and that answer comes
  /// from the child's position in the viewport's CONTENT, which does not move
  /// when the content scrolls. It is correct on the frame it is asked, every
  /// time.
  void _measure() {
    final BuildContext? boxContext = _buyBoxKey.currentContext;
    if (boxContext == null || !_scroll.hasClients) return;
    final RenderObject? object = boxContext.findRenderObject();
    if (object is! RenderBox || !object.hasSize) return;
    final RenderAbstractViewport? viewport =
        RenderAbstractViewport.maybeOf(object);
    if (viewport == null) return;

    final double revealOffset = viewport.getOffsetToReveal(object, 0.0).offset;
    final double bottomOffset = revealOffset + object.size.height;
    _buyBoxOffScreen.value = _scroll.position.pixels > bottomOffset;
  }

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final AsyncValue<ProductDetail> product =
        ref.watch(productDetailProvider(widget.slug));
    final Language language = languageOf(context);

    return Scaffold(
      backgroundColor: t.surface0,
      appBar: AppBar(
        leading: const CatalogueBackButton(),
        title: Text(
          product.value?.name(language) ?? '',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
      body: AsyncStateView<ProductDetail>(
        value: product,
        // "Empty" for a product page is a HOLLOW RECORD: no images, no prices,
        // no variants and no description. Not "unpriced in your channel" —
        // that is a real, renderable state the contract explicitly calls for
        // ("the card renders price on request, it does not render zero"), and
        // it is handled inside PriceBlock, not by blanking the page.
        isEmpty: (ProductDetail p) =>
            p.images.isEmpty &&
            p.prices.isEmpty &&
            p.variants.isEmpty &&
            (p.description(language)?.trim().isEmpty ?? true),
        data: (BuildContext context, ProductDetail p) => _Body(
          product: p,
          scroll: _scroll,
          buyBoxKey: _buyBoxKey,
          buyBoxOffScreen: _buyBoxOffScreen,
          variant: _variant,
          quantity: _effectiveQuantity(p),
          onVariantChanged: (ProductVariant? v) => setState(() {
            _variant = v;
            // The new variant may have a different MOQ floor from the old one's
            // quantity. Resetting is the safe half of that: a quantity below
            // MOQ is rejected at checkout with an error the buyer cannot act on.
            _quantity = null;
          }),
          onQuantityChanged: (int q) => setState(() => _quantity = q),
          onMeasure: _measure,
        ),
        empty: (BuildContext context) => MeridianEmptyState(
          icon: const Icon(LucideIcons.package),
          title: 'This listing is not finished',
          body: 'The seller has published this product but has not added a '
              'price, an option or a photograph yet. Try again later, or '
              'browse the rest of the catalogue.',
          action: KeyButton(
            label: 'Go back',
            tone: KeyButtonTone.accent,
            onPressed: () => Navigator.of(context).maybePop(),
          ),
        ),
        error: (BuildContext context, Object error, StackTrace? stack) =>
            // A `not_found` here is very often NOT a bad link. `/v1/products/
            // [slug]` throws `not_found` when the product's channel flag is
            // false (route.ts:52) — which, with the pilot importer writing
            // `isB2CEnabled: false` on every row, is the single most likely
            // answer a B2C deep link gets. Rendering "something went wrong"
            // over that would hide a product the buyer can still ask about.
            error is ServerFailure && error.isNotFound
                ? MeridianEmptyState(
                    icon: const Icon(LucideIcons.tag),
                    title: 'Not sold on this channel',
                    body: 'This product is not listed for direct purchase '
                        'here. The seller can quote it for your quantity.',
                    action: KeyButton(
                      label: 'Request a quote',
                      onPressed: () =>
                          openQuoteRequest(context, slug: widget.slug),
                    ),
                  )
                : MeridianErrorState(
                    error: error,
                    onRetry: () =>
                        ref.invalidate(productDetailProvider(widget.slug)),
                  ),
        loading: (BuildContext context) =>
            const MeridianSkeleton(shape: MeridianSkeletonShape.detail),
      ),
    );
  }

  /// The quantity in force: what the buyer typed, or the product's minimum
  /// order quantity if they have not touched it.
  ///
  /// MOQ is the floor, never 1. Starting a B2B buy box at 1 on a product with a
  /// minimum of 50 is a number the checkout will reject, shown to the buyer as
  /// if it were an offer.
  int _effectiveQuantity(ProductDetail product) {
    final int floor = product.moq < 1 ? 1 : product.moq;
    final int? chosen = _quantity;
    return chosen == null || chosen < floor ? floor : chosen;
  }
}

class _Body extends ConsumerWidget {
  const _Body({
    required this.product,
    required this.scroll,
    required this.buyBoxKey,
    required this.buyBoxOffScreen,
    required this.variant,
    required this.quantity,
    required this.onVariantChanged,
    required this.onQuantityChanged,
    required this.onMeasure,
  });

  final ProductDetail product;
  final ScrollController scroll;
  final GlobalKey buyBoxKey;
  final ValueNotifier<bool> buyBoxOffScreen;
  final ProductVariant? variant;
  final int quantity;
  final ValueChanged<ProductVariant?> onVariantChanged;
  final ValueChanged<int> onQuantityChanged;
  final VoidCallback onMeasure;

  /// The bands in force: the selected variant's own ladder if there is one,
  /// otherwise the product's. A variant carries its OWN prices — reading the
  /// product's ladder while a variant is selected quotes the wrong figure.
  List<PriceBand> get _bands =>
      variant == null ? product.prices : variant!.prices;

  Currency? get _currency => _bands.isEmpty ? null : _bands.first.currency;

  PriceBand? get _activeBand {
    final Currency? c = _currency;
    if (c == null) return null;
    for (final PriceBand band in _bands) {
      if (band.channel == product.channel &&
          band.currency == c &&
          band.covers(quantity)) {
        return band;
      }
    }
    return null;
  }

  /// Purchase or quote. Derived, because the flag the platform enforces is not
  /// on the wire — see [CatalogueOffer].
  CatalogueOffer get _offer => CatalogueOffer.forDetail(
        product,
        variant: variant,
        currency: _currency,
      );

  Availability get _availability =>
      variant?.availability ?? product.availability;

  int get _availableQty => variant?.availableQty ?? product.availableQty;

  DisplayPrice? get _displayPrice {
    final PriceBand? band = _activeBand;
    if (band == null) return null;
    final Currency? c = _currency;
    final bool tiered = c != null &&
        PriceLadder.sortedFor(
              _bands,
              channel: product.channel,
              currency: c,
            ).length >
            1;
    // `isFrom` only when the ladder is real AND the buyer is on its first
    // rung: once they have chosen 500 units the price is not a "from", it is
    // the price.
    return DisplayPrice.fromBand(
      band,
      isFrom: tiered && band.minQty <= product.moq,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final MeridianMotion motion = context.motion;
    final Language language = languageOf(context);
    final Currency? currency = _currency;
    final CatalogueOffer offer = _offer;

    // Re-measure once this layout has happened, so the sticky bar is correct on
    // the very first frame after the product lands rather than after the first
    // scroll event.
    WidgetsBinding.instance.addPostFrameCallback((_) => onMeasure());

    final List<PriceBand> ladder = currency == null
        ? const <PriceBand>[]
        : PriceLadder.sortedFor(
            _bands,
            channel: product.channel,
            currency: currency,
          );

    return Stack(
      children: <Widget>[
        ListView(
          controller: scroll,
          padding: EdgeInsetsDirectional.only(bottom: t.spaceSection),
          children: <Widget>[
            ProductGallery(
              images: product.images,
              productName: product.name(language),
            ),
            Padding(
              padding: EdgeInsetsDirectional.all(t.spaceStack),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  // ---- The buy box ------------------------------------------
                  KeyedSubtree(
                    key: buyBoxKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        if (product.brand != null)
                          Text(
                            (language == Language.ar
                                    ? product.brand!.nameAr ??
                                        product.brand!.nameEn
                                    : product.brand!.nameEn)
                                .toUpperCase(),
                            style: type.micro.copyWith(color: t.ink3),
                          ),
                        SizedBox(height: t.spaceUnit),
                        Text(product.name(language), style: type.h2),
                        SizedBox(height: t.spaceTight),
                        DirectionalText.token(
                          product.sku,
                          kind: LtrToken.sku,
                          style: type.meta.copyWith(color: t.ink3),
                        ),
                        if (product.rating != null) ...<Widget>[
                          SizedBox(height: t.spaceTight),
                          RatingRow(rating: product.rating),
                        ],
                        SizedBox(height: t.spaceStack),
                        PriceBlock(
                          price: _displayPrice,
                          variant: PriceBlockVariant.detail,
                          quoteOnly: offer.isQuoteOnly,
                        ),
                        if (offer.isQuoteOnly) ...<Widget>[
                          SizedBox(height: t.spaceTight),
                          Text(
                            offer.explanation,
                            style: type.meta.copyWith(color: t.ink2),
                          ),
                        ],
                        SizedBox(height: t.spaceStack),
                        Row(
                          children: <Widget>[
                            AvailabilityLabel(
                              availability: _availability,
                              availableQty: _availableQty,
                            ),
                            if (product.moq > 1) ...<Widget>[
                              SizedBox(width: t.spaceTight),
                              Flexible(
                                child: Text(
                                  'Minimum order '
                                  '${Numerals.quantity(product.moq)}',
                                  style: type.meta.copyWith(color: t.ink2),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ],
                        ),
                        if (product.hasVariants) ...<Widget>[
                          SizedBox(height: t.spaceStack),
                          _VariantButton(
                            product: product,
                            selected: variant,
                            currency: currency,
                            quantity: quantity,
                            onChanged: onVariantChanged,
                          ),
                        ],
                        SizedBox(height: t.spaceStack),
                        _QuantityStepper(
                          quantity: quantity,
                          minimum: product.moq < 1 ? 1 : product.moq,
                          onChanged: onQuantityChanged,
                        ),
                        SizedBox(height: t.spaceStack),
                        _PrimaryAction(
                          product: product,
                          variant: variant,
                          quantity: quantity,
                          availability: _availability,
                          offer: offer,
                          compact: false,
                        ),
                      ],
                    ),
                  ),

                  if (ladder.length > 1) ...<Widget>[
                    SizedBox(height: t.spaceBlock),
                    PriceLadder(bands: ladder, quantity: quantity),
                  ],

                  SizedBox(height: t.spaceBlock),
                  SellerCard(seller: product.seller),

                  if (product.description(language) != null) ...<Widget>[
                    SizedBox(height: t.spaceBlock),
                    _Section(
                      title: 'About this product',
                      child: Text(
                        product.description(language)!,
                        style: type.body.copyWith(color: t.ink2),
                      ),
                    ),
                  ],

                  SizedBox(height: t.spaceBlock),
                  _Section(
                    title: 'Specifications',
                    child: SpecTable(
                      rows: _specs(product, variant, language),
                    ),
                  ),

                  SizedBox(height: t.spaceBlock),
                  _RatingsSection(rating: product.rating),

                  SizedBox(height: t.spaceBlock),
                  _DeliverySection(product: product),
                ],
              ),
            ),
          ],
        ),

        // ---- The sticky bar -------------------------------------------------
        Align(
          alignment: AlignmentDirectional.bottomCenter,
          child: ValueListenableBuilder<bool>(
            valueListenable: buyBoxOffScreen,
            builder: (BuildContext context, bool visible, Widget? child) {
              return ExcludeSemantics(
                // The bar stays in the tree while it is hidden — that is what
                // makes it animate — so it also stays in the SEMANTICS tree,
                // where a screen-reader user would find a second, invisible
                // "Add to cart" sitting under the specifications. Excluded
                // while hidden, present the moment it arrives.
                excluding: !visible,
                child: IgnorePointer(
                  // Opacity alone does not stop a tap, and an invisible Add to
                  // cart button sitting over the specs is the worst possible
                  // version of this control.
                  ignoring: !visible,
                  child: AnimatedSlide(
                    // Reduced motion zeroes the TRAVEL. The opacity below is not
                    // zeroed: a user who asked for less movement did not ask to
                    // lose the feedback that a bar arrived.
                    offset: visible || motion.reduced
                        ? Offset.zero
                        : const Offset(0, 1),
                    duration: motion.panel,
                    curve: motion.standard,
                    child: AnimatedOpacity(
                      opacity: visible ? 1.0 : 0.0,
                      duration: motion.panel,
                      curve: motion.standard,
                      child: child,
                    ),
                  ),
                ),
              );
            },
            child: _StickyBuyBar(
              product: product,
              variant: variant,
              quantity: quantity,
              price: _displayPrice,
              availability: _availability,
              availableQty: _availableQty,
              offer: offer,
            ),
          ),
        ),
      ],
    );
  }

  /// Everything on the wire that bears on what the buyer is getting.
  ///
  /// `weightKg` is a `double` in the contract and correctly so — it is an
  /// approximate physical quantity, not money — but it still goes through
  /// [Numerals] rather than string interpolation, or a 2.0 kg part prints as
  /// "2.0" in one place and "2" in another.
  static List<SpecRow> _specs(
    ProductDetail product,
    ProductVariant? variant,
    Language language,
  ) {
    final List<SpecRow> rows = <SpecRow>[
      SpecRow('SKU', variant?.sku ?? product.sku, token: LtrToken.sku),
      if (product.brand != null)
        SpecRow(
          'Brand',
          language == Language.ar
              ? product.brand!.nameAr ?? product.brand!.nameEn
              : product.brand!.nameEn,
        ),
      SpecRow(
        'Category',
        // ProductCategoryRef is the NARROW inline shape on ProductDetail — no
        // parent, no depth, no count, and no `name(language)` helper. The
        // resolution is done here rather than wished for on the model.
        language == Language.ar
            ? product.category.nameAr
            : product.category.nameEn,
      ),
      if (product.origin != null)
        SpecRow(
          'Country of origin',
          product.origin!,
          token: LtrToken.reference,
        ),
      if (product.weightKg != null)
        SpecRow(
          'Shipping weight',
          '${Numerals.decimal(product.weightKg!, fractionDigits: 2)} kg',
        ),
      SpecRow('Minimum order', Numerals.quantity(product.moq)),
      if (product.tags.isNotEmpty) SpecRow('Tags', product.tags.join(', ')),
    ];

    final ProductVariant? v = variant;
    if (v != null) {
      v.attributes.forEach((String key, Object? value) {
        rows.add(SpecRow(key, _attributeValue(value)));
      });
    }
    return rows;
  }

  static String _attributeValue(Object? value) {
    if (value == null) return '—';
    if (value is bool) return value ? 'Yes' : 'No';
    if (value is int) return Numerals.integer(value);
    if (value is double) {
      return value == value.roundToDouble()
          ? Numerals.integer(value.round())
          : Numerals.decimal(value, fractionDigits: 2);
    }
    return Numerals.toWestern(value.toString());
  }
}

/// The bar that replaces the buy box once it has scrolled away.
///
/// Price AND availability, not just a button — see the screen's class doc.
class _StickyBuyBar extends StatelessWidget {
  const _StickyBuyBar({
    required this.product,
    required this.variant,
    required this.quantity,
    required this.price,
    required this.availability,
    required this.availableQty,
    required this.offer,
  });

  final ProductDetail product;
  final ProductVariant? variant;
  final int quantity;
  final DisplayPrice? price;
  final Availability availability;
  final int availableQty;
  final CatalogueOffer offer;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return DecoratedBox(
      decoration: BoxDecoration(
        // Opaque, like every other chrome bar in this app. A price rendered
        // over a translucent bar has a contrast ratio that depends on which
        // product photograph happens to be underneath it.
        color: t.surface2,
        border: Border(top: BorderSide(color: t.hairline)),
        boxShadow: MeridianElevation.shadows(t, MeridianRung.raised),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsetsDirectional.all(t.spaceTight + t.spaceUnit),
          child: Row(
            children: <Widget>[
              Expanded(
                flex: 3,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    PriceBlock(
                      price: price,
                      // The VAT line is two thumb-scrolls above and the bar is
                      // the one place where a third line costs a row of the
                      // list behind it.
                      showVatLine: false,
                      quoteOnly: offer.isQuoteOnly,
                    ),
                    SizedBox(height: t.spaceUnit),
                    if (offer.isQuoteOnly)
                      // The bar still carries a second line, and it is still
                      // about whether the buyer can have the thing — it is
                      // just that the answer is "ask" rather than "yes". A bar
                      // with a price and nothing else is the version this
                      // screen is specifically not allowed to ship.
                      Text(
                        'Seller confirms price and lead time',
                        style: type.micro.copyWith(color: t.ink2),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      )
                    else
                      AvailabilityLabel(
                        availability: availability,
                        availableQty: availableQty,
                        compact: true,
                      ),
                  ],
                ),
              ),
              SizedBox(width: t.spaceTight + t.spaceUnit),
              // Flexed, not intrinsic. KeyButton sizes to `constraints.biggest`
              // — see BoundedAction — so in a Row it MUST be given a bounded
              // width, and a share of the bar is a better bound than a magic
              // number that clips 'Request a quote' at 200% type.
              Expanded(
                flex: 2,
                child: _PrimaryAction(
                  product: product,
                  variant: variant,
                  quantity: quantity,
                  availability: availability,
                  offer: offer,
                  compact: true,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The one primary action, chosen by channel.
///
/// **Purchase** — a price resolves in the product's channel — gives Add to
/// cart, through the [addToCartProvider] seam.
///
/// **Quote** — no price resolves — gives Request a quote, and no add-to-cart
/// widget is constructed at all. This is the CTO's rule, and it is enforced by
/// the shape of this widget rather than by a disabled flag: there is no branch
/// here that builds a cart button in quote mode, so no future edit can
/// accidentally re-enable one.
///
/// The quote route is `/rfq/new?productId=…` — see [kRequestQuoteRoute]. The
/// RFQ form itself is out of this feature's scope and there is no RFQ endpoint
/// on `/v1` yet.
class _PrimaryAction extends ConsumerWidget {
  const _PrimaryAction({
    required this.product,
    required this.variant,
    required this.quantity,
    required this.availability,
    required this.offer,
    required this.compact,
  });

  final ProductDetail product;
  final ProductVariant? variant;
  final int quantity;
  final Availability availability;
  final CatalogueOffer offer;

  /// The sticky-bar variant: a shorter control, and no explanatory line under
  /// it — the bar has one row and the explanation is in the buy box above.
  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;

    if (offer.isQuoteOnly) {
      return KeyButton(
        label: 'Request a quote',
        // A tag depicts an object; it does not mirror.
        icon: const Icon(LucideIcons.tag),
        tone: KeyButtonTone.accent,
        // Always expanded: KeyButton fills its constraints either way (see
        // BoundedAction), so `expand: false` would only make the intent less
        // obvious than the layout.
        expand: true,
        size: compact ? KeyButtonSize.medium : KeyButtonSize.large,
        onPressed: () => openQuoteRequest(
          context,
          productId: product.id,
          slug: product.slug,
          quantity: quantity,
        ),
      );
    }

    final AddToCartAction? add = ref.watch(addToCartProvider);
    final bool orderable = availability.isOrderable;
    // UNCONFIRMED is orderable. The catalogue simply has no confirmed stock
    // position, which is a caveat on the delivery date, not a block on the sale
    // — and the availability pill beside this button has already said so.
    final bool enabled = orderable && add != null;

    final Widget button = KeyButton(
      label: orderable ? 'Add to cart' : 'Out of stock',
      icon: orderable
          // A trolley never mirrors — and it is the one glyph in commerce that
          // has to be recognised instantly.
          ? const Icon(LucideIcons.shoppingCart)
          : null,
      expand: true,
      size: compact ? KeyButtonSize.medium : KeyButtonSize.large,
      onPressed: enabled
          ? () => add(
                product: product,
                quantity: quantity,
                variant: variant,
              )
          : null,
    );

    if (orderable && add == null && !compact) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          button,
          SizedBox(height: t.spaceTight),
          Text(
            // A disabled button with no explanation is a dead end the user
            // blames themselves for.
            'The basket is not connected in this build.',
            style: context.type.meta.copyWith(color: t.ink3),
          ),
        ],
      );
    }
    return button;
  }
}

/// The variant chooser's trigger. Names the CHOSEN option, not the word
/// "Options" — a control that says "Options" tells the buyer there are options,
/// which they can see; one that says "220V · 2 inch" tells them what they have.
class _VariantButton extends StatelessWidget {
  const _VariantButton({
    required this.product,
    required this.selected,
    required this.currency,
    required this.quantity,
    required this.onChanged,
  });

  final ProductDetail product;
  final ProductVariant? selected;
  final Currency? currency;
  final int quantity;
  final ValueChanged<ProductVariant?> onChanged;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final Language language = languageOf(context);
    final ProductVariant? v = selected;
    final String label = v == null
        ? 'Choose an option'
        : (language == Language.ar ? v.nameAr ?? v.nameEn : v.nameEn);

    return Semantics(
      button: true,
      label: v == null
          ? 'Choose an option, ${product.variants.length} available'
          : 'Option, $label. Change',
      excludeSemantics: true,
      child: InkWell(
        onTap: () async {
          final ProductVariant? picked = await showVariantSheet(
            context,
            product: product,
            selected: selected,
            currency: currency,
            quantity: quantity,
          );
          if (picked != null) onChanged(picked);
        },
        borderRadius: BorderRadius.circular(t.radius),
        splashFactory: NoSplash.splashFactory,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: kMinTouchTarget),
          child: MeridianSurface(
            rung: MeridianRung.recessed,
            padding: EdgeInsetsDirectional.symmetric(
              horizontal: t.spaceTight + t.spaceUnit,
              vertical: t.spaceTight,
            ),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Text(
                        'Option',
                        style: type.micro.copyWith(color: t.ink3),
                      ),
                      SizedBox(height: t.spaceUnit / 2),
                      Text(
                        label,
                        style: type.body.copyWith(color: t.ink1),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                // `chevron-down` opens a thing downward: vertical, so it does
                // not mirror.
                Icon(LucideIcons.chevronDown, size: 18, color: t.ink2),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Quantity, floored at the product's minimum order.
class _QuantityStepper extends StatelessWidget {
  const _QuantityStepper({
    required this.quantity,
    required this.minimum,
    required this.onChanged,
  });

  final int quantity;
  final int minimum;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final bool canDecrease = quantity > minimum;

    return Row(
      children: <Widget>[
        Text('Quantity', style: type.ui.copyWith(color: t.ink2)),
        const Spacer(),
        MeridianSurface(
          rung: MeridianRung.recessed,
          radius: t.radiusPill,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              IconAction(
                icon: LucideIcons.minus,
                iconName: 'minus',
                label: canDecrease
                    ? 'Decrease quantity'
                    : 'Minimum order is ${Numerals.quantity(minimum)}',
                onPressed: canDecrease ? () => onChanged(quantity - 1) : null,
              ),
              ConstrainedBox(
                constraints: const BoxConstraints(minWidth: 48),
                child: Semantics(
                  liveRegion: true,
                  label: 'Quantity ${Numerals.quantity(quantity)}',
                  excludeSemantics: true,
                  child: Text(
                    Numerals.quantity(quantity),
                    style: type.figCard.copyWith(
                      color: t.ink1,
                      fontSize: t.fsUi,
                      height: t.lhUi / t.fsUi,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
              IconAction(
                icon: LucideIcons.plus,
                iconName: 'plus',
                label: 'Increase quantity',
                onPressed: () => onChanged(quantity + 1),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// The ratings block.
///
/// There is no review LIST on the contract — `RatingSummary` is `{average,
/// count}` and there is no `/v1/products/{slug}/reviews`. So this shows the
/// aggregate and stops. It deliberately does not draw an empty list, a "See all
/// reviews" link to nowhere, or three placeholder cards: every one of those
/// promises a screen that does not exist.
class _RatingsSection extends StatelessWidget {
  const _RatingsSection({required this.rating});

  final RatingSummary? rating;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return _Section(
      title: 'Ratings',
      child: rating == null
          ? Text(
              // Not five empty stars. "Nobody has reviewed this yet" and "this
              // scored zero" are different claims, and the contract makes the
              // difference explicit by sending null rather than a zero count.
              'No ratings yet. Be the first once your order arrives.',
              style: type.body.copyWith(color: t.ink2),
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                RatingRow(rating: rating, showEmptyState: true),
                SizedBox(height: t.spaceTight),
                Text(
                  '${Numerals.integer(rating!.count)} '
                  '${rating!.count == 1 ? 'buyer has' : 'buyers have'} rated '
                  'this product.',
                  style: type.meta.copyWith(color: t.ink2),
                ),
              ],
            ),
    );
  }
}

/// Delivery, limited to what the catalogue actually knows.
///
/// `ProductDetail` carries `origin` and `weightKg`. It does not carry a lead
/// time, a shipping zone or a freight estimate — those are resolved at
/// `/v1/checkout/quote` against a destination address this screen has never
/// seen. Printing "Delivered in 2–4 days" here would be a promise made by the
/// client.
class _DeliverySection extends StatelessWidget {
  const _DeliverySection({required this.product});

  final ProductDetail product;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return _Section(
      title: 'Delivery',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              // A truck depicts an object; it does not mirror.
              Icon(LucideIcons.truck, size: 18, color: t.ink2),
              SizedBox(width: t.spaceTight + t.spaceUnit),
              Expanded(
                child: Text(
                  'Delivery is quoted at checkout for your address. Some '
                  'destinations are quoted separately by the seller.',
                  style: type.body.copyWith(color: t.ink2),
                ),
              ),
            ],
          ),
          if (product.origin != null || product.weightKg != null) ...<Widget>[
            SizedBox(height: t.spaceStack),
            SpecTable(
              rows: <SpecRow>[
                if (product.origin != null)
                  SpecRow(
                    'Ships from',
                    product.origin!,
                    token: LtrToken.reference,
                  ),
                if (product.weightKg != null)
                  SpecRow(
                    'Weight',
                    '${Numerals.decimal(product.weightKg!, fractionDigits: 2)} kg',
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Semantics(
          header: true,
          child: Text(title, style: context.type.h3),
        ),
        SizedBox(height: t.spaceTight + t.spaceUnit),
        child,
      ],
    );
  }
}
