import 'package:freezed_annotation/freezed_annotation.dart';

import 'converters.dart';
import 'enums.dart';

part 'auth.freezed.dart';
part 'auth.g.dart';

/// The identity a token was minted for. A trimmed [Me] — enough to render a
/// header without a second round trip, and no more.
@freezed
abstract class AuthPrincipal with _$AuthPrincipal {
  const AuthPrincipal._();

  const factory AuthPrincipal({
    required String id,
    required String email,
    required String firstName,
    required String lastName,
    required UserRole role,
    required Language language,
  }) = _AuthPrincipal;

  factory AuthPrincipal.fromJson(Map<String, dynamic> json) =>
      _$AuthPrincipalFromJson(json);

  String get displayName => '$firstName $lastName'.trim();
}

/// What `/v1/auth/token`, `/refresh` and `/otp/verify` answer with.
///
/// [accessToken] is held in memory only; [refreshToken] is the ONLY value that
/// reaches disk, and it goes to the platform keystore. See
/// `lib/core/storage/secure_token_store.dart`.
@freezed
abstract class TokenPair with _$TokenPair {
  const TokenPair._();

  const factory TokenPair({
    required TokenType tokenType,
    required String accessToken,

    /// Access-token lifetime in seconds, from the moment the server issued it.
    required int expiresIn,
    required String refreshToken,
    required int refreshExpiresIn,
    required AuthPrincipal principal,
  }) = _TokenPair;

  factory TokenPair.fromJson(Map<String, dynamic> json) =>
      _$TokenPairFromJson(json);

  Duration get accessLifetime => Duration(seconds: expiresIn);
  Duration get refreshLifetime => Duration(seconds: refreshExpiresIn);

  /// A [toString] that cannot leak either token into a log line or a crash
  /// report. The default freezed one prints every field.
  @override
  String toString() =>
      'TokenPair(tokenType: ${tokenType.header}, accessToken: <redacted>, '
      'expiresIn: $expiresIn, refreshToken: <redacted>, '
      'refreshExpiresIn: $refreshExpiresIn, principal: ${principal.id})';
}

/// The answer to `/v1/auth/otp/request`: what the app must ask the user for,
/// and when it may offer "resend".
@freezed
abstract class OtpChallenge with _$OtpChallenge {
  const OtpChallenge._();

  const factory OtpChallenge({
    required String challengeId,

    /// How many digits the input should accept — 4 to 8. Not hardcoded in the
    /// UI: the server decides, and a fixed six-box input would break the day
    /// it changes.
    required int codeLength,
    @UtcDateTimeConverter() required DateTime expiresAt,

    /// The earliest instant a resend will be accepted. Drive the countdown
    /// from this, not from a local timer started at send time.
    @UtcDateTimeConverter() required DateTime resendAfter,
  }) = _OtpChallenge;

  factory OtpChallenge.fromJson(Map<String, dynamic> json) =>
      _$OtpChallengeFromJson(json);

  Duration timeToResend(DateTime now) {
    final remaining = resendAfter.difference(now.toUtc());
    return remaining.isNegative ? Duration.zero : remaining;
  }

  bool isExpired(DateTime now) => !now.toUtc().isBefore(expiresAt);
}

/// How many sessions `/v1/auth/revoke` actually ended.
@freezed
abstract class Revocation with _$Revocation {
  const factory Revocation({required int revokedCount}) = _Revocation;

  factory Revocation.fromJson(Map<String, dynamic> json) =>
      _$RevocationFromJson(json);
}
