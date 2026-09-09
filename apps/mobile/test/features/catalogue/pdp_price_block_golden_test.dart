import 'package:avenick/features/catalogue/catalogue.dart';
import 'package:flutter/material.dart';

import '../../golden_matrix.dart';
import 'fakes.dart';

/// {LTR, RTL} × {light, dark} for the product page's price block.
///
/// Three things are pinned here and every one of them is a rule rather than a
/// look:
///
///  1. **The VAT-inclusive figure and the net figure appear together.** The
///     gross is computed by this client — the catalogue contract sends no gross
///     field — so the number the checkout will actually build a subtotal from
///     has to be on the screen beside it. `AED 12.34` net at 5% becomes
///     `AED 12.96`, rounded the way `Number(v.toFixed(2))` rounds.
///  2. **The saving carries no fill.** Plain `dangerInk` text. A soft fill here
///     would be indistinguishable from a "Delivered" status chip.
///  3. **Both figures survive an Arabic paragraph.** The digits, the comma and
///     the decimal point are all bidi-neutral, so the RTL cells are what prove
///     the forced-LTR isolation is actually applied — without it `AED 1,234.50`
///     comes out reordered, and it looks like a plausible price while it does.
void main() {
  goldenMatrix(
    'pdp_price_block',
    (BuildContext context) => SizedBox(
      width: 320,
      child: PriceBlock(
        price: DisplayPrice.fromBand(fakeBand(price: '1234.50')),
        wasPrice: fakeCardPrice(amount: '1499.00').money,
        variant: PriceBlockVariant.detail,
      ),
    ),
    surfaceSize: const Size(360, 220),
  );

  goldenMatrix(
    'pdp_price_block_quote_only',
    (BuildContext context) => const SizedBox(
      width: 320,
      child: PriceBlock(
        price: null,
        variant: PriceBlockVariant.detail,
        quoteOnly: true,
      ),
    ),
    surfaceSize: const Size(360, 220),
  );
}
