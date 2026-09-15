import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/rfq.dart';
import '../../../core/l10n/directional_icon.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../core/l10n/numerals.dart';
import '../../../core/ui/async_state_view.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../data/rfq_limits.dart';
import '../data/rfq_providers.dart';
import 'rfq_detail_screen.dart';
import 'rfq_status_pill.dart';
import 'rfq_ui.dart';

/// MY QUOTE REQUESTS.
///
/// THE LIST IS CAPPED AT FIFTY, SERVER-SIDE, AND THIS SCREEN SAYS SO.
///
/// `getRFQsForBuyer` reads a fixed `take: 50` with no cursor, and the response
/// carries no `meta` block at all — so there is no second page to ask for.
/// This screen therefore has **no infinite scroll and no "load more"**: a
/// scroll listener on an uncursored endpoint re-reads the same fifty rows
/// forever, which looks like a working list and is a lie about the buyer's
/// record. When the cap is reached, [_CapNotice] states the bound in the words
/// the constant is checked against.
///
/// Pull-to-refresh belongs here — this is a list of things that have already
/// happened, and refreshing it cannot change what the buyer is about to agree
/// to — and it works in all four states, including the empty one.
class RfqListScreen extends ConsumerWidget {
  const RfqListScreen({this.onOpenRfq, super.key});

  /// Supplied by the router, which owns `/rfqs/:id`. Null pushes the detail
  /// screen directly so the flow works before that wiring lands.
  final void Function(String rfqId)? onOpenRfq;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final AsyncValue<List<RfqCard>> rfqs = ref.watch(myRfqsControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Quote requests')),
      body: SafeArea(
        child: RefreshableView(
          onRefresh: () =>
              ref.read(myRfqsControllerProvider.notifier).refresh(),
          child: AsyncStateView<List<RfqCard>>.standard(
            value: rfqs,
            isEmpty: (List<RfqCard> list) => list.isEmpty,
            onRetry: () => ref.invalidate(myRfqsControllerProvider),
            skeleton: const MeridianSkeleton(shape: MeridianSkeletonShape.list),
            // A FIRST-RUN SCREEN, NOT AN ERROR. Almost nothing in this
            // catalogue can be bought outright, so a buyer with no requests is
            // a buyer who has not started rather than one who has nothing.
            emptyTitle: 'No quote requests yet',
            emptyBody: 'Ask a supplier what something costs and it appears '
                'here — with their price, and your accept or decline. Open a '
                'product and tap Request a quote.',
            data: (BuildContext context, List<RfqCard> list) => Padding(
              padding: EdgeInsetsDirectional.all(t.spaceStack),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  for (final RfqCard rfq in list) ...<Widget>[
                    _RfqRow(
                      rfq: rfq,
                      onTap: () {
                        final void Function(String)? handler = onOpenRfq;
                        if (handler != null) {
                          handler(rfq.id);
                        } else {
                          Navigator.of(context).push<void>(
                            MaterialPageRoute<void>(
                              builder: (BuildContext _) =>
                                  RfqDetailScreen(rfqId: rfq.id),
                            ),
                          );
                        }
                      },
                    ),
                    SizedBox(height: t.spaceTight),
                  ],
                  if (list.length >= kRfqListMax) ...<Widget>[
                    SizedBox(height: t.spaceTight),
                    const _CapNotice(),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// One request, as a row.
class _RfqRow extends StatelessWidget {
  const _RfqRow({required this.rfq, required this.onTap});

  final RfqCard rfq;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final Locale locale =
        Localizations.maybeLocaleOf(context) ?? const Locale('en');
    final RfqSeller? seller = rfq.seller;

    return Semantics(
      button: true,
      label: 'Quote request ${rfq.rfqNumber}, '
          '${presentationForRfq(rfq.status).label}',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: kMinTouchTarget),
          child: QuotePanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: t.spaceTight,
                  runSpacing: t.spaceTight,
                  children: <Widget>[
                    // The RFQ number goes in an email and a supplier's
                    // spreadsheet. Isolated, so Arabic cannot reorder it.
                    DirectionalText.token(
                      rfq.rfqNumber,
                      kind: LtrToken.reference,
                      style: type.ui,
                    ),
                    RfqStatusPill(status: rfq.status),
                  ],
                ),
                SizedBox(height: t.spaceUnit),
                Text(
                  '${Dates.short(rfq.createdAt.toLocal(), locale)} · '
                  '${Numerals.quantity(rfq.itemCount)} '
                  '${rfq.itemCount == 1 ? 'line' : 'lines'}',
                  style: type.meta.copyWith(color: t.ink3),
                ),
                SizedBox(height: t.spaceUnit),
                Text(
                  // `sellerId` is null until somebody quotes — the normal
                  // state of a fresh request, and a "waiting" line rather than
                  // a missing name.
                  seller == null
                      ? 'No supplier yet'
                      : seller.businessNameEn,
                  style: type.meta.copyWith(color: t.ink2),
                ),
                SizedBox(height: t.spaceTight),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: rfq.totalQuotedMoney == null
                          // NOT a zero. Null means "not yet quoted", and a
                          // 0.00 here would say the supplier answered "free".
                          ? Text(
                              'Not quoted yet',
                              style: type.meta.copyWith(color: t.ink3),
                            )
                          : QuoteMoney(
                              rfq.totalQuotedMoney!,
                              style: type.figCard,
                            ),
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

/// THE BOUNDARY, STATED.
///
/// Shown only when the list is actually at the cap. It says what the buyer is
/// looking at and what they are not, and it does not offer a "load more" —
/// there is nothing behind that button. The fix is a cursor in
/// `getRFQsForBuyer`; until then this is the honest thing to render.
class _CapNotice extends StatelessWidget {
  const _CapNotice();

  @override
  Widget build(BuildContext context) {
    return QuoteNotice(
      tone: RfqTone.neutral,
      icon: LucideIcons.info,
      title: 'Showing your ${Numerals.integer(kRfqListMax)} most recent '
          'requests',
      body: 'This is everything the server will return — it sends a fixed '
          'page of ${Numerals.integer(kRfqListMax)} and has no way to ask for '
          'older ones yet. If you need an older request, quote its number to '
          'support.',
    );
  }
}
