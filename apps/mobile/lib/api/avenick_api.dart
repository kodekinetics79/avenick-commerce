import 'package:dio/dio.dart';

import '../core/network/api_client.dart';
import '../core/network/api_config.dart';
import '../core/storage/auth_session.dart';
import '../core/storage/secure_token_store.dart';
import 'account_api.dart';
import 'auth_api.dart';
import 'cart_api.dart';
import 'catalogue_api.dart';
import 'checkout_api.dart';
import 'devices_api.dart';
import 'orders_api.dart';
import 'rfqs_api.dart';

/// The whole API surface, assembled.
///
/// One of these per app. It owns the two Dio instances, the session, and the
/// eight endpoint clients, and it is the only thing above this layer that
/// needs constructing.
///
///     final api = AvenickApi.build(config: ApiConfig.fromEnvironment());
///     await api.session.restore();
///     final page = await api.catalogue.products(search: 'valve');
///
/// Every method on every client either returns a model or throws an
/// `ApiFailure` — a sealed family, so a `switch` over it is exhaustive and the
/// compiler will point at the screen that forgot the new case.
///
/// NOTE ON WHAT ACTUALLY WORKS TODAY: `/v1/checkout/quote` is implemented on
/// the server; `POST /v1/orders` and the four `/v1/rfqs` operations are newly
/// specified. The catalogue, cart, account, address and device routes are
/// specified and not built; the auth routes are specified, not built, and
/// additionally require a refresh-token table and an OTP model that do not
/// exist. See the header of `auth_api.dart`.
///
/// AND ONE RULE THAT IS NOT ABOUT PLUMBING: `ProductCard`, `ProductDetail` and
/// `CartLine` all carry `sellableInChannel`. That flag — not the presence of a
/// price — decides Add to cart versus Request a quote. The pilot catalogue is
/// priced in B2C and flagged unsellable in it, so the two disagree on every
/// row in production.
class AvenickApi {
  AvenickApi._({
    required this.client,
    required this.auth,
    required this.catalogue,
    required this.cart,
    required this.checkout,
    required this.orders,
    required this.rfqs,
    required this.account,
    required this.devices,
  });

  final ApiClient client;
  final AuthApi auth;
  final CatalogueApi catalogue;
  final CartApi cart;
  final CheckoutApi checkout;
  final OrdersApi orders;
  final RfqsApi rfqs;
  final AccountApi account;
  final DevicesApi devices;

  AuthSession get session => client.session;
  ApiConfig get config => client.config;

  /// Build the stack.
  ///
  /// [adapter] and [log] exist for tests: a fake `HttpClientAdapter` is how
  /// `test/api/` exercises the interceptor chain — including the single-flight
  /// refresh — without a socket.
  factory AvenickApi.build({
    required ApiConfig config,
    TokenStore? store,
    HttpClientAdapter? adapter,
    void Function(String message)? log,
  }) {
    late final AuthApi authApi;

    final client = ApiClient.build(
      config: config,
      store: store ?? SecureTokenStore(),
      // The session needs something that can call `/v1/auth/refresh`, and that
      // call must go out on the client WITHOUT the auth interceptor — a
      // refresh that tried to refresh itself would recurse. `ApiClient.build`
      // hands the unauthenticated Dio back here for exactly that reason.
      refresherFactory: (unauthenticatedDio) {
        authApi = AuthApi(unauthenticatedDio);
        return authApi;
      },
      adapter: adapter,
      log: log,
    );

    return AvenickApi._(
      client: client,
      auth: authApi,
      catalogue: CatalogueApi(client),
      cart: CartApi(client),
      checkout: CheckoutApi(client),
      orders: OrdersApi(client),
      rfqs: RfqsApi(client),
      account: AccountApi(client),
      devices: DevicesApi(client),
    );
  }

  Future<void> dispose() async {
    client.close();
    await session.dispose();
  }
}
