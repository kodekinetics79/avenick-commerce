import 'package:flutter/widgets.dart';

import 'tokens.g.dart';

/// Which script's ramp a text style belongs to.
///
/// This is NOT a cosmetic switch. Arabic is a *separate ramp*, not the Latin
/// ramp with a different family bolted on: the joined baseline and the taller
/// ascender/descender load mean the same nominal size reads smaller and the
/// same leading reads tighter. Body is 16/26 in Arabic against 15/24 in Latin,
/// and every Arabic step carries zero tracking because tracking in a connected
/// script pulls the glyphs off their joins.
enum MeridianScript { latin, arabic }

/// The nine steps of the ramp, named by role rather than by size.
enum MeridianStep {
  /// 11/16/600 — the smallest legible label. Positive tracking; at 11px the
  /// counters close up without it.
  micro,

  /// 12/18/400 — timestamps, secondary metadata.
  meta,

  /// 13/20/500 — control labels, tabs, table headers.
  ui,

  /// 15/24/400 — running text.
  body,

  /// 19/25/600
  h3,

  /// 24/27/600
  h2,

  /// 30/32/600
  h1,

  /// 34/36/600
  display,

  /// 22/26/600 — the price. Its own step because a price is a figure, not a
  /// heading: it needs tabular figures and it must not inherit a heading's
  /// negative tracking wholesale.
  figCard,
}

/// One resolved ramp — the nine steps for one script at one viewport width.
///
/// Built by [MeridianTypography.resolve]. Holds plain [TextStyle]s so it can be
/// dropped straight into a [TextTheme].
@immutable
class MeridianTypography {
  const MeridianTypography({
    required this.script,
    required this.micro,
    required this.meta,
    required this.ui,
    required this.body,
    required this.h3,
    required this.h2,
    required this.h1,
    required this.display,
    required this.figCard,
  });

  final MeridianScript script;
  final TextStyle micro;
  final TextStyle meta;
  final TextStyle ui;
  final TextStyle body;
  final TextStyle h3;
  final TextStyle h2;
  final TextStyle h1;
  final TextStyle display;
  final TextStyle figCard;

  TextStyle step(MeridianStep step) {
    switch (step) {
      case MeridianStep.micro:
        return micro;
      case MeridianStep.meta:
        return meta;
      case MeridianStep.ui:
        return ui;
      case MeridianStep.body:
        return body;
      case MeridianStep.h3:
        return h3;
      case MeridianStep.h2:
        return h2;
      case MeridianStep.h1:
        return h1;
      case MeridianStep.display:
        return display;
      case MeridianStep.figCard:
        return figCard;
    }
  }

  /// Inter's optical-size axis, in the units the font declares (`opsz` is
  /// expressed in points and Inter's range is 14 → 32).
  ///
  /// This is the reason the app ships ONE variable file and not four static
  /// cuts. A static "Inter Display" applied at 13px, or a static "Inter Text"
  /// stretched to 34px, is exactly the defect the ramp exists to avoid: at
  /// small sizes the letterforms need open apertures and loose spacing, at
  /// large sizes they need tight joins and fine hairlines, and a cut chosen
  /// four times cannot track a fluid size that moves continuously between
  /// 390px and 1440px viewports.
  static double opszFor(double fontSizePx) {
    if (fontSizePx <= _opszMin) return _opszMin;
    if (fontSizePx >= _opszMax) return _opszMax;
    return fontSizePx;
  }

  static const double _opszMin = 14.0;
  static const double _opszMax = 32.0;

