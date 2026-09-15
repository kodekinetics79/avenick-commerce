import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/enums.dart';
import '../../../core/error/failures.dart';
import '../../../core/l10n/directional_icon.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../core/ui/key_button.dart';
import '../../../theme/elevation.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../data/account_preferences.dart';

/// Shared chrome for the identity and account screens.
///
/// Nothing in this file talks to the network. It exists so seven screens agree
/// on three things that are easy to get subtly wrong per-screen: the minimum
/// touch target, how a failure is worded, and which locale the subtree renders
/// in.

/// The smallest a tappable thing may be.
///
/// 48dp is the floor in both platform guidelines, and `rowH` in the tokens is
/// 44 — correct for a dense DATA row, four short of a legal target. Every
/// interactive row in this feature is sized from here rather than from `rowH`,
/// so the two cannot drift.
const double kMinTouchTarget = 48.0;

/// Applies the chosen language to a subtree.
///
/// WHEN THE PREFERENCE IS "FOLLOW THE DEVICE" — the default — this widget does
/// NOTHING AT ALL and the ambient locale and direction pass straight through.
/// That is what makes an Arabic handset open in Arabic without anybody
/// choosing anything, and it is what keeps the RTL goldens honest: a scope that
/// forced `en` here would render the Arabic golden cell in English and the
/// mirror test would pass on a screen nobody had ever mirrored.
///
/// WHAT IT DOES NOT DO. The override is scoped to this subtree, not to the
/// app, because `lib/main.dart` passes `locale: null` to `MaterialApp` and
/// belongs to another engineer. Every screen in this feature is wrapped, so the
/// choice is visible immediately where it is made — but to carry it app-wide,
/// `main.dart` needs one line:
///
///     locale: ref.watch(resolvedPreferencesProvider).localeOverride,
///
/// Until that lands the setting is real but partial, and the account screen
/// says so in a footnote rather than pretending otherwise.
class AccountLocaleScope extends ConsumerWidget {
  const AccountLocaleScope({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AccountPreferences prefs = ref.watch(resolvedPreferencesProvider);
    final Locale? locale = prefs.localeOverride;
    final TextDirection? direction = prefs.textDirectionOverride;
    if (locale == null || direction == null) return child;

    return Localizations.override(
      context: context,
      locale: locale,
      // `Localizations.override` swaps the delegates' locale but nothing
      // re-derives the ambient Directionality from it — that happens once, up
      // in WidgetsApp. Setting it explicitly is what actually mirrors the
      // layout, and it is the single direction value every
      // EdgeInsetsDirectional in this feature resolves against.
      child: Directionality(textDirection: direction, child: child),
    );
  }
}

/// The scaffold every screen in this feature uses.
///
/// It scrolls by default. A settings screen that does not scroll is a settings
/// screen that clips its last row at 200% text — and the tokens' control
/// heights are fixed, so the type is the only thing that grows.
class AccountScaffold extends StatelessWidget {
  const AccountScaffold({
    required this.title,
    required this.child,
    this.actions = const <Widget>[],
    this.bottomBar,
    this.scrollable = true,
    this.padded = true,
    super.key,
  });

  final String title;
  final Widget child;
  final List<Widget> actions;

  /// Pinned above the keyboard and the home indicator. For the one primary
  /// action a screen has.
  final Widget? bottomBar;

  final bool scrollable;
  final bool padded;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;

    final Widget body = padded
        ? Padding(
            padding: EdgeInsetsDirectional.fromSTEB(
              t.spaceStack,
              t.spaceStack,
              t.spaceStack,
              t.spaceBlock,
            ),
            child: child,
          )
        : child;

