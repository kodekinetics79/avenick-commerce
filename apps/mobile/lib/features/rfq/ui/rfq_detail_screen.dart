import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/enums.dart';
import '../../../api/models/money.dart';
import '../../../api/models/rfq.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../core/l10n/numerals.dart';
import '../../../core/ui/async_state_view.dart';
import '../../../core/ui/key_button.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../data/rfq_decision_controller.dart';
import '../data/rfq_providers.dart';
import 'rfq_status_pill.dart';
import 'rfq_ui.dart';

/// ONE QUOTE REQUEST, AND THE DECISION ON IT.
///
/// The last screen of the app's primary journey and the only one with money on
/// it. Three rules govern everything below:
///
///  1. **Every figure is the server's.** Unit prices come from
///     `RfqItem.unitQuoted` and the total from `RfqDetail.totalQuoted`, each
///     paired with the request's own currency through `Money`. Nothing here
///     multiplies, sums or rounds — see [_LinesPanel] for why the contract
///     deliberately has no per-line total.
///  2. **A null price is not a zero.** `unitQuoted` is null until the supplier
///     has priced a line, and rendering that as 0.00 would tell a buyer a
///     supplier quoted "free".
///  3. **No expiry is ever drawn.** `RFQRequest.expiresAt` is a column nothing
///     writes, so "expires in N days" computed from it would be a countdown to
///     a date that does not exist.
class RfqDetailScreen extends ConsumerWidget {
  const RfqDetailScreen({required this.rfqId, super.key});

  final String rfqId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final AsyncValue<RfqDetail> rfq = ref.watch(rfqDetailProvider(rfqId));

    return Scaffold(
      appBar: AppBar(title: const Text('Quote request')),
      body: SafeArea(
        child: RefreshableView(
          onRefresh: () => ref.refresh(rfqDetailProvider(rfqId).future),
          child: AsyncStateView<RfqDetail>.standard(
            value: rfq,
            // The contract requires at least one line, so a request with none
            // is a record worth reporting rather than an empty screen worth
            // ignoring.
            isEmpty: (RfqDetail d) => d.items.isEmpty,
            onRetry: () => ref.invalidate(rfqDetailProvider(rfqId)),
            skeleton:
                const MeridianSkeleton(shape: MeridianSkeletonShape.detail),
            emptyTitle: 'This request has no lines',
            emptyBody: 'The request exists but nothing is on it, so no '
                'supplier can price it. Quote its number to support.',
            data: (BuildContext context, RfqDetail detail) => Padding(
              padding: EdgeInsetsDirectional.all(t.spaceStack),
              child: RfqDetailBody(rfq: detail),
            ),
          ),
        ),
      ),
    );
  }
}

/// The body, split out so a test and a golden can render one without a
/// provider graph, and so nothing can drift between them.
class RfqDetailBody extends StatelessWidget {
  const RfqDetailBody({required this.rfq, super.key});

