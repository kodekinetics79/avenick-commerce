import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:avenick/theme/meridian_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
// `Override` is not re-exported from flutter_riverpod's barrel in 3.x.
import 'package:riverpod/misc.dart' show Override;

/// One cell of the matrix.
@immutable
class GoldenVariant {
  const GoldenVariant({
    required this.suffix,
    required this.locale,
    required this.textDirection,
    required this.brightness,
  });

  final String suffix;
  final Locale locale;
  final TextDirection textDirection;
  final Brightness brightness;

  bool get isDark => brightness == Brightness.dark;
  bool get isRtl => textDirection == TextDirection.rtl;
}

/// {LTR, RTL} × {light, dark}. Four cells, always all four.
const List<GoldenVariant> goldenVariants = <GoldenVariant>[
  GoldenVariant(
    suffix: 'ltr_light',
    locale: Locale('en'),
    textDirection: TextDirection.ltr,
    brightness: Brightness.light,
  ),
  GoldenVariant(
    suffix: 'ltr_dark',
    locale: Locale('en'),
    textDirection: TextDirection.ltr,
    brightness: Brightness.dark,
  ),
  GoldenVariant(
    suffix: 'rtl_light',
    locale: Locale('ar'),
    textDirection: TextDirection.rtl,
    brightness: Brightness.light,
  ),
  GoldenVariant(
    suffix: 'rtl_dark',
    locale: Locale('ar'),
    textDirection: TextDirection.rtl,
    brightness: Brightness.dark,
  ),
];