  /// Build the ramp for [script] from [tokens] at [viewportWidthPx].
  ///
  /// [viewportWidthPx] feeds every [MeridianFluidSize] in the ramp — h3 and up
  /// are `clamp()`s solved for a 390 → 1440px range, so a tablet gets a genuinely
  /// larger heading rather than a phone heading in a wide column.
  static MeridianTypography resolve(
    MeridianTokens tokens, {
    required MeridianScript script,
    required double viewportWidthPx,
    required Color color,
  }) {
    final bool arabic = script == MeridianScript.arabic;
    final String sans = arabic ? tokens.fontSansAr : tokens.fontSans;
    final String display = arabic ? tokens.fontDisplayAr : tokens.fontDisplay;

    // Latin sizes come from the tokens. Arabic sizes are a separate ramp: the
    // tokens carry only the two Arabic FAMILY names, not an Arabic size ramp,
    // so the sizes below are the design panel's Arabic ramp written out here.
    // If globals.css ever grows `--fs-body-ar` and friends, delete these and
    // read them from the tokens.
    final double fsMicro = arabic ? 12.0 : tokens.fsMicro;
    final double lhMicro = arabic ? 18.0 : tokens.lhMicro;
    final double fsMeta = arabic ? 13.0 : tokens.fsMeta;
    final double lhMeta = arabic ? 20.0 : tokens.lhMeta;
    final double fsUi = arabic ? 14.0 : tokens.fsUi;
    final double lhUi = arabic ? 22.0 : tokens.lhUi;
    final double fsBody = arabic ? 16.0 : tokens.fsBody;
    final double lhBody = arabic ? 26.0 : tokens.lhBody;

    // The fluid steps resolve identically in both scripts — the clamp is a
    // viewport response, not a script response — but Arabic adds a point of
    // size and a point of leading on top of the resolved value for the same
    // apparent-size reason as the fixed steps.
    final double arBump = arabic ? 1.0 : 0.0;
    final double fsH3 = tokens.fsH3.resolve(viewportWidthPx) + arBump;
    final double fsH2 = tokens.fsH2.resolve(viewportWidthPx) + arBump;
    final double fsH1 = tokens.fsH1.resolve(viewportWidthPx) + arBump;
    final double fsDisplay = tokens.fsDisplay.resolve(viewportWidthPx) + arBump;

    return MeridianTypography(
      script: script,
      micro: _style(
        family: sans,
        script: script,
        fontSizePx: fsMicro,
        lineHeightPx: lhMicro,
        weight: tokens.fwHead,
        trackingEm: tokens.trMicro,
        color: color,
      ),
      meta: _style(
        family: sans,
        script: script,
        fontSizePx: fsMeta,
        lineHeightPx: lhMeta,
        weight: tokens.fwBody,
        trackingEm: tokens.trMeta,
        color: color,
      ),
      ui: _style(
        family: sans,
        script: script,
        fontSizePx: fsUi,
        lineHeightPx: lhUi,
        weight: tokens.fwUi,
        trackingEm: tokens.trUi,
        color: color,
      ),
      body: _style(
        family: sans,
        script: script,
        fontSizePx: fsBody,
        lineHeightPx: lhBody,
        weight: tokens.fwBody,
        trackingEm: tokens.trBody,
        color: color,
      ),
      // From h3 up the tokens give leading as a unitless ratio, not px.
      h3: _style(
        family: display,
        script: script,
        fontSizePx: fsH3,
        lineHeightPx: fsH3 * tokens.lhH3,
        weight: tokens.fwHead,
        trackingEm: tokens.trH3,
        color: color,
      ),
      h2: _style(
        family: display,
        script: script,
        fontSizePx: fsH2,
        lineHeightPx: fsH2 * tokens.lhH2,
        weight: tokens.fwHead,
        trackingEm: tokens.trH2,
        color: color,
      ),
      h1: _style(
        family: display,
        script: script,
        fontSizePx: fsH1,
        lineHeightPx: fsH1 * tokens.lhH1,
        weight: tokens.fwHead,
        trackingEm: tokens.trH1,
        color: color,
      ),
      display: _style(
        family: display,
        script: script,
        fontSizePx: fsDisplay,
        lineHeightPx: fsDisplay * tokens.lhDisplay,
        weight: tokens.fwHead,
        trackingEm: tokens.trDisplay,
        color: color,
      ),
      figCard: _style(
        family: sans,
        script: script,
        fontSizePx: tokens.fsFigCard,
        lineHeightPx: tokens.lhFigCard,
        weight: tokens.fwFigCard,
        trackingEm: tokens.trFig,
        color: color,
        tabularFigures: true,
      ),
    );
  }

  static TextStyle _style({
    required String family,
    required MeridianScript script,
    required double fontSizePx,
    required double lineHeightPx,
    required double weight,
    required double trackingEm,
    required Color color,
    bool tabularFigures = false,
  }) {
    final bool arabic = script == MeridianScript.arabic;

    // CSS letter-spacing in the tokens is in `em`; Flutter's letterSpacing is
    // in logical pixels. Multiplying by the *resolved* size is what keeps a
    // fluid heading's tracking proportional as it grows.
    //
    // Arabic is zero everywhere, unconditionally. Arabic is a connected script:
    // letterSpacing inserts a gap between glyphs that are meant to be joined,
    // which breaks the kashida and turns a word into a row of orphans. There is
    // no tracking value that is "a little bit" right here.
    final double letterSpacing = arabic ? 0.0 : trackingEm * fontSizePx;

    return TextStyle(
      fontFamily: family,
      fontSize: fontSizePx,
      height: lineHeightPx / fontSizePx,
      letterSpacing: letterSpacing,
      color: color,
      // The weight is carried on the `wght` axis below, but fontWeight must
      // still be set: it is what Flutter uses to pick a face when the variable
      // file is missing and the platform fallback takes over, and it is what
      // accessibility bold-text settings interact with.
      fontWeight: _nearestFontWeight(weight),
      fontVariations: arabic
          // IBM Plex Sans Arabic and Noto Kufi Arabic ship as static cuts —
          // there is no variable release, so there is no axis to drive. Asking
          // for `wght` on a static face is silently ignored; the weight comes
          // from the family/weight pairing declared in pubspec.yaml.
          ? const <FontVariation>[]
          : <FontVariation>[
              FontVariation('opsz', opszFor(fontSizePx)),
              FontVariation('wght', weight),
            ],
      fontFeatures: tabularFigures
          // A price column that is not tabular jitters as digits change, which
          // is the one place in commerce where a column must hold still.
          ? const <FontFeature>[FontFeature.tabularFigures()]
          : null,
      leadingDistribution: TextLeadingDistribution.even,
    );
  }

  /// The nearest of the nine [FontWeight] buckets.
  ///
  /// `fwHero` is 680 in the tokens — a real variable-axis value that has no
  /// [FontWeight] constant. The axis gets the true 680; this rounds only the
  /// fallback.
  static FontWeight _nearestFontWeight(double weight) {
    final int index = ((weight / 100).round() - 1).clamp(0, 8);
    return FontWeight.values[index];
  }
}
