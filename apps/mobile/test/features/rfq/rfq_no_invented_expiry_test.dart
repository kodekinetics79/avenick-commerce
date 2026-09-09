import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// `RFQRequest.expiresAt` IS A COLUMN NOTHING WRITES.
///
/// No service sets it, the seed does not either, and the contract says plainly
/// that an app must not present "expires in N days" from it. Null is its
/// truthful value on every row in production.
///
/// This matters more than it looks. `lib/api/models/rfq.dart` carries a helper
/// —`RfqDetail.isExpired(now)` — whose doc reads "When the supplier's price
/// stops standing. Null when they set no expiry", which is an invitation to
/// build a countdown on a field that is always null. Today that would render
/// nothing; the day somebody backfills the column with a migration default, it
/// would render a deadline no supplier agreed to, on the screen where a buyer
/// decides whether to spend money.
///
/// So the rule is enforced at source level, the same way the directional-inset
/// and hardcoded-colour rules are in `test/design_lint_test.dart`: nothing in
/// this feature may read `expiresAt` or call `isExpired`. A grep is a blunt
/// instrument and exactly the right one — there is no legitimate use.
void main() {
  test('no screen in the RFQ feature reads expiresAt or isExpired', () {
    final Directory feature = Directory('lib/features/rfq');
    final List<String> violations = <String>[];

    for (final File file in feature
        .listSync(recursive: true)
        .whereType<File>()
        .where((File f) => f.path.endsWith('.dart'))) {
      final List<String> lines = file.readAsLinesSync();
      for (int i = 0; i < lines.length; i++) {
        final String line = lines[i];
        // Comments explaining WHY it is not read are the point of this file.
        final String trimmed = line.trimLeft();
        if (trimmed.startsWith('//') || trimmed.startsWith('///')) continue;
        if (line.contains('expiresAt') || line.contains('isExpired')) {
          violations.add('${file.path}:${i + 1}  ${line.trim()}');
        }
      }
    }

    expect(
      violations,
      isEmpty,
      reason: 'RFQRequest.expiresAt has no writer on this platform. Rendering '
          'anything from it — a countdown, a badge, a disabled button — states '
          'a deadline that does not exist.\n${violations.join('\n')}',
    );
  });
}
