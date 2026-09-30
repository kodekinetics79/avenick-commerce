import 'dart:async';
import 'dart:math';

import '../../api/models/auth.dart';
import '../../api/models/enums.dart';
import '../error/failures.dart';
import 'secure_token_store.dart';

/// ═══════════════════════════════════════════════════════════════════════════
/// THE BACKEND ENDPOINTS THIS FILE TALKS TO DO NOT EXIST YET.
///
/// `/v1/auth/token`, `/refresh`, `/revoke`, `/otp/request` and `/otp/verify`
/// are described in `packages/contracts/openapi.json` and implemented nowhere.
/// As of this commit:
///
///   * there is NO refresh-token table — nothing to persist a refresh token
///     against, and nothing to revoke;
///   * there is NO OTP model — no challenge row, no code, no SMS provider
///     wired up;
///   * `/api/v1` is COOKIE-authenticated today, via the existing NextAuth
///     session. It does not read an `Authorization: Bearer` header at all.
///
/// So this layer is written against the contract, not against a running
/// server, and every call in it will fail with `not_found` until the backend
/// lands. It exists now so that the day those endpoints ship the app is a
/// wiring change and not a rewrite — and it is documented this loudly so that
/// nobody reads a green `flutter analyze` as evidence that sign-in works.
///
/// WHAT THIS MEANS FOR ANYONE BUILDING A SCREEN TODAY: authenticated calls
/// will 401. Build against the catalogue endpoints, which are public, and keep
/// the sign-in screen behind whatever flag the app uses for unfinished work.
/// ═══════════════════════════════════════════════════════════════════════════

/// What the session is, right now.
sealed class AuthStatus {
  const AuthStatus();
}

/// No credential, and none recoverable.
class SignedOut extends AuthStatus {
  const SignedOut({this.reason});

  /// Why, when the app did not choose it — a refresh that the server refused,
  /// a revoked device. Null after a deliberate sign-out.
  final ApiFailure? reason;

  @override
  String toString() => 'SignedOut(reason: $reason)';
}

/// A refresh token is on disk but no access token has been minted this
/// process. The first authenticated call will refresh.
class SignedInPendingRefresh extends AuthStatus {
  const SignedInPendingRefresh();

  @override
  String toString() => 'SignedInPendingRefresh()';
}

class SignedIn extends AuthStatus {
  const SignedIn(this.principal);
  final AuthPrincipal principal;

  @override
  String toString() => 'SignedIn(${principal.id})';
}

/// What [AuthSession] needs from the auth endpoints. An interface rather than
/// a direct dependency on `AuthApi`, because the Dio instance that carries
/// authenticated traffic depends on this session — taking the concrete client
/// here would close that loop.
abstract interface class TokenRefresher {
  Future<TokenPair> refresh({
    required String refreshToken,
    required String deviceId,
  });
}

/// Holds the access token in memory, the refresh token in the keystore, and
/// guarantees that ten simultaneous 401s cause exactly ONE refresh.
///
/// SINGLE FLIGHT, and why it is not optional. A cold app start fires the
/// catalogue, the cart, `/me` and the address book at once. If the access
/// token has expired, every one of those gets a 401 within a few milliseconds
/// of the others. Refreshing per-401 means N refreshes racing; whichever
/// finishes last wins, the rest of the rotated tokens are stale the instant
/// they are minted, and if the server rotates refresh tokens on use (as it
/// should) then N-1 of those calls present an already-consumed token and the
/// user is signed out in the middle of a working session.
///
/// So [refresh] keeps ONE in-flight future and hands the same one to every
/// caller. It is a plain field rather than a lock because Dart is
/// single-threaded per isolate: between the null check and the assignment
/// there is no suspension point, so no second caller can interleave.
class AuthSession {
  AuthSession({
    required TokenStore store,
    required TokenRefresher refresher,
    DateTime Function() clock = DateTime.now,
  })  : _store = store,
        _refresher = refresher,
        _clock = clock;

  final TokenStore _store;
  final TokenRefresher _refresher;
  final DateTime Function() _clock;

  final StreamController<AuthStatus> _statusController =
      StreamController<AuthStatus>.broadcast();

  /// Emits on every transition. The app listens here to bounce to sign-in;
  /// nothing else is allowed to decide that.
  Stream<AuthStatus> get statusChanges => _statusController.stream;

  AuthStatus _status = const SignedOut();
  AuthStatus get status => _status;

  String? _accessToken;
  DateTime? _accessTokenExpiry;
  AuthPrincipal? _principal;

  Future<TokenPair>? _inFlightRefresh;

  /// The token to put on the next request, or null if there is none in memory.
  /// Deliberately NOT a future: the interceptor must be able to ask "do I have
  /// one right now" without awaiting and losing its place in the queue.
  String? get accessToken => _accessToken;

  AuthPrincipal? get principal => _principal;

