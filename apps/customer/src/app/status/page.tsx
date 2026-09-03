"use client";

import { useEffect, useState } from "react";
import { platformName } from "@avenick/utils/portal-config";
import { Dateline, Eyebrow, StatusPill, Surface, type PillTone } from "@avenick/ui";

// Deliberately standalone: no MainLayout, no backend data layer, no shared data
// fetching. A status page must render even when the rest of the app is degraded,
// so it only calls the lightweight public /api/status endpoint and nothing else.
//
// It does now use the design system's tokens and three of its primitives. That
// is not a new dependency in the sense the rule above protects: the stylesheet
// is inlined by the root layout on every route, and the alternative was the
// hardcoded #16a34a / #e5e7eb / #6b7280 palette this file used to carry, which
// had no dark-mode values and rendered as light-grey chrome on a dark ground.

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
const LABEL: Record<ComponentStatus, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
  unverified: "Unverified",
  not_configured: "Not configured",
};

/** The poll interval, stated once so the line at the foot cannot drift from it. */
const REFRESH_MS = 15_000;

export default function StatusPage() {
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

  return (
    <div className="mx-auto max-w-2xl px-5 py-block">
      <Eyebrow>{platformName()}</Eyebrow>
      <h1 className="u-h1 mt-1 text-ink-1">System status</h1>

      {/* The summary changes under the reader without any interaction, so it is
          a live region; polite, because a status flip is not an interruption. */}
      <Surface rung={2} role="status" aria-live="polite" className="mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Scoped deliberately. "All systems operational" claimed health for
              customer journeys and integrations this endpoint never measures. */}
          <p className="u-h3 text-ink-1">
            {error ? "Unable to reach status endpoint" : `Process health: ${LABEL[processStatus].toLowerCase()}`}
          </p>
          <StatusPill tone={TONE[processStatus]} dot>
            {LABEL[processStatus]}
          </StatusPill>
        </div>
        <p className="u-ui mt-2 text-ink-2">
          Customer journeys: {LABEL[journeyStatus].toLowerCase()}
          {journeyStatus === "unverified" && " — no journey synthetic has run against this deployment"}
        </p>
      </Surface>

      {data && (
        <>
          <Eyebrow as="h2" className="mb-2 mt-block">
            Components
          </Eyebrow>
          <Surface rung={2} className="overflow-hidden">
            <ul>
              {data.components.map((c) => (
                <li
                  key={c.name}
                  className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline px-4 py-3 first:border-t-0"
                >
                  <span className="u-ui capitalize text-ink-1">{c.name.replace(/-/g, " ")}</span>
                  <span className="flex items-center gap-2">
                    {c.detail && <span className="u-meta text-ink-3">{c.detail}</span>}
                    <StatusPill tone={TONE[c.status]} dot>
                      {LABEL[c.status]}
                    </StatusPill>
                  </span>
                </li>
              ))}
            </ul>
          </Surface>

          <Dateline className="mt-2">
            {`Last polled ${new Date(data.timestamp).toLocaleTimeString()} · refreshed every ${REFRESH_MS / 1000}s`}
          </Dateline>
        </>
      )}
    </div>
  );
}
