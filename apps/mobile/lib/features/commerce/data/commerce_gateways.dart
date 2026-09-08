import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../api/checkout_api.dart';
import '../../../api/models/cart.dart';
import '../../../api/models/checkout.dart';
import '../../../api/models/enums.dart';
import '../../../api/models/order.dart';
import '../../../api/models/requests.dart';
import '../../../api/orders_api.dart';
import '../../../core/network/page.dart';

/// The ports this feature reaches the network through.
///
/// They are narrow interfaces rather than the `lib/api` clients themselves for
/// one practical reason: `OrdersApi` and `CheckoutApi` take an `ApiClient`,
/// which takes a real `SecureTokenStore` and a real socket. A widget test that
/// wanted to render an order list would have to stand up the whole networking
/// stack to do it. An interface here means a test overrides one provider with
/// six lines of fake, and the screens under test are the real ones.
///
/// WIRING (the CTO does this once, in the composition root):
///
///     ProviderScope(
///       overrides: <Override>[
///         ordersGatewayProvider.overrideWithValue(ApiOrdersGateway(api.orders)),
///         checkoutGatewayProvider.overrideWithValue(ApiCheckoutGateway(api.checkout)),
///       ],
///       child: const AvenickApp(),
///     )

/// Thrown when a screen reaches for a gateway the app never wired.
///
/// It is deliberately loud and names the provider: the alternative — a default
/// implementation returning empty data — renders a plausible empty cart or an
/// empty order history, which is indistinguishable from the real thing and
/// gets shipped.
class CommerceNotWired implements Exception {
  const CommerceNotWired(this.providerName);

  final String providerName;

  @override
  String toString() =>
      '$providerName was never overridden. Wire it in the composition root — '
      'see the header of lib/features/commerce/data/commerce_gateways.dart.';
}

/// Read side of `/v1/orders`.
abstract interface class OrdersGateway {
  Future<Page<OrderCard>> orders({
    String? cursor,
    int? limit,
    OrderStatus? status,
  });

  Future<OrderDetail> order(String id);
}

/// [OrdersGateway] backed by the real client.
class ApiOrdersGateway implements OrdersGateway {
  const ApiOrdersGateway(this._api);

  final OrdersApi _api;

  @override
  Future<Page<OrderCard>> orders({
    String? cursor,
    int? limit,
    OrderStatus? status,
  }) =>
      _api.orders(cursor: cursor, limit: limit, status: status);

  @override
  Future<OrderDetail> order(String id) => _api.order(id);
}

/// `POST /v1/checkout/quote` — the one route that exists on the server today.
abstract interface class CheckoutGateway {
  Future<CheckoutQuote> quote(CheckoutQuoteRequest request);
}

/// [CheckoutGateway] backed by the real client.
class ApiCheckoutGateway implements CheckoutGateway {
  const ApiCheckoutGateway(this._api);

  final CheckoutApi _api;

  @override
  Future<CheckoutQuote> quote(CheckoutQuoteRequest request) =>
      _api.quote(request);
}

final Provider<OrdersGateway> ordersGatewayProvider = Provider<OrdersGateway>(
  (Ref ref) => throw const CommerceNotWired('ordersGatewayProvider'),
);

final Provider<CheckoutGateway> checkoutGatewayProvider =
    Provider<CheckoutGateway>(
  (Ref ref) => throw const CommerceNotWired('checkoutGatewayProvider'),
);

/// Placing an order.
///
/// NULLABLE ON PURPOSE, and null is the default. The contract has no
/// `POST /v1/orders` — `orders_api.dart` says so in its header — so this app
/// can price a basket and cannot place it. A null capability makes the review
/// step render the reason instead of a button, which is the same rule the
/// payment list follows: never show a control that cannot complete.
///
/// The day a mobile place-order route is specified, implement this and
/// override the provider. Nothing else on the checkout screen changes.
abstract interface class OrderPlacement {
  /// Returns the placed order's id, for [OrderConfirmedScreen].
  Future<String> place({
    required CheckoutQuote quote,
    required PaymentMethod method,
    required ShippingAddress address,
  });
}

final Provider<OrderPlacement?> orderPlacementProvider =
    Provider<OrderPlacement?>((Ref ref) => null);

/// Seller display names, keyed by `sellerId`.
///
/// The cart groups by seller, and `CartLine` carries only a `sellerId` — there
/// is no `sellerName` and no embedded `SellerSummary` on the wire. Rather than
/// print a database id at a buyer, the group header looks the id up here and
/// falls back to a neutral label. The catalogue feature, which does hold
/// `SellerSummary`, can override this; an empty map is an honest default.
final Provider<Map<String, String>> sellerNamesProvider =
    Provider<Map<String, String>>((Ref ref) => const <String, String>{});

