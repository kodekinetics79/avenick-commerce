import { describe, expect, it } from "vitest";
import {
  clearHistory,
  DISMISSAL_KEY,
  DISMISSAL_TTL_MS,
  HISTORY_KEY,
  isDismissed,
  readDismissedAt,
  readHistory,
  writeDismissedAt,
  writeHistory,
  type StorageLike,
} from "../history-storage";
import { emptyHistory, SIGNAL_TTL_MS, type DiscoveryHistory } from "../interest-signals";

/**
 * The storage layer's job is to be UNBREAKABLE, not clever.
 *
 * localStorage throws on access in a private window, throws on write when the
 * origin is over quota, and returns whatever an older build or another script
 * left behind. A discovery panel is a convenience; a convenience that can take a
 * product page down with it is a defect. Every case below asserts the same
 * property from a different direction: it degrades to "no history" and never
 * throws.
 */

const NOW = Date.UTC(2026, 8, 5, 12, 0, 0);

function fakeStorage(seed: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...seed };
  return {
    data,
    getItem: (key) => (key in data ? data[key]! : null),
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

const hostileStorage: StorageLike = {
  getItem() {
    throw new DOMException("The operation is insecure.", "SecurityError");
  },
  setItem() {
    throw new DOMException("QuotaExceededError", "QuotaExceededError");
  },
  removeItem() {
    throw new DOMException("The operation is insecure.", "SecurityError");
  },
};

const goodView = {
  id: "p1",
  slug: "busbar-400a",
  name: { en: "Busbar 400 A", ar: null },
  imageUrl: null,
  sku: "BB-400",
  brand: { en: "Schneider", ar: null },
  category: null,
  at: NOW - 1000,
};

describe("readHistory", () => {
  it("returns an empty trail when there is no storage at all", () => {
    expect(readHistory(null, NOW)).toEqual(emptyHistory());
  });

  it("returns an empty trail instead of throwing when storage is forbidden", () => {
    expect(() => readHistory(hostileStorage, NOW)).not.toThrow();
    expect(readHistory(hostileStorage, NOW)).toEqual(emptyHistory());
  });

  it("survives an unparsable or wrongly shaped blob", () => {
    expect(readHistory(fakeStorage({ [HISTORY_KEY]: "{not json" }), NOW)).toEqual(emptyHistory());
    expect(readHistory(fakeStorage({ [HISTORY_KEY]: '"a string"' }), NOW)).toEqual(emptyHistory());
    expect(readHistory(fakeStorage({ [HISTORY_KEY]: "null" }), NOW)).toEqual(emptyHistory());
    expect(readHistory(fakeStorage({ [HISTORY_KEY]: '{"views":"nope"}' }), NOW)).toEqual(emptyHistory());
  });

  it("drops malformed rows one by one rather than discarding a good trail", () => {
    const stored = JSON.stringify({
      views: [goodView, { id: "no-name", slug: "x", at: NOW }, null, 7, { slug: "no-id", name: { en: "X" }, at: NOW }],
      categoryVisits: [{ slug: "wiring-devices", at: NOW }, { slug: "", at: NOW }, { at: NOW }],
      searches: [{ term: "busbar", at: NOW }, { term: "   ", at: NOW }, { term: "no-timestamp" }],
    });
    const trail = readHistory(fakeStorage({ [HISTORY_KEY]: stored }), NOW);
    expect(trail.views.map((view) => view.id)).toEqual(["p1"]);
    expect(trail.views[0]!.brand).toEqual({ en: "Schneider", ar: null });
    expect(trail.categoryVisits).toEqual([{ slug: "wiring-devices", at: NOW }]);
    expect(trail.searches).toEqual([{ term: "busbar", at: NOW }]);
  });

  it("prunes stale rows and restores newest-first ordering", () => {
    const stored = JSON.stringify({
      views: [
        { ...goodView, id: "older", at: NOW - 5000 },
        { ...goodView, id: "newest", at: NOW - 10 },
        { ...goodView, id: "expired", at: NOW - SIGNAL_TTL_MS - 1 },
      ],
      categoryVisits: [],
      searches: [],
    });
    const trail = readHistory(fakeStorage({ [HISTORY_KEY]: stored }), NOW);
    expect(trail.views.map((view) => view.id)).toEqual(["newest", "older"]);
  });

  it("keeps a category recorded by a caller that had the row", () => {
    const stored = JSON.stringify({
      views: [{ ...goodView, category: { slug: "wiring-devices", name: { en: "Wiring Devices", ar: "أجهزة" } } }],
      categoryVisits: [],
      searches: [],
    });
    const trail = readHistory(fakeStorage({ [HISTORY_KEY]: stored }), NOW);
    expect(trail.views[0]!.category).toEqual({ slug: "wiring-devices", name: { en: "Wiring Devices", ar: "أجهزة" } });
  });
});

describe("writeHistory and clearHistory", () => {
  it("round-trips a trail", () => {
    const storage = fakeStorage();
    const trail: DiscoveryHistory = {
      views: [goodView],
      categoryVisits: [{ slug: "wiring-devices", at: NOW }],
      searches: [{ term: "busbar", at: NOW }],
    };
    writeHistory(storage, trail);
    expect(readHistory(storage, NOW)).toEqual(trail);
  });

  it("never throws when the store is full, forbidden or absent", () => {
    expect(() => writeHistory(hostileStorage, emptyHistory())).not.toThrow();
    expect(() => writeHistory(null, emptyHistory())).not.toThrow();
    expect(() => clearHistory(hostileStorage)).not.toThrow();
    expect(() => clearHistory(null)).not.toThrow();
  });

  it("erases by removing the key, not by writing an empty husk", () => {
    const storage = fakeStorage();
    writeHistory(storage, { views: [goodView], categoryVisits: [], searches: [] });
    clearHistory(storage);
    expect(HISTORY_KEY in storage.data).toBe(false);
    expect(readHistory(storage, NOW)).toEqual(emptyHistory());
  });
});

describe("dismissal", () => {
  it("round-trips and is honoured for its window only", () => {
    const storage = fakeStorage();
    expect(readDismissedAt(storage)).toBeNull();
    writeDismissedAt(storage, NOW);
    expect(storage.data[DISMISSAL_KEY]).toBe(String(NOW));
    expect(readDismissedAt(storage)).toBe(NOW);

    expect(isDismissed(NOW, NOW)).toBe(true);
    expect(isDismissed(NOW, NOW + DISMISSAL_TTL_MS - 1)).toBe(true);
    // Bounded on purpose: nothing else in this storefront can bring the panel
    // back, so a permanent dismissal would be unrecoverable.
    expect(isDismissed(NOW, NOW + DISMISSAL_TTL_MS)).toBe(false);
  });

  it("treats no record as not dismissed, and a garbage record as no record", () => {
    expect(isDismissed(null, NOW)).toBe(false);
    expect(readDismissedAt(fakeStorage({ [DISMISSAL_KEY]: "soon" }))).toBeNull();
    expect(readDismissedAt(hostileStorage)).toBeNull();
    expect(readDismissedAt(null)).toBeNull();
  });

  it("does not resurrect a closed panel when the clock moves backwards", () => {
    expect(isDismissed(NOW, NOW - 60 * 60 * 1000)).toBe(true);
  });

  it("never throws while persisting a dismissal", () => {
    expect(() => writeDismissedAt(hostileStorage, NOW)).not.toThrow();
    expect(() => writeDismissedAt(null, NOW)).not.toThrow();
  });
});
