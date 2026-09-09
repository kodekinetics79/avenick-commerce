import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/enums.dart';
import '../../../api/models/order.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../core/l10n/numerals.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../data/commerce_gateways.dart';
import '../shared/commerce_ui.dart';
import 'order_status_pill.dart';

/// A shipment's own status — a different value set from [OrderStatus], and
/// deliberately not folded into it.
@immutable
class ShipmentPresentation {
  const ShipmentPresentation({
    required this.tone,
    required this.icon,
    required this.label,
  });

  final CommerceTone tone;
  final IconData icon;
  final String label;

  factory ShipmentPresentation.of(ShipmentStatus status) => switch (status) {
        ShipmentStatus.pending => const ShipmentPresentation(
            tone: CommerceTone.neutral,
            icon: LucideIcons.package,
            label: 'Not dispatched yet',
          ),
        ShipmentStatus.pickedUp => const ShipmentPresentation(
            tone: CommerceTone.accent,
            icon: LucideIcons.warehouse,
            label: 'Picked up',
          ),
        ShipmentStatus.inTransit => const ShipmentPresentation(
            tone: CommerceTone.accent,
            icon: LucideIcons.truck,
            label: 'In transit',
          ),
        ShipmentStatus.outForDelivery => const ShipmentPresentation(
            tone: CommerceTone.accent,
            icon: LucideIcons.mapPin,
            label: 'Out for delivery',
          ),
        ShipmentStatus.delivered => const ShipmentPresentation(
            tone: CommerceTone.success,
            icon: LucideIcons.packageCheck,
            label: 'Delivered',
          ),
        ShipmentStatus.failed => const ShipmentPresentation(
            tone: CommerceTone.danger,
            icon: LucideIcons.circleAlert,
            label: 'Delivery failed',
          ),
        ShipmentStatus.returned => const ShipmentPresentation(
            tone: CommerceTone.neutral,
            icon: LucideIcons.packageX,
            label: 'Returned',
          ),
      };
}

/// ONE SHIPMENT, WITH ITS OWN DATE.
///
/// Each shipment carries its own `estimatedDelivery`, and this renders exactly
/// that. There is no screen in this feature that averages, earliest-ofs or
/// latest-ofs a set of dates into a single "arriving Thursday": a marketplace
/// order becomes N parcels from N sellers, and one blended date is wrong for
/// N−1 of them — usually the one the buyer planned around.
class ShipmentCard extends StatelessWidget {
  const ShipmentCard({required this.shipment, required this.index, super.key});

  final Shipment shipment;

  /// 1-based, for "Delivery 2 of 3".
  final int index;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final ShipmentPresentation p = ShipmentPresentation.of(shipment.status);
    final ToneColours c = ToneColours.of(t, p.tone);
    final Locale locale =
        Localizations.maybeLocaleOf(context) ?? const Locale('en');
    final DateTime? eta = shipment.estimatedDelivery;

    return SectionPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(p.icon, size: 18, color: c.ink),
              SizedBox(width: t.spaceTight),
              Expanded(
                child: Text(
                  'Delivery ${Numerals.integer(index)} — ${p.label}',
                  style: type.ui,
                ),
              ),
            ],
          ),
          SizedBox(height: t.spaceTight),
          if (eta != null)
            DetailRow(
              label: 'Estimated arrival',
              value: Dates.short(eta.toLocal(), locale),
            )
          else
            Text(
              'No arrival date has been given for this delivery.',
              style: type.meta.copyWith(color: t.ink3),
            ),
          if (shipment.carrier != null)
            DetailRow(label: 'Carrier', value: shipment.carrier!),
          if (shipment.trackingNumber != null)
            DetailRow(
              label: 'Tracking number',
              value: shipment.trackingNumber!,
              // An AWB is often all digits, so first-strong isolation would
              // find no strong character and hand it to the paragraph. Forced
              // LTR is what keeps it typeable back into a carrier's site.
              valueToken: LtrToken.awb,
            ),
          if (shipment.trackingNumber != null && !shipment.isTrackable)
            Padding(
              padding: EdgeInsetsDirectional.only(top: t.spaceUnit),
              child: Text(
                'This carrier gave a number but no tracking link.',
                style: type.meta.copyWith(color: t.ink3),
              ),
            ),
        ],
      ),
    );
  }
}

/// The items one seller is sending.
///
/// GROUPED BY SELLER, NOT BY SHIPMENT, AND THAT IS A CONTRACT LIMIT RATHER
/// THAN A CHOICE. `Shipment` carries `id`, `status`, `carrier`,
/// `trackingNumber`, `trackingUrl` and `estimatedDelivery` — and no
/// `sellerId`, no `items`; `OrderItem` carries no `shipmentId`. There is
/// therefore nothing on the wire that says which line travels in which parcel.
///
/// Seller is the grouping the data does support, and it is the one that
/// predicts the parcels: one seller is one dispatch. The shipments are listed
/// beside these groups with their own dates, and the screen says plainly that
/// the mapping between the two is not something the server has told it.
class SellerItemsCard extends ConsumerWidget {
  const SellerItemsCard({
    required this.sellerId,
    required this.items,
    required this.currency,
    required this.index,
    required this.total,
    super.key,
  });