    return AccountLocaleScope(
      child: Scaffold(
        appBar: AppBar(title: Text(title), actions: actions),
        body: SafeArea(
          child: scrollable
              ? SingleChildScrollView(
                  // The keyboard must be dismissible by dragging over the
                  // form, not only by finding a Done key that some Arabic
                  // keyboards do not show.
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  child: body,
                )
              : body,
        ),
        bottomNavigationBar: bottomBar == null
            ? null
            : SafeArea(
                minimum: EdgeInsetsDirectional.fromSTEB(
                  t.spaceStack,
                  0,
                  t.spaceStack,
                  t.spaceTight,
                ).resolve(Directionality.of(context)),
                child: Padding(
                  padding: EdgeInsets.only(
                    bottom: MediaQuery.viewInsetsOf(context).bottom,
                  ),
                  child: bottomBar,
                ),
              ),
      ),
    );
  }
}

/// A titled block.
class AccountSection extends StatelessWidget {
  const AccountSection({
    required this.title,
    required this.children,
    this.footnote,
    super.key,
  });

  final String title;
  final List<Widget> children;

  /// The quiet line under a block. Used throughout this feature to say what a
  /// control does NOT do yet.
  final String? footnote;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Padding(
          padding: EdgeInsetsDirectional.only(
            top: t.spaceStack,
            bottom: t.spaceTight,
          ),
          child: Text(
            title,
            style: type.micro.copyWith(color: t.ink3),
          ),
        ),
        MeridianSurface(
          rung: MeridianRung.card,
          clipContent: true,
          child: Column(children: children),
        ),
        if (footnote != null)
          Padding(
            padding: EdgeInsetsDirectional.only(top: t.spaceTight),
            child: Text(
              footnote!,
              style: type.meta.copyWith(color: t.ink3),
            ),
          ),
      ],
    );
  }
}

/// One row in an [AccountSection].
///
/// [onTap] null and [disabledReason] set renders a row that is visibly and
/// semantically unavailable WITH ITS REASON SHOWN. That combination is the
/// house rule this whole feature is built on: a control that cannot work is
/// either absent or explained, never present and inert.
class AccountRow extends StatelessWidget {
  const AccountRow({
    required this.title,
    this.subtitle,
    this.subtitleToken,
    this.icon,
    this.trailing,
    this.onTap,
    this.disabledReason,
    this.tone = AccountRowTone.normal,
    this.showChevron = true,
    super.key,
  });

  final String title;
  final String? subtitle;

  /// When the subtitle is a machine-readable token — an email, a phone — it is
  /// wrapped in a bidi isolate so it survives an Arabic layout intact.
  final LtrToken? subtitleToken;

  final IconData? icon;
  final Widget? trailing;
  final VoidCallback? onTap;
  final String? disabledReason;
  final AccountRowTone tone;
  final bool showChevron;

  bool get _enabled => onTap != null;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    final Color titleColour = switch (tone) {
      AccountRowTone.normal => _enabled ? t.ink1 : t.ink3,
      AccountRowTone.danger => _enabled ? t.dangerInk : t.ink3,
    };

    final Widget content = Padding(
      padding: EdgeInsetsDirectional.symmetric(
        horizontal: t.spaceStack,
        vertical: t.spaceTight + t.spaceUnit,
      ),
      child: Row(
        children: <Widget>[
          if (icon != null) ...<Widget>[
            Icon(icon, size: 20, color: _enabled ? t.ink2 : t.ink3),
            SizedBox(width: t.spaceTight + t.spaceUnit),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(title, style: type.body.copyWith(color: titleColour)),
                if (subtitle != null) ...<Widget>[
                  SizedBox(height: t.spaceUnit / 2),
                  if (subtitleToken != null)
                    DirectionalText.token(
                      subtitle!,
                      kind: subtitleToken!,
                      style: type.meta.copyWith(color: t.ink3),
                    )
                  else
                    Text(
                      subtitle!,
                      style: type.meta.copyWith(color: t.ink3),
                    ),
                ],
                if (disabledReason != null) ...<Widget>[
                  SizedBox(height: t.spaceUnit),
                  Text(
                    disabledReason!,
                    style: type.meta.copyWith(color: t.warningInk),
                  ),
                ],
              ],
            ),
          ),
          if (trailing != null) ...<Widget>[
            SizedBox(width: t.spaceTight),
            trailing!,
          ] else if (showChevron && _enabled) ...<Widget>[
            SizedBox(width: t.spaceTight),
            DirectionalIcon(
              LucideIcons.chevronRight,
              name: 'chevron-right',
              size: 18,
              color: t.ink3,
            ),
          ],
        ],
      ),
    );

    // MergeSemantics + the InkWell's own node: one button, one label built
    // from the text inside it. Declaring `button: true` on an outer Semantics
    // as well would announce the row twice.
    return MergeSemantics(
      child: Semantics(
        hint: disabledReason,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: kMinTouchTarget),
          child: Material(
            type: MaterialType.transparency,
            child: InkWell(
              onTap: onTap,
              // No ripple anywhere in this system — see KeyButton.
              splashFactory: NoSplash.splashFactory,
              highlightColor: t.stateMix.withValues(alpha: t.statePress),
              child: content,
            ),
          ),
        ),
      ),
    );
  }
}

