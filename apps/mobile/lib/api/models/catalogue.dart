import 'package:freezed_annotation/freezed_annotation.dart';

import 'common.dart';
import 'converters.dart';
import 'decimal.dart';
import 'enums.dart';
import 'money.dart';

part 'catalogue.freezed.dart';
part 'catalogue.g.dart';

/// Review aggregate. Null on the enclosing object when nothing has been
/// reviewed — the contract makes [count] positive, so a zero-count summary is
/// never sent in place of null.
@freezed
abstract class RatingSummary with _$RatingSummary {
  const factory RatingSummary({
    /// 1.0 to 5.0. Genuinely an approximate quantity, so `double` is the right
    /// type here — unlike money, nothing is settled against it.
    required double average,
    required int count,
  }) = _RatingSummary;

  factory RatingSummary.fromJson(Map<String, dynamic> json) =>
      _$RatingSummaryFromJson(json);
}

/// The one price a product CARD shows.
///
/// [isFrom] is the difference between "AED 12.00" and "from AED 12.00": a
/// tiered product has no single price, and printing the lowest band as if it
/// were the price is a quote the checkout will not honour.
@freezed
abstract class CardPrice with _$CardPrice {
  const CardPrice._();

  const factory CardPrice({
    @DecimalConverter() required Decimal amount,
    required Currency currency,
    @DecimalConverter() required Decimal vatRatePercent,
    required bool isFrom,
  }) = _CardPrice;

  factory CardPrice.fromJson(Map<String, dynamic> json) =>
      _$CardPriceFromJson(json);

  Money get money => Money.of(amount, currency);
}

/// One rung of a quantity-break price ladder.
///
/// [maxQty] is null on the open-ended top band. A band is scoped to a
/// [channel] and a [currency]: the same product priced for B2B in SAR is a
/// different ladder, not a converted one.
@freezed
abstract class PriceBand with _$PriceBand {
  const PriceBand._();

  const factory PriceBand({
    required Channel channel,
    required Currency currency,
    required int minQty,
    required int? maxQty,
    @DecimalConverter() required Decimal price,
    @DecimalConverter() required Decimal vatRatePercent,
  }) = _PriceBand;

  factory PriceBand.fromJson(Map<String, dynamic> json) =>
      _$PriceBandFromJson(json);

  Money get money => Money.of(price, currency);

  bool covers(int quantity) =>
      quantity >= minQty && (maxQty == null || quantity <= maxQty!);
}

@freezed
abstract class ProductVariant with _$ProductVariant {
  const ProductVariant._();

  const factory ProductVariant({
    required String id,
    required String sku,
    required String nameEn,
    required String? nameAr,

    /// Free-form option values — `{"size": "XL", "voltage": 220}`. The
    /// contract admits string, number or boolean, so this stays
    /// `Map<String, Object?>`: coercing to `Map<String, String>` would print
    /// `220.0` for an integer attribute.
    required Map<String, Object?> attributes,
    required List<PriceBand> prices,
    required Availability availability,
    required int availableQty,
  }) = _ProductVariant;

  factory ProductVariant.fromJson(Map<String, dynamic> json) =>
      _$ProductVariantFromJson(json);

  PriceBand? bandFor({
    required int quantity,
    required Channel channel,
    required Currency currency,
  }) {
    for (final band in prices) {
      if (band.channel == channel &&
          band.currency == currency &&
          band.covers(quantity)) {
        return band;
      }
    }
    return null;
  }
}

@freezed
abstract class SellerSummary with _$SellerSummary {
  const factory SellerSummary({
    required String id,
    required String businessNameEn,
    required String? businessNameAr,
    required SellerTier tier,
    required String city,

    /// ISO-3166 alpha-2. NOT the [Country] enum: the contract types this as a
    /// bare two-character string, so a seller registered outside the six GCC
    /// markets still parses instead of throwing on a screen that only wanted
    /// to print it.
    required String country,
    required RatingSummary? rating,
  }) = _SellerSummary;

  factory SellerSummary.fromJson(Map<String, dynamic> json) =>
      _$SellerSummaryFromJson(json);
}

/// A product as a LIST shows it.
///
/// Both language strings travel, rather than one resolved string: a list is
/// rendered once and read in either language, and re-fetching the page on a
/// language switch is a network round trip for text the client already had.
@freezed
abstract class ProductCard with _$ProductCard {
  const ProductCard._();

