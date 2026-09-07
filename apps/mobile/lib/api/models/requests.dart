import 'package:freezed_annotation/freezed_annotation.dart';

import 'enums.dart';

/// Request bodies, hand-written rather than generated.
///
/// They are NOT freezed models, on purpose. Every request schema on this
/// surface is `.strict()`, and several of them distinguish three states for
/// one field — set it, clear it, leave it alone. `json_serializable` can omit
/// nulls OR include them; it cannot do both in the same object, and a PATCH
/// needs both. So these serialise themselves and the reader can see exactly
/// what goes on the wire.

/// A field in a PATCH: absent, set, or explicitly cleared.
///
/// `PATCH /v1/me` types `firstNameAr` as `string | null` and optional. Those
/// are three different requests:
///
///   * omitted        — leave the Arabic first name as it is
///   * `"سعيد"`       — set it
///   * `null`         — REMOVE it
///
/// A client that models this as a plain `String?` cannot express the middle
/// state without also sending every other field, and a "save profile" that
/// round-trips fields the user never touched is how one screen quietly
/// reverts another screen's edit.
@immutable
class Patch<T extends Object> {
  /// Leave the field alone — it will not appear in the body at all.
  const Patch.unchanged()
      : value = null,
        isPresent = false;

  /// Set the field to [value].
  const Patch.set(T this.value) : isPresent = true;

  /// Explicitly send `null`, clearing the stored value.
  const Patch.clear()
      : value = null,
        isPresent = true;

  final T? value;
  final bool isPresent;

  /// Write into [target] under [key] if this field participates at all.
  void writeTo(
    Map<String, Object?> target,
    String key, [
    Object? Function(T)? encode,
  ]) {
    if (!isPresent) return;
    final v = value;
    target[key] = v == null ? null : (encode == null ? v : encode(v));
  }
}

/// `POST /v1/auth/token`
@immutable
class PasswordGrantRequest {
  const PasswordGrantRequest({
    required this.email,
    required this.password,
    required this.deviceId,
  });

  final String email;
  final String password;
  final String deviceId;

  Map<String, Object?> toJson() => <String, Object?>{
        'email': email,
        'password': password,
        'deviceId': deviceId,
      };

  /// A password must never reach a log, a crash report or a `print`.
  @override
  String toString() =>
      'PasswordGrantRequest(email: $email, password: <redacted>, '
      'deviceId: $deviceId)';
}

/// `POST /v1/auth/refresh`
@immutable
class RefreshRequest {
  const RefreshRequest({required this.refreshToken, required this.deviceId});

  final String refreshToken;
  final String deviceId;

  Map<String, Object?> toJson() => <String, Object?>{
        'refreshToken': refreshToken,
        'deviceId': deviceId,
      };

  @override
  String toString() =>
      'RefreshRequest(refreshToken: <redacted>, deviceId: $deviceId)';
}

/// `POST /v1/auth/revoke`
///
/// Both fields are optional in the contract: with neither, the server revokes
/// the caller's current session from its own credential.
@immutable
class RevokeRequest {
  const RevokeRequest({this.refreshToken, this.allSessions = false});

  final String? refreshToken;

  /// Sign out everywhere. The "I lost my phone" button.
  final bool allSessions;

  Map<String, Object?> toJson() => <String, Object?>{
        if (refreshToken != null) 'refreshToken': refreshToken,
        'allSessions': allSessions,
      };

  @override
  String toString() =>
      'RevokeRequest(refreshToken: <redacted>, allSessions: $allSessions)';
}

/// `POST /v1/auth/otp/request`
@immutable
class OtpRequest {
  const OtpRequest({
    required this.phone,
    required this.deviceId,
    this.language,
  });

  /// International format, `+9715xxxxxxx`, the same rule web registration
  /// enforces. Diverging would collect a number the web would reject.
  final String phone;
  final String deviceId;
  final Language? language;

  Map<String, Object?> toJson() => <String, Object?>{
        'phone': phone,
        'deviceId': deviceId,
        if (language != null) 'language': language!.code,
      };
}

/// `POST /v1/auth/otp/verify`
@immutable
class OtpVerifyRequest {
  const OtpVerifyRequest({
    required this.challengeId,
    required this.code,
    required this.deviceId,
  });

  final String challengeId;

  /// 4 to 8 digits — the length the challenge asked for.
  final String code;
  final String deviceId;

  Map<String, Object?> toJson() => <String, Object?>{
        'challengeId': challengeId,
        'code': code,
        'deviceId': deviceId,
      };

  /// The code is a single-use credential. Not in a log.
  @override
  String toString() =>
      'OtpVerifyRequest(challengeId: $challengeId, code: <redacted>, '
      'deviceId: $deviceId)';
}

