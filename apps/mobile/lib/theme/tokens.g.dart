// GENERATED — DO NOT EDIT.
//
// Produced by @avenick/design-tokens from packages/ui/src/globals.css, which is the single
// source of truth for the Meridian/SIJILL design system across web and mobile.
// Edit the stylesheet and re-run `pnpm --filter @avenick/design-tokens tokens:generate`.
//
//   210 tokens · light + dark
//   18 inset shadow layer(s) dropped — Flutter's BoxShadow cannot paint inside
//   the box, so three of Meridian's four optical events (the highlight seam, the
//   counter-fresnel underside, and the whole of --elev-1 in light) do not survive.
//   `tokens:generate` prints the dropped layers in full on every run — read that
//   list rather than assuming parity with the web.
//
// Colours are stored at full alpha so the system's alpha composition survives:
// CSS `hsl(var(--ink-1) / .06)` is `MeridianTokens.light.ink1.withValues(alpha: 0.06)`.
//
// ignore_for_file: lines_longer_than_80_chars

import 'package:flutter/material.dart';

/// sha256 of packages/ui/src/globals.css at generation time.
///
/// A build step compares this against the live stylesheet: if they differ, this
/// file is stale and the Flutter app is rendering last week's design system.
const String meridianTokensSourceSha256 =
    '66e65093ef58f08727d3ca35bf8501aca7ee91555fc6f47fe47d3ec815771515';

/// A CSS `clamp(min, base + rem + vw, max)` type step, kept whole.
///
/// The fluid ramp in globals.css was computed for a 390 → 1440px viewport range.
/// Collapsing each clamp to its minimum would be right on a phone and wrong on
/// every tablet and unfolded foldable, and `--fs-hero` spans 40px → 92px, so the
/// slope is the difference between a hero and a heading. Both ends survive here
/// and `resolve` does the same arithmetic the browser does.
@immutable
class MeridianFluidSize {
  const MeridianFluidSize({
    required this.minPx,
    required this.maxPx,
    required this.basePx,
    required this.remCoefficient,
    required this.vwCoefficient,
  });

  /// A fixed size expressed as a degenerate fluid one.
  const MeridianFluidSize.fixed(double px)
      : minPx = px,
        maxPx = px,
        basePx = px,
        remCoefficient = 0.0,
        vwCoefficient = 0.0;

  final double minPx;
  final double maxPx;
  final double basePx;
  final double remCoefficient;
  final double vwCoefficient;

  /// [rootFontSizePx] is CSS's `1rem` — 16 on a browser default, which is the
  /// number every clamp in globals.css was solved against. Pass the device's
  /// own text-scale-adjusted value only if you have deliberately decided the
  /// mobile ramp should diverge from the web's.
  double resolve(double viewportWidthPx, {double rootFontSizePx = 16.0}) {
    final double preferred =
        basePx + remCoefficient * rootFontSizePx + vwCoefficient * viewportWidthPx / 100.0;
    if (preferred < minPx) return minPx;
    if (preferred > maxPx) return maxPx;
    return preferred;
  }

  static MeridianFluidSize lerp(MeridianFluidSize a, MeridianFluidSize b, double t) {
    return MeridianFluidSize(
      minPx: a.minPx + (b.minPx - a.minPx) * t,
      maxPx: a.maxPx + (b.maxPx - a.maxPx) * t,
      basePx: a.basePx + (b.basePx - a.basePx) * t,
      remCoefficient: a.remCoefficient + (b.remCoefficient - a.remCoefficient) * t,
      vwCoefficient: a.vwCoefficient + (b.vwCoefficient - a.vwCoefficient) * t,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is MeridianFluidSize &&
        other.minPx == minPx &&
        other.maxPx == maxPx &&
        other.basePx == basePx &&
        other.remCoefficient == remCoefficient &&
        other.vwCoefficient == vwCoefficient;
  }

  @override
  int get hashCode => Object.hash(minPx, maxPx, basePx, remCoefficient, vwCoefficient);

  @override
  String toString() =>
      'MeridianFluidSize(clamp(${minPx}px, ${basePx}px + ${remCoefficient}rem + ${vwCoefficient}vw, ${maxPx}px))';
}

/// CSS `linear()` — a curve given as sample points rather than a closed form.
///
/// Flutter has no equivalent, and the one token that uses it (`--ease-spring`)
/// is a real overshoot sampled at 44 points from bounce ≈ .15. Approximating it
/// with `Curves.elasticOut` would be a different curve wearing its name, so the
/// samples are carried across and interpolated exactly as CSS does.
/// There is deliberately no `assert` on the constructor. Dart cannot evaluate
/// `List.length` inside a const expression, so an assert here makes every
/// `MeridianTokens.light` / `.dark` fail const evaluation — and `dart analyze`
/// over a directory does not report it, so the app analyses clean and then
/// fails in the compiler front-end at build time.
///
/// The invariant is real, so it is enforced where it can actually be checked:
/// the generator validates that stops and values are parallel and that there
/// are at least two samples before emitting this literal. A malformed curve is
/// a failed build of the generator, not a runtime assert nobody reaches.
@immutable
class MeridianSampledCurve extends Curve {
  const MeridianSampledCurve(this.stops, this.values);

  /// Input positions, 0 → 1, non-decreasing.
  final List<double> stops;

  /// Output values at each stop. May exceed 1 — that is what an overshoot is.
  final List<double> values;

  @override
  double transformInternal(double t) {
    if (t <= stops.first) return values.first;
    if (t >= stops.last) return values.last;
    for (int i = 1; i < stops.length; i += 1) {
      if (t <= stops[i]) {
        final double span = stops[i] - stops[i - 1];
        if (span <= 0.0) return values[i];
        final double local = (t - stops[i - 1]) / span;
        return values[i - 1] + (values[i] - values[i - 1]) * local;
      }
    }
    return values.last;
  }
}

/// Every design token in the system, typed, for both themes.
///
/// ```dart
/// final tokens = Theme.of(context).extension<MeridianTokens>()!;
/// ```
@immutable
class MeridianTokens extends ThemeExtension<MeridianTokens> {
  const MeridianTokens({
    required this.surface0,
    required this.surface1,
    required this.surface2,
    required this.surface3,
    required this.surfaceFloat,
    required this.surfaceSunken,
    required this.ink1,
    required this.ink2,
    required this.ink3,
    required this.inkInv,
    required this.hairline,
    required this.border,
    required this.borderStrong,
    required this.rim,
    required this.rim2,
    required this.rim3,
    required this.rim4,
    required this.rimShoulder2,
    required this.rimShoulder3,
    required this.rimShoulder4,
    required this.fresnelUnder,
    required this.fresnelAlpha,
    required this.contact,
    required this.contactAlpha,
    required this.shadow,
    required this.elev0,
    required this.elev1,
    required this.elev2,
    required this.elev3,
    required this.elev4,
    required this.elev5,
    required this.glassBg,
    required this.glassAlpha,
    required this.glassBorder,
    required this.glassBorderAlpha,
    required this.modalAlpha,
    required this.blurFloat,
    required this.blurModal,
    required this.blurScrim,
    required this.satGlass,
    required this.satModal,
    required this.scrim,
    required this.scrimAlpha,
    required this.displayBg,
    required this.displayAlpha,
    required this.blurDisplay,
    required this.satDisplay,
    required this.chromePad,
    required this.primary,
    required this.primaryForeground,
    required this.primaryInk,
    required this.primarySoft,
    required this.primaryEdge,
    required this.inkEdge,
    required this.accent,
    required this.accentForeground,
    required this.accentInk,
    required this.accentSoft,
    required this.accentEdge,
    required this.brass,
    required this.brassInk,
    required this.success,
    required this.successSoft,
    required this.successInk,
    required this.successRule,
    required this.successForeground,
    required this.warning,
    required this.warningSoft,
    required this.warningInk,
    required this.warningRule,
    required this.warningForeground,
    required this.danger,
    required this.dangerSoft,
    required this.dangerInk,
    required this.dangerRule,
    required this.dangerForeground,
    required this.dangerEdge,
    required this.neutralSoft,
    required this.neutralRule,
    required this.neutralInk,
    required this.fieldA,
    required this.fieldAAlpha,
    required this.fieldB,
    required this.fieldBAlpha,
    required this.fieldC,
    required this.fieldCAlpha,
    required this.fieldRule,
    required this.fieldRuleAlpha,
    required this.fieldNoise,
    required this.fieldBlur,
    required this.fieldIntensity,
    required this.noise,
    required this.stateHover,
    required this.statePress,
    required this.stateMix,
    required this.imgRatioCard,
    required this.imgRatioHero,
    required this.imgInset,
    required this.imgPlate,
    required this.edge,
    required this.ring,
    required this.ringWidth,
    required this.ringOffsetSurface,
    required this.fontSans,
    required this.fontDisplay,
    required this.fontSansAr,
    required this.fontDisplayAr,
    required this.fontProvenance,
    required this.fontMono,
    required this.fsMicro,
    required this.lhMicro,
    required this.trMicro,
    required this.fsMeta,
    required this.lhMeta,
    required this.trMeta,
    required this.fsUi,
    required this.lhUi,
    required this.trUi,
    required this.fsBody,
    required this.lhBody,
    required this.trBody,
    required this.fsLead,
    required this.lhLead,
    required this.trLead,
    required this.fsH3,
    required this.lhH3,
    required this.trH3,
    required this.fsH2,
    required this.lhH2,
    required this.trH2,
    required this.fsH1,
    required this.lhH1,
    required this.trH1,
    required this.fsDisplay,
    required this.lhDisplay,
    required this.trDisplay,
    required this.fsHero,
    required this.lhHero,
    required this.trHero,
    required this.fwHero,
    required this.fsFigInline,
    required this.lhFigInline,
    required this.fwFigInline,
    required this.fsFigCard,
    required this.lhFigCard,
    required this.fwFigCard,
    required this.fsFigSection,
    required this.lhFigSection,
    required this.fwFigSection,
    required this.fsFigHero,
    required this.lhFigHero,
    required this.fwFigHero,
    required this.trFig,
    required this.fwBody,
    required this.fwUi,
    required this.fwHead,
    required this.measureProse,
    required this.measureDesc,
    required this.shellMax,
    required this.shellGutter,
    required this.easeOut,
    required this.easeStandard,
    required this.easeDrawer,
    required this.easeInOut,
    required this.easeExit,
    required this.easeOvershoot,
    required this.easeSpring,
    required this.dur1,
    required this.dur2,
    required this.dur3,
    required this.dur4,
    required this.dur5,
    required this.stagger,
    required this.motionScale,
    required this.tPress,
    required this.tHover,
    required this.tPanel,
    required this.tLayer,
    required this.liftY,
    required this.pressY,
    required this.keyDepth,
    required this.originInlineStart,
    required this.dir,
    required this.radius,
    required this.radiusSm,
    required this.radiusLg,
    required this.radiusPill,
    required this.rowH,
    required this.controlHSm,
    required this.controlHMd,
    required this.controlHLg,
    required this.spaceUnit,
    required this.spaceTight,
    required this.spaceStack,
    required this.spaceBlock,
    required this.spaceSection,
    required this.background,
    required this.foreground,
    required this.card,
    required this.cardForeground,
    required this.popover,
    required this.popoverForeground,
    required this.muted,
    required this.mutedForeground,
    required this.secondary,
    required this.secondaryForeground,
    required this.input,
    required this.destructive,
    required this.destructiveForeground,
    required this.accent2,
  });

