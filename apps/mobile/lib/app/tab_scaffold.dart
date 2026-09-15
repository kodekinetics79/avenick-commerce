import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/l10n/directional_icon.dart';
import '../core/l10n/numerals.dart';
import '../theme/meridian_theme.dart';
import '../theme/tokens.g.dart';
import '../theme/typography.dart';

/// How many distinct LINES are in the cart.
///
/// Lines, not units, and the distinction is the whole point of the provider.
/// A B2B buyer ordering 500 of one part has ONE line. Badging "500" tells them
/// something they already know about a quantity they typed themselves, in a
/// 16px circle, and it reads as an error state. Badging "1" tells them the
/// thing they cannot otherwise see: how many different items are waiting.
///
/// The networking engineer wires this to the real cart. The contract is the
/// count of lines.
final Provider<int> cartLineCountProvider = Provider<int>((Ref ref) => 0);

/// The five-tab shell.
class TabScaffold extends ConsumerWidget {
  const TabScaffold({required this.shell, super.key});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final int lines = ref.watch(cartLineCountProvider);
    return Scaffold(
      body: shell,
      bottomNavigationBar: MeridianTabBar(
        currentIndex: shell.currentIndex,
        cartLineCount: lines,
        onTap: (int index) => shell.goBranch(
          index,
          // Tapping the tab you are already on pops that tab to its root — the
          // standard native affordance for "get me back to the top".
          initialLocation: index == shell.currentIndex,
        ),
      ),
    );
  }
}

