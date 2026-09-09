/// Response fixtures, built from the SHAPES in `packages/contracts/openapi.json`.
///
/// Every map here is a payload the spec would accept: every required property
/// present, every nullable one exercised at least once across the file, every
/// enum value spelled the way the wire spells it (SCREAMING_SNAKE for the
/// Prisma-mirrored enums, lower_snake for the hand-written ones), and every
/// money field a JSON number in major units with two decimal places — which is
/// what `MoneySchema` and `composeOrderTotals`'s `Number(v.toFixed(2))`
/// actually produce.
///
/// They are written as Dart maps rather than JSON strings so a typo is a
/// compile error, and they are all `Map<String, dynamic>` because that is what
/// `dart:convert` hands a decoder.
library;

Map<String, dynamic> image() => <String, dynamic>{
      'url': 'https://cdn.avenick.com/p/valve-01.jpg',
      'width': 1200,
      'height': 1200,
      'blurhash': 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
      'alt': 'Brass gate valve',
    };

/// The same descriptor with both optional properties absent — older rows have
/// no blurhash and sellers do not always supply alt text.
Map<String, dynamic> imageMinimal() => <String, dynamic>{
      'url': 'https://cdn.avenick.com/p/valve-02.jpg',
      'width': 800,
      'height': 600,
    };

/// THE PAYLOAD EVERY LIVE ROW ACTUALLY SENDS: a URL and nothing else.
///
/// `ProductImage` has columns for `url`, `altEn`, `altAr`, `isPrimary` and
/// `sortOrder` and none for the dimensions, so this — not [image] — is what
/// the pilot catalogue and every brand logo produce. Under the previous
/// contract, where `width` and `height` were required, this payload failed to
/// parse and took the whole catalogue with it.
Map<String, dynamic> imageNoDimensions() => <String, dynamic>{
      'url': 'https://cdn.avenick.com/p/valve-03.jpg',
    };

Map<String, dynamic> pageMeta({
  String? cursor = 'Y3VyOjQy',
  bool hasMore = true,
}) =>
    <String, dynamic>{'cursor': cursor, 'hasMore': hasMore};

Map<String, dynamic> apiError({
  String code = 'validation_failed',
  String message = 'The request is not valid.',
  String requestId = 'req_01HZY8',
  Map<String, dynamic>? fieldErrors,
}) =>
    <String, dynamic>{
      'code': code,
      'message': message,
      'requestId': requestId,
      if (fieldErrors != null) 'fieldErrors': fieldErrors,
    };

Map<String, dynamic> errorEnvelope({
  String code = 'validation_failed',
  String message = 'The request is not valid.',
  String requestId = 'req_01HZY8',
  Map<String, dynamic>? fieldErrors,
}) =>
    <String, dynamic>{
      'error': apiError(
        code: code,
        message: message,
        requestId: requestId,
        fieldErrors: fieldErrors,
      ),
    };

Map<String, dynamic> authPrincipal() => <String, dynamic>{
      'id': 'usr_01HZ',
      'email': 'buyer@example.ae',
      'firstName': 'Salim',
      'lastName': 'Al Habsi',
      'role': 'CONSUMER',
      'language': 'EN',
    };

Map<String, dynamic> tokenPair({
  String accessToken = 'access-1',
  String refreshToken = 'refresh-1',
}) =>
    <String, dynamic>{
      'tokenType': 'Bearer',
      'accessToken': accessToken,
      'expiresIn': 900,
      'refreshToken': refreshToken,
      'refreshExpiresIn': 2592000,
      'principal': authPrincipal(),
    };

Map<String, dynamic> otpChallenge() => <String, dynamic>{
      'challengeId': 'otp_01HZ',
      'codeLength': 6,
      'expiresAt': '2026-09-05T10:05:00.000Z',
      'resendAfter': '2026-09-05T10:00:30.000Z',
    };

Map<String, dynamic> revocation() => <String, dynamic>{'revokedCount': 3};

