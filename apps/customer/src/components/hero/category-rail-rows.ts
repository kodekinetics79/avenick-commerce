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
 * taller than the slab would stretch the whole hero row, and at 1366x768 that
 * pushes the slab's call to action towards the fold. The band's height is not
 * the rail's to choose: at lg and up it is set by the carousel column, whose
 * glass caption is DATA — 646px at 1366 and 1440 when the lead slide prints a
 * category line, 596px when it has none. So the child rows are budgeted
 * against the shorter of the two, using the ARABIC line heights, which are the
 * taller of the two scripts (--lh-ui 22px, --lh-meta 20px under [dir="rtl"]).
 * In English, and under a caption with a category, the same budget leaves
 * some slack at the bottom of the list, which is the right direction to be
 * wrong in.
 *
 * Children are dealt ROUND-ROBIN: every root gets its first child before any
 * root gets a second. Truncating root by root would spend the whole budget on
 * the first two categories and leave the rest bare. The tree's own order
 * (sortOrder, then name) is kept at both levels.
 */

/**
 * The rail's list area in the shorter band, in px: the 596px panel less the
 * label row and the "All products" row (each 20px of padding, a 1px rule and a
 * 20px Arabic meta line), the list's 8px of padding and the panel's 2px border.
 */
export const RAIL_LIST_PX = 596 - 41 - 41 - 8 - 2;

/** A top-level row: py-2 around a 22px Arabic ui line. */
export const ROOT_ROW_PX = 38;

/** A child row: py-1 around a 20px Arabic meta line. */
export const CHILD_ROW_PX = 28;

/** Past three, a category's children read as a menu of their own, not as a hint of its shape. */
export const MAX_CHILDREN_PER_ROOT = 3;

/** How many child rows fit under `rootCount` top-level rows without growing the band. */
export function childRowBudget(rootCount: number): number {
  const roots = Math.max(0, Math.floor(rootCount));
  return Math.max(0, Math.floor((RAIL_LIST_PX - roots * ROOT_ROW_PX) / CHILD_ROW_PX));
}

export interface CategoryRailEntry<T> {
  root: T;
  /** The children to show under `root`, a prefix of its own children. */
  children: T[];
}

/**
 * Pair each top-level category with the children the rail has room for.
 *
 * Pure and generic over the node type so the rule is testable without the
 * catalogue: the output always lists every root, in order, and each root's
 * `children` is a prefix of its own, never longer than MAX_CHILDREN_PER_ROOT,
 * with the total never exceeding `budget`.
 */
export function categoryRailRows<T extends { children?: T[] }>(
  roots: T[],
  budget: number = childRowBudget(roots.length),
): CategoryRailEntry<T>[] {
  const taken = roots.map(() => 0);
  let remaining = Math.max(0, Math.floor(budget));

  for (let depth = 0; depth < MAX_CHILDREN_PER_ROOT && remaining > 0; depth++) {
    let dealt = false;
    for (let i = 0; i < roots.length && remaining > 0; i++) {
      if ((roots[i]!.children?.length ?? 0) > depth) {
        taken[i]! += 1;
        remaining -= 1;
        dealt = true;
      }
    }
    // No root has a child at this depth, so none has one deeper either.
    if (!dealt) break;
  }

  return roots.map((root, i) => ({ root, children: (root.children ?? []).slice(0, taken[i]) }));
}
