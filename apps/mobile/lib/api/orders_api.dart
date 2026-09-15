import '../core/network/api_client.dart';
import '../core/network/page.dart';
import 'models/enums.dart';
import 'models/order.dart';
import 'models/requests.dart';

/// `/v1/orders` and `/v1/orders/{id}`.
///
/// `POST /v1/orders` is now specified, and [placeOrder] is it. Read its doc
/// before wiring a checkout to it: this is the one call on the surface that
/// must not happen twice, and the one whose most likely failure is a
/// dependency that does not exist yet rather than one that is down.
class OrdersApi {
  const OrdersApi(this._client);

  final ApiClient _client;

  static const String ordersPath = '/v1/orders';

  /// The header that makes a retry a replay rather than a second order.
  static const String idempotencyKeyHeader = 'Idempotency-Key';

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

  /// `POST /v1/orders` — place the order.
  ///
  /// ## IDEMPOTENCY: pass [idempotencyKey], and pass the SAME one on a retry
  ///
  /// A timeout on this call is not a rollback. The request may have reached the
  /// server, written the order, taken the payment intent and then failed on the
  /// way back — and a client that "just tries again" places a second order for
  /// the same basket. The `Idempotency-Key` header is what prevents that: the
  /// server answers a repeat of the same key with the ORIGINAL order and
  /// [PlacedOrder.replayed] set.
  ///
  /// So the key belongs to the SUBMISSION, not to the attempt. Mint it once
  /// when the buyer taps Place order — hold it in the checkout controller —
  /// and reuse it for every retry of that tap. This method mints one when the
  /// caller passes none, which is correct for a single attempt and WRONG for a
  /// retry loop: a fresh key per attempt is exactly the duplicate-order bug the
  /// header exists to stop. There is no default that can be right for both, so
  /// the parameter is explicit rather than clever.
  ///
  /// ## THE 503 IS NOT AN OUTAGE. DO NOT RETRY IT.
  ///
  /// Card and wallet methods — `MADA`, `APPLE_PAY`, `CREDIT_CARD`, `STC_PAY` —
  /// are refused with **503 / `upstream_unavailable`** until a payment-session
  /// flow exists. `BANK_TRANSFER` is the method that completes today (and
  /// `MOCK` where the deployment allows it).
  ///
  /// It arrives as a `ServerFailure` whose `code` is
  /// `ApiErrorCode.upstreamUnavailable` — `isUpstreamUnavailable` on the
  /// extension is the check — which is DISTINGUISHABLE from every other
  /// outcome precisely so the UI can explain it. Note that `ApiFailure`
  /// reports this code as retryable in general, and it is: a genuinely
  /// unavailable dependency comes back. Here it will not, because the
  /// dependency has not been built. Retrying a card payment on this surface is
  /// a spinner that can only ever end in the same 503, and the honest response
  /// is to say the method is not available yet and offer bank transfer.
  ///
  /// [PlaceOrderRequest.isSettleableMethod] is the check to make BEFORE
  /// sending, so the buyer is told at the payment step rather than after
  /// tapping Place order.
  ///
  /// ## B2C only
  ///
  /// A B2B order goes through the governed purchase-order workflow, which has
  /// no endpoint on this surface. A B2B basket sent here comes back `forbidden`
  /// or `validation_failed`, not a placed order.
  Future<PlacedOrder> placeOrder(
    PlaceOrderRequest request, {
    String? idempotencyKey,
  }) =>
      _client.post<PlacedOrder>(
        ordersPath,
        decoder: PlacedOrder.fromJson,
        body: request.toJson(),
        headers: <String, String>{
          idempotencyKeyHeader: idempotencyKey ?? newIdempotencyKey(),
        },
      );

  /// A fresh idempotency key.
  ///
  /// Built from the clock and this isolate's hash rather than from a UUID
  /// package: the contract asks only for a 1–128 character string that is
  /// unique per submission, and adding a dependency to `pubspec.yaml` for that
  /// is not a trade worth making. A caller that already HAS a stable id for
  /// the submission — a draft order id, a cart id plus a nonce — should pass
  /// that instead; it survives a process restart, and this does not.
  static String newIdempotencyKey() {
    final int now = DateTime.now().toUtc().microsecondsSinceEpoch;
    final int salt = identityHashCode(Object());
    return 'avn-${now.toRadixString(36)}-${salt.toRadixString(36)}';
  }

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
