import type { PillTone } from "@avenick/ui";

/**
 * THE ROW RULE — one gesture, six postures.
 *
 * DESIGN_SYSTEM.md §10.13: the system's genuine advantage is that it has ONE
 * mark — a rule drawn at the inline start — used for active nav, the selected
 * tab, `.u-commit`, the quantity ladder's active band and the certificate's top
 * edge. A twelfth implementer inventing a sixth mark with its own timing is how
 * a system stops reading as designed and starts reading as assembled.
 *
 * So every queue in the buyer suite marks a row the same way, and this is the
 * only place the class is written. It is ALWAYS 3px and ALWAYS present — only
 * the colour changes — because growing a real border width when a row changes
 * state reflows every row beneath it.
 *
 * The colour answers ONE question, and it is the question a procurement manager
 * is actually asking as they scan: whose move is it?
 *
 *   warning — yours, right now
 *   accent  — the supplier's, and they are engaged
 *   neutral — nobody's; parked, spent, or not yet sent
 *   success / danger — settled, one way or the other
 *
 * Written as an arbitrary property rather than a `border-s-warning` utility so
 * it is unambiguous which physical side is being coloured in each reading
 * direction: `border-inline-start` is the right edge in Arabic, and that is the
 * whole point.
 */
const TONE_RULE: Record<PillTone, string> = {
  warning: "[border-inline-start-color:hsl(var(--warning))]",
  accent: "[border-inline-start-color:hsl(var(--accent))]",
  success: "[border-inline-start-color:hsl(var(--success))]",
  danger: "[border-inline-start-color:hsl(var(--danger))]",
  primary: "[border-inline-start-color:hsl(var(--primary))]",
  // Present but invisible. A parked row still reserves the three pixels, so the
  // rows in a mixed queue share one text baseline.
  neutral: "[border-inline-start-color:transparent]",
};

/** The row rule for a queue row, ready to hand to `<LedgerTable rowProps>`. */
export function toneRule(tone: PillTone): string {
  return `border-s-[3px] ${TONE_RULE[tone]}`;
}
