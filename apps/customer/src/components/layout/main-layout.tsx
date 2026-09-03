import { ScrollProgress } from "@avenick/ui";
import { Header } from "./header";
import { Footer } from "./footer";
import { SkipLink } from "./skip-link";

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/*
        The reading hairline: a 2px brass rule that draws itself across the top
        of the viewport from the inline start as the document scrolls. Zero
        JavaScript and zero scroll listeners — it is a scaleX on a scroll-driven
        CSS timeline running on the compositor, its transform-origin is the
        --origin-inline-start token so it draws from the right in Arabic for
        free, and it is THE SAME BRASS RULE as active nav, the section marks, the
        certificate's top edge and the hero's mid plane. One gesture in different
        postures is what makes a system read as designed rather than assembled.

        Where scroll timelines are unsupported it stays at scaleX(0) — invisible —
        which is the correct degradation for a purely decorative progress hint,
        and it is aria-hidden because the scrollbar already tells assistive
        technology this.
      */}
      <ScrollProgress />

      <SkipLink />
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