enum AccountRowTone { normal, danger }

/// A hairline between rows in a section.
class AccountRowDivider extends StatelessWidget {
  const AccountRowDivider({super.key});

  @override
  Widget build(BuildContext context) =>
      Divider(height: 1, thickness: 1, color: context.tokens.hairline);
}

/// How a failure is shown to a person.
///
/// THE HONEST BRANCH. When the failure is `not_found` and the caller named the
/// endpoint it was calling, this does not say "something went wrong" — because
/// nothing did go wrong, the route has not been written. Reporting an
/// unimplemented endpoint as a transient error sends the user into a retry loop
/// that can never succeed, and sends support after a network problem that does
/// not exist.
///
/// The `requestId` is always shown when the server sent one. It is the only
/// thing that connects what a person saw on a phone to a line in a server log.
class FailureNotice extends StatelessWidget {
  const FailureNotice({
    required this.failure,
    this.endpoint,
    this.onRetry,
    super.key,
  });

  final ApiFailure failure;

  /// The route this call needed, e.g. `POST /v1/auth/otp/request`. Supplied by
  /// every call site in this feature.
  final String? endpoint;

  final VoidCallback? onRetry;

  /// True when this is an unimplemented endpoint rather than a fault.
  bool get isUnbuilt {
    final ApiFailure f = failure;
    return f is ServerFailure && f.isNotFound;
  }

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final bool unbuilt = isUnbuilt;
    final String? requestId = failure.traceId;

    final String headline = unbuilt
        ? 'This part of the app has no server behind it yet'
        : 'That did not work';

    final String body = unbuilt
        ? 'The app asked for ${endpoint ?? 'an endpoint'} and the server '
            'answered that there is no such route. Nothing was saved and '
            'nothing was sent. This is not something retrying will fix — the '
            'endpoint has not been built.'
        : failure.displayMessage;