  final RfqDetail rfq;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final Locale locale =
        Localizations.maybeLocaleOf(context) ?? const Locale('en');
    final RfqStatusPresentation presentation = presentationForRfq(rfq.status);
    final RfqSeller? seller = rfq.seller;
    final DateTime? requiredBy = rfq.requiredBy;
    final String? notes = rfq.notes;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        // ── WHAT THIS IS, AND WHOSE MOVE IT IS ──────────────────────────────
        QuotePanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              DirectionalText.token(
                rfq.rfqNumber,
                kind: LtrToken.reference,
                style: type.h3,
              ),
              SizedBox(height: t.spaceUnit),
              Text(
                'Raised ${Dates.full(rfq.createdAt.toLocal(), locale)}',
                style: type.meta.copyWith(color: t.ink3),
              ),
              SizedBox(height: t.spaceTight),
              Wrap(
                spacing: t.spaceTight,
                runSpacing: t.spaceTight,
                children: <Widget>[RfqStatusPill(status: rfq.status)],
              ),
              SizedBox(height: t.spaceTight),
              // The pill names the state; this says what to do about it, which
              // is the thing a buyer actually wants from a status.
              Text(
                presentation.meaning,
                style: type.body.copyWith(color: t.ink2),
              ),
              if (requiredBy != null) ...<Widget>[
                SizedBox(height: t.spaceTight),
                QuoteRow(
                  label: 'Needed by',
                  value: Dates.short(requiredBy.toLocal(), locale),
                ),
              ],
              // `expiresAt` is deliberately absent. See the class doc.
            ],
          ),
        ),
        SizedBox(height: t.spaceStack),

        // ── WHO IS ANSWERING ────────────────────────────────────────────────
        QuotePanel(
          title: 'Supplier',
          child: seller == null
              ? Text(
                  // `submitQuote` is the only writer of `sellerId` and it
                  // claims the request in the same update that prices it, so
                  // "no supplier" is the normal state of a live request.
                  'No supplier has picked this request up yet. When one does, '
                  'their name and their price appear here.',
                  style: type.body.copyWith(color: t.ink2),
                )
              : Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Icon(LucideIcons.building2, size: 18, color: t.ink3),
                    SizedBox(width: t.spaceTight),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          // `businessNameEn` is the only name on the wire —
                          // there is no `businessNameAr` on this surface, so
                          // an Arabic UI shows the English trading name.
                          Text(seller.businessNameEn, style: type.ui),
                          SizedBox(height: t.spaceUnit),
                          Text(
                            _tierLabel(seller.tier),
                            style: type.meta.copyWith(color: t.ink3),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
        ),
        SizedBox(height: t.spaceStack),

        // ── WHAT WAS ASKED FOR, AND WHAT IT COSTS ───────────────────────────
        _LinesPanel(rfq: rfq),
        SizedBox(height: t.spaceStack),
        _TotalPanel(rfq: rfq),
        SizedBox(height: t.spaceStack),

        // ── THE DECISION ────────────────────────────────────────────────────
        if (rfq.status.isDecidable) ...<Widget>[
          RfqDecisionPanel(rfq: rfq),
          SizedBox(height: t.spaceStack),
        ],

        if (notes != null && notes.trim().isNotEmpty) ...<Widget>[
          QuotePanel(
            title: 'Your note',
            child: Text(notes, style: type.body.copyWith(color: t.ink2)),
          ),
          SizedBox(height: t.spaceStack),
        ],

        if (rfq.messageCount > 0)
          QuoteNotice(
            tone: RfqTone.neutral,
            icon: LucideIcons.messagesSquare,
            title: '${Numerals.integer(rfq.messageCount)} '
                '${rfq.messageCount == 1 ? 'message' : 'messages'} on this '
                'request',
            // Honest about the gap: `Message` carries sender types, read state
            // and attachments and needs its own endpoint. The app can count
            // them; it cannot show the conversation.
            body: 'The conversation is not on this screen yet — open the '
                'request in the buyer portal to read it.',
          ),
      ],
    );
  }
}

String _tierLabel(SellerTier tier) => switch (tier) {
      SellerTier.standard => 'Standard supplier',
      SellerTier.verified => 'Verified supplier',
      SellerTier.gold => 'Gold supplier',
      SellerTier.platinum => 'Platinum supplier',
    };

/// The lines, with the supplier's unit prices on them once there are any.
///
/// **THERE IS NO LINE TOTAL HERE, AND THAT IS DELIBERATE.** `submitQuote`
/// computes `Σ unitQuoted × quantity` and stores the result rounded ONCE in
/// `totalQuoted`. Rounding each line separately in this app and letting the
/// buyer add them up can differ from the stored figure by cents — two numbers
/// on one screen that do not agree, with the app's arithmetic contradicting the
/// supplier's invoice. The quantity and the unit price are what the supplier
/// actually quoted; the aggregate below is authoritative.
class _LinesPanel extends StatelessWidget {
  const _LinesPanel({required this.rfq});

