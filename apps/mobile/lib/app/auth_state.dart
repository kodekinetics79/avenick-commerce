import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Where the user stands with the API.
enum AuthStatus {
  /// The token store has not been read yet. The router must not redirect on
  /// this state — doing so bounces a signed-in user to the sign-in screen for
  /// one frame on every cold start, and, worse, throws away the deep link that
  /// launched the app.
  unknown,

  signedOut,
  signedIn,
}

@immutable
class AuthState {
  const AuthState({
    this.status = AuthStatus.unknown,
    this.isB2B = false,
  });

  final AuthStatus status;

  /// B2B accounts see the approvals surface. A B2C account deep-linked into
  /// `/b2b/approvals/:id` is a 403, not a sign-in prompt.
  final bool isB2B;

  bool get isSignedIn => status == AuthStatus.signedIn;
  bool get isResolved => status != AuthStatus.unknown;

  AuthState copyWith({AuthStatus? status, bool? isB2B}) =>
      AuthState(status: status ?? this.status, isB2B: isB2B ?? this.isB2B);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AuthState && other.status == status && other.isB2B == isB2B;

  @override
  int get hashCode => Object.hash(status, isB2B);
}

/// Owns the session.
///
/// The networking engineer replaces the bodies here with real calls against
/// `flutter_secure_storage` and the API; the *shape* — and in particular
/// [AuthStatus.unknown] and [pendingDestination] — is what the router depends
/// on and should not change.
class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() => const AuthState();

  /// The route the user was trying to reach when they hit the auth wall.
  ///
  /// Held here rather than in a query parameter because it must survive the
  /// whole sign-in flow — which may include an OTP screen, a webview, or an
  /// app switch to a password manager — and a query parameter does not survive
  /// any of those. It is cleared exactly once, on consumption.
  String? _pendingDestination;

  String? get pendingDestination => _pendingDestination;

  /// Remember where the user was headed. First one wins: if an unauthenticated
  /// deep link lands on `/orders/123` and the redirect chain then also touches
  /// `/account`, the target is still `/orders/123`.
  void rememberDestination(String location) {
    _pendingDestination ??= location;
  }

  /// Take the remembered destination and forget it. Single-use — otherwise the
  /// next sign-out/sign-in cycle silently resumes a months-old link.
  String? consumeDestination() {
    final String? d = _pendingDestination;
    _pendingDestination = null;
    return d;
  }

  /// Called once at startup after the secure store has been read.
  void resolve({required bool signedIn, bool isB2B = false}) {
    state = AuthState(
      status: signedIn ? AuthStatus.signedIn : AuthStatus.signedOut,
      isB2B: isB2B,
    );
  }

  void signIn({bool isB2B = false}) {
    state = AuthState(status: AuthStatus.signedIn, isB2B: isB2B);
  }

  void signOut() {
    _pendingDestination = null;
    state = const AuthState(status: AuthStatus.signedOut);
  }
}

final NotifierProvider<AuthController, AuthState> authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);

/// Bridges Riverpod to `go_router`'s [Listenable]-based `refreshListenable`.
///
/// Without this the router evaluates its redirect once and never again, so
/// signing in leaves the user staring at the sign-in screen.
class RouterRefresh extends ChangeNotifier {
  RouterRefresh(this._ref) {
    _ref.listen<AuthState>(
      authControllerProvider,
      (AuthState? _, AuthState __) => notifyListeners(),
    );
  }

  final Ref _ref;
}

final Provider<RouterRefresh> routerRefreshProvider = Provider<RouterRefresh>((Ref ref) {
  final RouterRefresh refresh = RouterRefresh(ref);
  ref.onDispose(refresh.dispose);
  return refresh;
});
