import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/error/failures.dart';
import '../../../core/ui/async_state_view.dart';
import '../../../core/ui/key_button.dart';
import '../../../theme/elevation.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../data/notification_preferences.dart';
import 'account_chrome.dart';

/// ── ENDPOINTS THIS SCREEN NEEDS ─────────────────────────────────────────────
/// `GET   /v1/me/notification-preferences`  — PROPOSED, not in the contract.
/// `PATCH /v1/me/notification-preferences`  — PROPOSED, not in the contract.
///
/// Neither has ever been specified: no schema, no Prisma model, no route. So
/// this screen renders its ERROR branch today, and **not one toggle is drawn**.
/// That is the design, not a shortcut — see the class doc.
/// ────────────────────────────────────────────────────────────────────────────

/// Per-category notification settings.
///
/// ── TWO RULES THIS SCREEN EXISTS TO HOLD ────────────────────────────────────
///
/// **1. No toggle without a server.** The toggles are inside the `data` branch
/// of an [AsyncStateView]. If the preferences cannot be loaded, they are not
/// rendered at all — because a switch that slides and changes nothing is the
/// worst possible outcome here. The user walks away believing they turned the
/// offers off, the offers keep coming, and the next thing they turn off is the
/// app.
///
/// **2. The OS permission is never requested at launch, and never as a side
/// effect of arriving here.** The system prompt is one-shot per install: asked
/// at the wrong moment and denied, every delivery notification the account will
/// ever get is gone permanently, recoverable only through the Settings app. So
/// the priming card below appears ONLY once
/// [notificationValueMomentProvider] is true — set by the feature that reached
/// the value moment, an order placed or a stock alert requested — and its "Not
/// now" is a pure dismissal that calls nothing.
class NotificationPreferencesScreen extends ConsumerStatefulWidget {
  const NotificationPreferencesScreen({
    this.isB2b = false,
    this.onRequestSystemPermission,
    super.key,
  });

  /// Shows the purchase-approval category. A B2C shopper has no approvals and
  /// a row they can never trigger is noise.
  final bool isB2b;

  /// Fires the OS permission prompt.
  ///
  /// NULL TODAY, and correctly so: there is no push plugin in `pubspec.yaml`
  /// (which another engineer owns), so nothing in this binary can ask the OS
  /// for anything. When it is null the priming card's primary button is
  /// disabled with that reason on it — never present-and-inert.
  final Future<void> Function()? onRequestSystemPermission;

  @override
  ConsumerState<NotificationPreferencesScreen> createState() =>
      _NotificationPreferencesScreenState();
}

