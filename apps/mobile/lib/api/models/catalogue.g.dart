// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'catalogue.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_RatingSummary _$RatingSummaryFromJson(Map<String, dynamic> json) =>
    _RatingSummary(
      average: (json['average'] as num).toDouble(),
      count: (json['count'] as num).toInt(),
    );

Map<String, dynamic> _$RatingSummaryToJson(_RatingSummary instance) =>
    <String, dynamic>{
      'average': instance.average,
      'count': instance.count,
    };

_CardPrice _$CardPriceFromJson(Map<String, dynamic> json) => _CardPrice(
      amount: const DecimalConverter().fromJson(json['amount'] as Object),
      currency: $enumDecode(_$CurrencyEnumMap, json['currency']),
      vatRatePercent:
          const DecimalConverter().fromJson(json['vatRatePercent'] as Object),
      isFrom: json['isFrom'] as bool,
    );

Map<String, dynamic> _$CardPriceToJson(_CardPrice instance) =>
    <String, dynamic>{
      'amount': const DecimalConverter().toJson(instance.amount),
      'currency': _$CurrencyEnumMap[instance.currency]!,
      'vatRatePercent':
          const DecimalConverter().toJson(instance.vatRatePercent),
      'isFrom': instance.isFrom,
    };

const _$CurrencyEnumMap = {
  Currency.aed: 'AED',
  Currency.sar: 'SAR',
  Currency.qar: 'QAR',
  Currency.kwd: 'KWD',
  Currency.omr: 'OMR',
  Currency.bhd: 'BHD',
  Currency.usd: 'USD',
};

_PriceBand _$PriceBandFromJson(Map<String, dynamic> json) => _PriceBand(
      channel: $enumDecode(_$ChannelEnumMap, json['channel']),
      currency: $enumDecode(_$CurrencyEnumMap, json['currency']),
      minQty: (json['minQty'] as num).toInt(),
      maxQty: (json['maxQty'] as num?)?.toInt(),
      price: const DecimalConverter().fromJson(json['price'] as Object),
      vatRatePercent:
          const DecimalConverter().fromJson(json['vatRatePercent'] as Object),
    );

Map<String, dynamic> _$PriceBandToJson(_PriceBand instance) =>
    <String, dynamic>{
      'channel': _$ChannelEnumMap[instance.channel]!,
      'currency': _$CurrencyEnumMap[instance.currency]!,
      'minQty': instance.minQty,
      'maxQty': instance.maxQty,
      'price': const DecimalConverter().toJson(instance.price),
      'vatRatePercent':
          const DecimalConverter().toJson(instance.vatRatePercent),
    };

const _$ChannelEnumMap = {
  Channel.b2c: 'B2C',
  Channel.b2b: 'B2B',
};

_ProductVariant _$ProductVariantFromJson(Map<String, dynamic> json) =>
    _ProductVariant(
      id: json['id'] as String,
      sku: json['sku'] as String,
      nameEn: json['nameEn'] as String,
      nameAr: json['nameAr'] as String?,
      attributes: json['attributes'] as Map<String, dynamic>,
      prices: (json['prices'] as List<dynamic>)
          .map((e) => PriceBand.fromJson(e as Map<String, dynamic>))
          .toList(),
      availability: $enumDecode(_$AvailabilityEnumMap, json['availability']),
      availableQty: (json['availableQty'] as num).toInt(),
    );

Map<String, dynamic> _$ProductVariantToJson(_ProductVariant instance) =>
    <String, dynamic>{
      'id': instance.id,
      'sku': instance.sku,
      'nameEn': instance.nameEn,
      'nameAr': instance.nameAr,
      'attributes': instance.attributes,
      'prices': instance.prices,
      'availability': _$AvailabilityEnumMap[instance.availability]!,
      'availableQty': instance.availableQty,
    };

const _$AvailabilityEnumMap = {
  Availability.inStock: 'IN_STOCK',
  Availability.outOfStock: 'OUT_OF_STOCK',
  Availability.unconfirmed: 'UNCONFIRMED',
};