Map<String, dynamic> cartLine({
  String id = 'cl_1',
  String currency = 'AED',
  num unitPrice = 12.34,
  num lineTotal = 24.68,
  int qty = 2,
  bool sellableInChannel = true,
}) =>
    <String, dynamic>{
      'id': id,
      'productId': 'prd_1',
      'variantId': null,
      'sellerId': 'sel_1',
      'slug': 'brass-gate-valve-2-inch',
      'sku': 'BGV-2',
      'nameEn': 'Brass gate valve 2"',
      'nameAr': 'محبس نحاسي ٢ بوصة',
      'image': image(),
      'channel': 'B2C',
      'qty': qty,
      'moq': 1,
      'unitPrice': unitPrice,
      'currency': currency,
      'vatRatePercent': 5,
      'priceTiered': false,
      'availability': 'IN_STOCK',
      'sellableInChannel': sellableInChannel,
      'lineTotal': lineTotal,
    };

Map<String, dynamic> cart({String currency = 'AED', num subtotal = 24.68}) =>
    <String, dynamic>{
      'id': 'cart_1',
      'currency': currency,
      'lines': <dynamic>[cartLine(currency: currency)],
      'itemCount': 2,
      'subtotal': subtotal,
      'updatedAt': '2026-09-05T09:59:00.000Z',
    };

Map<String, dynamic> cartMergeRejection() => <String, dynamic>{
      'productId': 'prd_9',
      'variantId': 'var_9',
      'reason': 'insufficient_stock',
      'acceptedQty': 3,
    };

Map<String, dynamic> cartMergeResult() => <String, dynamic>{
      'cart': cart(),
      'rejected': <dynamic>[cartMergeRejection()],
    };

Map<String, dynamic> shippingAddress() => <String, dynamic>{
      'label': 'Warehouse',
      'line1': 'Plot 42, Industrial Area 3',
      'line2': 'Gate B',
      'city': 'Sharjah',
      'country': 'AE',
      'postalCode': '00000',
    };

Map<String, dynamic> quoteLine({num unitPrice = 12.34, num vatAmount = 1.23}) =>
    <String, dynamic>{
      'productId': 'prd_1',
      'variantId': null,
      'sellerId': 'sel_1',
      'sku': 'BGV-2',
      'nameEn': 'Brass gate valve 2"',
      'nameAr': 'محبس نحاسي ٢ بوصة',
      'quantity': 2,
      'unitPrice': unitPrice,
      'vatRatePercent': 5,
      'vatAmount': vatAmount,
      'lineTotal': 24.68,
    };

Map<String, dynamic> shippingQuote({
  String status = 'priced',
  num amount = 20.00,
  num vatRatePercent = 5,
}) =>
    <String, dynamic>{
      'status': status,
      'zoneName': 'Northern Emirates',
      'amount': amount,
      'vatRatePercent': vatRatePercent,
      'estimatedDaysMin': 2,
      'estimatedDaysMax': 4,
    };

Map<String, dynamic> appliedPromotion() => <String, dynamic>{
      'promotionId': 'promo_1',
      'couponCode': 'WELCOME10',
      'label': '10% off your first order',
      'discountAmount': 2.47,
    };

/// CORRECT totals: VAT is charged on the goods AND on the delivery, and the
/// two components add up to `vatAmount`.
///
///   subtotal 24.68, discount 2.47  → net goods 22.21
///   goods VAT  @5%                 →  1.11
///   shipping   20.00
///   shipping VAT @5%               →  1.00
///   vatAmount  = 1.11 + 1.00       =  2.11
///   total      = 22.21 + 1.11 + 20.00 + 1.00 = 44.32
Map<String, dynamic> orderTotals() => <String, dynamic>{
      'subtotal': 24.68,
      'discountAmount': 2.47,
      'goodsVatAmount': 1.11,
      'shippingAmount': 20.00,
      'shippingVatAmount': 1.00,
      'vatAmount': 2.11,
      'total': 44.32,
    };

