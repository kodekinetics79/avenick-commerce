import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/auth.dart';
import '../../../core/error/failures.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../core/ui/key_button.dart';
import '../../../theme/elevation.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../data/auth_actions.dart';
import 'account_chrome.dart';

/// ── ENDPOINTS THIS SCREEN NEEDS ─────────────────────────────────────────────
/// `POST /v1/auth/revoke`        — to end the session being left behind.
///                                 SPECIFIED, NOT BUILT.
/// `POST /v1/account/link`       — to genuinely merge two accounts.
///                                 **NOT EVEN SPECIFIED.** There is no such
///                                 route in `openapi.json`, no schema for it,
///                                 and no way to reconcile two order histories,
///                                 two address books and two company
///                                 memberships. The "these are both mine"
///                                 option is therefore shown DISABLED with the
///                                 reason on the row, not hidden — a person who
///                                 has two accounts needs to be told that we
///                                 know, and what to do about it.
/// ────────────────────────────────────────────────────────────────────────────

/// The account-linking screen.
///
/// It appears at exactly one moment: a phone number was verified — or an email
/// and password accepted — for an account that is NOT the account already
/// signed in on this handset.
///
/// **Nothing merges silently.** This is the whole point of the screen. Two
/// accounts on one device is not a corner case in the Gulf: a family shares a
/// handset, a company buyer signs in on a colleague's phone to approve an
/// order, a consumer account and a company account belong to the same person
/// with different emails. Quietly folding one into the other moves someone's
/// order history and their saved addresses into an identity they did not
/// choose, and there is no undo for that.
///
/// So the screen states both identities plainly, offers a SWITCH in either
/// direction, and refuses to offer a merge it cannot perform.
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({required this.link, this.onResolved, super.key});

  /// The conflict. [AccountLinkRequired.incoming] has NOT been adopted: no
  /// token has reached the keystore and nothing has changed yet.
  final AccountLinkRequired link;

  /// Called once a choice has been carried out. When null the screen pops.
  final VoidCallback? onResolved;

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  AsyncValue<void> _submission = const AsyncValue<void>.data(null);
  String? _failedEndpoint;

  bool get _busy => _submission.isLoading;

  AuthPrincipal get _existing => widget.link.existing;
  AuthPrincipal get _incoming => widget.link.incoming.principal;

  Future<void> _switchToIncoming() async {
    setState(() {
      _submission = const AsyncValue<void>.loading();
      _failedEndpoint = 'POST /v1/auth/revoke';
    });
    try {
      await ref.read(authActionsProvider).adoptIncoming(widget.link.incoming);
      if (!mounted) return;
      setState(() => _submission = const AsyncValue<void>.data(null));
      _finish();
    } on ApiFailure catch (failure, stack) {
      if (!mounted) return;
      setState(() => _submission = AsyncValue<void>.error(failure, stack));
    }
  }

  Future<void> _keepExisting() async {
    setState(() {
      _submission = const AsyncValue<void>.loading();
      _failedEndpoint = 'POST /v1/auth/revoke';
    });
    // Best effort by design — see AuthActions.discardIncoming. The incoming
    // refresh token never reached this device, so there is no local credential
    // left behind even if the server is never told.
    await ref.read(authActionsProvider).discardIncoming(widget.link.incoming);
    if (!mounted) return;
    setState(() => _submission = const AsyncValue<void>.data(null));
    _finish();
  }

  void _finish() {
    final VoidCallback? handler = widget.onResolved;
    if (handler != null) {
      handler();
      return;
    }
    if (Navigator.of(context).canPop()) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return AccountScaffold(
      title: 'Which account?',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text('This phone belongs to another account', style: type.h2),
          SizedBox(height: t.spaceTight),
          Text(
            'The number you just verified is registered to a different account '
            'from the one signed in on this device. We will not join them '
            'together on our own.',
            style: type.body.copyWith(color: t.ink2),
          ),
          SizedBox(height: t.spaceBlock),

          _IdentityCard(
            key: const ValueKey<String>('link-existing'),
            heading: 'Signed in on this device',
            principal: _existing,
          ),
          SizedBox(height: t.spaceStack),
          _IdentityCard(
            key: const ValueKey<String>('link-incoming'),
            heading: 'The account for this phone number',
            principal: _incoming,
            emphasised: true,
          ),

          if (_submission.hasError) ...<Widget>[
            SizedBox(height: t.spaceStack),
            FailureNotice(
              key: const ValueKey<String>('link-failure'),
              failure: _asFailure(_submission.error),
              endpoint: _failedEndpoint,
              onRetry: _switchToIncoming,
            ),
          ],

          SizedBox(height: t.spaceBlock),

          KeyButton(
            key: const ValueKey<String>('link-switch'),
            label: 'Continue as ${_incoming.displayName}',
            size: KeyButtonSize.large,
            expand: true,
            busy: _busy,
            onPressed: _busy ? null : _switchToIncoming,
            semanticLabel:
                'Continue as ${_incoming.displayName}, ${_incoming.email}. '
                'This signs out ${_existing.email} on this device.',
          ),
          SizedBox(height: t.spaceStack),
          KeyButton(
            key: const ValueKey<String>('link-keep'),
            label: 'Stay as ${_existing.displayName}',
            tone: KeyButtonTone.ghost,
            size: KeyButtonSize.large,
            expand: true,
            onPressed: _busy ? null : _keepExisting,
            semanticLabel: 'Stay signed in as ${_existing.displayName}, '
                '${_existing.email}. The other account is left alone.',
          ),

          SizedBox(height: t.spaceStack),
          Text(
            'Either way, nothing moves. Orders, invoices and saved addresses '
            'stay with the account they were made on.',
            style: type.meta.copyWith(color: t.ink3),
          ),

          // The third option a person will look for, and the truthful answer
          // to it. Shown disabled rather than hidden: someone who genuinely has
          // two accounts needs to know we cannot fix it from here.
          const AccountSection(
            title: 'Both of these are mine',
            footnote: 'Merging needs POST /v1/account/link, which does not '
                'exist — there is no route for it, and no agreed rule for what '
                'happens to two order histories, two address books and two '
                'company memberships. Support can move them by hand.',
            children: <Widget>[
              AccountRow(
                key: ValueKey<String>('link-merge-unavailable'),
                title: 'Merge these two accounts',
                icon: LucideIcons.gitMerge,
                showChevron: false,
                disabledReason: 'Not available yet — and it will never happen '
                    'without you asking for it.',
              ),
            ],
          ),
        ],
      ),
    );
  }

  static ApiFailure _asFailure(Object? error) => error is ApiFailure
      ? error
      : const ApiFailure.unexpected(message: 'Something went wrong.');
}

/// One of the two identities in the choice.
class _IdentityCard extends StatelessWidget {
  const _IdentityCard({
    required this.heading,
    required this.principal,
    this.emphasised = false,
    super.key,
  });

  final String heading;
  final AuthPrincipal principal;
  final bool emphasised;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return MeridianSurface(
      rung: MeridianRung.card,
      fill: emphasised ? t.primarySoft : null,
      padding: EdgeInsetsDirectional.all(t.spaceStack),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            heading,
            style: type.micro.copyWith(
              color: emphasised ? t.primaryInk : t.ink3,
            ),
          ),
          SizedBox(height: t.spaceTight),
          Text(principal.displayName, style: type.h3),
          SizedBox(height: t.spaceUnit),
          // An email inside Arabic prose reorders without an isolate — the
          // trailing dot of a `.ae` domain jumps to the front of the address.
          DirectionalText.token(
            principal.email,
            kind: LtrToken.email,
            style: type.meta.copyWith(color: t.ink2),
          ),
        ],
      ),
    );
  }
}