  /// `--surface-0` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color surface0;

  /// `--surface-1` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color surface1;

  /// `--surface-2` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color surface2;

  /// `--surface-3` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color surface3;

  /// `--surface-float` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color surfaceFloat;

  /// `--surface-sunken` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color surfaceSunken;

  /// `--ink-1` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color ink1;

  /// `--ink-2` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color ink2;

  /// `--ink-3` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color ink3;

  /// `--ink-inv` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color inkInv;

  /// `--hairline` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color hairline;

  /// `--border` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color border;

  /// `--border-strong` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color borderStrong;

  /// `--rim` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color rim;

  /// `--rim-2` — logical pixels.
  final double rim2;

  /// `--rim-3` — logical pixels.
  final double rim3;

  /// `--rim-4` — logical pixels.
  final double rim4;

  /// `--rim-shoulder-2` — logical pixels.
  final double rimShoulder2;

  /// `--rim-shoulder-3` — logical pixels.
  final double rimShoulder3;

  /// `--rim-shoulder-4` — logical pixels.
  final double rimShoulder4;

  /// `--fresnel-under` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color fresnelUnder;

  /// `--fresnel-alpha` — logical pixels.
  final double fresnelAlpha;

  /// `--contact` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color contact;

  /// `--contact-alpha` — logical pixels.
  final double contactAlpha;

  /// `--shadow` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color shadow;

  /// `--elev-0` — an elevation stack, inset layers removed.
  final List<BoxShadow> elev0;

  /// `--elev-1` — an elevation stack, inset layers removed.
  final List<BoxShadow> elev1;

  /// `--elev-2` — an elevation stack, inset layers removed.
  final List<BoxShadow> elev2;

  /// `--elev-3` — an elevation stack, inset layers removed.
  final List<BoxShadow> elev3;

  /// `--elev-4` — an elevation stack, inset layers removed.
  final List<BoxShadow> elev4;

  /// `--elev-5` — an elevation stack, inset layers removed.
  final List<BoxShadow> elev5;

  /// `--glass-bg` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color glassBg;

  /// `--glass-alpha` — logical pixels.
  final double glassAlpha;

  /// `--glass-border` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color glassBorder;

  /// `--glass-border-alpha` — logical pixels.
  final double glassBorderAlpha;

  /// `--modal-alpha` — logical pixels.
  final double modalAlpha;

  /// `--blur-float` — logical pixels.
  final double blurFloat;

  /// `--blur-modal` — logical pixels.
  final double blurModal;

  /// `--blur-scrim` — logical pixels.
  final double blurScrim;

  /// `--sat-glass` — logical pixels.
  final double satGlass;

  /// `--sat-modal` — logical pixels.
  final double satModal;

  /// `--scrim` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color scrim;

  /// `--scrim-alpha` — logical pixels.
  final double scrimAlpha;

  /// `--display-bg` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color displayBg;

  /// `--display-alpha` — logical pixels.
  final double displayAlpha;

  /// `--blur-display` — logical pixels.
  final double blurDisplay;

  /// `--sat-display` — logical pixels.
  final double satDisplay;

  /// `--chrome-pad` — logical pixels.
  final double chromePad;

  /// `--primary` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color primary;

  /// `--primary-foreground` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color primaryForeground;

  /// `--primary-ink` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color primaryInk;

  /// `--primary-soft` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color primarySoft;

  /// `--primary-edge` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color primaryEdge;

  /// `--ink-edge` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color inkEdge;

  /// `--accent` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color accent;

  /// `--accent-foreground` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color accentForeground;

  /// `--accent-ink` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color accentInk;

  /// `--accent-soft` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color accentSoft;

  /// `--accent-edge` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color accentEdge;

  /// `--brass` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color brass;

  /// `--brass-ink` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color brassInk;

  /// `--success` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color success;

  /// `--success-soft` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color successSoft;

  /// `--success-ink` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color successInk;

  /// `--success-rule` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color successRule;

  /// `--success-foreground` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color successForeground;

  /// `--warning` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color warning;

  /// `--warning-soft` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color warningSoft;

  /// `--warning-ink` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color warningInk;

  /// `--warning-rule` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color warningRule;

  /// `--warning-foreground` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color warningForeground;

  /// `--danger` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color danger;

  /// `--danger-soft` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color dangerSoft;

  /// `--danger-ink` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color dangerInk;

  /// `--danger-rule` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color dangerRule;

  /// `--danger-foreground` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color dangerForeground;

  /// `--danger-edge` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color dangerEdge;

  /// `--neutral-soft` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color neutralSoft;

  /// `--neutral-rule` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color neutralRule;

  /// `--neutral-ink` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color neutralInk;

  /// `--field-a` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color fieldA;

  /// `--field-a-alpha` — logical pixels.
  final double fieldAAlpha;

  /// `--field-b` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color fieldB;

  /// `--field-b-alpha` — logical pixels.
  final double fieldBAlpha;

  /// `--field-c` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color fieldC;

  /// `--field-c-alpha` — logical pixels.
  final double fieldCAlpha;

  /// `--field-rule` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color fieldRule;

  /// `--field-rule-alpha` — logical pixels.
  final double fieldRuleAlpha;

  /// `--field-noise` — logical pixels.
  final double fieldNoise;

  /// `--field-blur` — logical pixels.
  final double fieldBlur;

  /// `--field-intensity` — logical pixels.
  final double fieldIntensity;

  /// `--noise` — a string token.
  final String noise;

  /// `--state-hover` — a CSS percentage, carried as a 0–1 fraction.
  final double stateHover;

  /// `--state-press` — a CSS percentage, carried as a 0–1 fraction.
  final double statePress;

  /// `--state-mix` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color stateMix;

  /// `--img-ratio-card` — an aspect ratio, width ÷ height.
  final double imgRatioCard;

  /// `--img-ratio-hero` — an aspect ratio, width ÷ height.
  final double imgRatioHero;

  /// `--img-inset` — a CSS percentage, carried as a 0–1 fraction.
  final double imgInset;

  /// `--img-plate` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color imgPlate;

  /// `--edge` — logical pixels.
  final double edge;

  /// `--ring` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color ring;

  /// `--ring-width` — logical pixels.
  final double ringWidth;

  /// `--ring-offset-surface` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color ringOffsetSurface;

  /// `--font-sans` — a string token.
  final String fontSans;

  /// `--font-display` — a string token.
  final String fontDisplay;

  /// `--font-sans-ar` — a string token.
  final String fontSansAr;

  /// `--font-display-ar` — a string token.
  final String fontDisplayAr;

  /// `--font-provenance` — a string token.
  final String fontProvenance;

  /// `--font-mono` — a string token.
  final String fontMono;

  /// `--fs-micro` — logical pixels.
  final double fsMicro;

  /// `--lh-micro` — logical pixels.
  final double lhMicro;

  /// `--tr-micro` — an em multiple; multiply by the font size to get logical pixels.
  final double trMicro;

  /// `--fs-meta` — logical pixels.
  final double fsMeta;

  /// `--lh-meta` — logical pixels.
  final double lhMeta;

  /// `--tr-meta` — logical pixels.
  final double trMeta;

  /// `--fs-ui` — logical pixels.
  final double fsUi;

  /// `--lh-ui` — logical pixels.
  final double lhUi;

  /// `--tr-ui` — logical pixels.
  final double trUi;

  /// `--fs-body` — logical pixels.
  final double fsBody;

  /// `--lh-body` — logical pixels.
  final double lhBody;

  /// `--tr-body` — logical pixels.
  final double trBody;

  /// `--fs-lead` — a fluid step; call `.resolve(width)`.
  final MeridianFluidSize fsLead;

  /// `--lh-lead` — logical pixels.
  final double lhLead;

  /// `--tr-lead` — an em multiple; multiply by the font size to get logical pixels.
  final double trLead;

  /// `--fs-h3` — a fluid step; call `.resolve(width)`.
  final MeridianFluidSize fsH3;

  /// `--lh-h3` — logical pixels.
  final double lhH3;

  /// `--tr-h3` — an em multiple; multiply by the font size to get logical pixels.
  final double trH3;

  /// `--fs-h2` — a fluid step; call `.resolve(width)`.
  final MeridianFluidSize fsH2;

  /// `--lh-h2` — logical pixels.
  final double lhH2;

  /// `--tr-h2` — an em multiple; multiply by the font size to get logical pixels.
  final double trH2;

  /// `--fs-h1` — a fluid step; call `.resolve(width)`.
  final MeridianFluidSize fsH1;

  /// `--lh-h1` — logical pixels.
  final double lhH1;

  /// `--tr-h1` — an em multiple; multiply by the font size to get logical pixels.
  final double trH1;

  /// `--fs-display` — a fluid step; call `.resolve(width)`.
  final MeridianFluidSize fsDisplay;

  /// `--lh-display` — logical pixels.
  final double lhDisplay;

  /// `--tr-display` — an em multiple; multiply by the font size to get logical pixels.
  final double trDisplay;

  /// `--fs-hero` — a fluid step; call `.resolve(width)`.
  final MeridianFluidSize fsHero;

  /// `--lh-hero` — logical pixels.
  final double lhHero;

  /// `--tr-hero` — an em multiple; multiply by the font size to get logical pixels.
  final double trHero;

  /// `--fw-hero` — logical pixels.
  final double fwHero;

  /// `--fs-fig-inline` — logical pixels.
  final double fsFigInline;

  /// `--lh-fig-inline` — logical pixels.
  final double lhFigInline;

