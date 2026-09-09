import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/account.dart';
import '../../../api/models/enums.dart';
import '../../../api/models/requests.dart';
import '../../../core/error/failures.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../core/ui/key_button.dart';
import '../../../theme/elevation.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../data/account_preferences.dart';
import '../data/account_providers.dart';
import '../data/gcc_market.dart';
import '../data/map_pin.dart';
import 'account_chrome.dart';
import 'phone_field.dart';

/// ── ENDPOINTS THIS SCREEN NEEDS ─────────────────────────────────────────────
/// `POST  /v1/addresses`       — create. SPECIFIED, NOT BUILT.
/// `PATCH /v1/addresses/{id}`  — update. SPECIFIED, NOT BUILT.
///
/// ── AND ONE CONTRACT GAP, STATED PLAINLY ────────────────────────────────────
/// `Address` has NO field for a contact phone. Its shape is: id, label, line1,
/// line2, city, country, postalCode, latitude, longitude, isDefault. So the
/// "number for the driver" input on this screen is rendered DISABLED with that
/// reason on it, rather than accepting a number that would be silently dropped
/// on the way to the server. A field that eats what you type is worse than one
/// that says it cannot take it yet.
///
/// The LANDMARK maps onto `line2`, which is the only free-text slot the
/// contract has. That is a deliberate, documented compromise and not an
/// accident: see the field's own comment. A first-class `landmark` and a
/// `contactPhone` on `Address` are the two changes this screen wants.
/// ────────────────────────────────────────────────────────────────────────────

/// Create or edit an address, shaped for the Gulf.
///
/// ── WHY THIS FORM IS NOT A WESTERN ADDRESS FORM ─────────────────────────────
/// House number, street, postcode is a description of a country with numbered
/// houses on named streets and a postal grid. Large parts of the GCC have none
/// of those in the way a form expects: buildings are known by name, villas by
/// number within a community, and the postcode is either absent or ignored by
/// every courier in the country.
///
/// What actually finds a door here is a **dropped pin** and a **landmark** —
/// "villa 12, behind ADNOC, near the mosque". So those are the first two
/// fields, they are the ones with the explanations, and the postcode sits near
/// the bottom marked optional and is **never validated**. Blocking a save on a
/// postcode that does not exist is the single most common way a Western address
/// form locks a Gulf customer out of checkout.
class AddressEditScreen extends ConsumerStatefulWidget {
  const AddressEditScreen({this.address, this.onSaved, super.key});

  /// Null creates; non-null edits.
  final Address? address;

  final VoidCallback? onSaved;

  @override
  ConsumerState<AddressEditScreen> createState() => _AddressEditScreenState();
}

class _AddressEditScreenState extends ConsumerState<AddressEditScreen> {
  late final TextEditingController _label = TextEditingController(
    text: widget.address?.label ?? '',
  );
  late final TextEditingController _landmark = TextEditingController(
    text: widget.address?.line2 ?? '',
  );
  late final TextEditingController _line1 = TextEditingController(
    text: widget.address?.line1 ?? '',
  );
  late final TextEditingController _city = TextEditingController(
    text: widget.address?.city ?? '',
  );
  late final TextEditingController _postalCode = TextEditingController(
    text: widget.address?.postalCode ?? '',
  );
  late final TextEditingController _pin = TextEditingController(
    text: widget.address?.hasCoordinates ?? false
        ? MapPin(
            latitude: widget.address!.latitude!,
            longitude: widget.address!.longitude!,
          ).display
        : '',
  );

  /// Disabled. See the header — the contract has nowhere to put it.
  final TextEditingController _driverPhone = TextEditingController();

  Country? _country;
  late bool _isDefault = widget.address?.isDefault ?? false;

  AsyncValue<void> _submission = const AsyncValue<void>.data(null);
  String? _failedEndpoint;

  /// Per-field messages from a `validation_failed`, keyed by the dotted path
  /// the server built from Zod: `line1`, `city`, `latitude`.
  Map<String, List<String>> _fieldErrors = const <String, List<String>>{};

  bool get _isNew => widget.address == null;
  bool get _busy => _submission.isLoading;

  @override
  void initState() {
    super.initState();
    _country = widget.address?.country;
    _label.addListener(_rebuild);
    _line1.addListener(_rebuild);
    _city.addListener(_rebuild);
    _pin.addListener(_rebuild);
  }

  void _rebuild() => setState(() {});

