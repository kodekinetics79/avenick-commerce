import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/account.dart';
import '../../../api/models/enums.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../core/ui/async_state_view.dart';
import '../../../core/ui/key_button.dart';
import '../../../theme/elevation.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../data/account_preferences.dart';
import '../data/account_providers.dart';
import '../data/auth_actions.dart';
import '../data/gcc_market.dart';
import 'account_chrome.dart';
import 'addresses_screen.dart';
import 'delete_account_screen.dart';
import 'notification_preferences_screen.dart';
import 'phone_field.dart';

/// ── ENDPOINTS THIS SCREEN NEEDS ─────────────────────────────────────────────
/// `GET  /v1/me`            — everything above the fold. SPECIFIED, NOT BUILT.
/// `POST /v1/auth/revoke`   — sign out, server side. SPECIFIED, NOT BUILT.
/// `PATCH /v1/me`           — to mirror the language choice onto the account.
///                            SPECIFIED, NOT BUILT.
///
/// So today this screen renders its ERROR branch, naming `GET /v1/me` and
/// carrying the `requestId`. The rows below the identity block are not drawn at
/// all in that state, which is the point: a settings list rendered over an
/// identity nobody could load is a screen full of controls acting on an unknown
/// account.
///
/// The two preferences that need NO server — market/currency and language —
/// work today, because they are genuinely device-local.
/// ────────────────────────────────────────────────────────────────────────────

/// The account hub.
class AccountScreen extends ConsumerWidget {
  const AccountScreen({
    this.onOpenOrders,
    this.onOpenWishlist,
    this.onOpenSupport,
    this.onOpenAddresses,
    this.onSignedOut,
    super.key,
  });

  /// `/orders` — the router owns this tab. Null renders the row disabled with
  /// its reason rather than as a control that does nothing.
  final VoidCallback? onOpenOrders;

  /// There is no wishlist endpoint in the contract at all. Null is expected
  /// today and the row says so.
  final VoidCallback? onOpenWishlist;

  final VoidCallback? onOpenSupport;

  /// Null pushes [AddressesScreen] onto the ambient navigator.
  final VoidCallback? onOpenAddresses;

  final VoidCallback? onSignedOut;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<Me> me = ref.watch(meProvider);

    return AccountScaffold(
      title: 'Account',
      padded: false,
      child: AsyncStateView<Me>(
        value: me,
        // A profile with no name and no phone is not a failure and not a blank
        // screen — it is an account created from an email import, and it needs
        // a different sentence from either.
        isEmpty: (Me value) =>
            value.firstName.trim().isEmpty &&
            value.lastName.trim().isEmpty &&
            value.phone == null,
        loading: (BuildContext context) => const MeridianSkeleton(
          shape: MeridianSkeletonShape.list,
          itemCount: 7,
        ),
        error: (BuildContext context, Object error, StackTrace? _) =>
            ErrorBranch(
          error: error,
          endpoint: 'GET /v1/me',
          onRetry: () => ref.invalidate(meProvider),
        ),
        empty: (BuildContext context) => _Body(
          me: null,
          onOpenOrders: onOpenOrders,
          onOpenWishlist: onOpenWishlist,
          onOpenSupport: onOpenSupport,
          onOpenAddresses: onOpenAddresses,
          onSignedOut: onSignedOut,
        ),
        data: (BuildContext context, Me value) => _Body(
          me: value,
          onOpenOrders: onOpenOrders,
          onOpenWishlist: onOpenWishlist,
          onOpenSupport: onOpenSupport,
          onOpenAddresses: onOpenAddresses,
          onSignedOut: onSignedOut,
        ),
      ),
    );
  }
}

/// The list. [me] null is the empty branch — an account with nothing on it —
/// which still gets its settings and its sign-out, because those are exactly
/// what someone in that state needs.
class _Body extends ConsumerWidget {
  const _Body({
    required this.me,
    required this.onOpenOrders,
    required this.onOpenWishlist,
    required this.onOpenSupport,
    required this.onOpenAddresses,
    required this.onSignedOut,
  });

