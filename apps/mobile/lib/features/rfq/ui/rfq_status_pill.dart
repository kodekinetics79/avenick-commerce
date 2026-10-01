import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/enums.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import 'rfq_ui.dart';

/// HOW AN RFQ STATUS IS COLOURED. Read this before changing a hue.
///
/// The tone answers exactly one question — **whose move is it?** — and that is
/// the same question `apps/customer/src/components/b2b/rfq-status.ts` answers
/// on the web. This table is deliberately the same table: an RFQ that is amber
/// in the buyer portal and grey in the app is two claims about one request, and
/// the buyer is looking at both on the same desk.
///
///   warning — YOURS, right now
///   accent  — the supplier's, and they are engaged
///   neutral — nobody's; parked, spent, or not yet sent
///   success — settled, in the buyer's favour
///   danger  — settled, and not
///
/// **`QUOTED` IS THE ONLY WARNING**, and that is the rule this app applies
/// everywhere: warning means "you have something to do". A quote on the table
/// is the one RFQ state where the platform is waiting on the buyer, and it is
/// the state the whole feature exists to get to.
///
/// **`SUBMITTED` is NEUTRAL and `UNDER_REVIEW` is ACCENT**, which looks
/// backwards until you know the schema. `submitQuote` is the only writer of
/// `RFQRequest.sellerId` and it claims the request in the same update that
/// moves it to `QUOTED` — so a `SUBMITTED` request has **no supplier attached
/// at all**. Nobody is working on it yet; it is in the pool. `UNDER_REVIEW`
/// means somebody is.
///
/// **`REJECTED` is DANGER even though it is usually the buyer's own decline.**
/// It is the one place this map's logic is arguable — the orders map calls
/// `REFUNDED` neutral on the grounds that a completed, correct outcome should
/// not be painted red. The web calls RFQ rejection danger, and matching it
/// matters more than winning the argument, because the two surfaces sit side by
/// side. Flagged in the report rather than silently diverged.
///
/// **TWO OF THESE NINE CAN NEVER RENDER TODAY.** Nothing in
/// `packages/database/src/services/` writes `NEGOTIATING`, and nothing writes
/// `EXPIRED` either — `RFQRequest.expiresAt` has no writer, which is also why
/// no screen in this feature draws an expiry. They are in the table because
/// the enum has them: a status this app cannot draw is a screen that breaks the
/// day somebody adds the writer.
@immutable
class RfqStatusPresentation {
  const RfqStatusPresentation({
    required this.status,
    required this.tone,
    required this.icon,
    required this.iconName,
    required this.label,
    required this.meaning,
  });

  final RfqStatus status;
  final RfqTone tone;
  final IconData icon;

  /// The lucide name, so the mirroring policy in
  /// `lib/core/l10n/directional_icon.dart` can be applied by name rather than
  /// guessed from a code point.
  final String iconName;

  /// The pill's text. Matches the web's `status.rfq.*` English strings word for
  /// word — the same request must not be "Quote received" in one place and
  /// "Quoted" in the other.
  final String label;

  /// One line for the detail screen: what this state means for the buyer, in
  /// plain terms. A pill says the name of a state; this says what to do about
  /// it, which is the thing a buyer actually wants.
  final String meaning;
}

/// THE ONE TABLE. Everything that renders an RFQ status reads it from here.
RfqStatusPresentation presentationForRfq(RfqStatus status) => switch (status) {
      // ── Waiting on the buyer. The only warning. ──────────────────────────
      RfqStatus.quoted => const RfqStatusPresentation(
          status: RfqStatus.quoted,
          tone: RfqTone.warning,
          icon: LucideIcons.receipt,
          iconName: 'receipt',
          label: 'Quote received',
          meaning: 'A supplier has priced this request. Accept it or decline '
              'it below — nothing is agreed until you do.',
        ),

      // ── The supplier's move. ─────────────────────────────────────────────
      RfqStatus.underReview => const RfqStatusPresentation(
          status: RfqStatus.underReview,
          tone: RfqTone.accent,
          icon: LucideIcons.fileSearch,
          iconName: 'file-search',
          label: 'Under review',
          meaning: 'A supplier is working on this request. You will be able to '
              'accept or decline once they have priced it.',
        ),
      RfqStatus.negotiating => const RfqStatusPresentation(
          status: RfqStatus.negotiating,
          tone: RfqTone.accent,
          icon: LucideIcons.handshake,
          iconName: 'handshake',
          label: 'Negotiating',
          meaning: 'The price on this request is still moving. You can accept '
              'or decline what stands now.',
        ),

      // ── Nobody's move: parked, or never sent. ────────────────────────────
      RfqStatus.draft => const RfqStatusPresentation(
          status: RfqStatus.draft,
          tone: RfqTone.neutral,
          icon: LucideIcons.pencil,
          iconName: 'pencil',
          label: 'Draft',
          meaning: 'This request has not been sent to any supplier yet.',
        ),
      RfqStatus.submitted => const RfqStatusPresentation(
          status: RfqStatus.submitted,
          tone: RfqTone.neutral,
          icon: LucideIcons.send,
          iconName: 'send',
          label: 'Submitted',
          // No supplier is attached yet — `sellerId` is null until somebody
          // quotes — so this deliberately does not promise a response time.
          meaning: 'Sent. No supplier has picked it up yet; you will see their '
              'name here when one does.',
        ),
      RfqStatus.expired => const RfqStatusPresentation(
          status: RfqStatus.expired,
          tone: RfqTone.neutral,
          icon: LucideIcons.hourglass,
          iconName: 'hourglass',
          label: 'Expired',
          meaning: 'This request lapsed without a decision. Raise a new one to '
              'ask again.',
        ),
      RfqStatus.cancelled => const RfqStatusPresentation(
          status: RfqStatus.cancelled,
          tone: RfqTone.neutral,
          icon: LucideIcons.ban,
          iconName: 'ban',
          label: 'Cancelled',
          meaning: 'This request was cancelled. Nothing further will happen '
              'to it.',
        ),

      // ── Settled. ─────────────────────────────────────────────────────────
      RfqStatus.accepted => const RfqStatusPresentation(
          status: RfqStatus.accepted,
          tone: RfqTone.success,
          icon: LucideIcons.circleCheck,
          iconName: 'circle-check',
          label: 'Accepted',
          meaning: 'You accepted this quote. The supplier will be in touch to '
              'arrange the order.',
        ),
      RfqStatus.rejected => const RfqStatusPresentation(
          status: RfqStatus.rejected,
          tone: RfqTone.danger,
          icon: LucideIcons.circleX,
          iconName: 'circle-x',
          label: 'Rejected',
          meaning: 'This quote was declined. Raise a new request if you still '
              'need the goods.',
        ),
    };

/// The status, as a pill.
class RfqStatusPill extends StatelessWidget {
  const RfqStatusPill({required this.status, super.key});

  final RfqStatus status;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final RfqStatusPresentation p = presentationForRfq(status);
    final RfqToneColours c = RfqToneColours.of(t, p.tone);

    return Semantics(
      label: 'Request status: ${p.label}',
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
                  // becoming "Quote receiv…", which is not a status.
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
