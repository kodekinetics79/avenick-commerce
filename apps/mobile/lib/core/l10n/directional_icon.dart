import 'package:flutter/widgets.dart';

/// Whether an icon's meaning depends on which way it points.
///
/// The whole mirroring rule reduces to one question: **does this glyph encode a
/// direction of travel through the interface, or does it depict an object?**
///
/// Directions mirror. Objects do not. A magnifying glass is a magnifying glass
/// in Cairo — flipping it produces a left-handed magnifier that no one has ever
/// seen, and it is the single most common RTL mistake in shipped apps.
enum IconDirectionality {
  /// Mirrors under RTL. The glyph points the way the UI moves.
  directional,

  /// Never mirrors. The glyph depicts a physical object, a mark, or data.
  fixed,
}

/// The mirroring policy, driven by exactly one direction value.
///
/// That value is the ambient [Directionality] and nothing else. Not a token,
/// not a locale string comparison, not a per-widget bool. [MeridianTokens.dir]
/// exists in the generated tokens but is `1.0` in *both* themes — it is a theme
/// token, not a locale one, so it cannot be the source of truth here.
///
/// One value means the app cannot get into the state where the chevron mirrored
/// and the row it sits in did not.
abstract final class IconMirroring {
  /// Icons that MIRROR. Each one encodes movement through the interface, so in
  /// a right-to-left reading order it must encode the opposite movement.
  ///
  /// - back / forward chevrons and arrows — "the way I came" is now the right
  /// - disclosure and drill-in arrows — the child opens toward the reading edge
  /// - progress connectors between steps — the stepper runs right-to-left
  /// - reply, reply-all, undo, redo, share-forward — the arrow re-enters or
  ///   leaves the flow of text, and text is what reversed
  /// - list indent / outdent, pagination arrows, carousel controls
  /// - trending "next" and breadcrumb separators
  static const Set<String> mirrored = <String>{
    'chevron-left',
    'chevron-right',
    'chevrons-left',
    'chevrons-right',
    'arrow-left',
    'arrow-right',
    'arrow-big-left',
    'arrow-big-right',
    'move-left',
    'move-right',
    'corner-down-left',
    'corner-down-right',
    'corner-up-left',
    'corner-up-right',
    'reply',
    'reply-all',
    'forward',
    'undo',
    'redo',
    'undo-2',
    'redo-2',
    'rotate-ccw',
    'rotate-cw',
    'indent',
    'outdent',
    'list-ordered',
    'panel-left',
    'panel-right',
    'log-in',
    'log-out',
    'external-link',
    'step-forward',
    'step-back',
    'skip-forward',
    'skip-back',
  };

  /// Icons that NEVER mirror, called out by name because each one is a mistake
  /// someone has actually shipped.
  ///
  /// - **clock** — a clock face runs clockwise in every country on earth.
  ///   Mirroring it draws a clock that runs backwards.
  /// - **check** — the checkmark is a mark, not an arrow. A mirrored tick reads
  ///   as a foreign symbol, and next to a mirrored X it becomes ambiguous.
  /// - **search** — the magnifier's handle is where it is because most people
  ///   are right-handed, not because of reading order.
  /// - **camera / video** — a physical object with a lens and a grip.
  /// - **cart / bag / package** — physical objects. A mirrored trolley is still
  ///   a trolley, so the flip is pure noise; and the cart is the one glyph in
  ///   commerce that must be instantly recognised.
  /// - **star / heart** — symmetric marks of value; flipping is a no-op that
  ///   still costs a transform, or worse, an off-by-one antialiasing shift that
  ///   makes the icon look subtly wrong beside its unflipped neighbours.
  /// - **brand marks** — a mirrored logo is someone else's logo.
  /// - **trend arrows** — up-and-to-the-right means *growth* because of the
  ///   chart's Y axis, which does not reverse. Mirroring a revenue arrow turns
  ///   a good quarter into a bad one.
  static const Set<String> neverMirrored = <String>{
    'clock',
    'timer',
    'alarm-clock',
    'history',
    'check',
    'check-check',
    'circle-check',
    'square-check',
    'badge-check',
    'search',
    'zoom-in',
    'zoom-out',
    'camera',
    'video',
    'image',
    'shopping-cart',
    'shopping-bag',
    'package',
    'truck',
    'star',
    'heart',
    'bookmark',
    'trending-up',
    'trending-down',
    'chart-line',
    'chart-bar',
    'arrow-up',
    'arrow-down',
    'chevron-up',
    'chevron-down',
  };

