// @vitest-environment jsdom

import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useSpatialRuntimePolicy } from "./use-spatial-motion";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useSpatialRuntimePolicy", () => {
  it("prevents WebGL loading under Save-Data while retaining reduced motion", async () => {
    const listeners = new Set<() => void>();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: {
        saveData: true,
        addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
      },
    });

    const { result, unmount } = renderHook(() => useSpatialRuntimePolicy());
    await waitFor(() => expect(result.current).toEqual({ reducedMotion: true, allowWebGLLoad: false }));
    unmount();
    expect(listeners.size).toBe(0);
  });

  it("allows WebGL when Save-Data is off", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
    Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: false } });
    const { result } = renderHook(() => useSpatialRuntimePolicy());
    await waitFor(() => expect(result.current).toEqual({ reducedMotion: false, allowWebGLLoad: true }));
  });
});
