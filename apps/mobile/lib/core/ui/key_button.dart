import 'package:flutter/material.dart';

import '../../theme/elevation.dart';
import '../../theme/meridian_theme.dart';
import '../../theme/tokens.g.dart';
import '../../theme/typography.dart';

/// The tone of a key button — which face and which edge it is cut from.
enum KeyButtonTone {
  /// The single primary action on a screen.
  primary,

  /// A secondary action of equal structure but lower colour weight.
  accent,

  /// A destructive action. Same physics, different material.
  danger,

  /// A quiet action: no fill, no edge, no travel. Included here so that the
  /// *absence* of the key edge is a deliberate choice at the call site rather
  /// than a different widget someone reaches for by accident.
  ghost,
}

enum KeyButtonSize { small, medium, large }

/// A button that behaves like a physical key.
///
/// The whole idea is one sentence: **the face sits on a solid edge, and pressing
/// it moves the face down by exactly the height of that edge, so it bottoms
/// out.**
///
/// Three things follow from that, and all three are the difference between this
/// and a button with a drop shadow:
///
/// 1. **The edge is solid, not a shadow.** `primaryEdge` is a real, fully
///    opaque colour in the tokens — a darker cut of the same material as the
///    face, the way the side of a key is the same plastic as the top. A blurred
///    shadow under a button says "this is floating above the page". A solid
///    3px edge says "this is a thing with a side you can see". Only the second
///    one can be pressed.
///
/// 2. **Travel equals edge height exactly.** `keyDepth` is 3.0, the edge is
///    3.0, and the press moves the face 3.0. Not 2, not 4. If travel is less
///    than the edge the key stops in mid-air and the remaining edge reads as a
///    rendering seam; if travel is more, the face slides *past* its own base
///    and the object stops being rigid. At exactly the edge height the face
///    lands on the base and the motion has an unmistakable end — the same
///    reason a real key feels good.
///
/// 3. **No ripple.** A Material ripple is an expanding circle claiming the
///    surface is a pool of water being touched. The key press claims the
///    surface is a rigid cap being depressed. Both at once is two contradictory
///    physical stories about one object, and the eye picks up the contradiction
///    even when the viewer cannot name it. `NoSplash.splashFactory` and the
///    press travel are one decision, not two.
class KeyButton extends StatefulWidget {
  const KeyButton({
    required this.label,
    required this.onPressed,
    this.tone = KeyButtonTone.primary,
    this.size = KeyButtonSize.medium,
    this.icon,
    this.trailingIcon,
    this.expand = false,
    this.busy = false,
    this.semanticLabel,
    super.key,
  });

  final String label;

  /// `null` disables the button. The edge stays — a disabled key is still a
  /// key, it just does not go down.
  final VoidCallback? onPressed;

  final KeyButtonTone tone;
  final KeyButtonSize size;
  final Widget? icon;
  final Widget? trailingIcon;
  final bool expand;

  /// Shows a spinner in place of the label and blocks input.
  ///
  /// The button keeps its measured width so the layout does not jump — a
  /// button that resizes on tap moves the thing next to it under the user's
  /// finger.
  final bool busy;

  final String? semanticLabel;

  @override
  State<KeyButton> createState() => _KeyButtonState();
}

class _KeyButtonState extends State<KeyButton> {
  bool _pressed = false;

  bool get _enabled => widget.onPressed != null && !widget.busy;

  void _setPressed(bool value) {
    if (_pressed == value) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final _KeyPalette p = _KeyPalette.forTone(t, widget.tone);

    // The edge height and the press travel are the same number, read once.
    // Two variables here would be two numbers that could drift apart.
    final double depth = widget.tone == KeyButtonTone.ghost ? 0.0 : t.keyDepth;

    final double height = switch (widget.size) {
      KeyButtonSize.small => t.controlHSm,
      KeyButtonSize.medium => t.controlHMd,
      KeyButtonSize.large => t.controlHLg,
    };
    final double radius =
        widget.size == KeyButtonSize.small ? t.radiusSm : t.radius;
    final double padH = switch (widget.size) {
      KeyButtonSize.small => t.spaceTight + t.spaceUnit,
      KeyButtonSize.medium => t.spaceStack,
      KeyButtonSize.large => t.spaceStack + t.spaceUnit,
    };

    final bool down = _pressed && _enabled;
    final MeridianTypography type = context.type;
    final TextStyle labelStyle =
        (widget.size == KeyButtonSize.small ? type.micro : type.ui).copyWith(
      color: _enabled ? p.foreground : p.foreground.withValues(alpha: 0.55),
    );

    Widget face = SizedBox(
      height: height,
      child: Padding(
        // Directional: the icon leads on the reading edge in both locales.
        padding: EdgeInsetsDirectional.symmetric(horizontal: padH),
        child: Row(
          mainAxisSize: widget.expand ? MainAxisSize.max : MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            if (widget.busy)
              SizedBox(
                width: labelStyle.fontSize,
                height: labelStyle.fontSize,
                child: CircularProgressIndicator(
                  strokeWidth: 2.0,
                  valueColor: AlwaysStoppedAnimation<Color>(p.foreground),
                ),
              )
            else ...<Widget>[
              if (widget.icon != null) ...<Widget>[
                IconTheme.merge(
                  data: IconThemeData(
                    color: labelStyle.color,
                    size: labelStyle.fontSize! + 3,
                  ),
                  child: widget.icon!,
                ),
                SizedBox(width: t.spaceUnit * 1.5),
              ],
              Flexible(
                child: Text(
                  widget.label,
                  style: labelStyle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                ),
              ),
              if (widget.trailingIcon != null) ...<Widget>[
                SizedBox(width: t.spaceUnit * 1.5),
                IconTheme.merge(
                  data: IconThemeData(
                    color: labelStyle.color,
                    size: labelStyle.fontSize! + 3,
                  ),
                  child: widget.trailingIcon!,
                ),
              ],
            ],
          ],
        ),
      ),
    );

