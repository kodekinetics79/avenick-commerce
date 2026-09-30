import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/order.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../core/l10n/numerals.dart';
import '../../../core/ui/async_state_view.dart';
import '../../../core/ui/key_button.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../shared/commerce_ui.dart';
import 'order_detail_screen.dart';
import 'order_parts.dart';
import 'orders_controller.dart';
import 'persisted_totals_panel.dart';

/// THE CONFIRMATION.
///
/// One order, N sellers, N deliveries — and **N dates**. There is no single
/// "arriving Thursday" on this screen and there is no code path that could
/// produce one: a blended estimate across sellers is right for at most one of
/// them, and the buyer plans around it.
class OrderConfirmedScreen extends ConsumerWidget {
  const OrderConfirmedScreen({required this.orderId, this.onDone, super.key});

  final String orderId;

  /// Where "done" goes — the router owns that decision. Null pops back.
  final VoidCallback? onDone;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final AsyncValue<OrderDetail> order =
        ref.watch(orderDetailProvider(orderId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Order placed'),
        automaticallyImplyLeading: false,
      ),
      body: SafeArea(
        child: AsyncStateView<OrderDetail>.standard(
          value: order,
          isEmpty: (OrderDetail o) => o.items.isEmpty,
          onRetry: () => ref.invalidate(orderDetailProvider(orderId)),
          skeleton: const MeridianSkeleton(shape: MeridianSkeletonShape.detail),
          emptyTitle: 'The order was placed but came back with no lines',
          emptyBody: 'Nothing is lost — quote the order number to support and '
              'they can read the order server-side.',
          data: (BuildContext context, OrderDetail o) => ListView(
            padding: EdgeInsetsDirectional.all(t.spaceStack),
            children: <Widget>[
              _Header(order: o),
              SizedBox(height: t.spaceStack),
              _Deliveries(order: o),
              SizedBox(height: t.spaceStack),
              _SellerGroups(order: o),
              PersistedTotalsPanel(money: o.money),
              SizedBox(height: t.spaceStack),
              KeyButton(
                label: 'View this order',
                size: KeyButtonSize.large,
                expand: true,
                onPressed: () => Navigator.of(context).push<void>(
                  MaterialPageRoute<void>(
                    builder: (BuildContext _) =>
                        OrderDetailScreen(orderId: orderId),
                  ),
                ),
              ),
              SizedBox(height: t.spaceTight),
              KeyButton(
                label: 'Done',
                tone: KeyButtonTone.ghost,
                expand: true,
                onPressed: onDone ?? () => Navigator.of(context).pop(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The items, grouped by the seller who will dispatch them.
class _SellerGroups extends StatelessWidget {
  const _SellerGroups({required this.order});

  final OrderDetail order;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final List<MapEntry<String, List<OrderItem>>> groups =
        groupBySeller(order.items);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
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
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.order});

  final OrderDetail order;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return SectionPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(LucideIcons.circleCheck, size: 22, color: t.successInk),
              SizedBox(width: t.spaceTight),
              Expanded(child: Text('Thank you — the order is in', style: type.h3)),
            ],
          ),
          SizedBox(height: t.spaceTight),
          Text('Order number', style: type.meta.copyWith(color: t.ink3)),
          // The order number is the one string the buyer will read down a
          // phone line to support, so it is bidi-isolated and Western-digited
          // in both locales.
          DirectionalText.token(
            order.orderNumber,
            kind: LtrToken.orderId,
            style: type.figCard,
          ),
        ],
      ),
    );
  }
}

/// Every delivery, every date, side by side — and never one date for all of
/// them.
class _Deliveries extends StatelessWidget {
  const _Deliveries({required this.order});

  final OrderDetail order;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final int sellers = groupBySeller(order.items).length;

    return SectionPanel(
      title: order.shipments.length == 1 ? 'Your delivery' : 'Your deliveries',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            sellers == 1
                ? 'This order is with one seller, so it arrives as one '
                    'delivery.'
                : 'This order is with ${Numerals.integer(sellers)} sellers. '
                    'Each dispatches separately, so it arrives as separate '
                    'deliveries on separate dates — there is no single '
                    'arrival date for the order.',
            style: type.meta.copyWith(color: t.ink2),
          ),
          SizedBox(height: t.spaceTight),
          if (order.shipments.isEmpty)
            const CommerceNotice(
              tone: CommerceTone.neutral,
              icon: LucideIcons.package,
              title: 'No delivery has been created yet',
              body: 'The sellers dispatch next. A date appears against each '
                  'delivery as it is made — this screen will not guess one '
                  'before then.',
            )
          else
            for (int i = 0; i < order.shipments.length; i++)
              Padding(
                padding: EdgeInsetsDirectional.only(bottom: t.spaceTight),
                child:
                    ShipmentCard(shipment: order.shipments[i], index: i + 1),
              ),
          if (order.shipments.isNotEmpty && sellers > 1)
            const ShipmentLinkageNote(),
        ],
      ),
    );
  }
}
