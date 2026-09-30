import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/account.dart';
import '../../../core/error/failures.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../core/l10n/numerals.dart';
import '../../../core/ui/key_button.dart';
import '../../../theme/elevation.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../data/account_providers.dart';
import '../data/auth_actions.dart';
import 'account_chrome.dart';

/// ── ENDPOINTS THIS SCREEN NEEDS ─────────────────────────────────────────────
/// `DELETE /v1/account` — SPECIFIED in `openapi.json`, NOT BUILT. It answers
///                        with an `AccountDeletion` carrying `erasesAt`.
/// `GET /v1/me`         — only to prefill the email that must be typed back.
///
/// ── WHY THIS SCREEN IS NOT OPTIONAL ─────────────────────────────────────────
/// App Store Review Guideline 5.1.1(v): an app that lets a person create an
/// account must let them delete it FROM INSIDE THE APP. A link to a web form,
/// an email to support, or a "contact us" row is a rejection. This is a hard
/// gate on shipping at all, not a nice-to-have — which is why it is built now,
/// against an endpoint that does not exist, rather than after.
/// ────────────────────────────────────────────────────────────────────────────

/// Delete your account. Two steps, and one honest paragraph.
///
/// ── WHY THE COPY SAYS WHAT IT SAYS ──────────────────────────────────────────
/// "Delete my account" is understood by most people as "everything about me
/// disappears". For a commerce platform that is not true and cannot be made
/// true: a tax invoice is a record of a transaction between a SELLER and a
/// buyer, the seller is legally required to keep it, and the buyer's wish does
/// not override that. An app that says "all your data has been deleted" while
/// invoices remain has made a false statement about a legal right.
///
/// So the screen says exactly what goes and exactly what stays, before the
/// first tap and again before the last one. And on success it reports the
/// SCHEDULED date from `AccountDeletion.erasesAt` rather than claiming the
/// account is already gone — because it is not.
class DeleteAccountScreen extends ConsumerStatefulWidget {
  const DeleteAccountScreen({this.email, this.onDeleted, super.key});

  /// The account's email, when the caller already has it. The field still has
  /// to be typed — that friction is the point — but knowing it lets the screen
  /// catch a mismatch before spending a round trip.
  final String? email;

  final VoidCallback? onDeleted;

  @override
  ConsumerState<DeleteAccountScreen> createState() =>
      _DeleteAccountScreenState();
}

/// Which of the two steps is showing.
enum DeleteAccountStep {
  /// What happens, what is kept. No input yet.
  explain,

  /// Type the email back, optionally say why.
  confirm,

  /// The server has scheduled it. The date is on screen.
  scheduled,
}

class _DeleteAccountScreenState extends ConsumerState<DeleteAccountScreen> {
  final TextEditingController _confirmEmail = TextEditingController();
  final TextEditingController _reason = TextEditingController();

  DeleteAccountStep _step = DeleteAccountStep.explain;
  AsyncValue<void> _submission = const AsyncValue<void>.data(null);
  AccountDeletion? _result;

  bool get _busy => _submission.isLoading;

  /// The email to check against, preferring a freshly loaded `/v1/me` over the
  /// one the caller passed in.
  String? get _accountEmail =>
      ref.watch(meProvider).value?.email ?? widget.email;

  /// The typed confirmation has to match. Case-insensitive, because a phone
  /// keyboard capitalises the first letter and refusing over that is theatre.
  ///
  /// When the account email is unknown — `/v1/me` failed, which is exactly
  /// today's state — anything containing an `@` is allowed through and the
  /// SERVER decides. Blocking deletion because we could not load a profile
  /// would make the App Store gate unreachable in the one state it must work.
  bool get _emailMatches {
    final String typed = _confirmEmail.text.trim().toLowerCase();
    if (typed.isEmpty) return false;
    final String? known = _accountEmail?.trim().toLowerCase();
    if (known == null) return typed.contains('@');
    return typed == known;
  }

  @override
  void initState() {
    super.initState();
    _confirmEmail.addListener(_rebuild);
  }

  void _rebuild() => setState(() {});