/// THE PR #21 DEFECT, as a payload.
///
/// `vatAmount` carries only the GOODS VAT, and the total is
/// `net goods + goodsVat + shipping` — freight added after tax. Every figure
/// agrees with every other figure, which is exactly why it went unnoticed:
/// nothing about this payload looks wrong until you check that the VAT
/// components sum to the VAT charged. They do not.
Map<String, dynamic> orderTotalsWithCollapsedVat() => <String, dynamic>{
      'subtotal': 24.68,
      'discountAmount': 2.47,
      'goodsVatAmount': 1.11,
      'shippingAmount': 20.00,
      'shippingVatAmount': 1.00,
      // Should be 2.11. Only the goods VAT was recorded.
      'vatAmount': 1.11,
      'total': 43.32,
    };

/// A zero-rated jurisdiction (QA, KW carry rate 0). The shipping VAT component
/// is present and ZERO, which is a different fact from it being absent.
Map<String, dynamic> orderTotalsZeroRated() => <String, dynamic>{
      'subtotal': 100.00,
      'discountAmount': 0.00,
      'goodsVatAmount': 0.00,
      'shippingAmount': 15.00,
      'shippingVatAmount': 0.00,
      'vatAmount': 0.00,
      'total': 115.00,
    };

Map<String, dynamic> checkoutQuote({
  Map<String, dynamic>? totals,
  String currency = 'AED',
}) =>
    <String, dynamic>{
      'quoteId': 'quo_1',
      'currency': currency,
      'channel': 'B2C',
      'vatRatePercent': 5,
      'lines': <dynamic>[quoteLine()],
      'shipping': shippingQuote(),
      'promotions': <dynamic>[appliedPromotion()],
      'totals': totals ?? orderTotals(),
      'expiresAt': '2026-09-05T10:15:00.000Z',
    };

Map<String, dynamic> ratingSummary() =>
    <String, dynamic>{'average': 4.5, 'count': 12};

Map<String, dynamic> cardPrice({String currency = 'AED', num amount = 12.34}) =>
    <String, dynamic>{
      'amount': amount,
      'currency': currency,
      'vatRatePercent': 5,
      'isFrom': true,
    };

Map<String, dynamic> priceBand({
  String currency = 'AED',
  int minQty = 1,
  int? maxQty = 9,
}) =>
    <String, dynamic>{
      'channel': 'B2C',
      'currency': currency,
      'minQty': minQty,
      'maxQty': maxQty,
      'price': 12.34,
      'vatRatePercent': 5,
    };

Map<String, dynamic> productVariant() => <String, dynamic>{
      'id': 'var_1',
      'sku': 'BGV-2-BRZ',
      'nameEn': 'Bronze',
      'nameAr': null,
      'attributes': <String, dynamic>{
        'finish': 'bronze',
        'pressureBar': 16,
        'leadFree': true,
      },
      'prices': <dynamic>[priceBand(), priceBand(minQty: 10, maxQty: null)],
      'availability': 'IN_STOCK',
      'availableQty': 240,
    };

Map<String, dynamic> sellerSummary() => <String, dynamic>{
      'id': 'sel_1',
      'businessNameEn': 'Gulf Valve Trading',
      'businessNameAr': null,
      'tier': 'VERIFIED',
      'city': 'Dubai',
      'country': 'AE',
      'rating': ratingSummary(),
    };

Map<String, dynamic> productCard() => <String, dynamic>{
      'id': 'prd_1',
      'slug': 'brass-gate-valve-2-inch',
      'nameEn': 'Brass gate valve 2"',
      'nameAr': 'محبس نحاسي ٢ بوصة',
      'image': image(),
      'price': cardPrice(),
      'moq': 1,
      'availability': 'IN_STOCK',
      'priceTiered': true,
      'rating': ratingSummary(),
      'brandName': 'Gulf Valve',
      'sellableInChannel': true,
    };