  /// `--fw-fig-inline` — logical pixels.
  final double fwFigInline;

  /// `--fs-fig-card` — logical pixels.
  final double fsFigCard;

  /// `--lh-fig-card` — logical pixels.
  final double lhFigCard;

  /// `--fw-fig-card` — logical pixels.
  final double fwFigCard;

  /// `--fs-fig-section` — logical pixels.
  final double fsFigSection;

  /// `--lh-fig-section` — logical pixels.
  final double lhFigSection;

  /// `--fw-fig-section` — logical pixels.
  final double fwFigSection;

  /// `--fs-fig-hero` — logical pixels.
  final double fsFigHero;

  /// `--lh-fig-hero` — logical pixels.
  final double lhFigHero;

  /// `--fw-fig-hero` — logical pixels.
  final double fwFigHero;

  /// `--tr-fig` — an em multiple; multiply by the font size to get logical pixels.
  final double trFig;

  /// `--fw-body` — logical pixels.
  final double fwBody;

  /// `--fw-ui` — logical pixels.
  final double fwUi;

  /// `--fw-head` — logical pixels.
  final double fwHead;

  /// `--measure-prose` — a ch multiple; a measure, not a pixel length.
  final double measureProse;

  /// `--measure-desc` — a ch multiple; a measure, not a pixel length.
  final double measureDesc;

  /// `--shell-max` — logical pixels.
  final double shellMax;

  /// `--shell-gutter` — a fluid step; call `.resolve(width)`.
  final MeridianFluidSize shellGutter;

  /// `--ease-out` — an easing curve.
  final Cubic easeOut;

  /// `--ease-standard` — an easing curve.
  final Cubic easeStandard;

  /// `--ease-drawer` — an easing curve.
  final Cubic easeDrawer;

  /// `--ease-in-out` — an easing curve.
  final Cubic easeInOut;

  /// `--ease-exit` — an easing curve.
  final Cubic easeExit;

  /// `--ease-overshoot` — an easing curve.
  final Cubic easeOvershoot;

  /// `--ease-spring` — a sampled easing curve.
  final MeridianSampledCurve easeSpring;

  /// `--dur-1` — a duration.
  final Duration dur1;

  /// `--dur-2` — a duration.
  final Duration dur2;

  /// `--dur-3` — a duration.
  final Duration dur3;

  /// `--dur-4` — a duration.
  final Duration dur4;

  /// `--dur-5` — a duration.
  final Duration dur5;

  /// `--stagger` — a duration.
  final Duration stagger;

  /// `--motion-scale` — logical pixels.
  final double motionScale;

  /// `--t-press` — a duration.
  final Duration tPress;

  /// `--t-hover` — a duration.
  final Duration tHover;

  /// `--t-panel` — a duration.
  final Duration tPanel;

  /// `--t-layer` — a duration.
  final Duration tLayer;

  /// `--lift-y` — logical pixels.
  final double liftY;

  /// `--press-y` — logical pixels.
  final double pressY;

  /// `--key-depth` — logical pixels.
  final double keyDepth;

  /// `--origin-inline-start` — a string token.
  final String originInlineStart;

  /// `--dir` — logical pixels.
  final double dir;

  /// `--radius` — logical pixels.
  final double radius;

  /// `--radius-sm` — logical pixels.
  final double radiusSm;

  /// `--radius-lg` — logical pixels.
  final double radiusLg;

  /// `--radius-pill` — logical pixels.
  final double radiusPill;

  /// `--row-h` — logical pixels.
  final double rowH;

  /// `--control-h-sm` — logical pixels.
  final double controlHSm;

  /// `--control-h-md` — logical pixels.
  final double controlHMd;

  /// `--control-h-lg` — logical pixels.
  final double controlHLg;

  /// `--space-unit` — logical pixels.
  final double spaceUnit;

  /// `--space-tight` — logical pixels.
  final double spaceTight;

  /// `--space-stack` — logical pixels.
  final double spaceStack;

  /// `--space-block` — logical pixels.
  final double spaceBlock;

  /// `--space-section` — logical pixels.
  final double spaceSection;

  /// `--background` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color background;

  /// `--foreground` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color foreground;

  /// `--card` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color card;

  /// `--card-foreground` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color cardForeground;

  /// `--popover` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color popover;

  /// `--popover-foreground` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color popoverForeground;

  /// `--muted` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color muted;

  /// `--muted-foreground` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color mutedForeground;

  /// `--secondary` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color secondary;

  /// `--secondary-foreground` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color secondaryForeground;

  /// `--input` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color input;

  /// `--destructive` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color destructive;

  /// `--destructive-foreground` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color destructiveForeground;

  /// `--accent-2` — a colour at full alpha; compose with `.withValues(alpha: …)`.
  final Color accent2;

