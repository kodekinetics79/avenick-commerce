import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/enums.dart';
import '../../../api/models/order.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../core/l10n/numerals.dart';
import '../../../core/ui/async_state_view.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../checkout/payment_methods.dart';
import '../shared/commerce_ui.dart';
import 'order_parts.dart';
import 'order_status_pill.dart';
import 'orders_controller.dart';
import 'persisted_totals_panel.dart';

/// ONE ORDER, IN FULL.
///
/// Pull-to-refresh belongs here: an order is a live thing — it ships, it gets
/// a tracking number, it arrives — and the buyer pulling to see whether any of
/// that has happened cannot change what they will pay.
class OrderDetailScreen extends ConsumerWidget {
  const OrderDetailScreen({required this.orderId, super.key});

  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final AsyncValue<OrderDetail> order =
        ref.watch(orderDetailProvider(orderId));

    return Scaffold(
      appBar: AppBar(title: const Text('Order')),
      body: SafeArea(
        child: PullToRefresh(
          onRefresh: () => ref.refresh(orderDetailProvider(orderId).future),
          child: AsyncStateView<OrderDetail>.standard(
            value: order,
            isEmpty: (OrderDetail o) => o.items.isEmpty,
            onRetry: () => ref.invalidate(orderDetailProvider(orderId)),
            skeleton:
                const MeridianSkeleton(shape: MeridianSkeletonShape.detail),
            emptyTitle: 'This order has no lines',
            emptyBody: 'The order exists but nothing is on it. That is a '
                'record worth reporting rather than an empty screen worth '
                'ignoring — quote the order number to support.',
            data: (BuildContext context, OrderDetail o) => Padding(
              padding: EdgeInsetsDirectional.all(t.spaceStack),
              child: OrderDetailBody(order: o),
            ),
          ),
        ),
      ),
    );
  }
}

/// The order's body, split out so the confirmation screen and the detail
/// screen cannot drift apart on what an order looks like.
class OrderDetailBody extends StatelessWidget {
  const OrderDetailBody({required this.order, super.key});

  final OrderDetail order;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final Locale locale =
        Localizations.maybeLocaleOf(context) ?? const Locale('en');
    final List<MapEntry<String, List<OrderItem>>> groups =
        groupBySeller(order.items);
    final PaymentMethod? method = order.paymentMethod;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        SectionPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              DirectionalText.token(
                order.orderNumber,
                kind: LtrToken.orderId,
                style: type.h3,
              ),
              SizedBox(height: t.spaceUnit),
              Text(
                'Placed ${Dates.full(order.placedAt.toLocal(), locale)}',
                style: type.meta.copyWith(color: t.ink3),
              ),
              SizedBox(height: t.spaceTight),
              Wrap(
                spacing: t.spaceTight,
                runSpacing: t.spaceTight,
                children: <Widget>[
                  OrderStatusPill(status: order.status),
                ],
              ),
            ],
          ),
        ),
        SizedBox(height: t.spaceStack),

        // ---- The items, grouped the way they will be dispatched. ----------
        for (int i = 0; i < groups.length; i++) ...<Widget>[
          SellerItemsCard(
            sellerId: groups[i].key,
            items: groups[i].value,
            currency: order.currency,
            index: i + 1,
            total: groups.length,
          ),
          SizedBox(height: t.spaceStack),
        ],

        // ---- The parcels, each with its own date. -------------------------
        SectionPanel(
          title: order.shipments.length == 1 ? 'Delivery' : 'Deliveries',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              if (order.shipments.isEmpty)
                Text(
                  'No delivery has been created yet. Each seller dispatches '
                  'separately, and each dispatch gets its own date when it '
                  'is made.',
                  style: type.meta.copyWith(color: t.ink3),
                )
              else
                for (int i = 0; i < order.shipments.length; i++)
                  Padding(
                    padding: EdgeInsetsDirectional.only(bottom: t.spaceTight),
                    child: ShipmentCard(
                      shipment: order.shipments[i],
                      index: i + 1,
                    ),
                  ),
              if (order.shipments.isNotEmpty && groups.length > 1) ...<Widget>[
                SizedBox(height: t.spaceTight),
                const ShipmentLinkageNote(),
              ],
            ],
          ),
        ),
        SizedBox(height: t.spaceStack),

        PersistedTotalsPanel(money: order.money),
        SizedBox(height: t.spaceStack),

        SectionPanel(
          title: 'Payment',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              DetailRow(
                label: 'Status',
                value: labelForPaymentStatus(order.paymentStatus),
              ),
              if (method != null)
                DetailRow(
                  label: 'Method',
                  value: labelForPaymentMethod(method),
                )
              else
                Text(
                  'No payment has been attempted on this order yet.',
                  style: type.meta.copyWith(color: t.ink3),
                ),
              if (order.hasInvoice)
                DetailRow(
                  label: 'VAT invoice',
                  value: order.vatInvoiceUrl!,
                  valueToken: LtrToken.url,
                ),
            ],
          ),
        ),
        SizedBox(height: t.spaceStack),

        SectionPanel(
          title: 'Delivering to',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              DetailRow(label: 'Address', value: order.shippingAddress.label),
              DetailRow(
                label: 'Where',
                value: '${order.shippingAddress.line1}, '
                    '${order.shippingAddress.city} · '
                    '${order.shippingAddress.country.code}',
              ),
              if (order.notes != null)
                DetailRow(label: 'Notes', value: order.notes!),
            ],
          ),
        ),
        SizedBox(height: t.spaceStack),

        SectionPanel(
          title: 'History',
          child: StatusTimeline(events: order.timeline),
        ),
        SizedBox(height: t.spaceStack),

        Row(
          children: <Widget>[
            Icon(LucideIcons.receipt, size: 14, color: t.ink3),
            SizedBox(width: t.spaceUnit),
            Expanded(
              child: Text(
                '${Numerals.quantity(order.items.length)} '
                '${order.items.length == 1 ? 'line' : 'lines'} · '
                'updated ${Dates.short(order.updatedAt.toLocal(), locale)}',
                style: type.meta.copyWith(color: t.ink3),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
