import 'dart:convert';

import 'package:avenick/api/models/models.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fixtures.dart' as f;

/// JSON round trip for every schema in `openapi.json`.
///
/// The round trip is `fixture → model → JSON → model`, and the assertion is on
/// the two MODELS rather than on the two maps. That is the stronger check for
/// freezed classes: value equality compares every field, so a property that
/// silently failed to parse (and came back as null both times) still fails,
/// whereas a map comparison would have to special-case every optional key the
/// encoder emits as an explicit null.
///
/// A spot assertion on at least one distinctive field accompanies each type,
/// because a round trip alone would pass on a model that dropped a field
/// consistently in both directions.
void main() {
  /// Encode and re-decode through real JSON text, so anything that is not
  /// actually serialisable — a `Decimal`, a `DateTime`, an enum — is caught
  /// here rather than at runtime on a device.
  Map<String, dynamic> reencode(Object? toJsonResult) =>
      jsonDecode(jsonEncode(toJsonResult)) as Map<String, dynamic>;

  group('common', () {
    test('ImageRef round-trips, with and without its optional properties', () {
      final full = ImageRef.fromJson(f.image());
      expect(full, ImageRef.fromJson(reencode(full.toJson())));
      expect(full.blurhash, isNotNull);
      expect(full.alt, 'Brass gate valve');
      expect(full.hasIntrinsicSize, isTrue);
      expect(full.aspectRatio, 1.0);
      // A present ratio wins over the surface's own.
      expect(full.aspectRatioOr(4 / 5), 1.0);

      final minimal = ImageRef.fromJson(f.imageMinimal());
      expect(minimal, ImageRef.fromJson(reencode(minimal.toJson())));
      expect(minimal.blurhash, isNull);
      expect(minimal.alt, isNull);
      expect(minimal.aspectRatio, closeTo(4 / 3, 1e-9));
    });

    test('ImageRef parses a payload with NO dimensions at all', () {
      // ONLY `url` is required. `ProductImage` has no column for width,
      // height or blurhash, so this is the payload every live row sends —
      // and under the previous contract, where the two dimensions were
      // required, it took the entire pilot catalogue and every brand logo
      // down at the parse step.
      final bare = ImageRef.fromJson(f.imageNoDimensions());
      expect(bare, ImageRef.fromJson(reencode(bare.toJson())));
      expect(bare.url, 'https://cdn.avenick.com/p/valve-03.jpg');
      expect(bare.width, isNull);
      expect(bare.height, isNull);
      expect(bare.hasIntrinsicSize, isFalse);
      // Null, not 1.0. "The row does not record this" is a different claim
      // from "the picture is square", and a defaulted ratio is how a grid
      // reflows once the bytes land.
      expect(bare.aspectRatio, isNull);
      // The surface supplies its own ratio when the image cannot.
      expect(bare.aspectRatioOr(4 / 5), 4 / 5);
    });

    test('PageMeta round-trips and hides a cursor once hasMore is false', () {
      final more = PageMeta.fromJson(f.pageMeta());
      expect(more, PageMeta.fromJson(reencode(more.toJson())));
      expect(more.nextCursor, 'Y3VyOjQy');

      final last = PageMeta.fromJson(f.pageMeta(cursor: null, hasMore: false));
      expect(last, PageMeta.fromJson(reencode(last.toJson())));
      expect(last.nextCursor, isNull);
    });

    test('ApiError and ErrorEnvelope round-trip, fieldErrors included', () {
      final envelope = ErrorEnvelope.fromJson(
        f.errorEnvelope(
          fieldErrors: <String, dynamic>{
            'items.2.quantity': <dynamic>[
              'Must be at least the minimum order quantity.',
            ],
          },
        ),
      );
      expect(envelope, ErrorEnvelope.fromJson(reencode(envelope.toJson())));
      expect(envelope.error.code, ApiErrorCode.validationFailed);
      expect(envelope.error.fieldErrors!['items.2.quantity'], hasLength(1));

      final bare =
          ApiError.fromJson(f.apiError(code: 'internal', fieldErrors: null));
      expect(bare, ApiError.fromJson(reencode(bare.toJson())));
      expect(bare.fieldErrors, isNull);
    });
  });

  group('auth', () {
    test('AuthPrincipal round-trips', () {
      final model = AuthPrincipal.fromJson(f.authPrincipal());
      expect(model, AuthPrincipal.fromJson(reencode(model.toJson())));
      expect(model.role, UserRole.consumer);
      expect(model.language, Language.en);
      expect(model.displayName, 'Salim Al Habsi');
    });

    test('TokenPair round-trips and never prints either token', () {
      final model = TokenPair.fromJson(f.tokenPair());
      expect(model, TokenPair.fromJson(reencode(model.toJson())));
      expect(model.tokenType, TokenType.bearer);
      expect(model.accessLifetime, const Duration(minutes: 15));

      final printed = model.toString();
      expect(printed, isNot(contains('access-1')));
      expect(printed, isNot(contains('refresh-1')));
      expect(printed, contains('<redacted>'));
    });

    test('OtpChallenge round-trips and computes its resend countdown', () {
      final model = OtpChallenge.fromJson(f.otpChallenge());
      expect(model, OtpChallenge.fromJson(reencode(model.toJson())));
      expect(model.codeLength, 6);
      expect(
        model.timeToResend(DateTime.utc(2026, 9, 5, 10)),
        const Duration(seconds: 30),
      );
      expect(model.timeToResend(DateTime.utc(2026, 9, 5, 11)), Duration.zero);
      expect(model.isExpired(DateTime.utc(2026, 9, 5, 11)), isTrue);
    });

    test('Revocation round-trips', () {
      final model = Revocation.fromJson(f.revocation());
      expect(model, Revocation.fromJson(reencode(model.toJson())));
      expect(model.revokedCount, 3);
    });
  });

  group('cart', () {
    test('CartLine round-trips and exposes typed money', () {
      final model = CartLine.fromJson(f.cartLine());
      expect(model, CartLine.fromJson(reencode(model.toJson())));
      expect(model.currency, Currency.aed);
      expect(model.unitPriceMoney.format(), '12.34 AED');
      expect(model.lineTotalMoney.format(), '24.68 AED');
      expect(model.variantId, isNull);
      expect(model.isBelowMoq, isFalse);
      expect(model.sellableInChannel, isTrue);
      expect(model.isQuoteOnly, isFalse);
    });

    test('a quote-only CartLine blocks the checkout it looks fine in', () {
      // Priced, in stock, above its MOQ — and the order service will refuse
      // it. Without the flag there is nothing on this line to see that by.
      final model = CartLine.fromJson(f.cartLine(sellableInChannel: false));
      expect(model, CartLine.fromJson(reencode(model.toJson())));
      expect(model.isQuoteOnly, isTrue);
      expect(model.isBelowMoq, isFalse);
      expect(model.availability, Availability.inStock);

      final cart = Cart.fromJson(<String, dynamic>{
        ...f.cart(),
        'lines': <dynamic>[f.cartLine(sellableInChannel: false)],
      });
      expect(cart.blockingLines, hasLength(1));
      expect(cart.quoteOnlyLines, hasLength(1));
    });

    test('Cart round-trips and its subtotal agrees with its lines', () {
      final model = Cart.fromJson(f.cart());
      expect(model, Cart.fromJson(reencode(model.toJson())));
      expect(model.subtotalAgrees, isTrue);
      expect(model.blockingLines, isEmpty);
    });

    test('CartMergeResult round-trips and keeps the rejections', () {
      final model = CartMergeResult.fromJson(f.cartMergeResult());
      expect(model, CartMergeResult.fromJson(reencode(model.toJson())));
      expect(model.isClean, isFalse);
      expect(
        model.rejected.single.reason,
        CartMergeRejectionReason.insufficientStock,
      );
      expect(model.rejected.single.acceptedQty, 3);
    });
  });

  group('checkout', () {
    test('ShippingAddress round-trips', () {
      final model = ShippingAddress.fromJson(f.shippingAddress());
      expect(model, ShippingAddress.fromJson(reencode(model.toJson())));
      expect(model.country, Country.ae);
    });

    test('QuoteLine round-trips', () {
      final model = QuoteLine.fromJson(f.quoteLine());
      expect(model, QuoteLine.fromJson(reencode(model.toJson())));
      expect(model.vatAmountIn(Currency.aed).format(), '1.23 AED');
    });

    test('ShippingQuote round-trips and distinguishes unpriced from free', () {
      final priced = ShippingQuote.fromJson(f.shippingQuote());
      expect(priced, ShippingQuote.fromJson(reencode(priced.toJson())));
      expect(priced.isPriced, isTrue);
      expect(priced.freightQuotedSeparately, isFalse);

      final unpriced = ShippingQuote.fromJson(
        f.shippingQuote(status: 'unpriced_no_zones', amount: 0),
      );
      expect(unpriced.isPriced, isFalse);
      // Zero here means UNKNOWN, not free. The flag is what says so.
      expect(unpriced.freightQuotedSeparately, isTrue);
      expect(unpriced.amountIn(Currency.aed).isZero, isTrue);
    });

    test('AppliedPromotion round-trips', () {
      final model = AppliedPromotion.fromJson(f.appliedPromotion());
      expect(model, AppliedPromotion.fromJson(reencode(model.toJson())));
      expect(model.couponCode, 'WELCOME10');
    });

    test('CheckoutQuote round-trips whole, totals included', () {
      final model = CheckoutQuote.fromJson(f.checkoutQuote());
      expect(model, CheckoutQuote.fromJson(reencode(model.toJson())));
      expect(model.currency, Currency.aed);
      expect(model.channel, Channel.b2c);
      expect(model.money.total.format(), '44.32 AED');
      expect(model.chargesVatOnShipping, isTrue);
      expect(model.isExpired(DateTime.utc(2026, 9, 5, 10)), isFalse);
      expect(model.isExpired(DateTime.utc(2026, 9, 5, 11)), isTrue);
    });
  });

  group('catalogue', () {
    test('RatingSummary round-trips', () {
      final model = RatingSummary.fromJson(f.ratingSummary());
      expect(model, RatingSummary.fromJson(reencode(model.toJson())));
      expect(model.average, 4.5);
    });

    test('CardPrice round-trips', () {
      final model = CardPrice.fromJson(f.cardPrice());
      expect(model, CardPrice.fromJson(reencode(model.toJson())));
      expect(model.isFrom, isTrue);
      expect(model.money.format(), '12.34 AED');
    });

    test('PriceBand round-trips, open-ended top band included', () {
      final closed = PriceBand.fromJson(f.priceBand());
      expect(closed, PriceBand.fromJson(reencode(closed.toJson())));
      expect(closed.covers(5), isTrue);
      expect(closed.covers(50), isFalse);

      final open = PriceBand.fromJson(f.priceBand(minQty: 10, maxQty: null));
      expect(open, PriceBand.fromJson(reencode(open.toJson())));
      expect(open.maxQty, isNull);
      expect(open.covers(100000), isTrue);
    });

    test('ProductVariant round-trips, mixed-type attributes included', () {
      final model = ProductVariant.fromJson(f.productVariant());
      expect(model, ProductVariant.fromJson(reencode(model.toJson())));
      expect(model.attributes['finish'], 'bronze');
      expect(model.attributes['pressureBar'], 16);
      expect(model.attributes['leadFree'], true);
      expect(
        model
            .bandFor(quantity: 50, channel: Channel.b2c, currency: Currency.aed)
            ?.minQty,
        10,
      );
    });

    test('SellerSummary round-trips', () {
      final model = SellerSummary.fromJson(f.sellerSummary());
      expect(model, SellerSummary.fromJson(reencode(model.toJson())));
      expect(model.tier, SellerTier.verified);
      expect(model.businessNameAr, isNull);
    });

    test('ProductCard round-trips, fully populated and fully bare', () {
      final full = ProductCard.fromJson(f.productCard());
      expect(full, ProductCard.fromJson(reencode(full.toJson())));
      expect(full.name(Language.ar), 'محبس نحاسي ٢ بوصة');
      expect(full.price!.money.format(), '12.34 AED');
      expect(full.sellableInChannel, isTrue);

      final bare = ProductCard.fromJson(f.productCardBare());
      expect(bare, ProductCard.fromJson(reencode(bare.toJson())));
      // An unpriced product is a real row. It must parse, and its price must
      // stay null rather than becoming zero.
      expect(bare.price, isNull);
      expect(bare.image, isNull);
      expect(bare.rating, isNull);
      expect(bare.brandName, isNull);
      expect(bare.availability, Availability.unconfirmed);
      expect(bare.sellableInChannel, isFalse);
    });

    test('a ProductCard can be priced and still not sellable', () {
      // THE PRODUCTION SHAPE. `pilot-catalog.ts` writes isB2CEnabled: false on
      // every row it imports and prices them in B2C anyway, so a resolved
      // price and permission to sell are two different facts on all 1,172
      // live rows. The model has to keep them apart, because a client that
      // collapses them renders Add to cart on the whole catalogue.
      final model = ProductCard.fromJson(f.productCardPricedNotSellable());
      expect(model, ProductCard.fromJson(reencode(model.toJson())));
      expect(model.price, isNotNull);
      expect(model.price!.money.format(), '12.34 AED');
      expect(model.sellableInChannel, isFalse);
    });

    test('ProductDetail round-trips, inline brand and category included', () {
      final model = ProductDetail.fromJson(f.productDetail());
      expect(model, ProductDetail.fromJson(reencode(model.toJson())));
      expect(model.brand!.nameEn, 'Gulf Valve');
      expect(model.category.slug, 'valves');
      expect(model.images, hasLength(3));
      expect(model.sellableInChannel, isTrue);
      // The third descriptor carries a URL and nothing else — the shape the
      // database can actually produce.
      expect(model.images.last.hasIntrinsicSize, isFalse);
      expect(model.hasVariants, isTrue);
      expect(
        model.isTiered(channel: Channel.b2c, currency: Currency.aed),
        isTrue,
      );
      expect(model.description(Language.ar), 'Rising-stem gate valve, PN16.');
    });

    test('a ProductDetail can carry a full price ladder and refuse the sale',
        () {
      final model =
          ProductDetail.fromJson(f.productDetailPricedNotSellable());
      expect(model, ProductDetail.fromJson(reencode(model.toJson())));
      expect(model.channel, Channel.b2c);
      expect(
        model.isTiered(channel: Channel.b2c, currency: Currency.aed),
        isTrue,
      );
      expect(model.sellableInChannel, isFalse);
    });

    test('Category round-trips', () {
      final model = Category.fromJson(f.category());
      expect(model, Category.fromJson(reencode(model.toJson())));
      expect(model.isRoot, isTrue);
    });

    test('Brand round-trips', () {
      final model = Brand.fromJson(f.brand());
      expect(model, Brand.fromJson(reencode(model.toJson())));
      expect(model.name(Language.ar), 'Gulf Valve');
    });
  });

  group('orders', () {
    test('OrderItem round-trips', () {
      final model = OrderItem.fromJson(f.orderItem());
      expect(model, OrderItem.fromJson(reencode(model.toJson())));
      expect(model.status, OrderStatus.shipped);
      expect(model.hasProductPage, isTrue);
      expect(model.totalIn(Currency.aed).format(), '24.68 AED');
    });

    test('OrderStatusEvent round-trips', () {
      final model = OrderStatusEvent.fromJson(f.orderStatusEvent());
      expect(model, OrderStatusEvent.fromJson(reencode(model.toJson())));
      expect(model.occurredAt.isUtc, isTrue);
    });

    test('Shipment round-trips', () {
      final model = Shipment.fromJson(f.shipment());
      expect(model, Shipment.fromJson(reencode(model.toJson())));
      expect(model.isTrackable, isTrue);
      expect(model.status, ShipmentStatus.inTransit);
    });

    test('OrderCard round-trips', () {
      final model = OrderCard.fromJson(f.orderCard());
      expect(model, OrderCard.fromJson(reencode(model.toJson())));
      expect(model.type, Channel.b2c);
      expect(model.totalMoney.format(), '44.32 AED');
    });

    test('OrderDetail round-trips', () {
      final model = OrderDetail.fromJson(f.orderDetail());
      expect(model, OrderDetail.fromJson(reencode(model.toJson())));
      expect(model.paymentMethod, PaymentMethod.creditCard);
      expect(model.hasInvoice, isTrue);
      expect(model.timeline, hasLength(1));
      expect(model.money.total.format(), '44.32 AED');
    });

    test('PlacedOrder round-trips and keeps the replay flag apart', () {
      final placed = PlacedOrder.fromJson(f.placedOrder());
      expect(placed, PlacedOrder.fromJson(reencode(placed.toJson())));
      expect(placed.replayed, isFalse);
      expect(placed.isNew, isTrue);
      expect(placed.orderNumber, 'AVN-2026-000123');
      expect(placed.order.money.total.format(), '44.32 AED');

      // The SAME order coming back under the same Idempotency-Key. Both are
      // successes; only one of them is a purchase that just happened, and a
      // confirmation screen that cannot tell them apart tells a buyer who
      // tapped twice that they bought two.
      final replay = PlacedOrder.fromJson(f.placedOrder(replayed: true));
      expect(replay, PlacedOrder.fromJson(reencode(replay.toJson())));
      expect(replay.replayed, isTrue);
      expect(replay.isNew, isFalse);
      expect(replay.order, placed.order);
    });
  });

  group('rfqs', () {
    test('RfqSeller round-trips', () {
      final model = RfqSeller.fromJson(f.rfqSeller());
      expect(model, RfqSeller.fromJson(reencode(model.toJson())));
      expect(model.tier, SellerTier.verified);
    });

    test('RfqItem round-trips, catalogue line and free-text line', () {
      final quoted = RfqItem.fromJson(f.rfqItem());
      expect(quoted, RfqItem.fromJson(reencode(quoted.toJson())));
      expect(quoted.isCatalogueLine, isTrue);
      expect(quoted.isQuoted, isTrue);
      expect(quoted.unitQuotedIn(Currency.aed)!.format(), '11.50 AED');

      final free = RfqItem.fromJson(f.rfqItemFreeText());
      expect(free, RfqItem.fromJson(reencode(free.toJson())));
      expect(free.productId, isNull);
      expect(free.isCatalogueLine, isFalse);
      // Not yet priced. Null is not zero — a line with no price must render
      // as awaiting a quote, never as free.
      expect(free.isQuoted, isFalse);
      expect(free.unitQuotedIn(Currency.aed), isNull);
    });

    test('RfqCard round-trips, quoted and not yet quoted', () {
      final quoted = RfqCard.fromJson(f.rfqCard());
      expect(quoted, RfqCard.fromJson(reencode(quoted.toJson())));
      expect(quoted.status, RfqStatus.quoted);
      expect(quoted.seller!.businessNameEn, 'Gulf Valve Trading');
      expect(quoted.totalQuotedMoney!.format(), '2,875.00 AED');
      expect(quoted.awaitsDecision, isTrue);

      final open = RfqCard.fromJson(f.rfqCardUnquoted());
      expect(open, RfqCard.fromJson(reencode(open.toJson())));
      expect(open.status, RfqStatus.submitted);
      expect(open.seller, isNull);
      expect(open.totalQuoted, isNull);
      expect(open.totalQuotedMoney, isNull);
      expect(open.quoteVersion, 0);
      expect(open.awaitsDecision, isFalse);
    });

    test('RfqDetail round-trips, and models ONE supplier — no quotes array',
        () {
      final model = RfqDetail.fromJson(f.rfqDetail());
      expect(model, RfqDetail.fromJson(reencode(model.toJson())));
      expect(model.items, hasLength(2));
      expect(model.quotedItems, hasLength(1));
      expect(model.quoteVersion, 2);
      expect(model.totalQuotedMoney!.format(), '2,875.00 AED');
      expect(model.awaitsDecision, isTrue);
      expect(model.isExpired(DateTime.utc(2026, 9, 10)), isFalse);
      expect(model.isExpired(DateTime.utc(2026, 9, 20)), isTrue);

      // RFQRequest.sellerId is a single nullable column and submitQuote is
      // its only writer, so there is at most ONE supplier's prices here. The
      // schema refuses a `quotes` key outright; this model does not have one
      // to serialise, and a comparison screen would be a claim about a market
      // that was never surveyed.
      expect(model.toJson().containsKey('quotes'), isFalse);
      expect(model.seller, isNotNull);
    });

    test('an RFQ nobody has priced is not a decision the buyer can make', () {
      final model = RfqDetail.fromJson(
        f.rfqDetail(status: 'SUBMITTED', totalQuoted: null, quoteVersion: 0),
      );
      expect(model, RfqDetail.fromJson(reencode(model.toJson())));
      expect(model.isQuoted, isFalse);
      expect(model.awaitsDecision, isFalse);
      expect(model.status.isDecidable, isFalse);
      expect(model.status.isClosed, isFalse);

      // And a request that HAS been quoted but then accepted is closed: the
      // decision has already been taken.
      final done = RfqDetail.fromJson(f.rfqDetail(status: 'ACCEPTED'));
      expect(done.status.isClosed, isTrue);
      expect(done.awaitsDecision, isFalse);
    });

    test('an RFQ with no expiry never expires', () {
      final model = RfqDetail.fromJson(f.rfqDetail(expiresAt: null));
      expect(model, RfqDetail.fromJson(reencode(model.toJson())));
      expect(model.expiresAt, isNull);
      expect(model.isExpired(DateTime.utc(2030)), isFalse);
    });
  });

  group('account', () {
    test('CompanyMembership round-trips', () {
      final model = CompanyMembership.fromJson(f.companyMembership());
      expect(model, CompanyMembership.fromJson(reencode(model.toJson())));
      // CompanyStatus, not UserStatus — the value sets differ.
      expect(model.status, CompanyStatus.active);
      expect(model.canTradeB2b, isTrue);
    });

    test('Me round-trips', () {
      final model = Me.fromJson(f.me());
      expect(model, Me.fromJson(reencode(model.toJson())));
      expect(model.displayName(Language.ar), 'سالم الحبسي');
      expect(model.displayName(Language.en), 'Salim Al Habsi');
      expect(model.isB2bBuyer, isTrue);
      expect(model.canTransact, isTrue);
    });

    test('AccountDeletion round-trips and reports its grace period', () {
      final model = AccountDeletion.fromJson(f.accountDeletion());
      expect(model, AccountDeletion.fromJson(reencode(model.toJson())));
      expect(model.status, AccountDeletionStatus.scheduled);
      expect(model.gracePeriod(), const Duration(days: 30));
    });

    test('Address round-trips and narrows to a shipping address', () {
      final model = Address.fromJson(f.address());
      expect(model, Address.fromJson(reencode(model.toJson())));
      expect(model.hasCoordinates, isTrue);
      // The nulls are OMITTED, not sent: `line2` is `.optional()`, so an
      // explicit null would be a 400.
      expect(model.toShippingAddressJson().containsKey('line2'), isFalse);
      expect(model.toShippingAddressJson()['country'], 'AE');
    });

    test('AddressDeleted round-trips', () {
      final model = AddressDeleted.fromJson(f.addressDeleted());
      expect(model, AddressDeleted.fromJson(reencode(model.toJson())));
      expect(model.deleted, isTrue);
    });

    test('Device round-trips and never carries a push token', () {
      final model = Device.fromJson(f.device());
      expect(model, Device.fromJson(reencode(model.toJson())));
      expect(model.platform, DevicePlatform.ios);
      expect(model.toJson().containsKey('pushToken'), isFalse);
    });

    test('DeviceDeleted round-trips', () {
      final model = DeviceDeleted.fromJson(f.deviceDeleted());
      expect(model, DeviceDeleted.fromJson(reencode(model.toJson())));
    });
  });
}