  /// The light theme — `:root`.
  static const MeridianTokens light = MeridianTokens(
    surface0: Color(0xFFFAF9F7),
    surface1: Color(0xFFF5F4F1),
    surface2: Color(0xFFFFFFFF),
    surface3: Color(0xFFFFFFFF),
    surfaceFloat: Color(0xFFFDFDFC),
    surfaceSunken: Color(0xFFF0EEEA),
    ink1: Color(0xFF161922),
    ink2: Color(0xFF4A505E),
    ink3: Color(0xFF5D6574),
    inkInv: Color(0xFFFAF9F7),
    hairline: Color(0xFFEBE9E5),
    border: Color(0xFFDDD9D4),
    borderStrong: Color(0xFFBFB8B0),
    rim: Color(0xFFFFFFFF),
    rim2: 0.72,
    rim3: 0.88,
    rim4: 1.0,
    rimShoulder2: 0.34,
    rimShoulder3: 0.48,
    rimShoulder4: 0.62,
    fresnelUnder: Color(0xFF151928),
    fresnelAlpha: 0.055,
    contact: Color(0xFF0F1424),
    contactAlpha: 0.05,
    shadow: Color(0xFF151928),
    elev0: <BoxShadow>[],
    elev1: <BoxShadow>[],
    elev2: <BoxShadow>[BoxShadow(color: Color(0x0B151928), offset: Offset(0.0, 1.0), blurRadius: 1.0, spreadRadius: 0.0), BoxShadow(color: Color(0x0E151928), offset: Offset(0.0, 2.0), blurRadius: 5.0, spreadRadius: -2.0)],
    elev3: <BoxShadow>[BoxShadow(color: Color(0x0D0F1424), offset: Offset(0.0, 1.0), blurRadius: 1.0, spreadRadius: 0.0), BoxShadow(color: Color(0x0F151928), offset: Offset(0.0, 4.0), blurRadius: 8.0, spreadRadius: -2.0), BoxShadow(color: Color(0x17151928), offset: Offset(0.0, 12.0), blurRadius: 22.0, spreadRadius: -8.0)],
    elev4: <BoxShadow>[BoxShadow(color: Color(0x0D0F1424), offset: Offset(0.0, 1.0), blurRadius: 1.0, spreadRadius: 0.0), BoxShadow(color: Color(0x0F151928), offset: Offset(0.0, 2.0), blurRadius: 4.0, spreadRadius: -1.0), BoxShadow(color: Color(0x21151928), offset: Offset(0.0, 12.0), blurRadius: 24.0, spreadRadius: -6.0), BoxShadow(color: Color(0x29151928), offset: Offset(0.0, 32.0), blurRadius: 48.0, spreadRadius: -20.0)],
    elev5: <BoxShadow>[BoxShadow(color: Color(0x0D0F1424), offset: Offset(0.0, 1.0), blurRadius: 1.0, spreadRadius: 0.0), BoxShadow(color: Color(0x14151928), offset: Offset(0.0, 4.0), blurRadius: 8.0, spreadRadius: -2.0), BoxShadow(color: Color(0x33151928), offset: Offset(0.0, 24.0), blurRadius: 48.0, spreadRadius: -12.0), BoxShadow(color: Color(0x4D151928), offset: Offset(0.0, 48.0), blurRadius: 88.0, spreadRadius: -28.0)],
    glassBg: Color(0xFFFDFDFC),
    glassAlpha: 0.86,
    glassBorder: Color(0xFFDDD9D4),
    glassBorderAlpha: 0.7,
    modalAlpha: 0.96,
    blurFloat: 20.0,
    blurModal: 28.0,
    blurScrim: 4.0,
    satGlass: 1.6,
    satModal: 1.75,
    scrim: Color(0xFF151928),
    scrimAlpha: 0.42,
    displayBg: Color(0xFFFDFDFC),
    displayAlpha: 0.58,
    blurDisplay: 34.0,
    satDisplay: 1.34,
    chromePad: 14.0,
    primary: Color(0xFF057F42),
    primaryForeground: Color(0xFFFFFFFF),
    primaryInk: Color(0xFF06743D),
    primarySoft: Color(0xFFECF9F2),
    primaryEdge: Color(0xFF03532B),
    inkEdge: Color(0xFF07090E),
    accent: Color(0xFF1D5C7C),
    accentForeground: Color(0xFFFFFFFF),
    accentInk: Color(0xFF17516E),
    accentSoft: Color(0xFFE9F2F6),
    accentEdge: Color(0xFF123A4E),
    brass: Color(0xFFA7772F),
    brassInk: Color(0xFF8B5E23),
    success: Color(0xFF256A4A),
    successSoft: Color(0xFFEAF6F0),
    successInk: Color(0xFF1D5D3F),
    successRule: Color(0xFFBFD9CD),
    successForeground: Color(0xFFFFFFFF),
    warning: Color(0xFFA35C14),
    warningSoft: Color(0xFFFBF3E4),
    warningInk: Color(0xFF8A440F),
    warningRule: Color(0xFFE4D1B4),
    warningForeground: Color(0xFFFFFFFF),
    danger: Color(0xFFAE2D29),
    dangerSoft: Color(0xFFFBEFEE),
    dangerInk: Color(0xFF98231F),
    dangerRule: Color(0xFFE7C6C5),
    dangerForeground: Color(0xFFFFFFFF),
    dangerEdge: Color(0xFF741E1B),
    neutralSoft: Color(0xFFF0EEEB),
    neutralRule: Color(0xFFDDD9D4),
    neutralInk: Color(0xFF4A505E),
    fieldA: Color(0xFF23A966),
    fieldAAlpha: 0.075,
    fieldB: Color(0xFF2888B8),
    fieldBAlpha: 0.052,
    fieldC: Color(0xFFA7772F),
    fieldCAlpha: 0.026,
    fieldRule: Color(0xFF161922),
    fieldRuleAlpha: 0.035,
    fieldNoise: 0.022,
    fieldBlur: 64.0,
    fieldIntensity: 1.0,
    noise: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E",
    stateHover: 0.08,
    statePress: 0.16,
    stateMix: Color(0xFF161922),
    imgRatioCard: 0.8,
    imgRatioHero: 1.5,
    imgInset: 0.09,
    imgPlate: Color(0xFFF5F4F1),
    edge: 32.0,
    ring: Color(0xFF057F42),
    ringWidth: 2.0,
    ringOffsetSurface: Color(0xFFFFFFFF),
    fontSans: "Inter",
    fontDisplay: "Inter",
    fontSansAr: "IBM Plex Sans Arabic",
    fontDisplayAr: "Noto Kufi Arabic",
    fontProvenance: "Source Serif 4",
    fontMono: "IBM Plex Mono",
    fsMicro: 11.0,
    lhMicro: 16.0,
    trMicro: 0.06,
    fsMeta: 12.0,
    lhMeta: 18.0,
    trMeta: 0.0,
    fsUi: 13.0,
    lhUi: 20.0,
    trUi: 0.0,
    fsBody: 15.0,
    lhBody: 24.0,
    trBody: 0.0,
    fsLead: MeridianFluidSize(minPx: 16.0, maxPx: 19.0, basePx: 0.0, remCoefficient: 0.93, vwCoefficient: 0.29),
    lhLead: 1.58,
    trLead: -0.004,
    fsH3: MeridianFluidSize(minPx: 19.0, maxPx: 22.0, basePx: 0.0, remCoefficient: 1.118, vwCoefficient: 0.29),
    lhH3: 1.32,
    trH3: -0.009,
    fsH2: MeridianFluidSize(minPx: 24.0, maxPx: 32.0, basePx: 0.0, remCoefficient: 1.314, vwCoefficient: 0.76),
    lhH2: 1.14,
    trH2: -0.016,
    fsH1: MeridianFluidSize(minPx: 30.0, maxPx: 44.0, basePx: 0.0, remCoefficient: 1.55, vwCoefficient: 1.33),
    lhH1: 1.08,
    trH1: -0.022,
    fsDisplay: MeridianFluidSize(minPx: 34.0, maxPx: 52.0, basePx: 0.0, remCoefficient: 2.0, vwCoefficient: 2.2),
    lhDisplay: 1.05,
    trDisplay: -0.026,
    fsHero: MeridianFluidSize(minPx: 40.0, maxPx: 92.0, basePx: 0.0, remCoefficient: 1.293, vwCoefficient: 4.95),
    lhHero: 0.98,
    trHero: -0.034,
    fwHero: 680.0,
    fsFigInline: 20.0,
    lhFigInline: 28.0,
    fwFigInline: 500.0,
    fsFigCard: 22.0,
    lhFigCard: 26.0,
    fwFigCard: 600.0,
    fsFigSection: 30.0,
    lhFigSection: 34.0,
    fwFigSection: 600.0,
    fsFigHero: 46.0,
    lhFigHero: 48.0,
    fwFigHero: 700.0,
    trFig: -0.02,
    fwBody: 400.0,
    fwUi: 500.0,
    fwHead: 600.0,
    measureProse: 68.0,
    measureDesc: 60.0,
    shellMax: 96.0,
    shellGutter: MeridianFluidSize(minPx: 16.0, maxPx: 48.0, basePx: 0.0, remCoefficient: 0.0, vwCoefficient: 3.0),
    easeOut: Cubic(0.22, 1.0, 0.36, 1.0),
    easeStandard: Cubic(0.32, 0.72, 0.0, 1.0),
    easeDrawer: Cubic(0.32, 0.72, 0.0, 1.0),
    easeInOut: Cubic(0.77, 0.0, 0.175, 1.0),
    easeExit: Cubic(0.4, 0.0, 1.0, 1.0),
    easeOvershoot: Cubic(0.34, 1.4, 0.5, 1.0),
    easeSpring: MeridianSampledCurve(<double>[0.0, 0.02, 0.04, 0.06, 0.08, 0.113333, 0.146667, 0.18, 0.22, 0.26, 0.3, 0.34, 0.38, 0.42, 0.46, 0.486667, 0.513333, 0.54, 0.58, 0.62, 0.66, 0.7, 0.726667, 0.753333, 0.78, 0.81, 0.84, 0.87, 0.9, 0.92, 0.94, 0.96, 0.98, 1.0], <double>[0.0, 0.0021, 0.0083, 0.0187, 0.0332, 0.0724, 0.1226, 0.1826, 0.2513, 0.3275, 0.41, 0.4977, 0.5891, 0.683, 0.7778, 0.8232, 0.8672, 0.9089, 0.9474, 0.9819, 1.0117, 1.0364, 1.0466, 1.0479, 1.0435, 1.0345, 1.0234, 1.0119, 1.0018, 0.9962, 0.9945, 0.9954, 0.9977, 1.0]),
    dur1: Duration(microseconds: 90000),
    dur2: Duration(microseconds: 140000),
    dur3: Duration(microseconds: 220000),
    dur4: Duration(microseconds: 320000),
    dur5: Duration(microseconds: 480000),
    stagger: Duration(microseconds: 40000),
    motionScale: 1.0,
    tPress: Duration(microseconds: 90000),
    tHover: Duration(microseconds: 140000),
    tPanel: Duration(microseconds: 220000),
    tLayer: Duration(microseconds: 320000),
    liftY: -2.0,
    pressY: 0.5,
    keyDepth: 3.0,
    originInlineStart: "left",
    dir: 1.0,
    radius: 14.0,
    radiusSm: 8.0,
    radiusLg: 20.0,
    radiusPill: 999.0,
    rowH: 44.0,
    controlHSm: 30.0,
    controlHMd: 38.0,
    controlHLg: 46.0,
    spaceUnit: 4.0,
    spaceTight: 8.0,
    spaceStack: 16.0,
    spaceBlock: 32.0,
    spaceSection: 72.0,
    background: Color(0xFFFAF9F7),
    foreground: Color(0xFF161922),
    card: Color(0xFFFFFFFF),
    cardForeground: Color(0xFF161922),
    popover: Color(0xFFFDFDFC),
    popoverForeground: Color(0xFF161922),
    muted: Color(0xFFF5F4F1),
    mutedForeground: Color(0xFF5D6574),
    secondary: Color(0xFFF5F4F1),
    secondaryForeground: Color(0xFF161922),
    input: Color(0xFFDDD9D4),
    destructive: Color(0xFFAE2D29),
    destructiveForeground: Color(0xFFFFFFFF),
    accent2: Color(0xFF1D5C7C),
  );

