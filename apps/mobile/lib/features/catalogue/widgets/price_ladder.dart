import 'package:flutter/material.dart';

import '../../../api/models/catalogue.dart';
import '../../../api/models/enums.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../core/l10n/numerals.dart';
import '../../../theme/elevation.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../data/display_price.dart';

/// The quantity-break ladder: buy more, pay less per unit.
///
/// This is the B2B heart of the product page and it earns its own widget for
/// one reason — **the active band has to be visible**. A ladder that just lists
/// four rows makes the buyer work out which one their quantity falls in; a
/// ladder that marks the active row turns the whole table into an answer to
/// "what am I paying".
///
/// The bands are scoped to a channel AND a currency: the same product priced
/// for B2B in SAR is a different ladder, not a converted one. [bands] is
/// therefore filtered by the caller, which is the only place that knows which
/// channel the page was resolved in.
///
/// The per-row saving is against the FIRST band, and it is plain `dangerInk`
/// text with no fill — the same rule as `PriceBlock`. A soft green pill on
/// every rung of a price table is four status chips that are not statuses.
class PriceLadder extends StatelessWidget {
  const PriceLadder({required this.bands, required this.quantity, super.key});

  /// Already filtered to one channel and one currency, and sorted ascending by
  /// [PriceBand.minQty] — see [sortedFor].
  final List<PriceBand> bands;

  /// The quantity currently in the buy box, so the active rung can be marked.
  final int quantity;

  /// Filter to one channel and currency, sorted by quantity floor.
  static List<PriceBand> sortedFor(
    List<PriceBand> all, {
    required Channel channel,
    required Currency currency,
  }) {
    final List<PriceBand> filtered = all
        .where((PriceBand b) => b.channel == channel && b.currency == currency)
        .toList();
    filtered.sort((PriceBand a, PriceBand b) => a.minQty.compareTo(b.minQty));
    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    if (bands.length < 2) return const SizedBox.shrink();

    final PriceBand first = bands.first;
    final DisplayPrice firstPrice = DisplayPrice.fromBand(first);

    return MeridianSurface(
      rung: MeridianRung.card,
      padding: EdgeInsetsDirectional.all(t.spaceStack),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Semantics(
            header: true,
            child: Text('Volume pricing', style: type.h3),
          ),
          SizedBox(height: t.spaceUnit),
          Text(
            'Prices shown include VAT.',
            style: type.micro.copyWith(color: t.ink3),
          ),
          SizedBox(height: t.spaceTight + t.spaceUnit),
          for (final PriceBand band in bands) ...<Widget>[
            _LadderRow(
              band: band,
              basePrice: firstPrice,
              active: band.covers(quantity),
            ),
            if (band != bands.last)
              Divider(height: t.spaceStack, color: t.hairline),
          ],
        ],
      ),
    );
  }
}

class _LadderRow extends StatelessWidget {
  const _LadderRow({
    required this.band,
    required this.basePrice,
    required this.active,
  });

  final PriceBand band;
  final DisplayPrice basePrice;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final DisplayPrice price = DisplayPrice.fromBand(band);
    final bool saves = price.gross < basePrice.gross;

    final String range = band.maxQty == null
        ? '${Numerals.quantity(band.minQty)}+'
        : '${Numerals.quantity(band.minQty)}–'
            '${Numerals.quantity(band.maxQty!)}';

    return Semantics(
      selected: active,
      label: <String>[
        '$range units',
        MoneyFormat.format(price.gross),
        if (saves) MoneyFormat.saving(basePrice.gross, price.gross),
        if (active) 'your current quantity',
      ].join(', '),
      excludeSemantics: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(
            width: 96,
            child: Text(
              // Forced LTR: a range like "10–49" is all digits and a dash,
              // every one of them bidi-neutral, so an Arabic paragraph would
              // reorder it to "49–10".
              Bidi.ltr(range),
              style: (active ? type.ui : type.body).copyWith(
                color: active ? t.primaryInk : t.ink2,
              ),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(
                  Bidi.ltr(MoneyFormat.format(price.gross)),
                  style: type.ui.copyWith(
                    color: active ? t.primaryInk : t.ink1,
                  ),
                ),
                if (saves) ...<Widget>[
                  SizedBox(height: t.spaceUnit / 2),
                  Text(
                    // No fill. See the class doc.
                    MoneyFormat.saving(basePrice.gross, price.gross),
                    style: type.micro.copyWith(color: t.dangerInk),
                  ),
                ],
              ],
            ),
          ),
          if (active)
            Padding(
              padding: EdgeInsetsDirectional.only(start: t.spaceTight),
              child: Text(
                'Your price',
                style: type.micro.copyWith(color: t.primaryInk),
              ),
            ),
        ],
      ),
    );
  }
}
