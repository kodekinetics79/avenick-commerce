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

/**
 * CommitBadge — the badge CONTAINER pulse, and the piece of this system that is
 * hardest to get right for the least obvious reason.
 *
 * THE DIGIT IS NEVER THE ANIMATED ELEMENT. The container springs 1 → 1.18 → 1
 * over 320ms while the number inside is SWAPPED INSTANTLY. On a trade platform
 * an animated number is a number you cannot trust: every intermediate frame of
 * a ticking count or total displays a financial value that is false, and this
 * codebase just finished a long programme removing values that were not true.
 * <Num> makes the same guarantee structurally; this is its motion counterpart.
 *
 * THE ROLLBACK IS PART OF THE GESTURE, NOT AN AFTERTHOUGHT. If the server
 * rejects, pass tone="danger": the badge decrements with the IDENTICAL 320ms
 * pulse, tinted, and the caller states the reason. An optimistic UI with no
 * designed rollback leaves a phantom cart line on screen, which is a truth
 * violation delivered by motion.
 *
 * `pulseKey` is what makes it retriggerable. A CSS animation restarts from zero
 * only if the element remounts, so the caller passes the value being confirmed
 * (a cart count, a version number) and React re-keys the span. A user tapping
 * four times fast gets four pulses, not one stuck at frame zero.
 */
export interface CommitBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Changing this restarts the pulse. Pass the value being confirmed. */
  pulseKey: string | number;
  /** `danger` tints the pulse for a rejection rollback. */
  tone?: "default" | "danger";
  children: React.ReactNode;
}

export function CommitBadge({ pulseKey, tone = "default", className, children, ...props }: CommitBadgeProps) {
  return (
    <span
      key={pulseKey}
      className={cn("u-badge-pulse inline-flex", className)}
      data-pulse="on"
      data-tone={tone === "danger" ? "danger" : undefined}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * CommitLabel — the label swap, by clip-path wipe rather than cross-fade.
 *
 * A cross-fade between two strings puts every frame of the transition at partial
 * opacity, i.e. unreadable, on the one control the user is watching most closely.
 * A clip-path edge travelling from the inline start keeps BOTH layers at full
 * opacity the whole time: the confirmed label sits underneath, and the resting
 * label is wiped away to reveal it. No frame is ever half-transparent.
 *
 * `inset()` takes physical edges and has no logical form, so globals.css writes
 * out both directions — the mandatory second mechanism whenever a value cannot
 * be multiplied by --dir.
 */
export interface CommitLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** The resting label. */
  idle: React.ReactNode;
  /** The confirmed label, revealed by the wipe. */
  committed: React.ReactNode;
  /** True once the server has confirmed. */
  done: boolean;
}

export function CommitLabel({ idle, committed, done, className, ...props }: CommitLabelProps) {
  return (
    <span className={cn("u-wipe", className)} data-state={done ? "on" : "off"} {...props}>
      {/* The confirmed layer is underneath and always fully opaque. */}
      <span aria-hidden={!done}>{committed}</span>
      <span className="u-wipe__from" aria-hidden={done}>
        {idle}
      </span>
    </span>
  );
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