  /// Treat a token as expired slightly early, so a request does not leave the
  /// device with a token that expires while it is in the air.
  static const Duration expiryGrace = Duration(seconds: 30);

  bool get hasUsableAccessToken {
    final token = _accessToken;
    final expiry = _accessTokenExpiry;
    if (token == null || expiry == null) return false;
    return _clock().toUtc().add(expiryGrace).isBefore(expiry);
  }

  /// Read the keystore at startup. Does NOT refresh: the first authenticated
  /// call will, and refreshing eagerly on launch spends a round trip that a
  /// browsing-only session never needed.
  Future<AuthStatus> restore() async {
    final refreshToken = await _store.readRefreshToken();
    _emit(
      refreshToken == null ? const SignedOut() : const SignedInPendingRefresh(),
    );
    return _status;
  }

  /// Adopt a freshly minted pair — from sign-in, OTP verification, or a
  /// refresh. The refresh token is the only half that touches disk.
  Future<void> adopt(TokenPair pair) async {
    _accessToken = pair.accessToken;
    _accessTokenExpiry = _clock().toUtc().add(pair.accessLifetime);
    _principal = pair.principal;
    await _store.writeRefreshToken(pair.refreshToken);
    _emit(SignedIn(pair.principal));
  }

  /// The device id every auth endpoint requires, minted once per install.
  Future<String> deviceId() async {
    final existing = await _store.readDeviceId();
    if (existing != null && existing.isNotEmpty) return existing;
    final minted = _mintDeviceId();
    await _store.writeDeviceId(minted);
    return minted;
  }

  /// Refresh, once, however many callers ask at once.
  ///
  /// Every caller awaits the SAME future. The in-flight field is cleared in a
  /// `whenComplete` so a later 401 can start a new one, and it is cleared
  /// whether the refresh succeeded or failed — a stuck non-null future here
  /// would wedge every authenticated request in the app forever.
  Future<TokenPair> refresh() {
    final existing = _inFlightRefresh;
    if (existing != null) return existing;

    final started = _performRefresh();
    _inFlightRefresh = started;
    return started.whenComplete(() {
      if (identical(_inFlightRefresh, started)) _inFlightRefresh = null;
    });
  }

  Future<TokenPair> _performRefresh() async {
    final refreshToken = await _store.readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      const failure = ApiFailure.auth(
        code: ApiErrorCode.unauthenticated,
        message: 'Sign in to continue.',
        requiresReauth: true,
      );
      await _forceSignOut(failure);
      throw failure;
    }

    final device = await deviceId();
    try {
      final pair = await _refresher.refresh(
        refreshToken: refreshToken,
        deviceId: device,
      );
      await adopt(pair);
      return pair;
    } on ApiFailure catch (failure) {
      // The session is cleared ONLY when the server explicitly refused the
      // credential. That is the one case where retrying with the same refresh
      // token cannot work: it is expired, revoked, or was already consumed by
      // a rotation.
      //
      // Everything else leaves the session intact and simply propagates:
      //
      //  * a NetworkFailure — an aeroplane is not a revoked session, and
      //    clearing here turns a tunnel into a forced re-login;
      //  * a 5xx or `upstream_unavailable` — the auth service is having a bad
      //    minute, which is not a statement about this user's token;
      //  * an UnexpectedFailure — a proxy's HTML error page, or (today) a
      //    `not_found` because the refresh endpoint DOES NOT EXIST YET. Signing
      //    every user out because an endpoint has not shipped would be a
      //    spectacular way to discover that.
      //
      // The caller still sees the failure; it just does not lose its session
      // over an outage.
      if (failure is AuthFailure) {
        await _forceSignOut(failure);
      }
      rethrow;
    }
  }

  /// Deliberate sign-out. The caller is expected to have told the server via
  /// `/v1/auth/revoke` first; this only clears the device.
  Future<void> signOut() async {
    _clearMemory();
    await _store.clearSession();
    _emit(const SignedOut());
  }

  Future<void> _forceSignOut(ApiFailure reason) async {
    _clearMemory();
    await _store.clearSession();
    _emit(SignedOut(reason: reason));
  }

  /// Drop the in-memory access token without touching the refresh token, so
  /// the next call re-authenticates. Used by tests and by a "something is
  /// wrong, try once more" path.
  void invalidateAccessToken() {
    _accessToken = null;
    _accessTokenExpiry = null;
  }

  void _clearMemory() {
    _accessToken = null;
    _accessTokenExpiry = null;
    _principal = null;
  }

  void _emit(AuthStatus status) {
    _status = status;
    if (!_statusController.isClosed) _statusController.add(status);
  }

  Future<void> dispose() => _statusController.close();

  static final Random _random = Random.secure();

  static String _mintDeviceId() {
    final buffer = StringBuffer();
    for (var i = 0; i < 16; i++) {
      buffer.write(_random.nextInt(256).toRadixString(16).padLeft(2, '0'));
    }
    return buffer.toString();
  }
}
