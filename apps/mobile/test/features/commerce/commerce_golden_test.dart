import 'package:avenick/api/models/enums.dart';
import 'package:avenick/features/commerce/commerce.dart';
import 'package:flutter/material.dart';

import '../../golden_matrix.dart';
import 'harness.dart';

/// {LTR, RTL} × {light, dark} for the two pieces of this feature whose
/// correctness is visual.
///
/// The cart line is here because it is the densest directional object in the
/// app — a thumbnail, a stepper, a price and a warning all laid out against
/// the reading edge — and because the Arabic render is the only artefact that
/// shows an `EdgeInsets.only(left:)` that should have been directional. The
/// English screenshot in a pull request looks perfect either way.
///
/// The status pills are here because the tone map is a design decision that
/// cannot be read from the code alone: four statuses share one hue and are
/// separated by icon, `REFUNDED` is deliberately not red, and only the picture
/// shows whether that reads.
void main() {
  goldenMatrix(
    'commerce_cart_line',
    (BuildContext context) => SizedBox(
      width: 360,
      child: CartLineTile(
        line: LocalCartLine(snapshot: cartLine(), qty: 2),
        language: languageOf(context),
        onQuantityChanged: (int _) {},
        onRemove: () {},
        onRaiseToMoq: () {},
      ),
    ),
    surfaceSize: const Size(400, 300),
  );

  goldenMatrix(
    'commerce_cart_line_below_moq',
    (BuildContext context) => SizedBox(
      width: 360,
      child: CartLineTile(
        // 4 units of a part with a minimum of 25: flagged, with a fix-it
        // action, and NOT silently raised.
        line: LocalCartLine(
          snapshot: cartLine(qty: 4, moq: 25, lineTotal: 49.36),
          qty: 4,
        ),
        language: languageOf(context),
        onQuantityChanged: (int _) {},
        onRemove: () {},
        onRaiseToMoq: () {},
      ),
    ),
    surfaceSize: const Size(400, 480),
  );

  goldenMatrix(
    'commerce_order_status_pills',
    (BuildContext context) => Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          for (final OrderStatus status in OrderStatus.values)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: OrderStatusPill(status: status),
            ),
        ],
      ),
    ),
    surfaceSize: const Size(360, 480),
  );
}
