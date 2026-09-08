import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../api/models/enums.dart';
import 'gcc_market.dart';

/// ── ENDPOINTS THIS FILE NEEDS ───────────────────────────────────────────────
/// `PATCH /v1/me { language }`  — to mirror the language choice onto the
///                                account so the web app and the transactional
///                                emails agree with the phone. NOT BUILT: the
///                                route is in `openapi.json` and implemented
///                                nowhere, so the mirror attempt fails with
///                                `not_found` and the app says so.
///
/// The MARKET half needs nothing. `Me` has no market or currency field and the
/// contract models none, so market/currency are honestly device-local and this
/// file is their only home. Nothing here silently drops a value on the floor.
/// ────────────────────────────────────────────────────────────────────────────

/// The two settings the account hub can change that are not on the server.
@immutable
class AccountPreferences {
  const AccountPreferences({required this.market, this.languageOverride});

  final GccMarket market;

  /// NULL MEANS "FOLLOW THE DEVICE", and that is the default on a fresh
  /// install — not English.
  ///
  /// A three-state setting rather than a two-state one because the difference
  /// is real: a handset set to Arabic should open in Arabic without anybody
  /// choosing anything, and a person who deliberately picks English should keep
  /// English when they next travel and their phone changes region. Collapsing
  /// this to a non-null `Language` makes the first case impossible.
  final Language? languageOverride;

  /// The currency follows the market. There is no separate currency picker,
  /// deliberately: an AED price list shown in KWD is a price that no seller
  /// quoted and no ledger holds.
  Currency get currency => market.currency;

  /// The locale to force, or null to leave the ambient one alone.
  Locale? get localeOverride => switch (languageOverride) {
        Language.ar => const Locale('ar'),
        Language.en => const Locale('en'),
        null => null,
      };

  TextDirection? get textDirectionOverride => switch (languageOverride) {
        Language.ar => TextDirection.rtl,
        Language.en => TextDirection.ltr,
        null => null,
      };

  static const AccountPreferences fallback = AccountPreferences(
    market: GccMarket.fallback,
  );

  /// [languageOverride] is passed as a wrapped value so that clearing it back
  /// to "follow the device" is expressible — a plain nullable parameter would
  /// read a `null` as "leave it alone".
  AccountPreferences copyWith({
    GccMarket? market,
    ({Language? value})? languageOverride,
  }) =>
      AccountPreferences(
        market: market ?? this.market,
        languageOverride: languageOverride == null
            ? this.languageOverride
            : languageOverride.value,
      );

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AccountPreferences &&
          other.market == market &&
          other.languageOverride == languageOverride;

  @override
  int get hashCode => Object.hash(market, languageOverride);
}

/// Where the two device-local preferences are kept.
///
/// An interface for the same reason [TokenStore] is one: the concrete
/// implementation talks over a platform channel, and a channel does not exist
/// in a plain `flutter test` run. Tests inject [InMemoryPreferencesStore] and
/// exercise the real controller.
abstract interface class AccountPreferencesStore {
  Future<AccountPreferences> read();
  Future<void> write(AccountPreferences preferences);
}

/// The shipping implementation.
///
/// It reuses `flutter_secure_storage` — which is already a dependency —
/// rather than adding a preferences plugin, because `pubspec.yaml` is owned by
/// another engineer. A keystore is heavier than these two values need, but it
/// is the store that exists, and neither value is a secret so nothing is lost
/// by it being encrypted.
class SecureAccountPreferencesStore implements AccountPreferencesStore {
  SecureAccountPreferencesStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const String _marketKey = 'avenick.prefs.market';
  static const String _languageKey = 'avenick.prefs.language';

  @override
  Future<AccountPreferences> read() async {
    final String? market = await _storage.read(key: _marketKey);
    final String? language = await _storage.read(key: _languageKey);
    return AccountPreferences(
      market: _marketFrom(market),
      languageOverride: _languageFrom(language),
    );
  }

  @override
  Future<void> write(AccountPreferences preferences) async {
    await _storage.write(
      key: _marketKey,
      value: preferences.market.country.code,
    );
    // "Follow the device" is stored as the absence of a key, not as a magic
    // string — so a build that adds a third language cannot mistake an old
    // sentinel for a real choice.
    if (preferences.languageOverride == null) {
      await _storage.delete(key: _languageKey);
    } else {
      await _storage.write(
        key: _languageKey,
        value: preferences.languageOverride!.code,
      );
    }
  }

  static GccMarket _marketFrom(String? code) {
    for (final GccMarket m in GccMarket.values) {
      if (m.country.code == code) return m;
    }
    return GccMarket.fallback;
  }

  static Language? _languageFrom(String? code) {
    if (code == Language.ar.code) return Language.ar;
    if (code == Language.en.code) return Language.en;
    return null;
  }
}

/// A store that lives in a field. For tests and for goldens.
class InMemoryPreferencesStore implements AccountPreferencesStore {
  InMemoryPreferencesStore([this._value = AccountPreferences.fallback]);

  AccountPreferences _value;

  /// Every write, so a test can prove the choice was persisted and not merely
  /// reflected in the widget tree.
  final List<AccountPreferences> writes = <AccountPreferences>[];

  @override
  Future<AccountPreferences> read() async => _value;

  @override
  Future<void> write(AccountPreferences preferences) async {
    _value = preferences;
    writes.add(preferences);
  }
}

final Provider<AccountPreferencesStore> accountPreferencesStoreProvider =
    Provider<AccountPreferencesStore>(
  (Ref ref) => SecureAccountPreferencesStore(),
);

/// Holds the market and the language for the running app.
///
/// Async because the store is: a synchronous default followed by a late
/// correction would render the sign-in screen on `+971` and then swap it to
/// `+966` under the user's thumb.
class AccountPreferencesController extends AsyncNotifier<AccountPreferences> {
  @override
  Future<AccountPreferences> build() =>
      ref.watch(accountPreferencesStoreProvider).read();

  AccountPreferences get current => state.value ?? AccountPreferences.fallback;

  Future<void> setMarket(GccMarket market) =>
      _apply(current.copyWith(market: market));

  /// [language] null puts the app back to following the device.
  Future<void> setLanguage(Language? language) => _apply(
        current.copyWith(languageOverride: (value: language)),
      );

  Future<void> _apply(AccountPreferences next) async {
    // Optimistic, and honestly so: this value has no server to disagree with
    // it, so there is nothing to roll back to.
    state = AsyncValue<AccountPreferences>.data(next);
    await ref.read(accountPreferencesStoreProvider).write(next);
  }
}

final AsyncNotifierProvider<AccountPreferencesController, AccountPreferences>
    accountPreferencesProvider =
    AsyncNotifierProvider<AccountPreferencesController, AccountPreferences>(
  AccountPreferencesController.new,
);

/// The resolved preferences, with the fallback while the store is being read.
///
/// Screens read this rather than the async provider so they never have to
/// render a fourth state for "we have not read a two-field keystore yet".
final Provider<AccountPreferences> resolvedPreferencesProvider =
    Provider<AccountPreferences>(
  (Ref ref) =>
      ref.watch(accountPreferencesProvider).value ??
      AccountPreferences.fallback,
);
