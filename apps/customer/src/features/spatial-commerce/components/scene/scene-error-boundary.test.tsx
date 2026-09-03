// @vitest-environment jsdom

import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SceneErrorBoundary } from "./scene-error-boundary";

function Broken({ fail }: { fail: boolean }) {
  if (fail) throw new Error("renderer failed");
  return <p>scene ready</p>;
}

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => undefined));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SceneErrorBoundary", () => {
  it("does not retry a deterministic renderer failure on an ordinary rerender", () => {
    const view = render(
      <SceneErrorBoundary fallback={<p>safe fallback</p>}>
        <Broken fail />
      </SceneErrorBoundary>,
    );
    expect(screen.getByText("safe fallback")).toBeTruthy();

    view.rerender(
      <SceneErrorBoundary fallback={<p>safe fallback</p>}>
        <Broken fail={false} />
      </SceneErrorBoundary>,
    );
    expect(screen.getByText("safe fallback")).toBeTruthy();
    expect(screen.queryByText("scene ready")).toBeNull();
  });

  it("retries only when the caller explicitly remounts the boundary", () => {
    const view = render(
      <SceneErrorBoundary key={0} fallback={<p>safe fallback</p>}>
        <Broken fail />
      </SceneErrorBoundary>,
    );
    view.rerender(
      <SceneErrorBoundary key={1} fallback={<p>safe fallback</p>}>
        <Broken fail={false} />
      </SceneErrorBoundary>,
    );
    expect(screen.getByText("scene ready")).toBeTruthy();
  });
});
