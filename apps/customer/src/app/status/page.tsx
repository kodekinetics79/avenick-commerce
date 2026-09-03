"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { platformName } from "@avenick/utils/portal-config";
import { Dateline, Divider, Eyebrow, StatusPill, Surface, type PillTone } from "@avenick/ui";
import { toIdentityLocale } from "../auth/identity-copy";
import { accountCopy } from "../account/account-copy";

// Deliberately standalone: no MainLayout, no backend data layer, no shared data
// fetching. A status page must render even when the rest of the app is degraded,
// so it only calls the lightweight public /api/status endpoint and nothing else.
//
// It does use the design system's tokens and four of its primitives, and it
// reads the locale from the provider the root layout mounts. That is not a new
// dependency in the sense the rule above protects: the stylesheet is inlined by
// the root layout on every route and the provider is mounted by the same layout,
// so if either were unavailable this page would not be rendering at all. The
// alternative was the hardcoded #16a34a / #e5e7eb / #6b7280 palette this file
// used to carry, which had no dark-mode values and rendered as light-grey chrome
// on a dark ground — and an English-only page in an Arabic build.

type ComponentStatus = "operational" | "degraded" | "down" | "unverified" | "not_configured";

interface StatusComponent {
  name: string;
  status: ComponentStatus;
  kind?: "process" | "journey" | "integration";
  detail?: string;
}
interface StatusSummary {
  status: ComponentStatus;
  processStatus: ComponentStatus;
  journeyStatus: ComponentStatus;
  app: string;
  components: StatusComponent[];
  uptimeSeconds: number;
  timestamp: string;
}

/**
 * Five states, four tones. "Unverified" and "not configured" share the neutral
 * tone deliberately: neither is a failure, and colouring an unmeasured thing
 * green or red would be the page asserting something it does not know.
 */
const TONE: Record<ComponentStatus, PillTone> = {
  operational: "success",
  degraded: "warning",
  down: "danger",
  unverified: "neutral",
  not_configured: "neutral",
};

/** The poll interval, stated once so the line at the foot cannot drift from it. */
const REFRESH_MS = 15_000;

export default function StatusPage() {
  const locale = toIdentityLocale(useLocale());
  const t = accountCopy(locale).status;
  const [data, setData] = useState<StatusSummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        const json = (await res.json()) as StatusSummary;
        if (active) {
          setData(json);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      }
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  // Never default to "operational". Before the first successful poll, and for
  // any response that omits a field, the honest answer is that we do not know.
  const processStatus: ComponentStatus = error ? "down" : (data?.processStatus ?? "unverified");
  const journeyStatus: ComponentStatus = error ? "unverified" : (data?.journeyStatus ?? "unverified");
  const label = (s: ComponentStatus) => t.labels[s] ?? s;

  return (
    <div className="mx-auto max-w-2xl px-5 py-block">
      {/* The masthead. Two levers separate it from everything below — size and
          family — plus the brass rule that separates it in space, which is the
          same .u-drawn gesture as active nav and the certificate's top edge. */}
      <Divider drawn on className="w-14" />
      <Eyebrow className="mt-4">{platformName()}</Eyebrow>
      {/* THE FAMILY IS PER-DIRECTION, not per-page. `.u-display` deliberately
          sets no font-family, so it inherits the body face the [dir] block
          already chose. Pinning `font-display` on its own resolved to
          --font-display, which is Inter — ZERO Arabic coverage — and with
          `font-synthesis: none` set under [dir="rtl"] the Arabic title fell all
          the way through to a system face while every other heading on the page
          stayed Plex Arabic. `font-display-ar` is Noto Kufi, Arabic's own
          display register, exactly as `[dir="rtl"] .u-hero` does it. */}
      <h1 className="u-display mt-1 text-ink-1 ltr:font-display rtl:font-display-ar">{t.title}</h1>

      {/* The summary changes under the reader without any interaction, so it is
          a live region; polite, because a status flip is not an interruption.
          The one raised object on the page: it is the answer the reader came
          for, and everything below it is detail. */}
      <Surface rung={3} role="status" aria-live="polite" className="mt-7 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Scoped deliberately. "All systems operational" claimed health for
              customer journeys and integrations this endpoint never measures. */}
          <p className="u-h3 text-ink-1">
            {error ? t.unreachable : t.processHealth(label(processStatus))}
          </p>
          <StatusPill tone={TONE[processStatus]} dot>
            {label(processStatus)}
          </StatusPill>
        </div>
        <Divider className="my-4" />
        <p className="u-body text-ink-2">
          {t.journeys(label(journeyStatus))}
          {journeyStatus === "unverified" && ` — ${t.noJourneySynthetic}`}
        </p>
      </Surface>

      {data ? (
        <>
          <Eyebrow as="h2" className="mb-2 mt-block">
            {t.components}
          </Eyebrow>
          <Surface rung={2} className="overflow-hidden">
            <ul>
              {data.components.map((c) => (
                <li
                  key={c.name}
                  className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline px-4 py-3 first:border-t-0"
                >
                  <span className="u-body capitalize text-ink-1">{c.name.replace(/-/g, " ")}</span>
                  <span className="flex items-center gap-2">
                    {c.detail && <span className="u-meta text-ink-3">{c.detail}</span>}
                    <StatusPill tone={TONE[c.status]} dot>
                      {label(c.status)}
                    </StatusPill>
                  </span>
                </li>
              ))}
            </ul>
          </Surface>

          <Dateline className="mt-2">
            {t.polled(
              // Western digits in both locales — the same numeral policy the
              // whole product holds to, so a clock and a figure can sit in one
              // column. DESIGN_SYSTEM.md §2.3.
              new Date(data.timestamp).toLocaleTimeString(
                locale === "ar" ? "ar-AE-u-nu-latn" : "en-GB",
              ),
              REFRESH_MS / 1000,
            )}
          </Dateline>
        </>
      ) : (
        // Not a spinner and not a blank: the page says which of the two things
        // it does not yet know, which is the same discipline as never defaulting
        // to "operational" above.
        !error && <Dateline className="mt-block">{t.waiting}</Dateline>
      )}
    </div>
  );
}
