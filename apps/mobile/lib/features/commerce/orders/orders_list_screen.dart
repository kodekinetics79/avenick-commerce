import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/order.dart';
import '../../../core/l10n/directional_icon.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../core/l10n/numerals.dart';
import '../../../core/ui/async_state_view.dart';
import '../../../core/ui/key_button.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../shared/commerce_ui.dart';
import 'order_detail_screen.dart';
import 'order_status_pill.dart';
import 'orders_controller.dart';

/// ORDER HISTORY.
///
/// Pull-to-refresh belongs here and not on the cart or the checkout: this is a
/// list of things that have already happened, and refreshing it cannot change
/// what the buyer is about to agree to. It works in every state, including the
/// empty one — see [PullToRefresh].
class OrdersListScreen extends ConsumerWidget {
  const OrdersListScreen({this.onOpenOrder, super.key});

  /// Supplied by the router, which owns `/orders/:id`. Null pushes the detail
  /// screen directly so the flow works before that wiring lands.
  final void Function(String orderId)? onOpenOrder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final AsyncValue<List<OrderCard>> orders =
        ref.watch(ordersControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Orders')),
      body: SafeArea(
        child: PullToRefresh(
          onRefresh: () => ref.refresh(ordersControllerProvider.future),
          child: AsyncStateView<List<OrderCard>>.standard(
            value: orders,
            isEmpty: (List<OrderCard> o) => o.isEmpty,
            onRetry: () => ref.invalidate(ordersControllerProvider),
            skeleton: const MeridianSkeleton(shape: MeridianSkeletonShape.list),
            emptyTitle: 'No orders yet',
            emptyBody: 'Orders you place appear here with their status, their '
                'deliveries and their VAT invoice. Pull down to check again.',
            data: (BuildContext context, List<OrderCard> list) => Padding(
              padding: EdgeInsetsDirectional.all(t.spaceStack),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  for (final OrderCard order in list) ...<Widget>[
                    _OrderRow(
                      order: order,
                      onTap: () {
                        final void Function(String)? handler = onOpenOrder;
                        if (handler != null) {
                          handler(order.id);
                        } else {
                          Navigator.of(context).push<void>(
                            MaterialPageRoute<void>(
                              builder: (BuildContext _) =>
                                  OrderDetailScreen(orderId: order.id),
                            ),
                          );
                        }
                      },
                    ),
                    SizedBox(height: t.spaceTight),
                  ],
                  const _LoadMore(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _OrderRow extends StatelessWidget {
  const _OrderRow({required this.order, required this.onTap});

  final OrderCard order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final Locale locale = Localizations.maybeLocaleOf(context) ??
        const Locale('en');

    return Semantics(
      button: true,
      label: 'Order ${order.orderNumber}, '
          '${presentationFor(order.status).label}',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: kMinTouchTarget),
          child: SectionPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: t.spaceTight,
                  runSpacing: t.spaceTight,
                  children: <Widget>[
                    DirectionalText.token(
                      order.orderNumber,
                      kind: LtrToken.orderId,
                      style: type.ui,
                    ),
                    OrderStatusPill(status: order.status),
                  ],
                ),
                SizedBox(height: t.spaceUnit),
                Text(
                  '${Dates.short(order.placedAt.toLocal(), locale)} · '
                  '${Numerals.quantity(order.itemCount)} '
                  '${order.itemCount == 1 ? 'item' : 'items'}',
                  style: type.meta.copyWith(color: t.ink3),
                ),
                SizedBox(height: t.spaceTight),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: MoneyText(order.totalMoney, style: type.figCard),
                    ),
                    DirectionalIcon(
                      LucideIcons.chevronRight,
                      name: 'chevron-right',
                      size: 18,
                      color: t.ink3,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The next page, and what happened if it did not arrive.
///
/// A failed page two must not blank out page one, so the failure is rendered
/// here beside the button rather than thrown into the screen's state.
class _LoadMore extends ConsumerStatefulWidget {
  const _LoadMore();

  @override
  ConsumerState<_LoadMore> createState() => _LoadMoreState();
}

class _LoadMoreState extends ConsumerState<_LoadMore> {
  bool _busy = false;
  Object? _error;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    if (!ref.watch(ordersControllerProvider.notifier).hasMore) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        if (_error != null) ...<Widget>[
          CommerceNotice(
            tone: CommerceTone.warning,
            icon: LucideIcons.circleAlert,
            title: 'The next page did not load',
            body: _error.toString(),
          ),
          SizedBox(height: t.spaceTight),
        ],
        KeyButton(
          label: 'Load older orders',
          tone: KeyButtonTone.accent,
          expand: true,
          busy: _busy,
          onPressed: () async {
            setState(() {
              _busy = true;
              _error = null;
            });
            final Object? failure =
                await ref.read(ordersControllerProvider.notifier).loadMore();
            if (!mounted) return;
            setState(() {
              _busy = false;
              _error = failure;
            });
          },
        ),
      ],
    );
  }
}
