import 'package:freezed_annotation/freezed_annotation.dart';

import 'checkout.dart' show ShippingAddress;
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

/// The ship-to address a quote is priced against and an order is placed to —
/// exactly the fields `checkout/quote` and `POST /v1/orders` accept, and no
/// more.
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

  /// Narrow a `ShippingAddress` off the wire back into a request body.
  ///
  /// The two carry the same six fields, but they are NOT the same type on
  /// purpose: the response model's generated `toJson` writes `line2: null`,
  /// and the request schema types `line2` as `.optional()` — where an explicit
  /// null is a 400, not an empty second line. This is the conversion that
  /// keeps that difference from becoming a rejected order.
  factory ShippingAddressInput.from(ShippingAddress address) =>
      ShippingAddressInput(
        label: address.label,
        line1: address.line1,
        city: address.city,
        country: address.country,
        line2: address.line2,
        postalCode: address.postalCode,
      );

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

/// One line of `POST /v1/orders`.
///
/// A typedef rather than a copy: the order-item schema and the quote-line
/// schema are the same three properties with the same three constraints —
/// `productId` required, `variantId` optional, `quantity` a positive integer
/// capped at 100,000 — and two hand-written classes for one wire shape is two
/// places to update when it moves. `endpoints_test.dart` asserts the two
/// bodies serialise identically, so a divergence in the contract fails there
/// rather than silently in one of them.
typedef OrderLineInput = QuoteLineInput;

/// `POST /v1/orders` — place the order.
///
/// ## What this body does NOT carry
///
/// No prices, no discounts, no VAT, no freight, no totals. Identity and
/// quantity only: everything with money in it is resolved server-side against
/// the catalogue at the moment of placement. A client that could name a price
/// is a client that could name a lower one.
///
/// ## Idempotency is not optional here
///
/// This is the one non-idempotent call on the surface, and a timeout on it is
/// NOT a rollback — the order may well have been written. Send an
/// `Idempotency-Key` and reuse the SAME key for every retry of the same
/// submission; the server answers a repeat with the original order and
/// `replayed: true`. `OrdersApi.placeOrder` mints one per attempt if the
/// caller does not, but a caller that retries must pass its own: a fresh key
/// on a retry is how one basket becomes two orders.
///
/// ## B2C only, and card methods are refused
///
/// A B2B order goes through the governed purchase-order workflow, which has no
/// endpoint on this surface. And of the six [PaymentMethod] values, only
/// `BANK_TRANSFER` (and `MOCK`, where the deployment allows it) completes
/// today — card and wallet methods answer 503 `upstream_unavailable` until a
/// payment-session flow exists. That is a dependency that is absent, not one
/// that is down: the UI must EXPLAIN it, not retry it. See
/// `OrdersApi.placeOrder`.
@immutable
class PlaceOrderRequest {
  const PlaceOrderRequest({
    required this.items,
    required this.shippingAddress,
    required this.paymentMethod,
    required this.currency,
    this.couponCode,
    this.notes,
  });

  final List<OrderLineInput> items;
  final ShippingAddressInput shippingAddress;
  final PaymentMethod paymentMethod;

  /// Required, never defaulted: a defaulted currency charges for an order the
  /// buyer never agreed to.
  final Currency currency;
  final String? couponCode;
  final String? notes;

  /// True for the methods this deployment can actually complete. A screen that
  /// offers one of the others is offering a button that answers 503.
  bool get isSettleableMethod =>
      paymentMethod == PaymentMethod.bankTransfer ||
      paymentMethod == PaymentMethod.mock;

  Map<String, Object?> toJson() => <String, Object?>{
        'items': <Map<String, Object?>>[
          for (final OrderLineInput item in items) item.toJson(),
        ],
        'shippingAddress': shippingAddress.toJson(),
        'paymentMethod': _paymentMethodWire(paymentMethod),
        'currency': currency.code,
        if (couponCode != null && couponCode!.isNotEmpty)
          'couponCode': couponCode,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
      };

  /// The wire spelling of a [PaymentMethod]. The Dart names are lowerCamelCase
  /// to keep the linter quiet, so the SCREAMING_SNAKE form the server expects
  /// is produced here rather than by `.name`.
  static String _paymentMethodWire(PaymentMethod method) =>
      const <PaymentMethod, String>{
        PaymentMethod.mada: 'MADA',
        PaymentMethod.applePay: 'APPLE_PAY',
        PaymentMethod.creditCard: 'CREDIT_CARD',
        PaymentMethod.bankTransfer: 'BANK_TRANSFER',
        PaymentMethod.stcPay: 'STC_PAY',
        PaymentMethod.mock: 'MOCK',
      }[method]!;
}