  @override
  void dispose() {
    _label.removeListener(_rebuild);
    _line1.removeListener(_rebuild);
    _city.removeListener(_rebuild);
    _pin.removeListener(_rebuild);
    _label.dispose();
    _landmark.dispose();
    _line1.dispose();
    _city.dispose();
    _postalCode.dispose();
    _pin.dispose();
    _driverPhone.dispose();
    super.dispose();
  }

  Country get _resolvedCountry =>
      _country ?? ref.watch(resolvedPreferencesProvider).market.country;

  MapPin? get _parsedPin => MapPin.tryParse(_pin.text);

  /// A pin that was typed but could not be read. Distinct from "no pin".
  bool get _pinUnparseable => _pin.text.trim().isNotEmpty && _parsedPin == null;

  /// The contract requires `label`, `line1`, `city` and `country`.
  ///
  /// Note what is NOT required: the postcode, and the pin. The pin is the most
  /// useful thing on this form and it is still optional, because someone
  /// standing in a basement with no signal must still be able to save an
  /// address.
  bool get _canSave =>
      !_busy &&
      _label.text.trim().isNotEmpty &&
      _line1.text.trim().isNotEmpty &&
      _city.text.trim().isNotEmpty &&
      !_pinUnparseable;

  Future<void> _save() async {
    if (!_canSave) return;
    FocusScope.of(context).unfocus();
    final MapPin? pin = _parsedPin;

    setState(() {
      _submission = const AsyncValue<void>.loading();
      _failedEndpoint =
          _isNew ? 'POST /v1/addresses' : 'PATCH /v1/addresses/{id}';
      _fieldErrors = const <String, List<String>>{};
    });

    try {
      final AddressBook book = ref.read(addressBookProvider);
      if (_isNew) {
        await book.create(
          CreateAddressRequest(
            label: _label.text.trim(),
            line1: _line1.text.trim(),
            // THE LANDMARK LIVES IN line2. The contract has no `landmark`
            // field and `line2` is its only free-text slot, so this is where
            // it goes — round-tripped back into the same field on edit, so
            // nothing is lost or duplicated.
            line2: _landmark.text.trim(),
            city: _city.text.trim(),
            country: _resolvedCountry,
            postalCode: _postalCode.text.trim(),
            latitude: pin?.latitude,
            longitude: pin?.longitude,
            isDefault: _isDefault,
          ),
        );
      } else {
        await book.update(
          widget.address!.id,
          UpdateAddressRequest(
            label: Patch<String>.set(_label.text.trim()),
            line1: Patch<String>.set(_line1.text.trim()),
            // `line2`, `postalCode`, `latitude` and `longitude` are nullable in
            // the contract, so emptying one is `Patch.clear()` — an explicit
            // null — and not an omission. Omitting would leave the old value in
            // place, which is how a deleted landmark comes back.
            line2: _landmark.text.trim().isEmpty
                ? const Patch<String>.clear()
                : Patch<String>.set(_landmark.text.trim()),
            city: Patch<String>.set(_city.text.trim()),
            country: Patch<Country>.set(_resolvedCountry),
            postalCode: _postalCode.text.trim().isEmpty
                ? const Patch<String>.clear()
                : Patch<String>.set(_postalCode.text.trim()),
            latitude: pin == null
                ? const Patch<double>.clear()
                : Patch<double>.set(pin.latitude),
            longitude: pin == null
                ? const Patch<double>.clear()
                : Patch<double>.set(pin.longitude),
            isDefault: Patch<bool>.set(_isDefault),
          ),
        );
      }
      if (!mounted) return;
      setState(() => _submission = const AsyncValue<void>.data(null));
      final VoidCallback? handler = widget.onSaved;
      if (handler != null) {
        handler();
      } else if (Navigator.of(context).canPop()) {
        Navigator.of(context).pop();
      }
    } on ApiFailure catch (failure, stack) {
      if (!mounted) return;
      setState(() {
        if (failure is ValidationFailure) {
          // Per-field, under the field it belongs to. A validation error shown
          // as one banner makes the user hunt for which of nine inputs is
          // wrong.
          _fieldErrors = failure.fieldErrors;
          _submission = const AsyncValue<void>.data(null);
        } else {
          _submission = AsyncValue<void>.error(failure, stack);
        }
      });
    }
  }

  String? _errorFor(String path) {
    final List<String>? messages = _fieldErrors[path];
    return messages == null || messages.isEmpty ? null : messages.first;
  }

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final MapPin? pin = _parsedPin;

