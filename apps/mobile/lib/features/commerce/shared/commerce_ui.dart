import 'package:flutter/material.dart';

import '../../../api/models/enums.dart';
import '../../../api/models/money.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../theme/elevation.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';

/// The smallest thing a finger may be asked to hit.
///
/// 48dp is the floor, not the target. A 44dp stepper looks tidy in a mockup
/// and is missed by a thumb on a moving bus, which in a cart means the buyer
/// hits `-` when they meant `+` and does not notice until the order arrives.
const double kMinTouchTarget = 48.0;

/// The semantic tones this feature paints with.
///
/// Six, and no seventh. The order-status map in `order_status_pill.dart`
/// deliberately puts four different statuses on [accent] and separates them by
/// icon: inventing a fifth hue to distinguish "confirmed" from "shipped" would
/// mean the colour no longer says anything, because everything would have its
/// own.
enum CommerceTone { neutral, info, accent, success, warning, danger }

/// The fill / ink / rule triple for a tone, straight from the tokens.
@immutable
class ToneColours {
  const ToneColours({required this.fill, required this.ink, required this.rule});

  final Color fill;
  final Color ink;
  final Color rule;

  factory ToneColours.of(MeridianTokens t, CommerceTone tone) {
    switch (tone) {
      case CommerceTone.neutral:
        return ToneColours(
          fill: t.neutralSoft,
          ink: t.neutralInk,
          rule: t.neutralRule,
        );
      case CommerceTone.info:
        return ToneColours(
          fill: t.primarySoft,
          ink: t.primaryInk,
          rule: t.primaryEdge,
        );
      case CommerceTone.accent:
        // There is no `accentRule` token; the key edge is the darker cut of
        // the same material and is what a rule on this fill should be.
        return ToneColours(
          fill: t.accentSoft,
          ink: t.accentInk,
          rule: t.accentEdge,
        );
      case CommerceTone.success:
        return ToneColours(
          fill: t.successSoft,
          ink: t.successInk,
          rule: t.successRule,
        );
      case CommerceTone.warning:
        return ToneColours(
          fill: t.warningSoft,
          ink: t.warningInk,
          rule: t.warningRule,
        );
      case CommerceTone.danger:
        return ToneColours(
          fill: t.dangerSoft,
          ink: t.dangerInk,
          rule: t.dangerRule,
        );
    }
  }
}

/// A money figure, rendered the way the model formats it and forced
/// left-to-right.
///
/// TWO RULES, both load-bearing.
///
/// 1. The digits come from [Money.format], which never leaves `BigInt`. Not
///    `toStringAsFixed`, which needs a `double` and would put a rounded copy
///    of an exact figure on screen — and not the currency's decimal count
///    guessed at the call site, which is how a KWD total loses a factor of ten
///    in its last place.
///
/// 2. The whole run is wrapped in a left-to-right isolate. "1,234.500 KWD"
///    embedded in an Arabic paragraph is a string of weak-direction digits
///    followed by a strong LTR code, and a leading `-` on a discount is
///    neutral — exactly the case `Bidi.ltr` exists for. Without it a negative
///    figure renders its sign on the wrong end.
class MoneyText extends StatelessWidget {
  const MoneyText(
    this.money, {
    this.style,
    this.withCode = true,
    this.textAlign,
    super.key,
  });

  final Money money;
  final TextStyle? style;
  final bool withCode;
  final TextAlign? textAlign;

  /// The exact string this widget renders, isolate marks and all. Exposed so a
  /// test can assert a total came out of the quote untouched.
  String resolve() => Bidi.ltr(money.format(withCode: withCode));

  @override
  Widget build(BuildContext context) {
    return Text(
      resolve(),
      style: style,
      textAlign: textAlign,
      // No maxLines and no ellipsis, ever. A truncated total is a wrong total.
      softWrap: true,
    );
  }
}