  final RfqDetail rfq;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return QuotePanel(
      title: 'What you asked for',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          for (int i = 0; i < rfq.items.length; i++) ...<Widget>[
            if (i > 0) Divider(color: t.hairline, height: t.spaceStack),
            _LineTile(item: rfq.items[i], currency: rfq.currency),
          ],
          if (rfq.isQuoted) ...<Widget>[
            SizedBox(height: t.spaceTight),
            Text(
              'Prices shown are per unit. The total is the supplier\'s own '
              'figure for the whole request, not a sum worked out here.',
              style: type.meta.copyWith(color: t.ink3),
            ),
          ],
        ],
      ),
    );
  }
}

class _LineTile extends StatelessWidget {
  const _LineTile({required this.item, required this.currency});

  final RfqItem item;
  final Currency currency;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final Money? unit = item.unitQuotedIn(currency);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        // `nameEn` only — the RFQ surface carries no Arabic name for a line,
        // and on a `productId` line this is the catalogue's own name, which
        // the server resolved rather than trusting the client's.
        Text(item.nameEn, style: type.ui),
        QuoteRow(
          label: 'Quantity',
          value: Numerals.quantity(item.quantity),
        ),
        if (unit != null)
          QuoteRow.money(label: 'Unit price', money: unit)
        else
          const QuoteRow(
            label: 'Unit price',
            // Null is "not priced", never "free".
            value: 'Not priced yet',
          ),
        if (item.notes != null && item.notes!.trim().isNotEmpty) ...<Widget>[
          SizedBox(height: t.spaceUnit),
          Text(item.notes!, style: type.meta.copyWith(color: t.ink3)),
        ],
      ],
    );
  }
}

/// The supplier's total for the whole request — one figure, straight off the
/// wire.
class _TotalPanel extends StatelessWidget {
  const _TotalPanel({required this.rfq});

  final RfqDetail rfq;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final Money? total = rfq.totalQuotedMoney;

    return QuotePanel(
      title: 'The quote',
      child: total == null
          ? Text(
              'No price yet. The total appears here once a supplier has '
              'quoted the request.',
              style: type.body.copyWith(color: t.ink2),
            )
          : QuoteRow.money(
              label: 'Total quoted',
              money: total,
              emphasis: true,
            ),
    );
  }
}

/// ACCEPT OR DECLINE — and the stale-quote path.
///
/// Public because it is the piece worth rendering on its own in a test: the
/// version-mismatch flow is the most consequential branch in the app and it
/// should not have to be reached through three screens to be exercised.
class RfqDecisionPanel extends ConsumerWidget {
  const RfqDecisionPanel({required this.rfq, super.key});

  /// The payload the buyer is LOOKING AT. Its `quoteVersion` is what gets
  /// sent — never one re-read at the moment of the tap, which would defeat the
  /// server's check entirely.
  final RfqDetail rfq;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final RfqDecisionState state =
        ref.watch(rfqDecisionControllerProvider(rfq.id));
    final RfqDecisionController controller =
        ref.read(rfqDecisionControllerProvider(rfq.id).notifier);

    if (!rfq.isQuoted) {
      // A decidable status with no total is a supplier who responded without
      // pricing. There is nothing to accept, so nothing is offered.
      return const QuoteNotice(
        tone: RfqTone.neutral,
        icon: LucideIcons.hourglass,
        title: 'Nothing to decide yet',
        body: 'This request is with a supplier but carries no price, so there '
            'is nothing to accept or decline.',
      );
    }

