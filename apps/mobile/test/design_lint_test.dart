import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Source-level rules the Dart analyzer cannot express.
///
/// Both rules below are real defects that pass `flutter analyze`, compile
/// cleanly, and look perfect in an English screenshot. This file is where they
/// are actually caught.
void main() {
  final Directory lib = Directory('lib');

  List<File> dartSources() => lib
      .listSync(recursive: true)
      .whereType<File>()
      .where((File f) => f.path.endsWith('.dart'))
      .where((File f) => !f.path.endsWith('.g.dart'))
      .where((File f) => !f.path.endsWith('.freezed.dart'))
      .toList();

  group('directional layout', () {
    test('no EdgeInsets.only(left:) or EdgeInsets.only(right:)', () {
      // `EdgeInsets.only(left: 16)` is 16 logical pixels from the *physical*
      // left edge of the screen. In Arabic the content runs the other way, so
      // that padding lands on the trailing side of the element and the leading
      // side gets nothing — the label butts against the container wall while a
      // gap floats uselessly on the far side.
      //
      // `EdgeInsetsDirectional.only(start: 16)` is 16 pixels from the edge the
      // reader starts at, which is what was always meant.
      //
      // The analyzer will never flag this: both are valid, both are the same
      // type family, and the LTR render is identical. Only Arabic shows it.
      final RegExp offender = RegExp(
        r'EdgeInsets\.only\s*\(\s*(left|right)\s*:',
        multiLine: true,
      );
      final List<String> violations = <String>[];

      for (final File f in dartSources()) {
        final List<String> lines = f.readAsLinesSync();
        for (int i = 0; i < lines.length; i++) {
          if (offender.hasMatch(lines[i])) {
            violations.add('${f.path}:${i + 1}  ${lines[i].trim()}');
          }
        }
      }

      expect(
        violations,
        isEmpty,
        reason: 'Use EdgeInsetsDirectional.only(start:/end:) instead.\n'
            '${violations.join('\n')}',
      );
    });

    test('no Positioned(left:/right:) in favour of PositionedDirectional', () {
      final RegExp offender = RegExp(r'Positioned\s*\(\s*(left|right)\s*:');
      final List<String> violations = <String>[];

      for (final File f in dartSources()) {
        final List<String> lines = f.readAsLinesSync();
        for (int i = 0; i < lines.length; i++) {
          if (offender.hasMatch(lines[i])) {
            violations.add('${f.path}:${i + 1}  ${lines[i].trim()}');
          }
        }
      }

      expect(violations, isEmpty, reason: violations.join('\n'));
    });
  });

  group('design tokens', () {
    test('no hardcoded Color(0x…) outside tokens.g.dart', () {
      // A literal colour is a value that cannot follow the theme, cannot
      // follow a token change in globals.css, and — the one that actually
      // hurts — is very often only correct in one of the two themes. A
      // `Color(0xFF161922)` that reads as ink on the light ground is invisible
      // on the dark one, and nothing warns.
      //
      // The exemption is tokens.g.dart, which is where every literal in the
      // system is supposed to live because it is generated from the stylesheet.
      final RegExp offender = RegExp(r'\bColor\s*\(\s*0x[0-9a-fA-F]+', multiLine: true);
      final List<String> violations = <String>[];

      for (final File f in dartSources()) {
        if (f.path.endsWith('tokens.g.dart')) continue;
        final List<String> lines = f.readAsLinesSync();
        for (int i = 0; i < lines.length; i++) {
          final String line = lines[i];
          if (line.trimLeft().startsWith('//')) continue;
          if (offender.hasMatch(line)) {
            violations.add('${f.path}:${i + 1}  ${line.trim()}');
          }
        }
      }

      expect(
        violations,
        isEmpty,
        reason:
            'Read the colour from MeridianTokens (context.tokens.…) instead. '
            'If the design genuinely needs a new colour, add it to '
            'packages/ui/src/globals.css and regenerate.\n'
            '${violations.join('\n')}',
      );
    });

    test('no Colors.* Material palette constants outside transparent', () {
      // Colors.grey.shade200 is not in this design system. Colors.transparent
      // is not a colour — it is the absence of one — so it is allowed.
      final RegExp offender = RegExp(r'\bColors\.(?!transparent\b)[a-zA-Z]');
      final List<String> violations = <String>[];

      for (final File f in dartSources()) {
        final List<String> lines = f.readAsLinesSync();
        for (int i = 0; i < lines.length; i++) {
          final String line = lines[i];
          if (line.trimLeft().startsWith('//')) continue;
          if (offender.hasMatch(line)) {
            violations.add('${f.path}:${i + 1}  ${line.trim()}');
          }
        }
      }

      expect(violations, isEmpty, reason: violations.join('\n'));
    });
  });

  group('elevation', () {
    test('every BoxShadow literal has a zero horizontal offset', () {
      // One overhead light. This is what lets the entire elevation ladder work
      // unchanged in Arabic with no mirroring pass — and nothing in Flutter
      // would mirror a shadow for you if it drifted.
      //
      // Checked at source level as well as in the runtime assert in
      // MeridianElevation.shadows, because a literal shadow written directly
      // into a widget never passes through that function.
      final RegExp shadowOffset =
          RegExp(r'BoxShadow\s*\([^)]*offset:\s*Offset\(\s*(-?[\d.]+)');
      final List<String> violations = <String>[];

      for (final File f in dartSources()) {
        final String src = f.readAsStringSync();
        for (final RegExpMatch m in shadowOffset.allMatches(src)) {
          final double dx = double.parse(m.group(1)!);
          if (dx != 0.0) {
            violations.add('${f.path}: BoxShadow with dx=$dx');
          }
        }
      }

      expect(violations, isEmpty, reason: violations.join('\n'));
    });
  });
}
