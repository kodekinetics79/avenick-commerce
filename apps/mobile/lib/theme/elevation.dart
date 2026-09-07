import 'package:flutter/material.dart';

import 'tokens.g.dart';

/// The elevation ladder.
///
/// Five rungs, and the gap between rung 0 and rung 1 goes *downward*: rung 1 is
/// recessed, not raised. That is why [MeridianTokens.elev1] is an empty shadow
/// list in BOTH themes and why that is correct rather than a generation bug —
/// the web's `--elev-1` is 100% inset, and Flutter's [BoxShadow] cannot paint
/// inside a box. Giving rung 1 a drop shadow to "fix" the empty list would
/// invert the rung and float a well.
///
/// A recessed rung is therefore expressed with what Flutter *can* paint:
/// a darker fill and a hairline border. Nothing else.
enum MeridianRung {
  /// Page content. No fill of its own, no border, no shadow. It IS the ground.
  content,

  /// A well: search fields, inset lists, the tray a value sits in.
  /// Recessed — darker fill and a hairline, never a shadow.
  recessed,

  /// A card lifted off the ground.
  card,

  /// A menu, popover, or a card that has been picked up.
  raised,

  /// A bottom sheet or dialog — the top of the ladder.
  sheet,
}

/// Builders for the ladder, as [BoxDecoration]s driven entirely by
/// [MeridianTokens].
abstract final class MeridianElevation {
  /// The shadow list for [rung].
  ///
  /// Every shadow in this system has **zero horizontal offset**. There is one
  /// overhead light and it is directly overhead. That single constraint is what
  /// makes the whole elevation ladder identical under RTL with no mirroring
  /// pass at all — a shadow offset by `(2, 4)` would have to become `(-2, 4)`
  /// in Arabic, and nothing in Flutter would do that for you.
  static List<BoxShadow> shadows(MeridianTokens t, MeridianRung rung) {
    final List<BoxShadow> list = switch (rung) {
      MeridianRung.content => t.elev0,
      MeridianRung.recessed => t.elev1,
      MeridianRung.card => t.elev2,
      MeridianRung.raised => t.elev3,
      MeridianRung.sheet => t.elev4,
    };
    assert(
      list.every((BoxShadow s) => s.offset.dx == 0.0),
      'A Meridian shadow must have zero horizontal offset — one overhead '
      'light. A non-zero dx would need mirroring in RTL and nothing mirrors '
      'it. Offending rung: $rung.',
    );
    assert(
      list.every((BoxShadow s) => !_isPureBlack(s.color)),
      'Shadow colour must be hue-matched from --shadow / --contact, never '
      'pure black — a neutral shadow over a warm ground reads as dirt. '
      'Offending rung: $rung.',
    );
    return list;
  }

  /// `#000` exactly. The tokens hue-match every shadow to `--shadow`
  /// (`#151928` light, `#020308` dark) so it sits in the same family as the
  /// ground it falls on.
  static bool _isPureBlack(Color c) => c.r == 0.0 && c.g == 0.0 && c.b == 0.0;

  /// The fill for [rung].
  static Color fill(MeridianTokens t, MeridianRung rung) => switch (rung) {
        MeridianRung.content => t.surface0,
        // The whole of the recessed read lives here: a fill one step *below*
        // the ground, because the shadow that would have said it on the web is
        // inset and cannot cross over.
        MeridianRung.recessed => t.surfaceSunken,
        MeridianRung.card => t.surface2,
        MeridianRung.raised => t.surface3,
        MeridianRung.sheet => t.surfaceFloat,
      };

  /// The hairline around [rung], or `null` where the rung draws none.
  static BorderSide? _side(MeridianTokens t, MeridianRung rung) => switch (rung) {
        MeridianRung.content => null,
        MeridianRung.recessed => BorderSide(color: t.border, width: 1.0),
        MeridianRung.card => BorderSide(color: t.hairline, width: 1.0),
        MeridianRung.raised => BorderSide(color: t.hairline, width: 1.0),
        MeridianRung.sheet => BorderSide(color: t.border, width: 1.0),
      };

  /// The specular seam alpha for [rung] — the bright top lip, and the softer
  /// shoulder it fades into as the surface curves away.
  ///
  /// Returns `null` where the rung has no seam. Rung 0 has nothing to catch the
  /// light; rung 1 is *below* the ground, so its lip is in shadow, not in
  /// light — a highlight there would read as raised.
  static ({double lip, double shoulder})? seam(MeridianTokens t, MeridianRung rung) =>
      switch (rung) {
        MeridianRung.content => null,
        MeridianRung.recessed => null,
        MeridianRung.card => (lip: t.rim2, shoulder: t.rimShoulder2),
        MeridianRung.raised => (lip: t.rim3, shoulder: t.rimShoulder3),
        MeridianRung.sheet => (lip: t.rim4, shoulder: t.rimShoulder4),
      };