/// THE PILOT-CATALOGUE ROW. Priced in B2C and NOT sellable in it.
///
/// `pilot-catalog.ts` writes `isB2CEnabled: false` on every product it imports
/// and prices them anyway, so this shape — a resolved `CardPrice` beside
/// `sellableInChannel: false` — is what all 1,172 production rows look like.
/// It is the payload that renders Add to cart on a client that reads
/// sellability off the price.
Map<String, dynamic> productCardPricedNotSellable() => <String, dynamic>{
      ...productCard(),
      'id': 'prd_pilot',
      'slug': 'pilot-cast-iron-y-strainer',
      'nameEn': 'Cast iron Y-strainer DN100',
      'sellableInChannel': false,
    };

/// The same card with every nullable property null — an unpriced product with
/// no image, no reviews and no brand is a real catalogue row, not an error.
Map<String, dynamic> productCardBare() => <String, dynamic>{
      'id': 'prd_2',
      'slug': 'unlisted-fitting',
      'nameEn': 'Unlisted fitting',
      'nameAr': 'وصلة غير مدرجة',
      'image': null,
      'price': null,
      'moq': 25,
      'availability': 'UNCONFIRMED',
      'priceTiered': false,
      'rating': null,
      'brandName': null,
      'sellableInChannel': false,
    };

Map<String, dynamic> productDetail() => <String, dynamic>{
      'id': 'prd_1',
      'slug': 'brass-gate-valve-2-inch',
      'sku': 'BGV-2',
      'nameEn': 'Brass gate valve 2"',
      'nameAr': 'محبس نحاسي ٢ بوصة',
      'descriptionEn': 'Rising-stem gate valve, PN16.',
      'descriptionAr': null,
      'images': <dynamic>[image(), imageMinimal(), imageNoDimensions()],
      'prices': <dynamic>[priceBand(), priceBand(minQty: 10, maxQty: null)],
      'variants': <dynamic>[productVariant()],
      'moq': 1,
      'availability': 'IN_STOCK',
      'availableQty': 240,
      'origin': 'IT',
      'weightKg': 3.4,
      'tags': <dynamic>['plumbing', 'valve'],
      'channel': 'B2C',
      'brand': <String, dynamic>{
        'id': 'brd_1',
        'nameEn': 'Gulf Valve',
        'nameAr': null,
      },
      'category': <String, dynamic>{
        'id': 'cat_1',
        'slug': 'valves',
        'nameEn': 'Valves',
        'nameAr': 'محابس',
      },
      'seller': sellerSummary(),
      'rating': ratingSummary(),
      'sellableInChannel': true,
    };

/// The same product page as the pilot catalogue sends it: a full B2C price
/// ladder, and the flag that says it cannot be bought. See
/// [productCardPricedNotSellable].
Map<String, dynamic> productDetailPricedNotSellable() => <String, dynamic>{
      ...productDetail(),
      'sellableInChannel': false,
    };

Map<String, dynamic> category() => <String, dynamic>{
      'id': 'cat_1',
      'slug': 'valves',
      'nameEn': 'Valves',
      'nameAr': 'محابس',
      'parentId': null,
      'depth': 0,
      'image': image(),
      'productCount': 128,
    };

Map<String, dynamic> brand() => <String, dynamic>{
      'id': 'brd_1',
      'slug': 'gulf-valve',
      'nameEn': 'Gulf Valve',
      'nameAr': null,
      'logo': imageNoDimensions(),
      'productCount': 42,
    };

/// An order placed AFTER the goods/shipping VAT split is recorded.
Map<String, dynamic> persistedOrderTotals() => <String, dynamic>{
      'subtotal': 24.68,
      'discountAmount': 2.47,
      'shippingAmount': 20.00,
      'vatAmount': 2.11,
      'goodsVatAmount': 1.11,
      'shippingVatAmount': 1.00,
      'total': 44.32,
    };

/// An order placed BEFORE the `Order` table had columns for the split. The
/// aggregate VAT is known; how it divided is not. Null here means "not
/// recorded", never "zero".
Map<String, dynamic> persistedOrderTotalsWithoutBreakdown() =>
    <String, dynamic>{
      'subtotal': 24.68,
      'discountAmount': 2.47,
      'shippingAmount': 20.00,
      'vatAmount': 2.11,
      'goodsVatAmount': null,
      'shippingVatAmount': null,
      'total': 44.32,
    };

