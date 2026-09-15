// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rfq.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_RfqSeller _$RfqSellerFromJson(Map<String, dynamic> json) => _RfqSeller(
      businessNameEn: json['businessNameEn'] as String,
      tier: $enumDecode(_$SellerTierEnumMap, json['tier']),
    );

Map<String, dynamic> _$RfqSellerToJson(_RfqSeller instance) =>
    <String, dynamic>{
      'businessNameEn': instance.businessNameEn,
      'tier': _$SellerTierEnumMap[instance.tier]!,
    };

const _$SellerTierEnumMap = {
  SellerTier.standard: 'STANDARD',
  SellerTier.verified: 'VERIFIED',
  SellerTier.gold: 'GOLD',
  SellerTier.platinum: 'PLATINUM',
};

_RfqItem _$RfqItemFromJson(Map<String, dynamic> json) => _RfqItem(
      id: json['id'] as String,
      productId: json['productId'] as String?,
      nameEn: json['nameEn'] as String,
      quantity: (json['quantity'] as num).toInt(),
      unitQuoted: const NullableDecimalConverter().fromJson(json['unitQuoted']),
      notes: json['notes'] as String?,
    );

Map<String, dynamic> _$RfqItemToJson(_RfqItem instance) => <String, dynamic>{
      'id': instance.id,
      'productId': instance.productId,
      'nameEn': instance.nameEn,
      'quantity': instance.quantity,
      'unitQuoted':
          const NullableDecimalConverter().toJson(instance.unitQuoted),
      'notes': instance.notes,
    };

_RfqCard _$RfqCardFromJson(Map<String, dynamic> json) => _RfqCard(
      id: json['id'] as String,
      rfqNumber: json['rfqNumber'] as String,
      status: $enumDecode(_$RfqStatusEnumMap, json['status']),
      currency: $enumDecode(_$CurrencyEnumMap, json['currency']),
      itemCount: (json['itemCount'] as num).toInt(),
      totalQuoted:
          const NullableDecimalConverter().fromJson(json['totalQuoted']),
      quoteVersion: (json['quoteVersion'] as num).toInt(),
      seller: json['seller'] == null
          ? null
          : RfqSeller.fromJson(json['seller'] as Map<String, dynamic>),
      requiredBy: const NullableUtcDateTimeConverter()
          .fromJson(json['requiredBy'] as String?),
      createdAt:
          const UtcDateTimeConverter().fromJson(json['createdAt'] as String),
      messageCount: (json['messageCount'] as num).toInt(),
    );

Map<String, dynamic> _$RfqCardToJson(_RfqCard instance) => <String, dynamic>{
      'id': instance.id,
      'rfqNumber': instance.rfqNumber,
      'status': _$RfqStatusEnumMap[instance.status]!,
      'currency': _$CurrencyEnumMap[instance.currency]!,
      'itemCount': instance.itemCount,
      'totalQuoted':
          const NullableDecimalConverter().toJson(instance.totalQuoted),
      'quoteVersion': instance.quoteVersion,
      'seller': instance.seller,
      'requiredBy':
          const NullableUtcDateTimeConverter().toJson(instance.requiredBy),
      'createdAt': const UtcDateTimeConverter().toJson(instance.createdAt),
      'messageCount': instance.messageCount,
    };

const _$RfqStatusEnumMap = {
  RfqStatus.draft: 'DRAFT',
  RfqStatus.submitted: 'SUBMITTED',
  RfqStatus.underReview: 'UNDER_REVIEW',
  RfqStatus.quoted: 'QUOTED',
  RfqStatus.negotiating: 'NEGOTIATING',
  RfqStatus.accepted: 'ACCEPTED',
  RfqStatus.rejected: 'REJECTED',
  RfqStatus.expired: 'EXPIRED',
  RfqStatus.cancelled: 'CANCELLED',
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

_RfqDetail _$RfqDetailFromJson(Map<String, dynamic> json) => _RfqDetail(
      id: json['id'] as String,
      rfqNumber: json['rfqNumber'] as String,
      status: $enumDecode(_$RfqStatusEnumMap, json['status']),
      currency: $enumDecode(_$CurrencyEnumMap, json['currency']),
      itemCount: (json['itemCount'] as num).toInt(),
      totalQuoted:
          const NullableDecimalConverter().fromJson(json['totalQuoted']),
      quoteVersion: (json['quoteVersion'] as num).toInt(),
      seller: json['seller'] == null
          ? null
          : RfqSeller.fromJson(json['seller'] as Map<String, dynamic>),
      requiredBy: const NullableUtcDateTimeConverter()
          .fromJson(json['requiredBy'] as String?),
      createdAt:
          const UtcDateTimeConverter().fromJson(json['createdAt'] as String),
      messageCount: (json['messageCount'] as num).toInt(),
      items: (json['items'] as List<dynamic>)
          .map((e) => RfqItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      notes: json['notes'] as String?,
      expiresAt: const NullableUtcDateTimeConverter()
          .fromJson(json['expiresAt'] as String?),
      updatedAt:
          const UtcDateTimeConverter().fromJson(json['updatedAt'] as String),
    );

Map<String, dynamic> _$RfqDetailToJson(_RfqDetail instance) =>
    <String, dynamic>{
      'id': instance.id,
      'rfqNumber': instance.rfqNumber,
      'status': _$RfqStatusEnumMap[instance.status]!,
      'currency': _$CurrencyEnumMap[instance.currency]!,
      'itemCount': instance.itemCount,
      'totalQuoted':
          const NullableDecimalConverter().toJson(instance.totalQuoted),
      'quoteVersion': instance.quoteVersion,
      'seller': instance.seller,
      'requiredBy':
          const NullableUtcDateTimeConverter().toJson(instance.requiredBy),
      'createdAt': const UtcDateTimeConverter().toJson(instance.createdAt),
      'messageCount': instance.messageCount,
      'items': instance.items,
      'notes': instance.notes,
      'expiresAt':
          const NullableUtcDateTimeConverter().toJson(instance.expiresAt),
      'updatedAt': const UtcDateTimeConverter().toJson(instance.updatedAt),
    };