    return MeridianSurface(
      rung: MeridianRung.card,
      fill: unbuilt ? t.warningSoft : t.dangerSoft,
      padding: EdgeInsetsDirectional.all(t.spaceStack),
      child: Semantics(
        liveRegion: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Icon(
                  unbuilt ? LucideIcons.wrench : LucideIcons.triangleAlert,
                  size: 18,
                  color: unbuilt ? t.warningInk : t.dangerInk,
                ),
                SizedBox(width: t.spaceTight),
                Expanded(
                  child: Text(
                    headline,
                    style: type.ui.copyWith(
                      color: unbuilt ? t.warningInk : t.dangerInk,
                    ),
                  ),
                ),
              ],
            ),
            SizedBox(height: t.spaceTight),
            Text(body, style: type.meta.copyWith(color: t.ink2)),
            if (requestId != null) ...<Widget>[
              SizedBox(height: t.spaceTight),
              DirectionalText.rich(
                <TextSegment>[
                  const TextSegment.prose('Reference '),
                  TextSegment.token(requestId, kind: LtrToken.reference),
                ],
                style: type.micro.copyWith(color: t.ink3),
              ),
            ],
            if (onRetry != null && !unbuilt && failure.isRetryable) ...<Widget>[
              SizedBox(height: t.spaceStack),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: KeyButton(
                  label: 'Try again',
                  tone: KeyButtonTone.ghost,
                  size: KeyButtonSize.small,
                  onPressed: onRetry,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Turns anything thrown by the API layer into a [FailureNotice].
///
/// The API layer's contract is that it throws `ApiFailure` and nothing else —
/// but a widget's error branch takes `Object`, so this is the one place that
/// re-establishes the guarantee. It never renders `error.toString()`: that is
/// how a stack trace or a connection string reaches a phone screen.
class ErrorBranch extends StatelessWidget {
  const ErrorBranch({
    required this.error,
    this.endpoint,
    this.onRetry,
    super.key,
  });

  final Object error;
  final String? endpoint;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final Object raw = error;
    final ApiFailure failure = raw is ApiFailure
        ? raw
        : const ApiFailure.unexpected(message: 'Something went wrong.');
    return Padding(
      padding: EdgeInsetsDirectional.all(t.spaceStack),
      child: FailureNotice(
        failure: failure,
        endpoint: endpoint,
        onRetry: onRetry,
      ),
    );
  }
}

/// A field label with an optional quiet hint under it.
class AccountFieldLabel extends StatelessWidget {
  const AccountFieldLabel({required this.label, this.hint, super.key});

  final String label;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: type.ui.copyWith(color: t.ink1)),
        if (hint != null) ...<Widget>[
          SizedBox(height: t.spaceUnit / 2),
          Text(hint!, style: type.meta.copyWith(color: t.ink3)),
        ],
        SizedBox(height: t.spaceTight),
      ],
    );
  }
}

/// A country/market chooser, as a modal sheet.
///
/// A sheet rather than a `DropdownButton` because six rows of 48dp with the
/// dial code visible is readable at 200% text and a dropdown is not.
Future<T?> showAccountSheet<T>({
  required BuildContext context,
  required String title,
  required List<Widget> Function(BuildContext context) children,
}) {
  final MeridianTokens t = context.tokens;
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    builder: (BuildContext sheetContext) => AccountLocaleScope(
      child: SafeArea(
        child: Padding(
          padding: EdgeInsetsDirectional.fromSTEB(
            t.spaceStack,
            t.spaceStack,
            t.spaceStack,
            t.spaceStack,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(title, style: sheetContext.type.h3),
              SizedBox(height: t.spaceTight),
              Flexible(
                child: SingleChildScrollView(
                  child: Column(children: children(sheetContext)),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

/// The verified / not-verified mark next to an email or a phone.
class VerifiedBadge extends StatelessWidget {
  const VerifiedBadge({required this.verified, required this.what, super.key});

  final bool verified;

  /// "Email" or "Phone" — read out by a screen reader, so it must name the
  /// thing rather than say "verified" beside an unlabelled row.
  final String what;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    // Above ~1.4x the word stops fitting beside an email address on a 390pt
    // handset and pushes the row into an overflow. The MARK is the badge; the
    // word is a convenience for people who can read it, and the semantics
    // label below says the whole sentence to everyone either way — so at large
    // type the word goes and nothing is actually lost.
    final bool compact = MediaQuery.textScalerOf(context).scale(1.0) > 1.4;

    return Semantics(
      label: verified ? '$what verified' : '$what not verified',
      child: ExcludeSemantics(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(
              verified ? LucideIcons.circleCheck : LucideIcons.circleAlert,
              size: 14,
              color: verified ? t.successInk : t.warningInk,
            ),
            if (!compact) ...<Widget>[
              SizedBox(width: t.spaceUnit),
              Text(
                verified ? 'Verified' : 'Not verified',
                style: type.micro.copyWith(
                  color: verified ? t.successInk : t.warningInk,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Language choices as words, for the picker. Null is "follow the device".
String languageLabel(Language? language) => switch (language) {
      Language.ar => 'العربية',
      Language.en => 'English',
      null => 'Follow my device',
    };