class _NotificationPreferencesScreenState
    extends ConsumerState<NotificationPreferencesScreen> {
  /// Dismissed for this visit. Not persisted — a primer that a person said "not
  /// now" to should come back at the NEXT value moment, not never.
  bool _primerDismissed = false;

  /// Categories with a save in flight, so only the row being changed shows a
  /// spinner and the rest stay usable.
  final Set<String> _saving = <String>{};

  ApiFailure? _saveFailure;
  NotificationCategory? _saveFailureCategory;

  Future<void> _toggle(
    NotificationCategory category, {
    required bool on,
  }) async {
    setState(() {
      _saving.add(category.key);
      _saveFailure = null;
      _saveFailureCategory = null;
    });
    try {
      await ref
          .read(notificationPreferencesApiProvider)
          .setCategory(category, on: on);
      if (!mounted) return;
      // Re-read rather than flip the switch locally. The SERVER's answer is
      // what the screen shows: an optimistic flip that the server then
      // rejects, or silently normalises, leaves a switch displaying a setting
      // nobody actually has.
      ref.invalidate(notificationPreferencesProvider);
      setState(() => _saving.remove(category.key));
    } on ApiFailure catch (failure) {
      if (!mounted) return;
      setState(() {
        _saving.remove(category.key);
        _saveFailure = failure;
        _saveFailureCategory = category;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final AsyncValue<NotificationPreferences> prefs = ref.watch(
      notificationPreferencesProvider,
    );
    final bool valueMomentReached = ref.watch(notificationValueMomentProvider);

    return AccountScaffold(
      title: 'Notifications',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          // The primer. Gated, dismissible, and it does not touch the OS.
          if (valueMomentReached && !_primerDismissed) ...<Widget>[
            _PrePermissionCard(
              canAsk: widget.onRequestSystemPermission != null,
              onAsk: () async {
                final Future<void> Function()? ask =
                    widget.onRequestSystemPermission;
                if (ask == null) return;
                await ask();
                if (!mounted) return;
                setState(() => _primerDismissed = true);
              },
              // "Not now" dismisses the CARD. It does not call `onAsk`, it does
              // not touch the platform channel, and the OS prompt is not
              // consumed — which is the whole reason a primer exists.
              onNotNow: () => setState(() => _primerDismissed = true),
            ),
            SizedBox(height: t.spaceStack),
          ],

          AsyncStateView<NotificationPreferences>(
            value: prefs,
            // "Loaded, and the server holds no categories for this account" is
            // a real answer and not a blank list — it means nothing has been
            // chosen yet, which is a different sentence from "we could not ask".
            isEmpty: (NotificationPreferences value) => value.enabled.isEmpty,
            loading: (BuildContext context) => const MeridianSkeleton(
              shape: MeridianSkeletonShape.list,
              itemCount: 4,
              padding: EdgeInsetsDirectional.zero,
            ),
            error: (BuildContext context, Object error, StackTrace? _) =>
                ErrorBranch(
              error: error,
              endpoint: 'GET /v1/me/notification-preferences',
              onRetry: () => ref.invalidate(notificationPreferencesProvider),
            ),
            empty: (BuildContext context) => const MeridianEmptyState(
              key: ValueKey<String>('notifications-empty'),
              icon: Icon(LucideIcons.bellOff),
              title: 'Nothing chosen yet',
              body: 'The server has no notification settings on file for this '
                  'account. Turn on what you want to hear about.',
            ),
            data: (BuildContext context, NotificationPreferences value) =>
                _Toggles(
              preferences: value,
              isB2b: widget.isB2b,
              saving: _saving,
              onChanged: (NotificationCategory category, {required bool on}) =>
                  _toggle(category, on: on),
            ),
          ),

          if (_saveFailure != null) ...<Widget>[
            SizedBox(height: t.spaceStack),
            FailureNotice(
              key: const ValueKey<String>('notifications-save-failure'),
              failure: _saveFailure!,
              endpoint: 'PATCH /v1/me/notification-preferences',
            ),
            SizedBox(height: t.spaceTight),
            Text(
              '"${_saveFailureCategory?.title ?? ''}" is unchanged.',
              style: context.type.meta.copyWith(color: t.ink3),
            ),
          ],

          SizedBox(height: t.spaceBlock),
          const _ContractGapNote(),
        ],
      ),
    );
  }
}

class _Toggles extends StatelessWidget {
  const _Toggles({
    required this.preferences,
    required this.isB2b,
    required this.saving,
    required this.onChanged,
  });

  final NotificationPreferences preferences;
  final bool isB2b;
  final Set<String> saving;
  final void Function(NotificationCategory category, {required bool on})
      onChanged;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    final List<NotificationCategory> categories = <NotificationCategory>[
      for (final NotificationCategory c in NotificationCategory.values)
        if (!c.b2bOnly || isB2b) c,
    ];

    return MeridianSurface(
      rung: MeridianRung.card,
      clipContent: true,
      child: Column(
        key: const ValueKey<String>('notifications-toggles'),
        children: <Widget>[
          for (int i = 0; i < categories.length; i++) ...<Widget>[
            if (i > 0) const AccountRowDivider(),
            _CategoryRow(
              category: categories[i],
              on: preferences.isOn(categories[i]),
              saving: saving.contains(categories[i].key),
              onChanged: (bool value) => onChanged(categories[i], on: value),
              tokens: t,
              type: type,
            ),
          ],
        ],
      ),
    );
  }
}

class _CategoryRow extends StatelessWidget {
  const _CategoryRow({
    required this.category,
    required this.on,
    required this.saving,
    required this.onChanged,
    required this.tokens,
    required this.type,
  });

