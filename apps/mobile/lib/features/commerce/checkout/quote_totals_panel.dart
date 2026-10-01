import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/checkout.dart';
import '../../../api/models/enums.dart';
import '../../../api/models/order_totals.dart';
import '../../../core/l10n/numerals.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../shared/commerce_ui.dart';

/// THE TOTALS, AS THE SERVER COMPOSED THEM.
///
/// Every figure on this panel is a field of [MoneyTotals], rendered through
/// [Money.format]. Nothing here adds, multiplies, rounds or re-formats a
/// number — `composeOrderTotals` did that once on the server and a second
/// answer computed here would be a second answer, which is precisely the
/// defect class PR #21 belongs to.
///
/// **The VAT split is always visible.** Goods VAT and delivery VAT are drawn
/// as separate rows above the aggregate. PR #21 was VAT charged on the goods
/// and not on the delivery, and every figure on that screen agreed with every
/// other figure: the only way to see it was to look for the two components and
/// find one missing. A single "VAT" line is indistinguishable from a correct
/// one, so this panel does not offer that shape at all.
class QuoteTotalsPanel extends StatelessWidget {
  const QuoteTotalsPanel({required this.quote, super.key});

  final CheckoutQuote quote;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final MoneyTotals money = quote.money;
    final ShippingQuote shipping = quote.shipping;

    // Zero because the wire says zero, or zero because no zone covers the
    // address? `ShippingQuote` keeps the difference and so does this panel:
    // `unpriced_no_zones` sends `amount: 0`, and rendering that as a figure —
    // let alone as "Free delivery" — states that delivery costs nothing.
    final bool freightUnknown = shipping.freightQuotedSeparately;
    final bool deliveryUnserved =
        shipping.status == ShippingQuoteStatus.unavailable;

    return SectionPanel(
      title: 'Total',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          MoneyRow(label: 'Items', value: money.subtotal),
          if (!money.discountAmount.isZero)
            MoneyRow(
              label: 'Discount applied',
              value: money.discountAmount,
              tone: CommerceTone.success,
              note: quote.promotions.isEmpty
                  ? null
                  : quote.promotions
                      .map((AppliedPromotion p) => p.label)
                      .join(' · '),
            ),
          Divider(height: t.spaceStack * 2, color: t.hairline),

          // ---- THE SPLIT. Two components, then the sum. -------------------
          MoneyRow(
            label: 'VAT on the items',
            value: money.goodsVatAmount,
          ),
          if (freightUnknown || deliveryUnserved) ...<Widget>[
            const MoneyRow.absent(
              label: 'Delivery',
              absentNote: 'Quoted separately',
            ),
            const MoneyRow.absent(
              label: 'VAT on delivery',
              absentNote: 'Not yet priced',
            ),
          ] else ...<Widget>[
            MoneyRow(label: 'Delivery', value: money.shippingAmount),
            MoneyRow(
              label: 'VAT on delivery',
              value: money.shippingVatAmount,
              note: money.shippingVatAmount.isZero &&
                      !money.shippingAmount.isZero
                  ? 'Delivery is zero-rated in this market. This is a stated '
                      'zero, not a missing figure.'
                  : null,
            ),
          ],
          MoneyRow(
            label: 'VAT total',
            value: money.vatAmount,
            note: 'The items and the delivery, added by the server.',
          ),
          Divider(height: t.spaceStack * 2, color: t.hairline),

          MoneyRow(label: 'Total', value: money.total, emphasis: true),
          if (freightUnknown) ...<Widget>[
            SizedBox(height: t.spaceTight),
            const CommerceNotice(
              tone: CommerceTone.warning,
              icon: LucideIcons.truck,
              title: 'Delivery is not included in this total',
              body: 'No delivery zone covers this address, so the seller will '
                  'quote freight separately and it is not part of the figure '
                  'above. Delivery is not free.',
            ),
          ],
          if (deliveryUnserved) ...<Widget>[
            SizedBox(height: t.spaceTight),
            const CommerceNotice(
              tone: CommerceTone.danger,
              icon: LucideIcons.circleAlert,
              title: 'This address cannot be delivered to',
              body: 'The destination is not served. Choose another address to '
                  'get a delivery price.',
            ),
          ],
          SizedBox(height: t.spaceTight),
          Text(
            'Every figure above is the server’s, rendered as it was sent.',
            style: type.meta.copyWith(color: t.ink3),
          ),
        ],
      ),
    );
  }
}

/// What the delivery step shows: whether freight could be priced, from where,
/// and how long it takes.
class ShippingQuoteSummary extends StatelessWidget {
  const ShippingQuoteSummary({required this.shipping, super.key});

  final ShippingQuote shipping;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return SectionPanel(
      title: 'Delivery',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          switch (shipping.status) {
            ShippingQuoteStatus.priced => const CommerceNotice(
                tone: CommerceTone.success,
                icon: LucideIcons.truck,
                title: 'Delivery is priced for this address',
              ),
            ShippingQuoteStatus.unpricedNoZones => const CommerceNotice(
                tone: CommerceTone.warning,
                icon: LucideIcons.truck,
                title: 'Freight will be quoted separately',
                body: 'No delivery zone covers this address, so the seller '
                    'prices it by hand after the order is placed. It is not '
                    'included in the total and it is not free.',
              ),
            ShippingQuoteStatus.unavailable => const CommerceNotice(
                tone: CommerceTone.danger,
                icon: LucideIcons.circleAlert,
                title: 'This destination is not served',
                body: 'Nothing can be delivered to this address. Choose '
                    'another one.',
              ),
          },
          if (shipping.zoneName != null) ...<Widget>[
            SizedBox(height: t.spaceTight),
            DetailRow(label: 'Zone', value: shipping.zoneName!),
          ],
          if (shipping.hasEstimate)
            DetailRow(
              label: 'Estimated transit',
              value: '${Numerals.integer(shipping.estimatedDaysMin!)}'
                  '–${Numerals.integer(shipping.estimatedDaysMax!)} days',
            )
          else
            Padding(
              padding: EdgeInsetsDirectional.only(top: t.spaceTight),
              child: Text(
                'No transit estimate came back with this quote.',
                style: type.meta.copyWith(color: t.ink3),
              ),
            ),
        ],
      ),
    );
  }
}
