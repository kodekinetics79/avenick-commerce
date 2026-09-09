import 'package:flutter/material.dart';

import 'tokens.g.dart';

/// The motion system, read from [MeridianTokens] and filtered through the
/// user's reduced-motion setting.
///
/// Two rules run through everything here.
///
/// **Asymmetry.** An exit is faster than an entrance and it happens first. The
/// outgoing thing has already been decided about; the incoming thing is being
/// read for the first time and needs the extra beat. Symmetric transitions look
/// mechanical for exactly this reason — they give the same weight to a thing
/// leaving and a thing arriving, and those are not the same event.
///
/// **Reduced motion is not "no motion".** [MediaQueryData.disableAnimations]
/// zeroes *travel* and *stagger* — the vestibular triggers. It does NOT zero
/// opacity and colour, because a user who has asked for less motion has not
/// asked to lose all feedback that a button was pressed or a panel changed.
/// Killing everything is the failure mode this class exists to prevent.
@immutable
class MeridianMotion {
  const MeridianMotion({
    required this.tokens,
    required this.reduced,
  });

  /// Read the motion system for the current context.
  factory MeridianMotion.of(BuildContext context) {
    return MeridianMotion(
      tokens: Theme.of(context).extension<MeridianTokens>()!,
      reduced: MediaQuery.maybeDisableAnimationsOf(context) ?? false,
    );
  }

  final MeridianTokens tokens;

  /// The user has asked the platform for reduced motion.
  final bool reduced;

  // --- Durations ---------------------------------------------------------

  /// Press / release feedback. 90ms — below this a press reads as a glitch,
  /// above it as lag.
  Duration get press => _scale(tokens.tPress);

  /// Hover and focus. 140ms.
  Duration get hover => _scale(tokens.tHover);

  /// A panel, accordion, or in-place content swap. 220ms.
  Duration get panel => _scale(tokens.tPanel);

  /// A layer arriving over the app: sheet, dialog, drawer. 320ms.
  Duration get layer => _scale(tokens.tLayer);

  /// The exit half of a transition. ~150ms — deliberately shorter than
  /// [entrance], and it runs first.
  Duration get exit => _scale(tokens.dur2 + const Duration(milliseconds: 10));

  /// The entrance half. ~210ms, and it starts once the exit is essentially
  /// done. See [entranceDelay].
  Duration get entrance => _scale(tokens.dur3 - const Duration(milliseconds: 10));

  /// How long the entrance waits behind the exit.
  ///
  /// Not the full exit duration — the last few milliseconds of a fade are below
  /// the perceptual floor, so overlapping them keeps the sequence from feeling
  /// like two separate events. Zero under reduced motion, where there is no
  /// travel to sequence.
  Duration get entranceDelay =>
      reduced ? Duration.zero : Duration(microseconds: (exit.inMicroseconds * 0.72).round());

  /// The per-item delay in a staggered list.
  ///
  /// **Zero under reduced motion.** A stagger is a wave of movement across the
  /// screen and it is one of the strongest vestibular triggers in a UI.
  Duration get stagger => reduced ? Duration.zero : _scale(tokens.stagger);

  Duration _scale(Duration d) {
    final double s = tokens.motionScale;
    if (s == 1.0) return d;
    return Duration(microseconds: (d.inMicroseconds * s).round());
  }

  // --- Curves ------------------------------------------------------------

  /// The default outgoing curve — decelerate hard into rest.
  Curve get easeOut => tokens.easeOut;

  /// The workhorse for anything that both starts and stops on screen.
  Curve get standard => tokens.easeStandard;

  /// Drawers and sheets.
  Curve get drawer => tokens.easeDrawer;

  /// The exit curve — accelerates away. `cubic(.4,0,1,1)` has no deceleration
  /// at all, which is right: a thing leaving does not need to be watched land.
  Curve get exitCurve => tokens.easeExit;

  /// A measured overshoot for a thing that lands with authority.
  Curve get overshoot => tokens.easeOvershoot;

  /// The real sampled spring from `linear()` in the stylesheet, overshoot and
  /// settle intact. Not [Curves.elasticOut] wearing its name.
  Curve get spring => tokens.easeSpring;

  // --- Travel ------------------------------------------------------------

  /// Vertical travel for an element rising into place, in logical pixels.
  ///
  /// **Zeroed under reduced motion** — this is the movement itself. The opacity
  /// transition that accompanies it is not zeroed, so the element still fades
  /// in and the user still sees that something arrived.
  double get liftY => reduced ? 0.0 : tokens.liftY;

  /// Vertical travel for a press. Zeroed under reduced motion; the colour and
  /// opacity change that go with it are not.
  double get pressY => reduced ? 0.0 : tokens.pressY;

  /// The key-cap depth — the solid edge a filled button sits on, and therefore
  /// exactly how far its face travels when pressed.
  ///
  /// **Not zeroed under reduced motion**, unlike [pressY]. This is not travel
  /// across the screen; it is a 3px contact event under the user's own finger,
  /// entirely within the button's own bounds, and it is the only feedback a
  /// key-edge button gives. Removing it would leave the press silent.
  double get keyDepth => tokens.keyDepth;

  /// The stagger delay for item [index].
  Duration staggerFor(int index) =>
      stagger == Duration.zero ? Duration.zero : stagger * index;

  /// A page transition built from the system: exit first, entrance behind it,
  /// travel suppressed under reduced motion but opacity kept.
  Widget buildPageTransition(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final Animation<double> fade = CurvedAnimation(
      parent: animation,
      curve: Interval(
        entranceDelay.inMicroseconds / (entranceDelay + entrance).inMicroseconds,
        1.0,
        curve: standard,
      ),
      reverseCurve: exitCurve,
    );

    if (reduced) {
      // Opacity survives. Travel does not.
      return FadeTransition(opacity: fade, child: child);
    }

    return FadeTransition(
      opacity: fade,
      child: SlideTransition(
        position: Tween<Offset>(
          // Fractional and vertical: a horizontal page slide would have to
          // mirror under RTL, and nothing here mirrors.
          begin: const Offset(0.0, 0.012),
          end: Offset.zero,
        ).animate(CurvedAnimation(parent: animation, curve: easeOut)),
        child: child,
      ),
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MeridianMotion && other.tokens == tokens && other.reduced == reduced;

  @override
  int get hashCode => Object.hash(tokens, reduced);
}

/// [PageTransitionsBuilder] wired to [MeridianMotion] so `Navigator` and
/// `go_router` inherit the system instead of Material's defaults.
class MeridianPageTransitionsBuilder extends PageTransitionsBuilder {
  const MeridianPageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T>? route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    return MeridianMotion.of(context)
        .buildPageTransition(context, animation, secondaryAnimation, child);
  }
}
