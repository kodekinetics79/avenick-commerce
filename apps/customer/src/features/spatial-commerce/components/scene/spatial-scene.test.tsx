// @vitest-environment jsdom

import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SpatialScene } from "./spatial-scene";
import type { SpatialSceneLabels } from "./scene.types";

vi.mock("next/dynamic", async () => {
  const ReactModule = await import("react");
  return {
    default: () => function MockCanvas(props: { onReady: () => void; onContextLost: () => void }) {
      ReactModule.useEffect(() => props.onReady(), [props.onReady]);
      return ReactModule.createElement("button", { type: "button", onClick: props.onContextLost }, "Simulate context loss");
    },
  };
});

const labels: SpatialSceneLabels = {
  regionLabel: "Assembly viewer",
  loading: "Loading viewer",
  unavailable: "Viewer unavailable",
  error: "Viewer failed",
  retry: "Retry viewer",
  partsLabel: "Assembly parts",
  nodes: {
    "mounting-plate": "Mounting plate",
    "motor-housing": "Motor housing",
    "drive-shaft": "Drive shaft",
    "output-coupling": "Output coupling",
  },
};

const baseProps = { labels, selectedNodeId: null, pulseRevision: 0, reducedMotion: false } as const;

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({
    getExtension: () => ({ loseContext: vi.fn() }),
  }) as never);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SpatialScene lifecycle", () => {
  it("does not mount the lazy WebGL canvas when runtime policy disallows it", async () => {
    render(<SpatialScene {...baseProps} allowWebGLLoad={false} />);
    expect(screen.getByRole("status").textContent).toContain("Viewer unavailable");
    expect(screen.queryByRole("button", { name: "Simulate context loss" })).toBeNull();
  });

  it("falls back on context loss and remounts only after explicit retry", async () => {
    render(<SpatialScene {...baseProps} allowWebGLLoad />);
    const canvasControl = await screen.findByRole("button", { name: "Simulate context loss" });
    fireEvent.click(canvasControl);
    expect(screen.getByRole("alert").textContent).toContain("Viewer failed");
    expect(screen.queryByRole("button", { name: "Simulate context loss" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry viewer" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Simulate context loss" })).toBeTruthy());
  });
});
