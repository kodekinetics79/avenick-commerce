import '../core/network/api_client.dart';
import 'models/cart.dart';
import 'models/requests.dart';

/// `/v1/cart` and its mutations.
///
/// Every mutation returns the WHOLE cart, not a delta. That is the contract's
/// choice and a good one: a cart is re-priced on every change (a quantity that
/// crosses a tier rung changes the unit price of a line the caller did not
/// touch), so a delta would have to describe re-pricing anyway. Replace local
/// state with what comes back; do not merge it.
class CartApi {
  const CartApi(this._client);

  final ApiClient _client;

  static const String cartPath = '/v1/cart';
  static const String itemsPath = '/v1/cart/items';
  static const String mergePath = '/v1/cart/merge';

  /// `GET /v1/cart`
  Future<Cart> cart() => _client.get<Cart>(cartPath, decoder: Cart.fromJson);

  /// `POST /v1/cart/items` — add a line, or increase one that already exists.
  ///
  /// A 409 here is a real answer, not a fault: stock moved, or the quantity
  /// crossed a limit. It arrives as a `ServerFailure` whose `isConflict` is
  /// true, carrying a message safe to show.
  Future<Cart> addItem(CartLineInput line) => _client.post<Cart>(
        itemsPath,
        decoder: Cart.fromJson,
        body: line.toJson(),
      );

  /// `PATCH /v1/cart/items/{id}` — set an ABSOLUTE quantity, not a delta.
  ///
  /// [id] is the cart LINE id (`CartLine.id`), not the product id. Sending a
  /// product id here is a 404 rather than a wrong-item edit, which is the
  /// right way round.
  ///
  /// There is no `qty: 0` — the contract requires a positive integer. Removing
  /// a line is [removeItem].
  Future<Cart> setQuantity({required String lineId, required int qty}) =>
      _client.patch<Cart>(
        '$itemsPath/${Uri.encodeComponent(lineId)}',
        decoder: Cart.fromJson,
        body: <String, Object?>{'qty': qty},
      );

  /// `DELETE /v1/cart/items/{id}`
  Future<Cart> removeItem(String lineId) => _client.delete<Cart>(
        '$itemsPath/${Uri.encodeComponent(lineId)}',
        decoder: Cart.fromJson,
      );

  /// `POST /v1/cart/merge` — fold a guest cart into the signed-in one.
  ///
  /// Call this ONCE, immediately after a successful sign-in, then clear the
  /// local guest cart. The result carries a `rejected` list, and the app must
  /// show it: dropping a line the buyer added before signing in without saying
  /// so is how a cart appears to "lose" items.
  Future<CartMergeResult> merge(CartMergeRequest request) =>
      _client.post<CartMergeResult>(
        mergePath,
        decoder: CartMergeResult.fromJson,
        body: request.toJson(),
      );
}
