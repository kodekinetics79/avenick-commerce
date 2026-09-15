import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/l10n/directional_text.dart';
import '../features/account/account.dart';
import '../features/catalogue/catalogue.dart';
import '../features/commerce/commerce.dart';
// `hide`: rfq and commerce each carry their own copy of these two helpers
// (house precedent is a self-contained feature tree), and importing both
// barrels unqualified would be ambiguous. The router uses neither.
import '../features/rfq/rfq.dart' hide languageOf, kMinTouchTarget;
import '../theme/meridian_theme.dart';
import '../theme/tokens.g.dart';
import '../theme/typography.dart';
import 'auth_state.dart';
import 'routes.dart';
import 'tab_scaffold.dart';

final GlobalKey<NavigatorState> _rootKey = GlobalKey<NavigatorState>(debugLabel: 'root');

/// The app router.
///
/// Five tabs under a [StatefulShellRoute], each with its own [Navigator] so a
/// tab keeps its stack when you leave and come back — the behaviour every
/// native shopper expects and the reason this is not a plain `ShellRoute`.
///
/// Detail routes live on the ROOT navigator, above the shell, so a product
/// pushed from a push notification covers the tab bar rather than appearing
/// inside whichever tab happened to be selected.
final Provider<GoRouter> routerProvider = Provider<GoRouter>((Ref ref) {
  final AuthController auth = ref.read(authControllerProvider.notifier);

  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: Routes.home,
    refreshListenable: ref.watch(routerRefreshProvider),
    debugLogDiagnostics: false,
    redirect: (BuildContext context, GoRouterState state) {
      final AuthState session = ref.read(authControllerProvider);
      final String location = state.uri.toString();

      // Until the secure store has been read we know nothing. Redirecting here
      // would bounce a signed-in user to sign-in for a frame AND discard the
      // deep link that started the app.
      if (!session.isResolved) return null;

      final bool onSignIn = state.uri.path == Routes.signIn;

      if (Routes.requiresAuth(location) && !session.isSignedIn) {
        // THE RESUME. Park the destination before sending the user away — this
        // is the only moment it is still known.
        auth.rememberDestination(location);
        return Routes.signIn;
      }

      if (onSignIn && session.isSignedIn) {
        // Coming back out of the wall: resume the parked destination if there
        // is one, otherwise land somewhere sane rather than on a dead screen.
        return auth.consumeDestination() ?? Routes.account;
      }

      // A B2B-only surface reached by a B2C account is a permissions problem,
      // not an authentication one. Sending them to sign-in would loop: they
      // are already signed in, so the redirect would fire again forever.
      if (Routes.requiresB2B(location) && session.isSignedIn && !session.isB2B) {
        return Routes.account;
      }

      return null;
    },
    routes: <RouteBase>[
      GoRoute(
        path: Routes.signIn,
        name: Routes.nSignIn,
        parentNavigatorKey: _rootKey,
        builder: (BuildContext context, GoRouterState state) => const SignInScreen(),
      ),

      // Detail routes above the shell — full-screen, tab bar covered.
      GoRoute(
        path: Routes.product,
        name: Routes.nProduct,
        parentNavigatorKey: _rootKey,
        builder: (BuildContext context, GoRouterState state) =>
            ProductDetailScreen(slug: state.pathParameters['slug']!),
      ),
      GoRoute(
        path: Routes.category,
        name: Routes.nCategory,
        parentNavigatorKey: _rootKey,
        builder: (BuildContext context, GoRouterState state) =>
            CategoryScreen(slug: state.pathParameters['slug']!),
      ),
      // ── Quote requests ────────────────────────────────────────────────
      //
      // `/rfq/new` is the app's primary action, because every product in the
      // production catalogue is quote-only. It is above the shell: asking for
      // a price is a task, and a tab bar under it is an invitation to abandon.
      GoRoute(
        path: Routes.rfqNew,
        name: Routes.nRfqNew,
        parentNavigatorKey: _rootKey,
        builder: (BuildContext context, GoRouterState state) => RequestQuoteScreen(
          subject: QuoteSubject.fromQuery(state.uri.queryParameters),
          onCreated: (String rfqId) => context.pushReplacement(Routes.rfqOf(rfqId)),
          // `/rfq/new` is deliberately open to a stranger, but POST /v1/rfqs
          // requires a session — so the form CAN be filled in and cannot be
          // sent. Parking the full location means sign-in returns to this exact
          // form with its product still named, rather than dumping the buyer on
          // the account screen having lost what they were asking about.
          onSignInRequired: () {
            auth.rememberDestination(state.uri.toString());
            context.push(Routes.signIn);
          },
        ),
      ),
      GoRoute(
        path: Routes.rfqs,
        name: Routes.nRfqs,
        parentNavigatorKey: _rootKey,
        builder: (BuildContext context, GoRouterState state) => RfqListScreen(
          onOpenRfq: (String rfqId) => context.push(Routes.rfqOf(rfqId)),
        ),
      ),
      GoRoute(
        path: Routes.rfq,
        name: Routes.nRfq,
        parentNavigatorKey: _rootKey,
        builder: (BuildContext context, GoRouterState state) =>
            RfqDetailScreen(rfqId: state.pathParameters['id']!),
      ),

      // Checkout sits above the shell too: it is a committed, linear flow and
      // the tab bar is an invitation to abandon it half-finished.
      GoRoute(
        path: Routes.checkout,
        name: Routes.nCheckout,
        parentNavigatorKey: _rootKey,
        builder: (BuildContext context, GoRouterState state) => CheckoutScreen(
          onOrderPlaced: (String orderId) => context.go(Routes.orderConfirmedOf(orderId)),
        ),
      ),
      GoRoute(
        path: Routes.orderConfirmed,
        name: Routes.nOrderConfirmed,
        parentNavigatorKey: _rootKey,
        builder: (BuildContext context, GoRouterState state) => OrderConfirmedScreen(
          orderId: state.pathParameters['id']!,
          // `go`, not `pop`: the basket behind this screen is spent. Popping
          // back into a checkout for an order that already exists is how a
          // buyer places the same order twice.
          onDone: () => context.go(Routes.orderOf(state.pathParameters['id']!)),
        ),
      ),

      GoRoute(
        path: Routes.addresses,
        name: Routes.nAddresses,
        parentNavigatorKey: _rootKey,
        builder: (BuildContext context, GoRouterState state) => const AddressesScreen(),
      ),
      GoRoute(
        path: Routes.notificationPrefs,
        name: Routes.nNotificationPrefs,
        parentNavigatorKey: _rootKey,
        builder: (BuildContext context, GoRouterState state) =>
            const NotificationPreferencesScreen(),
      ),
      GoRoute(
        path: Routes.deleteAccount,
        name: Routes.nDeleteAccount,
        parentNavigatorKey: _rootKey,
        builder: (BuildContext context, GoRouterState state) => DeleteAccountScreen(
          onDeleted: () => context.go(Routes.home),
        ),
      ),

      GoRoute(
        path: Routes.b2bApproval,
        name: Routes.nB2bApproval,
        parentNavigatorKey: _rootKey,
        builder: (BuildContext context, GoRouterState state) =>
            B2BApprovalScreen(id: state.pathParameters['id']!),
      ),

      StatefulShellRoute.indexedStack(
        builder: (
          BuildContext context,
          GoRouterState state,
          StatefulNavigationShell shell,
        ) =>
            TabScaffold(shell: shell),
        branches: <StatefulShellBranch>[
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: Routes.home,
                name: Routes.nHome,
                builder: (BuildContext context, GoRouterState state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: Routes.search,
                name: Routes.nSearch,
                builder: (BuildContext context, GoRouterState state) =>
                    SearchScreen(initialQuery: state.uri.queryParameters['q']),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: Routes.cart,
                name: Routes.nCart,
                builder: (BuildContext context, GoRouterState state) => CartScreen(
                  onCheckout: () => context.push(Routes.checkout),
                  onBrowse: () => context.go(Routes.home),
                  // A quote-only line in the basket routes to the same place
                  // the buy box does, so there is one way to ask for a price.
                  onRequestQuote: (String productId) => context.push(
                    Uri(
                      path: Routes.rfqNew,
                      queryParameters: <String, String>{'productId': productId},
                    ).toString(),
                  ),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: Routes.orders,
                name: Routes.nOrders,
                builder: (BuildContext context, GoRouterState state) => OrdersListScreen(
                  onOpenOrder: (String id) => context.push(Routes.orderOf(id)),
                ),
                routes: <RouteBase>[
                  // `/orders/:id` also resolves inside the Orders tab when it is
                  // reached by tapping a row, so the back gesture returns to the
                  // list rather than to whatever was under the shell.
                  GoRoute(
                    path: ':id',
                    name: Routes.nOrder,
                    builder: (BuildContext context, GoRouterState state) =>
                        OrderDetailScreen(orderId: state.pathParameters['id']!),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: Routes.account,
                name: Routes.nAccount,
                builder: (BuildContext context, GoRouterState state) => AccountScreen(
                  onOpenOrders: () => context.go(Routes.orders),
                  onOpenAddresses: () => context.push(Routes.addresses),
                ),
              ),
            ],
          ),
        ],
      ),
    ],
    errorBuilder: (BuildContext context, GoRouterState state) =>
        NotFoundScreen(location: state.uri.toString()),
  );
});

