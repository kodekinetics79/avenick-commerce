import 'package:flutter/material.dart';

import '../../../api/models/enums.dart';
import '../../../core/l10n/numerals.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';

/// Stock, stated in words and in colour — **never in colour alone**.
///
/// The dot and the fill are the fast read; the words are the actual claim. A
/// green dot on its own is invisible to roughly one man in twelve, illegible in
/// direct sun, and silent to a screen reader, and those are three different
/// people who all need to know whether they can buy the thing.
///
/// The three states are also genuinely three, not two:
/// [Availability.unconfirmed] means the catalogue has no confirmed stock
/// position, which is NOT out-of-stock. The item is still orderable, so it is
/// not struck through and not disabled — it is caveated. Collapsing it into
/// "out of stock" loses a sale on a product the seller has; collapsing it into
/// "in stock" promises one nobody can honour.
///
/// This is one of the two places in the system where a soft fill is correct:
/// availability is a STATUS. (The other is order state. A price saving is not a
/// status and gets no fill — see `PriceBlock`.)
class AvailabilityLabel extends StatelessWidget {
  const AvailabilityLabel({
    required this.availability,
    this.availableQty,
    this.compact = false,
    super.key,
  });

  final Availability availability;

  /// Shown as "N in stock" when the server sent a figure and it is small
  /// enough to be information rather than noise. A stock count of 4,182 tells
  /// a buyer nothing they will act on; a count of 3 changes what they do next.
  final int? availableQty;

  /// The card variant: smaller type, tighter box. Same words, same colours.
  final bool compact;

  static const int _scarcityThreshold = 10;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final _AvailabilityTone tone = _AvailabilityTone.of(t, availability);
    final String text = _label();

    return Semantics(
      label: text,
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: tone.fill,
          borderRadius: BorderRadius.circular(t.radiusPill),
          border: Border.all(color: tone.rule),
        ),
        child: Padding(
          padding: EdgeInsetsDirectional.symmetric(
            horizontal: compact ? t.spaceTight : t.spaceTight + t.spaceUnit,
            vertical: compact ? t.spaceUnit / 2 : t.spaceUnit,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              // The dot is decoration on top of the words, not a substitute
              // for them. It carries no information the text does not.
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: tone.ink,
                  shape: BoxShape.circle,
                ),
              ),
              SizedBox(width: t.spaceUnit + 2),
              Flexible(
                child: Text(
                  text,
                  style: (compact ? type.micro : type.meta).copyWith(
                    color: tone.ink,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _label() {
    final int? qty = availableQty;
    switch (availability) {
      case Availability.inStock:
        if (qty != null && qty > 0 && qty <= _scarcityThreshold) {
          return 'Only ${Numerals.quantity(qty)} left';
        }
        return 'In stock';
      case Availability.outOfStock:
        return 'Out of stock';
      case Availability.unconfirmed:
        // Not "may be unavailable" — the item IS orderable. The sentence has to
        // say what is uncertain (the stock figure) rather than what is not
        // (the sale).
        return 'Stock not confirmed';
    }
  }
}

@immutable
class _AvailabilityTone {
  const _AvailabilityTone({
    required this.fill,
    required this.ink,
    required this.rule,
  });

  final Color fill;
  final Color ink;
  final Color rule;

  factory _AvailabilityTone.of(MeridianTokens t, Availability availability) =>
      switch (availability) {
        Availability.inStock => _AvailabilityTone(
            fill: t.successSoft,
            ink: t.successInk,
            rule: t.successRule,
          ),
        Availability.outOfStock => _AvailabilityTone(
            fill: t.dangerSoft,
            ink: t.dangerInk,
            rule: t.dangerRule,
          ),
        Availability.unconfirmed => _AvailabilityTone(
            fill: t.warningSoft,
            ink: t.warningInk,
            rule: t.warningRule,
          ),
      };
}
