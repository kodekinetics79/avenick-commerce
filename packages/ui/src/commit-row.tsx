"use client";

import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * useCommitState / CommitRow — the row commit.
 *
 * In a forty-row approvals queue the real usability problem is not slowness; it
 * is not knowing WHICH row you just acted on. The acted-on row grows a 3px rule
 * in its tone at the inline start, a soft wash wipes across it from the inline
 * start, its badge cross-fades, and then it leaves.
 *
 * PRESENTATION ONLY. This does not wrap, replace, delay or gate the server
 * action, the permission check or the validation. It renders the result of state
 * that has already changed. Nothing here is ever a queue, there is no
 * pointer-events: none window, and every frame is interruptible — a second click
 * restarts the readout from wherever it is. A 400ms confirmation that swallows
 * the second click makes a product feel slower than the flat version it replaced.
 *
 * Shared verbatim by admin approvals, admin compliance and the seller RFQ inbox.
 * It flexes to danger on reject and warning on hold.
 */
export type CommitState = "idle" | "pending" | "committed" | "failed" | "exiting";

export interface UseCommitStateOptions {
  /** Called once the exit transition has finished, to unmount the row. */
  onExit?: () => void;
  /** How long the committed state is shown before the exit begins. */
  holdMs?: number;
}

export function useCommitState({ onExit, holdMs = 380 }: UseCommitStateOptions = {}) {
  const [state, setState] = React.useState<CommitState>("idle");
  const timer = React.useRef<ReturnType<typeof setTimeout>>();

  React.useEffect(() => () => clearTimeout(timer.current), []);

  const begin = React.useCallback(() => setState("pending"), []);

  const commit = React.useCallback(
    (options?: { exit?: boolean }) => {
      setState("committed");
      if (options?.exit === false) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("exiting"), holdMs);
    },
    [holdMs],
  );

  const fail = React.useCallback(() => {
    clearTimeout(timer.current);
    setState("failed");
  }, []);

  const reset = React.useCallback(() => {
    clearTimeout(timer.current);
    setState("idle");
  }, []);

  // The unmount hangs off transitionend rather than a second timer, so it stays
  // correct under reduced motion (where durations are 1ms, not 0 — which is
  // exactly why they are 1ms).
  const onTransitionEnd = React.useCallback(
    (event: React.TransitionEvent) => {
      if (event.propertyName !== "opacity") return;
      if (state === "exiting") onExit?.();
    },
    [state, onExit],
  );

  return { state, begin, commit, fail, reset, onTransitionEnd };
}

export interface CommitRowProps extends React.HTMLAttributes<HTMLElement> {
  state: CommitState;
  tone?: "success" | "danger" | "warning";
  onTransitionEnd?: React.TransitionEventHandler;
  as?: React.ElementType;
  children: React.ReactNode;
}

export function CommitRow({
  state,
  tone = "success",
  as,
  className,
  children,
  ...props
}: CommitRowProps) {
  const Comp: React.ElementType = as ?? "tr";
  return (
    <Comp
      data-commit={state}
      data-tone={tone}
      // aria-busy is the honest signal while a server action is in flight; the
      // row itself is never disabled and never stops accepting clicks.
      aria-busy={state === "pending" || undefined}
      className={cn("u-commit", className)}
      {...props}
    >
      {children}
    </Comp>
  );
}
