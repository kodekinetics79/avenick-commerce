import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/l10n/directional_icon.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../catalogue_context.dart';

/// A section heading with an optional trailing action.
///
/// The action is a text button rather than a chevron on its own: "See all" is
/// readable and announceable, a bare `>` is neither, and a chevron with a
/// 24×24 hit box fails the touch-target floor before it fails anything else.
class SectionHeader extends StatelessWidget {
  const SectionHeader({
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
    super.key,
  });

  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final String? label = actionLabel;

    return Padding(
      padding: EdgeInsetsDirectional.fromSTEB(
        t.spaceStack,
        t.spaceStack,
        t.spaceTight,
        t.spaceTight,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Semantics(
                  header: true,
                  child: Text(title, style: type.h3),
                ),
                if (subtitle != null) ...<Widget>[
                  SizedBox(height: t.spaceUnit / 2),
                  Text(
                    subtitle!,
                    style: type.meta.copyWith(color: t.ink3),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
          if (label != null && onAction != null)
            ConstrainedBox(
              constraints: const BoxConstraints(
                minHeight: kMinTouchTarget,
                minWidth: kMinTouchTarget,
              ),
              child: TextButton(
                onPressed: onAction,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Text(label, style: type.ui.copyWith(color: t.primaryInk)),
                    SizedBox(width: t.spaceUnit),
                    // Directional: the chevron points the way the UI moves, so
                    // it flips in Arabic. That is the whole mirroring rule.
                    DirectionalIcon(
                      LucideIcons.chevronRight,
                      name: 'chevron-right',
                      size: 16,
                      color: t.primaryInk,
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// An icon-only control that cannot be built too small and cannot be built
/// unlabelled.
///
/// Both are compile-time facts here rather than review comments: [label] is
/// required, and the box is padded out to [kMinTouchTarget] — which the theme's
/// own `rowH` (44) and `controlHLg` (46) both sit below, so anything sized from
/// those tokens misses the floor by a couple of pixels and nothing warns.
class IconAction extends StatelessWidget {
  const IconAction({
    required this.icon,
    required this.iconName,
    required this.label,
    required this.onPressed,
    this.badgeCount,
    this.tone,
    super.key,
  });

  final IconData icon;

  /// The lucide name, so [IconMirroring] decides whether it flips. Required
  /// rather than inferred because [IconData] carries no name at runtime — which
  /// makes the policy something a reviewer can see in the diff.
  final String iconName;

  /// The screen-reader label. An icon-only button without one is a button a
  /// screen reader announces as "button".
  final String label;

  final VoidCallback? onPressed;

  /// A count on the shoulder — the number of active filters, typically.
  final int? badgeCount;

  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final int badge = badgeCount ?? 0;

    return Semantics(
      button: true,
      enabled: onPressed != null,
      label: badge > 0 ? '$label, $badge active' : label,
      excludeSemantics: true,
      child: InkResponse(
        onTap: onPressed,
        radius: kMinTouchTarget / 2,
        splashFactory: NoSplash.splashFactory,
        child: SizedBox(
          width: kMinTouchTarget,
          height: kMinTouchTarget,
          child: Stack(
            alignment: Alignment.center,
            clipBehavior: Clip.none,
            children: <Widget>[
              DirectionalIcon(
                icon,
                name: iconName,
                size: 20,
                color: onPressed == null ? t.ink3 : (tone ?? t.ink1),
              ),
              if (badge > 0)
                PositionedDirectional(
                  end: 6,
                  top: 6,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: t.primary,
                      borderRadius: BorderRadius.circular(t.radiusPill),
                      border: Border.all(color: t.surface0, width: 1.5),
                    ),
                    child: Padding(
                      padding: EdgeInsetsDirectional.symmetric(
                        horizontal: t.spaceUnit,
                      ),
                      child: Text(
                        '$badge',
                        style: type.micro.copyWith(
                          color: t.primaryForeground,
                          fontSize: 10,
                          height: 1.4,
                          letterSpacing: 0,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The back affordance, with the mirroring policy applied explicitly.
///
/// Material's own [BackButton] draws `Icons.arrow_back`, whose
/// `matchTextDirection` flag is a SECOND direction source running beside
/// [IconMirroring] — see the long note in `DirectionalIcon`. Naming the icon
/// here keeps one policy, one direction value.
class CatalogueBackButton extends StatelessWidget {
  const CatalogueBackButton({super.key});

  @override
  Widget build(BuildContext context) {
    return IconAction(
      icon: LucideIcons.arrowLeft,
      iconName: 'arrow-left',
      label: 'Back',
      onPressed: () => Navigator.of(context).maybePop(),
    );
  }
}

/// A hairline rule that spans the content, used between stacked sections.
class SectionRule extends StatelessWidget {
  const SectionRule({super.key});

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    return Padding(
      padding: EdgeInsetsDirectional.symmetric(vertical: t.spaceStack),
      child: Divider(height: 1, thickness: 1, color: t.hairline),
    );
  }
}

/// Bounds a [KeyButton] that sits beside other content.
///
/// **[KeyButton] always fills the width it is given.** Its assembly is a
/// `Stack` whose only children are `Positioned` — the edge and the face — so
/// `RenderStack` has no non-positioned child to size to and falls back to
/// `constraints.biggest`. In a `Column` that is merely full-bleed; in a `Row`,
/// where children are laid out with an unbounded main axis, it is
/// `'size.isFinite': is not true` and a red screen.
///
/// So every key button in this feature that shares a row with something else
/// goes through here, with a width chosen on purpose. The label ellipsises
/// inside it rather than the layout failing outside it.
class BoundedAction extends StatelessWidget {
  const BoundedAction({required this.child, this.maxWidth = 180, super.key});

  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) => ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: child,
      );
}
