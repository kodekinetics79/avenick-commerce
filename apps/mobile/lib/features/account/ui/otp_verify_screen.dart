import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/auth.dart';
import '../../../core/error/failures.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../core/l10n/numerals.dart';
import '../../../core/ui/async_state_view.dart';
import '../../../core/ui/key_button.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../data/auth_actions.dart';
import '../data/gcc_market.dart';
import 'account_chrome.dart';
import 'otp_input.dart';
import 'register_screen.dart';

/// ── ENDPOINTS THIS SCREEN NEEDS ─────────────────────────────────────────────
/// `POST /v1/auth/otp/verify`   — exchange the code for a token pair.
/// `POST /v1/auth/otp/request`  — resend.
///
/// NEITHER EXISTS. There is no OTP model in `schema.prisma`, no challenge row,
/// and no SMS provider wired up, so nothing has actually sent a code to the
/// number this screen names. Verification fails with `not_found` and the screen
/// says exactly that — it does not pretend the code was wrong, because blaming
/// the user for a missing endpoint is how a support queue fills up with people
/// retyping a code that was never sent.
/// ────────────────────────────────────────────────────────────────────────────

/// Enter the code.
///
/// Three things here are not decoration:
///
///  * **The resend countdown is seeded from the SERVER's `resendAfter`**, not
///    from a stopwatch started when this screen was built. The server is what
///    will actually refuse an early resend, and a client timer that disagrees
///    either enables a button that 429s or hides one that would have worked.
///  * **Three attempts, then the email path.** Not "three attempts then
///    nothing": an SMS that does not arrive — roaming, a ported number, a
///    carrier filtering shortcodes — is common enough in the Gulf that a dead
///    end here is a lost account.
///  * **An attempt is a code the server REJECTED**, not any failure. A timeout,
///    an outage, or an unimplemented endpoint does not burn one of the three.
class OtpVerifyScreen extends ConsumerStatefulWidget {
  const OtpVerifyScreen({
    required this.challenge,
    required this.phone,
    this.onSignedIn,
    this.onLinkRequired,
    this.onFallBackToEmail,
    this.maxAttempts = 3,
    this.clock = DateTime.now,
    super.key,
  });

  final OtpChallenge challenge;
  final PhoneNumber phone;

  final VoidCallback? onSignedIn;
  final void Function(AccountLinkRequired link)? onLinkRequired;

  /// Where "use email instead" goes. When null the screen pops back to the
  /// sign-in screen, which is where the email path lives.
  final VoidCallback? onFallBackToEmail;

  final int maxAttempts;

  /// Injectable so the countdown is testable. `Timer` is faked by the widget
  /// test binding; `DateTime.now` is not, so a screen that read the wall clock
  /// directly could not be tested at all.
  final DateTime Function() clock;

  @override
  ConsumerState<OtpVerifyScreen> createState() => _OtpVerifyScreenState();
}

class _OtpVerifyScreenState extends ConsumerState<OtpVerifyScreen> {
  final TextEditingController _code = TextEditingController();

  Timer? _ticker;
  late OtpChallenge _challenge = widget.challenge;

  /// Codes the server looked at and refused. See the class doc for why a
  /// network failure is not one of these.
  int _rejections = 0;

  AsyncValue<void> _submission = const AsyncValue<void>.data(null);
  String? _failedEndpoint;

  /// A rejection message from the server — "that code is not right" — kept
  /// apart from [_submission] so a wrong code does not render as a system
  /// fault.
  String? _rejectionMessage;

  @override
  void initState() {
    super.initState();
    _startTicker();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _code.dispose();
    super.dispose();
  }

