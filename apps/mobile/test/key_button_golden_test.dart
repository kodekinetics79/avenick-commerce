import 'package:avenick/core/ui/key_button.dart';
import 'package:avenick/theme/meridian_theme.dart';
import 'package:avenick/theme/tokens.g.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'golden_matrix.dart';

void main() {
  goldenMatrix(
    'key_button',
    (BuildContext context) => Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          KeyButton(label: 'Add to cart', onPressed: () {}, size: KeyButtonSize.large),
          const SizedBox(height: 16),
          KeyButton(
            label: 'Request a quote',
            tone: KeyButtonTone.accent,
            onPressed: () {},
          ),
          const SizedBox(height: 16),
          KeyButton(label: 'Cancel order', tone: KeyButtonTone.danger, onPressed: () {}),
          const SizedBox(height: 16),
          const KeyButton(label: 'Out of stock', onPressed: null),
        ],
      ),
    ),
    surfaceSize: const Size(360, 320),
    // No expectMirrorable here: these buttons carry English labels, and glyphs
    // do not mirror. The zero-dx shadow claim is proved on a text-free subject
    // in test/elevation_mirror_test.dart instead.
  );

  group('key edge physics', () {
    testWidgets('press travel equals the edge height exactly', (WidgetTester tester) async {
      // The claim the whole component rests on. If travel < depth the key stops
      // in mid-air; if travel > depth the face slides past its own base and the
      // object stops being rigid.
      await tester.pumpWidget(
        MaterialApp(
          theme: MeridianTheme.light(),
          home: Scaffold(
            body: Center(
              child: KeyButton(label: 'Press', onPressed: () {}),
            ),
          ),
        ),
      );

      final Finder face = find.text('Press');
      final double restTop = tester.getTopLeft(face).dy;

      final TestGesture gesture =
          await tester.startGesture(tester.getCenter(find.byType(KeyButton)));
      await tester.pumpAndSettle();

      final double pressedTop = tester.getTopLeft(face).dy;
      final double travel = pressedTop - restTop;

      expect(
        travel,
        moreOrLessEquals(MeridianTokens.light.keyDepth, epsilon: 0.01),
        reason: 'The face must travel exactly keyDepth '
            '(${MeridianTokens.light.keyDepth}px) so it bottoms out on its own '
            'edge. Measured ${travel}px.',
      );

      await gesture.up();
      await tester.pumpAndSettle();
      expect(tester.getTopLeft(face).dy, moreOrLessEquals(restTop, epsilon: 0.01));
    });

    testWidgets('the button reserves edge height in its layout', (WidgetTester tester) async {
      // The edge is part of the object, not a shadow under it — so it occupies
      // real layout space. A button that pretended otherwise would overlap
      // whatever sits below it by 3px.
      await tester.pumpWidget(
        MaterialApp(
          theme: MeridianTheme.light(),
          home: Scaffold(
            body: Center(child: KeyButton(label: 'Press', onPressed: () {})),
          ),
        ),
      );

      final Size size = tester.getSize(find.byType(KeyButton));
      expect(
        size.height,
        moreOrLessEquals(
          MeridianTokens.light.controlHMd + MeridianTokens.light.keyDepth,
          epsilon: 0.01,
        ),
      );
    });

    testWidgets('no ripple: a press and a splash are different claims',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: MeridianTheme.light(),
          home: Scaffold(
            body: Center(child: KeyButton(label: 'Press', onPressed: () {})),
          ),
        ),
      );

      await tester.startGesture(tester.getCenter(find.byType(KeyButton)));
      await tester.pump(const Duration(milliseconds: 50));

      expect(find.byType(InkWell), findsNothing);
      expect(
        tester.widget<MaterialApp>(find.byType(MaterialApp)).theme!.splashFactory,
        same(NoSplash.splashFactory),
      );
    });

    testWidgets('a disabled key does not travel', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: MeridianTheme.light(),
          home: const Scaffold(
            body: Center(child: KeyButton(label: 'Press', onPressed: null)),
          ),
        ),
      );

      final double restTop = tester.getTopLeft(find.text('Press')).dy;
      await tester.startGesture(tester.getCenter(find.byType(KeyButton)));
      await tester.pumpAndSettle();
      expect(tester.getTopLeft(find.text('Press')).dy, restTop);
    });
  });
}