  /// The dark theme — `:root` merged with `.dark`.
  static const MeridianTokens dark = MeridianTokens(
    surface0: Color(0xFF08090C),
    surface1: Color(0xFF131319),
    surface2: Color(0xFF181920),
    surface3: Color(0xFF22232B),
    surfaceFloat: Color(0xFF23252F),
    surfaceSunken: Color(0xFF090A0E),
    ink1: Color(0xFFF2F0EE),
    ink2: Color(0xFFB0B3BF),
    ink3: Color(0xFF9DA1AF),
    inkInv: Color(0xFF0D0E12),
    hairline: Color(0xFF22232B),
    border: Color(0xFF2D2F39),
    borderStrong: Color(0xFF454754),
    rim: Color(0xFFFFFFFF),
    rim2: 0.05,
    rim3: 0.075,
    rim4: 0.1,
    rimShoulder2: 0.045,
    rimShoulder3: 0.07,
    rimShoulder4: 0.1,
    fresnelUnder: Color(0xFF000000),
    fresnelAlpha: 0.34,
    contact: Color(0xFF010104),
    contactAlpha: 0.45,
    shadow: Color(0xFF020308),
    elev0: <BoxShadow>[],
    elev1: <BoxShadow>[],
    elev2: <BoxShadow>[BoxShadow(color: Color(0x80020308), offset: Offset(0.0, 1.0), blurRadius: 2.0, spreadRadius: 0.0), BoxShadow(color: Color(0x8C020308), offset: Offset(0.0, 3.0), blurRadius: 8.0, spreadRadius: -3.0)],
    elev3: <BoxShadow>[BoxShadow(color: Color(0x73010104), offset: Offset(0.0, 1.0), blurRadius: 1.0, spreadRadius: 0.0), BoxShadow(color: Color(0x8C020308), offset: Offset(0.0, 2.0), blurRadius: 4.0, spreadRadius: 0.0), BoxShadow(color: Color(0xA6020308), offset: Offset(0.0, 10.0), blurRadius: 24.0, spreadRadius: -6.0)],
    elev4: <BoxShadow>[BoxShadow(color: Color(0x73010104), offset: Offset(0.0, 1.0), blurRadius: 1.0, spreadRadius: 0.0), BoxShadow(color: Color(0x99020308), offset: Offset(0.0, 4.0), blurRadius: 8.0, spreadRadius: -2.0), BoxShadow(color: Color(0xB8020308), offset: Offset(0.0, 18.0), blurRadius: 36.0, spreadRadius: -10.0)],
    elev5: <BoxShadow>[BoxShadow(color: Color(0x73010104), offset: Offset(0.0, 1.0), blurRadius: 1.0, spreadRadius: 0.0), BoxShadow(color: Color(0xA6020308), offset: Offset(0.0, 8.0), blurRadius: 16.0, spreadRadius: -4.0), BoxShadow(color: Color(0xD9020308), offset: Offset(0.0, 40.0), blurRadius: 80.0, spreadRadius: -24.0)],
    glassBg: Color(0xFF23252F),
    glassAlpha: 0.84,
    glassBorder: Color(0xFFFFFFFF),
    glassBorderAlpha: 0.08,
    modalAlpha: 0.96,
    blurFloat: 20.0,
    blurModal: 28.0,
    blurScrim: 4.0,
    satGlass: 1.3,
    satModal: 1.35,
    scrim: Color(0xFF020308),
    scrimAlpha: 0.62,
    displayBg: Color(0xFF262836),
    displayAlpha: 0.46,
    blurDisplay: 30.0,
    satDisplay: 1.1,
    chromePad: 14.0,
    primary: Color(0xFF64D89E),
    primaryForeground: Color(0xFF0B1E14),
    primaryInk: Color(0xFF7DE8B3),
    primarySoft: Color(0xFF1B3226),
    primaryEdge: Color(0xFF2E9E66),
    inkEdge: Color(0xFFBFBAB0),
    accent: Color(0xFF50A4CE),
    accentForeground: Color(0xFF0A1F29),
    accentInk: Color(0xFF64B1D8),
    accentSoft: Color(0xFF182B35),
    accentEdge: Color(0xFF30647E),
    brass: Color(0xFFD8AA5A),
    brassInk: Color(0xFFE3BC78),
    success: Color(0xFF65C397),
    successSoft: Color(0xFF172C22),
    successInk: Color(0xFF80D0AB),
    successRule: Color(0xFF315443),
    successForeground: Color(0xFF082115),
    warning: Color(0xFFF3B549),
    warningSoft: Color(0xFF302212),
    warningInk: Color(0xFFF6C96F),
    warningRule: Color(0xFF5F472B),
    warningForeground: Color(0xFF231506),
    danger: Color(0xFFEC6E65),
    dangerSoft: Color(0xFF331615),
    dangerInk: Color(0xFFF48C85),
    dangerRule: Color(0xFF5F2C2B),
    dangerForeground: Color(0xFF210908),
    dangerEdge: Color(0xFFA84038),
    neutralSoft: Color(0xFF22232B),
    neutralRule: Color(0xFF2D2F39),
    neutralInk: Color(0xFFB0B3BF),
    fieldA: Color(0xFF23A966),
    fieldAAlpha: 0.16,
    fieldB: Color(0xFF2888B8),
    fieldBAlpha: 0.11,
    fieldC: Color(0xFFA7772F),
    fieldCAlpha: 0.07,
    fieldRule: Color(0xFFFFFFFF),
    fieldRuleAlpha: 0.045,
    fieldNoise: 0.034,
    fieldBlur: 64.0,
    fieldIntensity: 1.0,
    noise: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E",
    stateHover: 0.08,
    statePress: 0.16,
    stateMix: Color(0xFF0D0E12),
    imgRatioCard: 0.8,
    imgRatioHero: 1.5,
    imgInset: 0.09,
    imgPlate: Color(0xFF131319),
    edge: 32.0,
    ring: Color(0xFF64D89E),
    ringWidth: 2.0,
    ringOffsetSurface: Color(0xFF181920),
    fontSans: "Inter",
    fontDisplay: "Inter",
    fontSansAr: "IBM Plex Sans Arabic",
    fontDisplayAr: "Noto Kufi Arabic",
    fontProvenance: "Source Serif 4",
    fontMono: "IBM Plex Mono",
    fsMicro: 11.0,
    lhMicro: 16.0,
    trMicro: 0.06,
    fsMeta: 12.0,
    lhMeta: 18.0,
    trMeta: 0.0,
    fsUi: 13.0,
    lhUi: 20.0,
    trUi: 0.0,
    fsBody: 15.0,
    lhBody: 24.0,
    trBody: 0.0,
    fsLead: MeridianFluidSize(minPx: 16.0, maxPx: 19.0, basePx: 0.0, remCoefficient: 0.93, vwCoefficient: 0.29),
    lhLead: 1.58,
    trLead: -0.004,
    fsH3: MeridianFluidSize(minPx: 19.0, maxPx: 22.0, basePx: 0.0, remCoefficient: 1.118, vwCoefficient: 0.29),
    lhH3: 1.32,
    trH3: -0.009,
    fsH2: MeridianFluidSize(minPx: 24.0, maxPx: 32.0, basePx: 0.0, remCoefficient: 1.314, vwCoefficient: 0.76),
    lhH2: 1.14,
    trH2: -0.016,
    fsH1: MeridianFluidSize(minPx: 30.0, maxPx: 44.0, basePx: 0.0, remCoefficient: 1.55, vwCoefficient: 1.33),
    lhH1: 1.08,
    trH1: -0.022,
    fsDisplay: MeridianFluidSize(minPx: 34.0, maxPx: 52.0, basePx: 0.0, remCoefficient: 2.0, vwCoefficient: 2.2),
    lhDisplay: 1.05,
    trDisplay: -0.026,
    fsHero: MeridianFluidSize(minPx: 40.0, maxPx: 92.0, basePx: 0.0, remCoefficient: 1.293, vwCoefficient: 4.95),
    lhHero: 0.98,
    trHero: -0.034,
    fwHero: 680.0,
    fsFigInline: 20.0,
    lhFigInline: 28.0,
    fwFigInline: 500.0,
    fsFigCard: 22.0,
    lhFigCard: 26.0,
    fwFigCard: 600.0,
    fsFigSection: 30.0,
    lhFigSection: 34.0,
    fwFigSection: 600.0,
    fsFigHero: 46.0,
    lhFigHero: 48.0,
    fwFigHero: 700.0,
    trFig: -0.02,
    fwBody: 400.0,
    fwUi: 500.0,
    fwHead: 600.0,
    measureProse: 68.0,
    measureDesc: 60.0,
    shellMax: 96.0,
    shellGutter: MeridianFluidSize(minPx: 16.0, maxPx: 48.0, basePx: 0.0, remCoefficient: 0.0, vwCoefficient: 3.0),
    easeOut: Cubic(0.22, 1.0, 0.36, 1.0),
    easeStandard: Cubic(0.32, 0.72, 0.0, 1.0),
    easeDrawer: Cubic(0.32, 0.72, 0.0, 1.0),
    easeInOut: Cubic(0.77, 0.0, 0.175, 1.0),
    easeExit: Cubic(0.4, 0.0, 1.0, 1.0),
    easeOvershoot: Cubic(0.34, 1.4, 0.5, 1.0),
    easeSpring: MeridianSampledCurve(<double>[0.0, 0.02, 0.04, 0.06, 0.08, 0.113333, 0.146667, 0.18, 0.22, 0.26, 0.3, 0.34, 0.38, 0.42, 0.46, 0.486667, 0.513333, 0.54, 0.58, 0.62, 0.66, 0.7, 0.726667, 0.753333, 0.78, 0.81, 0.84, 0.87, 0.9, 0.92, 0.94, 0.96, 0.98, 1.0], <double>[0.0, 0.0021, 0.0083, 0.0187, 0.0332, 0.0724, 0.1226, 0.1826, 0.2513, 0.3275, 0.41, 0.4977, 0.5891, 0.683, 0.7778, 0.8232, 0.8672, 0.9089, 0.9474, 0.9819, 1.0117, 1.0364, 1.0466, 1.0479, 1.0435, 1.0345, 1.0234, 1.0119, 1.0018, 0.9962, 0.9945, 0.9954, 0.9977, 1.0]),
    dur1: Duration(microseconds: 90000),
    dur2: Duration(microseconds: 140000),
    dur3: Duration(microseconds: 220000),
    dur4: Duration(microseconds: 320000),
    dur5: Duration(microseconds: 480000),
    stagger: Duration(microseconds: 40000),
    motionScale: 1.0,
    tPress: Duration(microseconds: 90000),
    tHover: Duration(microseconds: 140000),
    tPanel: Duration(microseconds: 220000),
    tLayer: Duration(microseconds: 320000),
    liftY: -2.0,
    pressY: 0.5,
    keyDepth: 3.0,
    originInlineStart: "left",
    dir: 1.0,
    radius: 14.0,
    radiusSm: 8.0,
    radiusLg: 20.0,
    radiusPill: 999.0,
    rowH: 44.0,
    controlHSm: 30.0,
    controlHMd: 38.0,
    controlHLg: 46.0,
    spaceUnit: 4.0,
    spaceTight: 8.0,
    spaceStack: 16.0,
    spaceBlock: 32.0,
    spaceSection: 72.0,
    background: Color(0xFF08090C),
    foreground: Color(0xFFF2F0EE),
    card: Color(0xFF181920),
    cardForeground: Color(0xFFF2F0EE),
    popover: Color(0xFF23252F),
    popoverForeground: Color(0xFFF2F0EE),
    muted: Color(0xFF131319),
    mutedForeground: Color(0xFF9DA1AF),
    secondary: Color(0xFF131319),
    secondaryForeground: Color(0xFFF2F0EE),
    input: Color(0xFF2D2F39),
    destructive: Color(0xFFEC6E65),
    destructiveForeground: Color(0xFF210908),
    accent2: Color(0xFF50A4CE),
  );

