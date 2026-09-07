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

  /// Paths that require a session.
  ///
  /// `/cart` is deliberately NOT here: a guest must be able to build a basket
  /// and only meet the wall at checkout. Making the cart itself protected is
  /// how you turn a browsing session into a bounce.
  static bool requiresAuth(String location) {
    final String path = Uri.parse(location).path;
    return path == orders ||
        path.startsWith('/orders/') ||
        path == account ||
        path.startsWith('/account/') ||
        path.startsWith('/b2b/');
  }

  /// Paths that additionally require a B2B account.
  static bool requiresB2B(String location) =>
      Uri.parse(location).path.startsWith('/b2b/');
}
