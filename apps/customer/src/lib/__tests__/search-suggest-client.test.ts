// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSearchSuggestions, suggestRequestUrl, useSearchSuggest } from "../search-suggest-client";
import type { SuggestResponse } from "../search-suggest";

interface PendingFetch {
  url: string;
  signal: AbortSignal | undefined;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

let pending: PendingFetch[] = [];

function ok(data: SuggestResponse) {
  return { ok: true, status: 200, json: async () => ({ success: true, data }) };
}

const ran = (suggestions: SuggestResponse["suggestions"]): SuggestResponse => ({ query: "q", status: "ran", minLength: null, suggestions });
const socket = { kind: "product" as const, label: "Socket", labelAr: null, href: "/products/socket", sku: "S-1" };

beforeEach(() => {
  pending = [];
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) =>
      new Promise((resolve, reject) => {
        const signal = init?.signal ?? undefined;
        signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
        pending.push({ url, signal, resolve, reject });
      })),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("suggestRequestUrl / fetchSearchSuggestions", () => {
  it("encodes the term and the limit", () => {
    expect(suggestRequestUrl("bosch drill", 5)).toBe("/api/search/suggest?q=bosch+drill&limit=5");
    expect(suggestRequestUrl("3m&co")).toBe("/api/search/suggest?q=3m%26co");
  });

  it("unwraps the envelope and refuses a failed one", async () => {
    const request = fetchSearchSuggestions("bosch");
    pending[0]!.resolve(ok(ran([socket])));
    await expect(request).resolves.toEqual(ran([socket]));

    const failed = fetchSearchSuggestions("bosch");
    pending[1]!.resolve({ ok: false, status: 429, json: async () => ({ success: false, error: "slow down" }) });
    await expect(failed).rejects.toThrow(/429/);
  });
});

describe("useSearchSuggest", () => {
  it("asks nothing for an empty or one-character field", () => {
    const { result, rerender } = renderHook(({ q }: { q: string }) => useSearchSuggest(q), { initialProps: { q: "" } });
    expect(result.current).toEqual({ status: "idle", suggestions: [], minLength: null });
    rerender({ q: "b" });
    expect(result.current).toEqual({ status: "too_short", suggestions: [], minLength: 2 });
    expect(pending).toHaveLength(0);
  });

  it("debounces keystrokes into one request and applies its answer", async () => {
    const { result, rerender } = renderHook(({ q }: { q: string }) => useSearchSuggest(q, { debounceMs: 200 }), { initialProps: { q: "bo" } });
    expect(result.current.status).toBe("loading");
    rerender({ q: "bos" });
    await act(async () => { vi.advanceTimersByTime(150); });
    expect(pending).toHaveLength(0);
    await act(async () => { vi.advanceTimersByTime(60); });
    expect(pending.map((p) => p.url)).toEqual(["/api/search/suggest?q=bos&limit=8"]);

    await act(async () => { pending[0]!.resolve(ok(ran([socket]))); });
    expect(result.current).toEqual({ status: "ready", suggestions: [socket], minLength: null });
  });

  it("aborts a request the field has typed past, so a late answer is never applied", async () => {
    const { result, rerender } = renderHook(({ q }: { q: string }) => useSearchSuggest(q, { debounceMs: 10 }), { initialProps: { q: "bos" } });
    await act(async () => { vi.advanceTimersByTime(20); });
    expect(pending).toHaveLength(1);

    rerender({ q: "bosch" });
    expect(pending[0]!.signal?.aborted).toBe(true);
    await act(async () => { vi.advanceTimersByTime(20); });
    expect(pending).toHaveLength(2);

    // The stale request cannot resolve any more (it was rejected on abort), and
    // the current one answers the current text.
    await act(async () => { pending[1]!.resolve(ok(ran([socket]))); });
    expect(result.current.status).toBe("ready");
    expect(result.current.suggestions).toEqual([socket]);
  });

  it("reports the server's floor rather than an empty result, and a failure as an error", async () => {
    const { result, rerender } = renderHook(({ q }: { q: string }) => useSearchSuggest(q, { debounceMs: 10 }), { initialProps: { q: "ab c" } });
    await act(async () => { vi.advanceTimersByTime(20); });
    await act(async () => { pending[0]!.resolve(ok({ query: "ab c", status: "too_short", minLength: 3, suggestions: [] })); });
    expect(result.current).toEqual({ status: "too_short", suggestions: [], minLength: 3 });

    rerender({ q: "bosch" });
    await act(async () => { vi.advanceTimersByTime(20); });
    await act(async () => { pending[1]!.reject(new Error("network")); });
    expect(result.current.status).toBe("error");
  });
});