  final Me? me;
  final VoidCallback? onOpenOrders;
  final VoidCallback? onOpenWishlist;
  final VoidCallback? onOpenSupport;
  final VoidCallback? onOpenAddresses;
  final VoidCallback? onSignedOut;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final AccountPreferences prefs = ref.watch(resolvedPreferencesProvider);
    final Me? profile = me;

    return SingleChildScrollView(
      child: Padding(
        padding: EdgeInsetsDirectional.fromSTEB(
          t.spaceStack,
          t.spaceStack,
          t.spaceStack,
          t.spaceBlock,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            if (profile == null)
              const _EmptyProfileCard()
            else
              _IdentityBlock(me: profile),
            if (profile != null && !profile.canTransact) ...<Widget>[
              SizedBox(height: t.spaceStack),
              _StatusNotice(status: profile.status),
            ],
            AccountSection(
              title: 'Shopping',
              children: <Widget>[
                AccountRow(
                  key: const ValueKey<String>('account-orders'),
                  title: 'Your orders',
                  icon: LucideIcons.package,
                  onTap: onOpenOrders,
                  disabledReason: onOpenOrders == null
                      ? 'Opens from the Orders tab. GET /v1/orders is '
                          'specified and not built yet.'
                      : null,
                ),
                const AccountRowDivider(),
                AccountRow(
                  key: const ValueKey<String>('account-addresses'),
                  title: 'Delivery addresses',
                  icon: LucideIcons.mapPin,
                  onTap: () {
                    final VoidCallback? handler = onOpenAddresses;
                    if (handler != null) {
                      handler();
                      return;
                    }
                    Navigator.of(context).push<void>(
                      MaterialPageRoute<void>(
                        builder: (BuildContext context) =>
                            const AddressesScreen(),
                      ),
                    );
                  },
                ),
                const AccountRowDivider(),
                AccountRow(
                  key: const ValueKey<String>('account-wishlist'),
                  title: 'Saved items',
                  icon: LucideIcons.heart,
                  onTap: onOpenWishlist,
                  disabledReason: onOpenWishlist == null
                      ? 'There is no wishlist endpoint in the contract at '
                          'all — not specified, not built.'
                      : null,
                ),
                const AccountRowDivider(),
                AccountRow(
                  key: const ValueKey<String>('account-support'),
                  title: 'Help and support',
                  icon: LucideIcons.lifeBuoy,
                  onTap: onOpenSupport,
                  disabledReason: onOpenSupport == null
                      ? 'Needs a support destination — a web view or a '
                          'WhatsApp handoff — which nothing owns yet.'
                      : null,
                ),
              ],
            ),
            AccountSection(
              title: 'Preferences',
              footnote:
                  'Language and market are kept on this device. The language '
                  'takes effect across the account screens immediately; to '
                  'carry it into the whole app, main.dart needs to read '
                  'resolvedPreferencesProvider.localeOverride.',
              children: <Widget>[
                AccountRow(
                  key: const ValueKey<String>('account-language'),
                  title: 'Language',
                  subtitle: languageLabel(prefs.languageOverride),
                  icon: LucideIcons.languages,
                  onTap: () => _pickLanguage(context, ref, prefs),
                ),
                const AccountRowDivider(),
                AccountRow(
                  key: const ValueKey<String>('account-market'),
                  title: 'Market and currency',
                  subtitle:
                      '${prefs.market.nameEn}  ·  ${prefs.market.currency.code}',
                  icon: LucideIcons.globe,
                  onTap: () async {
                    final GccMarket? chosen = await pickMarket(
                      context: context,
                      current: prefs.market,
                      language: prefs.languageOverride ?? Language.en,
                    );
                    if (chosen == null) return;
                    await ref
                        .read(accountPreferencesProvider.notifier)
                        .setMarket(chosen);
                  },
                ),
                const AccountRowDivider(),
                AccountRow(
                  key: const ValueKey<String>('account-notifications'),
                  title: 'Notifications',
                  icon: LucideIcons.bell,
                  onTap: () => Navigator.of(context).push<void>(
                    MaterialPageRoute<void>(
                      builder: (BuildContext context) =>
                          NotificationPreferencesScreen(
                        isB2b: profile?.isB2bBuyer ?? false,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            AccountSection(
              title: 'Account',
              children: <Widget>[
                AccountRow(
                  key: const ValueKey<String>('account-sign-out'),
                  title: 'Sign out',
                  icon: LucideIcons.logOut,
                  showChevron: false,
                  onTap: () => _signOut(context, ref),
                ),
                const AccountRowDivider(),
                AccountRow(
                  key: const ValueKey<String>('account-delete'),
                  title: 'Delete your account',
                  icon: LucideIcons.trash2,
                  tone: AccountRowTone.danger,
                  onTap: () => Navigator.of(context).push<void>(
                    MaterialPageRoute<void>(
                      builder: (BuildContext context) => DeleteAccountScreen(
                        email: profile?.email,
                        onDeleted: onSignedOut,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickLanguage(
    BuildContext context,
    WidgetRef ref,
    AccountPreferences prefs,
  ) async {
    // A record rather than a `Language?`, so "follow my device" is a real
    // choice the sheet can return instead of being indistinguishable from a
    // dismissed sheet.
    final ({Language? value})? chosen =
        await showAccountSheet<({Language? value})>(
      context: context,
      title: 'Language',
      children: (BuildContext sheetContext) => <Widget>[
        for (final Language? option in <Language?>[
          null,
          Language.en,
          Language.ar,
        ])
          AccountRow(
            key: ValueKey<String>('language-${option?.code ?? 'device'}'),
            title: languageLabel(option),
            showChevron: false,
            trailing: option == prefs.languageOverride
                ? Icon(
                    LucideIcons.check,
                    size: 18,
                    color: sheetContext.tokens.primaryInk,
                  )
                : null,
            onTap: () => Navigator.of(sheetContext).pop((value: option)),
          ),
      ],
    );
    if (chosen == null) return;
    await ref
        .read(accountPreferencesProvider.notifier)
        .setLanguage(chosen.value);
    // The mirror onto `PATCH /v1/me { language }` is deliberately NOT fired
    // here. That endpoint does not exist, so the call would fail and pop an
    // error over a setting that has already visibly worked. When it ships, the
    // call belongs here and its failure belongs in a footnote on this row.
  }

  Future<void> _signOut(BuildContext context, WidgetRef ref) async {
    final bool? everywhere = await showAccountSheet<bool>(
      context: context,
      title: 'Sign out',
      children: (BuildContext sheetContext) => <Widget>[
        AccountRow(
          key: const ValueKey<String>('sign-out-this-device'),
          title: 'Sign out on this device',
          icon: LucideIcons.logOut,
          showChevron: false,
          onTap: () => Navigator.of(sheetContext).pop(false),
        ),
        const AccountRowDivider(),
        AccountRow(
          key: const ValueKey<String>('sign-out-everywhere'),
          title: 'Sign out everywhere',
          subtitle: 'For a handset you have lost.',
          icon: LucideIcons.shieldCheck,
          showChevron: false,
          onTap: () => Navigator.of(sheetContext).pop(true),
        ),
      ],
    );
    if (everywhere == null) return;

    final SignOutResult result =
        await ref.read(authActionsProvider).signOut(allSessions: everywhere);

    if (!context.mounted) return;
    if (!result.serverNotified) {
      // The device IS signed out. What failed is telling the server, and the
      // difference matters: "signed out everywhere" is a claim we have not
      // earned if `/revoke` never landed.
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Signed out on this device. We could not reach the server, so '
            'other devices may still be signed in.',
          ),
        ),
      );
    }
    onSignedOut?.call();
  }
}

/// Name, email, phone, and what is verified.
class _IdentityBlock extends ConsumerWidget {
  const _IdentityBlock({required this.me});

  final Me me;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final AccountPreferences prefs = ref.watch(resolvedPreferencesProvider);
    final Language language = prefs.languageOverride ?? Language.en;
    final PhoneNumber? phone = PhoneNumber.fromE164(me.phone);

    return MeridianSurface(
      rung: MeridianRung.card,
      padding: EdgeInsetsDirectional.all(t.spaceStack),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            me.displayName(language),
            key: const ValueKey<String>('account-name'),
            style: type.h2,
          ),
          SizedBox(height: t.spaceTight),
          Row(
            children: <Widget>[
              Icon(LucideIcons.mail, size: 16, color: t.ink3),
              SizedBox(width: t.spaceTight),
              Expanded(
                child: DirectionalText.token(
                  me.email,
                  kind: LtrToken.email,
                  style: type.body.copyWith(color: t.ink2),
                ),
              ),
              VerifiedBadge(verified: me.emailVerified, what: 'Email'),
            ],
          ),
          SizedBox(height: t.spaceTight),
          Row(
            children: <Widget>[
              Icon(LucideIcons.smartphone, size: 16, color: t.ink3),
              SizedBox(width: t.spaceTight),
              Expanded(
                child: phone == null
                    ? Text(
                        'No phone number on this account',
                        style: type.body.copyWith(color: t.ink3),
                      )
                    : DirectionalText.token(
                        phone.internationalDisplay,
                        kind: LtrToken.phone,
                        style: type.body.copyWith(color: t.ink2),
                      ),
              ),
              if (phone != null)
                VerifiedBadge(verified: me.phoneVerified, what: 'Phone'),
            ],
          ),
          if (me.company != null) ...<Widget>[
            SizedBox(height: t.spaceStack),
            Divider(height: 1, color: t.hairline),
            SizedBox(height: t.spaceStack),
            Row(
              children: <Widget>[
                Icon(LucideIcons.building2, size: 16, color: t.ink3),
                SizedBox(width: t.spaceTight),
                Expanded(
                  child: Text(
                    me.company!.nameEn,
                    style: type.body.copyWith(color: t.ink2),
                  ),
                ),
              ],
            ),
            if (!me.company!.canTradeB2b) ...<Widget>[
              SizedBox(height: t.spaceUnit),
              Text(
                'Business pricing is not open on this company yet.',
                style: type.meta.copyWith(color: t.warningInk),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

/// The empty branch's card. Not a failure, and not a blank screen.
class _EmptyProfileCard extends StatelessWidget {
  const _EmptyProfileCard();

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    return MeridianSurface(
      rung: MeridianRung.card,
      padding: EdgeInsetsDirectional.all(t.spaceStack),
      child: Column(
        key: const ValueKey<String>('account-empty-profile'),
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text('Your profile is empty', style: type.h3),
          SizedBox(height: t.spaceTight),
          Text(
            'There is no name and no phone number on this account. A driver '
            'cannot reach you without one.',
            style: type.body.copyWith(color: t.ink2),
          ),
          SizedBox(height: t.spaceStack),
          const Align(
            alignment: AlignmentDirectional.centerStart,
            child: KeyButton(
              label: 'Add your details',
              tone: KeyButtonTone.ghost,
              // PATCH /v1/me is specified and unbuilt, so there is nothing to
              // save into. The button is disabled with the reason beside it
              // rather than opening a form that cannot submit.
              onPressed: null,
            ),
          ),
          SizedBox(height: t.spaceTight),
          Text(
            'Editing needs PATCH /v1/me, which is specified and not built.',
            style: type.meta.copyWith(color: t.warningInk),
          ),
        ],
      ),
    );
  }
}

/// A suspended or banned account can still read; it cannot buy. Saying so here
/// is cheaper than letting a checkout fail on the last step.
class _StatusNotice extends StatelessWidget {
  const _StatusNotice({required this.status});

  final UserStatus status;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final String message = switch (status) {
      UserStatus.pending =>
        'This account is still being checked. You can browse, but not order '
            'yet.',
      UserStatus.suspended =>
        'This account is suspended. You can see your history, but you cannot '
            'place an order.',
      UserStatus.banned =>
        'This account has been closed for ordering. Support can explain why.',
      UserStatus.active => '',
    };

    return MeridianSurface(
      rung: MeridianRung.card,
      fill: t.warningSoft,
      padding: EdgeInsetsDirectional.all(t.spaceStack),
      child: Row(
        key: const ValueKey<String>('account-status-notice'),
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(LucideIcons.triangleAlert, size: 18, color: t.warningInk),
          SizedBox(width: t.spaceTight),
          Expanded(
            child: Text(message, style: type.meta.copyWith(color: t.ink2)),
          ),
        ],
      ),
    );
  }
}
