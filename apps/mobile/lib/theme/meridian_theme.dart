import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'motion.dart';
import 'tokens.g.dart';
import 'typography.dart';

/// Builds [ThemeData] for the Meridian/SIJILL system.
///
/// Every colour, radius, duration and type step below comes out of
/// [MeridianTokens], which is generated from `packages/ui/src/globals.css`.
/// There is not one literal colour in this file, and
/// `test/design_lint_test.dart` fails the build if one appears anywhere outside
/// `tokens.g.dart`.
abstract final class MeridianTheme {
  /// The viewport the fluid type ramp was solved against at its small end.
  /// Used only when a real width is not yet available.
  static const double fallbackViewportWidth = 390.0;

  static ThemeData light({double viewportWidth = fallbackViewportWidth}) =>
      _build(MeridianTokens.light, Brightness.light, viewportWidth);

  static ThemeData dark({double viewportWidth = fallbackViewportWidth}) =>
      _build(MeridianTokens.dark, Brightness.dark, viewportWidth);

  static ThemeData _build(MeridianTokens t, Brightness brightness, double viewportWidth) {
    final MeridianTypography type = MeridianTypography.resolve(
      t,
      script: MeridianScript.latin,
      viewportWidthPx: viewportWidth,
      color: t.ink1,
    );

    final ColorScheme scheme = ColorScheme(
      brightness: brightness,
      primary: t.primary,
      onPrimary: t.primaryForeground,
      primaryContainer: t.primarySoft,
      onPrimaryContainer: t.primaryInk,
      secondary: t.accent,
      onSecondary: t.accentForeground,
      secondaryContainer: t.accentSoft,
      onSecondaryContainer: t.accentInk,
      tertiary: t.brass,
      onTertiary: t.inkInv,
      tertiaryContainer: t.neutralSoft,
      onTertiaryContainer: t.brassInk,
      error: t.danger,
      onError: t.dangerForeground,
      errorContainer: t.dangerSoft,
      onErrorContainer: t.dangerInk,
      surface: t.surface2,
      onSurface: t.ink1,
      surfaceContainerLowest: t.surfaceSunken,
      surfaceContainerLow: t.surface0,
      surfaceContainer: t.surface1,
      surfaceContainerHigh: t.surface2,
      surfaceContainerHighest: t.surface3,
      onSurfaceVariant: t.ink2,
      outline: t.border,
      outlineVariant: t.hairline,
      shadow: t.shadow,
      scrim: t.scrim,
      inverseSurface: t.ink1,
      onInverseSurface: t.inkInv,
      inversePrimary: t.primaryInk,
      surfaceTint: t.primary,
    );

    final TextTheme textTheme = _textTheme(type);

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      extensions: <ThemeExtension<dynamic>>[t],

      scaffoldBackgroundColor: t.surface0,
      canvasColor: t.surface0,
      dividerColor: t.hairline,
      shadowColor: t.shadow,
      // Material 3 tints elevated surfaces with the primary colour. Meridian
      // separates rungs with fill and shadow, not with a hue wash, and a green
      // tint creeping into a white card is not in the system.
      applyElevationOverlayColor: false,

      fontFamily: t.fontSans,
      textTheme: textTheme,
      primaryTextTheme: textTheme,

      // No ripple, anywhere. See KeyButton: a ripple and a press are two
      // different physical claims about the same object, and this system has
      // already committed to the press.
      splashFactory: NoSplash.splashFactory,
      highlightColor: Colors.transparent,
      splashColor: Colors.transparent,

      pageTransitionsTheme: const PageTransitionsTheme(
        builders: <TargetPlatform, PageTransitionsBuilder>{
          TargetPlatform.android: MeridianPageTransitionsBuilder(),
          TargetPlatform.iOS: MeridianPageTransitionsBuilder(),
          TargetPlatform.macOS: MeridianPageTransitionsBuilder(),
          TargetPlatform.linux: MeridianPageTransitionsBuilder(),
          TargetPlatform.windows: MeridianPageTransitionsBuilder(),
          TargetPlatform.fuchsia: MeridianPageTransitionsBuilder(),
        },
      ),

      dividerTheme: DividerThemeData(
        color: t.hairline,
        thickness: 1.0,
        space: 1.0,
      ),

      appBarTheme: AppBarTheme(
        backgroundColor: t.surface0,
        foregroundColor: t.ink1,
        surfaceTintColor: Colors.transparent,
        elevation: 0.0,
        scrolledUnderElevation: 0.0,
        centerTitle: false,
        titleTextStyle: type.h3,
        toolbarHeight: t.controlHLg + t.chromePad,
        systemOverlayStyle: brightness == Brightness.light
            ? SystemUiOverlayStyle.dark
            : SystemUiOverlayStyle.light,
      ),

      cardTheme: CardThemeData(
        color: t.surface2,
        surfaceTintColor: Colors.transparent,
        shadowColor: t.shadow,
        elevation: 0.0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(t.radius),
          side: BorderSide(color: t.hairline),
        ),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        // A field is a well: rung 1, recessed. Fill and hairline only.
        fillColor: t.surfaceSunken,
        hintStyle: type.body.copyWith(color: t.ink3),
        labelStyle: type.ui.copyWith(color: t.ink2),
        helperStyle: type.meta.copyWith(color: t.ink3),
        errorStyle: type.meta.copyWith(color: t.dangerInk),
        contentPadding: EdgeInsetsDirectional.symmetric(
          horizontal: t.spaceTight + t.spaceUnit,
          vertical: t.spaceTight + t.spaceUnit,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(t.radiusSm),
          borderSide: BorderSide(color: t.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(t.radiusSm),
          borderSide: BorderSide(color: t.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(t.radiusSm),
          borderSide: BorderSide(color: t.ring, width: t.ringWidth),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(t.radiusSm),
          borderSide: BorderSide(color: t.dangerRule),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(t.radiusSm),
          borderSide: BorderSide(color: t.danger, width: t.ringWidth),
        ),
      ),

      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: t.surfaceFloat,
        surfaceTintColor: Colors.transparent,
        modalBarrierColor: t.scrim.withValues(alpha: t.scrimAlpha),
        elevation: 0.0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(t.radiusLg)),
        ),
      ),

      dialogTheme: DialogThemeData(
        backgroundColor: t.surfaceFloat,
        surfaceTintColor: Colors.transparent,
        elevation: 0.0,
        titleTextStyle: type.h3,
        contentTextStyle: type.body.copyWith(color: t.ink2),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(t.radiusLg),
        ),
      ),

      snackBarTheme: SnackBarThemeData(
        backgroundColor: t.ink1,
        contentTextStyle: type.ui.copyWith(color: t.inkInv),
        actionTextColor: t.primaryInk,
        behavior: SnackBarBehavior.floating,
        elevation: 0.0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(t.radiusSm),
        ),
      ),

      chipTheme: ChipThemeData(
        backgroundColor: t.neutralSoft,
        selectedColor: t.primarySoft,
        labelStyle: type.ui,
        side: BorderSide(color: t.neutralRule),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(t.radiusPill),
        ),
      ),

      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: t.primary,
        linearTrackColor: t.neutralSoft,
        circularTrackColor: t.neutralSoft,
      ),

      listTileTheme: ListTileThemeData(
        minVerticalPadding: t.spaceTight,
        titleTextStyle: type.body,
        subtitleTextStyle: type.meta.copyWith(color: t.ink3),
        iconColor: t.ink2,
      ),

      iconTheme: IconThemeData(color: t.ink2, size: 20.0),
      primaryIconTheme: IconThemeData(color: t.ink1, size: 20.0),

      textSelectionTheme: TextSelectionThemeData(
        cursorColor: t.primary,
        selectionColor: t.primary.withValues(alpha: t.stateHover * 2),
        selectionHandleColor: t.primary,
      ),

      navigationBarTheme: NavigationBarThemeData(
        // OPAQUE. See TabScaffold for why this is not a glass surface.
        backgroundColor: t.surface2,
        surfaceTintColor: Colors.transparent,
        indicatorColor: t.primarySoft,
        elevation: 0.0,
        height: t.rowH + t.spaceStack,
        labelTextStyle: WidgetStatePropertyAll<TextStyle>(type.micro),
      ),
    );
  }

  static TextTheme _textTheme(MeridianTypography type) => TextTheme(
        displayLarge: type.display,
        displayMedium: type.display,
        displaySmall: type.h1,
        headlineLarge: type.h1,
        headlineMedium: type.h2,
        headlineSmall: type.h3,
        titleLarge: type.h3,
        titleMedium: type.ui,
        titleSmall: type.ui,
        bodyLarge: type.body,
        bodyMedium: type.body,
        bodySmall: type.meta,
        labelLarge: type.ui,
        labelMedium: type.meta,
        labelSmall: type.micro,
      );
}

/// Ergonomics: `context.tokens`, `context.type`, `context.motion`.
extension MeridianContext on BuildContext {
  /// The design tokens for the active theme.
  MeridianTokens get tokens => Theme.of(this).extension<MeridianTokens>()!;

  /// The motion system for the active theme, already filtered through the
  /// user's reduced-motion setting.
  MeridianMotion get motion => MeridianMotion.of(this);

  /// The type ramp for the active theme, the current locale's script, and the
  /// **real** viewport width — so a fluid heading is genuinely larger on a
  /// tablet than on a phone.
  ///
  /// Reading this rebuilds the ramp; hold it in a local rather than calling it
  /// once per `Text`.
  MeridianTypography get type {
    final MeridianTokens t = tokens;
    final Locale locale = Localizations.maybeLocaleOf(this) ?? const Locale('en');
    return MeridianTypography.resolve(
      t,
      script: locale.languageCode == 'ar' ? MeridianScript.arabic : MeridianScript.latin,
      viewportWidthPx: MediaQuery.sizeOf(this).width,
      color: t.ink1,
    );
  }
}
