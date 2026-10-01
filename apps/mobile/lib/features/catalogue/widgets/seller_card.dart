import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/catalogue.dart';
import '../../../api/models/enums.dart';
import '../../../theme/elevation.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../catalogue_context.dart';
import 'rating_row.dart';

/// Who is actually selling this.
///
/// On a marketplace the seller is part of the product, not a footnote: the same
/// valve from a PLATINUM seller in Dubai and from a STANDARD seller in Riyadh
/// are two different purchases. The tier, the city and the rating are what a
/// B2B buyer uses to decide, so all three are on the card.
///
/// The tier badge states its rank in WORDS as well as colour — `brass` for the
/// two top tiers, neutral for the rest — for the same reason availability does:
/// a colour-only rank is invisible to a colour-blind buyer and silent to a
/// screen reader.
class SellerCard extends StatelessWidget {
  const SellerCard({required this.seller, super.key});

  final SellerSummary seller;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final Language language = languageOf(context);
    final String name = language == Language.ar
        ? seller.businessNameAr ?? seller.businessNameEn
        : seller.businessNameEn;

    return MeridianSurface(
      rung: MeridianRung.card,
      padding: EdgeInsetsDirectional.all(t.spaceStack),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Semantics(
            header: true,
            child: Text('Sold by', style: type.h3),
          ),
          SizedBox(height: t.spaceTight + t.spaceUnit),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              // `store` depicts a building. It does not mirror.
              Icon(LucideIcons.store, size: 20, color: t.ink2),
              SizedBox(width: t.spaceTight + t.spaceUnit),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Text(name, style: type.body.copyWith(color: t.ink1)),
                    SizedBox(height: t.spaceUnit),
                    Row(
                      children: <Widget>[
                        // `map-pin` depicts an object.
                        Icon(LucideIcons.mapPin, size: 13, color: t.ink3),
                        SizedBox(width: t.spaceUnit),
                        Flexible(
                          child: Text(
                            '${seller.city}, ${seller.country}',
                            style: type.meta.copyWith(color: t.ink2),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    if (seller.rating != null) ...<Widget>[
                      SizedBox(height: t.spaceTight),
                      RatingRow(rating: seller.rating, compact: true),
                    ],
                  ],
                ),
              ),
              SizedBox(width: t.spaceTight),
              _TierBadge(tier: seller.tier),
            ],
          ),
        ],
      ),
    );
  }
}

class _TierBadge extends StatelessWidget {
  const _TierBadge({required this.tier});

  final SellerTier tier;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final bool distinguished =
        tier == SellerTier.gold || tier == SellerTier.platinum;
    final Color ink = distinguished ? t.brassInk : t.ink2;

    return Semantics(
      label: '${_label(tier)} seller',
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: t.neutralSoft,
          borderRadius: BorderRadius.circular(t.radiusPill),
          border: Border.all(color: t.neutralRule),
        ),
        child: Padding(
          padding: EdgeInsetsDirectional.symmetric(
            horizontal: t.spaceTight,
            vertical: t.spaceUnit / 2,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              if (tier != SellerTier.standard) ...<Widget>[
                // `badge-check` is a mark, never mirrored.
                Icon(LucideIcons.badgeCheck, size: 12, color: ink),
                SizedBox(width: t.spaceUnit),
              ],
              // The rank in words. A gold pip on its own is a colour, and a
              // colour is not a rank to a buyer who cannot see it.
              Text(_label(tier), style: type.micro.copyWith(color: ink)),
            ],
          ),
        ),
      ),
    );
  }

  static String _label(SellerTier tier) => switch (tier) {
        SellerTier.standard => 'Standard',
        SellerTier.verified => 'Verified',
        SellerTier.gold => 'Gold',
        SellerTier.platinum => 'Platinum',
      };
}