    return AccountScaffold(
      title: _isNew ? 'Add an address' : 'Edit address',
      bottomBar: KeyButton(
        key: const ValueKey<String>('address-save'),
        label: _isNew ? 'Save this address' : 'Save changes',
        size: KeyButtonSize.large,
        expand: true,
        busy: _busy,
        onPressed: _canSave ? _save : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          // ── 1. What to call it ───────────────────────────────────────────
          const AccountFieldLabel(
            label: 'Name this address',
            hint: 'Home, Office, Warehouse — whatever you will recognise.',
          ),
          _Field(
            fieldKey: const ValueKey<String>('address-label'),
            controller: _label,
            hint: 'Home',
            errorText: _errorFor('label'),
          ),
          SizedBox(height: t.spaceStack),

          // ── 2. THE PIN. First, because it is what finds the door. ────────
          const AccountFieldLabel(
            label: 'Map pin',
            hint: 'Paste a Google Maps or Apple Maps link, or type '
                '"25.204849, 55.270783". This is the single most useful thing '
                'on this form.',
          ),
          _Field(
            fieldKey: const ValueKey<String>('address-pin'),
            controller: _pin,
            hint: 'https://maps.app.goo.gl/…',
            // A URL and a coordinate pair are both machine-readable tokens.
            forceLtr: true,
            errorText: _pinUnparseable
                ? 'We could not find coordinates in that. Paste the whole link, '
                    'or type the two numbers separated by a comma.'
                : _errorFor('latitude') ?? _errorFor('longitude'),
            suffix: pin == null
                ? null
                : Icon(LucideIcons.circleCheck, color: t.successInk, size: 18),
          ),
          if (pin != null) ...<Widget>[
            _PinReadback(pin: pin),
            SizedBox(height: t.spaceStack),
          ] else
            SizedBox(height: t.spaceStack),

          // ── 3. THE LANDMARK. Second, and the one a driver reads out. ─────
          const AccountFieldLabel(
            label: 'Landmark and directions',
            hint: 'How would you tell a driver on the phone? '
                '"Villa 12, behind ADNOC, near the mosque."',
          ),
          _Field(
            fieldKey: const ValueKey<String>('address-landmark'),
            controller: _landmark,
            hint: 'Villa 12, behind ADNOC, near the mosque',
            maxLines: 3,
            errorText: _errorFor('line2'),
          ),
          SizedBox(height: t.spaceStack),

          // ── 4. The driver's number. NOWHERE TO PUT IT. ───────────────────
          const AccountFieldLabel(
            label: 'Number for the driver',
            hint: 'The person who will actually open the door.',
          ),
          _Field(
            fieldKey: const ValueKey<String>('address-driver-phone'),
            controller: _driverPhone,
            hint: '+971 50 123 4567',
            forceLtr: true,
            // DISABLED ON PURPOSE. `Address` has no contact-phone field, so a
            // number typed here would be dropped between this screen and the
            // request body without a word. Shown-and-explained beats
            // silently-discarded.
            enabled: false,
          ),
          Padding(
            padding: EdgeInsetsDirectional.only(bottom: t.spaceStack),
            child: Text(
              'Not saved yet: /v1/addresses has no field for a contact number. '
              'Address carries label, line1, line2, city, country, postalCode, '
              'latitude and longitude — nothing else. Until the contract gains '
              'contactPhone, put the number in the landmark line above.',
              key: const ValueKey<String>('address-driver-phone-reason'),
              style: type.meta.copyWith(color: t.warningInk),
            ),
          ),

          // ── 5. The conventional lines, which still have to exist. ────────
          const AccountFieldLabel(
            label: 'Building, street or community',
            hint: 'Required by the address record.',
          ),
          _Field(
            fieldKey: const ValueKey<String>('address-line1'),
            controller: _line1,
            hint: 'Al Barsha 1, Street 12',
            errorText: _errorFor('line1'),
          ),
          SizedBox(height: t.spaceStack),

          const AccountFieldLabel(label: 'City'),
          _Field(
            fieldKey: const ValueKey<String>('address-city'),
            controller: _city,
            hint: 'Dubai',
            errorText: _errorFor('city'),
          ),
          SizedBox(height: t.spaceStack),

          const AccountFieldLabel(label: 'Country'),
          _CountryRow(
            country: _resolvedCountry,
            enabled: !_busy,
            onChanged: (Country country) => setState(() => _country = country),
          ),
          SizedBox(height: t.spaceStack),

          // ── 6. The postcode, last and never enforced. ────────────────────
          const AccountFieldLabel(
            label: 'Postal code (optional)',
            hint: 'Most GCC couriers ignore this. Leave it blank if you do not '
                'have one — nothing here checks it.',
          ),
          _Field(
            fieldKey: const ValueKey<String>('address-postal'),
            controller: _postalCode,
            hint: '',
            forceLtr: true,
            // NO validator, no format, no length rule, and it is not part of
            // `_canSave`. This is deliberate and load-bearing.
            errorText: _errorFor('postalCode'),
          ),
          SizedBox(height: t.spaceStack),

          SwitchListTile.adaptive(
            key: const ValueKey<String>('address-default'),
            value: _isDefault,
            onChanged: _busy
                ? null
                : (bool value) => setState(() => _isDefault = value),
            title: const Text('Use this as my default address'),
            contentPadding: EdgeInsetsDirectional.zero,
          ),

          if (_submission.hasError) ...<Widget>[
            SizedBox(height: t.spaceStack),
            FailureNotice(
              key: const ValueKey<String>('address-failure'),
              failure: _asFailure(_submission.error),
              endpoint: _failedEndpoint,
              onRetry: _save,
            ),
          ],
        ],
      ),
    );
  }

  static ApiFailure _asFailure(Object? error) => error is ApiFailure
      ? error
      : const ApiFailure.unexpected(message: 'Something went wrong.');
}