    return switch (state) {
      RfqQuoteMoved() => _QuoteMovedPanel(
          moved: state,
          onDecide: controller.confirmMovedQuote,
          onDismiss: controller.dismiss,
        ),
      RfqDecisionBlocked() => QuoteNotice(
          tone: RfqTone.warning,
          icon: LucideIcons.circleAlert,
          title: 'This request has moved on',
          // The server's own sentence. `decideRFQ` writes these to be read:
          // "Only quoted RFQs can be accepted or rejected".
          body: state.message,
          actions: <Widget>[
            KeyButton(
              label: 'Reload the request',
              tone: KeyButtonTone.accent,
              size: KeyButtonSize.small,
              onPressed: controller.dismiss,
            ),
          ],
        ),
      RfqDecisionSettled() => QuoteNotice(
          tone: state.decision == RfqDecision.accepted
              ? RfqTone.success
              : RfqTone.neutral,
          icon: state.decision == RfqDecision.accepted
              ? LucideIcons.circleCheck
              : LucideIcons.circleX,
          title: state.decision == RfqDecision.accepted
              ? 'Quote accepted'
              : 'Quote declined',
          body: state.decision == RfqDecision.accepted
              ? 'The supplier has been told. They will be in touch to arrange '
                  'the order.'
              : 'The supplier has been told. Raise a new request if you still '
                  'need the goods.',
        ),
      RfqDecisionIdle() ||
      RfqDecisionSubmitting() ||
      RfqDecisionFailed() =>
        QuotePanel(
          title: 'Your decision',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              if (state is RfqDecisionFailed) ...<Widget>[
                QuoteNotice(
                  tone: RfqTone.danger,
                  icon: LucideIcons.circleAlert,
                  title: 'The decision was not sent',
                  body: state.failure.displayMessage,
                ),
                SizedBox(height: t.spaceStack),
              ],
              Text(
                'Accepting commits you to this price. Nothing is agreed until '
                'you choose.',
                style: type.meta.copyWith(color: t.ink3),
              ),
              SizedBox(height: t.spaceTight),
              _DecisionActions(
                busyWith: state is RfqDecisionSubmitting ? state.decision : null,
                enabled: !state.isBusy,
                onAccept: () =>
                    controller.decide(RfqDecision.accepted, seen: rfq),
                onDecline: () =>
                    controller.decide(RfqDecision.rejected, seen: rfq),
              ),
            ],
          ),
        ),
    };
  }
}

/// The two buttons, side by side until dynamic type says otherwise.
class _DecisionActions extends StatelessWidget {
  const _DecisionActions({
    required this.busyWith,
    required this.enabled,
    required this.onAccept,
    required this.onDecline,
  });

  final RfqDecision? busyWith;
  final bool enabled;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;

    final Widget accept = KeyButton(
      key: const ValueKey<String>('rfq-accept'),
      label: 'Accept this quote',
      icon: const Icon(LucideIcons.circleCheck),
      size: KeyButtonSize.large,
      expand: true,
      busy: busyWith == RfqDecision.accepted,
      // Null while a request is in flight: the visible half of the
      // double-submit guard. The controller refuses a second call regardless.
      onPressed: enabled ? onAccept : null,
    );
    final Widget decline = KeyButton(
      key: const ValueKey<String>('rfq-decline'),
      label: 'Decline',
      tone: KeyButtonTone.danger,
      size: KeyButtonSize.large,
      expand: true,
      busy: busyWith == RfqDecision.rejected,
      onPressed: enabled ? onDecline : null,
    );

    if (stacksActions(context)) {
      // At 200% type two verbs cannot share a phone's width, and the failure
      // mode of trying is an ellipsis on the most consequential control here.
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          accept,
          SizedBox(height: t.spaceTight),
          decline,
        ],
      );
    }

    return Row(
      children: <Widget>[
        Expanded(child: accept),
        SizedBox(width: t.spaceTight),
        Expanded(child: decline),
      ],
    );
  }
}

/// THE QUOTE MOVED WHILE THE SCREEN WAS OPEN.
///
/// This is the panel the whole decision controller exists to draw. The server
/// refused the decision because `expectedQuoteVersion` no longer matched, and
/// the only correct response is to show the buyer **what changed** and make
/// them agree again. Everything here is a comparison of two payloads the
/// server sent; nothing is computed.
class _QuoteMovedPanel extends StatelessWidget {
  const _QuoteMovedPanel({
    required this.moved,
    required this.onDecide,
    required this.onDismiss,
  });

  final RfqQuoteMoved moved;

