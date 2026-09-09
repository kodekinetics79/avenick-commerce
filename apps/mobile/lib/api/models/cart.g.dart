// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'cart.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_CartLine _$CartLineFromJson(Map<String, dynamic> json) => _CartLine(
      id: json['id'] as String,
      productId: json['productId'] as String,
      variantId: json['variantId'] as String?,
      sellerId: json['sellerId'] as String,
      slug: json['slug'] as String,
      sku: json['sku'] as String,
      nameEn: json['nameEn'] as String,
      nameAr: json['nameAr'] as String,
      image: json['image'] == null
          ? null
          : ImageRef.fromJson(json['image'] as Map<String, dynamic>),
      channel: $enumDecode(_$ChannelEnumMap, json['channel']),
      qty: (json['qty'] as num).toInt(),
      moq: (json['moq'] as num).toInt(),
      unitPrice: const DecimalConverter().fromJson(json['unitPrice'] as Object),
      currency: $enumDecode(_$CurrencyEnumMap, json['currency']),
      vatRatePercent:
          const DecimalConverter().fromJson(json['vatRatePercent'] as Object),
      priceTiered: json['priceTiered'] as bool,
      availability: $enumDecode(_$AvailabilityEnumMap, json['availability']),
      sellableInChannel: json['sellableInChannel'] as bool,
      lineTotal: const DecimalConverter().fromJson(json['lineTotal'] as Object),
    );

Map<String, dynamic> _$CartLineToJson(_CartLine instance) => <String, dynamic>{
      'id': instance.id,
      'productId': instance.productId,
      'variantId': instance.variantId,
      'sellerId': instance.sellerId,
      'slug': instance.slug,
      'sku': instance.sku,
      'nameEn': instance.nameEn,
      'nameAr': instance.nameAr,
      'image': instance.image,
      'channel': _$ChannelEnumMap[instance.channel]!,
      'qty': instance.qty,
      'moq': instance.moq,
      'unitPrice': const DecimalConverter().toJson(instance.unitPrice),
      'currency': _$CurrencyEnumMap[instance.currency]!,
      'vatRatePercent':
          const DecimalConverter().toJson(instance.vatRatePercent),
      'priceTiered': instance.priceTiered,
      'availability': _$AvailabilityEnumMap[instance.availability]!,
      'sellableInChannel': instance.sellableInChannel,
      'lineTotal': const DecimalConverter().toJson(instance.lineTotal),
    };

const _$ChannelEnumMap = {
  Channel.b2c: 'B2C',
  Channel.b2b: 'B2B',
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

const _$AvailabilityEnumMap = {
  Availability.inStock: 'IN_STOCK',
  Availability.outOfStock: 'OUT_OF_STOCK',
  Availability.unconfirmed: 'UNCONFIRMED',
};

_Cart _$CartFromJson(Map<String, dynamic> json) => _Cart(
      id: json['id'] as String,
      currency: $enumDecode(_$CurrencyEnumMap, json['currency']),
      lines: (json['lines'] as List<dynamic>)
          .map((e) => CartLine.fromJson(e as Map<String, dynamic>))
          .toList(),
      itemCount: (json['itemCount'] as num).toInt(),
      subtotal: const DecimalConverter().fromJson(json['subtotal'] as Object),
      updatedAt:
          const UtcDateTimeConverter().fromJson(json['updatedAt'] as String),
    );

Map<String, dynamic> _$CartToJson(_Cart instance) => <String, dynamic>{
      'id': instance.id,
      'currency': _$CurrencyEnumMap[instance.currency]!,
      'lines': instance.lines,
      'itemCount': instance.itemCount,
      'subtotal': const DecimalConverter().toJson(instance.subtotal),
      'updatedAt': const UtcDateTimeConverter().toJson(instance.updatedAt),
    };

_CartMergeRejection _$CartMergeRejectionFromJson(Map<String, dynamic> json) =>
    _CartMergeRejection(
      productId: json['productId'] as String,
      variantId: json['variantId'] as String?,
      reason: $enumDecode(_$CartMergeRejectionReasonEnumMap, json['reason']),
      acceptedQty: (json['acceptedQty'] as num?)?.toInt(),
    );

Map<String, dynamic> _$CartMergeRejectionToJson(_CartMergeRejection instance) =>
    <String, dynamic>{
      'productId': instance.productId,
      'variantId': instance.variantId,
      'reason': _$CartMergeRejectionReasonEnumMap[instance.reason]!,
      'acceptedQty': instance.acceptedQty,
    };

const _$CartMergeRejectionReasonEnumMap = {
  CartMergeRejectionReason.productNotFound: 'product_not_found',
  CartMergeRejectionReason.productUnavailable: 'product_unavailable',
  CartMergeRejectionReason.variantNotFound: 'variant_not_found',
  CartMergeRejectionReason.channelNotEnabled: 'channel_not_enabled',
  CartMergeRejectionReason.currencyNotPriced: 'currency_not_priced',
  CartMergeRejectionReason.belowMoq: 'below_moq',
  CartMergeRejectionReason.insufficientStock: 'insufficient_stock',
  CartMergeRejectionReason.quantityLimit: 'quantity_limit',
};

_CartMergeResult _$CartMergeResultFromJson(Map<String, dynamic> json) =>
    _CartMergeResult(
      cart: Cart.fromJson(json['cart'] as Map<String, dynamic>),
      rejected: (json['rejected'] as List<dynamic>)
          .map((e) => CartMergeRejection.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$CartMergeResultToJson(_CartMergeResult instance) =>
    <String, dynamic>{
      'cart': instance.cart,
      'rejected': instance.rejected,
    };