  @override
  void dispose() {
    _confirmEmail.removeListener(_rebuild);
    _confirmEmail.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _delete() async {
    if (!_emailMatches || _busy) return;
    FocusScope.of(context).unfocus();
    setState(() => _submission = const AsyncValue<void>.loading());

    try {
      final AccountDeletion deletion = await ref
          .read(authActionsProvider)
          .deleteAccount(
            confirmEmail: _confirmEmail.text.trim(),
            reason: _reason.text.trim().isEmpty ? null : _reason.text.trim(),
          );
      if (!mounted) return;
      setState(() {
        _result = deletion;
        _step = DeleteAccountStep.scheduled;
        _submission = const AsyncValue<void>.data(null);
      });
      // Only NOW is the device torn down — after the server has acknowledged
      // the schedule. Clearing first and calling second would leave a live
      // account with no way back into it.
      await ref.read(authActionsProvider).forgetDeviceAfterDeletion();
    } on ApiFailure catch (failure, stack) {
      if (!mounted) return;
      setState(() => _submission = AsyncValue<void>.error(failure, stack));
    }
  }

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;

    return AccountScaffold(
      title: 'Delete your account',
      bottomBar: switch (_step) {
        DeleteAccountStep.explain => KeyButton(
            key: const ValueKey<String>('delete-step-one'),
            label: 'Continue',
            size: KeyButtonSize.large,
            expand: true,
            tone: KeyButtonTone.ghost,
            onPressed: () => setState(() => _step = DeleteAccountStep.confirm),
          ),
        DeleteAccountStep.confirm => KeyButton(
            key: const ValueKey<String>('delete-step-two'),
            label: 'Delete my account',
            size: KeyButtonSize.large,
            expand: true,
            tone: KeyButtonTone.danger,
            busy: _busy,
            onPressed: _emailMatches && !_busy ? _delete : null,
            semanticLabel:
                'Delete my account. This cannot be undone once the grace '
                'period ends.',
          ),
        DeleteAccountStep.scheduled => KeyButton(
            key: const ValueKey<String>('delete-done'),
            label: 'Done',
            size: KeyButtonSize.large,
            expand: true,
            onPressed: () {
              final VoidCallback? handler = widget.onDeleted;
              if (handler != null) {
                handler();
              } else if (Navigator.of(context).canPop()) {
                Navigator.of(context).pop();
              }
            },
          ),
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          switch (_step) {
            DeleteAccountStep.explain => const _ExplainStep(),
            DeleteAccountStep.confirm => _ConfirmStep(
                confirmEmail: _confirmEmail,
                reason: _reason,
                accountEmail: _accountEmail,
                enabled: !_busy,
              ),
            DeleteAccountStep.scheduled => _ScheduledStep(result: _result),
          },
          if (_submission.hasError) ...<Widget>[
            SizedBox(height: t.spaceStack),
            FailureNotice(
              key: const ValueKey<String>('delete-failure'),
              failure: _asFailure(_submission.error),
              endpoint: 'DELETE /v1/account',
              onRetry: _delete,
            ),
          ],
        ],
      ),
    );
  }

  static ApiFailure _asFailure(Object? error) => error is ApiFailure
      ? error
      : const ApiFailure.unexpected(message: 'Something went wrong.');
}