    // The face: fill, hairline-free, and its own specular lip. The lip is a
    // painted stroke, never a BoxShadow — a shadow would sit outside the box
    // and glow above the button instead of catching its top edge.
    face = DecoratedBox(
      decoration: BoxDecoration(
        color: _enabled ? p.face : p.faceDisabled,
        borderRadius: BorderRadius.circular(radius),
      ),
      child: CustomPaint(
        foregroundPainter: MeridianSeamPainter(
          rim: t.rim,
          // The lip dims as the key goes down: the face has rotated out of the
          // light. This is the only part of the press that is not travel.
          lipAlpha: down ? t.rimShoulder2 : t.rim2,
          shoulderAlpha: down ? 0.0 : t.rimShoulder2,
          radius: radius,
          devicePixelRatio: MediaQuery.devicePixelRatioOf(context),
        ),
        child: face,
      ),
    );

    // The assembly. A Stack of exactly `height + depth`: the edge is drawn as
    // a full-height solid block, and the face rides on top of it, offset by
    // `depth` when up and by `0` when down. Because the face is opaque, the
    // only part of the edge ever visible is the `depth` sliver below the face —
    // which is precisely what an edge is.
    final Widget key = SizedBox(
      height: height + depth,
      width: widget.expand ? double.infinity : null,
      child: Stack(
        children: <Widget>[
          if (depth > 0)
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: _enabled ? p.edge : p.edgeDisabled,
                  borderRadius: BorderRadius.circular(radius),
                ),
              ),
            ),
          AnimatedPositionedDirectional(
            duration: context.motion.press,
            // Down is a harder stop than up: the key hits its base. Up is the
            // spring returning.
            curve: down ? context.motion.exitCurve : context.motion.overshoot,
            // Directional so the face fills edge-to-edge in both locales.
            start: 0,
            end: 0,
            top: down ? depth : 0,
            height: height,
            child: face,
          ),
        ],
      ),
    );

    return Semantics(
      button: true,
      enabled: _enabled,
      label: widget.semanticLabel ?? widget.label,
      child: Focus(
        canRequestFocus: _enabled,
        child: Builder(
          builder: (BuildContext context) {
            final bool focused = Focus.of(context).hasFocus;
            return GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTapDown: _enabled ? (_) => _setPressed(true) : null,
              onTapUp: _enabled ? (_) => _setPressed(false) : null,
              onTapCancel: _enabled ? () => _setPressed(false) : null,
              onTap: _enabled ? widget.onPressed : null,
              child: MouseRegion(
                cursor: _enabled
                    ? SystemMouseCursors.click
                    : SystemMouseCursors.basic,
                child: focused
                    ? DecoratedBox(
                        decoration: BoxDecoration(
                          borderRadius:
                              BorderRadius.circular(radius + t.ringWidth),
                          border: Border.all(color: t.ring, width: t.ringWidth),
                        ),
                        child: Padding(
                          padding: EdgeInsets.all(t.ringWidth),
                          child: key,
                        ),
                      )
                    : key,
              ),
            );
          },
        ),
      ),
    );
  }
}

/// The face / edge / foreground triple for one tone, straight from the tokens.
@immutable
class _KeyPalette {
  const _KeyPalette({
    required this.face,
    required this.edge,
    required this.foreground,
    required this.faceDisabled,
    required this.edgeDisabled,
  });

  final Color face;
  final Color edge;
  final Color foreground;
  final Color faceDisabled;
  final Color edgeDisabled;

  factory _KeyPalette.forTone(MeridianTokens t, KeyButtonTone tone) {
    switch (tone) {
      case KeyButtonTone.primary:
        return _KeyPalette(
          face: t.primary,
          edge: t.primaryEdge,
          foreground: t.primaryForeground,
          faceDisabled: t.neutralSoft,
          edgeDisabled: t.neutralRule,
        );
      case KeyButtonTone.accent:
        return _KeyPalette(
          face: t.accent,
          edge: t.accentEdge,
          foreground: t.accentForeground,
          faceDisabled: t.neutralSoft,
          edgeDisabled: t.neutralRule,
        );
      case KeyButtonTone.danger:
        return _KeyPalette(
          face: t.danger,
          edge: t.dangerEdge,
          foreground: t.dangerForeground,
          faceDisabled: t.neutralSoft,
          edgeDisabled: t.neutralRule,
        );
      case KeyButtonTone.ghost:
        return _KeyPalette(
          face: t.neutralSoft,
          // No edge and no travel — see KeyButtonTone.ghost.
          edge: t.neutralSoft,
          foreground: t.ink1,
          faceDisabled: t.neutralSoft,
          edgeDisabled: t.neutralSoft,
        );
    }
  }
}
