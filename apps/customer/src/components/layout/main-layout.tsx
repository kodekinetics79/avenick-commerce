import { Header } from "./header";
import { Footer } from "./footer";

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/*
        Skip link: the header carries a full navigation and a search field, so a
        keyboard or screen-reader user otherwise tabs through the entire chrome
        on every page before reaching the content. Visually hidden until it takes
        focus, which is what makes it usable rather than decorative.
      */}
      <a
        href="#main-content"
        // text-white was a raw colour with no dark-mode counterpart; the pair is
        // now a token pair, and the shadow is a named rung rather than the
        // deprecated `shadow-elevated` alias.
        className="u-ui sr-only focus:not-sr-only focus:absolute focus:top-3 focus:start-3 focus:z-layer focus:rounded-nested focus:bg-primary focus:px-4 focus:py-2 focus:font-medium focus:text-primary-foreground focus:shadow-elev-4"
      >
        Skip to content / تخطي إلى المحتوى
      </a>
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