/// One line of `POST /v1/cart/items` or `POST /v1/cart/merge`.
@immutable
class CartLineInput {
  const CartLineInput({
    required this.productId,
    required this.qty,
    this.variantId,
    this.channel = Channel.b2c,
  });

  final String productId;
  final String? variantId;
  final int qty;
  final Channel channel;

  Map<String, Object?> toJson() => <String, Object?>{
        'productId': productId,
        if (variantId != null) 'variantId': variantId,
        'qty': qty,
        'channel': channel.wire,
      };
}

/// `POST /v1/cart/merge`
@immutable
class CartMergeRequest {
  const CartMergeRequest({required this.strategy, required this.lines});

  final CartMergeStrategy strategy;
  final List<CartLineInput> lines;

  Map<String, Object?> toJson() => <String, Object?>{
        'strategy': strategy == CartMergeStrategy.sum ? 'sum' : 'replace',
        'lines': <Map<String, Object?>>[
          for (final line in lines) line.toJson(),
        ],
      };
}

/// The ship-to address a quote is priced against — exactly the fields
/// `checkout/quote` accepts, and no more.
@immutable
class ShippingAddressInput {
  const ShippingAddressInput({
    required this.label,
    required this.line1,
    required this.city,
    required this.country,
    this.line2,
    this.postalCode,
  });

  final String label;
  final String line1;
  final String? line2;
  final String city;
  final Country country;
  final String? postalCode;

  /// The optional fields are OMITTED rather than sent as null. The schema is
  /// `z.string().optional()`, so an explicit `null` fails validation — this is
  /// the difference between "no second line" and a 400.
  Map<String, Object?> toJson() => <String, Object?>{
        'label': label,
        'line1': line1,
        if (line2 != null && line2!.isNotEmpty) 'line2': line2,
        'city': city,
        'country': country.code,
        if (postalCode != null && postalCode!.isNotEmpty)
          'postalCode': postalCode,
      };
}

/// One line of `POST /v1/checkout/quote`.
@immutable
class QuoteLineInput {
  const QuoteLineInput({
    required this.productId,
    required this.quantity,
    this.variantId,
  });

  final String productId;
  final String? variantId;
  final int quantity;

  Map<String, Object?> toJson() => <String, Object?>{
        'productId': productId,
        if (variantId != null) 'variantId': variantId,
        'quantity': quantity,
      };
}

/// `POST /v1/checkout/quote`
///
/// Note what this body does NOT carry: no prices, no discounts, no VAT, no
/// freight. All of them are resolved server-side, deliberately — a shipping
/// figure the client can influence is a discount the client can grant itself.
///
/// [items] is required and explicit even though the server holds a cart,
/// because a quote the buyer is shown must be a quote for the lines the buyer
/// can SEE. [cartId] travels alongside so the server can refuse to quote
/// against a cart that has moved on since the screen was drawn.
@immutable
class CheckoutQuoteRequest {
  const CheckoutQuoteRequest({
    required this.items,
    required this.shippingAddress,
    required this.currency,
    this.cartId,
    this.channel = Channel.b2c,
    this.couponCode,
  });

  final String? cartId;
  final List<QuoteLineInput> items;
  final ShippingAddressInput shippingAddress;

  /// Required, never defaulted: a defaulted currency prices an order the buyer
  /// never chose.
  final Currency currency;
  final Channel channel;
  final String? couponCode;

  Map<String, Object?> toJson() => <String, Object?>{
        if (cartId != null) 'cartId': cartId,
        'items': <Map<String, Object?>>[
          for (final item in items) item.toJson(),
        ],
        'shippingAddress': shippingAddress.toJson(),
        'currency': currency.code,
        'channel': channel.wire,
        if (couponCode != null && couponCode!.isNotEmpty)
          'couponCode': couponCode,
      };
}

/// `PATCH /v1/me` — every field tri-state. See [Patch].
@immutable
class UpdateMeRequest {
  const UpdateMeRequest({
    this.firstName = const Patch<String>.unchanged(),
    this.lastName = const Patch<String>.unchanged(),
    this.firstNameAr = const Patch<String>.unchanged(),
    this.lastNameAr = const Patch<String>.unchanged(),
    this.phone = const Patch<String>.unchanged(),
    this.language = const Patch<Language>.unchanged(),
  });

  /// Not nullable in the contract — it can be set, never cleared. Sending
  /// `Patch.clear()` here would be a 400.
  final Patch<String> firstName;
  final Patch<String> lastName;
  final Patch<String> firstNameAr;
  final Patch<String> lastNameAr;
  final Patch<String> phone;
  final Patch<Language> language;