  @override
  MeridianTokens copyWith({
    Color? surface0,
    Color? surface1,
    Color? surface2,
    Color? surface3,
    Color? surfaceFloat,
    Color? surfaceSunken,
    Color? ink1,
    Color? ink2,
    Color? ink3,
    Color? inkInv,
    Color? hairline,
    Color? border,
    Color? borderStrong,
    Color? rim,
    double? rim2,
    double? rim3,
    double? rim4,
    double? rimShoulder2,
    double? rimShoulder3,
    double? rimShoulder4,
    Color? fresnelUnder,
    double? fresnelAlpha,
    Color? contact,
    double? contactAlpha,
    Color? shadow,
    List<BoxShadow>? elev0,
    List<BoxShadow>? elev1,
    List<BoxShadow>? elev2,
    List<BoxShadow>? elev3,
    List<BoxShadow>? elev4,
    List<BoxShadow>? elev5,
    Color? glassBg,
    double? glassAlpha,
    Color? glassBorder,
    double? glassBorderAlpha,
    double? modalAlpha,
    double? blurFloat,
    double? blurModal,
    double? blurScrim,
    double? satGlass,
    double? satModal,
    Color? scrim,
    double? scrimAlpha,
    Color? displayBg,
    double? displayAlpha,
    double? blurDisplay,
    double? satDisplay,
    double? chromePad,
    Color? primary,
    Color? primaryForeground,
    Color? primaryInk,
    Color? primarySoft,
    Color? primaryEdge,
    Color? inkEdge,
    Color? accent,
    Color? accentForeground,
    Color? accentInk,
    Color? accentSoft,
    Color? accentEdge,
    Color? brass,
    Color? brassInk,
    Color? success,
    Color? successSoft,
    Color? successInk,
    Color? successRule,
    Color? successForeground,
    Color? warning,
    Color? warningSoft,
    Color? warningInk,
    Color? warningRule,
    Color? warningForeground,
    Color? danger,
    Color? dangerSoft,
    Color? dangerInk,
    Color? dangerRule,
    Color? dangerForeground,
    Color? dangerEdge,
    Color? neutralSoft,
    Color? neutralRule,
    Color? neutralInk,
    Color? fieldA,
    double? fieldAAlpha,
    Color? fieldB,
    double? fieldBAlpha,
    Color? fieldC,
    double? fieldCAlpha,
    Color? fieldRule,
    double? fieldRuleAlpha,
    double? fieldNoise,
    double? fieldBlur,
    double? fieldIntensity,
    String? noise,
    double? stateHover,
    double? statePress,
    Color? stateMix,
    double? imgRatioCard,
    double? imgRatioHero,
    double? imgInset,
    Color? imgPlate,
    double? edge,
    Color? ring,
    double? ringWidth,
    Color? ringOffsetSurface,
    String? fontSans,
    String? fontDisplay,
    String? fontSansAr,
    String? fontDisplayAr,
    String? fontProvenance,
    String? fontMono,
    double? fsMicro,
    double? lhMicro,
    double? trMicro,
    double? fsMeta,
    double? lhMeta,
    double? trMeta,
    double? fsUi,
    double? lhUi,
    double? trUi,
    double? fsBody,
    double? lhBody,
    double? trBody,
    MeridianFluidSize? fsLead,
    double? lhLead,
    double? trLead,
    MeridianFluidSize? fsH3,
    double? lhH3,
    double? trH3,
    MeridianFluidSize? fsH2,
    double? lhH2,
    double? trH2,
    MeridianFluidSize? fsH1,
    double? lhH1,
    double? trH1,
    MeridianFluidSize? fsDisplay,
    double? lhDisplay,
    double? trDisplay,
    MeridianFluidSize? fsHero,
    double? lhHero,
    double? trHero,
    double? fwHero,
    double? fsFigInline,
    double? lhFigInline,
    double? fwFigInline,
    double? fsFigCard,
    double? lhFigCard,
    double? fwFigCard,
    double? fsFigSection,
    double? lhFigSection,
    double? fwFigSection,
    double? fsFigHero,
    double? lhFigHero,
    double? fwFigHero,
    double? trFig,
    double? fwBody,
    double? fwUi,
    double? fwHead,
    double? measureProse,
    double? measureDesc,
    double? shellMax,
    MeridianFluidSize? shellGutter,
    Cubic? easeOut,
    Cubic? easeStandard,
    Cubic? easeDrawer,
    Cubic? easeInOut,
    Cubic? easeExit,
    Cubic? easeOvershoot,
    MeridianSampledCurve? easeSpring,
    Duration? dur1,
    Duration? dur2,
    Duration? dur3,
    Duration? dur4,
    Duration? dur5,
    Duration? stagger,
    double? motionScale,
    Duration? tPress,
    Duration? tHover,
    Duration? tPanel,
    Duration? tLayer,
    double? liftY,
    double? pressY,
    double? keyDepth,
    String? originInlineStart,
    double? dir,
    double? radius,
    double? radiusSm,
    double? radiusLg,
    double? radiusPill,
    double? rowH,
    double? controlHSm,
    double? controlHMd,
    double? controlHLg,
    double? spaceUnit,
    double? spaceTight,
    double? spaceStack,
    double? spaceBlock,
    double? spaceSection,
    Color? background,
    Color? foreground,
    Color? card,
    Color? cardForeground,
    Color? popover,
    Color? popoverForeground,
    Color? muted,
    Color? mutedForeground,
    Color? secondary,
    Color? secondaryForeground,
    Color? input,
    Color? destructive,
    Color? destructiveForeground,
    Color? accent2,
  }) {
    return MeridianTokens(
      surface0: surface0 ?? this.surface0,
      surface1: surface1 ?? this.surface1,
      surface2: surface2 ?? this.surface2,
      surface3: surface3 ?? this.surface3,
      surfaceFloat: surfaceFloat ?? this.surfaceFloat,
      surfaceSunken: surfaceSunken ?? this.surfaceSunken,
      ink1: ink1 ?? this.ink1,
      ink2: ink2 ?? this.ink2,
      ink3: ink3 ?? this.ink3,
      inkInv: inkInv ?? this.inkInv,
      hairline: hairline ?? this.hairline,
      border: border ?? this.border,
      borderStrong: borderStrong ?? this.borderStrong,
      rim: rim ?? this.rim,
      rim2: rim2 ?? this.rim2,
      rim3: rim3 ?? this.rim3,
      rim4: rim4 ?? this.rim4,
      rimShoulder2: rimShoulder2 ?? this.rimShoulder2,
      rimShoulder3: rimShoulder3 ?? this.rimShoulder3,
      rimShoulder4: rimShoulder4 ?? this.rimShoulder4,
      fresnelUnder: fresnelUnder ?? this.fresnelUnder,
      fresnelAlpha: fresnelAlpha ?? this.fresnelAlpha,
      contact: contact ?? this.contact,
      contactAlpha: contactAlpha ?? this.contactAlpha,
      shadow: shadow ?? this.shadow,
      elev0: elev0 ?? this.elev0,
      elev1: elev1 ?? this.elev1,
      elev2: elev2 ?? this.elev2,
      elev3: elev3 ?? this.elev3,
      elev4: elev4 ?? this.elev4,
      elev5: elev5 ?? this.elev5,
      glassBg: glassBg ?? this.glassBg,
      glassAlpha: glassAlpha ?? this.glassAlpha,
      glassBorder: glassBorder ?? this.glassBorder,
      glassBorderAlpha: glassBorderAlpha ?? this.glassBorderAlpha,
      modalAlpha: modalAlpha ?? this.modalAlpha,
      blurFloat: blurFloat ?? this.blurFloat,
      blurModal: blurModal ?? this.blurModal,
      blurScrim: blurScrim ?? this.blurScrim,
      satGlass: satGlass ?? this.satGlass,
      satModal: satModal ?? this.satModal,
      scrim: scrim ?? this.scrim,
      scrimAlpha: scrimAlpha ?? this.scrimAlpha,
      displayBg: displayBg ?? this.displayBg,
      displayAlpha: displayAlpha ?? this.displayAlpha,
      blurDisplay: blurDisplay ?? this.blurDisplay,
      satDisplay: satDisplay ?? this.satDisplay,
      chromePad: chromePad ?? this.chromePad,
      primary: primary ?? this.primary,
      primaryForeground: primaryForeground ?? this.primaryForeground,
      primaryInk: primaryInk ?? this.primaryInk,
      primarySoft: primarySoft ?? this.primarySoft,
      primaryEdge: primaryEdge ?? this.primaryEdge,
      inkEdge: inkEdge ?? this.inkEdge,
      accent: accent ?? this.accent,
      accentForeground: accentForeground ?? this.accentForeground,
      accentInk: accentInk ?? this.accentInk,
      accentSoft: accentSoft ?? this.accentSoft,
      accentEdge: accentEdge ?? this.accentEdge,
      brass: brass ?? this.brass,
      brassInk: brassInk ?? this.brassInk,
      success: success ?? this.success,
      successSoft: successSoft ?? this.successSoft,
      successInk: successInk ?? this.successInk,
      successRule: successRule ?? this.successRule,
      successForeground: successForeground ?? this.successForeground,
      warning: warning ?? this.warning,
      warningSoft: warningSoft ?? this.warningSoft,
      warningInk: warningInk ?? this.warningInk,
      warningRule: warningRule ?? this.warningRule,
      warningForeground: warningForeground ?? this.warningForeground,
      danger: danger ?? this.danger,
      dangerSoft: dangerSoft ?? this.dangerSoft,
      dangerInk: dangerInk ?? this.dangerInk,
      dangerRule: dangerRule ?? this.dangerRule,
      dangerForeground: dangerForeground ?? this.dangerForeground,
      dangerEdge: dangerEdge ?? this.dangerEdge,
      neutralSoft: neutralSoft ?? this.neutralSoft,
      neutralRule: neutralRule ?? this.neutralRule,
      neutralInk: neutralInk ?? this.neutralInk,
      fieldA: fieldA ?? this.fieldA,
      fieldAAlpha: fieldAAlpha ?? this.fieldAAlpha,
      fieldB: fieldB ?? this.fieldB,
      fieldBAlpha: fieldBAlpha ?? this.fieldBAlpha,
      fieldC: fieldC ?? this.fieldC,
      fieldCAlpha: fieldCAlpha ?? this.fieldCAlpha,
      fieldRule: fieldRule ?? this.fieldRule,
      fieldRuleAlpha: fieldRuleAlpha ?? this.fieldRuleAlpha,
      fieldNoise: fieldNoise ?? this.fieldNoise,
      fieldBlur: fieldBlur ?? this.fieldBlur,
      fieldIntensity: fieldIntensity ?? this.fieldIntensity,
      noise: noise ?? this.noise,
      stateHover: stateHover ?? this.stateHover,
      statePress: statePress ?? this.statePress,
      stateMix: stateMix ?? this.stateMix,
      imgRatioCard: imgRatioCard ?? this.imgRatioCard,
      imgRatioHero: imgRatioHero ?? this.imgRatioHero,
      imgInset: imgInset ?? this.imgInset,
      imgPlate: imgPlate ?? this.imgPlate,
      edge: edge ?? this.edge,
      ring: ring ?? this.ring,
      ringWidth: ringWidth ?? this.ringWidth,
      ringOffsetSurface: ringOffsetSurface ?? this.ringOffsetSurface,
      fontSans: fontSans ?? this.fontSans,
      fontDisplay: fontDisplay ?? this.fontDisplay,
      fontSansAr: fontSansAr ?? this.fontSansAr,
      fontDisplayAr: fontDisplayAr ?? this.fontDisplayAr,
      fontProvenance: fontProvenance ?? this.fontProvenance,
      fontMono: fontMono ?? this.fontMono,
      fsMicro: fsMicro ?? this.fsMicro,
      lhMicro: lhMicro ?? this.lhMicro,
      trMicro: trMicro ?? this.trMicro,
      fsMeta: fsMeta ?? this.fsMeta,
      lhMeta: lhMeta ?? this.lhMeta,
      trMeta: trMeta ?? this.trMeta,
      fsUi: fsUi ?? this.fsUi,
      lhUi: lhUi ?? this.lhUi,
      trUi: trUi ?? this.trUi,
      fsBody: fsBody ?? this.fsBody,
      lhBody: lhBody ?? this.lhBody,
      trBody: trBody ?? this.trBody,
      fsLead: fsLead ?? this.fsLead,
      lhLead: lhLead ?? this.lhLead,
      trLead: trLead ?? this.trLead,
      fsH3: fsH3 ?? this.fsH3,
      lhH3: lhH3 ?? this.lhH3,
      trH3: trH3 ?? this.trH3,
      fsH2: fsH2 ?? this.fsH2,
      lhH2: lhH2 ?? this.lhH2,
      trH2: trH2 ?? this.trH2,
      fsH1: fsH1 ?? this.fsH1,
      lhH1: lhH1 ?? this.lhH1,
      trH1: trH1 ?? this.trH1,
      fsDisplay: fsDisplay ?? this.fsDisplay,
      lhDisplay: lhDisplay ?? this.lhDisplay,
      trDisplay: trDisplay ?? this.trDisplay,
      fsHero: fsHero ?? this.fsHero,
      lhHero: lhHero ?? this.lhHero,
      trHero: trHero ?? this.trHero,
      fwHero: fwHero ?? this.fwHero,
      fsFigInline: fsFigInline ?? this.fsFigInline,
      lhFigInline: lhFigInline ?? this.lhFigInline,
      fwFigInline: fwFigInline ?? this.fwFigInline,
      fsFigCard: fsFigCard ?? this.fsFigCard,
      lhFigCard: lhFigCard ?? this.lhFigCard,
      fwFigCard: fwFigCard ?? this.fwFigCard,
      fsFigSection: fsFigSection ?? this.fsFigSection,
      lhFigSection: lhFigSection ?? this.lhFigSection,
      fwFigSection: fwFigSection ?? this.fwFigSection,
      fsFigHero: fsFigHero ?? this.fsFigHero,
      lhFigHero: lhFigHero ?? this.lhFigHero,
      fwFigHero: fwFigHero ?? this.fwFigHero,
      trFig: trFig ?? this.trFig,
      fwBody: fwBody ?? this.fwBody,
      fwUi: fwUi ?? this.fwUi,
      fwHead: fwHead ?? this.fwHead,
      measureProse: measureProse ?? this.measureProse,
      measureDesc: measureDesc ?? this.measureDesc,
      shellMax: shellMax ?? this.shellMax,
      shellGutter: shellGutter ?? this.shellGutter,
      easeOut: easeOut ?? this.easeOut,
      easeStandard: easeStandard ?? this.easeStandard,
      easeDrawer: easeDrawer ?? this.easeDrawer,
      easeInOut: easeInOut ?? this.easeInOut,
      easeExit: easeExit ?? this.easeExit,
      easeOvershoot: easeOvershoot ?? this.easeOvershoot,
      easeSpring: easeSpring ?? this.easeSpring,
      dur1: dur1 ?? this.dur1,
      dur2: dur2 ?? this.dur2,
      dur3: dur3 ?? this.dur3,
      dur4: dur4 ?? this.dur4,
      dur5: dur5 ?? this.dur5,
      stagger: stagger ?? this.stagger,
      motionScale: motionScale ?? this.motionScale,
      tPress: tPress ?? this.tPress,
      tHover: tHover ?? this.tHover,
      tPanel: tPanel ?? this.tPanel,
      tLayer: tLayer ?? this.tLayer,
      liftY: liftY ?? this.liftY,
      pressY: pressY ?? this.pressY,
      keyDepth: keyDepth ?? this.keyDepth,
      originInlineStart: originInlineStart ?? this.originInlineStart,
      dir: dir ?? this.dir,
      radius: radius ?? this.radius,
      radiusSm: radiusSm ?? this.radiusSm,
      radiusLg: radiusLg ?? this.radiusLg,
      radiusPill: radiusPill ?? this.radiusPill,
      rowH: rowH ?? this.rowH,
      controlHSm: controlHSm ?? this.controlHSm,
      controlHMd: controlHMd ?? this.controlHMd,
      controlHLg: controlHLg ?? this.controlHLg,
      spaceUnit: spaceUnit ?? this.spaceUnit,
      spaceTight: spaceTight ?? this.spaceTight,
      spaceStack: spaceStack ?? this.spaceStack,
      spaceBlock: spaceBlock ?? this.spaceBlock,
      spaceSection: spaceSection ?? this.spaceSection,
      background: background ?? this.background,
      foreground: foreground ?? this.foreground,
      card: card ?? this.card,
      cardForeground: cardForeground ?? this.cardForeground,
      popover: popover ?? this.popover,
      popoverForeground: popoverForeground ?? this.popoverForeground,
      muted: muted ?? this.muted,
      mutedForeground: mutedForeground ?? this.mutedForeground,
      secondary: secondary ?? this.secondary,
      secondaryForeground: secondaryForeground ?? this.secondaryForeground,
      input: input ?? this.input,
      destructive: destructive ?? this.destructive,
      destructiveForeground: destructiveForeground ?? this.destructiveForeground,
      accent2: accent2 ?? this.accent2,
    );
  }