  /// A [BoxDecoration] for [rung].
  ///
  /// This carries fill, hairline and shadow. It does NOT carry the specular
  /// seam: a 1px top lip cannot be expressed as a [BoxDecoration] gradient
  /// because gradient stops are fractions of the box and 1px is a different
  /// fraction on a 38px control than on a 320px card. Wrap the child in
  /// [MeridianSurface] — or paint [MeridianSeamPainter] yourself — to get it.
  ///
  /// The seam is never a [BoxShadow]. Flutter would put that shadow *outside*
  /// the box, so a highlight meant to sit on the top edge would instead glow
  /// above it, which is a halo, not a lip.
  static BoxDecoration decoration(
    MeridianTokens t,
    MeridianRung rung, {
    double? radius,
    Color? fillOverride,
    BorderSide? sideOverride,
  }) {
    final double r = radius ?? t.radius;
    final BorderSide? side = sideOverride ?? _side(t, rung);
    return BoxDecoration(
      color: fillOverride ?? fill(t, rung),
      borderRadius: BorderRadius.circular(r),
      // A uniform border is the only kind Flutter will paint alongside a
      // borderRadius — a top-only Border throws at paint time.
      border: side == null ? null : Border.fromBorderSide(side),
      boxShadow: shadows(t, rung),
    );
  }
}

/// Paints the specular top seam: a hairline of [MeridianTokens.rim] along the
/// top edge, fading through the shoulder as the rounded corner turns away from
/// the light.
///
/// Drawn as a stroke in a foreground painter, not as a shadow and not as a
/// gradient fill, so its thickness is a true device pixel at any box size.
class MeridianSeamPainter extends CustomPainter {
  const MeridianSeamPainter({
    required this.rim,
    required this.lipAlpha,
    required this.shoulderAlpha,
    required this.radius,
    required this.devicePixelRatio,
  });

  final Color rim;
  final double lipAlpha;
  final double shoulderAlpha;
  final double radius;
  final double devicePixelRatio;

  @override
  void paint(Canvas canvas, Size size) {
    if (lipAlpha <= 0.0 || size.isEmpty) return;

    // One physical pixel, so the lip stays a lip at 3x and does not become a
    // 3px band.
    final double stroke = 1.0 / devicePixelRatio;
    final double inset = stroke / 2.0;
    final RRect rrect = RRect.fromRectAndRadius(
      Offset(inset, inset) & Size(size.width - stroke, size.height - stroke),
      Radius.circular(radius),
    );

    // The gradient runs top → shoulder over the corner radius, then dies. The
    // shader is horizontal-symmetric, which is the other half of why this
    // system needs no RTL mirroring.
    final double shoulderStop =
        size.height <= 0 ? 1.0 : (radius / size.height).clamp(0.04, 0.6);
    final Paint paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: <Color>[
          rim.withValues(alpha: lipAlpha),
          rim.withValues(alpha: shoulderAlpha),
          rim.withValues(alpha: 0.0),
        ],
        stops: <double>[0.0, shoulderStop, shoulderStop * 2.0 > 1.0 ? 1.0 : shoulderStop * 2.0],
      ).createShader(Offset.zero & size);

    canvas.drawRRect(rrect, paint);
  }

  @override
  bool shouldRepaint(MeridianSeamPainter old) =>
      old.rim != rim ||
      old.lipAlpha != lipAlpha ||
      old.shoulderAlpha != shoulderAlpha ||
      old.radius != radius ||
      old.devicePixelRatio != devicePixelRatio;
}

/// A rung of the ladder as a widget: fill, hairline, shadow and specular seam.
class MeridianSurface extends StatelessWidget {
  const MeridianSurface({
    required this.rung,
    required this.child,
    this.radius,
    this.fill,
    this.padding,
    this.clipContent = false,
    super.key,
  });

  final MeridianRung rung;
  final Widget child;
  final double? radius;
  final Color? fill;
  final EdgeInsetsGeometry? padding;
  final bool clipContent;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = Theme.of(context).extension<MeridianTokens>()!;
    final double r = radius ?? t.radius;
    final ({double lip, double shoulder})? s = MeridianElevation.seam(t, rung);

    Widget content = padding == null ? child : Padding(padding: padding!, child: child);
    if (clipContent) {
      content = ClipRRect(borderRadius: BorderRadius.circular(r), child: content);
    }

    return DecoratedBox(
      decoration: MeridianElevation.decoration(t, rung, radius: r, fillOverride: fill),
      child: s == null
          ? content
          : CustomPaint(
              foregroundPainter: MeridianSeamPainter(
                rim: t.rim,
                lipAlpha: s.lip,
                shoulderAlpha: s.shoulder,
                radius: r,
                devicePixelRatio: MediaQuery.devicePixelRatioOf(context),
              ),
              child: content,
            ),
    );
  }
}
