import '../core/network/api_client.dart';
import 'models/account.dart';
import 'models/requests.dart';

/// `/v1/me`, `/v1/account` and the address book.
class AccountApi {
  const AccountApi(this._client);

  final ApiClient _client;

  static const String mePath = '/v1/me';
  static const String accountPath = '/v1/account';
  static const String addressesPath = '/v1/addresses';

  /// `GET /v1/me`
  Future<Me> me() => _client.get<Me>(mePath, decoder: Me.fromJson);

  /// `PATCH /v1/me` — a genuine partial update.
  ///
  /// Fields not mentioned are not sent, so two screens editing different parts
  /// of a profile cannot revert each other. See [Patch] for the three states a
  /// nullable field has.
  Future<Me> updateMe(UpdateMeRequest request) =>
      _client.patch<Me>(mePath, decoder: Me.fromJson, body: request.toJson());

  /// `DELETE /v1/account` — SCHEDULE an erasure.
  ///
  /// The account is not gone when this returns. [AccountDeletion.erasesAt] is
  /// when it will be, and the app must show that date: telling someone their
  /// data has been deleted while it has not is a false statement about a
  /// legal right, not a UX shortcut.
  ///
  /// The body carries the DELETE, which is unusual but is what the contract
  /// specifies — Dio sends it.
  Future<AccountDeletion> deleteAccount(DeleteAccountRequest request) =>
      _client.delete<AccountDeletion>(
        accountPath,
        decoder: AccountDeletion.fromJson,
        body: request.toJson(),
      );

  /// `GET /v1/addresses` — the whole book, unpaginated. Bounded by how many
  /// addresses a person has, which is not a number that needs a cursor.
  Future<List<Address>> addresses() =>
      _client.getList<Address>(addressesPath, itemDecoder: Address.fromJson);

  /// `GET /v1/addresses/{id}`
  Future<Address> address(String id) => _client.get<Address>(
        '$addressesPath/${Uri.encodeComponent(id)}',
        decoder: Address.fromJson,
      );

  /// `POST /v1/addresses`
  Future<Address> createAddress(CreateAddressRequest request) =>
      _client.post<Address>(
        addressesPath,
        decoder: Address.fromJson,
        body: request.toJson(),
      );

  /// `PATCH /v1/addresses/{id}`
  Future<Address> updateAddress(String id, UpdateAddressRequest request) =>
      _client.patch<Address>(
        '$addressesPath/${Uri.encodeComponent(id)}',
        decoder: Address.fromJson,
        body: request.toJson(),
      );

  /// `DELETE /v1/addresses/{id}`
  ///
  /// A 409 here means the address is referenced by an order that has not
  /// settled. That is a `ServerFailure` with `isConflict` true and a message
  /// worth showing verbatim.
  Future<AddressDeleted> deleteAddress(String id) =>
      _client.delete<AddressDeleted>(
        '$addressesPath/${Uri.encodeComponent(id)}',
        decoder: AddressDeleted.fromJson,
      );
}
