import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../api/avenick_api.dart';
import 'account_providers.dart';

/// ── ENDPOINTS THIS FILE NEEDS ───────────────────────────────────────────────
/// `GET   /v1/me/notification-preferences`
/// `PATCH /v1/me/notification-preferences`
///
/// NEITHER IS IN THE CONTRACT AT ALL. Unlike the auth routes — which are
/// specified in `packages/contracts/openapi.json` and merely unimplemented —
/// notification preferences have never been specified: there is no schema, no
/// Prisma model, and no route. The paths below are this client's PROPOSAL, and
/// they are named here so the backend has something concrete to build against.
///
/// What that means on screen: the load fails with `not_found`, the screen shows
/// the truthful error state, and **the toggles are never rendered**. A row of
/// switches that flip and change nothing is precisely the thing this app is not
/// allowed to ship — a preference the user believes they set is worse than a
/// preference they were told they cannot set yet.
///
/// `POST /v1/devices` (which IS in the contract, and also unbuilt) is a
/// different thing and not a substitute: it registers a push target, it does
/// not carry which categories that target wants.
/// ────────────────────────────────────────────────────────────────────────────

/// One thing the app may send a notification about.
///
/// Categories, not channels. "Email me but do not push me" is a channel matrix
/// and doubles the surface for a preference nobody has asked for; what people
/// actually want is to keep delivery updates and stop the offers.
enum NotificationCategory {
  /// Order confirmed, dispatched, out for delivery, delivered.
  orders(
    key: 'orders',
    title: 'Orders and delivery',
    body: 'Confirmations, dispatch, and the driver on the way.',
  ),

  /// Price drops and back-in-stock on watched items.
  stock(
    key: 'stock',
    title: 'Price drops and back in stock',
    body: 'Only for products you have saved or asked about.',
  ),

  /// Campaigns. The one everybody turns off, and the one that must be
  /// separately switchable for that reason.
  offers(
    key: 'offers',
    title: 'Offers and promotions',
    body: 'Seasonal campaigns and seller promotions.',
  ),

  /// Sign-in from a new device, password and phone changes.
  ///
  /// [alwaysOn] — a security alert is not a marketing preference. Being told
  /// someone signed into your account from a new handset is not something an
  /// account holder can usefully opt out of, and an app that lets them do it
  /// silently is an app that helps whoever took the phone.
  security(
    key: 'security',
    title: 'Account and security',
    body: 'New sign-ins, and changes to your phone or password.',
    alwaysOn: true,
  ),

  /// Purchase approvals waiting on a company approver.
  b2bApprovals(
    key: 'b2b_approvals',
    title: 'Purchase approvals',
    body: 'Orders waiting on your approval, and decisions on yours.',
    b2bOnly: true,
  );

  const NotificationCategory({
    required this.key,
    required this.title,
    required this.body,
    this.alwaysOn = false,
    this.b2bOnly = false,
  });

  /// The wire key. Stable — renaming a Dart constant must never change what is
  /// sent.
  final String key;
  final String title;
  final String body;
  final bool alwaysOn;
  final bool b2bOnly;
}

/// What the server says this account wants.
@immutable
class NotificationPreferences {
  const NotificationPreferences(this.enabled);

  /// Keyed by [NotificationCategory.key]. A category missing from the map is a
  /// category the server has not answered for — it is rendered as OFF and
  /// never assumed on. Defaulting an unknown preference to "yes, send them
  /// marketing" is the wrong way round.
  final Map<String, bool> enabled;

  bool isOn(NotificationCategory category) =>
      category.alwaysOn || (enabled[category.key] ?? false);

  static NotificationPreferences fromJson(Map<String, dynamic> json) {
    final Object? categories = json['categories'];
    if (categories is! Map) {
      throw const FormatException(
        'Expected "categories" to be an object of key -> bool',
      );
    }
    return NotificationPreferences(<String, bool>{
      for (final MapEntry<Object?, Object?> entry in categories.entries)
        '${entry.key}': entry.value == true,
    });
  }

  NotificationPreferences withCategory(
    NotificationCategory category, {
    required bool on,
  }) =>
      NotificationPreferences(<String, bool>{
        ...enabled,
        category.key: on,
      });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is NotificationPreferences &&
          mapEquals<String, bool>(other.enabled, enabled);

  @override
  int get hashCode => Object.hashAll(<Object?>[
        for (final MapEntry<String, bool> e in enabled.entries) ...<Object?>[
          e.key,
          e.value,
        ],
      ]);
}

/// The client for the two endpoints that do not exist yet.
class NotificationPreferencesApi {
  const NotificationPreferencesApi(this._api);

  final AvenickApi _api;

  /// PROPOSED. See the header of this file.
  static const String path = '/v1/me/notification-preferences';

  Future<NotificationPreferences> read() =>
      _api.client.get<NotificationPreferences>(
        path,
        decoder: NotificationPreferences.fromJson,
      );

  Future<NotificationPreferences> setCategory(
    NotificationCategory category, {
    required bool on,
  }) =>
      _api.client.patch<NotificationPreferences>(
        path,
        decoder: NotificationPreferences.fromJson,
        body: <String, Object?>{
          'categories': <String, Object?>{category.key: on},
        },
      );
}

final Provider<NotificationPreferencesApi> notificationPreferencesApiProvider =
    Provider<NotificationPreferencesApi>(
  (Ref ref) => NotificationPreferencesApi(ref.watch(avenickApiProvider)),
);

final FutureProvider<NotificationPreferences> notificationPreferencesProvider =
    FutureProvider<NotificationPreferences>(
  (Ref ref) => ref.watch(notificationPreferencesApiProvider).read(),
);

/// Whether the app has earned the right to ask for the OS notification
/// permission yet.
///
/// **FALSE AT LAUNCH, ALWAYS.** The permission prompt is one-shot per install:
/// asking on first run and being denied costs the account every delivery
/// notification it will ever send, permanently, and the only way back is the
/// system settings app. So the prompt is gated behind a value moment — an
/// order placed, a delivery in flight, a back-in-stock alert asked for — and
/// the app sets this flag at that moment and not before.
///
/// Nothing in this feature ever sets it to true on its own.
class NotificationValueMoment extends Notifier<bool> {
  @override
  bool build() => false;

  /// Called by whichever feature reaches the value moment — commerce, after an
  /// order is placed; catalogue, when a back-in-stock alert is asked for. It is
  /// deliberately the only way this flips, and it is never called from a
  /// widget's `initState`.
  void reached() => state = true;
}

final NotifierProvider<NotificationValueMoment, bool>
    notificationValueMomentProvider =
    NotifierProvider<NotificationValueMoment, bool>(
  NotificationValueMoment.new,
);