Map<String, dynamic> orderItem() => <String, dynamic>{
      'id': 'oi_1',
      'productId': 'prd_1',
      'variantId': null,
      'sellerId': 'sel_1',
      'slug': 'brass-gate-valve-2-inch',
      'sku': 'BGV-2',
      'nameEn': 'Brass gate valve 2"',
      'nameAr': 'محبس نحاسي ٢ بوصة',
      'image': image(),
      'quantity': 2,
      'unitPrice': 12.34,
      'vatRatePercent': 5,
      'vatAmount': 1.11,
      'total': 24.68,
      'status': 'SHIPPED',
    };

Map<String, dynamic> orderStatusEvent() => <String, dynamic>{
      'status': 'SHIPPED',
      'message': 'Handed to the carrier.',
      'occurredAt': '2026-09-04T08:00:00.000Z',
    };

Map<String, dynamic> shipment() => <String, dynamic>{
      'id': 'shp_1',
      'status': 'IN_TRANSIT',
      'carrier': 'Aramex',
      'trackingNumber': '1234567890',
      'trackingUrl': 'https://www.aramex.com/track/1234567890',
      'estimatedDelivery': '2026-09-07T12:00:00.000Z',
    };

Map<String, dynamic> orderCard() => <String, dynamic>{
      'id': 'ord_1',
      'orderNumber': 'AVN-2026-000123',
      'status': 'SHIPPED',
      'paymentStatus': 'PAID',
      'type': 'B2C',
      'currency': 'AED',
      'total': 44.32,
      'itemCount': 2,
      'thumbnail': image(),
      'placedAt': '2026-09-03T07:30:00.000Z',
    };

Map<String, dynamic> orderDetail({Map<String, dynamic>? totals}) =>
    <String, dynamic>{
      'id': 'ord_1',
      'orderNumber': 'AVN-2026-000123',
      'status': 'SHIPPED',
      'paymentStatus': 'PAID',
      'paymentMethod': 'CREDIT_CARD',
      'type': 'B2C',
      'currency': 'AED',
      'totals': totals ?? persistedOrderTotals(),
      'items': <dynamic>[orderItem()],
      'shippingAddress': shippingAddress(),
      'shipments': <dynamic>[shipment()],
      'statusHistory': <dynamic>[orderStatusEvent()],
      'notes': null,
      'vatInvoiceUrl': 'https://cdn.avenick.com/invoices/AVN-2026-000123.pdf',
      'placedAt': '2026-09-03T07:30:00.000Z',
      'updatedAt': '2026-09-04T08:00:00.000Z',
    };

Map<String, dynamic> companyMembership() => <String, dynamic>{
      'companyId': 'cmp_1',
      'nameEn': 'Al Habsi Contracting',
      'nameAr': null,
      'country': 'AE',
      'status': 'ACTIVE',
      'role': 'COMPANY_BUYER',
    };

Map<String, dynamic> me() => <String, dynamic>{
      'id': 'usr_01HZ',
      'email': 'buyer@example.ae',
      'phone': '+971501234567',
      'firstName': 'Salim',
      'lastName': 'Al Habsi',
      'firstNameAr': 'سالم',
      'lastNameAr': 'الحبسي',
      'avatar': imageMinimal(),
      'role': 'COMPANY_BUYER',
      'status': 'ACTIVE',
      'language': 'EN',
      'emailVerified': true,
      'phoneVerified': false,
      'company': companyMembership(),
      'createdAt': '2025-11-01T06:00:00.000Z',
    };

Map<String, dynamic> accountDeletion() => <String, dynamic>{
      'status': 'scheduled',
      'requestedAt': '2026-09-05T10:00:00.000Z',
      'erasesAt': '2026-10-05T10:00:00.000Z',
    };

Map<String, dynamic> address() => <String, dynamic>{
      'id': 'adr_1',
      'label': 'Warehouse',
      'line1': 'Plot 42, Industrial Area 3',
      'line2': null,
      'city': 'Sharjah',
      'country': 'AE',
      'postalCode': null,
      'latitude': 25.3463,
      'longitude': 55.4209,
      'isDefault': true,
    };