/// Renders [builder] into all four cells of {LTR, RTL} × {light, dark} and
/// compares each against `goldens/<name>.<suffix>.png`.
///
/// **Four files or none.** The RTL mandate has no other mechanical defence in
/// this codebase: nothing in Dart's type system stops a developer writing
/// `EdgeInsets.only(left: 16)`, and nothing in code review reliably catches it
/// either, because the LTR screenshot in the PR looks perfect. The mirrored
/// render is the only artefact that shows the bug, so it has to be produced
/// automatically for every component, every time — which means the helper must
/// not offer a way to skip it. There is no `directions:` parameter here on
/// purpose.
///
/// It is also what proves the zero-horizontal-offset shadow claim. Every shadow
/// in the elevation ladder has `dx == 0`, so a component's RTL render should be
/// a pixel-exact mirror of its LTR one. [expectMirrorable] asserts that
/// directly: both renders are rasterised and one is compared against the other
/// flipped. A shadow that drifted to `dx: 2` fails here with a pixel count,
/// not with a bug report six months later from Dubai.
///
/// **[expectMirrorable] is only meaningful for a subject with no text in it.**
/// Glyphs do not mirror — 'Add to cart' reads left-to-right in an Arabic
/// layout, and correctly so — so a labelled component's RTL render is a mirror
/// of its *geometry* but not of its *pixels*, and the assertion would fail on
/// something that is right. Point it at the geometry: a bare elevation ladder,
/// a chrome bar with its labels removed, a shadowed card. See
/// test/elevation_mirror_test.dart.
void goldenMatrix(
  String name,
  Widget Function(BuildContext context) builder, {
  Size surfaceSize = const Size(400, 300),
  bool expectMirrorable = false,
  List<Override> overrides = const <Override>[],
  double devicePixelRatio = 1.0,
}) {
  for (final GoldenVariant v in goldenVariants) {
    testWidgets('$name — ${v.suffix}', (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(surfaceSize);
      addTearDown(() => tester.binding.setSurfaceSize(null));
      tester.view.devicePixelRatio = devicePixelRatio;
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        ProviderScope(
          overrides: overrides,
          child: MaterialApp(
            debugShowCheckedModeBanner: false,
            locale: v.locale,
            supportedLocales: const <Locale>[Locale('en'), Locale('ar')],
            localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            theme: v.isDark
                ? MeridianTheme.dark(viewportWidth: surfaceSize.width)
                : MeridianTheme.light(viewportWidth: surfaceSize.width),
            home: Directionality(
              textDirection: v.textDirection,
              child: Builder(
                builder: (BuildContext context) => Scaffold(
                  body: Center(child: builder(context)),
                ),
              ),
            ),
          ),
        ),
      );

      // Settle animations deterministically. `pumpAndSettle` would hang on the
      // skeleton shimmer, which repeats forever by design.
      await tester.pump(const Duration(milliseconds: 400));

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/$name.${v.suffix}.png'),
      );
    });
  }

  if (expectMirrorable) {
    testWidgets('$name — RTL is a pure mirror of LTR (zero-dx shadows)',
        (WidgetTester tester) async {
      final List<ByteData> shots = <ByteData>[];

      for (final TextDirection dir in <TextDirection>[
        TextDirection.ltr,
        TextDirection.rtl,
      ]) {
        await tester.binding.setSurfaceSize(surfaceSize);
        await tester.pumpWidget(
          ProviderScope(
            overrides: overrides,
            child: MaterialApp(
              debugShowCheckedModeBanner: false,
              locale: const Locale('en'),
              theme: MeridianTheme.light(viewportWidth: surfaceSize.width),
              home: Directionality(
                textDirection: dir,
                child: RepaintBoundary(
                  key: _mirrorBoundaryKey,
                  child: Builder(
                    builder: (BuildContext context) => Scaffold(
                      body: Center(child: builder(context)),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.pump(const Duration(milliseconds: 400));
        // `toImage` completes on the raster thread. The widget-test binding
        // drives a fake clock and never pumps that thread, so awaiting it
        // outside `runAsync` deadlocks the test with no output at all.
        final ByteData? shot = await tester.runAsync(() => _rasterise(tester));
        shots.add(shot!);
      }
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final _Bitmap ltr = _Bitmap.fromByteData(shots[0], surfaceSize);
      final _Bitmap rtl = _Bitmap.fromByteData(shots[1], surfaceSize);
      expect(ltr.pixels.length, rtl.pixels.length);
      final int drift = ltr.mirrorDistance(rtl);
      final double fraction = drift / (ltr.width * ltr.height);

      expect(
        fraction,
        lessThanOrEqualTo(_mirrorToleranceFraction),
        reason:
            'The RTL render is not a mirror of the LTR one — $drift pixels '
            '(${(fraction * 100).toStringAsFixed(3)}%) differ by more than '
            '$_channelTolerance/255 on a channel. Something in this component '
            'has a horizontal bias that does not mirror: most often a '
            'BoxShadow with a non-zero dx, or an EdgeInsets.only(left:/right:) '
            'that should be EdgeInsetsDirectional.',
      );
    });
  }
}

/// How far a single channel may differ before a pixel counts as different.
///
/// Rasterising a rounded rectangle and rasterising its mirror do not produce
/// byte-identical antialiasing: the subpixel coverage on a left-hand arc lands
/// on different rounding than the same arc on the right, so every curved edge
/// in the subject contributes a thin seam of pixels that differ by one or two
/// units. That is a property of the rasteriser, not of the design.
///
/// A shadow that has drifted to `dx: 2`, by contrast, moves whole regions by
/// tens of units. Comparing per channel with a small tolerance separates the
/// two cleanly, where an exact-equality count cannot.
const int _channelTolerance = 8;

/// The share of pixels allowed to exceed [_channelTolerance].
///
/// Antialiasing seams are confined to edges, so they stay far below this. A
/// horizontal bias fails it by an order of magnitude.
const double _mirrorToleranceFraction = 0.002;

final GlobalKey _mirrorBoundaryKey = GlobalKey(debugLabel: 'mirror-boundary');

Future<ByteData> _rasterise(WidgetTester tester) async {
  final RenderRepaintBoundary boundary = _mirrorBoundaryKey.currentContext!
      .findRenderObject()! as RenderRepaintBoundary;
  final ui.Image image = await boundary.toImage();
  final ByteData? data = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
  image.dispose();
  return data!;
}

/// A raw RGBA bitmap, just enough of one to compare a render with its mirror.
class _Bitmap {
  _Bitmap(this.pixels, this.width, this.height);

  factory _Bitmap.fromByteData(ByteData data, Size size) => _Bitmap(
        data.buffer.asUint32List(),
        size.width.round(),
        size.height.round(),
      );

  final Uint32List pixels;
  final int width;
  final int height;

  /// How many pixels differ, beyond [_channelTolerance] on any channel,
  /// between this bitmap and [other] flipped horizontally.
  int mirrorDistance(_Bitmap other) {
    if (width != other.width || height != other.height) return width * height;
    int differing = 0;
    for (int y = 0; y < height; y++) {
      final int row = y * width;
      for (int x = 0; x < width; x++) {
        final int a = pixels[row + x];
        final int b = other.pixels[row + (width - 1 - x)];
        if (a == b) continue;
        if (_channelDelta(a, b) > _channelTolerance) differing++;
      }
    }
    return differing;
  }

  /// The largest per-channel difference between two packed RGBA pixels.
  static int _channelDelta(int a, int b) {
    int worst = 0;
    for (int shift = 0; shift < 32; shift += 8) {
      final int d = ((a >> shift) & 0xFF) - ((b >> shift) & 0xFF);
      final int m = d < 0 ? -d : d;
      if (m > worst) worst = m;
    }
    return worst;
  }
}