/// A label on one side and a figure on the other — until they do not fit.
///
/// At 200% dynamic type a `Row` with two `Text`s either overflows or ellipses,
/// and on a totals panel the thing that gets ellipsed is the number. `Wrap`
/// puts the figure on its own line instead, which is longer but still says
/// what the buyer will pay.
class MoneyRow extends StatelessWidget {
  const MoneyRow({
    required this.label,
    required this.value,
    this.emphasis = false,
    this.absentNote,
    this.tone,
    this.note,
    super.key,
  });

  /// A row whose figure the server never recorded — a null VAT component on a
  /// fetched order. It renders [absentNote], NOT a zero.
  const MoneyRow.absent({
    required this.label,
    required String this.absentNote,
    this.note,
    super.key,
  })  : value = null,
        emphasis = false,
        tone = null;

  final String label;
  final Money? value;
  final bool emphasis;
  final String? absentNote;
  final CommerceTone? tone;

  /// A short caption under the row — where a figure gets qualified rather than
  /// silently changed.
  final String? note;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final Color ink = tone == null
        ? (emphasis ? t.ink1 : t.ink2)
        : ToneColours.of(t, tone!).ink;
    final TextStyle labelStyle = (emphasis ? type.ui : type.body).copyWith(
      color: emphasis ? t.ink1 : t.ink2,
    );
    final TextStyle valueStyle = (emphasis ? type.figCard : type.body).copyWith(
      color: ink,
    );
    final Money? money = value;

    return Padding(
      padding: EdgeInsetsDirectional.symmetric(vertical: t.spaceUnit),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: t.spaceStack,
            runSpacing: t.spaceUnit,
            children: <Widget>[
              ConstrainedBox(
                constraints: BoxConstraints(maxWidth: t.measureDesc),
                child: Text(label, style: labelStyle),
              ),
              if (money != null)
                MoneyText(money, style: valueStyle)
              else
                Text(
                  absentNote ?? '—',
                  style: type.meta.copyWith(color: t.ink3),
                ),
            ],
          ),
          if (note != null)
            Padding(
              padding: EdgeInsetsDirectional.only(top: t.spaceUnit),
              child: Text(note!, style: type.meta.copyWith(color: t.ink3)),
            ),
        ],
      ),
    );
  }
}

/// A [KeyButton] that is safe to put next to something else.
///
/// KeyButton's assembly is a `Stack` whose children are ALL positioned — the
/// solid edge under the face, and the face itself. A `RenderStack` with no
/// non-positioned child sizes to `constraints.biggest`, so a key button:
///
///   * ASSERTS in an unbounded width — inside a `Row`, a `Wrap`, or any other
///     parent that hands its children infinite main-axis constraints; and
///   * fills whatever width it is given otherwise, `expand: false`
///     notwithstanding.
///
/// `IntrinsicWidth` cannot rescue it either: the same all-positioned stack
/// reports an intrinsic width of zero, so the button would vanish. Until
/// `lib/core/ui/key_button.dart` measures its face — which is not this
/// feature's file to change — an inline action needs a bounded box, and this
/// is that box in one place rather than a magic number at six call sites.
class InlineKeyAction extends StatelessWidget {
  const InlineKeyAction({required this.child, this.maxWidth = 240, super.key});

  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: child,
      ),
    );
  }
}

/// A stated condition: a reason, a warning, a limit. Never decoration.
class CommerceNotice extends StatelessWidget {
  const CommerceNotice({
    required this.tone,
    required this.title,
    this.body,
    this.icon,
    this.action,
    this.actions,
    super.key,
  });

  final CommerceTone tone;
  final String title;
  final String? body;
  final IconData? icon;

  /// One way out of the condition this notice describes.
  final Widget? action;

  /// Several ways out — a quote-only line can be removed OR quoted, and
  /// picking one for the buyer is what makes a cart feel like it is arguing.
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final ToneColours c = ToneColours.of(t, tone);

