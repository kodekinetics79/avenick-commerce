import 'package:flutter/material.dart';

import '../../../api/models/enums.dart';
import '../../../api/models/money.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../theme/elevation.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';

/// THE SMALL PIECES THE THREE QUOTE SCREENS ARE ASSEMBLED FROM.
///
/// Deliberately this feature's own, rather than an import from
/// `lib/features/commerce/shared/commerce_ui.dart`, for the same reason the
/// catalogue keeps its own `languageOf` and its own touch-target constant: a
/// feature that reaches into another feature's tree couples the app's primary
/// funnel to a file its owner is free to rename. The three things that MUST
/// not be duplicated — the money formatting, the bidi isolation and the design
/// tokens — are not duplicated here: [QuoteMoney] delegates to `Money.format`
/// and `Bidi.ltr` in `lib/api` and `lib/core`, and every colour comes from
/// `context.tokens`.
///
/// If a third feature needs these, they belong in `lib/core/ui/` — which is not
/// this engineer's file to create. Flagged in the report.

/// The smallest thing a finger may be asked to hit.
///
/// 48dp is the accessibility floor, not a design preference. Note that `rowH`
/// (44) and `controlHLg` (46) are both below it, so anything built from those
/// needs padding out to here.
const double kMinTouchTarget = 48.0;

/// Above this text scale a two-button row becomes a two-button column.
///
/// At 200% dynamic type "Accept this quote" and "Decline" cannot share a
/// phone's width, and the failure mode of trying is an ellipsised verb on the
/// most consequential control in the app.
const double kStackActionsTextScale = 1.3;

/// The semantic tones this feature paints with.
///
/// The same six the commerce feature uses, and for the same reason there are
/// not seven: the status map puts several statuses on one hue and separates
/// them by icon, because a colour that is unique per status says only "this is
/// a status", which the shape already said.
enum RfqTone { neutral, info, accent, success, warning, danger }

/// The fill / ink / rule triple for a tone, straight from the tokens.
@immutable
class RfqToneColours {
  const RfqToneColours({
    required this.fill,
    required this.ink,
    required this.rule,
  });

  factory RfqToneColours.of(MeridianTokens t, RfqTone tone) {
    switch (tone) {
      case RfqTone.neutral:
        return RfqToneColours(
          fill: t.neutralSoft,
          ink: t.neutralInk,
          rule: t.neutralRule,
        );
      case RfqTone.info:
        return RfqToneColours(
          fill: t.primarySoft,
          ink: t.primaryInk,
          rule: t.primaryEdge,
        );
      case RfqTone.accent:
        // There is no `accentRule` token; the key edge is the darker cut of
        // the same material and is what a rule on this fill should be.
        return RfqToneColours(
          fill: t.accentSoft,
          ink: t.accentInk,
          rule: t.accentEdge,
        );
      case RfqTone.success:
        return RfqToneColours(
          fill: t.successSoft,
          ink: t.successInk,
          rule: t.successRule,
        );
      case RfqTone.warning:
        return RfqToneColours(
          fill: t.warningSoft,
          ink: t.warningInk,
          rule: t.warningRule,
        );
      case RfqTone.danger:
        return RfqToneColours(
          fill: t.dangerSoft,
          ink: t.dangerInk,
          rule: t.dangerRule,
        );
    }
  }

  final Color fill;
  final Color ink;
  final Color rule;
}

