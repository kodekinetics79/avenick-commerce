import 'package:flutter/material.dart';

import '../../../api/models/money.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../data/display_price.dart';

/// Which surface a price is being printed on.
enum PriceBlockVariant {
  /// Inside a product card in a rail or a grid.
  card,

  /// The buy box on a product page, and the sticky bar that replaces it.
  detail,
}

/// The price, and everything that must travel with it.
///
/// ## The rule this widget exists to enforce
///
/// **A saving is typography, not a chip.** It is plain `dangerInk` text on the
/// card's own ground, with no fill behind it, and that is not a stylistic
/// preference. Soft fills in this system are reserved for STATUS — the green
/// `successSoft` pill that says "In stock", the same green pill that will say
/// "Delivered" on an order. Put a saving in a soft fill and a "Save AED 40"
/// chip becomes visually identical to a "Delivered" chip: same fill, same ink,
/// same pill, a thumb's width apart in the same list. The semantic palette
/// stops meaning anything the moment a price discount and a fulfilment state
/// look the same. Commerce is typographic: the price is large, the old price is
/// struck and small, the saving is a coloured line of text. Nothing is boxed.
///
/// ## What the contract cannot give this widget
///
/// [wasPrice] has **no source in the catalogue contract**. `CardPrice` is
/// `{amount, currency, vatRatePercent, isFrom}` and `PriceBand` is
/// `{channel, currency, minQty, maxQty, price, vatRatePercent}` — there is no
/// compare-at, list, RRP or was-price field anywhere on the `/v1` catalogue
/// surface. So it is a parameter here, wired to nothing today, and the
/// struck-price and saving rows simply do not render. The alternative —
/// synthesising a was-price from the top band of the tier ladder — would print
/// a discount that never existed.
class PriceBlock extends StatelessWidget {
  const PriceBlock({
    required this.price,
    this.wasPrice,
    this.variant = PriceBlockVariant.card,
    this.showVatLine = true,
    this.quoteOnly = false,
    super.key,
  });

  /// Null is a real catalogue state, not a failure: nothing is priced in the
  /// requested channel and currency. It renders "Price on request" — never
  /// zero, and never a blank space where a number should be.
  final DisplayPrice? price;

  /// The previous price, struck through. See the class doc: nothing on the
  /// wire fills this in yet.
  final Money? wasPrice;

  final PriceBlockVariant variant;

  /// Whether to print the "incl. VAT" line under the figure. Off in the
  /// sticky bar, where vertical space is the whole constraint and the line is
  /// two thumb-scrolls above.
  final bool showVatLine;

  /// This product cannot be bought on the active channel — see
  /// [CatalogueOffer]. The block then states that the price comes by
  /// quotation instead of printing a confident consumer figure.
  ///
  /// It is a separate flag from `price == null` because the two are different
  /// claims: a null price with [quoteOnly] false is "we could not resolve one",
  /// and a null price with [quoteOnly] true is "there is not one to resolve —
  /// ask". Only the second is an invitation.
  final bool quoteOnly;

  bool get _isDetail => variant == PriceBlockVariant.detail;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final DisplayPrice? p = price;

