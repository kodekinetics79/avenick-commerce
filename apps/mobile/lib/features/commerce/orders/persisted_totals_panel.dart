import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/order_totals.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../shared/commerce_ui.dart';

/// THE TOTALS A FETCHED ORDER CARRIES — a genuinely weaker shape than a
/// quote's, and rendered as the weaker shape rather than dressed up as the
/// stronger one.
///
/// The `Order` table has columns for `subtotal`, `discountAmount`,
/// `shippingAmount`, `vatAmount` and `total`. It has NO column for the goods
/// and shipping VAT components: `composeOrderTotals` computes them at
/// checkout, writes the correct total from them, and drops the split.
///
/// So for an order placed before those columns existed, the two components are
/// NULL — and this panel prints "Not recorded" for them.
///
/// **A zero there would be a lie with a specific history.** "VAT on delivery:
/// 0.00" is the exact claim PR #21 shipped by accident: VAT charged on the
/// goods and not on the freight. Rendering an unknown as a zero re-states that
/// defect on every historical order, in a UI that looks perfectly consistent.
class PersistedTotalsPanel extends StatelessWidget {
  const PersistedTotalsPanel({required this.money, super.key});

  final PersistedMoneyTotals money;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    return SectionPanel(
      title: 'What was charged',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          MoneyRow(label: 'Items', value: money.subtotal),
          if (!money.discountAmount.isZero)
            MoneyRow(
              label: 'Discount applied',
              value: money.discountAmount,
              tone: CommerceTone.success,
            ),
          MoneyRow(label: 'Delivery', value: money.shippingAmount),
          if (money.goodsVatAmount != null)
            MoneyRow(label: 'VAT on the items', value: money.goodsVatAmount)
          else
            const MoneyRow.absent(
              label: 'VAT on the items',
              absentNote: 'Not recorded',
            ),
          if (money.shippingVatAmount != null)
            MoneyRow(label: 'VAT on delivery', value: money.shippingVatAmount)
          else
            const MoneyRow.absent(
              label: 'VAT on delivery',
              absentNote: 'Not recorded',
            ),
          MoneyRow(label: 'VAT total', value: money.vatAmount),
          MoneyRow(label: 'Total', value: money.total, emphasis: true),
          if (!money.hasVatBreakdown) ...<Widget>[
            SizedBox(height: t.spaceTight),
            const CommerceNotice(
              tone: CommerceTone.neutral,
              icon: LucideIcons.info,
              title: 'This order did not record how its VAT split',
              body: 'The VAT charged is exact — it is the figure above. How '
                  'much of it fell on the goods and how much on the delivery '
                  'was not stored for orders of this age, so it is shown as '
                  'not recorded rather than as zero.',
            ),
          ],
        ],
      ),
    );
  }
}