/// A money figure, rendered the way the model formats it and forced LTR.
///
/// TWO RULES, both load-bearing on a screen whose whole job is a price.
///
/// 1. The digits come from [Money.format], which never leaves `BigInt`. Not
///    `toStringAsFixed`, which needs a `double` and would put a rounded copy of
///    an exact figure on screen; and not a decimal count guessed at the call
///    site, which is how a KWD total loses a factor of ten in its last place.
///    **Nothing in this feature computes a money value.** Every figure drawn is
///    one the server sent.
///
/// 2. The whole run is wrapped in a left-to-right isolate. "12,450.000 KWD"
///    inside an Arabic paragraph is weak-direction digits followed by a strong
///    LTR code, which the bidi algorithm will reorder without one.
class QuoteMoney extends StatelessWidget {
  const QuoteMoney(
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
  /// test can assert a total came off the wire untouched.
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

/// A titled card. The unit every quote screen is assembled from.
class QuotePanel extends StatelessWidget {
  const QuotePanel({
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

/// A stated condition: a reason, a limit, a warning. Never decoration.
class QuoteNotice extends StatelessWidget {
  const QuoteNotice({
    required this.tone,
    required this.title,
    this.body,
    this.icon,
    this.actions = const <Widget>[],
    super.key,
  });

  final RfqTone tone;
  final String title;
  final String? body;
  final IconData? icon;

  /// Ways out of the condition this notice describes. Several, because a
  /// stale quote can be re-confirmed OR abandoned and choosing for the buyer
  /// is what makes a screen feel like it is arguing.
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final RfqToneColours c = RfqToneColours.of(t, tone);

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
                    for (final Widget action in actions) ...<Widget>[
                      SizedBox(height: t.spaceTight),
                      action,
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

/// A label on one side and a value on the other — until they do not fit.
///
/// At 200% dynamic type a `Row` of two `Text`s either overflows or ellipses,
/// and on a quote the thing that gets ellipsed is the number. `Wrap` puts the
/// value on its own line instead: longer, but still true.
class QuoteRow extends StatelessWidget {
  const QuoteRow({
    required this.label,
    required this.value,
    this.valueToken,
    this.emphasis = false,
    super.key,
  }) : money = null;

  /// A row whose value is a money figure, rendered through [QuoteMoney].
  const QuoteRow.money({
    required this.label,
    required Money this.money,
    this.emphasis = false,
    super.key,
  })  : value = null,
        valueToken = null;

  final String label;
  final String? value;

  /// Set when [value] is machine-readable — an RFQ number, a SKU — so it is
  /// bidi-isolated rather than scrambled inside an Arabic paragraph.
  final LtrToken? valueToken;

  final bool emphasis;

  /// Non-null only for [QuoteRow.money].
  final Money? money;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final TextStyle labelStyle = (emphasis ? type.ui : type.body).copyWith(
      color: emphasis ? t.ink1 : t.ink2,
    );
    final TextStyle valueStyle = (emphasis ? type.figCard : type.ui).copyWith(
      color: t.ink1,
    );
    final Money? amount = money;
    final LtrToken? token = valueToken;

    return Padding(
      padding: EdgeInsetsDirectional.symmetric(vertical: t.spaceUnit),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: t.spaceStack,
        runSpacing: t.spaceUnit,
        children: <Widget>[
          ConstrainedBox(
            constraints: BoxConstraints(maxWidth: t.measureDesc),
            child: Text(label, style: labelStyle),
          ),
          if (amount != null)
            QuoteMoney(amount, style: valueStyle)
          else if (token != null)
            DirectionalText.token(value!, kind: token, style: valueStyle)
          else
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: t.measureDesc),
              child: Text(value ?? '—', style: valueStyle),
            ),
        ],
      ),
    );
  }
}

/// Pull-to-refresh that works in ALL FOUR states, not just when there is data.
///
/// The usual shape — a `RefreshIndicator` around a `ListView` — stops working
/// exactly when it is most needed: the empty state and the error state are not
/// scrollables, so the gesture does nothing and the buyer is stranded with no
/// way to retry but killing the app. One always-scrollable viewport at least as
/// tall as the screen makes the pull work over an empty list, over an error and
/// over a skeleton.
class RefreshableView extends StatelessWidget {
  const RefreshableView({
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

/// The content language, from the ambient locale.
Language languageOf(BuildContext context) =>
    Localizations.maybeLocaleOf(context)?.languageCode == 'ar'
        ? Language.ar
        : Language.en;

/// Whether the current text scale is large enough that side-by-side actions
/// must become stacked ones.
bool stacksActions(BuildContext context) =>
    MediaQuery.textScalerOf(context).scale(1.0) > kStackActionsTextScale;
