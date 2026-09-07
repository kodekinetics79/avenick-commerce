import '../core/network/api_client.dart';
import '../core/network/page.dart';
import 'models/enums.dart';
import 'models/order.dart';

/// `/v1/orders` and `/v1/orders/{id}`.
///
/// There is no "place order" here, and that is not an omission: the contract
/// has no `POST /v1/orders`. A quote is priced by `/v1/checkout/quote` and the
/// order is placed by the existing web checkout. Until a mobile place-order
/// endpoint is specified, this app can show orders and cannot create one.
class OrdersApi {
  const OrdersApi(this._client);

  final ApiClient _client;

  static const String ordersPath = '/v1/orders';

  /// `GET /v1/orders` — order history, newest first.
  Future<Page<OrderCard>> orders({
    String? cursor,
    int? limit,
    OrderStatus? status,
  }) =>
      _client.getPage<OrderCard>(
        ordersPath,
        itemDecoder: OrderCard.fromJson,
        query: <String, Object?>{
          'cursor': cursor,
          'limit': limit,
          'status': status == null ? null : _statusWire(status),
        },
      );

  /// `GET /v1/orders/{id}`
  ///
  /// The totals come back as `PersistedOrderTotals`, whose goods and shipping
  /// VAT components are NULLABLE — the `Order` table has no column for either.
  /// Check [OrderDetail.hasVatBreakdown] before drawing a VAT split; a null
  /// there means "not recorded", and rendering it as zero would state that no
  /// VAT was charged on delivery, which is the claim PR #21 fixed.
  Future<OrderDetail> order(String id) => _client.get<OrderDetail>(
        '$ordersPath/${Uri.encodeComponent(id)}',
        decoder: OrderDetail.fromJson,
      );

  CursorPager<OrderCard> orderPager({OrderStatus? status, int? limit}) =>
      CursorPager<OrderCard>(
        fetch: ({String? cursor}) =>
            orders(cursor: cursor, limit: limit, status: status),
      );

  /// The wire spelling of an [OrderStatus]. The enum's Dart names are
  /// lowerCamelCase to keep the linter quiet, so the SCREAMING_SNAKE form the
  /// server expects is produced here rather than by `.name`.
  static String _statusWire(OrderStatus status) => const <OrderStatus, String>{
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
      }[status]!;
}