  const factory ProductCard({
    required String id,
    required String slug,
    required String nameEn,
    required String nameAr,
    required ImageRef? image,

    /// Null when nothing is priced in the requested channel and currency —
    /// which is a real catalogue state, not an error. The card renders
    /// "price on request", it does not render zero.
    ///
    /// A PRESENT PRICE IS NOT PERMISSION TO SELL. See [sellableInChannel].
    required CardPrice? price,
    required int moq,
    required Availability availability,
    required bool priceTiered,
    required RatingSummary? rating,
    required String? brandName,

    /// WHETHER THIS PRODUCT CAN BE ORDERED IN THE CHANNEL THIS CARD WAS BUILT
    /// FOR. Add to cart when true; Request a quote when false.
    ///
    /// This is the platform's own gate, answered channel-parameterised:
    /// `Product.isB2CEnabled` / `isB2BEnabled`, the flag `services/orders.ts`,
    /// `services/secure-checkout.ts` and the v1 quote's `quote-lines.ts` each
    /// check before refusing a line.
    ///
    /// It is a SEPARATE fact from [price], and the difference is the whole
    /// reason the field exists. The pilot catalogue is priced in B2C and
    /// carries `isB2CEnabled: false` on every row the importer writes, so
    /// "has a resolved price" and "can be bought" disagree for all 1,172 rows
    /// in production. Inferring sellability from the price renders Add to cart
    /// on every one of them, and `secureCreateOrder` then refuses the order
    /// server-side — after the buyer has committed. Read this flag; do not
    /// derive it, and do not read [Channel] for it either, which answers only
    /// which channel the price was resolved IN.
    required bool sellableInChannel,
  }) = _ProductCard;

  factory ProductCard.fromJson(Map<String, dynamic> json) =>
      _$ProductCardFromJson(json);

  String name(Language language) => language == Language.ar ? nameAr : nameEn;
}

/// A brand as the product detail page names it — the inline object on
/// `ProductDetail.brand`, which is a narrower shape than the top-level
/// [Brand] (no slug, no logo, no count).
@freezed
abstract class ProductBrandRef with _$ProductBrandRef {
  const factory ProductBrandRef({
    required String id,
    required String nameEn,
    required String? nameAr,
  }) = _ProductBrandRef;

  factory ProductBrandRef.fromJson(Map<String, dynamic> json) =>
      _$ProductBrandRefFromJson(json);
}

/// The inline category on `ProductDetail.category`. Narrower than [Category]:
/// no parent, no depth, no count.
@freezed
abstract class ProductCategoryRef with _$ProductCategoryRef {
  const factory ProductCategoryRef({
    required String id,
    required String slug,
    required String nameEn,
    required String nameAr,
  }) = _ProductCategoryRef;

  factory ProductCategoryRef.fromJson(Map<String, dynamic> json) =>
      _$ProductCategoryRefFromJson(json);
}

@freezed
abstract class ProductDetail with _$ProductDetail {
  const ProductDetail._();

  const factory ProductDetail({
    required String id,
    required String slug,
    required String sku,
    required String nameEn,
    required String nameAr,
    required String? descriptionEn,
    required String? descriptionAr,
    required List<ImageRef> images,
    required List<PriceBand> prices,
    required List<ProductVariant> variants,
    required int moq,
    required Availability availability,
    required int availableQty,

    /// ISO-3166 alpha-2 country of origin, or null when unrecorded.
    required String? origin,

    /// Shipping weight. An approximate physical quantity, so `double` is
    /// correct here — this is not money and nothing is settled against it.
    required double? weightKg,
    required List<String> tags,
    required Channel channel,
    required ProductBrandRef? brand,
    required ProductCategoryRef category,
    required SellerSummary seller,
    required RatingSummary? rating,

    /// Whether this product can be ORDERED in [channel], as opposed to merely
    /// priced in it. See [ProductCard.sellableInChannel] — the same flag, the
    /// same trap, and the one the primary action on this page is driven from.
    required bool sellableInChannel,
  }) = _ProductDetail;

  factory ProductDetail.fromJson(Map<String, dynamic> json) =>
      _$ProductDetailFromJson(json);

  String name(Language language) => language == Language.ar ? nameAr : nameEn;

  String? description(Language language) =>
      language == Language.ar ? descriptionAr ?? descriptionEn : descriptionEn;

  bool get hasVariants => variants.isNotEmpty;

  /// True when this product's price depends on how many you buy, so the UI
  /// must say "from" rather than quote a single figure.
  bool isTiered({required Channel channel, required Currency currency}) =>
      prices
          .where((b) => b.channel == channel && b.currency == currency)
          .length >
      1;
}

@freezed
abstract class Category with _$Category {
  const Category._();

  const factory Category({
    required String id,
    required String slug,
    required String nameEn,
    required String nameAr,

    /// Null at the root. The endpoint returns the whole tree FLAT and
    /// unpaginated; assemble it with [parentId] and [depth] rather than
    /// expecting nesting on the wire.
    required String? parentId,
    required int depth,
    required ImageRef? image,
    required int productCount,
  }) = _Category;

  factory Category.fromJson(Map<String, dynamic> json) =>
      _$CategoryFromJson(json);

  bool get isRoot => parentId == null;

  String name(Language language) => language == Language.ar ? nameAr : nameEn;
}

@freezed
abstract class Brand with _$Brand {
  const Brand._();

  const factory Brand({
    required String id,
    required String slug,
    required String nameEn,
    required String? nameAr,
    required ImageRef? logo,
    required int productCount,
  }) = _Brand;

  factory Brand.fromJson(Map<String, dynamic> json) => _$BrandFromJson(json);

  String name(Language language) =>
      language == Language.ar ? nameAr ?? nameEn : nameEn;
}
