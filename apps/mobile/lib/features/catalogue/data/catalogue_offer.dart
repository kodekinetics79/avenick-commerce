import 'package:flutter/foundation.dart' show immutable;

import '../../../api/models/catalogue.dart';
import '../../../api/models/enums.dart';

/// What the buyer can actually DO with this product, right now, in this
/// channel.
///
/// ## The flag, not the price
///
/// The rule the platform enforces is `Product.isB2CEnabled` /
/// `Product.isB2BEnabled`: `services/orders.ts` (~line 285),
/// `services/secure-checkout.ts` and the v1 checkout quote's `quote-lines.ts`
/// each refuse a line with
/// `channel === "B2B" ? !isB2BEnabled : !isB2CEnabled`. An Add to cart button
/// on one of those is a button three separate server guards will refuse.
///
/// The contract now answers that question directly. `ProductCard` and
/// `ProductDetail` carry a required `sellableInChannel: boolean` — the same
/// question, asked for the channel the DTO was built for — and it is the
/// PRIMARY SIGNAL here. Nothing is inferred from it and nothing is inferred
/// instead of it.
///
/// ## What this class used to do, and why it was wrong
///
/// Until the models carried the flag, this derived quote-only mode from
/// "no resolved price in the active channel". The reasoning was that a
/// quote-only product is filtered out of a B2C page and 404s on a B2C deep
/// link, so an unpriced card was the observable shadow of an unsellable one.
///
/// It was wrong for every row in production, in the dangerous direction. The
/// pilot importer writes `isB2CEnabled: false` on every product it creates
/// (`pilot-catalog.ts:303` and `:324`) **and prices them in B2C anyway**. So
/// all 1,172 catalogue rows have a resolved B2C price and cannot be bought:
/// the inference said `purchase`, the card rendered **Add to cart**, and
/// `secureCreateOrder` refused the order server-side — after the buyer had
/// committed to it. A guess that agrees with the flag in every test anyone
/// would think to write, and disagrees with it on the entire live catalogue,
/// is worse than no guess at all.
///
/// ## The price still has a say, but a narrower one
///
/// [OfferMode.quote] is returned when the flag is false, OR when the flag is
/// true and there is no price to put on the button. The second is not an
/// inference about sellability — it is the honest reading of a product the
/// server says may be sold but has not priced in the requested currency: there
/// is no figure to charge, so "ask" is the only action that can complete. It
/// can only ever move an offer from purchase to quote, never the reverse, so
/// it cannot resurrect the defect above.
enum OfferMode {
  /// The server says this product is sellable in this channel and a price is
  /// resolved. The primary action is Add to cart.
  purchase,

  /// The server says it cannot be sold in this channel, or it can but nothing
  /// is priced. The primary action is Request a quote, and **there is no
  /// add-to-cart affordance anywhere** — not greyed out, not behind a tap.
  /// Absent.
  quote,
}

/// Why an offer resolved to [OfferMode.quote].
///
/// Kept separate from [OfferMode] because the two reasons are different facts
/// about the product and, one day, different sentences on the screen. They are
/// also the difference between a defect and a catalogue gap: a product the
/// server flags unsellable is working as designed, and a sellable product with
/// no price in the buyer's currency is a listing somebody has not finished.
enum QuoteReason {
  /// The server said so: `sellableInChannel` is false.
  notSellableInChannel,

  /// Sellable, but nothing is priced in the requested channel and currency.
  noResolvedPrice,
}

@immutable
class CatalogueOffer {
  const CatalogueOffer._({
    required this.mode,
    required this.channel,
    required this.quoteReason,
  });

  final OfferMode mode;
  final Channel channel;

  /// Why this is quote-only, or null when it is not.
  final QuoteReason? quoteReason;

  bool get isPurchasable => mode == OfferMode.purchase;
  bool get isQuoteOnly => mode == OfferMode.quote;

  /// True when the SERVER says this cannot be sold here, as opposed to this
  /// client finding nothing to price.
  bool get isRefusedByChannel =>
      quoteReason == QuoteReason.notSellableInChannel;

  static CatalogueOffer _resolve({
    required bool sellableInChannel,
    required bool priced,
    required Channel channel,
  }) {
    if (!sellableInChannel) {
      return CatalogueOffer._(
        mode: OfferMode.quote,
        channel: channel,
        quoteReason: QuoteReason.notSellableInChannel,
      );
    }
    if (!priced) {
      return CatalogueOffer._(
        mode: OfferMode.quote,
        channel: channel,
        quoteReason: QuoteReason.noResolvedPrice,
      );
    }
    return CatalogueOffer._(
      mode: OfferMode.purchase,
      channel: channel,
      quoteReason: null,
    );
  }

  /// From a list card.
  ///
  /// [ProductCard.sellableInChannel] decides it. [ProductCard.price] is the
  /// fail-safe underneath: it is already resolved for the channel and currency
  /// the page was fetched with, so a null there means there is no figure to
  /// put on a cart button even where the server permits the sale.
  factory CatalogueOffer.forCard(
    ProductCard card, {
    required Channel channel,
  }) =>
      _resolve(
        sellableInChannel: card.sellableInChannel,
        priced: card.price != null,
        channel: channel,
      );

  /// From a product page.
  ///
  /// [ProductDetail.sellableInChannel] decides it. The band scan underneath
  /// checks the VARIANT's ladder when one is selected: a variant carries its
  /// own bands, and a product with a priced base and an unpriced option is a
  /// real row.
  factory CatalogueOffer.forDetail(
    ProductDetail detail, {
    ProductVariant? variant,
    Currency? currency,
  }) {
    final List<PriceBand> bands =
        variant == null ? detail.prices : variant.prices;
    final bool priced = bands.any(
      (PriceBand band) =>
          band.channel == detail.channel &&
          (currency == null || band.currency == currency),
    );
    return _resolve(
      sellableInChannel: detail.sellableInChannel,
      priced: priced,
      channel: detail.channel,
    );
  }

  /// The words for the primary action.
  String get actionLabel => isQuoteOnly ? 'Request a quote' : 'Add to cart';

  /// The one-line explanation that sits under the price. Never absent on a
  /// quote-only product: a buyer who cannot find an Add to cart button assumes
  /// the app is broken unless something on screen says otherwise.
  String get explanation => isQuoteOnly
      ? 'This product is priced by quotation. The seller confirms the price '
          'and the lead time for your quantity.'
      : 'Price includes VAT. Delivery is quoted at checkout.';
}