    return Semantics(
      container: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: c.fill,
          borderRadius: BorderRadius.circular(t.radius),
          border: Border.all(color: c.rule),
        ),
        child: Padding(
          padding: EdgeInsetsDirectional.all(t.spaceStack),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              if (icon != null) ...<Widget>[
                Icon(icon, size: type.ui.fontSize! + 4, color: c.ink),
                SizedBox(width: t.spaceTight),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(title, style: type.ui.copyWith(color: c.ink)),
                    if (body != null) ...<Widget>[
                      SizedBox(height: t.spaceUnit),
                      Text(body!, style: type.meta.copyWith(color: t.ink2)),
                    ],
                    if (action != null) ...<Widget>[
                      SizedBox(height: t.spaceTight),
                      InlineKeyAction(child: action!),
                    ],
                    if (actions != null)
                      for (final Widget item in actions!) ...<Widget>[
                        SizedBox(height: t.spaceTight),
                        InlineKeyAction(child: item),
                      ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A titled card. The unit every commerce screen is assembled from.
class SectionPanel extends StatelessWidget {
  const SectionPanel({
    required this.child,
    this.title,
    this.trailing,
    this.rung = MeridianRung.card,
    super.key,
  });

  final Widget child;
  final String? title;
  final Widget? trailing;
  final MeridianRung rung;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return MeridianSurface(
      rung: rung,
      padding: EdgeInsetsDirectional.all(t.spaceStack),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          if (title != null) ...<Widget>[
            Row(
              children: <Widget>[
                Expanded(child: Text(title!, style: type.h3)),
                if (trailing != null) trailing!,
              ],
            ),
            SizedBox(height: t.spaceTight),
          ],
          child,
        ],
      ),
    );
  }
}

/// A key/value line of plain text — payment method, address, carrier.
class DetailRow extends StatelessWidget {
  const DetailRow({
    required this.label,
    required this.value,
    this.valueToken,
    super.key,
  });

  final String label;
  final String value;

  /// Set when [value] is machine-readable — an order number, a tracking
  /// number, a SKU — so it is bidi-isolated rather than scrambled inside an
  /// Arabic paragraph.
  final LtrToken? valueToken;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final LtrToken? token = valueToken;

    return Padding(
      padding: EdgeInsetsDirectional.symmetric(vertical: t.spaceUnit),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: t.spaceStack,
        runSpacing: t.spaceUnit,
        children: <Widget>[
          Text(label, style: type.body.copyWith(color: t.ink2)),
          if (token != null)
            DirectionalText.token(
              value,
              kind: token,
              style: type.ui.copyWith(color: t.ink1),
            )
          else
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: t.measureDesc),
              child: Text(value, style: type.ui.copyWith(color: t.ink1)),
            ),
        ],
      ),
    );
  }
}

/// The content language, from the ambient locale.
///
/// Every model on this surface carries `nameEn` and `nameAr` side by side and
/// picks between them with a [Language], so one helper does it for the whole
/// feature rather than five call sites each deciding what a missing locale
/// means.
Language languageOf(BuildContext context) =>
    Localizations.maybeLocaleOf(context)?.languageCode == 'ar'
        ? Language.ar
        : Language.en;

/// Pull-to-refresh that works in ALL FOUR states, not just when there is data.
///
/// The usual shape — a `RefreshIndicator` wrapped around a `ListView` — stops
/// working exactly when it is most needed: the empty state and the error state
/// are not scrollables, so the gesture does nothing and the user is stranded
/// on a screen with no way to retry but killing the app. Putting the whole
/// state view inside one always-scrollable viewport that is at least as tall
/// as the screen means the pull works over an empty list, over an error, and
/// over a skeleton.
class PullToRefresh extends StatelessWidget {
  const PullToRefresh({
    required this.onRefresh,
    required this.child,
    super.key,
  });

  final Future<void> Function() onRefresh;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: LayoutBuilder(
        builder: (BuildContext context, BoxConstraints constraints) {
          return SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: child,
            ),
          );
        },
      ),
    );
  }
}