_SellerSummary _$SellerSummaryFromJson(Map<String, dynamic> json) =>
    _SellerSummary(
      id: json['id'] as String,
      businessNameEn: json['businessNameEn'] as String,
      businessNameAr: json['businessNameAr'] as String?,
      tier: $enumDecode(_$SellerTierEnumMap, json['tier']),
      city: json['city'] as String,
      country: json['country'] as String,
      rating: json['rating'] == null
          ? null
          : RatingSummary.fromJson(json['rating'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$SellerSummaryToJson(_SellerSummary instance) =>
    <String, dynamic>{
      'id': instance.id,
      'businessNameEn': instance.businessNameEn,
      'businessNameAr': instance.businessNameAr,
      'tier': _$SellerTierEnumMap[instance.tier]!,
      'city': instance.city,
      'country': instance.country,
      'rating': instance.rating,
    };

const _$SellerTierEnumMap = {
  SellerTier.standard: 'STANDARD',
  SellerTier.verified: 'VERIFIED',
  SellerTier.gold: 'GOLD',
  SellerTier.platinum: 'PLATINUM',
};

_ProductCard _$ProductCardFromJson(Map<String, dynamic> json) => _ProductCard(
      id: json['id'] as String,
      slug: json['slug'] as String,
      nameEn: json['nameEn'] as String,
      nameAr: json['nameAr'] as String,
      image: json['image'] == null
          ? null
          : ImageRef.fromJson(json['image'] as Map<String, dynamic>),
      price: json['price'] == null
          ? null
          : CardPrice.fromJson(json['price'] as Map<String, dynamic>),
      moq: (json['moq'] as num).toInt(),
      availability: $enumDecode(_$AvailabilityEnumMap, json['availability']),
      priceTiered: json['priceTiered'] as bool,
      rating: json['rating'] == null
          ? null
          : RatingSummary.fromJson(json['rating'] as Map<String, dynamic>),
      brandName: json['brandName'] as String?,
    );

Map<String, dynamic> _$ProductCardToJson(_ProductCard instance) =>
    <String, dynamic>{
      'id': instance.id,
      'slug': instance.slug,
      'nameEn': instance.nameEn,
      'nameAr': instance.nameAr,
      'image': instance.image,
      'price': instance.price,
      'moq': instance.moq,
      'availability': _$AvailabilityEnumMap[instance.availability]!,
      'priceTiered': instance.priceTiered,
      'rating': instance.rating,
      'brandName': instance.brandName,
    };

_ProductBrandRef _$ProductBrandRefFromJson(Map<String, dynamic> json) =>
    _ProductBrandRef(
      id: json['id'] as String,
      nameEn: json['nameEn'] as String,
      nameAr: json['nameAr'] as String?,
    );

Map<String, dynamic> _$ProductBrandRefToJson(_ProductBrandRef instance) =>
    <String, dynamic>{
      'id': instance.id,
      'nameEn': instance.nameEn,
      'nameAr': instance.nameAr,
    };

_ProductCategoryRef _$ProductCategoryRefFromJson(Map<String, dynamic> json) =>
    _ProductCategoryRef(
      id: json['id'] as String,
      slug: json['slug'] as String,
      nameEn: json['nameEn'] as String,
      nameAr: json['nameAr'] as String,
    );

Map<String, dynamic> _$ProductCategoryRefToJson(_ProductCategoryRef instance) =>
    <String, dynamic>{
      'id': instance.id,
      'slug': instance.slug,
      'nameEn': instance.nameEn,
      'nameAr': instance.nameAr,
    };

_ProductDetail _$ProductDetailFromJson(Map<String, dynamic> json) =>
    _ProductDetail(
      id: json['id'] as String,
      slug: json['slug'] as String,
      sku: json['sku'] as String,
      nameEn: json['nameEn'] as String,
      nameAr: json['nameAr'] as String,
      descriptionEn: json['descriptionEn'] as String?,
      descriptionAr: json['descriptionAr'] as String?,
      images: (json['images'] as List<dynamic>)
          .map((e) => ImageRef.fromJson(e as Map<String, dynamic>))
          .toList(),
      prices: (json['prices'] as List<dynamic>)
          .map((e) => PriceBand.fromJson(e as Map<String, dynamic>))
          .toList(),
      variants: (json['variants'] as List<dynamic>)
          .map((e) => ProductVariant.fromJson(e as Map<String, dynamic>))
          .toList(),
      moq: (json['moq'] as num).toInt(),
      availability: $enumDecode(_$AvailabilityEnumMap, json['availability']),
      availableQty: (json['availableQty'] as num).toInt(),
      origin: json['origin'] as String?,
      weightKg: (json['weightKg'] as num?)?.toDouble(),
      tags: (json['tags'] as List<dynamic>).map((e) => e as String).toList(),
      channel: $enumDecode(_$ChannelEnumMap, json['channel']),
      brand: json['brand'] == null
          ? null
          : ProductBrandRef.fromJson(json['brand'] as Map<String, dynamic>),
      category:
          ProductCategoryRef.fromJson(json['category'] as Map<String, dynamic>),
      seller: SellerSummary.fromJson(json['seller'] as Map<String, dynamic>),
      rating: json['rating'] == null
          ? null
          : RatingSummary.fromJson(json['rating'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$ProductDetailToJson(_ProductDetail instance) =>
    <String, dynamic>{
      'id': instance.id,
      'slug': instance.slug,
      'sku': instance.sku,
      'nameEn': instance.nameEn,
      'nameAr': instance.nameAr,
      'descriptionEn': instance.descriptionEn,
      'descriptionAr': instance.descriptionAr,
      'images': instance.images,
      'prices': instance.prices,
      'variants': instance.variants,
      'moq': instance.moq,
      'availability': _$AvailabilityEnumMap[instance.availability]!,
      'availableQty': instance.availableQty,
      'origin': instance.origin,
      'weightKg': instance.weightKg,
      'tags': instance.tags,
      'channel': _$ChannelEnumMap[instance.channel]!,
      'brand': instance.brand,
      'category': instance.category,
      'seller': instance.seller,
      'rating': instance.rating,
    };

_Category _$CategoryFromJson(Map<String, dynamic> json) => _Category(
      id: json['id'] as String,
      slug: json['slug'] as String,
      nameEn: json['nameEn'] as String,
      nameAr: json['nameAr'] as String,
      parentId: json['parentId'] as String?,
      depth: (json['depth'] as num).toInt(),
      image: json['image'] == null
          ? null
          : ImageRef.fromJson(json['image'] as Map<String, dynamic>),
      productCount: (json['productCount'] as num).toInt(),
    );

Map<String, dynamic> _$CategoryToJson(_Category instance) => <String, dynamic>{
      'id': instance.id,
      'slug': instance.slug,
      'nameEn': instance.nameEn,
      'nameAr': instance.nameAr,
      'parentId': instance.parentId,
      'depth': instance.depth,
      'image': instance.image,
      'productCount': instance.productCount,
    };

_Brand _$BrandFromJson(Map<String, dynamic> json) => _Brand(
      id: json['id'] as String,
      slug: json['slug'] as String,
      nameEn: json['nameEn'] as String,
      nameAr: json['nameAr'] as String?,
      logo: json['logo'] == null
          ? null
          : ImageRef.fromJson(json['logo'] as Map<String, dynamic>),
      productCount: (json['productCount'] as num).toInt(),
    );

Map<String, dynamic> _$BrandToJson(_Brand instance) => <String, dynamic>{
      'id': instance.id,
      'slug': instance.slug,
      'nameEn': instance.nameEn,
      'nameAr': instance.nameAr,
      'logo': instance.logo,
      'productCount': instance.productCount,
    };
