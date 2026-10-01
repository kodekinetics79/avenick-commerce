import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// What a session needs from storage.
///
/// An interface rather than a concrete class so the auth stack can be unit
/// tested without a Keychain: `flutter_secure_storage` talks over a platform
/// channel, and a channel is not available in a plain `flutter test` run
/// without mocking it. A test supplies an in-memory implementation of these
/// six methods and exercises the real [AuthSession] and the real interceptor.
abstract interface class TokenStore {
  /// The refresh token, or null if there is no session.
  Future<String?> readRefreshToken();

  Future<void> writeRefreshToken(String token);

  /// The stable per-installation id every auth endpoint requires.
  Future<String?> readDeviceId();

  Future<void> writeDeviceId(String deviceId);

  /// Erase the session but keep the device id.
  Future<void> clearSession();

  /// Erase everything, device id included.
  Future<void> clearAll();
}

/// Where the refresh token lives, and the ONLY thing about a session that
/// reaches disk.
///
/// ─────────────────────────────────────────────────────────────────────────
/// THE ACCESS TOKEN IS NEVER WRITTEN HERE. It stays in memory in
/// [AuthSession] and dies with the process.
///
/// That is not belt-and-braces. An access token is a bearer credential with a
/// short life and no revocation list in front of it; a refresh token is one
/// the server can revoke the moment a device is reported lost. Persisting the
/// access token buys a few minutes of not calling `/refresh` on a cold start
/// and costs a credential sitting on disk that nothing can call back. The
/// trade is not close.
/// ─────────────────────────────────────────────────────────────────────────
///
/// `flutter_secure_storage` is the Keychain on iOS and the Keystore-backed
/// `EncryptedSharedPreferences` on Android. Both options below are set
/// deliberately:
///
///  * `first_unlock_this_device` — readable after the first unlock following a
///    boot, and NOT synced to iCloud or migrated to a new handset. A refresh
///    token restored onto a different device from a backup is a session on a
///    device the server never issued one to.
///  * `encryptedSharedPreferences: true` — Android's plain SharedPreferences
///    is world-readable to anything with root or a backup extraction.
class SecureTokenStore implements TokenStore {
  SecureTokenStore({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              iOptions: IOSOptions(
                accessibility: KeychainAccessibility.first_unlock_this_device,
                synchronizable: false,
              ),
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  final FlutterSecureStorage _storage;

  static const String _refreshTokenKey = 'avenick.auth.refresh_token';
  static const String _deviceIdKey = 'avenick.auth.device_id';

  @override
  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);

  @override
  Future<void> writeRefreshToken(String token) =>
      _storage.write(key: _refreshTokenKey, value: token);

  /// The stable per-installation id every auth endpoint requires.
  ///
  /// It is NOT the vendor/advertising id: those are resettable and shared
  /// across apps. This is minted once per install and kept beside the token,
  /// so a revoked session and the device it belonged to stay associated.
  @override
  Future<String?> readDeviceId() => _storage.read(key: _deviceIdKey);

  @override
  Future<void> writeDeviceId(String deviceId) =>
      _storage.write(key: _deviceIdKey, value: deviceId);

  /// Erase the session. Called on sign-out and on a failed refresh.
  ///
  /// The device id deliberately SURVIVES: it is not a credential, and keeping
  /// it means the next sign-in on this handset is recognisably the same
  /// device rather than a new one for every sign-out.
  @override
  Future<void> clearSession() => _storage.delete(key: _refreshTokenKey);

  /// Erase everything, device id included. For an uninstall-equivalent reset
  /// and for `DELETE /v1/account`.
  @override
  Future<void> clearAll() async {
    await _storage.delete(key: _refreshTokenKey);
    await _storage.delete(key: _deviceIdKey);
  }
}
