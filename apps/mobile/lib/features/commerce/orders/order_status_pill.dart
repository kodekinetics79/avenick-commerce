import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/enums.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../shared/commerce_ui.dart';

/// HOW AN ORDER STATUS IS COLOURED. The map is fixed; read it before changing
/// a hue, because three of these are counter-intuitive on purpose.
///
/// **`PENDING_PAYMENT` and `RETURN_REQUESTED` are WARNING.** Not because
/// anything is wrong, but because both mean *the platform is waiting on the
/// buyer*. Warning is the one tone in this system that means "you have
/// something to do". Every other status here is the platform working, and the
/// buyer can close the app.
///
/// **`PAYMENT_CONFIRMED`, `CONFIRMED`, `SHIPPED` and `OUT_FOR_DELIVERY` share
/// ACCENT, and are told apart by their ICON.** They are four rungs of one
/// state — in progress, nothing needed from you — and inventing a fifth hue to
/// separate them would make colour meaningless: if every status has its own
/// colour, the colour says only "this is a status", which the shape already
/// said. Icon carries the rung; colour carries the meaning.
///
/// **`REFUNDED` is NEUTRAL, not danger.** Money going back to the buyer is a
/// completed, correct outcome — the ledger balanced. Painting it red tells
/// someone their refund is a problem, and it is the one thing on this screen
/// they were hoping to see. `RETURNED` and `PROCESSING` are neutral for the
/// same reason: settled or routine, nothing to react to.
///
/// **`CANCELLED` is danger** because it is the one terminal state where the
/// buyer did not get the goods and may not know why.
@immutable
class OrderStatusPresentation {
  const OrderStatusPresentation({
    required this.status,
    required this.tone,
    required this.icon,
    required this.iconName,
    required this.label,
  });

  final OrderStatus status;
  final CommerceTone tone;
  final IconData icon;

  /// The lucide name, so the mirroring policy in
  /// `lib/core/l10n/directional_icon.dart` can be applied by name rather than
  /// guessed from a code point.
  final String iconName;

  final String label;
}

/// The one table. Everything that renders a status reads it from here.
OrderStatusPresentation presentationFor(OrderStatus status) =>
    switch (status) {
      OrderStatus.pendingPayment => const OrderStatusPresentation(
          status: OrderStatus.pendingPayment,
          tone: CommerceTone.warning,
          icon: LucideIcons.clock,
          iconName: 'clock',
          label: 'Awaiting payment',
        ),
      OrderStatus.returnRequested => const OrderStatusPresentation(
          status: OrderStatus.returnRequested,
          tone: CommerceTone.warning,
          icon: LucideIcons.undo2,
          iconName: 'undo-2',
          label: 'Return requested',
        ),
      OrderStatus.paymentConfirmed => const OrderStatusPresentation(
          status: OrderStatus.paymentConfirmed,
          tone: CommerceTone.accent,
          icon: LucideIcons.banknote,
          iconName: 'banknote',
          label: 'Payment confirmed',
        ),
      OrderStatus.confirmed => const OrderStatusPresentation(
          status: OrderStatus.confirmed,
          tone: CommerceTone.accent,
          icon: LucideIcons.clipboardCheck,
          iconName: 'clipboard-check',
          label: 'Confirmed',
        ),
      OrderStatus.shipped => const OrderStatusPresentation(
          status: OrderStatus.shipped,
          tone: CommerceTone.accent,
          icon: LucideIcons.truck,
          iconName: 'truck',
          label: 'Shipped',
        ),
      OrderStatus.outForDelivery => const OrderStatusPresentation(
          status: OrderStatus.outForDelivery,
          tone: CommerceTone.accent,
          icon: LucideIcons.mapPin,
          iconName: 'map-pin',
          label: 'Out for delivery',
        ),
      OrderStatus.delivered => const OrderStatusPresentation(
          status: OrderStatus.delivered,
          tone: CommerceTone.success,
          icon: LucideIcons.packageCheck,
          iconName: 'package-check',
          label: 'Delivered',
        ),
      OrderStatus.cancelled => const OrderStatusPresentation(
          status: OrderStatus.cancelled,
          tone: CommerceTone.danger,
          icon: LucideIcons.circleX,
          iconName: 'circle-x',
          label: 'Cancelled',
        ),
      OrderStatus.processing => const OrderStatusPresentation(
          status: OrderStatus.processing,
          tone: CommerceTone.neutral,
          icon: LucideIcons.boxes,
          iconName: 'boxes',
          label: 'Being prepared',
        ),
      OrderStatus.refunded => const OrderStatusPresentation(
          status: OrderStatus.refunded,
          tone: CommerceTone.neutral,
          icon: LucideIcons.rotateCcw,
          iconName: 'rotate-ccw',
          label: 'Refunded',
        ),
      OrderStatus.returned => const OrderStatusPresentation(
          status: OrderStatus.returned,
          tone: CommerceTone.neutral,
          icon: LucideIcons.packageX,
          iconName: 'package-x',
          label: 'Returned',
        ),
    };

/// The status, as a pill.
class OrderStatusPill extends StatelessWidget {
  const OrderStatusPill({required this.status, super.key});

  final OrderStatus status;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final OrderStatusPresentation p = presentationFor(status);
    final ToneColours c = ToneColours.of(t, p.tone);

    return Semantics(
      label: 'Order status: ${p.label}',
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: c.fill,
          borderRadius: BorderRadius.circular(t.radiusPill),
          border: Border.all(color: c.rule),
        ),
        child: Padding(
          padding: EdgeInsetsDirectional.symmetric(
            horizontal: t.spaceTight,
            vertical: t.spaceUnit,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(p.icon, size: type.micro.fontSize! + 3, color: c.ink),
              SizedBox(width: t.spaceUnit),
              Flexible(
                child: Text(
                  p.label,
                  style: type.micro.copyWith(color: c.ink),
                  // No ellipsis: at 200% type the label wraps rather than
                  // becoming "Out for de…", which is not a status.
                  softWrap: true,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
