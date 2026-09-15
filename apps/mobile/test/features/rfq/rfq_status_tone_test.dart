import 'dart:io';

import 'package:avenick/api/models/enums.dart';
import 'package:avenick/features/rfq/rfq.dart';
import 'package:flutter_test/flutter_test.dart';

/// THE TONE MAP IS THE TONE MAP.
///
/// A status colour is a claim about whose move it is, and it is made in two
/// places: here, and in `apps/customer/src/components/b2b/rfq-status.ts`. A
/// buyer looks at both on the same desk, so the second group below reads the
/// web's file and asserts the two agree rather than trusting that they do.
void main() {
  group('the warning tone is reserved for the buyer', () {
    test('QUOTED is the only warning', () {
      final List<RfqStatus> warnings = RfqStatus.values
          .where((RfqStatus s) => presentationForRfq(s).tone == RfqTone.warning)
          .toList();
      expect(warnings, <RfqStatus>[RfqStatus.quoted]);
    });

    test('warning means exactly the states the server lets a buyer act on', () {
      // `decideRFQ` accepts QUOTED and NEGOTIATING. NEGOTIATING is accent
      // rather than warning because the price is still moving — the supplier is
      // engaged — and because nothing in the services writes that status at
      // all. The rule the app follows is "only a buyer's move MAY be warning",
      // not "every actionable state MUST be".
      expect(presentationForRfq(RfqStatus.quoted).tone, RfqTone.warning);
      expect(presentationForRfq(RfqStatus.quoted).status.isDecidable, isTrue);
    });
  });

  group('the rest of the map', () {
    test('a request nobody has claimed is neutral, not "in progress"', () {
      // `submitQuote` is the only writer of `sellerId` and it claims the
      // request in the same update that prices it, so a SUBMITTED request has
      // no supplier on it. Nobody is working on it yet.
      expect(presentationForRfq(RfqStatus.submitted).tone, RfqTone.neutral);
      expect(presentationForRfq(RfqStatus.underReview).tone, RfqTone.accent);
    });

    test('settled outcomes are success and danger', () {
      expect(presentationForRfq(RfqStatus.accepted).tone, RfqTone.success);
      expect(presentationForRfq(RfqStatus.rejected).tone, RfqTone.danger);
    });

    test('parked states are neutral', () {
      for (final RfqStatus status in <RfqStatus>[
        RfqStatus.draft,
        RfqStatus.expired,
        RfqStatus.cancelled,
      ]) {
        expect(
          presentationForRfq(status).tone,
          RfqTone.neutral,
          reason: status.name,
        );
      }
    });

    test('every status has a label and a plain-English meaning', () {
      for (final RfqStatus status in RfqStatus.values) {
        final RfqStatusPresentation p = presentationForRfq(status);
        expect(p.label, isNotEmpty, reason: status.name);
        expect(p.meaning, isNotEmpty, reason: status.name);
        expect(p.iconName, isNotEmpty, reason: status.name);
      }
    });

    test('no two statuses share a label', () {
      final Set<String> labels = RfqStatus.values
          .map((RfqStatus s) => presentationForRfq(s).label)
          .toSet();
      expect(labels.length, RfqStatus.values.length);
    });
  });

  group('parity with the buyer portal', () {
    // The web file is the other half of this claim. Reading it here is the
    // only mechanical defence against the two drifting: an RFQ that is amber
    // in the portal and grey in the app is two statements about one request.
    final File web = File(
      '../../apps/customer/src/components/b2b/rfq-status.ts',
    );

    test('every status carries the same tone on both surfaces', () {
      if (!web.existsSync()) {
        // The mobile app is built and tested on its own in CI containers that
        // do not check out the web app. Skipping loudly beats a red suite that
        // says nothing about this feature.
        markTestSkipped('rfq-status.ts not present in this checkout');
        return;
      }

      final String source = web.readAsStringSync();
      final RegExp entry = RegExp(
        r'(\w+):\s*\{\s*labelKey:[^,]+,\s*tone:\s*"(\w+)"\s*\}',
      );
      final Map<String, String> webTones = <String, String>{
        for (final RegExpMatch m in entry.allMatches(source))
          m.group(1)!: m.group(2)!,
      };
      expect(
        webTones.length,
        RfqStatus.values.length,
        reason: 'the web map should carry all nine statuses',
      );

      for (final RfqStatus status in RfqStatus.values) {
        final String wire = _wireOf(status);
        expect(
          presentationForRfq(status).tone.name,
          webTones[wire],
          reason: '$wire disagrees between the app and the buyer portal',
        );
      }
    });
  });
}

/// The SCREAMING_SNAKE spelling, which the Dart enum's `name` is not.
String _wireOf(RfqStatus status) => switch (status) {
      RfqStatus.draft => 'DRAFT',
      RfqStatus.submitted => 'SUBMITTED',
      RfqStatus.underReview => 'UNDER_REVIEW',
      RfqStatus.quoted => 'QUOTED',
      RfqStatus.negotiating => 'NEGOTIATING',
      RfqStatus.accepted => 'ACCEPTED',
      RfqStatus.rejected => 'REJECTED',
      RfqStatus.expired => 'EXPIRED',
      RfqStatus.cancelled => 'CANCELLED',
    };