  Map<String, Object?> toJson() {
    final body = <String, Object?>{};
    firstName.writeTo(body, 'firstName');
    lastName.writeTo(body, 'lastName');
    firstNameAr.writeTo(body, 'firstNameAr');
    lastNameAr.writeTo(body, 'lastNameAr');
    phone.writeTo(body, 'phone');
    language.writeTo(body, 'language', (l) => l.code);
    return body;
  }

  bool get isEmpty => toJson().isEmpty;
}

/// `DELETE /v1/account`
///
/// [confirmEmail] must match the signed-in account. It is a deliberate
/// friction, not a formality: this schedules an erasure.
@immutable
class DeleteAccountRequest {
  const DeleteAccountRequest({required this.confirmEmail, this.reason});

  final String confirmEmail;
  final String? reason;

  Map<String, Object?> toJson() => <String, Object?>{
        'confirmEmail': confirmEmail,
        if (reason != null && reason!.isNotEmpty) 'reason': reason,
      };
}

/// `POST /v1/addresses`
@immutable
class CreateAddressRequest {
  const CreateAddressRequest({
    required this.label,
    required this.line1,
    required this.city,
    required this.country,
    this.line2,
    this.postalCode,
    this.latitude,
    this.longitude,
    this.isDefault = false,
  });

  final String label;
  final String line1;
  final String? line2;
  final String city;
  final Country country;
  final String? postalCode;
  final double? latitude;
  final double? longitude;
  final bool isDefault;

  Map<String, Object?> toJson() => <String, Object?>{
        'label': label,
        'line1': line1,
        if (line2 != null && line2!.isNotEmpty) 'line2': line2,
        'city': city,
        'country': country.code,
        if (postalCode != null && postalCode!.isNotEmpty)
          'postalCode': postalCode,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
        'isDefault': isDefault,
      };
}

/// `PATCH /v1/addresses/{id}`
///
/// `line2`, `postalCode`, `latitude` and `longitude` are nullable in the
/// contract, so [Patch.clear] is meaningful on those four and a 400 on the
/// rest.
@immutable
class UpdateAddressRequest {
  const UpdateAddressRequest({
    this.label = const Patch<String>.unchanged(),
    this.line1 = const Patch<String>.unchanged(),
    this.line2 = const Patch<String>.unchanged(),
    this.city = const Patch<String>.unchanged(),
    this.country = const Patch<Country>.unchanged(),
    this.postalCode = const Patch<String>.unchanged(),
    this.latitude = const Patch<double>.unchanged(),
    this.longitude = const Patch<double>.unchanged(),
    this.isDefault = const Patch<bool>.unchanged(),
  });

  final Patch<String> label;
  final Patch<String> line1;
  final Patch<String> line2;
  final Patch<String> city;
  final Patch<Country> country;
  final Patch<String> postalCode;
  final Patch<double> latitude;
  final Patch<double> longitude;
  final Patch<bool> isDefault;

  Map<String, Object?> toJson() {
    final body = <String, Object?>{};
    label.writeTo(body, 'label');
    line1.writeTo(body, 'line1');
    line2.writeTo(body, 'line2');
    city.writeTo(body, 'city');
    country.writeTo(body, 'country', (c) => c.code);
    postalCode.writeTo(body, 'postalCode');
    latitude.writeTo(body, 'latitude');
    longitude.writeTo(body, 'longitude');
    isDefault.writeTo(body, 'isDefault');
    return body;
  }

  bool get isEmpty => toJson().isEmpty;
}

/// `POST /v1/devices`
@immutable
class RegisterDeviceRequest {
  const RegisterDeviceRequest({
    required this.deviceId,
    required this.pushToken,
    required this.platform,
    required this.appVersion,
    this.osVersion,
    this.language,
    this.timeZone,
  });

  final String deviceId;

  /// The APNs/FCM token. A credential: it is never echoed back by the server
  /// and must never be logged here.
  final String pushToken;
  final DevicePlatform platform;

  /// Semver, `1.2.3` with an optional pre-release or build suffix. The server
  /// enforces the pattern; a `1.2` here is a 400.
  final String appVersion;
  final String? osVersion;
  final Language? language;
  final String? timeZone;

  Map<String, Object?> toJson() => <String, Object?>{
        'deviceId': deviceId,
        'pushToken': pushToken,
        'platform': platform == DevicePlatform.ios ? 'ios' : 'android',
        'appVersion': appVersion,
        if (osVersion != null) 'osVersion': osVersion,
        if (language != null) 'language': language!.code,
        if (timeZone != null) 'timeZone': timeZone,
      };

  @override
  String toString() =>
      'RegisterDeviceRequest(deviceId: $deviceId, pushToken: <redacted>, '
      'platform: ${platform.name}, appVersion: $appVersion)';
}
