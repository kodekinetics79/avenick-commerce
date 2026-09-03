"use client";

import { useEffect } from "react";

/**
 * Root-layout failure boundary for the admin console. It renders its own
 * document, which means the app stylesheet has not loaded and NO token, utility
 * or primitive from the design system is available here — this is the one file
 * in the console where raw values are correct rather than a violation.
 *
 * They are still written to the system's rules. The palette is the same warm
 * ground and ink ramp expressed literally, it answers to both themes through a
 * `prefers-color-scheme` block in a real <style> element (an inline style
 * attribute cannot carry a media query), the type steps are the system's own,
 * and the digest is set in mono because it is an identifier.
 *
 * Round one put a 56px amber-to-orange gradient tile with a ⚠️ emoji in it above
 * the headline. An emoji renders as a different picture on every platform, is
 * announced by a screen reader as "warning sign", and is the single least
 * authoritative thing that could sit at the top of a failure screen on a trade
 * platform.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[admin] global error", { message: error.message, digest: error.digest });
  }, [error]);

  const css = `
    :root {
      color-scheme: light dark;
      --g-bg: hsl(36 20% 97.5%);
      --g-surface: hsl(0 0% 100%);
      --g-ink-1: hsl(222 24% 12%);
      --g-ink-2: hsl(220 12% 32%);
      --g-ink-3: hsl(220 11% 41%);
      --g-line: hsl(220 14% 88%);
      --g-brass: hsl(36 42% 46%);
      --g-ring: hsl(248 66% 58%);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --g-bg: hsl(232 18% 4%);
        --g-surface: hsl(232 13% 11%);
        --g-ink-1: hsl(220 22% 96%);
        --g-ink-2: hsl(224 12% 78%);
        --g-ink-3: hsl(226 10% 65%);
        --g-line: hsl(230 12% 22%);
        --g-brass: hsl(36 44% 62%);
        --g-ring: hsl(248 70% 70%);
      }
    }
    * { box-sizing: border-box }
    body {
      margin: 0;
      background: var(--g-bg);
      color: var(--g-ink-1);
      font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      font-size: 15px;
      line-height: 24px;
    }
    .g-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px }
    .g-plate {
      max-width: 34rem; width: 100%;
      background: var(--g-surface);
      border: 1px solid var(--g-line);
      border-radius: 12px;
      padding: 28px;
      /* One overhead light, zero x-offset — the invariant the whole system
         rests on, and the reason none of this needs mirroring in Arabic. */
      box-shadow: 0 1px 1px hsl(226 40% 10% / .05), 0 8px 18px -8px hsl(226 40% 10% / .10);
    }
    /* The brass rule: the same mark the console draws beside its active nav
       item, its empty states and its committed rows. */
    .g-rule { width: 48px; height: 2px; background: var(--g-brass); border-radius: 2px; margin-bottom: 18px }
    .g-eyebrow { font-size: 11px; line-height: 16px; letter-spacing: .06em; text-transform: uppercase; font-weight: 600; color: var(--g-ink-3); margin: 0 0 6px }
    h1 { font-size: 24px; line-height: 1.14; letter-spacing: -.016em; font-weight: 600; margin: 0 0 10px }
    p { margin: 0 0 18px; color: var(--g-ink-2) }
    button {
      height: 32px; padding: 0 18px; border-radius: 8px;
      border: 1px solid var(--g-line); background: var(--g-surface);
      color: var(--g-ink-1); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer;
    }
    button:focus-visible { outline: 2px solid var(--g-ring); outline-offset: 2px }
    .g-ref { font-size: 12px; line-height: 18px; color: var(--g-ink-3); margin: 18px 0 0 }
    .g-mono { font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace }
  `;

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        <div className="g-wrap">
          <div className="g-plate">
            <div className="g-rule" aria-hidden="true" />
            <p className="g-eyebrow">Console not loaded</p>
            <h1>The admin console failed before any screen could render.</h1>
            {/* NOT "nothing was written". This boundary knows the document
                failed to render; it does not know what any earlier request
                reached the platform with. It states only what is knowable. */}
            <p>
              Retrying reloads the console. If it fails again, the reference below is what platform operations will
              ask for.
            </p>
            <button type="button" onClick={reset}>
              Try again
            </button>
            {error.digest && (
              <p className="g-ref">
                Reference <span className="g-mono">{error.digest}</span>
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
