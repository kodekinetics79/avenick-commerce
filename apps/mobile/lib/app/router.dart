import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/l10n/directional_text.dart';
import '../core/ui/key_button.dart';
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
            ProductScreen(slug: state.pathParameters['slug']!),
      ),
      GoRoute(
        path: Routes.category,
        name: Routes.nCategory,
        parentNavigatorKey: _rootKey,
        builder: (BuildContext context, GoRouterState state) =>
            CategoryScreen(slug: state.pathParameters['slug']!),
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
                    SearchScreen(query: state.uri.queryParameters['q']),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: Routes.cart,
                name: Routes.nCart,
                builder: (BuildContext context, GoRouterState state) => const CartScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: Routes.orders,
                name: Routes.nOrders,
                builder: (BuildContext context, GoRouterState state) => const OrdersScreen(),
                routes: <RouteBase>[
                  // `/orders/:id` also resolves inside the Orders tab when it is
                  // reached by tapping a row, so the back gesture returns to the
                  // list rather than to whatever was under the shell.
                  GoRoute(
                    path: ':id',
                    name: Routes.nOrder,
                    builder: (BuildContext context, GoRouterState state) =>
                        OrderScreen(id: state.pathParameters['id']!),
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
                builder: (BuildContext context, GoRouterState state) => const AccountScreen(),
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

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});
  @override
  Widget build(BuildContext context) => const _Placeholder(title: 'Home');
}

class SearchScreen extends StatelessWidget {
  const SearchScreen({this.query, super.key});
  final String? query;
  @override
  Widget build(BuildContext context) => _Placeholder(title: 'Search', detail: query);
}

class CartScreen extends StatelessWidget {
  const CartScreen({super.key});
  @override
  Widget build(BuildContext context) => const _Placeholder(title: 'Cart');
}

class OrdersScreen extends StatelessWidget {
  const OrdersScreen({super.key});
  @override
  Widget build(BuildContext context) => const _Placeholder(title: 'Orders');
}

class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});
  @override
  Widget build(BuildContext context) => const _Placeholder(title: 'Account');
}

class ProductScreen extends StatelessWidget {
  const ProductScreen({required this.slug, super.key});
  final String slug;
  @override
  Widget build(BuildContext context) =>
      _Placeholder(title: 'Product', detail: slug, detailKind: LtrToken.sku);
}

class CategoryScreen extends StatelessWidget {
  const CategoryScreen({required this.slug, super.key});
  final String slug;
  @override
  Widget build(BuildContext context) => _Placeholder(title: 'Category', detail: slug);
}

class OrderScreen extends StatelessWidget {
  const OrderScreen({required this.id, super.key});
  final String id;
  @override
  Widget build(BuildContext context) =>
      _Placeholder(title: 'Order', detail: id, detailKind: LtrToken.orderId);
}

class B2BApprovalScreen extends StatelessWidget {
  const B2BApprovalScreen({required this.id, super.key});
  final String id;
  @override
  Widget build(BuildContext context) =>
      _Placeholder(title: 'Approval', detail: id, detailKind: LtrToken.purchaseOrder);
}

class NotFoundScreen extends StatelessWidget {
  const NotFoundScreen({required this.location, super.key});
  final String location;
  @override
  Widget build(BuildContext context) =>
      _Placeholder(title: 'Not found', detail: location, detailKind: LtrToken.url);
}

/// The auth wall.
///
/// Signing in here does not navigate: it flips the session, `refreshListenable`
/// fires, and the redirect consumes the parked destination. The screen never
/// needs to know where the user was going, which is what keeps the resume
/// working for links that arrive from outside the app.
class SignInScreen extends ConsumerWidget {
  const SignInScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final String? pending = ref.read(authControllerProvider.notifier).pendingDestination;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: EdgeInsetsDirectional.all(t.spaceBlock),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Text('Sign in', style: type.h1, textAlign: TextAlign.center),
                if (pending != null) ...<Widget>[
                  SizedBox(height: t.spaceTight),
                  Text(
                    'You will be taken back to where you were.',
                    style: type.meta.copyWith(color: t.ink3),
                    textAlign: TextAlign.center,
                  ),
                ],
                SizedBox(height: t.spaceBlock),
                KeyButton(
                  label: 'Continue',
                  size: KeyButtonSize.large,
                  expand: true,
                  onPressed: () => ref.read(authControllerProvider.notifier).signIn(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
