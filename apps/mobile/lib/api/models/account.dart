import 'package:freezed_annotation/freezed_annotation.dart';

import 'common.dart';
import 'converters.dart';
import 'enums.dart';

part 'account.freezed.dart';
part 'account.g.dart';

/// The buyer's company, when they buy on behalf of one.
///
/// [status] is [CompanyStatus] and NOT [UserStatus]: the value sets differ
/// (`PENDING_VERIFICATION` versus `PENDING`), and treating them as one type
/// would let a wrong string through the parser.
@freezed
abstract class CompanyMembership with _$CompanyMembership {
  const CompanyMembership._();

  const factory CompanyMembership({
    required String companyId,
    required String nameEn,
    required String? nameAr,
    required Country country,
    required CompanyStatus status,

    /// The role INSIDE the company, which can differ from the account's own
    /// [Me.role].
    required UserRole role,
  }) = _CompanyMembership;

  factory CompanyMembership.fromJson(Map<String, dynamic> json) =>
      _$CompanyMembershipFromJson(json);

  /// B2B pricing and PO flows are only open to an active membership.
  bool get canTradeB2b => status == CompanyStatus.active;
}

@freezed
abstract class Me with _$Me {
  const Me._();

  const factory Me({
    required String id,
    required String email,

    /// International format, `+9715xxxxxxx`. Null until the buyer adds one.
    required String? phone,
    required String firstName,
    required String lastName,
    required String? firstNameAr,
    required String? lastNameAr,
    required ImageRef? avatar,
    required UserRole role,
    required UserStatus status,
    required Language language,
    required bool emailVerified,
    required bool phoneVerified,
    required CompanyMembership? company,
    @UtcDateTimeConverter() required DateTime createdAt,
  }) = _Me;

  factory Me.fromJson(Map<String, dynamic> json) => _$MeFromJson(json);

  String displayName(Language language) {
    if (language == Language.ar && firstNameAr != null && lastNameAr != null) {
      return '$firstNameAr $lastNameAr'.trim();
    }
    return '$firstName $lastName'.trim();
  }

  bool get isB2bBuyer => company?.canTradeB2b ?? false;

  /// A suspended or banned account can still sign in and read; it cannot
  /// transact. The app should say so rather than let a checkout fail at the
  /// last step.
  bool get canTransact => status == UserStatus.active;
}

/// The answer to `DELETE /v1/account`: deletion is SCHEDULED, not immediate.
/// [erasesAt] is when the data actually goes, and the app must show it —
/// telling the buyer their account is gone when it is not is a GDPR/PDPL
/// statement that is simply untrue.
@freezed
abstract class AccountDeletion with _$AccountDeletion {
  const AccountDeletion._();

  const factory AccountDeletion({
    required AccountDeletionStatus status,
    @UtcDateTimeConverter() required DateTime requestedAt,
    @UtcDateTimeConverter() required DateTime erasesAt,
  }) = _AccountDeletion;

  factory AccountDeletion.fromJson(Map<String, dynamic> json) =>
      _$AccountDeletionFromJson(json);

  Duration gracePeriod() => erasesAt.difference(requestedAt);
}

/// A saved address in the buyer's book.
///
/// Wider than [ShippingAddress] — it has an id, coordinates and a default
/// flag. Converting one to the other is [toShippingAddress]; the reverse needs
/// the server.
@freezed
abstract class Address with _$Address {
  const Address._();

  const factory Address({
    required String id,
    required String label,
    required String line1,
    required String? line2,
    required String city,
    required Country country,
    required String? postalCode,

    /// Map coordinates. Genuinely approximate quantities, so `double` is the
    /// right type — unlike money, nothing is settled against them.
    required double? latitude,
    required double? longitude,
    required bool isDefault,
  }) = _Address;

  factory Address.fromJson(Map<String, dynamic> json) =>
      _$AddressFromJson(json);

  bool get hasCoordinates => latitude != null && longitude != null;

  /// The narrower shape `checkout/quote` accepts.
  Map<String, Object?> toShippingAddressJson() => <String, Object?>{
        'label': label,
        'line1': line1,
        if (line2 != null) 'line2': line2,
        'city': city,
        'country': country.code,
        if (postalCode != null) 'postalCode': postalCode,
      };
}

@freezed
abstract class AddressDeleted with _$AddressDeleted {
  const factory AddressDeleted({
    required String id,
    required bool deleted,
  }) = _AddressDeleted;

  factory AddressDeleted.fromJson(Map<String, dynamic> json) =>
      _$AddressDeletedFromJson(json);
}

/// A registered push target.
///
/// Note what is NOT here: the push token itself never comes back. It goes up
/// on registration and is never echoed, which is correct — a token in a
/// response body is a token in a log.
@freezed
abstract class Device with _$Device {
  const factory Device({
    required String id,
    required String deviceId,
    required DevicePlatform platform,
    required String appVersion,
    required Language language,
    @UtcDateTimeConverter() required DateTime registeredAt,
    @UtcDateTimeConverter() required DateTime lastSeenAt,
  }) = _Device;

  factory Device.fromJson(Map<String, dynamic> json) => _$DeviceFromJson(json);
}

@freezed
abstract class DeviceDeleted with _$DeviceDeleted {
  const factory DeviceDeleted({
    required String deviceId,
    required bool deleted,
  }) = _DeviceDeleted;

  factory DeviceDeleted.fromJson(Map<String, dynamic> json) =>
      _$DeviceDeletedFromJson(json);
}
