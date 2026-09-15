import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/catalogue.dart';
import '../../../core/l10n/numerals.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';

/// Stars, the average, and the number of people behind it.
///
/// `RatingSummary` is NULL when nothing has been reviewed — the contract makes
/// `count` positive, so a zero-count summary is never sent in place of null.
/// Five empty stars and "nobody has said anything yet" are different claims,
/// and rendering the first for the second is how a new listing looks like a bad
/// one. [RatingRow] renders nothing at all in the compact case and says so in
/// words in the full case.
///
/// The star is on the never-mirrored list: it is a mark of value, not a
/// direction of travel. The COUNT of stars still fills from the reading edge,
/// which `Row` under `Directionality` does for free.
class RatingRow extends StatelessWidget {
  const RatingRow({
    required this.rating,
    this.compact = false,
    this.showEmptyState = false,
    super.key,
  });

  final RatingSummary? rating;

  /// The card variant: one star, the average, the count in brackets.
  final bool compact;

  /// Say "No reviews yet" rather than rendering nothing. Right on a product
  /// page, wrong on a card — a grid of twelve cards each announcing an absence
  /// is a grid that reads as broken.
  final bool showEmptyState;

  static const int _starCount = 5;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final RatingSummary? summary = rating;

    if (summary == null) {
      if (!showEmptyState) return const SizedBox.shrink();
      return Text(
        'No reviews yet',
        style: type.meta.copyWith(color: t.ink3),
      );
    }

    final String average = Numerals.decimal(summary.average, fractionDigits: 1);
    final String count = Numerals.integer(summary.count);
    final String semantics =
        '$average out of 5, from $count ${summary.count == 1 ? 'review' : 'reviews'}';

    if (compact) {
      return Semantics(
        label: semantics,
        excludeSemantics: true,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(LucideIcons.star, size: 12, color: t.brass),
            SizedBox(width: t.spaceUnit),
            Text(average, style: type.micro.copyWith(color: t.ink2)),
            SizedBox(width: t.spaceUnit),
            Text('($count)', style: type.micro.copyWith(color: t.ink3)),
          ],
        ),
      );
    }

    return Semantics(
      label: semantics,
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          for (int i = 0; i < _starCount; i++) ...<Widget>[
            Icon(
              // A half star is drawn where the average genuinely lands on one.
              // Rounding 4.4 up to a full fifth star is a third of a point of
              // flattery on every listing in the catalogue.
              summary.average >= i + 1
                  ? LucideIcons.star
                  : summary.average >= i + 0.5
                      ? LucideIcons.starHalf
                      : LucideIcons.star,
              size: 15,
              color: summary.average >= i + 0.5 ? t.brass : t.neutralRule,
            ),
            if (i < _starCount - 1) SizedBox(width: t.spaceUnit / 2),
          ],
          SizedBox(width: t.spaceTight),
          Text(average, style: type.ui.copyWith(color: t.ink1)),
          SizedBox(width: t.spaceUnit),
          Text(
            '($count)',
            style: type.meta.copyWith(color: t.ink3),
          ),
        ],
      ),
    );
  }
}
