// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_OrderItem _$OrderItemFromJson(Map<String, dynamic> json) => _OrderItem(
      id: json['id'] as String,
      productId: json['productId'] as String,
      variantId: json['variantId'] as String?,
      sellerId: json['sellerId'] as String,
      slug: json['slug'] as String?,
      sku: json['sku'] as String,
      nameEn: json['nameEn'] as String,
      nameAr: json['nameAr'] as String,
      image: json['image'] == null
          ? null
          : ImageRef.fromJson(json['image'] as Map<String, dynamic>),
      quantity: (json['quantity'] as num).toInt(),
      unitPrice: const DecimalConverter().fromJson(json['unitPrice'] as Object),
      vatRatePercent:
          const DecimalConverter().fromJson(json['vatRatePercent'] as Object),
      vatAmount: const DecimalConverter().fromJson(json['vatAmount'] as Object),
      total: const DecimalConverter().fromJson(json['total'] as Object),
      status: $enumDecode(_$OrderStatusEnumMap, json['status']),
    );

Map<String, dynamic> _$OrderItemToJson(_OrderItem instance) =>
    <String, dynamic>{
      'id': instance.id,
      'productId': instance.productId,
      'variantId': instance.variantId,
      'sellerId': instance.sellerId,
      'slug': instance.slug,
      'sku': instance.sku,
      'nameEn': instance.nameEn,
      'nameAr': instance.nameAr,
      'image': instance.image,
      'quantity': instance.quantity,
      'unitPrice': const DecimalConverter().toJson(instance.unitPrice),
      'vatRatePercent':
          const DecimalConverter().toJson(instance.vatRatePercent),
      'vatAmount': const DecimalConverter().toJson(instance.vatAmount),
      'total': const DecimalConverter().toJson(instance.total),
      'status': _$OrderStatusEnumMap[instance.status]!,
    };

const _$OrderStatusEnumMap = {
  OrderStatus.pendingPayment: 'PENDING_PAYMENT',
  OrderStatus.paymentConfirmed: 'PAYMENT_CONFIRMED',
  OrderStatus.confirmed: 'CONFIRMED',
  OrderStatus.processing: 'PROCESSING',
  OrderStatus.shipped: 'SHIPPED',
  OrderStatus.outForDelivery: 'OUT_FOR_DELIVERY',
  OrderStatus.delivered: 'DELIVERED',
  OrderStatus.cancelled: 'CANCELLED',
  OrderStatus.refunded: 'REFUNDED',
  OrderStatus.returnRequested: 'RETURN_REQUESTED',
  OrderStatus.returned: 'RETURNED',
};

_OrderStatusEvent _$OrderStatusEventFromJson(Map<String, dynamic> json) =>
    _OrderStatusEvent(
      status: $enumDecode(_$OrderStatusEnumMap, json['status']),
      message: json['message'] as String?,
      occurredAt:
          const UtcDateTimeConverter().fromJson(json['occurredAt'] as String),
    );

Map<String, dynamic> _$OrderStatusEventToJson(_OrderStatusEvent instance) =>
    <String, dynamic>{
      'status': _$OrderStatusEnumMap[instance.status]!,
      'message': instance.message,
      'occurredAt': const UtcDateTimeConverter().toJson(instance.occurredAt),
    };

_Shipment _$ShipmentFromJson(Map<String, dynamic> json) => _Shipment(
      id: json['id'] as String,
      status: $enumDecode(_$ShipmentStatusEnumMap, json['status']),
      carrier: json['carrier'] as String?,
      trackingNumber: json['trackingNumber'] as String?,
      trackingUrl: json['trackingUrl'] as String?,
      estimatedDelivery: const NullableUtcDateTimeConverter()
          .fromJson(json['estimatedDelivery'] as String?),
    );

Map<String, dynamic> _$ShipmentToJson(_Shipment instance) => <String, dynamic>{
      'id': instance.id,
      'status': _$ShipmentStatusEnumMap[instance.status]!,
      'carrier': instance.carrier,
      'trackingNumber': instance.trackingNumber,
      'trackingUrl': instance.trackingUrl,
      'estimatedDelivery': const NullableUtcDateTimeConverter()
          .toJson(instance.estimatedDelivery),
    };

const _$ShipmentStatusEnumMap = {
  ShipmentStatus.pending: 'PENDING',
  ShipmentStatus.pickedUp: 'PICKED_UP',
  ShipmentStatus.inTransit: 'IN_TRANSIT',
  ShipmentStatus.outForDelivery: 'OUT_FOR_DELIVERY',
  ShipmentStatus.delivered: 'DELIVERED',
  ShipmentStatus.failed: 'FAILED',
  ShipmentStatus.returned: 'RETURNED',
};

