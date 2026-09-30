import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show NotifierProviderFamily;

import '../../../api/models/enums.dart';
import '../../../api/models/requests.dart';
import '../../../api/models/rfq.dart';
import '../../../core/error/failures.dart';
import 'rfq_providers.dart';

/// ACCEPTING OR DECLINING A QUOTE — AND WHAT HAPPENS WHEN THE PRICE MOVED.
///
/// This is the one write in the app with real money on the other end of it, and
/// the whole controller exists for a single failure mode:
///
///   The buyer opens a quote for 12,450.00 AED. The supplier revises it to
///   14,900.00 AED while the screen is open. The buyer taps Accept.
///
/// `decideRFQ` compares `expectedQuoteVersion` against the stored version
/// inside a transaction holding the RFQ's advisory lock and refuses, answering
/// `conflict`. **That refusal is the feature working**, and rendering it as
/// "Something went wrong. Try again." would be the worst possible response: the
/// buyer taps again, this app sends whatever version it now holds, and the
/// guard the server engineer built becomes a rubber stamp on a price nobody
/// read. A stale accept is a financial mistake, not a transient error.
///
/// So a conflict is caught here, the request is re-read, and the two payloads
/// are handed to the screen side by side as [RfqQuoteMoved] — the total the
/// buyer agreed to, the total that now stands, and a fresh, explicit
/// confirmation before anything is sent again.
///
/// THE VERSION SENT IS ALWAYS THE ONE THE BUYER READ. [decide] takes the
/// [RfqDetail] that was on screen and reads `quoteVersion` off it; it never
/// re-fetches "the latest version" at the moment of the tap, which would defeat
/// the check entirely.
@immutable
sealed class RfqDecisionState {
  const RfqDecisionState();

  /// Whether a request is in flight. The submit buttons read this — it is the
  /// double-submit guard's visible half.
  bool get isBusy => this is RfqDecisionSubmitting;
}

/// Nothing has been attempted, or the buyer has dismissed what was.
class RfqDecisionIdle extends RfqDecisionState {
  const RfqDecisionIdle();
}

/// In flight. [decide] refuses to start a second one.
class RfqDecisionSubmitting extends RfqDecisionState {
  const RfqDecisionSubmitting(this.decision);

  final RfqDecision decision;
}

/// The decision landed. [result] is the request as the server left it.
class RfqDecisionSettled extends RfqDecisionState {
  const RfqDecisionSettled({required this.decision, required this.result});

  final RfqDecision decision;
  final RfqDetail result;
}

/// THE QUOTE MOVED UNDER THE BUYER.
///
/// The server refused on the version check and the re-read came back with a
/// different `quoteVersion`. Both payloads are carried so the screen can say
/// what actually changed rather than "something changed": [seen] is what the
/// buyer was looking at when they tapped, [current] is what stands now.
class RfqQuoteMoved extends RfqDecisionState {
  const RfqQuoteMoved({
    required this.attempted,
    required this.seen,
    required this.current,
  });

  /// What the buyer was trying to do, so the re-confirmation can offer the
  /// same action rather than starting the choice over.
  final RfqDecision attempted;

  /// The quote the buyer read.
  final RfqDetail seen;

  /// The quote the supplier has since filed.
  final RfqDetail current;

  bool get totalChanged => seen.totalQuoted != current.totalQuoted;
  bool get statusChanged => seen.status != current.status;

  bool get sellerChanged =>
      seen.seller?.businessNameEn != current.seller?.businessNameEn;

  /// Whether the buyer can still decide at all. A supplier who withdrew — or
  /// an RFQ somebody cancelled — leaves nothing to re-confirm, and the screen
  /// must offer no button rather than one that answers `conflict` again.
  bool get stillDecidable => current.awaitsDecision;
}

/// A `conflict` that is NOT a version move: the request is no longer in a
/// state `decideRFQ` accepts — already decided, cancelled, or never quoted.
///
/// Distinguished from [RfqQuoteMoved] because the answer is different: there is
/// nothing to re-confirm, and the server's own sentence is the clearest thing
/// to show.
class RfqDecisionBlocked extends RfqDecisionState {
  const RfqDecisionBlocked({required this.message, this.current});

