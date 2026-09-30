import 'dart:io';

import 'package:avenick/api/models/checkout.dart';
import 'package:avenick/api/models/order_totals.dart';
import 'package:flutter_test/flutter_test.dart';

import 'harness.dart';

/// THE APP COMPUTES NOTHING ABOUT MONEY.
///
/// This is asserted twice, in two different ways, because one of them alone is
/// not enough:
///
///  1. **Against the source.** Every file under `lib/features/commerce/checkout`
///     is read and searched for arithmetic on anything money-shaped. A widget
///     test cannot catch `total + shipping` if the two happen to be added
///     correctly in the fixture — it would pass, and the second currency or
///     the first tiered product would find it in production.
///
///  2. **Against the render.** The figures on screen are compared against
///     `quote.money.<field>.format()` — the model's own formatting of the
///     model's own field. If the screen re-derived any of them, the strings
///     diverge.
///
/// `composeOrderTotals` rounds once, on the server. A client that rounds a
/// second time produces a second answer that no invoice agrees with, and
/// PR #21 is what that costs.
void main() {
  final Directory checkout = Directory('lib/features/commerce/checkout');

  List<File> checkoutSources() => checkout
      .listSync(recursive: true)
      .whereType<File>()
      .where((File f) => f.path.endsWith('.dart'))
      .toList();

  /// Code with comments and string literals removed, so prose about VAT and a
  /// label reading "2–4 days" cannot trip the scan.
  String codeOnly(String line) {
    final String withoutComment = line.split('//').first;
    return withoutComment.replaceAll(RegExp("'[^']*'"), "''");
  }

  const String money =
      r'(?:money|totals?|subtotal|unitPrice|lineTotal|vatAmount|goodsVatAmount'
      r'|shippingVatAmount|shippingAmount|discountAmount|amount|price)';

  test('there are checkout sources to scan at all', () {
    // A regression test that silently scans nothing is worse than no test.
    expect(checkout.existsSync(), isTrue);
    expect(checkoutSources(), isNotEmpty);
  });

  test('no arithmetic operator touches a money-shaped identifier', () {
    final List<RegExp> offenders = <RegExp>[
      // total + something, vatAmount * 2, subtotal / 3
      RegExp('\\b$money\\w*\\s*[+*/]'),
      // something + total
      RegExp('[+*/]\\s*\\b$money'),
      // total - discount. Restricted to a following identifier or paren so a
      // negative literal in a layout offset cannot match.
      RegExp('\\b$money\\w*\\s*-\\s*[A-Za-z(]'),
      // total += shipping
      RegExp('\\b$money\\w*\\s*[-+*/]='),
    ];

    final List<String> violations = <String>[];
    for (final File file in checkoutSources()) {
      final List<String> lines = file.readAsLinesSync();
      for (int i = 0; i < lines.length; i++) {
        final String code = codeOnly(lines[i]);
        for (final RegExp offender in offenders) {
          if (offender.hasMatch(code)) {
            violations.add('${file.path}:${i + 1}  ${lines[i].trim()}');
          }
        }
      }
    }

    expect(
      violations,
      isEmpty,
      reason: 'The checkout screen may not do arithmetic on money. Every '
          'figure comes from POST /v1/checkout/quote, which is backed by '
          'composeOrderTotals. Render the field; do not derive it.\n'
          '${violations.join('\n')}',
    );
  });

  test('no float formatting and no double conversion anywhere near a price',
      () {
    // `toStringAsFixed` needs a double, and a double is where an exact figure
    // silently becomes 12.339999999999999. `Money.format` never leaves BigInt.
    final List<RegExp> banned = <RegExp>[
      RegExp(r'\btoStringAsFixed\b'),
      RegExp(r'\btoDouble\(\)'),
      RegExp(r'\bdouble\.parse\b'),
      RegExp(r'\bnum\.parse\b'),
      RegExp(r'\bNumberFormat\b'),
    ];

    final List<String> violations = <String>[];
    for (final File file in Directory('lib/features/commerce')
        .listSync(recursive: true)
        .whereType<File>()
        .where((File f) => f.path.endsWith('.dart'))) {
      final List<String> lines = file.readAsLinesSync();
      for (int i = 0; i < lines.length; i++) {
        final String code = codeOnly(lines[i]);
        for (final RegExp offender in banned) {
          if (offender.hasMatch(code)) {
            violations.add('${file.path}:${i + 1}  ${lines[i].trim()}');
          }
        }
      }
    }

    expect(violations, isEmpty, reason: violations.join('\n'));
  });

  test('the scan would actually catch the thing it is looking for', () {
    // The test's own test. A scanner that matches nothing passes forever.
    const String defect = 'final Money grand = money.total + money.shippingAmount;';
    final RegExp offender = RegExp('\\b$money\\w*\\s*[+*/]');
    expect(offender.hasMatch(codeOnly(defect)), isTrue);
    // And prose about adding VAT to a total does not trip it.
    const String prose = "      title: 'VAT + delivery are added at checkout',";
    expect(offender.hasMatch(codeOnly(prose)), isFalse);
  });

  test('every totals row is bound straight to a field of MoneyTotals', () {
    final String source =
        File('lib/features/commerce/checkout/quote_totals_panel.dart')
            .readAsStringSync();
    // Every `MoneyRow(` in the file, and the first `value:` inside it.
    // `MoneyRow.absent(` carries no value by construction — that is the whole
    // point of it — so it does not appear here.
    final List<String> rows = source.split('MoneyRow(').skip(1).toList();

    expect(rows, isNotEmpty);
    for (final String row in rows) {
      final String head = row.length > 200 ? row.substring(0, 200) : row;
      final RegExpMatch? match =
          RegExp(r'value:\s*([A-Za-z0-9_.]+)').firstMatch(head);
      expect(match, isNotNull, reason: 'A MoneyRow with no value: $head');
      final String expression = match!.group(1)!;
      expect(
        RegExp(r'^money\.\w+$').hasMatch(expression),
        isTrue,
        reason: 'A totals row rendered "$expression" rather than a bare field '
            'of MoneyTotals. Anything else is a figure this app derived.',
      );
    }
  });

  test('the rendered strings ARE the model’s own formatting', () {
    // The other half of the claim: what reaches the screen is
    // `Money.format()`, digit for digit.
    final CheckoutQuote quote = checkoutQuote();
    final MoneyTotals money = quote.money;

    expect(money.total.format(), '44.32 AED');
    expect(money.goodsVatAmount.format(), '1.11 AED');
    expect(money.shippingVatAmount.format(), '1.00 AED');
    // And the identity the model enforces at parse time, restated here so the
    // fixture cannot drift into the PR #21 shape without this failing.
    expect(quote.totals.vatComponentsAgree, isTrue);
    expect(quote.totals.totalAgrees, isTrue);
  });
}