/// The parsed pin, read back so the person can see what was understood.
class _PinReadback extends StatelessWidget {
  const _PinReadback({required this.pin});

  final MapPin pin;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    return Padding(
      padding: EdgeInsetsDirectional.only(top: t.spaceTight),
      child: MeridianSurface(
        rung: MeridianRung.recessed,
        padding: EdgeInsetsDirectional.all(t.spaceTight),
        child: Column(
          key: const ValueKey<String>('address-pin-readback'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Icon(LucideIcons.mapPin, size: 14, color: t.successInk),
                SizedBox(width: t.spaceTight),
                Expanded(
                  child: DirectionalText.token(
                    pin.display,
                    kind: LtrToken.reference,
                    style: type.meta.copyWith(color: t.ink2),
                  ),
                ),
              ],
            ),
            if (!pin.isPlausiblyGcc) ...<Widget>[
              SizedBox(height: t.spaceUnit),
              Text(
                'That pin is outside the Gulf. Check the two numbers are not '
                'the wrong way round — a longitude-first pair is a common '
                'copy-paste mistake. We will still save it if it is right.',
                style: type.micro.copyWith(color: t.warningInk),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// A plain text input with the feature's house rules already applied.
class _Field extends StatelessWidget {
  const _Field({
    required this.fieldKey,
    required this.controller,
    required this.hint,
    this.errorText,
    this.maxLines = 1,
    this.enabled = true,
    this.forceLtr = false,
    this.suffix,
  });

  final Key fieldKey;
  final TextEditingController controller;
  final String hint;
  final String? errorText;
  final int maxLines;
  final bool enabled;

  /// For a token that must not be reordered by the bidi algorithm: a URL, a
  /// coordinate pair, a phone number, a postcode.
  final bool forceLtr;

  final Widget? suffix;

  @override
  Widget build(BuildContext context) {
    final MeridianTypography type = context.type;
    return TextField(
      key: fieldKey,
      controller: controller,
      enabled: enabled,
      maxLines: maxLines,
      style: type.body,
      textDirection: forceLtr ? TextDirection.ltr : null,
      textAlign: TextAlign.start,
      textInputAction:
          maxLines > 1 ? TextInputAction.newline : TextInputAction.next,
      decoration: InputDecoration(
        hintText: hint.isEmpty ? null : hint,
        errorText: errorText,
        errorMaxLines: 3,
        suffixIcon: suffix,
        constraints: const BoxConstraints(minHeight: kMinTouchTarget),
      ),
    );
  }
}

/// The country, as a tappable row that opens the market sheet.
class _CountryRow extends StatelessWidget {
  const _CountryRow({
    required this.country,
    required this.enabled,
    required this.onChanged,
  });

  final Country country;
  final bool enabled;
  final ValueChanged<Country> onChanged;

  @override
  Widget build(BuildContext context) {
    final GccMarket market = GccMarket.forCountry(country);
    final MeridianTokens t = context.tokens;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: t.surfaceSunken,
        borderRadius: BorderRadius.circular(t.radiusSm),
        border: Border.all(color: t.border),
      ),
      child: AccountRow(
        key: const ValueKey<String>('address-country'),
        title: market.nameEn,
        subtitle: market.country.code,
        subtitleToken: LtrToken.reference,
        onTap: enabled
            ? () async {
                final GccMarket? chosen = await pickMarket(
                  context: context,
                  current: market,
                );
                if (chosen != null) onChanged(chosen.country);
              }
            : null,
        disabledReason: null,
      ),
    );
  }
}
