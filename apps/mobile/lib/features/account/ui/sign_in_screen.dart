import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/auth.dart';
import '../../../core/error/failures.dart';
import '../../../core/ui/key_button.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../data/account_preferences.dart';
import '../data/auth_actions.dart';
import '../data/gcc_market.dart';
import 'account_chrome.dart';
import 'otp_verify_screen.dart';
import 'phone_field.dart';
import 'register_screen.dart';

/// ── ENDPOINTS THIS SCREEN NEEDS ─────────────────────────────────────────────
/// `POST /v1/auth/otp/request`  — the phone path. NOT BUILT (no OTP model, no
///                                SMS provider).
/// `POST /v1/auth/token`        — the email path. NOT BUILT (no refresh-token
///                                table; `/api/v1` reads a NextAuth cookie).
///
/// Both buttons therefore fail today with `not_found`, and the screen says so
/// in those words. There is deliberately no offline stub: a fake sign-in here
/// would light up every screen behind the auth wall while every request behind
/// it 404s, and that is a much more expensive lie than a visible one.
/// ────────────────────────────────────────────────────────────────────────────

/// The auth wall. **Phone first.**
///
/// In the GCC the phone number IS the account. A shopper in Riyadh has a mobile
/// number their bank, their delivery driver and their government portal all
/// know them by; the email address is something they made up for a shopping
/// site once and no longer remember the password to. An email-only sign-in does
/// not read as "secure" here — it reads as broken.
///
/// So: the country code is already filled in from the selected market, the
/// number is the only thing to type, and email + password is a second,
/// deliberately quieter path for the people who do have one.
class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({
    this.onCodeSent,
    this.onSignedIn,
    this.onLinkRequired,
    super.key,
  });

  /// Wired by the router. When null the screen pushes [OtpVerifyScreen] onto
  /// the ambient navigator itself — so the control is never inert.
  final void Function(OtpChallenge challenge, PhoneNumber phone)? onCodeSent;

  /// Called after a pair has been adopted. The router's own redirect fires from
  /// `AuthController` regardless; this is for a host that wants to pop a modal.
  final VoidCallback? onSignedIn;

  /// The verified credential belongs to a different account from the one on
  /// this device. When null the screen pushes [RegisterScreen] itself.
  final void Function(AccountLinkRequired link)? onLinkRequired;

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final TextEditingController _phone = TextEditingController();
  final TextEditingController _email = TextEditingController();
  final TextEditingController _password = TextEditingController();
  final FocusNode _phoneFocus = FocusNode();

  /// Null until the user picks one; falls back to the stored preference.
  GccMarket? _marketOverride;

  bool _emailPathOpen = false;
  bool _obscurePassword = true;

  /// The submission. Data(null) is idle, loading is in flight, error carries an
  /// [ApiFailure] — the three states the primary button and the notice render
  /// from, so they can never disagree.
  AsyncValue<void> _submission = const AsyncValue<void>.data(null);

  /// Which route the failure in [_submission] came from, so the notice can name
  /// it rather than saying "something went wrong".
  String? _failedEndpoint;

  @override
  void initState() {
    super.initState();
    // The primary button's enabled state is a function of the number, so the
    // number has to drive a rebuild. Without this the button stays disabled
    // until something else happens to repaint the screen.
    _phone.addListener(_onPhoneChanged);
  }

  void _onPhoneChanged() => setState(() {});

  @override
  void dispose() {
    _phone.removeListener(_onPhoneChanged);
    _phone.dispose();
    _email.dispose();
    _password.dispose();
    _phoneFocus.dispose();
    super.dispose();
  }

  GccMarket get _market =>
      _marketOverride ?? ref.watch(resolvedPreferencesProvider).market;

  PhoneNumber get _parsedPhone =>
      PhoneNumber.parse(_phone.text, market: _market);

  bool get _busy => _submission.isLoading;

  bool get _canSendCode => !_busy && _parsedPhone.isValid;

  bool get _canSignInWithPassword =>
      !_busy &&
      _email.text.contains('@') &&
      _email.text.trim().length > 3 &&
      _password.text.isNotEmpty;

  Future<void> _sendCode() async {
    final PhoneNumber phone = _parsedPhone;
    if (!phone.isValid) return;
    FocusScope.of(context).unfocus();
    // The number is about to be used; commit the market it resolved to, so a
    // pasted +966 also moves the picker.
    if (phone.market != _market) setState(() => _marketOverride = phone.market);

    setState(() {
      _submission = const AsyncValue<void>.loading();
      _failedEndpoint = 'POST /v1/auth/otp/request';
    });

    try {
      final OtpChallenge challenge =
          await ref.read(authActionsProvider).requestOtp(phone);
      if (!mounted) return;
      setState(() => _submission = const AsyncValue<void>.data(null));
      _goToVerify(challenge, phone);
    } on ApiFailure catch (failure, stack) {
      if (!mounted) return;
      setState(() => _submission = AsyncValue<void>.error(failure, stack));
    }
  }

  Future<void> _signInWithPassword() async {
    if (!_canSignInWithPassword) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _submission = const AsyncValue<void>.loading();
      _failedEndpoint = 'POST /v1/auth/token';
    });

    try {
      final SignInOutcome outcome =
          await ref.read(authActionsProvider).signInWithPassword(
                email: _email.text.trim(),
                password: _password.text,
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
      setState(() => _submission = AsyncValue<void>.error(failure, stack));
    }
  }

  void _goToVerify(OtpChallenge challenge, PhoneNumber phone) {
    final void Function(OtpChallenge, PhoneNumber)? handler = widget.onCodeSent;
    if (handler != null) {
      handler(challenge, phone);
      return;
    }
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (BuildContext context) => OtpVerifyScreen(
          challenge: challenge,
          phone: phone,
          onSignedIn: widget.onSignedIn,
          onLinkRequired: widget.onLinkRequired,
        ),
      ),
    );
  }

  void _goToLink(AccountLinkRequired link) {
    final void Function(AccountLinkRequired)? handler = widget.onLinkRequired;
    if (handler != null) {
      handler(link);
      return;
    }
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (BuildContext context) => RegisterScreen(
          link: link,
          onResolved: widget.onSignedIn,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final PhoneNumber phone = _parsedPhone;

    // Advisory only. A number of the right length that does not start with a
    // known mobile prefix still goes to the server: numbering plans grow, and
    // refusing a real customer's real number is worse than one wasted SMS.
    final String? mobileHint = phone.hasCompleteLength && !phone.looksLikeMobile
        ? 'That does not look like a mobile number. The code arrives by SMS.'
        : null;

    return AccountScaffold(
      title: 'Sign in',
      child: AutofillGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text('Your phone is your account', style: type.h2),
            SizedBox(height: t.spaceTight),
            Text(
              'Enter your mobile number and we will send you a six-digit code. '
              'No password to remember.',
              style: type.body.copyWith(color: t.ink2),
            ),
            SizedBox(height: t.spaceBlock),
            const AccountFieldLabel(label: 'Mobile number'),
            PhoneField(
              key: const ValueKey<String>('sign-in-phone'),
              controller: _phone,
              market: _market,
              focusNode: _phoneFocus,
              enabled: !_busy,
              onMarketChanged: (GccMarket market) =>
                  setState(() => _marketOverride = market),
              onSubmitted: (_) => _canSendCode ? _sendCode() : null,
            ),
            if (mobileHint != null) ...<Widget>[
              Padding(
                padding: EdgeInsetsDirectional.only(bottom: t.spaceTight),
                child: Text(
                  mobileHint,
                  style: type.meta.copyWith(color: t.warningInk),
                ),
              ),
            ],
            KeyButton(
              key: const ValueKey<String>('sign-in-send-code'),
              label: 'Send me a code',
              size: KeyButtonSize.large,
              expand: true,
              busy: _busy,
              icon: const Icon(LucideIcons.messageSquare),
              onPressed: _canSendCode ? _sendCode : null,
              semanticLabel: phone.isEmpty
                  ? 'Send me a code. Enter your mobile number first.'
                  : 'Send a code to ${phone.internationalDisplay}',
            ),
            if (_submission.hasError) ...<Widget>[
              SizedBox(height: t.spaceStack),
              FailureNotice(
                key: const ValueKey<String>('sign-in-failure'),
                failure: _asFailure(_submission.error),
                endpoint: _failedEndpoint,
                onRetry: _emailPathOpen ? _signInWithPassword : _sendCode,
              ),
            ],
            SizedBox(height: t.spaceBlock),
            const _OrRule(label: 'or'),
            SizedBox(height: t.spaceStack),
            if (!_emailPathOpen)
              KeyButton(
                key: const ValueKey<String>('sign-in-open-email'),
                label: 'Use email and password',
                tone: KeyButtonTone.ghost,
                expand: true,
                icon: const Icon(LucideIcons.mail),
                onPressed:
                    _busy ? null : () => setState(() => _emailPathOpen = true),
              )
            else
              _EmailPath(
                email: _email,
                password: _password,
                obscure: _obscurePassword,
                enabled: !_busy,
                busy: _busy,
                onToggleObscure: () =>
                    setState(() => _obscurePassword = !_obscurePassword),
                onChanged: () => setState(() {}),
                onSubmit: _canSignInWithPassword ? _signInWithPassword : null,
                onClose: () => setState(() => _emailPathOpen = false),
              ),
            SizedBox(height: t.spaceBlock),
            Text(
              'Standard message rates may apply. We never send marketing to a '
              'number used to sign in.',
              style: type.meta.copyWith(color: t.ink3),
            ),
          ],
        ),
      ),
    );
  }

  static ApiFailure _asFailure(Object? error) => error is ApiFailure
      ? error
      : const ApiFailure.unexpected(message: 'Something went wrong.');
}