  final NotificationCategory category;
  final bool on;
  final bool saving;
  final ValueChanged<bool> onChanged;
  final MeridianTokens tokens;
  final MeridianTypography type;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = tokens;

    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: kMinTouchTarget),
      child: Padding(
        padding: EdgeInsetsDirectional.symmetric(
          horizontal: t.spaceStack,
          vertical: t.spaceTight,
        ),
        child: MergeSemantics(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(category.title, style: type.body),
                    SizedBox(height: t.spaceUnit / 2),
                    Text(
                      category.alwaysOn
                          ? '${category.body} These cannot be turned off.'
                          : category.body,
                      style: type.meta.copyWith(color: t.ink3),
                    ),
                  ],
                ),
              ),
              SizedBox(width: t.spaceTight),
              if (saving)
                SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(t.primary),
                  ),
                )
              else
                Switch.adaptive(
                  key: ValueKey<String>('notification-${category.key}'),
                  value: on,
                  // An always-on category renders its switch disabled and on.
                  // Hiding it would leave the user wondering whether security
                  // alerts are off.
                  onChanged: category.alwaysOn ? null : onChanged,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The pre-permission explainer.
///
/// It exists so the OS prompt is asked ONCE, at a moment when the answer is
/// likely to be yes. The card is not the prompt: nothing here reaches the
/// platform until [onAsk] is tapped.
class _PrePermissionCard extends StatelessWidget {
  const _PrePermissionCard({
    required this.canAsk,
    required this.onAsk,
    required this.onNotNow,
  });

  final bool canAsk;
  final VoidCallback onAsk;
  final VoidCallback onNotNow;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return MeridianSurface(
      rung: MeridianRung.card,
      fill: t.primarySoft,
      padding: EdgeInsetsDirectional.all(t.spaceStack),
      child: Column(
        key: const ValueKey<String>('notifications-primer'),
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(LucideIcons.truck, size: 18, color: t.primaryInk),
              SizedBox(width: t.spaceTight),
              Expanded(
                child: Text(
                  'Want to know when the driver is close?',
                  style: type.ui.copyWith(color: t.primaryInk),
                ),
              ),
            ],
          ),
          SizedBox(height: t.spaceTight),
          Text(
            'We will send you a message when your order is dispatched and '
            'again when it is out for delivery. Nothing else, unless you ask '
            'for it below.',
            style: type.meta.copyWith(color: t.ink2),
          ),
          SizedBox(height: t.spaceStack),
          // Expanded on both, so the pair keeps its 50/50 split at any text
          // size rather than "Yes, keep me posted" squeezing "Not now" out.
          Row(
            children: <Widget>[
              Expanded(
                child: KeyButton(
                  key: const ValueKey<String>('primer-not-now'),
                  label: 'Not now',
                  tone: KeyButtonTone.ghost,
                  size: KeyButtonSize.small,
                  expand: true,
                  // Dismisses the card and NOTHING else. The system prompt is
                  // one-shot per install; spending it on a "no" is how an
                  // account loses delivery notifications forever.
                  onPressed: onNotNow,
                ),
              ),
              SizedBox(width: t.spaceTight),
              Expanded(
                child: KeyButton(
                  key: const ValueKey<String>('primer-ask'),
                  label: 'Yes, keep me posted',
                  size: KeyButtonSize.small,
                  expand: true,
                  onPressed: canAsk ? onAsk : null,
                ),
              ),
            ],
          ),
          if (!canAsk) ...<Widget>[
            SizedBox(height: t.spaceTight),
            Text(
              'Nothing in this build can ask the system for permission yet: '
              'there is no push plugin in pubspec.yaml, and no device token to '
              'send to POST /v1/devices.',
              key: const ValueKey<String>('primer-cannot-ask'),
              style: type.meta.copyWith(color: t.warningInk),
            ),
          ],
        ],
      ),
    );
  }
}

/// The standing note about what is missing. Always visible, in every state.
class _ContractGapNote extends StatelessWidget {
  const _ContractGapNote();

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    return Text(
      'These settings need GET and PATCH /v1/me/notification-preferences. '
      'Unlike the auth routes, those are not merely unimplemented — they have '
      'never been specified: there is no schema for them in '
      'packages/contracts and no model in schema.prisma. POST /v1/devices, '
      'which is specified, registers a handset for push but does not carry '
      'which categories that handset wants.',
      key: const ValueKey<String>('notifications-contract-gap'),
      style: type.micro.copyWith(color: t.ink3),
    );
  }
}
