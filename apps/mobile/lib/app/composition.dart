import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/models/catalogue.dart' show ProductDetail;
import '../api/models/enums.dart' show Channel, Currency;
import '../features/account/account.dart' show avenickApiProvider;
import '../features/catalogue/catalogue.dart'
    show
        CatalogueRepository,
        catalogueChannelProvider,
        catalogueCurrencyProvider,
        catalogueRepositoryProvider;
import '../features/commerce/commerce.dart'
    show
        ApiCheckoutGateway,
        ApiOrdersGateway,
        checkoutGatewayProvider,
        ordersGatewayProvider;
import '../features/rfq/rfq.dart'
    show
        ApiRfqRepository,
        QuoteSubject,
        QuotedProduct,
        QuotedProductSource,
        quoteCurrencyProvider,
        quotedProductSourceProvider,
        rfqRepositoryProvider;

/// The composition root.
///
/// Every feature declares its cross-feature dependencies as PORTS with
/// deliberately unhelpful defaults — some answer null, some throw. That is not
/// an oversight; it is what let four features be built at the same time without
/// importing each other's provider graphs. It does mean the app is inert until
/// something joins them up, and this is that something.
///
/// The rule for this file: it may KNOW about every feature, and no feature may
/// know about it. Anything resembling business logic has been put in the wrong
/// place — the only thing that belongs here is a wire from one feature's port
/// to another feature's implementation.
///
/// It returns the configured [ProviderScope] rather than a list of overrides
/// because Riverpod 3 does not export the `Override` type publicly, so a
/// `List<Override>` cannot be named outside the package.
ProviderScope appScope({required Widget child}) => ProviderScope(
      overrides: [
        // ── Commerce ─────────────────────────────────────────────────────
        // Both throw CommerceNotWired by default, so an unwired build fails
        // loudly at the first order screen rather than rendering an empty list
        // that reads as "you have never ordered anything".
        ordersGatewayProvider.overrideWith(
          (Ref ref) => ApiOrdersGateway(ref.watch(avenickApiProvider).orders),
        ),
        checkoutGatewayProvider.overrideWith(
          (Ref ref) =>
              ApiCheckoutGateway(ref.watch(avenickApiProvider).checkout),
        ),

        // ── Quote requests ───────────────────────────────────────────────
        // The app's primary funnel: every product in the production catalogue
        // answers `sellableInChannel: false`, so this is the path almost every
        // buyer actually takes.
        rfqRepositoryProvider.overrideWith(
          (Ref ref) => ApiRfqRepository(ref.watch(avenickApiProvider).rfqs),
        ),

        // Without this the quote form still works — a buyer can type what they
        // want — but it never learns the product's minimum order quantity, so
        // the MOQ rule silently stops applying and the form cheerfully sends a
        // request the supplier will decline.
        quotedProductSourceProvider.overrideWith(
          (Ref ref) => CatalogueQuotedProductSource(
            ref.watch(catalogueRepositoryProvider),
            channel: ref.watch(catalogueChannelProvider),
            currency: ref.watch(catalogueCurrencyProvider),
          ),
        ),

        // One currency decision for the whole app rather than two that can
        // disagree: a quote is priced in whatever the catalogue is priced in.
        quoteCurrencyProvider.overrideWith(
          (Ref ref) => ref.watch(catalogueCurrencyProvider),
        ),

        // ── Deliberately NOT wired: addToCartProvider ────────────────────
        //
        // The catalogue's buy box asks the app root for an add-to-cart action
        // and says "the basket is not connected in this build" when there is
        // none. That message is currently true, and connecting it would mean
        // breaking a rule that matters more than the feature.
        //
        // A cart line carries a LINE TOTAL, and this app computes no money —
        // every figure it shows was minted by the server, because the one time
        // totals were derived in two places they disagreed about VAT on the
        // delivery (PR #21). Building a line from a ProductDetail means
        // multiplying a unit price by a quantity on the client, which is that
        // same mistake in a new place. The fix is a server cart —
        // `POST /v1/cart/items` returning a priced line — which the contract
        // specifies and nothing implements yet.
        //
        // This costs nothing today: no product in the production catalogue is
        // purchasable, so the buy box reads "Request a quote" everywhere and
        // the add-to-cart path is unreachable. It becomes urgent the moment the
        // first product is flagged sellable.
      ],
      child: child,
    );

/// Resolves the product a quote is being requested for, from the catalogue.
///
/// The join between two features that must not import each other: `rfq` owns
/// the quote journey, `catalogue` owns product reads.
class CatalogueQuotedProductSource implements QuotedProductSource {
  const CatalogueQuotedProductSource(
    this._catalogue, {
    required Channel channel,
    required Currency? currency,
  })  : _channel = channel,
        _currency = currency;

  final CatalogueRepository _catalogue;
  final Channel _channel;
  final Currency? _currency;

  @override
  Future<QuotedProduct?> load(QuoteSubject subject) async {
    // `/rfq/new` with no product is the free-text request, and the form renders
    // it as one. Null is a valid answer here, not a failure.
    final String? slug = subject.slug;
    if (slug == null || slug.isEmpty) return null;

    // A lookup failure is also null rather than a throw: someone arriving from
    // a stale link should still be able to describe what they want, which is
    // the whole point of a quote request. The form then says the product could
    // not be loaded and stops applying a minimum it cannot know.
    try {
      final ProductDetail product = await _catalogue.product(
        slug,
        channel: _channel,
        currency: _currency,
      );
      return QuotedProduct(
        id: product.id,
        slug: product.slug,
        nameEn: product.nameEn,
        nameAr: product.nameAr,
        sku: product.sku,
        moq: product.moq,
      );
    } catch (_) {
      return null;
    }
  }
}