/// A labelled rule. Two hairlines and a word — the word is what stops the
/// second path reading as a disabled variant of the first.
class _OrRule extends StatelessWidget {
  const _OrRule({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    return Row(
      children: <Widget>[
        Expanded(child: Divider(color: t.hairline, height: 1)),
        Padding(
          padding: EdgeInsetsDirectional.symmetric(horizontal: t.spaceTight),
          child: Text(label, style: type.micro.copyWith(color: t.ink3)),
        ),
        Expanded(child: Divider(color: t.hairline, height: 1)),
      ],
    );
  }
}

/// The secondary path. Present, complete, and clearly second.
class _EmailPath extends StatelessWidget {
  const _EmailPath({
    required this.email,
    required this.password,
    required this.obscure,
    required this.enabled,
    required this.busy,
    required this.onToggleObscure,
    required this.onChanged,
    required this.onSubmit,
    required this.onClose,
  });

  final TextEditingController email;
  final TextEditingController password;
  final bool obscure;
  final bool enabled;
  final bool busy;
  final VoidCallback onToggleObscure;
  final VoidCallback onChanged;
  final VoidCallback? onSubmit;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(child: Text('Email and password', style: type.ui)),
            IconButton(
              onPressed: enabled ? onClose : null,
              icon: const Icon(LucideIcons.x),
              // An icon-only control with no label is invisible to a screen
              // reader. Every one in this feature carries one.
              tooltip: 'Close email sign-in',
              constraints: const BoxConstraints(
                minWidth: kMinTouchTarget,
                minHeight: kMinTouchTarget,
              ),
            ),
          ],
        ),
        SizedBox(height: t.spaceTight),
        TextField(
          key: const ValueKey<String>('sign-in-email'),
          controller: email,
          enabled: enabled,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          autofillHints: const <String>[AutofillHints.username],
          onChanged: (_) => onChanged(),
          // An email address is a machine-readable token: it reads
          // left-to-right even inside an Arabic layout.
          textDirection: TextDirection.ltr,
          textAlign: TextAlign.start,
          style: type.body,
          decoration: const InputDecoration(
            labelText: 'Email',
            hintText: 'name@example.com',
            constraints: BoxConstraints(minHeight: kMinTouchTarget),
          ),
        ),
        SizedBox(height: t.spaceStack),
        TextField(
          key: const ValueKey<String>('sign-in-password'),
          controller: password,
          enabled: enabled,
          obscureText: obscure,
          textInputAction: TextInputAction.done,
          autofillHints: const <String>[AutofillHints.password],
          onChanged: (_) => onChanged(),
          onSubmitted: (_) => onSubmit?.call(),
          textDirection: TextDirection.ltr,
          textAlign: TextAlign.start,
          style: type.body,
          decoration: InputDecoration(
            labelText: 'Password',
            constraints: const BoxConstraints(minHeight: kMinTouchTarget),
            suffixIcon: IconButton(
              onPressed: enabled ? onToggleObscure : null,
              icon: Icon(obscure ? LucideIcons.eye : LucideIcons.eyeOff),
              tooltip: obscure ? 'Show password' : 'Hide password',
            ),
          ),
        ),
        SizedBox(height: t.spaceStack),
        KeyButton(
          key: const ValueKey<String>('sign-in-submit-password'),
          label: 'Sign in',
          size: KeyButtonSize.large,
          expand: true,
          busy: busy,
          tone: KeyButtonTone.accent,
          onPressed: onSubmit,
        ),
      ],
    );
  }
}