/// The bottom bar.
///
/// **Opaque. Not glass.** Two reasons, and the second is the one that matters
/// for a commerce app.
///
/// 1. **Cost.** A `BackdropFilter` forces a `saveLayer` over its whole rect,
///    every frame, for as long as it is on screen. A bottom bar is on screen
///    permanently and it sits over a scrolling list, so that is a full-width
///    offscreen buffer allocated, blurred and composited on every frame of
///    every scroll — the single most reliable way to turn a 120Hz list into a
///    janky one on a mid-range Android device.
///
/// 2. **Legibility is not allowed to be conditional.** A price, a cart count or
///    an order status rendered in a translucent chrome bar has a contrast ratio
///    that depends on what happens to be scrolled underneath it. It will be
///    fine over the page ground and fail over a product photo. A number in
///    chrome must be exactly as readable over a dark image as over an empty
///    list, and the only way to guarantee that is to not let the image through.
///
/// The bar still reads as a distinct plane: it gets a hairline top rule and the
/// specular seam, which is how the rest of the system separates rungs anyway.
class MeridianTabBar extends StatelessWidget {
  const MeridianTabBar({
    required this.currentIndex,
    required this.onTap,
    this.cartLineCount = 0,
    super.key,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;

  /// Lines, not units. See [cartLineCountProvider].
  final int cartLineCount;

  static const int cartTabIndex = 2;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;

    final List<_TabSpec> tabs = <_TabSpec>[
      const _TabSpec(label: 'Home', icon: LucideIcons.house, name: 'house'),
      const _TabSpec(label: 'Search', icon: LucideIcons.search, name: 'search'),
      const _TabSpec(label: 'Cart', icon: LucideIcons.shoppingCart, name: 'shopping-cart'),
      const _TabSpec(label: 'Orders', icon: LucideIcons.package, name: 'package'),
      const _TabSpec(label: 'Account', icon: LucideIcons.circleUser, name: 'circle-user'),
    ];

    return DecoratedBox(
      decoration: BoxDecoration(
        // Fully opaque, from the token. No alpha, no blur, no saturation.
        color: t.surface2,
        border: Border(top: BorderSide(color: t.hairline)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: t.rowH + t.spaceStack,
          child: Row(
            children: <Widget>[
              for (int i = 0; i < tabs.length; i++)
                Expanded(
                  child: _TabItem(
                    spec: tabs[i],
                    selected: i == currentIndex,
                    badge: i == cartTabIndex ? cartLineCount : 0,
                    onTap: () => onTap(i),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

@immutable
class _TabSpec {
  const _TabSpec({required this.label, required this.icon, required this.name});
  final String label;
  final IconData icon;

  /// The lucide name, for the mirroring policy. None of the five tab icons
  /// mirror — they are all objects — and naming them is what makes that a
  /// checked fact rather than an accident.
  final String name;
}

class _TabItem extends StatelessWidget {
  const _TabItem({
    required this.spec,
    required this.selected,
    required this.badge,
    required this.onTap,
  });

  final _TabSpec spec;
  final bool selected;
  final int badge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final _TabColors c = _TabColors(t, selected: selected);

    return Semantics(
      selected: selected,
      button: true,
      onTap: onTap,
      // The badge is announced as LINES, matching what is rendered — 'Cart, 2
      // items' when two different products are waiting, never 'Cart, 500'.
      label: badge > 0 ? '${spec.label}, $badge items' : spec.label,
      // Excluded so the icon and the label do not read out a second time after
      // the label above; the onTap action is declared explicitly instead.
      excludeSemantics: true,
      child: InkWell(
          onTap: onTap,
          // No ripple here either — same reason as KeyButton. The tab states
          // itself with colour, which is also what survives reduced motion.
          splashFactory: NoSplash.splashFactory,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              Stack(
                clipBehavior: Clip.none,
                children: <Widget>[
                  AnimatedContainer(
                    duration: context.motion.hover,
                    curve: context.motion.standard,
                    padding: EdgeInsets.symmetric(
                      horizontal: t.spaceStack - t.spaceUnit,
                      vertical: t.spaceUnit,
                    ),
                    decoration: BoxDecoration(
                      color: selected ? t.primarySoft : Colors.transparent,
                      borderRadius: BorderRadius.circular(t.radiusPill),
                    ),
                    child: DirectionalIcon(
                      spec.icon,
                      name: spec.name,
                      size: 20,
                      color: c.icon,
                    ),
                  ),
                  if (badge > 0)
                    PositionedDirectional(
                      // Directional: the badge sits on the trailing shoulder of
                      // the icon, which is the right side in English and the
                      // left in Arabic.
                      end: -2,
                      top: -4,
                      child: _Badge(count: badge),
                    ),
                ],
              ),
              SizedBox(height: t.spaceUnit / 2),
              Text(
                spec.label,
                style: type.micro.copyWith(color: c.label),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
      ),
    );
  }
}

/// Selected / unselected colours for a tab, from tokens.
@immutable
class _TabColors {
  const _TabColors(this._t, {required this.selected});
  final MeridianTokens _t;
  final bool selected;

  Color get icon => selected ? _t.primaryInk : _t.ink3;
  Color get label => selected ? _t.primaryInk : _t.ink3;
}

/// The cart badge.
///
/// Counts LINES. Caps the rendered value at 9+ — beyond that the number stops
/// being information and starts being a layout problem, and there is no cart on
/// earth where the difference between 12 and 13 lines changes what the user
/// does next.
///
/// Renders nothing at zero. An empty-state badge showing "0" is a permanent
/// small alarm about the absence of a thing.
class _Badge extends StatelessWidget {
  const _Badge({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    if (count <= 0) return const SizedBox.shrink();
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    // Western digits in both locales — a badge is the smallest place a second
    // numeral system does the most damage.
    final String text = count > 9 ? '9+' : Numerals.integer(count);

    return Container(
      constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
      padding: EdgeInsets.symmetric(horizontal: t.spaceUnit / 2),
      decoration: BoxDecoration(
        // Brand green, NOT danger. The convention elsewhere is a red count
        // badge, but in this system red is `CANCELLED` — a red badge sitting a
        // thumb's width from a red order-status chip makes them the same
        // object, and the semantic palette stops meaning anything. A cart count
        // is an affordance, not an alarm.
        color: t.primary,
        borderRadius: BorderRadius.circular(t.radiusPill),
        // The bar is opaque, so the badge needs a ring against the icon behind
        // it rather than a shadow — and a ring costs nothing per frame.
        border: Border.all(color: t.surface2, width: 1.5),
      ),
      child: Center(
        child: Text(
          text,
          style: type.micro.copyWith(
            color: t.primaryForeground,
            fontSize: 10,
            height: 1.4,
            letterSpacing: 0,
          ),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}
