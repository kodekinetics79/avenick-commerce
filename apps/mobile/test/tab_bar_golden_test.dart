import 'package:avenick/app/tab_scaffold.dart';
import 'package:avenick/theme/meridian_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'golden_matrix.dart';

void main() {
  goldenMatrix(
    'tab_bar_empty_cart',
    (BuildContext context) => MeridianTabBar(
      currentIndex: 0,
      onTap: (int _) {},
    ),
    surfaceSize: const Size(390, 120),
  );

  goldenMatrix(
    'tab_bar_with_lines',
    (BuildContext context) => MeridianTabBar(
      currentIndex: 2,
      // THREE LINES — from a cart that holds 500 units of one part, 12 of
      // another and 1 of a third. The badge must read 3.
      cartLineCount: 3,
      onTap: (int _) {},
    ),
    surfaceSize: const Size(390, 120),
  );

  group('cart badge', () {
    Future<void> pumpBar(WidgetTester tester, int lines) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: MeridianTheme.light(),
          home: Scaffold(
            body: Align(
              alignment: Alignment.bottomCenter,
              child: MeridianTabBar(
                currentIndex: 0,
                cartLineCount: lines,
                onTap: (int _) {},
              ),
            ),
          ),
        ),
      );
    }

    testWidgets('no badge at zero', (WidgetTester tester) async {
      // A "0" badge is a permanent small alarm about the absence of a thing.
      await pumpBar(tester, 0);
      expect(find.text('0'), findsNothing);
    });

    testWidgets('counts lines, never units', (WidgetTester tester) async {
      // The B2B case that makes this rule exist: 500 units of one part is ONE
      // line. Rendering "500" in a 16px circle tells the buyer a quantity they
      // typed themselves and reads as an error.
      await pumpBar(tester, 1);
      expect(find.text('1'), findsOneWidget);
      expect(find.text('500'), findsNothing);
    });

    testWidgets('caps at 9+', (WidgetTester tester) async {
      await pumpBar(tester, 24);
      expect(find.text('9+'), findsOneWidget);
    });

    testWidgets('is Western-numeralled in Arabic', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: MeridianTheme.light(),
          locale: const Locale('ar'),
          supportedLocales: const <Locale>[Locale('en'), Locale('ar')],
          localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: Directionality(
            textDirection: TextDirection.rtl,
            child: Scaffold(
              body: Align(
                alignment: Alignment.bottomCenter,
                child: MeridianTabBar(
                  currentIndex: 2,
                  cartLineCount: 3,
                  onTap: (int _) {},
                ),
              ),
            ),
          ),
        ),
      );
      expect(find.text('3'), findsOneWidget);
      expect(find.text('٣'), findsNothing);
    });
  });

  group('the bar is opaque', () {
    testWidgets('no BackdropFilter over the scrolling content',
        (WidgetTester tester) async {
      // A BackdropFilter is a full-rect saveLayer every frame, over a list that
      // is scrolling — and it makes a price in chrome depend on what happened
      // to scroll under it.
      await tester.pumpWidget(
        MaterialApp(
          theme: MeridianTheme.light(),
          home: Scaffold(
            body: Align(
              alignment: Alignment.bottomCenter,
              child: MeridianTabBar(currentIndex: 0, onTap: (int _) {}),
            ),
          ),
        ),
      );
      expect(find.byType(BackdropFilter), findsNothing);
    });
  });
}
