import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../api/avenick_api.dart';
import '../../../api/models/account.dart';
import '../../../api/models/auth.dart';
import '../../../api/models/enums.dart';
import '../../../api/models/requests.dart';
import '../../../app/auth_state.dart' as router_auth;
import '../../../core/error/failures.dart';
import 'account_preferences.dart';
import 'account_providers.dart';
import 'gcc_market.dart';

/// ── ENDPOINTS THIS FILE NEEDS ───────────────────────────────────────────────
/// `POST   /v1/auth/otp/request`  — send the SMS code.
/// `POST   /v1/auth/otp/verify`   — code for a token pair.
/// `POST   /v1/auth/token`        — email + password for a token pair.
/// `POST   /v1/auth/revoke`       — end the session server-side on sign-out.
/// `DELETE /v1/account`           — the App Store deletion gate.
///
/// NONE OF THEM EXIST. They are specified in `packages/contracts/openapi.json`
/// and implemented nowhere: there is no refresh-token table to mint against, no
/// OTP model, no SMS provider, and `/api/v1` reads a NextAuth cookie rather
/// than an `Authorization: Bearer` header. Every call below therefore returns
/// `ServerFailure(code: not_found)` today.
///
/// That failure is CARRIED, not swallowed. There is deliberately no local
/// fake-login path in this file: a stubbed sign-in that flips the router into
/// a signed-in state would make every screen behind the auth wall look
/// finished while every authenticated request behind it 404s.
/// ────────────────────────────────────────────────────────────────────────────

/// What came back from a successful OTP verification.
///
/// Two outcomes, and the second one is the whole reason this is a sealed type
/// rather than a `TokenPair`: a verified phone can belong to an account that is
/// NOT the account already signed in on this handset, and the app must stop and
/// ask rather than quietly swapping one identity for another.
@immutable
sealed class SignInOutcome {
  const SignInOutcome();
}

/// The pair was adopted; the session is live.
class SignedInOutcome extends SignInOutcome {
  const SignedInOutcome(this.principal);
  final AuthPrincipal principal;
}

/// The credential verified, but it belongs to a DIFFERENT account from the one
/// already signed in on this device.
///
/// [incoming] has NOT been adopted. Nothing has changed yet, and nothing will
/// until a human chooses — see `RegisterScreen`.
class AccountLinkRequired extends SignInOutcome {
  const AccountLinkRequired({required this.existing, required this.incoming});

  /// Who is signed in on this handset right now.
  final AuthPrincipal existing;

  /// The pair minted for the phone that was just verified. Held, not stored:
  /// it never reaches the keystore unless it is adopted.
  final TokenPair incoming;
}

/// A sign-out that could not be told to the server.
///
/// The device is signed out either way — refusing to clear a local session
/// because a network call failed is how a shared handset keeps someone else
/// signed in. But the caller is told, because "signed out everywhere" is a
/// claim the app has not earned when `/revoke` never landed.
@immutable
class SignOutResult {
  const SignOutResult({required this.serverNotified, this.failure});

  final bool serverNotified;
  final ApiFailure? failure;
}

/// Every write the identity screens make. One place, so a screen never touches
/// `AuthSession` or `Dio` directly.
class AuthActions {
  const AuthActions(this._ref);

  final Ref _ref;

  AvenickApi get _api => _ref.read(avenickApiProvider);

  /// `POST /v1/auth/otp/request`.
  ///
  /// Throws [ApiFailure]. Today that is always `not_found`.
  Future<OtpChallenge> requestOtp(PhoneNumber phone) async {
    final AvenickApi api = _api;
    final String deviceId = await api.session.deviceId();
    return api.auth.requestOtp(
      OtpRequest(
        phone: phone.e164,
        deviceId: deviceId,
        // The SMS is written in the language the app has been told to use.
        // Null — "follow the device" — OMITS the field rather than guessing:
        // `language` is optional in the contract, and the server knows the
        // account's own language better than a handset locale does.
        language: _ref.read(resolvedPreferencesProvider).languageOverride,
      ),
    );
  }

  /// `POST /v1/auth/otp/verify`.
  ///
  /// The pair is adopted here ONLY when it belongs to the identity already on
  /// this device, or when there is no identity on it. Otherwise it comes back
  /// inside [AccountLinkRequired], unadopted, and the keystore is untouched.
  Future<SignInOutcome> verifyOtp({
    required String challengeId,
    required String code,
  }) async {
    final AvenickApi api = _api;
    final String deviceId = await api.session.deviceId();
    final AuthPrincipal? existing = api.session.principal;

    final TokenPair pair = await api.auth.verifyOtp(
      OtpVerifyRequest(
        challengeId: challengeId,
        code: code,
        deviceId: deviceId,
      ),
    );

    if (existing != null && existing.id != pair.principal.id) {
      return AccountLinkRequired(existing: existing, incoming: pair);
    }
    await _adopt(pair);
    return SignedInOutcome(pair.principal);
  }