  void _startTicker() {
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 1), (Timer _) {
      if (!mounted) return;
      setState(() {});
      if (_secondsToResend == 0) {
        _ticker?.cancel();
        _ticker = null;
      }
    });
  }

  /// Straight off the server's instant, re-read on every tick — so a screen
  /// that spent two minutes in the background comes back with the right number
  /// instead of one that paused with the app.
  int get _secondsToResend => _challenge.timeToResend(widget.clock()).inSeconds;

  bool get _busy => _submission.isLoading;

  bool get _lockedOut => _rejections >= widget.maxAttempts;

  bool get _expired => _challenge.isExpired(widget.clock());

  Future<void> _verify(String code) async {
    if (_busy || _lockedOut) return;
    setState(() {
      _submission = const AsyncValue<void>.loading();
      _failedEndpoint = 'POST /v1/auth/otp/verify';
      _rejectionMessage = null;
    });

    try {
      final SignInOutcome outcome =
          await ref.read(authActionsProvider).verifyOtp(
                challengeId: _challenge.challengeId,
                code: code,
              );
      if (!mounted) return;
      setState(() => _submission = const AsyncValue<void>.data(null));
      switch (outcome) {
        case SignedInOutcome():
          widget.onSignedIn?.call();
        case AccountLinkRequired():
          _goToLink(outcome);
      }
    } on ApiFailure catch (failure, stack) {
      if (!mounted) return;
      setState(() {
        if (_isCodeRejection(failure)) {
          // The server READ the code and said no. That is an attempt.
          _rejections += 1;
          _rejectionMessage = failure.displayMessage;
          _submission = const AsyncValue<void>.data(null);
          _code.clear();
        } else {
          // A fault, an outage, or a route that does not exist. Not the user's
          // doing, so it does not cost them one of three tries.
          _submission = AsyncValue<void>.error(failure, stack);
        }
      });
    }
  }

  /// Whether this failure means "wrong code".
  ///
  /// `validation_failed` and `unauthenticated` are the two the contract can
  /// produce for a code the server checked. `not_found` is deliberately NOT
  /// here: today it means the endpoint is missing, and even once it ships it
  /// would mean the CHALLENGE is unknown — an expired session, not a
  /// mistyped digit.
  static bool _isCodeRejection(ApiFailure failure) =>
      failure is ValidationFailure || failure is AuthFailure;

  Future<void> _resend() async {
    if (_busy || _secondsToResend > 0) return;
    setState(() {
      _submission = const AsyncValue<void>.loading();
      _failedEndpoint = 'POST /v1/auth/otp/request';
      _rejectionMessage = null;
    });
    try {
      final OtpChallenge next =
          await ref.read(authActionsProvider).requestOtp(widget.phone);
      if (!mounted) return;
      setState(() {
        _challenge = next;
        _code.clear();
        _submission = const AsyncValue<void>.data(null);
      });
      _startTicker();
    } on ApiFailure catch (failure, stack) {
      if (!mounted) return;
      setState(() => _submission = AsyncValue<void>.error(failure, stack));
    }
  }

  void _goToLink(AccountLinkRequired link) {
    final void Function(AccountLinkRequired)? handler = widget.onLinkRequired;
    if (handler != null) {
      handler(link);
      return;
    }
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (BuildContext context) =>
            RegisterScreen(link: link, onResolved: widget.onSignedIn),
      ),
    );
  }

  void _fallBackToEmail() {
    final VoidCallback? handler = widget.onFallBackToEmail;
    if (handler != null) {
      handler();
      return;
    }
    // The email path lives on the sign-in screen. Popping is not a dead end:
    // it is the route to the control that replaces this one.
    if (Navigator.of(context).canPop()) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final int seconds = _secondsToResend;
    final bool canResend = seconds == 0 && !_busy;

    return AccountScaffold(
      title: 'Enter your code',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text('Check your messages', style: type.h2),
          SizedBox(height: t.spaceTight),
          DirectionalText.rich(
            <TextSegment>[
              TextSegment.prose(
                'We sent ${Numerals.integer(_challenge.codeLength)} digits to ',
              ),
              // Masked, and isolated. A number rendered without an isolate can
              // come back reordered in Arabic, and a reordered phone number is
              // a different phone number.
              TextSegment.token(widget.phone.masked, kind: LtrToken.phone),
              const TextSegment.prose('.'),
            ],
            style: type.body.copyWith(color: t.ink2),
          ),
          SizedBox(height: t.spaceBlock),
          OtpInput(
            key: const ValueKey<String>('otp-input'),
            controller: _code,
            length: _challenge.codeLength,
            enabled: !_busy && !_lockedOut && !_expired,
            hasError: _rejectionMessage != null,
            onCompleted: _verify,
          ),
          if (_busy) ...<Widget>[
            SizedBox(height: t.spaceStack),
            const Center(child: MeridianSpinner(label: 'Checking your code')),
          ],
          if (_rejectionMessage != null && !_lockedOut) ...<Widget>[
            SizedBox(height: t.spaceStack),
            Semantics(
              liveRegion: true,
              child: Text(
                '$_rejectionMessage '
                '${_attemptsLeftSentence(widget.maxAttempts - _rejections)}',
                key: const ValueKey<String>('otp-rejection'),
                style: type.meta.copyWith(color: t.dangerInk),
                textAlign: TextAlign.center,
              ),
            ),
          ],
          if (_expired && !_lockedOut) ...<Widget>[
            SizedBox(height: t.spaceStack),
            Text(
              'That code has expired. Ask for a new one.',
              key: const ValueKey<String>('otp-expired'),
              style: type.meta.copyWith(color: t.warningInk),
              textAlign: TextAlign.center,
            ),
          ],
          if (_submission.hasError) ...<Widget>[
            SizedBox(height: t.spaceStack),
            FailureNotice(
              key: const ValueKey<String>('otp-failure'),
              failure: _asFailure(_submission.error),
              endpoint: _failedEndpoint,
              onRetry: () => _verify(_code.text),
            ),
          ],
          SizedBox(height: t.spaceBlock),
          if (_lockedOut)
            _LockedOut(
              attempts: widget.maxAttempts,
              onUseEmail: _fallBackToEmail,
            )
          else ...<Widget>[
            Center(
              child: KeyButton(
                key: const ValueKey<String>('otp-resend'),
                label: canResend
                    ? 'Send a new code'
                    : 'Send a new code in ${Numerals.integer(seconds)}s',
                tone: KeyButtonTone.ghost,
                icon: const Icon(LucideIcons.rotateCw),
                onPressed: canResend ? _resend : null,
                semanticLabel: canResend
                    ? 'Send a new code'
                    : 'You can ask for a new code in '
                        '${Numerals.integer(seconds)} seconds',
              ),
            ),
            SizedBox(height: t.spaceStack),
            Center(
              child: TextButton(
                key: const ValueKey<String>('otp-change-number'),
                onPressed: _busy
                    ? null
                    : () {
                        if (Navigator.of(context).canPop()) {
                          Navigator.of(context).pop();
                        }
                      },
                child: const Text('Wrong number?'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  static String _attemptsLeftSentence(int left) => switch (left) {
        <= 0 => '',
        1 => 'One more try before we switch you to email.',
        _ => '${Numerals.integer(left)} tries left.',
      };

  static ApiFailure _asFailure(Object? error) => error is ApiFailure
      ? error
      : const ApiFailure.unexpected(message: 'Something went wrong.');
}

/// After the attempt limit. A door, not a wall.
class _LockedOut extends StatelessWidget {
  const _LockedOut({required this.attempts, required this.onUseEmail});

  final int attempts;
  final VoidCallback onUseEmail;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    return Semantics(
      liveRegion: true,
      child: Column(
        key: const ValueKey<String>('otp-locked-out'),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            'That is ${Numerals.integer(attempts)} wrong codes',
            style: type.h3.copyWith(color: t.dangerInk),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: t.spaceTight),
          Text(
            'The SMS may not be reaching this handset. Sign in with your email '
            'and password instead, and you can fix the number afterwards.',
            style: type.body.copyWith(color: t.ink2),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: t.spaceStack),
          KeyButton(
            key: const ValueKey<String>('otp-use-email'),
            label: 'Use email and password',
            size: KeyButtonSize.large,
            expand: true,
            icon: const Icon(LucideIcons.mail),
            onPressed: onUseEmail,
          ),
        ],
      ),
    );
  }
}
