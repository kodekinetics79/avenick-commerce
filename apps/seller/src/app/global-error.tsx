"use client";

import { useEffect } from "react";
import { brandMarkDocument } from "@avenick/ui/brand-mark-geometry";
import { platformName } from "@avenick/utils/portal-config";

/**
 * Root-layout failure boundary for Seller Central. It renders its own document,
 * which means the app stylesheet has NOT loaded and no token, utility or
 * primitive from the design system is available — this is one of the three files
 * in the product where raw values are correct rather than a violation. It is
 * modelled on apps/admin/src/app/global-error.tsx, which reached this shape
 * first; a second dialect of last-resort screen would be exactly the "ten new
 * signatures instead of one extended one" failure of §10.13.
 *
 * WHAT CHANGED. Round one put a 56px `linear-gradient(135deg,#f59e0b,#ea580c)`
 * tile with a ⚠️ emoji in it above the headline. An emoji renders as a different
 * picture on every platform, is announced by a screen reader as "warning sign",
 * and is the least authoritative thing that could sit at the top of a failure
 * screen on a trade platform. The button was `#2563eb` — the pre-green primary,
 * a colour this product stopped using, still being painted on the one screen
 * nobody reviews.
 *
 * THE MARK IS AN INLINE data: URI, not a linked file. There is no stylesheet
 * here and there may be no working network path to our own origin; a <link> or a
 * remote <img> would leave a broken-image box where the brand should be. It is
 * flattened for the same reason the favicon is — no var(), no @media inside the
 * document — and it comes from the one geometry module, so it cannot drift from
 * the mark in the header.
 *
 * THE COPY IS ENGLISH, unlike the storefront's. This boundary replaces the
 * document, so there is no next-intl provider and no locale in scope; the
 * storefront stacks both scripts because a shopper may be reading either. A
 * supplier reaches Seller Central through a sign-in page that is itself still
 * English, so a second script here would be the only Arabic they had seen.
 * When that login is translated, this follows it.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[seller] global error", { message: error.message, digest: error.digest });
  }, [error]);

  const name = platformName();
  // Percent-encoded, not base64. This component renders on the server AND in the
  // browser: `Buffer` is not reliably in the client bundle, and `btoa` throws on
  // any non-Latin-1 codepoint — which a configured Arabic platform name is. This
  // form needs neither and is identical in both environments.
  const mark = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    brandMarkDocument({ size: 40, title: name, theme: "light" }),
  )}`;

  const css = `
    :root {
      color-scheme: light dark;
      --g-bg: hsl(36 20% 97.5%);
      --g-surface: hsl(0 0% 100%);
      --g-ink-1: hsl(224 22% 11%);
      --g-ink-2: hsl(220 12% 32%);
      --g-ink-3: hsl(220 11% 41%);
      --g-line: hsl(220 14% 88%);
      --g-brass: hsl(36 56% 42%);
      --g-ring: hsl(150 92% 26%);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --g-bg: hsl(232 18% 4%);
        --g-surface: hsl(232 13% 11%);
        --g-ink-1: hsl(40 14% 94%);
        --g-ink-2: hsl(224 12% 78%);
        --g-ink-3: hsl(226 10% 65%);
        --g-line: hsl(230 12% 22%);
        --g-brass: hsl(38 62% 60%);
        --g-ring: hsl(150 66% 46%);
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
    .g-mark { display: block; width: 40px; height: 40px; margin-bottom: 16px }
    /* The brass rule: the same gesture the storefront draws beside its active
       nav item, and the same one the mark carries across its own entry. */
    .g-rule { width: 48px; height: 2px; background: var(--g-brass); border-radius: 2px; margin-bottom: 18px }
    h1 { font-size: 24px; line-height: 1.14; letter-spacing: -.016em; font-weight: 600; margin: 0 0 10px }
    p { margin: 0 0 14px; color: var(--g-ink-2) }
    button {
      height: 36px; padding: 0 18px; border-radius: 8px;
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="g-mark" src={mark} width={40} height={40} alt={name} />
            <div className="g-rule" aria-hidden="true" />
            <h1>Seller Central could not finish loading.</h1>
            {/* NOT "nothing was saved". This boundary knows the document failed
                to render; it does not know what any earlier request reached the
                platform with. It states only what is knowable. */}
            <p>
              Retrying reloads the page. If it fails again, the reference below is what platform operations will ask
              for.
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
