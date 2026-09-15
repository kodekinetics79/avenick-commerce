import 'package:flutter/foundation.dart';

import '../../../api/models/enums.dart';

/// WHAT THE QUOTE FORM WAS ASKED ABOUT — the parsed query string.
///
/// The route is `/rfq/new?productId=…&slug=…&qty=…`, minted by
/// `openQuoteRequest` in `lib/features/catalogue/catalogue_context.dart`, and
/// all three parts are carried because each answers a case the others cannot:
///
///  * `productId` is what `POST /v1/rfqs` wants — an `RfqLineInput` naming a
///    catalogue product, whose `nameEn` the server resolves itself.
///  * `slug` is the fallback for the one screen that most needs this action and
///    has no id: a deep link that 404s *because* the product is not sold on
///    this channel never received a product body at all.
///  * `qty` is the quantity from the buy box. Asking for it again on the next
///    screen is asking the buyer to repeat themselves.
///
/// Every field is nullable and none is trusted: a query string arrives from a
/// deep link, a push notification and a pasted URL, so [QuoteSubject.fromQuery]
/// parses rather than casts and a `qty=abc` becomes "no quantity stated" and
/// not a crash on the app's primary journey.
@immutable
class QuoteSubject {
  const QuoteSubject({this.productId, this.slug, this.quantity});

  /// Parse `state.uri.queryParameters` straight from the router.
  factory QuoteSubject.fromQuery(Map<String, String> query) {
    final String? qty = query['qty'];
    final int? parsed = qty == null ? null : int.tryParse(qty.trim());
    return QuoteSubject(
      productId: _clean(query['productId']),
      slug: _clean(query['slug']),
      // A zero or a negative in a URL is not a quantity. Dropping it lets the
      // form fall back to the MOQ, which is a better answer than 0.
      quantity: parsed != null && parsed > 0 ? parsed : null,
    );
  }

  final String? productId;
  final String? slug;
  final int? quantity;

  /// True when there is nothing at all to look up or name.
  ///
  /// Reachable: `/rfq/new` with no query, which is the "ask for something the
  /// catalogue does not list" entry point. The form handles it — a free-text
  /// line — rather than treating it as an error.
  bool get isBlank => productId == null && slug == null;

  static String? _clean(String? value) {
    final String? trimmed = value?.trim();
    return trimmed == null || trimmed.isEmpty ? null : trimmed;
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is QuoteSubject &&
          other.productId == productId &&
          other.slug == slug &&
          other.quantity == quantity);

  @override
  int get hashCode => Object.hash(productId, slug, quantity);

  @override
  String toString() =>
      'QuoteSubject(productId: $productId, slug: $slug, qty: $quantity)';
}

/// WHAT THE QUOTE FORM NEEDS TO KNOW ABOUT THE THING BEING QUOTED.
///
/// Deliberately NOT `ProductDetail`. This feature needs six fields, and taking
/// the catalogue's model would mean this screen could not be built or tested
/// without the catalogue's repository, its channel/currency providers and its
/// paging. The catalogue can satisfy this in an adapter of four lines; see
/// [QuotedProductSource].
@immutable
class QuotedProduct {
  const QuotedProduct({
    required this.id,
    required this.slug,
    required this.nameEn,
    required this.nameAr,
    required this.sku,
    required this.moq,
  });

  final String id;
  final String slug;
  final String nameEn;
  final String? nameAr;

  /// The supplier's part number. A machine-readable token — always isolated.
  final String? sku;

  /// MINIMUM ORDER QUANTITY, as `ProductDetail.moq` states it.
  ///
  /// 1 means "no minimum", which is what the catalogue sends for a product
  /// without one — it is not a null this app has to guess at. A request under
  /// the minimum is one a supplier will not quote, so the form refuses it
  /// rather than sending a number that comes back as a decline.
  final int moq;

  String name(Language language) =>
      language == Language.ar ? (nameAr ?? nameEn) : nameEn;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is QuotedProduct &&
          other.id == id &&
          other.slug == slug &&
          other.nameEn == nameEn &&
          other.nameAr == nameAr &&
          other.sku == sku &&
          other.moq == moq);

  @override
  int get hashCode => Object.hash(id, slug, nameEn, nameAr, sku, moq);
}

/// Where the form gets [QuotedProduct] from.
///
/// A PORT, with an honest default, for the same reason `sellerNamesProvider`
/// in the commerce feature is one: the catalogue owns product reads, this
/// feature owns the quote journey, and a cross-feature import would couple the
/// app's primary funnel to another team's provider graph.
///
/// WIRING (composition root, one line):
///
///     quotedProductSourceProvider.overrideWith(
///       (Ref ref) => CatalogueQuotedProductSource(
///         ref.read(catalogueRepositoryProvider),
///       ),
///     )
abstract interface class QuotedProductSource {
  /// Resolve the product a quote is being requested for.
  ///
  /// Returns null when [subject] names nothing resolvable. Null is NOT an
  /// error: `/rfq/new` with no product is the free-text request, and the form
  /// renders it as one.
  Future<QuotedProduct?> load(QuoteSubject subject);
}

/// The default: it does not know what the product is.
///
/// It answers null rather than throwing, because a form that cannot name the
/// product can still send a perfectly good request — the buyer types what they
/// want. What it must NOT do is invent a minimum order quantity, so with this
/// source in place the MOQ rule is simply not applied and the form says the
/// product could not be loaded.
class UnresolvedQuotedProductSource implements QuotedProductSource {
  const UnresolvedQuotedProductSource();

  @override
  Future<QuotedProduct?> load(QuoteSubject subject) async => null;
}
