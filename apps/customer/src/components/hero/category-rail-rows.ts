/**
 * How much of the catalogue's second level the home page's category rail can
 * show beside the hero.
 *
 * THE RAIL IS ONE BAND WITH THE HERO. Its grid row stretches, so the rail is
 * exactly as tall as the slab beside it and its "All products" row sits flush
 * with the slab's bottom edge. That decision assumed a list long enough to fill
 * the band. On the live catalogue it is seven top-level categories: they end
 * 296px into a 646px panel, so over half of a raised, floating surface at the
 * top of the page was empty white.
 *
 * The fill is the SAME taxonomy one level deeper, rather than anything else.
 * Brands already have their own header panel, and a second taxonomy inside this
 * rail would break the rule that it is the one taxonomy surface on the viewport.
 * Every child is a plain link, like its parent, for the reason the rail is not
 * a flyout: a hover-revealed subtree is unreachable on touch and invisible to a
 * keyboard. The category data already carries the tree, so this costs no query.
 *
 * THE BUDGET IS COUNTED IN ROWS, AND IT IS SET SO THE BAND NEVER GROWS. A rail
 * taller than the slab would stretch the whole hero row and push the slab's
 * call to action towards the fold. The band's height is not the rail's to
 * choose: it is set by the carousel column, whose slides are stacked in one
 * grid cell, so the band is as tall as the TALLEST slide. That makes it data —
 * a slide whose caption prints a category line, or a name that wraps, adds a
 * line — and it makes it a function of the breakpoint, because the carousel
 * column is 20rem wide from lg and 24rem from xl, and its object is square.
 * Measured with the shortest captions (no category line, one-line names):
 *
 *            lg (1024–1279)   xl and up
 *   English  552px            596px
 *   Arabic   538px            602px
 *
 * (Production, whose slides do print categories, measured 646px at 1366.)
 *
 * So there are TWO budgets. Every child row within the smaller one is shown
 * wherever the rail is; the rows the xl band has room for beyond that are
 * shown from xl up only. Both are counted against the smaller of the two
 * scripts' bands and in the ARABIC line heights, which are the taller of the
 * two (--lh-ui 22px, --lh-meta 20px under [dir="rtl"]). English, and a slide
 * set with a category line, therefore end with some slack under the list,
 * which is the right direction to be wrong in. The budget used to be one
 * number set against the 596px xl band, and at every lg width it grew the band
 * — by 48px in Arabic — which is what this split exists to prevent.
 *
 * Children are dealt ROUND-ROBIN: every root gets its first child before any
 * root gets a second. Truncating root by root would spend the whole budget on
 * the first two categories and leave the rest bare. The tree's own order
 * (sortOrder, then name) is kept at both levels, and the xl-only rows are the
 * LAST ones dealt, so the narrower rail is the wider one with its tail removed.
 */

/** The rail's chrome inside the panel: the label row and the "All products" row (each 20px of padding, a 1px rule and a 20px Arabic meta line), the list's 8px of padding and the panel's 2px border. */
const RAIL_CHROME_PX = 41 + 41 + 8 + 2;

/** The rail's list area beside the xl band, in px. */
export const RAIL_LIST_PX = 596 - RAIL_CHROME_PX;

/** The rail's list area beside the lg band, in px — the Arabic band, which is the shorter one there. */
export const RAIL_LIST_LG_PX = 538 - RAIL_CHROME_PX;

/** A top-level row: py-2 around a 22px Arabic ui line. */
export const ROOT_ROW_PX = 38;

/** A child row: py-1 around a 20px Arabic meta line. */
export const CHILD_ROW_PX = 28;

/** Past three, a category's children read as a menu of their own, not as a hint of its shape. */
export const MAX_CHILDREN_PER_ROOT = 3;

/** How many child rows fit under `rootCount` top-level rows in a list area of `listPx` without growing the band. */
export function childRowBudget(rootCount: number, listPx: number = RAIL_LIST_PX): number {
  const roots = Math.max(0, Math.floor(rootCount));
  return Math.max(0, Math.floor((listPx - roots * ROOT_ROW_PX) / CHILD_ROW_PX));
}

export interface CategoryRailEntry<T> {
  root: T;
  /** The children to show under `root`, a prefix of its own children. */
  children: T[];
  /**
   * How many of `children`, from the start, are shown below xl. The rest are
   * shown from xl up only. Never more than `children.length`.
   */
  compact: number;
}

/**
 * Pair each top-level category with the children the rail has room for.
 *
 * Pure and generic over the node type so the rule is testable without the
 * catalogue: the output always lists every root, in order, and each root's
 * `children` is a prefix of its own, never longer than MAX_CHILDREN_PER_ROOT,
 * with the total never exceeding `budget`. Of those, the first
 * `compactBudget` dealt (round-robin order) are counted in each entry's
 * `compact`; `compactBudget` is clamped to `budget`.
 */
export function categoryRailRows<T extends { children?: T[] }>(
  roots: T[],
  budget: number = childRowBudget(roots.length),
  compactBudget: number = childRowBudget(roots.length, RAIL_LIST_LG_PX),
): CategoryRailEntry<T>[] {
  const taken = roots.map(() => 0);
  const compact = roots.map(() => 0);
  let remaining = Math.max(0, Math.floor(budget));
  let compactRemaining = Math.min(remaining, Math.max(0, Math.floor(compactBudget)));

  for (let depth = 0; depth < MAX_CHILDREN_PER_ROOT && remaining > 0; depth++) {
    let dealt = false;
    for (let i = 0; i < roots.length && remaining > 0; i++) {
      if ((roots[i]!.children?.length ?? 0) > depth) {
        taken[i]! += 1;
        remaining -= 1;
        // Round-robin order is the order of importance, so the rows within the
        // smaller budget are exactly the first ones dealt. Within one root they
        // are therefore always a prefix of that root's shown children.
        if (compactRemaining > 0) {
          compact[i]! += 1;
          compactRemaining -= 1;
        }
        dealt = true;
      }
    }
    // No root has a child at this depth, so none has one deeper either.
    if (!dealt) break;
  }

  return roots.map((root, i) => ({
    root,
    children: (root.children ?? []).slice(0, taken[i]),
    compact: compact[i]!,
  }));
}