  @override
  MeridianTokens lerp(covariant ThemeExtension<MeridianTokens>? other, double t) {
    if (other is! MeridianTokens) return this;
    return MeridianTokens(
      surface0: Color.lerp(surface0, other.surface0, t)!,
      surface1: Color.lerp(surface1, other.surface1, t)!,
      surface2: Color.lerp(surface2, other.surface2, t)!,
      surface3: Color.lerp(surface3, other.surface3, t)!,
      surfaceFloat: Color.lerp(surfaceFloat, other.surfaceFloat, t)!,
      surfaceSunken: Color.lerp(surfaceSunken, other.surfaceSunken, t)!,
      ink1: Color.lerp(ink1, other.ink1, t)!,
      ink2: Color.lerp(ink2, other.ink2, t)!,
      ink3: Color.lerp(ink3, other.ink3, t)!,
      inkInv: Color.lerp(inkInv, other.inkInv, t)!,
      hairline: Color.lerp(hairline, other.hairline, t)!,
      border: Color.lerp(border, other.border, t)!,
      borderStrong: Color.lerp(borderStrong, other.borderStrong, t)!,
      rim: Color.lerp(rim, other.rim, t)!,
      rim2: _lerpDouble(rim2, other.rim2, t),
      rim3: _lerpDouble(rim3, other.rim3, t),
      rim4: _lerpDouble(rim4, other.rim4, t),
      rimShoulder2: _lerpDouble(rimShoulder2, other.rimShoulder2, t),
      rimShoulder3: _lerpDouble(rimShoulder3, other.rimShoulder3, t),
      rimShoulder4: _lerpDouble(rimShoulder4, other.rimShoulder4, t),
      fresnelUnder: Color.lerp(fresnelUnder, other.fresnelUnder, t)!,
      fresnelAlpha: _lerpDouble(fresnelAlpha, other.fresnelAlpha, t),
      contact: Color.lerp(contact, other.contact, t)!,
      contactAlpha: _lerpDouble(contactAlpha, other.contactAlpha, t),
      shadow: Color.lerp(shadow, other.shadow, t)!,
      elev0: BoxShadow.lerpList(elev0, other.elev0, t)!,
      elev1: BoxShadow.lerpList(elev1, other.elev1, t)!,
      elev2: BoxShadow.lerpList(elev2, other.elev2, t)!,
      elev3: BoxShadow.lerpList(elev3, other.elev3, t)!,
      elev4: BoxShadow.lerpList(elev4, other.elev4, t)!,
      elev5: BoxShadow.lerpList(elev5, other.elev5, t)!,
      glassBg: Color.lerp(glassBg, other.glassBg, t)!,
      glassAlpha: _lerpDouble(glassAlpha, other.glassAlpha, t),
      glassBorder: Color.lerp(glassBorder, other.glassBorder, t)!,
      glassBorderAlpha: _lerpDouble(glassBorderAlpha, other.glassBorderAlpha, t),
      modalAlpha: _lerpDouble(modalAlpha, other.modalAlpha, t),
      blurFloat: _lerpDouble(blurFloat, other.blurFloat, t),
      blurModal: _lerpDouble(blurModal, other.blurModal, t),
      blurScrim: _lerpDouble(blurScrim, other.blurScrim, t),
      satGlass: _lerpDouble(satGlass, other.satGlass, t),
      satModal: _lerpDouble(satModal, other.satModal, t),
      scrim: Color.lerp(scrim, other.scrim, t)!,
      scrimAlpha: _lerpDouble(scrimAlpha, other.scrimAlpha, t),
      displayBg: Color.lerp(displayBg, other.displayBg, t)!,
      displayAlpha: _lerpDouble(displayAlpha, other.displayAlpha, t),
      blurDisplay: _lerpDouble(blurDisplay, other.blurDisplay, t),
      satDisplay: _lerpDouble(satDisplay, other.satDisplay, t),
      chromePad: _lerpDouble(chromePad, other.chromePad, t),
      primary: Color.lerp(primary, other.primary, t)!,
      primaryForeground: Color.lerp(primaryForeground, other.primaryForeground, t)!,
      primaryInk: Color.lerp(primaryInk, other.primaryInk, t)!,
      primarySoft: Color.lerp(primarySoft, other.primarySoft, t)!,
      primaryEdge: Color.lerp(primaryEdge, other.primaryEdge, t)!,
      inkEdge: Color.lerp(inkEdge, other.inkEdge, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      accentForeground: Color.lerp(accentForeground, other.accentForeground, t)!,
      accentInk: Color.lerp(accentInk, other.accentInk, t)!,
      accentSoft: Color.lerp(accentSoft, other.accentSoft, t)!,
      accentEdge: Color.lerp(accentEdge, other.accentEdge, t)!,
      brass: Color.lerp(brass, other.brass, t)!,
      brassInk: Color.lerp(brassInk, other.brassInk, t)!,
      success: Color.lerp(success, other.success, t)!,
      successSoft: Color.lerp(successSoft, other.successSoft, t)!,
      successInk: Color.lerp(successInk, other.successInk, t)!,
      successRule: Color.lerp(successRule, other.successRule, t)!,
      successForeground: Color.lerp(successForeground, other.successForeground, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      warningSoft: Color.lerp(warningSoft, other.warningSoft, t)!,
      warningInk: Color.lerp(warningInk, other.warningInk, t)!,
      warningRule: Color.lerp(warningRule, other.warningRule, t)!,
      warningForeground: Color.lerp(warningForeground, other.warningForeground, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      dangerSoft: Color.lerp(dangerSoft, other.dangerSoft, t)!,
      dangerInk: Color.lerp(dangerInk, other.dangerInk, t)!,
      dangerRule: Color.lerp(dangerRule, other.dangerRule, t)!,
      dangerForeground: Color.lerp(dangerForeground, other.dangerForeground, t)!,
      dangerEdge: Color.lerp(dangerEdge, other.dangerEdge, t)!,
      neutralSoft: Color.lerp(neutralSoft, other.neutralSoft, t)!,
      neutralRule: Color.lerp(neutralRule, other.neutralRule, t)!,
      neutralInk: Color.lerp(neutralInk, other.neutralInk, t)!,
      fieldA: Color.lerp(fieldA, other.fieldA, t)!,
      fieldAAlpha: _lerpDouble(fieldAAlpha, other.fieldAAlpha, t),
      fieldB: Color.lerp(fieldB, other.fieldB, t)!,
      fieldBAlpha: _lerpDouble(fieldBAlpha, other.fieldBAlpha, t),
      fieldC: Color.lerp(fieldC, other.fieldC, t)!,
      fieldCAlpha: _lerpDouble(fieldCAlpha, other.fieldCAlpha, t),
      fieldRule: Color.lerp(fieldRule, other.fieldRule, t)!,
      fieldRuleAlpha: _lerpDouble(fieldRuleAlpha, other.fieldRuleAlpha, t),
      fieldNoise: _lerpDouble(fieldNoise, other.fieldNoise, t),
      fieldBlur: _lerpDouble(fieldBlur, other.fieldBlur, t),
      fieldIntensity: _lerpDouble(fieldIntensity, other.fieldIntensity, t),
      noise: t < 0.5 ? noise : other.noise,
      stateHover: _lerpDouble(stateHover, other.stateHover, t),
      statePress: _lerpDouble(statePress, other.statePress, t),
      stateMix: Color.lerp(stateMix, other.stateMix, t)!,
      imgRatioCard: _lerpDouble(imgRatioCard, other.imgRatioCard, t),
      imgRatioHero: _lerpDouble(imgRatioHero, other.imgRatioHero, t),
      imgInset: _lerpDouble(imgInset, other.imgInset, t),
      imgPlate: Color.lerp(imgPlate, other.imgPlate, t)!,
      edge: _lerpDouble(edge, other.edge, t),
      ring: Color.lerp(ring, other.ring, t)!,
      ringWidth: _lerpDouble(ringWidth, other.ringWidth, t),
      ringOffsetSurface: Color.lerp(ringOffsetSurface, other.ringOffsetSurface, t)!,
      fontSans: t < 0.5 ? fontSans : other.fontSans,
      fontDisplay: t < 0.5 ? fontDisplay : other.fontDisplay,
      fontSansAr: t < 0.5 ? fontSansAr : other.fontSansAr,
      fontDisplayAr: t < 0.5 ? fontDisplayAr : other.fontDisplayAr,
      fontProvenance: t < 0.5 ? fontProvenance : other.fontProvenance,
      fontMono: t < 0.5 ? fontMono : other.fontMono,
      fsMicro: _lerpDouble(fsMicro, other.fsMicro, t),
      lhMicro: _lerpDouble(lhMicro, other.lhMicro, t),
      trMicro: _lerpDouble(trMicro, other.trMicro, t),
      fsMeta: _lerpDouble(fsMeta, other.fsMeta, t),
      lhMeta: _lerpDouble(lhMeta, other.lhMeta, t),
      trMeta: _lerpDouble(trMeta, other.trMeta, t),
      fsUi: _lerpDouble(fsUi, other.fsUi, t),
      lhUi: _lerpDouble(lhUi, other.lhUi, t),
      trUi: _lerpDouble(trUi, other.trUi, t),
      fsBody: _lerpDouble(fsBody, other.fsBody, t),
      lhBody: _lerpDouble(lhBody, other.lhBody, t),
      trBody: _lerpDouble(trBody, other.trBody, t),
      fsLead: MeridianFluidSize.lerp(fsLead, other.fsLead, t),
      lhLead: _lerpDouble(lhLead, other.lhLead, t),
      trLead: _lerpDouble(trLead, other.trLead, t),
      fsH3: MeridianFluidSize.lerp(fsH3, other.fsH3, t),
      lhH3: _lerpDouble(lhH3, other.lhH3, t),
      trH3: _lerpDouble(trH3, other.trH3, t),
      fsH2: MeridianFluidSize.lerp(fsH2, other.fsH2, t),
      lhH2: _lerpDouble(lhH2, other.lhH2, t),
      trH2: _lerpDouble(trH2, other.trH2, t),
      fsH1: MeridianFluidSize.lerp(fsH1, other.fsH1, t),
      lhH1: _lerpDouble(lhH1, other.lhH1, t),
      trH1: _lerpDouble(trH1, other.trH1, t),
      fsDisplay: MeridianFluidSize.lerp(fsDisplay, other.fsDisplay, t),
      lhDisplay: _lerpDouble(lhDisplay, other.lhDisplay, t),
      trDisplay: _lerpDouble(trDisplay, other.trDisplay, t),
      fsHero: MeridianFluidSize.lerp(fsHero, other.fsHero, t),
      lhHero: _lerpDouble(lhHero, other.lhHero, t),
      trHero: _lerpDouble(trHero, other.trHero, t),
      fwHero: _lerpDouble(fwHero, other.fwHero, t),
      fsFigInline: _lerpDouble(fsFigInline, other.fsFigInline, t),
      lhFigInline: _lerpDouble(lhFigInline, other.lhFigInline, t),
      fwFigInline: _lerpDouble(fwFigInline, other.fwFigInline, t),
      fsFigCard: _lerpDouble(fsFigCard, other.fsFigCard, t),
      lhFigCard: _lerpDouble(lhFigCard, other.lhFigCard, t),
      fwFigCard: _lerpDouble(fwFigCard, other.fwFigCard, t),
      fsFigSection: _lerpDouble(fsFigSection, other.fsFigSection, t),
      lhFigSection: _lerpDouble(lhFigSection, other.lhFigSection, t),
      fwFigSection: _lerpDouble(fwFigSection, other.fwFigSection, t),
      fsFigHero: _lerpDouble(fsFigHero, other.fsFigHero, t),
      lhFigHero: _lerpDouble(lhFigHero, other.lhFigHero, t),
      fwFigHero: _lerpDouble(fwFigHero, other.fwFigHero, t),
      trFig: _lerpDouble(trFig, other.trFig, t),
      fwBody: _lerpDouble(fwBody, other.fwBody, t),
      fwUi: _lerpDouble(fwUi, other.fwUi, t),
      fwHead: _lerpDouble(fwHead, other.fwHead, t),
      measureProse: _lerpDouble(measureProse, other.measureProse, t),
      measureDesc: _lerpDouble(measureDesc, other.measureDesc, t),
      shellMax: _lerpDouble(shellMax, other.shellMax, t),
      shellGutter: MeridianFluidSize.lerp(shellGutter, other.shellGutter, t),
      easeOut: t < 0.5 ? easeOut : other.easeOut,
      easeStandard: t < 0.5 ? easeStandard : other.easeStandard,
      easeDrawer: t < 0.5 ? easeDrawer : other.easeDrawer,
      easeInOut: t < 0.5 ? easeInOut : other.easeInOut,
      easeExit: t < 0.5 ? easeExit : other.easeExit,
      easeOvershoot: t < 0.5 ? easeOvershoot : other.easeOvershoot,
      easeSpring: t < 0.5 ? easeSpring : other.easeSpring,
      dur1: _lerpDuration(dur1, other.dur1, t),
      dur2: _lerpDuration(dur2, other.dur2, t),
      dur3: _lerpDuration(dur3, other.dur3, t),
      dur4: _lerpDuration(dur4, other.dur4, t),
      dur5: _lerpDuration(dur5, other.dur5, t),
      stagger: _lerpDuration(stagger, other.stagger, t),
      motionScale: _lerpDouble(motionScale, other.motionScale, t),
      tPress: _lerpDuration(tPress, other.tPress, t),
      tHover: _lerpDuration(tHover, other.tHover, t),
      tPanel: _lerpDuration(tPanel, other.tPanel, t),
      tLayer: _lerpDuration(tLayer, other.tLayer, t),
      liftY: _lerpDouble(liftY, other.liftY, t),
      pressY: _lerpDouble(pressY, other.pressY, t),
      keyDepth: _lerpDouble(keyDepth, other.keyDepth, t),
      originInlineStart: t < 0.5 ? originInlineStart : other.originInlineStart,
      dir: _lerpDouble(dir, other.dir, t),
      radius: _lerpDouble(radius, other.radius, t),
      radiusSm: _lerpDouble(radiusSm, other.radiusSm, t),
      radiusLg: _lerpDouble(radiusLg, other.radiusLg, t),
      radiusPill: _lerpDouble(radiusPill, other.radiusPill, t),
      rowH: _lerpDouble(rowH, other.rowH, t),
      controlHSm: _lerpDouble(controlHSm, other.controlHSm, t),
      controlHMd: _lerpDouble(controlHMd, other.controlHMd, t),
      controlHLg: _lerpDouble(controlHLg, other.controlHLg, t),
      spaceUnit: _lerpDouble(spaceUnit, other.spaceUnit, t),
      spaceTight: _lerpDouble(spaceTight, other.spaceTight, t),
      spaceStack: _lerpDouble(spaceStack, other.spaceStack, t),
      spaceBlock: _lerpDouble(spaceBlock, other.spaceBlock, t),
      spaceSection: _lerpDouble(spaceSection, other.spaceSection, t),
      background: Color.lerp(background, other.background, t)!,
      foreground: Color.lerp(foreground, other.foreground, t)!,
      card: Color.lerp(card, other.card, t)!,
      cardForeground: Color.lerp(cardForeground, other.cardForeground, t)!,
      popover: Color.lerp(popover, other.popover, t)!,
      popoverForeground: Color.lerp(popoverForeground, other.popoverForeground, t)!,
      muted: Color.lerp(muted, other.muted, t)!,
      mutedForeground: Color.lerp(mutedForeground, other.mutedForeground, t)!,
      secondary: Color.lerp(secondary, other.secondary, t)!,
      secondaryForeground: Color.lerp(secondaryForeground, other.secondaryForeground, t)!,
      input: Color.lerp(input, other.input, t)!,
      destructive: Color.lerp(destructive, other.destructive, t)!,
      destructiveForeground: Color.lerp(destructiveForeground, other.destructiveForeground, t)!,
      accent2: Color.lerp(accent2, other.accent2, t)!,
    );
  }
}

double _lerpDouble(double a, double b, double t) => a + (b - a) * t;

Duration _lerpDuration(Duration a, Duration b, double t) => Duration(
      microseconds:
          (a.inMicroseconds + (b.inMicroseconds - a.inMicroseconds) * t).round(),
    );

