"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A slim animated top-bar progress indicator that fires immediately
 * on Next.js client-side navigations. It intercepts <a> clicks and
 * the router pathname/search changes to show progress.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPathRef = React.useRef(pathname + searchParams.toString());

  // Start the progress bar
  const start = React.useCallback(() => {
    setLoading(true);
    setProgress(0);

    // Clear any existing timer
    if (timerRef.current) clearInterval(timerRef.current);

    // Rapidly move to ~85% then slow down
    let p = 0;
    timerRef.current = setInterval(() => {
      p += Math.max(1, (90 - p) * 0.08);
      if (p >= 90) p = 90;
      setProgress(p);
    }, 50);
  }, []);

  // Finish the progress bar
  const finish = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setProgress(100);
    setTimeout(() => {
      setLoading(false);
      setProgress(0);
    }, 300);
  }, []);

  // Detect route changes to stop the bar
  React.useEffect(() => {
    const current = pathname + searchParams.toString();
    if (prevPathRef.current !== current) {
      finish();
      prevPathRef.current = current;
    }
  }, [pathname, searchParams, finish]);

  // Intercept all <a> clicks on internal links
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Skip external links, hash-only links, mailto, tel, etc.
      if (
        href.startsWith("http") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("#") ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey
      ) {
        return;
      }

      // Don't trigger if it's the same page
      const current = pathname + (searchParams.toString() ? "?" + searchParams.toString() : "");
      if (href === current || href === pathname) return;

      start();
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname, searchParams, start]);

  if (!loading && progress === 0) return null;

  return (
    <>
      {/* Slim progress bar at the very top of the viewport */}
      <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px]">
        <div
          className="h-full bg-gradient-to-r from-primary via-accent to-primary shadow-[0_0_10px_rgba(99,102,241,0.7),0_0_5px_rgba(99,102,241,0.4)]"
          style={{
            width: `${progress}%`,
            transition: progress === 100 ? "width 0.3s ease-out, opacity 0.3s ease" : "width 0.1s linear",
            opacity: progress === 100 ? 0 : 1,
          }}
        />
      </div>

      {/* Subtle full-screen overlay */}
      <div
        className="fixed inset-0 z-[9998] pointer-events-none"
        style={{
          backgroundColor: "rgba(0,0,0,0.02)",
          opacity: loading ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      />
    </>
  );
}
