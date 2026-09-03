import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Dateline, Eyebrow, StatusPill, Surface } from "@avenick/ui";
import { cn } from "@avenick/utils";

/**
 * The compare-and-swap refusal, as a designed element.
 *
 * Every decision surface in this console writes through a transaction that
 * compares against the row's current state: approveProduct/rejectProduct throw
 * ProductNotPendingError, and the seller and document routes answer 409 carrying
 * the row's real status. When that happens NOTHING was written and the page is
 * deliberately not reloaded — so the reviewer is looking at a queue that already
 * disagrees with their click.
 *
 * That is the single most important thing on the page at the moment it appears,
 * and it used to render as an 11px amber apology squeezed into a corner. Here it
 * is a toned rung-2 surface with a 4px inline-start rule, the refusal in body
 * ink rather than metadata ink, the row's REAL status as a pill beside it, and a
 * dateline stating precisely what did and did not happen. LAW E: saying exactly
 * what the platform recorded is what makes the console read as authoritative.
 *
 * aria-live="assertive" because this contradicts an action the reviewer believes
 * they just completed; a polite announcement would arrive after they have moved
 * on to the next row.
 */
export interface DecisionNoticeProps {
  /** The refusal as the server phrased it. */
  message: string;
  /** The row's real status, when the response carried one (409). */
  currentStatus?: string;
  /** What the reviewer can do next, e.g. a reload control. */
  action?: ReactNode;
  /** Names the failure. Defaults to the compare-and-swap case. */
  eyebrow?: string;
  className?: string;
}

export function DecisionNotice({
  message,
  currentStatus,
  action,
  eyebrow = "Decision not recorded",
  className,
}: DecisionNoticeProps) {
  return (
    <Surface
      rung={2}
      tone="warning"
      role="alert"
      aria-live="assertive"
      // 3px, not 4: this is the SAME rule as the active nav item, the
      // committed row, the flagged dashboard signal and the certificate's top
      // edge. One gesture in different postures is most of what makes a system
      // read as designed rather than assembled, and a notice that invents its
      // own width is the twelfth agent's sixth brass gesture.
      className={cn("border-s-[3px] border-s-warning p-3", className)}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden="true" />
        <div className="min-w-0 space-y-1.5">
          <Eyebrow className="text-warning-ink">{eyebrow}</Eyebrow>
          <p className="u-ui text-ink-1">{message}</p>
          {currentStatus && (
            <p className="flex flex-wrap items-center gap-2">
              <span className="u-meta text-ink-2">Recorded status is now</span>
              <StatusPill tone="neutral">{currentStatus.replace(/_/g, " ")}</StatusPill>
            </p>
          )}
          {/* Not fine print: it is the difference between "your click failed"
              and "someone else already decided this". */}
          <Dateline>Read back from the platform record · nothing was written and this page was not reloaded</Dateline>
          {action && <div className="pt-1">{action}</div>}
        </div>
      </div>
    </Surface>
  );
}

/**
 * The same refusal where there is only room for one line — inside a table cell
 * or beside a row's controls. It keeps the rule, the tone and the role; it drops
 * the dateline, because a citation that has to wrap three times in a 200px
 * column stops being a citation.
 */
export function DecisionNoticeInline({
  message,
  currentStatus,
  action,
  className,
}: Pick<DecisionNoticeProps, "message" | "currentStatus" | "action" | "className">) {
  return (
    <Surface
      rung={2}
      tone="warning"
      role="alert"
      aria-live="assertive"
      className={cn("border-s-[3px] border-s-warning px-2.5 py-2", className)}
    >
      <div className="u-ui flex items-start gap-2 text-ink-1">
        {/* The mark carries the tone at a glance. In a fifty-row table the
            reader has to be able to find the one row that refused without
            reading it, which a tinted box alone does not do. */}
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-ink" aria-hidden="true" />
        <div className="min-w-0">
          <p>
            {message}
            {currentStatus && (
              <>
                {" "}
                <span className="text-ink-2">Recorded status is now</span>{" "}
                <span className="font-medium">{currentStatus.replace(/_/g, " ")}</span>.
              </>
            )}
          </p>
          {/* The recovery, in the notice rather than in the operator's head. The
              queue deliberately does not reload itself when a decision is
              refused — the reviewer would lose their place — so the way back to
              a truthful row has to be offered here, once, next to the sentence
              that says the page is now stale. */}
          {action && <div className="mt-1.5">{action}</div>}
        </div>
      </div>
    </Surface>
  );
}
