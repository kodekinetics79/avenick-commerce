import 'package:avenick/api/models/catalogue.dart';
import 'package:avenick/api/models/enums.dart';
import 'package:avenick/features/catalogue/catalogue.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

/// THE WRONG BUY BUTTON, as a unit test.
///
/// `CatalogueOffer` decides Add to cart versus Request a quote. It used to
/// decide it by asking whether a price had been resolved in the active
/// channel, and that inference is wrong for every row in production: the pilot
/// importer writes `isB2CEnabled: false` on every product it creates AND
/// prices them in B2C, so "has a price" and "may be sold" disagree on all
/// 1,172 live rows. The card said Add to cart; `secureCreateOrder` refused the
/// order after the buyer had committed to it.
///
/// The contract now carries `sellableInChannel` and this class reads it. These
/// are the four combinations, named for what each one is.
void main() {
  group('the flag is the primary signal', () {
    test('priced AND sellable is a purchase', () {
      final CatalogueOffer offer = CatalogueOffer.forCard(
        fakeProductCard(),
        channel: Channel.b2c,
      );
      expect(offer.isPurchasable, isTrue);
      expect(offer.mode, OfferMode.purchase);
      expect(offer.quoteReason, isNull);
      expect(offer.actionLabel, 'Add to cart');
    });

    test('PRICED AND NOT SELLABLE IS A QUOTE — the production row', () {
      // The regression. A resolved CardPrice sits right there on this card and
      // it changes nothing: the server has said the order will be refused.
      final CatalogueOffer offer = CatalogueOffer.forCard(
        fakePricedButUnsellableCard(),
        channel: Channel.b2c,
      );
      expect(fakePricedButUnsellableCard().price, isNotNull);
      expect(offer.isQuoteOnly, isTrue);
      expect(offer.quoteReason, QuoteReason.notSellableInChannel);
      expect(offer.isRefusedByChannel, isTrue);
      expect(offer.actionLabel, 'Request a quote');
    });

    test('unpriced but sellable is still a quote — the fail-safe', () {
      // Not an inference about sellability: the server permits the sale and
      // has not priced it, so there is no figure to put on a cart button.
      // This can only ever move an offer TO quote, never back to purchase.
      final CatalogueOffer offer = CatalogueOffer.forCard(
        fakeProductCard(priced: false),
        channel: Channel.b2c,
      );
      expect(offer.isQuoteOnly, isTrue);
      expect(offer.quoteReason, QuoteReason.noResolvedPrice);
      expect(offer.isRefusedByChannel, isFalse);
    });

    test('neither priced nor sellable is a quote, and the flag says why', () {
      final CatalogueOffer offer = CatalogueOffer.forCard(
        fakeQuoteOnlyCard(),
        channel: Channel.b2c,
      );
      expect(offer.isQuoteOnly, isTrue);
      // The flag wins the attribution: the server refused it, and this client
      // additionally found nothing to price. The first is the real reason.
      expect(offer.quoteReason, QuoteReason.notSellableInChannel);
    });
  });

  group('the product page reaches the same answer', () {
    test('a full B2C ladder does not buy a quote-only product a cart button',
        () {
      final CatalogueOffer offer = CatalogueOffer.forDetail(
        fakePricedButUnsellableDetail(),
        currency: Currency.aed,
      );
      expect(fakePricedButUnsellableDetail().prices, isNotEmpty);
      expect(offer.isQuoteOnly, isTrue);
      expect(offer.quoteReason, QuoteReason.notSellableInChannel);
    });

    test('a sellable, priced product page is a purchase', () {
      final CatalogueOffer offer = CatalogueOffer.forDetail(
        fakeProductDetail(),
        currency: Currency.aed,
      );
      expect(offer.isPurchasable, isTrue);
      expect(offer.channel, Channel.b2c);
    });

    test('a selected VARIANT with no band of its own falls back to quote', () {
      // A variant carries its own ladder, and a product with a priced base and
      // an unpriced option is a real row.
      final CatalogueOffer offer = CatalogueOffer.forDetail(
        fakeProductDetail(),
        variant: fakeVariant(prices: const <PriceBand>[]),
        currency: Currency.aed,
      );
      expect(offer.isQuoteOnly, isTrue);
      expect(offer.quoteReason, QuoteReason.noResolvedPrice);
    });

    test('a sellable variant priced in another currency is a quote', () {
      final CatalogueOffer offer = CatalogueOffer.forDetail(
        fakeProductDetail(),
        variant: fakeVariant(
          prices: <PriceBand>[fakeBand(currency: Currency.sar)],
        ),
        currency: Currency.aed,
      );
      expect(offer.isQuoteOnly, isTrue);
      expect(offer.quoteReason, QuoteReason.noResolvedPrice);
    });
  });

  test('a quote-only offer always explains itself', () {
    // A buyer who cannot find an Add to cart button assumes the app is broken
    // unless something on screen says otherwise.
    for (final CatalogueOffer offer in <CatalogueOffer>[
      CatalogueOffer.forCard(fakeQuoteOnlyCard(), channel: Channel.b2c),
      CatalogueOffer.forCard(
        fakePricedButUnsellableCard(),
        channel: Channel.b2c,
      ),
      CatalogueOffer.forDetail(fakeQuoteOnlyDetail()),
      CatalogueOffer.forDetail(fakePricedButUnsellableDetail()),
    ]) {
      expect(offer.isQuoteOnly, isTrue);
      expect(offer.explanation, contains('quotation'));
      expect(offer.actionLabel, 'Request a quote');
    }
  });
}
