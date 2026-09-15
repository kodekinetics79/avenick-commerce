import 'package:avenick/api/models/enums.dart';
import 'package:avenick/features/rfq/rfq.dart';
import 'package:flutter/material.dart';

import '../../golden_matrix.dart';
import 'harness.dart';

/// {LTR, RTL} × {light, dark} for the two pieces of this feature whose
/// correctness is visual.
///
/// **The quote request form** is here because it is the screen the entire
/// catalogue funnels into and the densest directional object in the feature —
/// a label stack, a field, a row of currency targets and a full-width key
/// button, all laid out against the reading edge. The Arabic render is the only
/// artefact that shows an `EdgeInsets.only(left:)` that should have been
/// directional; the English screenshot in a pull request looks perfect either
/// way.
///
/// **The status chips** are here because the tone map is a design decision that
/// cannot be read from the code alone: only one of nine statuses is amber, four
/// share neutral, and only the picture shows whether "Quote received" reads as
/// the one that wants the buyer's attention.
void main() {
  goldenMatrix(
    'rfq_request_form',
    (BuildContext context) => RequestQuoteScreen(
      subject: const QuoteSubject(
        productId: 'prd_1',
        slug: 'galvanised-scaffold-tube-48-3mm',
        quantity: 500,
      ),
      onCreated: (String _) {},
    ),
    surfaceSize: const Size(420, 900),
    overrides: rfqOverrides(
      repository: FakeRfqRepository(),
      productSource: FakeQuotedProductSource(product: quotedProduct()),
      currency: Currency.aed,
    ),
  );

  goldenMatrix(
    'rfq_status_pills',
    (BuildContext context) => Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          for (final RfqStatus status in RfqStatus.values)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: RfqStatusPill(status: status),
            ),
        ],
      ),
    ),
    surfaceSize: const Size(360, 520),
  );
}