  /// The server's message, verbatim. `decideRFQ` writes these to be read:
  /// "Only quoted RFQs can be accepted or rejected".
  final String message;

  /// The request as it now stands, when the re-read succeeded. Null when it
  /// did not — in which case the screen says the state is unknown rather than
  /// drawing a stale one.
  final RfqDetail? current;
}

/// Anything else: offline, a timeout, a 500, an expired credential.
class RfqDecisionFailed extends RfqDecisionState {
  const RfqDecisionFailed(this.failure);

  final ApiFailure failure;
}

/// The controller. One per RFQ id.
class RfqDecisionController extends Notifier<RfqDecisionState> {
  RfqDecisionController(this.rfqId);

  final String rfqId;

  @override
  RfqDecisionState build() => const RfqDecisionIdle();

  /// Send a decision against the version the buyer READ.
  ///
  /// [seen] is the payload that was on screen. Passing the freshest known
  /// detail here instead would send a version the buyer never looked at, which
  /// is precisely what `expectedQuoteVersion` exists to prevent.
  Future<void> decide(RfqDecision decision, {required RfqDetail seen}) async {
    // THE DOUBLE-SUBMIT GUARD. The button also disables itself, but a state
    // check here is what makes a second tap during the frame between the tap
    // and the rebuild a no-op rather than a second POST.
    if (state.isBusy) return;
    state = RfqDecisionSubmitting(decision);

    try {
      final RfqDetail result = await ref.read(rfqRepositoryProvider).decide(
            rfqId,
            RfqDecisionRequest(
              decision: decision,
              expectedQuoteVersion: seen.quoteVersion,
            ),
          );
      state = RfqDecisionSettled(decision: decision, result: result);
      // The detail and the list both changed. Invalidate rather than push the
      // new payload in: an invalidated provider nobody is watching costs
      // nothing, and one that is watched refetches through the same path as
      // every other read.
      ref.invalidate(rfqDetailProvider(rfqId));
      ref.invalidate(myRfqsControllerProvider);
    } on ApiFailure catch (failure) {
      if (failure is ServerFailure && failure.isConflict) {
        await _explainConflict(decision: decision, seen: seen, refusal: failure);
      } else {
        state = RfqDecisionFailed(failure);
      }
    }
  }

  /// Decide again after a move, against the version the buyer has now been
  /// SHOWN.
  ///
  /// Reachable only from [RfqQuoteMoved], and only by an explicit second tap.
  /// This is the point of the whole class: the new version is sent because the
  /// buyer read the new price, not because this app fetched it.
  ///
  /// It takes the decision rather than replaying [RfqQuoteMoved.attempted],
  /// because seeing the revised price is exactly the moment a buyer changes
  /// their mind — someone who came to accept 12,450 and is shown 14,900 must
  /// be able to decline it here, not merely walk away.
  Future<void> confirmMovedQuote(RfqDecision decision) async {
    final RfqDecisionState current = state;
    if (current is! RfqQuoteMoved) return;
    if (!current.stillDecidable) return;
    await decide(decision, seen: current.current);
  }

  /// Walk away from a move, a block or a failure and go back to the request.
  void dismiss() {
    state = const RfqDecisionIdle();
    ref.invalidate(rfqDetailProvider(rfqId));
  }

  /// The server refused on state. Find out which kind of refusal it was.
  Future<void> _explainConflict({
    required RfqDecision decision,
    required RfqDetail seen,
    required ServerFailure refusal,
  }) async {
    try {
      final RfqDetail current = await ref.read(rfqRepositoryProvider).rfq(rfqId);
      state = current.quoteVersion != seen.quoteVersion
          ? RfqQuoteMoved(attempted: decision, seen: seen, current: current)
          : RfqDecisionBlocked(message: refusal.message, current: current);
    } on ApiFailure catch (_) {
      // The decision was refused and the re-read failed too. We know the state
      // moved and cannot say how — so the buyer is told exactly that, and is
      // NOT offered a re-confirm that would send a version nobody has seen.
      state = RfqDecisionBlocked(message: refusal.message);
    }
  }
}

final NotifierProviderFamily<RfqDecisionController, RfqDecisionState, String>
    rfqDecisionControllerProvider =
    NotifierProvider.family<RfqDecisionController, RfqDecisionState, String>(
  RfqDecisionController.new,
);
