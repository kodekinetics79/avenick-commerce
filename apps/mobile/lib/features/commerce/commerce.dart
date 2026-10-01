/// THE COMMERCE FEATURE — cart → checkout → orders.
///
/// Everything the router needs is exported here, so `lib/app/router.dart` has
/// one import and no knowledge of the feature's internals.
///
/// SCREENS AND THEIR CONSTRUCTOR ARGUMENTS
///
///   CartScreen({
///     VoidCallback? onCheckout,
///     VoidCallback? onBrowse,
///     void Function(String productId)? onRequestQuote,
///   })
///   CheckoutScreen({void Function(String orderId)? onOrderPlaced})
///   OrderConfirmedScreen({required String orderId, VoidCallback? onDone})
///   OrdersListScreen({void Function(String orderId)? onOpenOrder})
///   OrderDetailScreen({required String orderId})
///
/// Every callback is optional and every one has a working default that uses
/// `Navigator.push`, so the flow runs today and gets better the moment the
/// router supplies real destinations.
///
/// PROVIDERS THE COMPOSITION ROOT MUST OVERRIDE
///
///   ordersGatewayProvider     — ApiOrdersGateway(api.orders)
///   checkoutGatewayProvider   — ApiCheckoutGateway(api.checkout)
///
/// PROVIDERS IT MAY OVERRIDE
///
///   cartStoreProvider         — a durable CartStore; the default is in-memory
///   sellerNamesProvider       — sellerId → display name, from the catalogue
///   savedAddressesProvider    — the buyer's addresses, from the account
///   mockPaymentsEnabledProvider — PILOT_MODE && ALLOW_MOCK_PAYMENTS
///   orderPlacementProvider    — the day `POST /v1/orders` exists
///   b2cEligibilityProvider    — READ ITS DOC. It decides whether a product can
///                               be bought or only quoted, and the flag it
///                               needs (`Product.isB2CEnabled`) is not on the
///                               wire. The default states "unstated" rather
///                               than guessing from `CartLine.channel`, which
///                               answers a different question.
///
/// AND ONE IT CAN FEED
///
///   localCartLineCountProvider is exactly what `cartLineCountProvider` in
///   `lib/app/tab_scaffold.dart` wants: lines, not units.
library;

export 'cart/cart_line_tile.dart';
export 'cart/cart_screen.dart';
export 'checkout/checkout_controller.dart';
export 'checkout/checkout_screen.dart';
export 'checkout/payment_methods.dart';
export 'checkout/quote_totals_panel.dart';
export 'data/commerce_gateways.dart';
export 'data/local_cart.dart';
export 'orders/order_confirmed_screen.dart';
export 'orders/order_detail_screen.dart';
export 'orders/order_parts.dart';
export 'orders/order_status_pill.dart';
export 'orders/orders_controller.dart';
export 'orders/orders_list_screen.dart';
export 'orders/persisted_totals_panel.dart';
export 'shared/commerce_ui.dart';
