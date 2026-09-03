"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button, Dateline, Divider, Eyebrow, Surface } from "@avenick/ui";

/**
 * The record of what a bulk action or a CSV import actually did.
 *
 * A toast that disappears in four seconds is the wrong place for "these six of
 * your twenty listings were refused, and here is which and why" — the seller
 * cannot act on a sentence that has already gone. The report stays on the page,
 * next to the table it describes, until it is dismissed, and every refused row
 * is named individually with a link to the listing that has to change.
 */
export interface ActionReportLine {
  key: string;
  /** The identifier of the thing refused — a SKU, or a product name. */
  label: string;
  /** Why, in the seller's words. */
  detail: string;
  /** Where the seller goes to fix it, when there is such a place. */
  href?: string;
}

export interface ActionReportData {
  tone: "success" | "warning" | "danger";
  headline: string;
  /** What the figures above are counted from, in the provenance voice. */
  dateline: string;
  /** Micro-caps heading over the per-row list. */
  linesTitle?: string;
  lines: ActionReportLine[];
  /** A sentence about something the platform did not account for. */
  note?: string;
}

export function ActionReport({
  report,
  onDismiss,
  linkComponent: LinkComp = "a",
}: {
  report: ActionReportData;
  onDismiss: () => void;
  linkComponent?: React.ElementType;
}) {
  const panelRef = React.useRef<HTMLElement>(null);
  const listLabelId = React.useId();

  /**
   * Take the focus when a result arrives.
   *
   * The bulk bar unmounts the moment its action lands, so a seller who pressed
   * Pause from the keyboard would otherwise be dropped back onto <body> with no
   * idea where they are. Moving focus here puts them on the record of what the
   * platform just did, which is the next thing they need to read anyway, and it
   * is the only place in this surface that takes focus without being asked.
   */
  React.useEffect(() => {
    panelRef.current?.focus();
  }, [report]);

  return (
    // role="status": the outcome of an action the seller just took, announced
    // once. It is not an alert — nothing here interrupts.
    <Surface
      ref={panelRef}
      rung={2}
      tone={report.tone}
      role="status"
      tabIndex={-1}
      // u-focus rather than a bare tabindex: when focus is moved programmatically
      // from a keyboard-focused control the platform keeps :focus-visible
      // matching, so a keyboard seller sees the ring land here and a mouse seller
      // is not shown a ring they did not ask for.
      className="u-focus overflow-hidden"
    >
      <div className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <Eyebrow className="mb-1">Result</Eyebrow>
          <p className="u-h3 text-ink-1">{report.headline}</p>
          <Dateline className="mt-1">{report.dateline}</Dateline>
          {report.note && <p className="u-ui mt-2 max-w-prose text-ink-2">{report.note}</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={onDismiss} aria-label="Dismiss this result">
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {report.lines.length > 0 && (
        <>
          <Divider tone="hairline" />
          <div className="px-4 pb-4 pt-3">
            <Eyebrow className="mb-2" id={listLabelId}>
              {report.linesTitle ?? "Not changed"}
            </Eyebrow>
            {/* The scroll container carries its own tab stop: on a member
                without catalog.manage none of the lines below is a link, so
                without this a keyboard seller could not reach the refusals past
                the fold. It wraps the list rather than being the list, so the
                rows keep their list semantics. */}
            <div
              tabIndex={0}
              role="group"
              aria-labelledby={listLabelId}
              className="u-focus max-h-64 overflow-y-auto scrollbar-thin"
            >
              <ul>
              {report.lines.map((line) => (
                <li
                  key={line.key}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-hairline py-2 last:border-b-0"
                >
                  {line.href ? (
                    <LinkComp
                      href={line.href}
                      className="u-focus u-mono rounded-nested text-meta font-medium text-primary-ink hover:underline"
                    >
                      {line.label}
                    </LinkComp>
                  ) : (
                    <span className="u-mono text-meta font-medium text-ink-1">{line.label}</span>
                  )}
                  <span className="u-ui text-ink-2">{line.detail}</span>
                </li>
              ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </Surface>
  );
}
