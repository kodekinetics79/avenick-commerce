import 'package:avenick/features/catalogue/catalogue.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show Override;

import '../../golden_matrix.dart';
import 'fakes.dart';

/// {LTR, RTL} × {light, dark} for the product card. Four files or none.
///
/// The RTL cells are the only mechanical defence this codebase has for the
/// directional-layout mandate: nothing in Dart's type system stops
/// `EdgeInsets.only(left: 16)`, and the English screenshot in the PR looks
/// perfect either way. The mirrored render is the artefact that shows it.
///
/// What each pair is protecting, specifically:
///
///  * **`product_card`** — the price at `figCard`, the was-price struck in
///    `meta`, and the saving as PLAIN `dangerInk` TEXT WITH NO FILL beside the
///    filled availability pill. The whole rule is visible in one frame: one of
///    those two is a status and carries a fill, the other is a number and does
///    not. A future edit that boxes the saving turns it into a second status
///    chip, and this golden is where that shows up.
///  * **`product_card_quote_only`** — the same card with no resolved price:
///    "Priced by quotation", the "Quote only" line, and no purchase affordance
///    anywhere on the card.
///  * **`product_card_quote_only_priced`** — THE PRODUCTION ROW, and the one
///    the old price-based inference got wrong. A resolved B2C price sits on
///    the card and `sellableInChannel` is false, which is what
///    `pilot-catalog.ts` writes for all 1,172 live products. The figure is
///    printed — it is a true statement about the product — and the primary
///    affordance is still absent. A future edit that reads the price as
///    permission to sell shows up here as an Add to cart that was not there
///    before.
void main() {
  final List<Override> overrides = <Override>[
    remoteImageBuilderProvider.overrideWith((Ref ref) => fakeRemoteImage),
  ];

  goldenMatrix(
    'product_card',
    (BuildContext context) => SizedBox(
      width: 190,
      child: ProductCardTile(
        product: fakeProductCard(),
        // Nothing on the wire fills this in — `CardPrice` has no compare-at
        // field. It is passed here so the typography is under test today
        // rather than the day the contract grows one.
        wasPrice: fakeCardPrice(amount: '16.00').money,
      ),
    ),
    // Tall enough for the ARABIC ramp, which is a separate ramp and not the
    // Latin one in a different family: body is 16/26 against 15/24, and the
    // same card is ~8px taller in the RTL cells. Sizing this surface to the
    // Latin render is how the two RTL goldens end up capturing an overflow
    // stripe instead of a card.
    surfaceSize: const Size(240, 570),
    overrides: overrides,
  );

  goldenMatrix(
    'product_card_quote_only',
    (BuildContext context) => SizedBox(
      width: 190,
      child: ProductCardTile(product: fakeQuoteOnlyCard()),
    ),
    // Tall enough for the ARABIC ramp, which is a separate ramp and not the
    // Latin one in a different family: body is 16/26 against 15/24, and the
    // same card is ~8px taller in the RTL cells. Sizing this surface to the
    // Latin render is how the two RTL goldens end up capturing an overflow
    // stripe instead of a card.
    surfaceSize: const Size(240, 570),
    overrides: overrides,
  );

  goldenMatrix(
    'product_card_quote_only_priced',
    (BuildContext context) => SizedBox(
      width: 190,
      child: ProductCardTile(product: fakePricedButUnsellableCard()),
    ),
    surfaceSize: const Size(240, 570),
    overrides: overrides,
  );
}
