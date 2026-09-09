import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../api/avenick_api.dart';
import '../../../api/models/account.dart';
import '../../../api/models/requests.dart';
import '../../../core/network/api_config.dart';

/// ── ENDPOINTS THIS FILE NEEDS ───────────────────────────────────────────────
/// `GET    /v1/me`          — the identity every account surface renders.
/// `PATCH  /v1/me`          — language mirror, profile edits.
/// `GET    /v1/addresses`   — the address book.
/// `DELETE /v1/account`     — the App Store deletion gate.
///
/// ALL FOUR ARE SPECIFIED AND NONE ARE BUILT. `/api/v1` today authenticates
/// from a NextAuth cookie and the only route implemented under `app/api/v1/`
/// is `checkout/`, so every provider here resolves to a `ServerFailure` with
/// `code: not_found`. That is not a bug to be hidden behind a spinner: the
/// screens render it, with the `requestId`, as the truthful error state.
/// ────────────────────────────────────────────────────────────────────────────

/// The assembled API stack, one per app.
///
/// Overridden wholesale in tests with a client built on a fake adapter, which
/// is what lets the account widget tests exercise the REAL interceptor chain
/// and the REAL failure mapper rather than a hand-rolled stub of both.
final Provider<AvenickApi> avenickApiProvider = Provider<AvenickApi>((Ref ref) {
  final AvenickApi api = AvenickApi.build(config: ApiConfig.fromEnvironment());
  ref.onDispose(api.dispose);
  return api;
});

/// `GET /v1/me`.
final FutureProvider<Me> meProvider = FutureProvider<Me>(
  (Ref ref) => ref.watch(avenickApiProvider).account.me(),
);

/// `GET /v1/addresses` — the whole book, unpaginated.
final FutureProvider<List<Address>> addressesProvider =
    FutureProvider<List<Address>>(
  (Ref ref) => ref.watch(avenickApiProvider).account.addresses(),
);

/// One address by id, served out of the book rather than by a second round
/// trip. `GET /v1/addresses/{id}` exists and is used only when the book has
/// not been loaded — deep-linking straight into an edit screen.
///
/// The type is inferred rather than written out: `FutureProviderFamily` is not
/// re-exported from `flutter_riverpod`'s barrel in 3.x, and reaching into
/// `package:riverpod/src/…` to name it would be worse than leaving it implicit.
final addressProvider = FutureProvider.family<Address, String>((
  Ref ref,
  String id,
) async {
  final List<Address>? book = ref.watch(addressesProvider).value;
  if (book != null) {
    for (final Address a in book) {
      if (a.id == id) return a;
    }
  }
  return ref.watch(avenickApiProvider).account.address(id);
});

/// Writes to the address book, each of which invalidates [addressesProvider]
/// so every surface showing the book agrees straight away.
class AddressBook {
  const AddressBook(this._ref);

  final Ref _ref;

  Future<Address> create(CreateAddressRequest request) async {
    final Address created =
        await _ref.read(avenickApiProvider).account.createAddress(request);
    _ref.invalidate(addressesProvider);
    return created;
  }

  Future<Address> update(String id, UpdateAddressRequest request) async {
    final Address updated =
        await _ref.read(avenickApiProvider).account.updateAddress(id, request);
    _ref.invalidate(addressesProvider);
    return updated;
  }

  Future<AddressDeleted> remove(String id) async {
    final AddressDeleted deleted =
        await _ref.read(avenickApiProvider).account.deleteAddress(id);
    _ref.invalidate(addressesProvider);
    return deleted;
  }

  /// Promote an address to the default one.
  ///
  /// A PATCH of exactly one field. Sending the whole address back would be how
  /// a stale copy of a row reverts an edit made on another device.
  Future<Address> makeDefault(String id) => update(
        id,
        const UpdateAddressRequest(isDefault: Patch<bool>.set(true)),
      );
}

final Provider<AddressBook> addressBookProvider =
    Provider<AddressBook>(AddressBook.new);
