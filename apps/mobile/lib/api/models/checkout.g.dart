// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'checkout.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ShippingAddress _$ShippingAddressFromJson(Map<String, dynamic> json) =>
    _ShippingAddress(
      label: json['label'] as String,
      line1: json['line1'] as String,
      city: json['city'] as String,
      country: $enumDecode(_$CountryEnumMap, json['country']),
      line2: json['line2'] as String?,
      postalCode: json['postalCode'] as String?,
    );

Map<String, dynamic> _$ShippingAddressToJson(_ShippingAddress instance) =>
    <String, dynamic>{
      'label': instance.label,
      'line1': instance.line1,
      'city': instance.city,
      'country': _$CountryEnumMap[instance.country]!,
      'line2': instance.line2,
      'postalCode': instance.postalCode,
    };

const _$CountryEnumMap = {
  Country.ae: 'AE',
  Country.sa: 'SA',
  Country.qa: 'QA',
  Country.kw: 'KW',
  Country.om: 'OM',
  Country.bh: 'BH',
};

_QuoteLine _$QuoteLineFromJson(Map<String, dynamic> json) => _QuoteLine(
      productId: json['productId'] as String,
      variantId: json['variantId'] as String?,
      sellerId: json['sellerId'] as String,
      sku: json['sku'] as String,
      nameEn: json['nameEn'] as String,
      nameAr: json['nameAr'] as String,
      quantity: (json['quantity'] as num).toInt(),
      unitPrice: const DecimalConverter().fromJson(json['unitPrice'] as Object),
      vatRatePercent:
          const DecimalConverter().fromJson(json['vatRatePercent'] as Object),
      vatAmount: const DecimalConverter().fromJson(json['vatAmount'] as Object),
      lineTotal: const DecimalConverter().fromJson(json['lineTotal'] as Object),
    );

Map<String, dynamic> _$QuoteLineToJson(_QuoteLine instance) =>
    <String, dynamic>{
      'productId': instance.productId,
      'variantId': instance.variantId,
      'sellerId': instance.sellerId,
      'sku': instance.sku,
      'nameEn': instance.nameEn,
      'nameAr': instance.nameAr,
      'quantity': instance.quantity,
      'unitPrice': const DecimalConverter().toJson(instance.unitPrice),
      'vatRatePercent':
          const DecimalConverter().toJson(instance.vatRatePercent),
      'vatAmount': const DecimalConverter().toJson(instance.vatAmount),
      'lineTotal': const DecimalConverter().toJson(instance.lineTotal),
    };

_ShippingQuote _$ShippingQuoteFromJson(Map<String, dynamic> json) =>
    _ShippingQuote(
      status: $enumDecode(_$ShippingQuoteStatusEnumMap, json['status']),
      zoneName: json['zoneName'] as String?,
      amount: const DecimalConverter().fromJson(json['amount'] as Object),
      vatRatePercent:
          const DecimalConverter().fromJson(json['vatRatePercent'] as Object),
      estimatedDaysMin: (json['estimatedDaysMin'] as num?)?.toInt(),
      estimatedDaysMax: (json['estimatedDaysMax'] as num?)?.toInt(),
    );

Map<String, dynamic> _$ShippingQuoteToJson(_ShippingQuote instance) =>
    <String, dynamic>{
      'status': _$ShippingQuoteStatusEnumMap[instance.status]!,
      'zoneName': instance.zoneName,
      'amount': const DecimalConverter().toJson(instance.amount),
      'vatRatePercent':
          const DecimalConverter().toJson(instance.vatRatePercent),
      'estimatedDaysMin': instance.estimatedDaysMin,
      'estimatedDaysMax': instance.estimatedDaysMax,
    };

const _$ShippingQuoteStatusEnumMap = {
  ShippingQuoteStatus.priced: 'priced',
  ShippingQuoteStatus.unpricedNoZones: 'unpriced_no_zones',
  ShippingQuoteStatus.unavailable: 'unavailable',
};

_AppliedPromotion _$AppliedPromotionFromJson(Map<String, dynamic> json) =>
    _AppliedPromotion(
      promotionId: json['promotionId'] as String,
      couponCode: json['couponCode'] as String?,
      label: json['label'] as String,
      discountAmount:
          const DecimalConverter().fromJson(json['discountAmount'] as Object),
    );

Map<String, dynamic> _$AppliedPromotionToJson(_AppliedPromotion instance) =>
    <String, dynamic>{
      'promotionId': instance.promotionId,
      'couponCode': instance.couponCode,
      'label': instance.label,
      'discountAmount':
          const DecimalConverter().toJson(instance.discountAmount),
    };

_CheckoutQuote _$CheckoutQuoteFromJson(Map<String, dynamic> json) =>
    _CheckoutQuote(
      quoteId: json['quoteId'] as String,
      currency: $enumDecode(_$CurrencyEnumMap, json['currency']),
      channel: $enumDecode(_$ChannelEnumMap, json['channel']),
      vatRatePercent:
          const DecimalConverter().fromJson(json['vatRatePercent'] as Object),
      lines: (json['lines'] as List<dynamic>)
          .map((e) => QuoteLine.fromJson(e as Map<String, dynamic>))
          .toList(),
      shipping:
          ShippingQuote.fromJson(json['shipping'] as Map<String, dynamic>),
      promotions: (json['promotions'] as List<dynamic>)
          .map((e) => AppliedPromotion.fromJson(e as Map<String, dynamic>))
          .toList(),
      totals: OrderTotals.fromJson(json['totals'] as Map<String, dynamic>),
      expiresAt:
          const UtcDateTimeConverter().fromJson(json['expiresAt'] as String),
    );

Map<String, dynamic> _$CheckoutQuoteToJson(_CheckoutQuote instance) =>
    <String, dynamic>{
      'quoteId': instance.quoteId,
      'currency': _$CurrencyEnumMap[instance.currency]!,
      'channel': _$ChannelEnumMap[instance.channel]!,
      'vatRatePercent':
          const DecimalConverter().toJson(instance.vatRatePercent),
      'lines': instance.lines,
      'shipping': instance.shipping,
      'promotions': instance.promotions,
      'totals': instance.totals,
      'expiresAt': const UtcDateTimeConverter().toJson(instance.expiresAt),
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

const _$ChannelEnumMap = {
  Channel.b2c: 'B2C',
  Channel.b2b: 'B2B',
};
