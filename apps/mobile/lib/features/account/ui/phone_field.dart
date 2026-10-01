import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/enums.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../data/gcc_market.dart';
import 'account_chrome.dart';

/// A phone input with the market's dial code already in it.
///
/// The dial code is a BUTTON, not decoration. Someone with a Saudi number
/// standing in Dubai must be able to change it in one tap, and someone with an
/// Emirati number must never have to touch it.
///
/// The number itself is laid out left-to-right in both locales and wrapped in
/// an LTR isolate wherever it is shown back. A phone number reordered by the
/// bidi algorithm is a different phone number, and nothing on screen looks
/// wrong when it happens.
class PhoneField extends StatelessWidget {
  const PhoneField({
    required this.controller,
    required this.market,
    required this.onMarketChanged,
    this.focusNode,
    this.enabled = true,
    this.errorText,
    this.onSubmitted,
    super.key,
  });

  final TextEditingController controller;
  final GccMarket market;
  final ValueChanged<GccMarket> onMarketChanged;
  final FocusNode? focusNode;
  final bool enabled;
  final String? errorText;
  final ValueChanged<String>? onSubmitted;

  /// What the field will accept a keystroke for.
  ///
  /// Arabic-Indic (٠-٩) and Persian (۰-۹) digits are allowed IN, and
  /// [PhoneNumber.parse] folds them to ASCII on the way out. Rejecting them at
  /// the keyboard would mean an Arabic keyboard cannot type a phone number.
  static final RegExp _typeableChars = RegExp(r'[0-9٠-٩۰-۹ \-()]');

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            _DialCodeButton(
              market: market,
              enabled: enabled,
              onTap: () async {
                final GccMarket? chosen = await pickMarket(
                  context: context,
                  current: market,
                );
                if (chosen != null) onMarketChanged(chosen);
              },
            ),
            SizedBox(width: t.spaceTight),
            Expanded(
              child: TextField(
                controller: controller,
                focusNode: focusNode,
                enabled: enabled,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.done,
                onSubmitted: onSubmitted,
                // The number reads left-to-right in Arabic too. Letting the
                // paragraph direction take it reorders the groups on screen.
                textDirection: TextDirection.ltr,
                textAlign: TextAlign.start,
                style: type.body,
                autofillHints: enabled
                    ? const <String>[AutofillHints.telephoneNumberNational]
                    : null,
                inputFormatters: <TextInputFormatter>[
                  // Digits and separators only. The country code lives in the
                  // button, so a `+` typed here would be parsed as a second one.
                  FilteringTextInputFormatter.allow(_typeableChars),
                  LengthLimitingTextInputFormatter(18),
                ],
                decoration: InputDecoration(
                  hintText: _hintFor(market),
                  errorText: errorText,
                  // Errors get their own line below rather than a floating
                  // label, so the field does not resize under the thumb at
                  // large text sizes.
                  helperText: ' ',
                  constraints: const BoxConstraints(
                    minHeight: kMinTouchTarget,
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  /// A number in the local grouping, so the shape of what to type is obvious
  /// without a paragraph of instructions.
  static String _hintFor(GccMarket market) => switch (market) {
        GccMarket.ae || GccMarket.sa => '50 123 4567',
        GccMarket.qa ||
        GccMarket.kw ||
        GccMarket.om ||
        GccMarket.bh =>
          '3312 3456',
      };
}

class _DialCodeButton extends StatelessWidget {
  const _DialCodeButton({
    required this.market,
    required this.enabled,
    required this.onTap,
  });

  final GccMarket market;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return Semantics(
      button: true,
      enabled: enabled,
      label: 'Country code ${market.displayDialCode}, ${market.nameEn}',
      hint: 'Change country',
      onTap: enabled ? onTap : null,
      // The label above is the whole announcement. Without this the isolate
      // marks around the dial code are read out as stray characters.
      excludeSemantics: true,
      child: ConstrainedBox(
        constraints: const BoxConstraints(
          minHeight: kMinTouchTarget,
          minWidth: kMinTouchTarget + 32,
        ),
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            onTap: enabled ? onTap : null,
            splashFactory: NoSplash.splashFactory,
            borderRadius: BorderRadius.circular(t.radiusSm),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: t.surfaceSunken,
                borderRadius: BorderRadius.circular(t.radiusSm),
                border: Border.all(color: t.border),
              ),
              child: Padding(
                padding: EdgeInsetsDirectional.symmetric(
                  horizontal: t.spaceTight + t.spaceUnit,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: <Widget>[
                    DirectionalText.token(
                      market.displayDialCode,
                      kind: LtrToken.phone,
                      style: type.body.copyWith(
                        color: enabled ? t.ink1 : t.ink3,
                      ),
                    ),
                    SizedBox(width: t.spaceUnit),
                    Icon(
                      LucideIcons.chevronDown,
                      size: 16,
                      color: enabled ? t.ink2 : t.ink3,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The market sheet. Six rows, each at least 48dp, dial code and name.
Future<GccMarket?> pickMarket({
  required BuildContext context,
  required GccMarket current,
  Language language = Language.en,
}) =>
    showAccountSheet<GccMarket>(
      context: context,
      title: 'Where are you shopping from?',
      children: (BuildContext sheetContext) => <Widget>[
        for (final GccMarket market in GccMarket.values)
          AccountRow(
            key: ValueKey<String>('market-${market.country.code}'),
            title: market.displayName(language),
            subtitle: '${market.displayDialCode}  ·  ${market.currency.code}',
            subtitleToken: LtrToken.phone,
            showChevron: false,
            trailing: market == current
                ? Icon(
                    LucideIcons.check,
                    size: 18,
                    color: sheetContext.tokens.primaryInk,
                  )
                : null,
            onTap: () => Navigator.of(sheetContext).pop(market),
          ),
      ],
    );