Map<String, dynamic> addressDeleted() =>
    <String, dynamic>{'id': 'adr_1', 'deleted': true};

Map<String, dynamic> device() => <String, dynamic>{
      'id': 'dev_1',
      'deviceId': 'a1b2c3d4e5f6',
      'platform': 'ios',
      'appVersion': '1.2.3',
      'language': 'EN',
      'registeredAt': '2026-09-01T05:00:00.000Z',
      'lastSeenAt': '2026-09-05T09:00:00.000Z',
    };

Map<String, dynamic> deviceDeleted() =>
    <String, dynamic>{'deviceId': 'a1b2c3d4e5f6', 'deleted': true};

/// `PlacedOrder` — the answer to `POST /v1/orders`.
Map<String, dynamic> placedOrder({bool replayed = false}) => <String, dynamic>{
      'order': orderDetail(),
      'replayed': replayed,
    };

Map<String, dynamic> rfqSeller() => <String, dynamic>{
      'businessNameEn': 'Gulf Valve Trading',
      'tier': 'VERIFIED',
    };

/// A catalogue line the supplier has priced.
Map<String, dynamic> rfqItem({num? unitQuoted = 11.50}) => <String, dynamic>{
      'id': 'rfi_1',
      'productId': 'prd_1',
      'nameEn': 'Brass gate valve 2"',
      'quantity': 250,
      'unitQuoted': unitQuoted,
      'notes': 'PN16, rising stem.',
    };

/// A FREE-TEXT line: no `productId`, so the name is the whole description.
/// The ordinary case for an RFQ, not an edge case.
Map<String, dynamic> rfqItemFreeText() => <String, dynamic>{
      'id': 'rfi_2',
      'productId': null,
      'nameEn': 'DN200 butterfly valve, lugged, EPDM seat',
      'quantity': 40,
      'unitQuoted': null,
      'notes': null,
    };

Map<String, dynamic> rfqCard({
  String status = 'QUOTED',
  num? totalQuoted = 2875.00,
  int quoteVersion = 2,
  bool withSeller = true,
}) =>
    <String, dynamic>{
      'id': 'rfq_1',
      'rfqNumber': 'RFQ-2026-000042',
      'status': status,
      'currency': 'AED',
      'itemCount': 2,
      'totalQuoted': totalQuoted,
      'quoteVersion': quoteVersion,
      'seller': withSeller ? rfqSeller() : null,
      'requiredBy': '2026-10-01T00:00:00.000Z',
      'createdAt': '2026-09-01T06:00:00.000Z',
      'messageCount': 3,
    };

/// A request nobody has picked up yet: no supplier, no quote, version zero.
/// Null `totalQuoted` means "not yet quoted", never "nothing to pay".
Map<String, dynamic> rfqCardUnquoted() => rfqCard(
      status: 'SUBMITTED',
      totalQuoted: null,
      quoteVersion: 0,
      withSeller: false,
    );

/// `RfqDetail`. NOTE WHAT IS NOT HERE: a `quotes` array. `RFQRequest.sellerId`
/// is a single nullable supplier, so a request carries at most ONE supplier's
/// prices — the schema is `additionalProperties: false` and the contracts
/// package asserts a payload carrying `quotes` is refused.
Map<String, dynamic> rfqDetail({
  String status = 'QUOTED',
  num? totalQuoted = 2875.00,
  int quoteVersion = 2,
  String? expiresAt = '2026-09-15T00:00:00.000Z',
}) =>
    <String, dynamic>{
      ...rfqCard(
        status: status,
        totalQuoted: totalQuoted,
        quoteVersion: quoteVersion,
      ),
      'items': <dynamic>[rfqItem(), rfqItemFreeText()],
      'notes': 'Site delivery, Jebel Ali.',
      'expiresAt': expiresAt,
      'updatedAt': '2026-09-06T09:00:00.000Z',
    };
