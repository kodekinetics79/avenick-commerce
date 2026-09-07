// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_totals.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_OrderTotals _$OrderTotalsFromJson(Map<String, dynamic> json) => _OrderTotals(
      subtotal: const DecimalConverter().fromJson(json['subtotal'] as Object),
      discountAmount:
          const DecimalConverter().fromJson(json['discountAmount'] as Object),
      goodsVatAmount:
          const DecimalConverter().fromJson(json['goodsVatAmount'] as Object),
      shippingAmount:
          const DecimalConverter().fromJson(json['shippingAmount'] as Object),
      shippingVatAmount: const DecimalConverter()
          .fromJson(json['shippingVatAmount'] as Object),
      vatAmount: const DecimalConverter().fromJson(json['vatAmount'] as Object),
      total: const DecimalConverter().fromJson(json['total'] as Object),
    );

Map<String, dynamic> _$OrderTotalsToJson(_OrderTotals instance) =>
    <String, dynamic>{
      'subtotal': const DecimalConverter().toJson(instance.subtotal),
      'discountAmount':
          const DecimalConverter().toJson(instance.discountAmount),
      'goodsVatAmount':
          const DecimalConverter().toJson(instance.goodsVatAmount),
      'shippingAmount':
          const DecimalConverter().toJson(instance.shippingAmount),
      'shippingVatAmount':
          const DecimalConverter().toJson(instance.shippingVatAmount),
      'vatAmount': const DecimalConverter().toJson(instance.vatAmount),
      'total': const DecimalConverter().toJson(instance.total),
    };

_PersistedOrderTotals _$PersistedOrderTotalsFromJson(
        Map<String, dynamic> json) =>
    _PersistedOrderTotals(
      subtotal: const DecimalConverter().fromJson(json['subtotal'] as Object),
      discountAmount:
          const DecimalConverter().fromJson(json['discountAmount'] as Object),
      shippingAmount:
          const DecimalConverter().fromJson(json['shippingAmount'] as Object),
      vatAmount: const DecimalConverter().fromJson(json['vatAmount'] as Object),
      goodsVatAmount:
          const NullableDecimalConverter().fromJson(json['goodsVatAmount']),
      shippingVatAmount:
          const NullableDecimalConverter().fromJson(json['shippingVatAmount']),
      total: const DecimalConverter().fromJson(json['total'] as Object),
    );

Map<String, dynamic> _$PersistedOrderTotalsToJson(
        _PersistedOrderTotals instance) =>
    <String, dynamic>{
      'subtotal': const DecimalConverter().toJson(instance.subtotal),
      'discountAmount':
          const DecimalConverter().toJson(instance.discountAmount),
      'shippingAmount':
          const DecimalConverter().toJson(instance.shippingAmount),
      'vatAmount': const DecimalConverter().toJson(instance.vatAmount),
      'goodsVatAmount':
          const NullableDecimalConverter().toJson(instance.goodsVatAmount),
      'shippingVatAmount':
          const NullableDecimalConverter().toJson(instance.shippingVatAmount),
      'total': const DecimalConverter().toJson(instance.total),
    };