// ---------------------------------------------------------------------------
// Placeholder screens.
//
// Real screens land in lib/features/. These exist so the shell, the deep links
// and the goldens are exercised end to end from day one — a router with no
// destinations proves nothing.
// ---------------------------------------------------------------------------

/// Approving a purchase order from a push notification.
///
/// Still a placeholder, and deliberately so: the B2B approval journey is real
/// on the web and the deep link is kept alive here so a notification opening
/// the app lands somewhere that names the thing it was about, rather than on a
/// 404 that looks like the link was wrong. The screen behind it is a separate
/// piece of work — an approval needs the price-drift diff (`PurchaseOrder`
/// carries `approvedCommercialFingerprint` and `approvalVersion`, so an
/// approved PO whose prices moved is no longer approved), and half of that is
/// worse than none.
class B2BApprovalScreen extends StatelessWidget {
  const B2BApprovalScreen({required this.id, super.key});

  final String id;

  @override
  Widget build(BuildContext context) => _Placeholder(
        title: 'Approval',
        detail: id,
        detailKind: LtrToken.reference,
      );
}

class _Placeholder extends StatelessWidget {
  const _Placeholder({required this.title, this.detail, this.detailKind});

  final String title;
  final String? detail;
  final LtrToken? detailKind;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Padding(
          padding: EdgeInsetsDirectional.all(t.spaceBlock),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Text(title, style: type.h2, textAlign: TextAlign.center),
              if (detail != null) ...<Widget>[
                SizedBox(height: t.spaceTight),
                if (detailKind != null)
                  DirectionalText.token(
                    detail!,
                    kind: detailKind!,
                    style: type.body.copyWith(color: t.ink2),
                  )
                else
                  Text(detail!, style: type.body.copyWith(color: t.ink2)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class NotFoundScreen extends StatelessWidget {
  const NotFoundScreen({required this.location, super.key});
  final String location;
  @override
  Widget build(BuildContext context) =>
      _Placeholder(title: 'Not found', detail: location, detailKind: LtrToken.url);
}