/// Addresses the buyer has already saved, offered at the address step.
///
/// Sourced from `/v1/addresses`, which the account feature owns. Empty here
/// means "type one in", never "you have none".
final Provider<List<ShippingAddress>> savedAddressesProvider =
    Provider<List<ShippingAddress>>((Ref ref) => const <ShippingAddress>[]);

/// Whether the deployment would accept the `MOCK` payment method.
///
/// Mirrors the web's gate: `PILOT_MODE && ALLOW_MOCK_PAYMENTS`. False in every
/// build that has not been told otherwise.
final Provider<bool> mockPaymentsEnabledProvider =
    Provider<bool>((Ref ref) => false);

/// WHETHER A PRODUCT CAN BE BOUGHT AT ALL, OR ONLY QUOTED.
///
/// ── THE FIELD IS NOT ON THE WIRE. ────────────────────────────────────────
///
/// The server gates this on `Product.isB2CEnabled`: `pilot-catalog.ts` sets it
/// to FALSE on both import paths, and `orders.ts` refuses a B2C order that
/// contains a product without it. Today that is the whole production
/// catalogue, so a basket of catalogue products is a basket that cannot be
/// bought.
///
/// `packages/contracts/openapi.json` exposes no such field. Every channel-ish
/// property on the wire — `CartLine.channel`, `ProductDetail.channel`,
/// `PriceBand.channel`, `CheckoutQuote.channel` — answers a DIFFERENT
/// question: which channel this line was PRICED in. A product can be priced in
/// B2C and still be `isB2CEnabled: false`; that is precisely the state the
/// pilot catalogue is in. Reading `channel == B2C` as "sellable" would be a
/// guess that looks right in every test anyone would think to write and is
/// wrong for all 1,172 rows in production.
///
/// The only place the flag surfaces on the wire at all is after the fact:
/// `CartMergeRejection.reason == channel_not_enabled`, which the server sends
/// once it has already refused a line.
///
/// So this is a PORT with an honest default: [UnstatedB2CEligibility] answers
/// [B2CSellability.unstated] for everything, because that is what the contract
/// supports. The guard in `CartController` is real and enforced — it refuses
/// anything reported as [B2CSellability.quoteOnly] — but it can only be as
/// correct as what it is told. **The contract needs a `sellableInChannel` (or
/// `isB2CEnabled`) boolean on `ProductCard`, `ProductDetail` and `CartLine`
/// before this can be right by construction.**
enum B2CSellability {
  /// The server has said this product can be bought outright in this channel.
  sellable,

  /// The server has said it cannot: it is quote-only. `POST /api/orders`
  /// refuses a B2C order containing it.
  quoteOnly,

  /// Nothing on the wire says, because the contract carries no such field.
  /// NOT a synonym for either of the above.
  unstated,
}

abstract interface class B2CEligibility {
  B2CSellability of(CartLine line);
}

/// The honest answer BEFORE the contract carried the flag: it does not know.
///
/// It deliberately does NOT fall back to `line.channel`. See the enum's doc.
/// Kept because it is the right stand-in for a test that wants to prove the
/// guard's behaviour under an unstated line, and because deleting it would
/// erase the reason the port exists.
class UnstatedB2CEligibility implements B2CEligibility {
  const UnstatedB2CEligibility();

  @override
  B2CSellability of(CartLine line) => B2CSellability.unstated;
}

/// The real one: read the flag the server now states.
///
/// `CartLine.sellableInChannel` became a REQUIRED field on the wire, which is
/// what turns this guard from advisory into correct by construction. There is
/// no inference here and there must never be one — the whole reason this port
/// existed with an `unstated` default is that guessing from `channel` is wrong
/// for every row in the production catalogue.
class ContractB2CEligibility implements B2CEligibility {
  const ContractB2CEligibility();

  @override
  B2CSellability of(CartLine line) =>
      line.sellableInChannel ? B2CSellability.sellable : B2CSellability.quoteOnly;
}

/// Defaults to the contract now that there is a contract to read.
///
/// Before this, the default answered [B2CSellability.unstated] for everything,
/// which meant the cart guard was real but inert: it would refuse a quote-only
/// line correctly, and was never told about one. Overriding this provider is
/// still how a test injects a different answer.
final Provider<B2CEligibility> b2cEligibilityProvider =
    Provider<B2CEligibility>((Ref ref) => const ContractB2CEligibility());
