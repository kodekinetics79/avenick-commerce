import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/auth_state.dart';
import 'app/router.dart';
import 'theme/meridian_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: AvenickApp()));
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

      locale: null, // follow the device
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
        // Text scaling is honoured but bounded. Above ~1.3 the fluid ramp and
        // the fixed control heights from the tokens stop agreeing and labels
        // start clipping inside 38px buttons; the cap keeps the system legible
        // rather than broken. Raising it means auditing controlH* first.
        final MediaQueryData mq = MediaQuery.of(context);
        return MediaQuery(
          data: mq.copyWith(
            textScaler: mq.textScaler.clamp(minScaleFactor: 1.0, maxScaleFactor: 1.3),
          ),
          child: child ?? const SizedBox.shrink(),
        );
      },
    );
  }
}