    if (p == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(
            quoteOnly ? 'Priced by quotation' : 'Price on request',
            style: (_isDetail ? type.h3 : type.ui).copyWith(color: t.ink1),
          ),
          if (_isDetail) ...<Widget>[
            SizedBox(height: t.spaceUnit),
            Text(
              quoteOnly
                  // Stated positively. A quote-only product is not a broken
                  // listing, and a buyer who reads "not priced" concludes the
                  // catalogue is unfinished rather than that there is a next
                  // step to take.
                  ? 'The seller confirms the price and the lead time for your '
                      'quantity.'
                  : 'Not priced in your currency or channel yet. Ask the '
                      'seller for a quote.',
              style: type.meta.copyWith(color: t.ink2),
            ),
          ],
        ],
      );
    }

    final String figure = MoneyFormat.format(p.gross);
    final Money? was = wasPrice;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        // The figure. `figCard` is its own type step precisely because a price
        // is a FIGURE and not a heading: tabular digits, so a column of prices
        // holds still, and none of a heading's negative tracking.
        //
        // Deliberately unbounded lines. At 200% dynamic type "AED 1,234.50"
        // wraps onto a second line and the card gets taller; the alternative is
        // "AED 1,23…", and a truncated price is the one failure in commerce
        // that is worse than a tall row.
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: <Widget>[
            if (p.isFrom) ...<Widget>[
              // "from AED 12.00" — a tiered product has no single price, and
              // printing the lowest band as if it were THE price is a quote
              // the checkout will not honour.
              Text('from', style: type.meta.copyWith(color: t.ink2)),
              SizedBox(width: t.spaceUnit + 2),
            ],
            Flexible(
              child: Text(
                // Forced LTR: the string starts with a currency code but the
                // digits, comma and full stop after it are bidi-neutral, so in
                // an Arabic paragraph the decimal separator migrates and
                // "AED 1,234.50" renders as something else entirely.
                Bidi.ltr(figure),
                style: (_isDetail
                        ? type.figCard.copyWith(
                            fontSize: t.fsFigSection,
                            height: t.lhFigSection / t.fsFigSection,
                          )
                        : type.figCard)
                    .copyWith(color: t.ink1),
              ),
            ),
          ],
        ),

        if (showVatLine) ...<Widget>[
          SizedBox(height: t.spaceUnit / 2),
          _VatLine(price: p, detail: _isDetail),
        ],

        if (was != null) ...<Widget>[
          SizedBox(height: t.spaceUnit + 2),
          Wrap(
            spacing: t.spaceTight,
            runSpacing: t.spaceUnit,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: <Widget>[
              // The old price: `meta`, struck, ink3. Small and quiet — it is
              // context for the new price, not a second price.
              Text(
                Bidi.ltr(MoneyFormat.format(was)),
                style: type.meta.copyWith(
                  color: t.ink3,
                  decoration: TextDecoration.lineThrough,
                  decorationColor: t.ink3,
                ),
              ),
              // The saving. Plain text in `dangerInk`. NO FILL. See the class
              // doc — this is the rule, not the decoration.
              Text(
                MoneyFormat.saving(was, p.gross),
                style: (_isDetail ? type.ui : type.micro).copyWith(
                  color: t.dangerInk,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

/// "Incl. 5% VAT · AED 12.34 before VAT".
///
/// Both figures, always, and the reason is in [DisplayPrice]: the gross is
/// computed by this client because the contract sends no gross field, so the
/// NET — which is the number the checkout will actually build a subtotal
/// from — has to be on the screen beside it. When the two disagree by a fils
/// the buyer can see why rather than discovering it at payment.
class _VatLine extends StatelessWidget {
  const _VatLine({required this.price, required this.detail});

  final DisplayPrice price;
  final bool detail;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final TextStyle style =
        (detail ? type.meta : type.micro).copyWith(color: t.ink2);

    if (price.isZeroRated) {
      // A zero-rated jurisdiction is a real GCC state. Saying "Incl. 0% VAT"
      // is arithmetically true and reads as a bug.
      return Text('Zero-rated — no VAT', style: style);
    }

    final String rate = MoneyFormat.ratePercent(price.vatRatePercent);
    final String net = MoneyFormat.format(price.net);

    if (!detail) {
      return Text('Incl. $rate VAT', style: style);
    }

    return DirectionalText.rich(
      <TextSegment>[
        const TextSegment.prose('Incl. '),
        TextSegment.token(rate, kind: LtrToken.reference),
        const TextSegment.prose(' VAT · '),
        TextSegment.token(net, kind: LtrToken.reference),
        const TextSegment.prose(' before VAT'),
      ],
      style: style,
    );
  }
}