  final String sellerId;
  final List<OrderItem> items;
  final Currency currency;
  final int index;
  final int total;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final Language language = languageOf(context);
    final String? name = ref.watch(sellerNamesProvider)[sellerId];

    return SectionPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Icon(LucideIcons.store, size: 18, color: t.ink2),
              SizedBox(width: t.spaceTight),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    if (name != null)
                      Text(name, style: type.ui)
                    else
                      DirectionalText.rich(
                        <TextSegment>[
                          const TextSegment.prose('Seller '),
                          TextSegment.token(
                            sellerId,
                            kind: LtrToken.reference,
                          ),
                        ],
                        style: type.ui,
                      ),
                    Text(
                      'Dispatch ${Numerals.integer(index)} of '
                      '${Numerals.integer(total)}',
                      style: type.meta.copyWith(color: t.ink3),
                    ),
                  ],
                ),
              ),
            ],
          ),
          Divider(height: t.spaceStack * 2, color: t.hairline),
          for (final OrderItem item in items)
            Padding(
              padding: EdgeInsetsDirectional.symmetric(vertical: t.spaceUnit),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(item.name(language), style: type.body),
                        SizedBox(height: t.spaceUnit),
                        DirectionalText.rich(
                          <TextSegment>[
                            TextSegment.token(item.sku, kind: LtrToken.sku),
                            TextSegment.prose(
                              ' · ${Numerals.quantity(item.quantity)}',
                            ),
                          ],
                          style: type.meta.copyWith(color: t.ink3),
                        ),
                        SizedBox(height: t.spaceUnit),
                        // A line moves independently of its order: one seller
                        // ships while another cancels, so the item's own
                        // status is rendered rather than the order's.
                        OrderStatusPill(status: item.status),
                      ],
                    ),
                  ),
                  SizedBox(width: t.spaceTight),
                  MoneyText(item.totalIn(currency), style: type.body),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Why the parcels and the lines are shown side by side rather than merged.
class ShipmentLinkageNote extends StatelessWidget {
  const ShipmentLinkageNote({super.key});

  @override
  Widget build(BuildContext context) {
    return const CommerceNotice(
      tone: CommerceTone.neutral,
      icon: LucideIcons.info,
      title: 'Deliveries are listed separately from the items',
      body: 'The order tells us which seller each item came from and what each '
          'delivery is doing, but not which delivery is carrying which item. '
          'Rather than guess a pairing, both are shown as they were sent.',
    );
  }
}

/// The status history, oldest first.
class StatusTimeline extends StatelessWidget {
  const StatusTimeline({required this.events, super.key});

  final List<OrderStatusEvent> events;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final Locale locale =
        Localizations.maybeLocaleOf(context) ?? const Locale('en');

    if (events.isEmpty) {
      return Text(
        'Nothing has been recorded on this order yet.',
        style: type.meta.copyWith(color: t.ink3),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        for (int i = 0; i < events.length; i++)
          Padding(
            padding: EdgeInsetsDirectional.only(bottom: t.spaceTight),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                // The rail is a column of dots and connectors, not a mirrored
                // arrow: it reads top-to-bottom in both locales, and it sits on
                // the reading edge because the Row is directional.
                Column(
                  children: <Widget>[
                    SizedBox(height: t.spaceUnit),
                    _Dot(tone: presentationFor(events[i].status).tone),
                    if (i < events.length - 1)
                      Container(
                        width: 2,
                        height: t.spaceBlock,
                        color: t.hairline,
                      ),
                  ],
                ),
                SizedBox(width: t.spaceTight),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      OrderStatusPill(status: events[i].status),
                      SizedBox(height: t.spaceUnit),
                      Text(
                        Dates.full(events[i].occurredAt.toLocal(), locale),
                        style: type.meta.copyWith(color: t.ink3),
                      ),
                      if (events[i].message != null)
                        Text(
                          events[i].message!,
                          style: type.body.copyWith(color: t.ink2),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.tone});

  final CommerceTone tone;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final ToneColours c = ToneColours.of(t, tone);
    return Container(
      width: 10,
      height: 10,
      decoration: BoxDecoration(
        color: c.fill,
        shape: BoxShape.circle,
        border: Border.all(color: c.rule),
      ),
    );
  }
}

/// Items grouped by seller, in first-appearance order.
List<MapEntry<String, List<OrderItem>>> groupBySeller(List<OrderItem> items) {
  final List<String> order = <String>[];
  final Map<String, List<OrderItem>> bySeller = <String, List<OrderItem>>{};
  for (final OrderItem item in items) {
    bySeller.putIfAbsent(item.sellerId, () {
      order.add(item.sellerId);
      return <OrderItem>[];
    }).add(item);
  }
  return <MapEntry<String, List<OrderItem>>>[
    for (final String sellerId in order)
      MapEntry<String, List<OrderItem>>(sellerId, bySeller[sellerId]!),
  ];
}
