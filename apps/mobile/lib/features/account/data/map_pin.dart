import 'package:flutter/foundation.dart';

/// A dropped pin, parsed out of whatever a person pasted.
///
/// ── WHY THIS IS A TEXT FIELD AND NOT A MAP ──────────────────────────────────
/// `pubspec.yaml` belongs to another engineer, so there is no maps plugin and
/// no map here. That constraint turns out to matter less than it sounds,
/// because of how location is ACTUALLY shared in the Gulf: somebody drops a pin
/// in Google Maps and sends the link on WhatsApp. The link is the artefact
/// people already have in their clipboard.
///
/// So this parses the things that end up in a clipboard — a Google Maps URL, an
/// Apple Maps URL, a `geo:` URI, or a bare `lat, lng` pair — and hands back two
/// doubles for `latitude`/`longitude` on `POST /v1/addresses`, which is exactly
/// what the contract wants.
///
/// What a maps plugin would add, and why it is worth adding later: a pin
/// dropped ON the delivery point rather than at whatever the sender was standing
/// near; a visible confirmation that the pin is where the person thinks it is;
/// reverse geocoding to prefill the city; and "use my current location", which
/// is the single fastest path to a correct address in a country with no
/// meaningful street addressing.
@immutable
class MapPin {
  const MapPin({required this.latitude, required this.longitude});

  final double latitude;
  final double longitude;

  /// Rough bounds for the six markets this platform serves.
  ///
  /// A WARNING, not a rule. Someone genuinely does order to an address outside
  /// the box — a project site just over a border, a freight-forwarder in
  /// Jebel Ali handling a Muscat delivery — and a client that refuses those
  /// coordinates is a client that refuses a real order.
  bool get isPlausiblyGcc =>
      latitude >= 15.0 &&
      latitude <= 33.0 &&
      longitude >= 34.0 &&
      longitude <= 60.0;

  /// Six decimal places is about 11cm. More than that is noise from a phone
  /// GPS, and it makes the value harder to read back.
  String get display =>
      '${latitude.toStringAsFixed(6)}, ${longitude.toStringAsFixed(6)}';

  /// Parse a pasted pin. Returns null when there is nothing usable in [input].
  ///
  /// Deliberately permissive about the container and strict about the numbers:
  /// a value outside the valid latitude/longitude ranges is rejected outright,
  /// because a swapped pair (`55.27, 25.20` — longitude first, which is what a
  /// GeoJSON copy-paste gives you) would otherwise be stored as a pin in the
  /// Indian Ocean and nothing downstream would notice.
  static MapPin? tryParse(String input) {
    final String value = input.trim();
    if (value.isEmpty) return null;

    for (final RegExp pattern in _patterns) {
      final RegExpMatch? match = pattern.firstMatch(value);
      if (match == null) continue;
      final double? lat = double.tryParse(match.group(1)!);
      final double? lng = double.tryParse(match.group(2)!);
      if (lat == null || lng == null) continue;
      if (lat < -90 || lat > 90) continue;
      if (lng < -180 || lng > 180) continue;
      return MapPin(latitude: lat, longitude: lng);
    }
    return null;
  }

  /// Ordered most specific first. A Google Maps share URL contains several
  /// coordinate pairs — the `@` pair is the map CENTRE, while `!3d…!4d…` is the
  /// PLACE — and the place is the one somebody meant to send.
  static final List<RegExp> _patterns = <RegExp>[
    // https://www.google.com/maps/place/…/data=…!3d25.2048!4d55.2708
    RegExp(r'!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)'),
    // ?q=25.2048,55.2708 · &query=25.2048,55.2708 · ?ll=25.2,55.2 (Apple)
    RegExp(
      r'[?&](?:q|query|ll|daddr|sll)=(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)',
      caseSensitive: false,
    ),
    // https://www.google.com/maps/@25.2048,55.2708,17z
    RegExp(r'@(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)'),
    // geo:25.2048,55.2708
    RegExp(r'geo:(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)', caseSensitive: false),
    // A bare pair, which is what people type when they read it off a screen.
    RegExp(r'^\s*(-?\d+\.?\d*)\s*[,;\s]\s*(-?\d+\.?\d*)\s*$'),
  ];

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MapPin &&
          other.latitude == latitude &&
          other.longitude == longitude;

  @override
  int get hashCode => Object.hash(latitude, longitude);

  @override
  String toString() => 'MapPin($display)';
}