/// One line of `POST /v1/rfqs`.
///
/// Only [quantity] is required. A line naming a catalogue [productId] takes
/// its name from the catalogue, and a free-text line must carry its own
/// [nameEn] — so exactly one of the two is always meaningful, and sending
/// neither is a 400. [isWellFormed] says so before the round trip does.
@immutable
class RfqLineInput {
  const RfqLineInput({
    required this.quantity,
    this.productId,
    this.nameEn,
    this.notes,
  });

  /// A line for a catalogue product: the server fills the name in.
  const RfqLineInput.product({
    required String this.productId,
    required this.quantity,
    this.notes,
  }) : nameEn = null;

  /// A line for something the catalogue does not list. This is the ordinary
  /// case for an RFQ, not an edge case.
  const RfqLineInput.freeText({
    required String this.nameEn,
    required this.quantity,
    this.notes,
  }) : productId = null;

  final String? productId;

  /// 2 to 300 characters when present.
  final String? nameEn;
  final int quantity;
  final String? notes;

  /// A line the server can act on: it names a product, or it describes one.
  bool get isWellFormed =>
      quantity > 0 &&
      (productId != null || (nameEn != null && nameEn!.trim().length >= 2));

  /// The optional fields are OMITTED rather than sent as null — every one of
  /// them is `.optional()` and an explicit null fails validation.
  Map<String, Object?> toJson() => <String, Object?>{
        if (productId != null) 'productId': productId,
        if (nameEn != null && nameEn!.isNotEmpty) 'nameEn': nameEn,
        'quantity': quantity,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
      };
}

/// `POST /v1/rfqs` — the action a quote-only product offers instead of
/// Add to Cart.
///
/// [currency] is required and never defaulted: it is the currency the supplier
/// will quote IN, and a request raised in the wrong one comes back priced in a
/// currency the buyer cannot settle.
@immutable
class CreateRfqRequest {
  const CreateRfqRequest({
    required this.items,
    required this.currency,
    this.notes,
    this.requiredBy,
  });

  /// 1 to 50 lines.
  final List<RfqLineInput> items;
  final Currency currency;
  final String? notes;

  /// When the buyer needs them. Sent as ISO-8601 UTC.
  final DateTime? requiredBy;

  /// Every line names a product or describes one. Check before sending: a 400
  /// on a form the buyer has just filled in is a worse experience than a
  /// disabled button that says which line is short.
  bool get isWellFormed =>
      items.isNotEmpty && items.every((RfqLineInput l) => l.isWellFormed);

  Map<String, Object?> toJson() => <String, Object?>{
        'items': <Map<String, Object?>>[
          for (final RfqLineInput item in items) item.toJson(),
        ],
        'currency': currency.code,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
        if (requiredBy != null)
          'requiredBy': requiredBy!.toUtc().toIso8601String(),
      };
}

/// `POST /v1/rfqs/{id}/decision` — accept or reject the supplier's quote.
///
/// [expectedQuoteVersion] IS THE POINT OF THIS BODY. It is compared against
/// the stored version under the RFQ's advisory lock, so a decision made
/// against a quote the supplier has since revised comes back as a `conflict`
/// rather than binding the buyer to a price they never saw.
///
/// Pass `RfqDetail.quoteVersion` from the payload the buyer was LOOKING AT.
/// Re-reading the RFQ at the moment of the tap to "get the latest version"
/// defeats the check entirely — it would accept whatever the supplier had just
/// changed the price to.
@immutable
class RfqDecisionRequest {
  const RfqDecisionRequest({
    required this.decision,
    required this.expectedQuoteVersion,
  });

  const RfqDecisionRequest.accept(this.expectedQuoteVersion)
      : decision = RfqDecision.accepted;

  const RfqDecisionRequest.reject(this.expectedQuoteVersion)
      : decision = RfqDecision.rejected;

  final RfqDecision decision;
  final int expectedQuoteVersion;

  Map<String, Object?> toJson() => <String, Object?>{
        'decision': decision.wire,
        'expectedQuoteVersion': expectedQuoteVersion,
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
