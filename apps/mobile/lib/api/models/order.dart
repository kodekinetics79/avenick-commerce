import 'package:freezed_annotation/freezed_annotation.dart';

import 'checkout.dart';
import 'common.dart';
import 'converters.dart';
import 'decimal.dart';
import 'enums.dart';
import 'money.dart';
import 'order_totals.dart';

part 'order.freezed.dart';
part 'order.g.dart';

/// One line of a placed order.
///
/// [slug] is nullable here and not on [CartLine]: the product may have been
/// delisted since the order was placed, and an order must still render when
/// the thing it bought no longer has a page. Treat a null slug as "not
/// tappable", never as a broken link.
@freezed
abstract class OrderItem with _$OrderItem {
  const OrderItem._();

  const factory OrderItem({
    required String id,
    required String productId,
    required String? variantId,
    required String sellerId,
    required String? slug,
    required String sku,
    required String nameEn,
    required String nameAr,
    required ImageRef? image,
    required int quantity,
    @DecimalConverter() required Decimal unitPrice,
    @DecimalConverter() required Decimal vatRatePercent,
    @DecimalConverter() required Decimal vatAmount,
    @DecimalConverter() required Decimal total,

    /// A line can move independently of the order: one seller ships while
    /// another cancels. Do not read the order's status onto its items.
    required OrderStatus status,
  }) = _OrderItem;

  factory OrderItem.fromJson(Map<String, dynamic> json) =>
      _$OrderItemFromJson(json);

  String name(Language language) => language == Language.ar ? nameAr : nameEn;

  Money unitPriceIn(Currency currency) => Money.of(unitPrice, currency);
  Money vatAmountIn(Currency currency) => Money.of(vatAmount, currency);
  Money totalIn(Currency currency) => Money.of(total, currency);

  bool get hasProductPage => slug != null;
}

/// One entry of the order's status timeline.
@freezed
abstract class OrderStatusEvent with _$OrderStatusEvent {
  const factory OrderStatusEvent({
    required OrderStatus status,
    required String? message,
    @UtcDateTimeConverter() required DateTime occurredAt,
  }) = _OrderStatusEvent;

  factory OrderStatusEvent.fromJson(Map<String, dynamic> json) =>
      _$OrderStatusEventFromJson(json);
}

@freezed
abstract class Shipment with _$Shipment {
  const Shipment._();

  const factory Shipment({
    required String id,
    required ShipmentStatus status,
    required String? carrier,
    required String? trackingNumber,
    required String? trackingUrl,
    @NullableUtcDateTimeConverter() required DateTime? estimatedDelivery,
  }) = _Shipment;

  factory Shipment.fromJson(Map<String, dynamic> json) =>
      _$ShipmentFromJson(json);

  /// A tracking number with no URL is common — the carrier has no deep link.
  /// Show the number, do not fabricate a link.
  bool get isTrackable => trackingUrl != null;
}

/// An order as the history LIST shows it.
@freezed
abstract class OrderCard with _$OrderCard {
  const OrderCard._();

  const factory OrderCard({
    required String id,
    required String orderNumber,
    required OrderStatus status,
    required PaymentStatus paymentStatus,

    /// B2C or B2B. `OrderType` in Prisma; the same value set as [Channel], so
    /// the mobile surface names it once.
    required Channel type,
    required Currency currency,
    @DecimalConverter() required Decimal total,
    required int itemCount,
    required ImageRef? thumbnail,
    @UtcDateTimeConverter() required DateTime placedAt,
  }) = _OrderCard;

  factory OrderCard.fromJson(Map<String, dynamic> json) =>
      _$OrderCardFromJson(json);

  Money get totalMoney => Money.of(total, currency);
}

/// A placed order in full.
///
/// [totals] is [PersistedOrderTotals], NOT [OrderTotals]: the `Order` table
/// has no column for the goods/shipping VAT split, so on a fetched order those
/// two components can be null. That is a real difference, deliberately kept.
@freezed
abstract class OrderDetail with _$OrderDetail {
  const OrderDetail._();

  const factory OrderDetail({
    required String id,
    required String orderNumber,
    required OrderStatus status,
    required PaymentStatus paymentStatus,

    /// Null until a payment is attempted.
    required PaymentMethod? paymentMethod,
    required Channel type,
    required Currency currency,
    required PersistedOrderTotals totals,
    required List<OrderItem> items,
    required ShippingAddress shippingAddress,
    required List<Shipment> shipments,
    required List<OrderStatusEvent> statusHistory,
    required String? notes,
    required String? vatInvoiceUrl,
    @UtcDateTimeConverter() required DateTime placedAt,
    @UtcDateTimeConverter() required DateTime updatedAt,
  }) = _OrderDetail;

  factory OrderDetail.fromJson(Map<String, dynamic> json) =>
      _$OrderDetailFromJson(json);

  PersistedMoneyTotals get money => totals.inCurrency(currency);

  /// True when this order recorded how its VAT split between goods and
  /// freight. False for every order written before the `Order` table grew
  /// those columns — the VAT breakdown row must then be hidden, not zeroed.
  bool get hasVatBreakdown => totals.hasVatBreakdown;

  bool get hasInvoice => vatInvoiceUrl != null;

  /// The timeline, oldest first. The server's order is not guaranteed, and a
  /// timeline that renders backwards is a support ticket.
  List<OrderStatusEvent> get timeline =>
      [...statusHistory]..sort((a, b) => a.occurredAt.compareTo(b.occurredAt));
}

/// What `POST /v1/orders` answers with: the order, and whether this response
/// created it or replayed one that already existed.
///
/// [replayed] IS NOT COSMETIC. Placing an order is the one call in this app
/// that must not happen twice, and a timeout is not a rollback — the request
/// may well have been applied. The client's defence is an `Idempotency-Key`
/// header, and the server's answer to a repeat of the same submission is the
/// ORIGINAL order with `replayed: true` rather than a second one.
///
/// So the flag is how the app tells "I placed your order" from "your order was
/// already placed". Both are successes and neither is an error, but a
/// confirmation screen that celebrates a replay as a fresh purchase is how a
/// buyer who tapped twice believes they have bought two. Show the order;
/// suppress the "thank you" fanfare and any second confirmation email trigger
/// when [replayed] is true.
@freezed
abstract class PlacedOrder with _$PlacedOrder {
  const PlacedOrder._();

  const factory PlacedOrder({
    required OrderDetail order,

    /// True when this response replayed an order an earlier request had
    /// already created, under the same `Idempotency-Key`.
    required bool replayed,
  }) = _PlacedOrder;

  factory PlacedOrder.fromJson(Map<String, dynamic> json) =>
      _$PlacedOrderFromJson(json);

  /// This request is what created the order.
  bool get isNew => !replayed;

  String get id => order.id;
  String get orderNumber => order.orderNumber;
}
