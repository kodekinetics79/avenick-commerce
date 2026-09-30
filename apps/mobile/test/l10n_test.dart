import 'package:avenick/core/l10n/directional_icon.dart';
import 'package:avenick/core/l10n/directional_text.dart';
import 'package:avenick/core/l10n/numerals.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

void main() {
  setUpAll(() async {
    await initializeDateFormatting();
  });

  group('Western numerals in both locales', () {
    test('integers are ASCII digits', () {
      expect(Numerals.integer(1250), '1,250');
    });

    test('money is ASCII digits', () {
      expect(Numerals.money(1299.5, currencyCode: 'AED'), 'AED 1,299.50');
    });

    test('Arabic-Indic digits are converted', () {
      // The exact failure mode: intl under `ar` emits these, and a price column
      // built from them goes ragged against Latin figures in the same font.
      expect(Numerals.toWestern('١٢٣٤٥٦٧٨٩٠'), '1234567890');
    });

    test('Extended Arabic-Indic (Persian) digits are converted', () {
      expect(Numerals.toWestern('۱۲۳۴۵۶۷۸۹۰'), '1234567890');
    });

    test('non-digit characters survive conversion untouched', () {
      expect(Numerals.toWestern('AED ١٢٣.٥٠'), 'AED 123.50');
      expect(Numerals.toWestern('طلب رقم ٤٤٧١'), 'طلب رقم 4471');
    });

    test('dates keep localised month NAMES but Western digits', () {
      final DateTime d = DateTime(2026, 9, 5);
      final String ar = Dates.short(d, const Locale('ar'));
      expect(ar, contains('2026'));
      expect(ar, contains('5'));
      // No Arabic-Indic digit anywhere in the output.
      expect(RegExp(r'[٠-٩۰-۹]').hasMatch(ar), isFalse);
    });
  });

  group('bidi isolation', () {
    test('a SKU is wrapped in FSI…PDI', () {
      final String out = Bidi.isolate('AVN-4471-B');
      expect(out.codeUnitAt(0), 0x2068);
      expect(out.codeUnitAt(out.length - 1), 0x2069);
      expect(out.contains('AVN-4471-B'), isTrue);
    });

    test('a phone number is forced LTR, not first-strong', () {
      // '+971…' begins with a neutral. First-strong isolation would find no
      // strong character and fall back to the paragraph direction, flipping the
      // whole token in Arabic.
      final String out = LtrToken.phone.wrap('+971 4 555 0110');
      expect(out.codeUnitAt(0), 0x2066);
      expect(LtrToken.phone.forcesLtr, isTrue);
    });

    test('an AWB — all digits — is forced LTR', () {
      expect(LtrToken.awb.forcesLtr, isTrue);
      expect(LtrToken.awb.wrap('176-4471 8890').codeUnitAt(0), 0x2066);
    });

    test('a SKU starting with a letter only needs first-strong isolation', () {
      expect(LtrToken.sku.forcesLtr, isFalse);
    });

    test('empty and null tokens produce no stray control characters', () {
      expect(Bidi.isolate(''), '');
      expect(Bidi.isolate(null), '');
      expect(Bidi.ltr(''), '');
    });

    test('rich text isolates each token independently', () {
      const DirectionalText w = DirectionalText.rich(<TextSegment>[
        TextSegment.prose('الرجاء تأكيد رقم الصنف '),
        TextSegment.token('AVN-4471-B', kind: LtrToken.sku),
        TextSegment.prose(' و '),
        TextSegment.token('PO-2026-0091', kind: LtrToken.purchaseOrder),
        TextSegment.prose('.'),
      ]);
      final String resolved = w.resolve();
      // Two isolates opened, two closed.
      expect(Bidi.fsi.allMatches(resolved).length, 1);
      expect(Bidi.lri.allMatches(resolved).length, 1);
      expect(Bidi.pdi.allMatches(resolved).length, 2);
    });

    test('hasRtl detects Arabic', () {
      expect(Bidi.hasRtl('طلب'), isTrue);
      expect(Bidi.hasRtl('AVN-4471-B'), isFalse);
    });
  });

  group('icon mirroring policy', () {
    test('directional glyphs mirror', () {
      for (final String n in <String>[
        'chevron-left',
        'chevron-right',
        'arrow-left',
        'reply',
        'undo',
      ]) {
        expect(
          IconMirroring.policyFor(n),
          IconDirectionality.directional,
          reason: '$n encodes a direction of travel and must mirror',
        );
      }
    });

    test('objects and marks never mirror', () {
      // Each of these is a shipped-app bug someone has actually made.
      for (final String n in <String>[
        'clock', // a clock that runs backwards
        'check', // a mark, not an arrow
        'search', // a left-handed magnifier
        'camera', // a physical object
        'shopping-cart', // the one glyph in commerce that must be instant
        'star',
        'heart',
        'trending-up', // a good quarter turned into a bad one
      ]) {
        expect(
          IconMirroring.policyFor(n),
          IconDirectionality.fixed,
          reason: '$n depicts an object or a mark and must NOT mirror',
        );
      }
    });

    test('unknown icons fail closed — fixed, not mirrored', () {
      expect(IconMirroring.policyFor('some-new-icon'), IconDirectionality.fixed);
    });

    test('the two sets never overlap', () {
      expect(
        IconMirroring.mirrored.intersection(IconMirroring.neverMirrored),
        isEmpty,
      );
    });

    testWidgets('mirroring is driven by Directionality alone',
        (WidgetTester tester) async {
      Future<Matrix4?> transformFor(TextDirection dir, String name) async {
        await tester.pumpWidget(
          Directionality(
            textDirection: dir,
            child: DirectionalIcon(Icons.chevron_right, name: name),
          ),
        );
        final Iterable<Transform> found =
            tester.widgetList<Transform>(find.byType(Transform));
        return found.isEmpty ? null : found.first.transform;
      }

      expect(await transformFor(TextDirection.ltr, 'chevron-right'), isNull);
      expect(await transformFor(TextDirection.rtl, 'chevron-right'), isNotNull);
      // A clock stays a clock in Arabic — even when the IconData it was handed
      // is a Material constant carrying matchTextDirection: true, which would
      // otherwise mirror it inside Icon, behind the policy's back.
      expect(await transformFor(TextDirection.rtl, 'clock'), isNull);
    });

    testWidgets('matchTextDirection is stripped so nothing mirrors twice',
        (WidgetTester tester) async {
      // Icons.chevron_right sets matchTextDirection: true. Left alone, Icon
      // mirrors it AND DirectionalIcon mirrors it, the two cancel, and the icon
      // that most needed mirroring is the one that does not.
      expect(Icons.chevron_right.matchTextDirection, isTrue);

      await tester.pumpWidget(
        const Directionality(
          textDirection: TextDirection.rtl,
          child: DirectionalIcon(Icons.chevron_right, name: 'chevron-right'),
        ),
      );

      // EXACTLY ONE mirror. Two would cancel and leave the chevron pointing
      // the wrong way in Arabic — the failure this whole mechanism exists for.
      expect(find.byType(Transform), findsOneWidget);

      // And the fixed policy suppresses the glyph's self-mirroring entirely,
      // rather than adding a second flip on top of it.
      await tester.pumpWidget(
        const Directionality(
          textDirection: TextDirection.rtl,
          child: DirectionalIcon(Icons.chevron_right, name: 'clock'),
        ),
      );
      expect(find.byType(Transform), findsNothing);
    });
  });
}
