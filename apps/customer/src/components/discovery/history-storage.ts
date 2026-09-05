/**
 * THE LOCAL TRAIL — where the discovery panel's signals live, and the only
 * place they ever go.
 *
 * Everything here is this browser's localStorage. Nothing is sent anywhere, no
 * identifier is minted, and the record carries no name, no email, no address
 * and no order: it is a list of catalogue slugs the visitor opened, which is
 * exactly the information already sitting in their browser history. The panel
 * offers a one-click way to erase it, and the erase is real — the keys are
 * removed, not blanked.
 *
 * EVERY read and write is wrapped. `localStorage` is not a safe global: it
 * THROWS on access in a Safari private window, under a blocked-cookies policy
 * and inside some embedded webviews, and it throws on write when the origin's
 * quota is full. A discovery panel is a convenience, and a convenience that can
 * take a product page down with it is a defect. Every failure here degrades to
 * "no history", which the planner already treats as a normal state.
 *
 * Reads are also VALIDATED rather than trusted. The stored blob is attacker-
 * adjacent (any script on the origin can write it) and version-adjacent (an
 * older build wrote an older shape). Anything that does not match is dropped
 * entry by entry, so one bad row cannot erase a good trail and cannot reach the
 * renderer as `undefined.name`.
 */
import {
  emptyHistory,
  pruneHistory,
  type DiscoveryHistory,
  type NamePair,
  type ViewedProduct,
} from "./interest-signals";

/** The slice of the Storage interface this module uses, so tests need no DOM. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const HISTORY_KEY = "avenick.discovery.trail.v1";
export const DISMISSAL_KEY = "avenick.discovery.dismissed.v1";

/**
 * How long a dismissal is honoured.
 *
 * Not forever, and that is a deliberate refusal of both extremes. A helper that
 * cannot be closed is an advertisement; a helper closed permanently by one
 * click has no way back, because there is no settings surface in this storefront
 * that owns it. Thirty days is long enough that "no thanks" is respected across
 * sessions and short enough that the decision is recoverable without clearing
 * site data. The button says what it does.
 */
export const DISMISSAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** localStorage, or null wherever it is unavailable or forbidden. */
export function browserStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    const storage = window.localStorage;
    // Presence is not permission: some policies expose the object and throw on
    // use, so the probe has to actually write.
    const probe = "avenick.discovery.probe";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNamePair(value: unknown): NamePair | null {
  if (!isRecord(value) || typeof value["en"] !== "string" || !value["en"]) return null;
  const ar = value["ar"];
  return { en: value["en"], ar: typeof ar === "string" && ar ? ar : null };
}

function readView(value: unknown): ViewedProduct | null {
  if (!isRecord(value)) return null;
  const id = value["id"];
  const slug = value["slug"];
  const at = value["at"];
  const name = readNamePair(value["name"]);
  if (typeof id !== "string" || !id) return null;
  if (typeof slug !== "string" || !slug) return null;
  if (typeof at !== "number" || !Number.isFinite(at)) return null;
  if (!name) return null;
  const rawCategory = value["category"];
  const categoryName = isRecord(rawCategory) ? readNamePair(rawCategory["name"]) : null;
  const categorySlug = isRecord(rawCategory) ? rawCategory["slug"] : null;
  return {
    id,
    slug,
    name,
    imageUrl: typeof value["imageUrl"] === "string" ? (value["imageUrl"] as string) : null,
    sku: typeof value["sku"] === "string" ? (value["sku"] as string) : null,
    brand: readNamePair(value["brand"]),
    category:
      categoryName && typeof categorySlug === "string" && categorySlug
        ? { slug: categorySlug, name: categoryName }
        : null,
    at,
  };
}

/**
 * Read, validate and prune the trail. Returns an empty history for every
 * failure mode there is: no storage, no key, unparsable JSON, wrong shape.
 */
export function readHistory(storage: StorageLike | null, now: number): DiscoveryHistory {
  if (!storage) return emptyHistory();
  let parsed: unknown;
  try {
    const raw = storage.getItem(HISTORY_KEY);
    if (!raw) return emptyHistory();
    parsed = JSON.parse(raw);
  } catch {
    return emptyHistory();
  }
  if (!isRecord(parsed)) return emptyHistory();

  const views = Array.isArray(parsed["views"])
    ? (parsed["views"] as unknown[]).map(readView).filter((view): view is ViewedProduct => view !== null)
    : [];
  const categoryVisits = Array.isArray(parsed["categoryVisits"])
    ? (parsed["categoryVisits"] as unknown[]).flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const slug = entry["slug"];
        const at = entry["at"];
        if (typeof slug !== "string" || !slug) return [];
        if (typeof at !== "number" || !Number.isFinite(at)) return [];
        return [{ slug, at }];
      })
    : [];
  const searches = Array.isArray(parsed["searches"])
    ? (parsed["searches"] as unknown[]).flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const term = entry["term"];
        const at = entry["at"];
        if (typeof term !== "string" || !term.trim()) return [];
        if (typeof at !== "number" || !Number.isFinite(at)) return [];
        return [{ term, at }];
      })
    : [];

  // Newest first is the invariant the planner and the renderer both assume; a
  // hand-edited or older blob may not honour it.
  views.sort((a, b) => b.at - a.at);
  categoryVisits.sort((a, b) => b.at - a.at);
  searches.sort((a, b) => b.at - a.at);
  return pruneHistory({ views, categoryVisits, searches }, now);
}

/** Persist the trail. A full or forbidden store is a no-op, never a throw. */
export function writeHistory(storage: StorageLike | null, history: DiscoveryHistory): void {
  if (!storage) return;
  try {
    storage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    /* Quota, private mode, or a policy. The panel simply forgets. */
  }
}

/** Erase the trail for real: the key is removed, not overwritten with a husk. */
export function clearHistory(storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.removeItem(HISTORY_KEY);
  } catch {
    /* Nothing to do and nothing worth breaking a page over. */
  }
}

export function readDismissedAt(storage: StorageLike | null): number | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(DISMISSAL_KEY);
    if (!raw) return null;
    const at = Number(raw);
    return Number.isFinite(at) ? at : null;
  } catch {
    return null;
  }
}

export function writeDismissedAt(storage: StorageLike | null, at: number): void {
  if (!storage) return;
  try {
    storage.setItem(DISMISSAL_KEY, String(at));
  } catch {
    /* See writeHistory: a dismissal we cannot persist is honoured for this
       page only, which is still better than a thrown error. */
  }
}

/** Whether a recorded dismissal is still in force. */
export function isDismissed(dismissedAt: number | null, now: number, ttlMs = DISMISSAL_TTL_MS): boolean {
  if (dismissedAt === null) return false;
  // A clock that moved backwards must not resurrect the panel a visitor closed.
  return now - dismissedAt < ttlMs;
}
