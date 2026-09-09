import '../core/network/api_client.dart';
import 'models/checkout.dart';
import 'models/requests.dart';

/// `POST /v1/checkout/quote` — price a basket before anyone is charged.
///
/// This is the ONE route under `app/api/v1/` that exists on the server today.
///
/// The quote it returns is the thing an order is written from, and its totals
/// carry the goods and shipping VAT as two separate required figures.
/// [CheckoutQuote] parses through [OrderTotals], which REFUSES a payload where
/// `vatAmount != goodsVatAmount + shippingVatAmount` — the exact shape of the
/// defect PR #21 fixed. A quote that fails that check never reaches a screen.
class CheckoutApi {
  const CheckoutApi(this._client);

  final ApiClient _client;

  static const String quotePath = '/v1/checkout/quote';

  /// Price the basket.
  ///
  /// The quote has an [CheckoutQuote.expiresAt]. Re-quote rather than reuse a
  /// stale one: prices, stock and freight all move, and placing an order
  /// against an expired quote is a `conflict`, which is the server correctly
  /// refusing to honour a figure it no longer stands behind.
  ///
  /// Watch [CheckoutQuote.shipping] before showing a total.
  /// `unpriced_no_zones` means no zone covers the address — the freight line
  /// is zero because it is UNKNOWN, not because delivery is free, and a total
  /// presented without saying so understates what the buyer will pay.
  Future<CheckoutQuote> quote(CheckoutQuoteRequest request) =>
      _client.post<CheckoutQuote>(
        quotePath,
        decoder: CheckoutQuote.fromJson,
        body: request.toJson(),
      );
}