  /// Both buttons are live and both act on the REVISED quote. Wiring one of
  /// them to "dismiss" — on the grounds that the buyer only came to accept —
  /// would mean a buyer shown a price they hate taps Decline and nothing is
  /// declined.
  final void Function(RfqDecision decision) onDecide;

  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final RfqToneColours c = RfqToneColours.of(t, RfqTone.warning);
    final Money? before = moved.seen.totalQuotedMoney;
    final Money? after = moved.current.totalQuotedMoney;
    final bool accepting = moved.attempted == RfqDecision.accepted;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: c.fill,
        borderRadius: BorderRadius.circular(t.radius),
        border: Border.all(color: c.rule, width: t.ringWidth),
      ),
      child: Padding(
        padding: EdgeInsetsDirectional.all(t.spaceStack),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Icon(
                  LucideIcons.triangleAlert,
                  size: type.ui.fontSize! + 4,
                  color: c.ink,
                ),
                SizedBox(width: t.spaceTight),
                Expanded(
                  child: Text(
                    'The supplier changed this quote',
                    style: type.h3.copyWith(color: c.ink),
                  ),
                ),
              ],
            ),
            SizedBox(height: t.spaceTight),
            Text(
              accepting
                  ? 'Your acceptance was not sent. The price was revised while '
                      'this screen was open, so nothing was agreed — check '
                      'what changed and decide again.'
                  : 'Your decline was not sent. The quote was revised while '
                      'this screen was open, so check what changed before you '
                      'decide again.',
              style: type.body.copyWith(color: t.ink1),
            ),
            SizedBox(height: t.spaceStack),

            // ── WHAT CHANGED ────────────────────────────────────────────────
            if (moved.totalChanged) ...<Widget>[
              _ChangeRow(
                label: 'You saw',
                child: before == null
                    ? Text(
                        'No price',
                        style: type.ui.copyWith(color: t.ink2),
                      )
                    : QuoteMoney(
                        before,
                        style: type.body.copyWith(
                          color: t.ink2,
                          decoration: TextDecoration.lineThrough,
                        ),
                      ),
              ),
              _ChangeRow(
                label: 'It is now',
                child: after == null
                    ? Text('No price', style: type.figCard.copyWith(color: t.ink1))
                    : QuoteMoney(after, style: type.figCard),
              ),
            ],
            if (moved.sellerChanged)
              _ChangeRow(
                label: 'Supplier',
                child: Text(
                  moved.current.seller?.businessNameEn ?? 'No supplier',
                  style: type.ui,
                ),
              ),
            if (moved.statusChanged)
              _ChangeRow(
                label: 'Status',
                child: RfqStatusPill(status: moved.current.status),
              ),
            if (!moved.totalChanged &&
                !moved.sellerChanged &&
                !moved.statusChanged)
              // The version moved but nothing this surface renders did — a
              // re-quote at the same total, or a change in a field the buyer
              // endpoints do not expose. Say so rather than showing an empty
              // "what changed" list.
              Text(
                'The supplier filed a revision. The total is unchanged, so '
                'what moved is not something this screen shows.',
                style: type.body.copyWith(color: t.ink2),
              ),

            SizedBox(height: t.spaceStack),
            if (moved.stillDecidable)
              _DecisionActions(
                busyWith: null,
                enabled: true,
                onAccept: () => onDecide(RfqDecision.accepted),
                onDecline: () => onDecide(RfqDecision.rejected),
              )
            else
              Text(
                'This request can no longer be decided.',
                style: type.body.copyWith(color: t.ink2),
              ),
            SizedBox(height: t.spaceTight),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: KeyButton(
                key: const ValueKey<String>('rfq-moved-dismiss'),
                label: 'Show me the new quote first',
                tone: KeyButtonTone.ghost,
                size: KeyButtonSize.small,
                onPressed: onDismiss,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One "before / after" line of the change list.
class _ChangeRow extends StatelessWidget {
  const _ChangeRow({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return Padding(
      padding: EdgeInsetsDirectional.symmetric(vertical: t.spaceUnit),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: t.spaceStack,
        runSpacing: t.spaceUnit,
        children: <Widget>[
          Text(label, style: type.body.copyWith(color: t.ink2)),
          child,
        ],
      ),
    );
  }
}
