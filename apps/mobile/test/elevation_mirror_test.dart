import 'package:avenick/theme/elevation.dart';
import 'package:avenick/theme/meridian_theme.dart';
import 'package:avenick/theme/tokens.g.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'golden_matrix.dart';

/// A text-free elevation ladder.
///
/// No glyphs, so its RTL render must be a pixel-exact mirror of its LTR one.
/// That is the whole assertion: it is what "every shadow has zero horizontal
/// offset" actually means, measured rather than asserted in a comment.
Widget _ladder(BuildContext context) {
  final MeridianTokens t = context.tokens;
  return Padding(
    padding: EdgeInsetsDirectional.all(t.spaceStack),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        for (final MeridianRung rung in MeridianRung.values) ...<Widget>[
          MeridianSurface(
            rung: rung,
            child: const SizedBox(width: 200, height: 40),
          ),
          SizedBox(height: t.spaceStack),
        ],
      ],
    ),
  );
}

void main() {
  goldenMatrix(
    'elevation_ladder',
    _ladder,
    surfaceSize: const Size(320, 400),
    // The claim, measured.
    expectMirrorable: true,
  );

  group('the ladder', () {
    test('elev1 is empty in BOTH themes, and that is correct', () {
      // The web's --elev-1 is 100% inset and Flutter cannot paint inside a box,
      // so the generator legitimately drops it to nothing. Giving the recessed
      // rung a drop shadow to "fix" the empty list would invert it and float a
      // well. This test exists so that nobody does.
      expect(MeridianTokens.light.elev1, isEmpty);
      expect(MeridianTokens.dark.elev1, isEmpty);
      expect(MeridianElevation.shadows(MeridianTokens.light, MeridianRung.recessed), isEmpty);
      expect(MeridianElevation.shadows(MeridianTokens.dark, MeridianRung.recessed), isEmpty);
    });

    test('the recessed rung reads as below, in both themes', () {
      // With no shadow available, fill and hairline carry the whole recession.
      //
      // The obvious invariant — "a well is darker than its ground" — is NOT
      // true system-wide, and it is worth knowing why. In light,
      // surfaceSunken (#F0EEEA) is duly darker than surface0 (#FAF9F7). In
      // dark, surfaceSunken (#090A0E) is a hair LIGHTER than surface0
      // (#08090C): the ground is already within a few points of black, so a
      // darker well would simply be a black hole with no readable edge. The
      // dark theme states recession with the hairline instead and keeps the
      // fill barely off the ground.
      //
      // So the invariant that actually holds in both is directional rather
      // than absolute: a well sits BELOW the raised rungs, whichever way the
      // theme's raised direction happens to run.
      for (final MeridianTokens t in <MeridianTokens>[
        MeridianTokens.light,
        MeridianTokens.dark,
      ]) {
        final Color ground = MeridianElevation.fill(t, MeridianRung.content);
        final Color well = MeridianElevation.fill(t, MeridianRung.recessed);
        final Color card = MeridianElevation.fill(t, MeridianRung.card);

        expect(
          well,
          isNot(ground),
          reason: 'a well must not be the same colour as the ground',
        );
        expect(
          _luminance(well),
          lessThan(_luminance(card)),
          reason: 'a well must never be as light as a card, or it reads as raised',
        );
        // And the hairline is not optional on this rung — in dark it is doing
        // almost all of the work.
        expect(
          MeridianElevation.decoration(t, MeridianRung.recessed).border,
          isNotNull,
          reason: 'the recessed rung states itself with a border; without a '
              'shadow and with a near-ground fill there is nothing else',
        );
      }
    });

    test('every shadow on every rung has zero horizontal offset', () {
      for (final MeridianTokens t in <MeridianTokens>[
        MeridianTokens.light,
        MeridianTokens.dark,
      ]) {
        for (final MeridianRung rung in MeridianRung.values) {
          for (final BoxShadow s in MeridianElevation.shadows(t, rung)) {
            expect(s.offset.dx, 0.0, reason: '$rung has a shadow at dx=${s.offset.dx}');
          }
        }
      }
    });

    test('no shadow is pure black — every one is hue-matched', () {
      for (final MeridianTokens t in <MeridianTokens>[
        MeridianTokens.light,
        MeridianTokens.dark,
      ]) {
        for (final MeridianRung rung in MeridianRung.values) {
          for (final BoxShadow s in MeridianElevation.shadows(t, rung)) {
            expect(
              s.color.r == 0.0 && s.color.g == 0.0 && s.color.b == 0.0,
              isFalse,
              reason: 'a neutral shadow over a warm ground reads as dirt',
            );
          }
        }
      }
    });

    test('the ladder climbs — each raised rung carries more shadow than the last', () {
      for (final MeridianTokens t in <MeridianTokens>[
        MeridianTokens.light,
        MeridianTokens.dark,
      ]) {
        double weight(MeridianRung r) => MeridianElevation.shadows(t, r)
            .fold<double>(0, (double a, BoxShadow s) => a + s.blurRadius * s.color.a);

        expect(weight(MeridianRung.card), greaterThan(weight(MeridianRung.recessed)));
        expect(weight(MeridianRung.raised), greaterThan(weight(MeridianRung.card)));
        expect(weight(MeridianRung.sheet), greaterThan(weight(MeridianRung.raised)));
      }
    });

    testWidgets('the specular seam is painted, never shadowed',
        (WidgetTester tester) async {
      // A BoxShadow sits OUTSIDE the box, so a highlight meant for the top edge
      // would glow above the card instead of catching its lip.
      await tester.pumpWidget(
        MaterialApp(
          theme: MeridianTheme.light(),
          home: const Scaffold(
            body: Center(
              child: MeridianSurface(
                rung: MeridianRung.card,
                child: SizedBox(width: 100, height: 60),
              ),
            ),
          ),
        ),
      );

      final CustomPaint paint = tester.widgetList<CustomPaint>(find.byType(CustomPaint))
          .firstWhere((CustomPaint p) => p.foregroundPainter is MeridianSeamPainter);
      final MeridianSeamPainter seam = paint.foregroundPainter! as MeridianSeamPainter;
      expect(seam.lipAlpha, MeridianTokens.light.rim2);
      expect(seam.rim, MeridianTokens.light.rim);
    });
  });
}

double _luminance(Color c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