  /// `POST /v1/auth/token` — the secondary path.
  Future<SignInOutcome> signInWithPassword({
    required String email,
    required String password,
  }) async {
    final AvenickApi api = _api;
    final String deviceId = await api.session.deviceId();
    final AuthPrincipal? existing = api.session.principal;

    final TokenPair pair = await api.auth.signIn(
      PasswordGrantRequest(
        email: email,
        password: password,
        deviceId: deviceId,
      ),
    );

    if (existing != null && existing.id != pair.principal.id) {
      return AccountLinkRequired(existing: existing, incoming: pair);
    }
    await _adopt(pair);
    return SignedInOutcome(pair.principal);
  }

  /// Take the account-linking choice: adopt the incoming pair, dropping the
  /// identity that was on the device.
  ///
  /// This is a SWITCH, not a merge. Nothing is combined, no orders move, and
  /// the abandoned session is revoked server-side so it does not linger.
  Future<SignedInOutcome> adoptIncoming(TokenPair incoming) async {
    await _revokeQuietly(allSessions: false);
    await _adopt(incoming);
    return SignedInOutcome(incoming.principal);
  }

  /// Take the other choice: keep the identity already on the device and throw
  /// the freshly minted pair away.
  ///
  /// The incoming refresh token never reached the keystore, so there is
  /// nothing local to clean up — but a live refresh token exists server-side
  /// and is revoked here rather than left to expire.
  Future<void> discardIncoming(TokenPair incoming) async {
    try {
      await _api.auth.revoke(
        RevokeRequest(refreshToken: incoming.refreshToken),
      );
    } on ApiFailure {
      // Best effort. The token was never written anywhere on this device, so
      // failing to revoke it leaves a server-side session to expire on its
      // own — not a local credential to leak.
    }
  }

  /// Sign out. Tells the server first, clears the device regardless.
  Future<SignOutResult> signOut({bool allSessions = false}) async {
    final ApiFailure? failure = await _revokeQuietly(allSessions: allSessions);
    await _api.session.signOut();
    _ref.read(router_auth.authControllerProvider.notifier).signOut();
    _ref.invalidate(meProvider);
    _ref.invalidate(addressesProvider);
    return SignOutResult(serverNotified: failure == null, failure: failure);
  }

  /// `DELETE /v1/account` — schedules an erasure; it does not perform one.
  ///
  /// The returned [AccountDeletion.erasesAt] is the date the app MUST show.
  /// Saying "your account has been deleted" while a grace period is running is
  /// a false statement about a data-protection right.
  Future<AccountDeletion> deleteAccount({
    required String confirmEmail,
    String? reason,
  }) =>
      _api.account.deleteAccount(
        DeleteAccountRequest(confirmEmail: confirmEmail, reason: reason),
      );

  /// Local teardown after a scheduled deletion is confirmed.
  ///
  /// Deliberately separate from [deleteAccount]: the session is only torn down
  /// once the SERVER has acknowledged the schedule. Clearing first and calling
  /// second would leave an account alive with no way back into it.
  Future<void> forgetDeviceAfterDeletion() async {
    await _api.session.signOut();
    _ref.read(router_auth.authControllerProvider.notifier).signOut();
    _ref.invalidate(meProvider);
    _ref.invalidate(addressesProvider);
  }

  Future<void> _adopt(TokenPair pair) async {
    await _api.session.adopt(pair);
    // Flip the router's own view of the session. `AuthController` is what
    // `refreshListenable` watches; without this the redirect never re-runs and
    // the user stays on the sign-in screen holding a valid token.
    _ref.read(router_auth.authControllerProvider.notifier).signIn(
          isB2B: _isB2bRole(pair.principal.role),
        );
    _ref.invalidate(meProvider);
    _ref.invalidate(addressesProvider);
  }

  Future<ApiFailure?> _revokeQuietly({required bool allSessions}) async {
    try {
      await _api.auth.revoke(RevokeRequest(allSessions: allSessions));
      return null;
    } on ApiFailure catch (failure) {
      return failure;
    }
  }

  static bool _isB2bRole(UserRole role) =>
      role == UserRole.companyAdmin ||
      role == UserRole.companyBuyer ||
      role == UserRole.companyApprover;
}

final Provider<AuthActions> authActionsProvider =
    Provider<AuthActions>(AuthActions.new);
