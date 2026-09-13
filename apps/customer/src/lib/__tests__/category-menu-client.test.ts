// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Hook = typeof import("../category-menu-client").useCategoryMenu;

const node = (slug: string, nameEn: string, nameAr: string | null = null, children: unknown[] = []) => ({
  id: slug,
  slug,
  nameEn,
  nameAr,
  iconName: null,
  parentId: null,
  children,
});

function answer(body: unknown, ok = true) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok, status: ok ? 200 : 500, json: async () => body }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// The module caches its request for the life of the page, so every test gets a
// fresh copy of it — a fresh page load.
async function freshHook(): Promise<Hook> {
  vi.resetModules();
  return (await import("../category-menu-client")).useCategoryMenu;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useCategoryMenu", () => {
  it("offers the roots of the public tree, in the order the route gives them", async () => {
    answer({
      success: true,
      data: [
        node("electrical", "Electrical", "كهربائيات", [node("cable", "Cable")]),
        node("tapes", "Tapes"),
      ],
    });
    const useCategoryMenu = await freshHook();
    const { result } = renderHook(() => useCategoryMenu());

    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(result.current).toEqual([
      { slug: "electrical", nameEn: "Electrical", nameAr: "كهربائيات" },
      { slug: "tapes", nameEn: "Tapes", nameAr: null },
    ]);
  });

  it("drops a row it could not link or name", async () => {
    answer({ success: true, data: [node("", "Nameless slug"), node("no-name", ""), null, node("ok", "Ok")] });
    const useCategoryMenu = await freshHook();
    const { result } = renderHook(() => useCategoryMenu());

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0]!.slug).toBe("ok");
  });

  it("is a shortcut, not the catalogue: it stops at the limit", async () => {
    answer({ success: true, data: Array.from({ length: 12 }, (_, i) => node(`c${i}`, `C${i}`)) });
    const useCategoryMenu = await freshHook();
    const { result } = renderHook(() => useCategoryMenu(8));

    await waitFor(() => expect(result.current).toHaveLength(8));
    expect(result.current.at(-1)!.slug).toBe("c7");
  });

  /**
   * The header's Shop panel keeps its static columns when this is empty, so an
   * error must arrive as an empty list and never as a throw into the chrome.
   */
  it("fails to nothing on an error status, an error payload or a network failure", async () => {
    answer({ success: false, error: "Failed" }, false);
    let useCategoryMenu = await freshHook();
    let hook = renderHook(() => useCategoryMenu());
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
    expect(hook.result.current).toEqual([]);
    hook.unmount();

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    useCategoryMenu = await freshHook();
    hook = renderHook(() => useCategoryMenu());
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
    expect(hook.result.current).toEqual([]);
  });

  it("asks once per page load, however many times the header mounts", async () => {
    const fetchMock = answer({ success: true, data: [node("tapes", "Tapes")] });
    const useCategoryMenu = await freshHook();
    const first = renderHook(() => useCategoryMenu());
    await waitFor(() => expect(first.result.current).toHaveLength(1));
    first.unmount();

    const second = renderHook(() => useCategoryMenu());
    await waitFor(() => expect(second.result.current).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/categories");
  });
});