  /// The policy for [iconName] (a lucide name, e.g. `chevron-right`).
  ///
  /// Unknown names default to [IconDirectionality.fixed]. Failing closed is the
  /// right default: an icon that should have mirrored and did not is a small
  /// awkwardness, while a mirrored clock or a mirrored logo is a defect anyone
  /// can see.
  static IconDirectionality policyFor(String iconName) {
    final String name = iconName.toLowerCase();
    if (neverMirrored.contains(name)) return IconDirectionality.fixed;
    if (mirrored.contains(name)) return IconDirectionality.directional;
    return IconDirectionality.fixed;
  }
}

/// An [Icon] that mirrors — or refuses to — according to [IconMirroring].
///
/// ```dart
/// DirectionalIcon(LucideIcons.chevronRight, name: 'chevron-right')  // mirrors
/// DirectionalIcon(LucideIcons.clock,        name: 'clock')          // never
/// ```
///
/// The `name` is required rather than inferred because [IconData] carries no
/// name at runtime — only a code point — so there is nothing to look up. Making
/// the caller pass it turns the policy into something reviewable in a diff.
class DirectionalIcon extends StatelessWidget {
  const DirectionalIcon(
    this.icon, {
    required this.name,
    this.size,
    this.color,
    this.semanticLabel,
    super.key,
  }) : _override = null;

  /// Escape hatch for an icon whose directionality genuinely is not a property
  /// of the glyph — a custom arrow in an illustration, say. Use sparingly; the
  /// named policy is what keeps this reviewable.
  const DirectionalIcon.explicit(
    this.icon, {
    required IconDirectionality directionality,
    this.size,
    this.color,
    this.semanticLabel,
    super.key,
  })  : name = '',
        _override = directionality;

  final IconData icon;
  final String name;
  final double? size;
  final Color? color;
  final String? semanticLabel;
  final IconDirectionality? _override;

  IconDirectionality get directionality =>
      _override ?? IconMirroring.policyFor(name);

  @override
  Widget build(BuildContext context) {
    // Flutter's own [Icon] mirrors any [IconData] whose `matchTextDirection`
    // is true, and a great many Material constants set it —
    // `Icons.chevron_right`, `Icons.arrow_back`, `Icons.reply`. Left alone that
    // is a SECOND direction source running beside this class's policy, and it
    // produces two opposite bugs:
    //
    //  - a `fixed` icon carrying the flag mirrors anyway, against policy;
    //  - a `directional` icon carrying the flag mirrors twice — once inside
    //    Icon, once in the Transform below — and the two cancel, so the icon
    //    that most needed mirroring is the one that does not.
    //
    // The obvious fix, rebuilding the IconData with the flag cleared, is not
    // available: Flutter's icon tree-shaker requires every IconData to be a
    // const instance, and a runtime-constructed one fails `flutter build` with
    // "This application cannot tree shake icons fonts". So the flag is
    // neutralised by controlling the direction Icon reads instead — which
    // keeps Directionality the one value the whole rule runs on.
    final bool selfMirroring = icon.matchTextDirection;
    final bool rtl = Directionality.of(context) == TextDirection.rtl;

    final Widget child = Icon(
      icon,
      size: size,
      color: color,
      semanticLabel: semanticLabel,
    );

    if (directionality == IconDirectionality.fixed) {
      if (!selfMirroring) return child;
      // Pin the direction Icon sees so its built-in mirroring cannot fire.
      // A clock stays a clock in Arabic.
      return Directionality(textDirection: TextDirection.ltr, child: child);
    }

    // Directional. If the glyph already mirrors itself off the ambient
    // direction, that is exactly the behaviour wanted — adding a Transform
    // here would undo it.
    if (selfMirroring) return child;

    if (!rtl) return child;

    return Transform(
      alignment: Alignment.center,
      transform: Matrix4.diagonal3Values(-1.0, 1.0, 1.0),
      child: child,
    );
  }
}