/// Step one. Nothing to type, everything to read.
class _ExplainStep extends StatelessWidget {
  const _ExplainStep();

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return Column(
      key: const ValueKey<String>('delete-explain'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text('This closes your account', style: type.h2),
        SizedBox(height: t.spaceTight),
        Text(
          'You can do this here, in the app, without emailing anyone. Read '
          'both lists first — they are not the same.',
          style: type.body.copyWith(color: t.ink2),
        ),
        SizedBox(height: t.spaceBlock),
        _Ledger(
          key: const ValueKey<String>('delete-removed'),
          icon: LucideIcons.trash2,
          tint: t.dangerSoft,
          headingColour: t.dangerInk,
          heading: 'Deleted',
          items: const <String>[
            'Your name, email address and phone number',
            'Every saved delivery address, landmark and map pin',
            'Saved items and anything you were watching',
            'Your sign-in — this device and every other one',
            'Notification settings and registered devices',
          ],
        ),
        SizedBox(height: t.spaceStack),
        _Ledger(
          key: const ValueKey<String>('delete-retained'),
          icon: LucideIcons.fileText,
          tint: t.warningSoft,
          headingColour: t.warningInk,
          heading: 'Kept, and why',
          items: const <String>[
            'Your orders, and the tax invoices issued for them.',
            'A seller must keep an invoice for the retention period the tax '
                'authority sets in the country of sale. That obligation is the '
                "seller's, and deleting your account does not lift it — so we "
                'cannot remove those records and we will not tell you we have.',
            'They are UNLINKED from your profile: your name, email, phone and '
                'addresses are stripped from them, and they stop being '
                'searchable by you. What remains is the transaction itself.',
          ],
        ),
        SizedBox(height: t.spaceStack),
        MeridianSurface(
          rung: MeridianRung.recessed,
          padding: EdgeInsetsDirectional.all(t.spaceStack),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Icon(LucideIcons.clock, size: 18, color: t.ink3),
              SizedBox(width: t.spaceTight),
              Expanded(
                child: Text(
                  'Deletion is scheduled, not instant. There is a grace period '
                  'first, and we will tell you the exact date on the next '
                  'screen. Signing back in before then cancels it.',
                  style: type.meta.copyWith(color: t.ink2),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Step two. Type the email back.
class _ConfirmStep extends StatelessWidget {
  const _ConfirmStep({
    required this.confirmEmail,
    required this.reason,
    required this.accountEmail,
    required this.enabled,
  });

  final TextEditingController confirmEmail;
  final TextEditingController reason;
  final String? accountEmail;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final String typed = confirmEmail.text.trim();
    final String? known = accountEmail;
    final bool mismatch = known != null &&
        typed.isNotEmpty &&
        typed.toLowerCase() != known.trim().toLowerCase();

    return Column(
      key: const ValueKey<String>('delete-confirm'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text('Type your email to confirm', style: type.h2),
        SizedBox(height: t.spaceTight),
        if (known != null)
          DirectionalText.rich(
            <TextSegment>[
              const TextSegment.prose('Type '),
              // An email inside prose reorders in Arabic without an isolate.
              TextSegment.token(known, kind: LtrToken.email),
              const TextSegment.prose(
                ' exactly. This is the last step before the account is '
                'scheduled for deletion.',
              ),
            ],
            style: type.body.copyWith(color: t.ink2),
          )
        else
          Text(
            'We could not load your profile, so type the email you sign in '
            'with. The server will check it matches before it does anything.',
            style: type.body.copyWith(color: t.ink2),
          ),
        SizedBox(height: t.spaceBlock),
        TextField(
          key: const ValueKey<String>('delete-email'),
          controller: confirmEmail,
          enabled: enabled,
          keyboardType: TextInputType.emailAddress,
          autocorrect: false,
          enableSuggestions: false,
          textDirection: TextDirection.ltr,
          textAlign: TextAlign.start,
          style: type.body,
          decoration: InputDecoration(
            labelText: 'Your email address',
            errorText:
                mismatch ? 'That is not the email on this account.' : null,
            errorMaxLines: 2,
            constraints: const BoxConstraints(minHeight: kMinTouchTarget),
          ),
        ),
        SizedBox(height: t.spaceStack),
        TextField(
          key: const ValueKey<String>('delete-reason'),
          controller: reason,
          enabled: enabled,
          maxLines: 3,
          style: type.body,
          decoration: const InputDecoration(
            labelText: 'Why are you leaving? (optional)',
            hintText: 'This is read by a person, not a machine.',
            constraints: BoxConstraints(minHeight: kMinTouchTarget),
          ),
        ),
      ],
    );
  }
}

/// The outcome. **Scheduled**, with the date — never "deleted".
class _ScheduledStep extends StatelessWidget {
  const _ScheduledStep({required this.result});

  final AccountDeletion? result;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final AccountDeletion? deletion = result;
    final Locale locale = Localizations.localeOf(context);

    return Column(
      key: const ValueKey<String>('delete-scheduled'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Icon(LucideIcons.circleCheck, size: 32, color: t.successInk),
        SizedBox(height: t.spaceStack),
        Text('Deletion scheduled', style: type.h2),
        SizedBox(height: t.spaceTight),
        if (deletion == null)
          Text(
            'The request went through. We do not have the erasure date to show '
            'you, which is a bug — do not read this as "already deleted".',
            style: type.body.copyWith(color: t.warningInk),
          )
        else ...<Widget>[
          Text(
            'Your account is not deleted yet. Everything in the first list '
            'will be erased on:',
            style: type.body.copyWith(color: t.ink2),
          ),
          SizedBox(height: t.spaceTight),
          Text(
            // Western digits in both locales — see Numerals. A date rendered
            // in Arabic-Indic digits here is a date somebody has to transcribe.
            Dates.full(deletion.erasesAt.toLocal(), locale),
            key: const ValueKey<String>('delete-erases-at'),
            style: type.h3.copyWith(color: t.ink1),
          ),
          SizedBox(height: t.spaceTight),
          Text(
            'That is ${Numerals.integer(deletion.gracePeriod().inDays)} days '
            'from now. Sign in again before then and the deletion is cancelled.',
            style: type.meta.copyWith(color: t.ink3),
          ),
        ],
      ],
    );
  }
}

/// One of the two lists on step one.
class _Ledger extends StatelessWidget {
  const _Ledger({
    required this.icon,
    required this.tint,
    required this.headingColour,
    required this.heading,
    required this.items,
    super.key,
  });

  final IconData icon;
  final Color tint;
  final Color headingColour;
  final String heading;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    return MeridianSurface(
      rung: MeridianRung.card,
      fill: tint,
      padding: EdgeInsetsDirectional.all(t.spaceStack),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(icon, size: 18, color: headingColour),
              SizedBox(width: t.spaceTight),
              // Expanded so the heading wraps at 200% text instead of running
              // off the card. "Kept, and why" at double size is wider than a
              // 390pt phone once the icon and the padding are taken off.
              Expanded(
                child: Text(
                  heading,
                  style: type.ui.copyWith(color: headingColour),
                ),
              ),
            ],
          ),
          SizedBox(height: t.spaceTight),
          for (final String item in items)
            Padding(
              padding: EdgeInsetsDirectional.only(bottom: t.spaceTight),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Padding(
                    padding: EdgeInsetsDirectional.only(top: t.spaceUnit + 2),
                    child: Container(
                      width: 4,
                      height: 4,
                      decoration: BoxDecoration(
                        color: headingColour,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                  SizedBox(width: t.spaceTight),
                  Expanded(
                    child: Text(
                      item,
                      style: type.meta.copyWith(color: t.ink2),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
