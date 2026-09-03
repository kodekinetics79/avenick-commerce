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
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:start-3 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white focus:shadow-elevated"
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
