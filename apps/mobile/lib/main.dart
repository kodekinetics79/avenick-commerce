import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/auth_state.dart';
import 'app/composition.dart';
import 'app/router.dart';
import 'features/account/account.dart';
import 'theme/meridian_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // The features are inert until their ports are joined up — see composition.dart.
  runApp(appScope(child: const AvenickApp()));
}

class AvenickApp extends ConsumerStatefulWidget {
  const AvenickApp({super.key});

  @override
  ConsumerState<AvenickApp> createState() => _AvenickAppState();
}

class _AvenickAppState extends ConsumerState<AvenickApp> {
  @override
  void initState() {
    super.initState();
    // Read the session before the first redirect runs. Until this lands the
    // router sees AuthStatus.unknown and refuses to redirect, which is what
    // preserves a deep link that launched the app from cold.
    //
    // The networking engineer replaces this with a real secure-storage read.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(authControllerProvider.notifier).resolve(signedIn: false);
    });
  }

  @override
  Widget build(BuildContext context) {
    // The fluid type ramp needs a viewport width, and the theme is built ABOVE
    // MaterialApp's own MediaQuery — so read it from the view directly. Without
    // this, every clamp() in the ramp collapses to its 390px minimum and a
    // tablet renders phone headings.
    final double viewportWidth =
        MediaQueryData.fromView(View.of(context)).size.width;

    return MaterialApp.router(
      title: 'Avenick',
      debugShowCheckedModeBanner: false,
      routerConfig: ref.watch(routerProvider),

      theme: MeridianTheme.light(viewportWidth: viewportWidth),
      darkTheme: MeridianTheme.dark(viewportWidth: viewportWidth),
      themeMode: ThemeMode.system,

      // The user's own choice wins; null falls through to the device locale via
      // localeResolutionCallback below. Without this line the language picker
      // in Account only re-rendered the screens beneath it (through a scoped
      // Localizations.override) and the rest of the app stayed on the device
      // language — which reads as a setting that does not work.
      locale: ref.watch(resolvedPreferencesProvider).localeOverride,
      supportedLocales: const <Locale>[
        Locale('en'),
        Locale('ar'),
      ],
      localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
        // These three are what give Arabic its RTL Directionality, its
        // localised Material strings, and its date symbols. Without
        // GlobalWidgetsLocalizations the app renders Arabic text left-to-right.
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],

      localeResolutionCallback: (Locale? device, Iterable<Locale> supported) {
        if (device == null) return const Locale('en');
        for (final Locale l in supported) {
          if (l.languageCode == device.languageCode) return l;
        }
        // Arabic dialects — ar-AE, ar-SA, ar-EG — all resolve to `ar` rather
        // than silently falling back to English.
        return const Locale('en');
      },

      builder: (BuildContext context, Widget? child) {
        // Text scaling is honoured to 200%, because WCAG 1.4.4 asks for 200%
        // without loss of content or function and an accessibility audit reads
        // a hard cap below it as a failure, not as a design decision.
        //
        // This was 1.3, on the reasoning that labels clip inside fixed control
        // heights above it. That reasoning was sound about the CONTROLS and
        // wrong about the remedy: capping globally fixes a button by shrinking
        // every sentence in the app for the users who most need it larger. The
        // clamp belongs on the specific chrome that cannot grow — the tab bar
        // and the sticky CTA — not on content, and the account screens are
        // already tested at 2.0x.
        //
        // The ceiling stays because iOS accessibility sizes reach ~3.1x, where
        // the fluid ramp and the token control heights genuinely stop agreeing.
        // Raising it further means auditing controlH* first.
        final MediaQueryData mq = MediaQuery.of(context);
        return MediaQuery(
          data: mq.copyWith(
            textScaler: mq.textScaler.clamp(minScaleFactor: 1.0, maxScaleFactor: 2.0),
          ),
          child: child ?? const SizedBox.shrink(),
        );
      },
    );
  }
}