_OrderCard _$OrderCardFromJson(Map<String, dynamic> json) => _OrderCard(
      id: json['id'] as String,
      orderNumber: json['orderNumber'] as String,
      status: $enumDecode(_$OrderStatusEnumMap, json['status']),
      paymentStatus: $enumDecode(_$PaymentStatusEnumMap, json['paymentStatus']),
      type: $enumDecode(_$ChannelEnumMap, json['type']),
      currency: $enumDecode(_$CurrencyEnumMap, json['currency']),
      total: const DecimalConverter().fromJson(json['total'] as Object),
      itemCount: (json['itemCount'] as num).toInt(),
      thumbnail: json['thumbnail'] == null
          ? null
          : ImageRef.fromJson(json['thumbnail'] as Map<String, dynamic>),
      placedAt:
          const UtcDateTimeConverter().fromJson(json['placedAt'] as String),
    );

Map<String, dynamic> _$OrderCardToJson(_OrderCard instance) =>
    <String, dynamic>{
      'id': instance.id,
      'orderNumber': instance.orderNumber,
      'status': _$OrderStatusEnumMap[instance.status]!,
      'paymentStatus': _$PaymentStatusEnumMap[instance.paymentStatus]!,
      'type': _$ChannelEnumMap[instance.type]!,
      'currency': _$CurrencyEnumMap[instance.currency]!,
      'total': const DecimalConverter().toJson(instance.total),
      'itemCount': instance.itemCount,
      'thumbnail': instance.thumbnail,
      'placedAt': const UtcDateTimeConverter().toJson(instance.placedAt),
    };

const _$PaymentStatusEnumMap = {
  PaymentStatus.unpaid: 'UNPAID',
  PaymentStatus.paid: 'PAID',
  PaymentStatus.partiallyPaid: 'PARTIALLY_PAID',
  PaymentStatus.refunded: 'REFUNDED',
  PaymentStatus.failed: 'FAILED',
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

_OrderDetail _$OrderDetailFromJson(Map<String, dynamic> json) => _OrderDetail(
      id: json['id'] as String,
      orderNumber: json['orderNumber'] as String,
      status: $enumDecode(_$OrderStatusEnumMap, json['status']),
      paymentStatus: $enumDecode(_$PaymentStatusEnumMap, json['paymentStatus']),
      paymentMethod:
          $enumDecodeNullable(_$PaymentMethodEnumMap, json['paymentMethod']),
      type: $enumDecode(_$ChannelEnumMap, json['type']),
      currency: $enumDecode(_$CurrencyEnumMap, json['currency']),
      totals:
          PersistedOrderTotals.fromJson(json['totals'] as Map<String, dynamic>),
      items: (json['items'] as List<dynamic>)
          .map((e) => OrderItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      shippingAddress: ShippingAddress.fromJson(
          json['shippingAddress'] as Map<String, dynamic>),
      shipments: (json['shipments'] as List<dynamic>)
          .map((e) => Shipment.fromJson(e as Map<String, dynamic>))
          .toList(),
      statusHistory: (json['statusHistory'] as List<dynamic>)
          .map((e) => OrderStatusEvent.fromJson(e as Map<String, dynamic>))
          .toList(),
      notes: json['notes'] as String?,
      vatInvoiceUrl: json['vatInvoiceUrl'] as String?,
      placedAt:
          const UtcDateTimeConverter().fromJson(json['placedAt'] as String),
      updatedAt:
          const UtcDateTimeConverter().fromJson(json['updatedAt'] as String),
    );

Map<String, dynamic> _$OrderDetailToJson(_OrderDetail instance) =>
    <String, dynamic>{
      'id': instance.id,
      'orderNumber': instance.orderNumber,
      'status': _$OrderStatusEnumMap[instance.status]!,
      'paymentStatus': _$PaymentStatusEnumMap[instance.paymentStatus]!,
      'paymentMethod': _$PaymentMethodEnumMap[instance.paymentMethod],
      'type': _$ChannelEnumMap[instance.type]!,
      'currency': _$CurrencyEnumMap[instance.currency]!,
      'totals': instance.totals,
      'items': instance.items,
      'shippingAddress': instance.shippingAddress,
      'shipments': instance.shipments,
      'statusHistory': instance.statusHistory,
      'notes': instance.notes,
      'vatInvoiceUrl': instance.vatInvoiceUrl,
      'placedAt': const UtcDateTimeConverter().toJson(instance.placedAt),
      'updatedAt': const UtcDateTimeConverter().toJson(instance.updatedAt),
    };

const _$PaymentMethodEnumMap = {
  PaymentMethod.mada: 'MADA',
  PaymentMethod.applePay: 'APPLE_PAY',
  PaymentMethod.creditCard: 'CREDIT_CARD',
  PaymentMethod.bankTransfer: 'BANK_TRANSFER',
  PaymentMethod.stcPay: 'STC_PAY',
  PaymentMethod.mock: 'MOCK',
};
