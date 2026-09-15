/// Every path in the app, in one place, mirroring the web routes 1:1.
///
/// The mirror is not tidiness. These paths are what a marketing email, a
/// WhatsApp share, an order-confirmation SMS and a push notification all
/// contain, and they are minted by the web app. If mobile invents
/// `/product/:id` while the web serves `/products/:slug`, every link that
/// reaches a phone with the app installed dead-ends.
abstract final class Routes {
  // Tab roots.
  static const String home = '/';
  static const String search = '/search';
  static const String cart = '/cart';
  static const String orders = '/orders';
  static const String account = '/account';

  // Deep-linkable detail routes — same shape as the web.
  static const String product = '/products/:slug';
  static const String category = '/categories/:slug';
  static const String order = '/orders/:id';
  static const String b2bApproval = '/b2b/approvals/:id';

  // Auth.
  static const String signIn = '/sign-in';

  static String productOf(String slug) => '/products/$slug';
  static String categoryOf(String slug) => '/categories/$slug';
  static String orderOf(String id) => '/orders/$id';
  static String b2bApprovalOf(String id) => '/b2b/approvals/$id';

  /// Route names, for `goNamed` call sites that should not hardcode a path.
  static const String nHome = 'home';
  static const String nSearch = 'search';
  static const String nCart = 'cart';
  static const String nOrders = 'orders';
  static const String nAccount = 'account';
  static const String nProduct = 'product';
  static const String nCategory = 'category';
  static const String nOrder = 'order';
  static const String nB2bApproval = 'b2bApproval';
  static const String nSignIn = 'signIn';

  // ── Checkout and post-purchase ────────────────────────────────────────────
  static const String checkout = '/checkout';
  // Deliberately NOT '/orders/:id/confirmed'. That would sit under the same
  // prefix as the `/orders/:id` route inside the Orders tab branch, and a
  // nested match there is ambiguous — the confirmation belongs above the
  // shell anyway, since it covers the tab bar.
  static const String orderConfirmed = '/order-confirmed/:id';
  static String orderConfirmedOf(String id) => '/order-confirmed/$id';
  static const String nCheckout = 'checkout';
  static const String nOrderConfirmed = 'orderConfirmed';

  // ── Quote requests ────────────────────────────────────────────────────────
  //
  // The primary action of this app, not a side journey: every product in the
  // production catalogue answers `sellableInChannel: false`, so the buy box
  // says "Request a quote" and lands here.
  static const String rfqNew = '/rfq/new';
  static const String rfqs = '/rfqs';
  static const String rfq = '/rfqs/:id';
  static String rfqOf(String id) => '/rfqs/$id';
  static const String nRfqNew = 'rfqNew';
  static const String nRfqs = 'rfqs';
  static const String nRfq = 'rfq';

  // ── Account sub-pages ─────────────────────────────────────────────────────
  static const String addresses = '/account/addresses';
  static const String notificationPrefs = '/account/notifications';
  static const String deleteAccount = '/account/delete';
  static const String nAddresses = 'addresses';
  static const String nNotificationPrefs = 'notificationPrefs';
  static const String nDeleteAccount = 'deleteAccount';

  /// Paths that require a session.
  ///
  /// `/cart` is deliberately NOT here: a guest must be able to build a basket
  /// and only meet the wall at checkout. Making the cart itself protected is
  /// how you turn a browsing session into a bounce.
  ///
  /// `/checkout` IS here — that is where the wall belongs.
  ///
  /// `/rfq/new` is deliberately NOT here either, and that is the more important
  /// call. With a quote-only catalogue, asking for a price is the equivalent of
  /// adding to a basket: it is the first thing a stranger does, and putting a
  /// sign-in wall in front of it is putting one in front of the funnel. The
  /// server takes an anonymous RFQ; the wall belongs at the point of commitment,
  /// which is reading and accepting the quote (`/rfqs`).
  static bool requiresAuth(String location) {
    final String path = Uri.parse(location).path;
    return path == orders ||
        path.startsWith('/orders/') ||
        path.startsWith('/order-confirmed/') ||
        path == checkout ||
        path == account ||
        path.startsWith('/account/') ||
        path == rfqs ||
        (path.startsWith('/rfqs/') && path != rfqNew) ||
        path.startsWith('/b2b/');
  }

  /// Paths that additionally require a B2B account.
  static bool requiresB2B(String location) =>
      Uri.parse(location).path.startsWith('/b2b/');
}
