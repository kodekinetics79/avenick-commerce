// @vitest-environment jsdom

import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { RouteFade, __resetRouteFadeForTests } from "../route-fade";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

afterEach(() => {
  cleanup();
  pathname = "/";
  // The module remembers a document; each test is a new one.
  __resetRouteFadeForTests();
});

const wrapper = (container: HTMLElement) => container.firstElementChild as HTMLElement;

describe("RouteFade", () => {
  /**
   * A fade from zero on first paint delays the largest contentful paint by the
   * length of the fade, for a transition nobody asked for: the visitor did not
   * navigate, they arrived.
   */
  it("does not animate the page a visitor arrives on", () => {
    const { container } = render(<RouteFade>content</RouteFade>);
    expect(wrapper(container).className).toBe("");
  });

  /**
   * The defect this pins: every page renders its own <MainLayout>, so RouteFade
   * is REMOUNTED on each navigation. An earlier version kept this state in a
   * ref, which reset with the remount, and the animation never ran once — while
   * passing a test that only ever rerendered a single instance. So the test
   * unmounts between navigations, the way the router does.
   */
  it("animates the content of every page navigated to afterwards, even though it remounts", () => {
    const { container, unmount } = render(<RouteFade>first</RouteFade>);
    expect(wrapper(container).className).toBe("");
    unmount();

    pathname = "/products";
    const second = render(<RouteFade>second</RouteFade>);
    expect(wrapper(second.container).className).toContain("u-route");
    second.unmount();

    pathname = "/cart";
    const third = render(<RouteFade>third</RouteFade>);
    expect(wrapper(third.container).className).toContain("u-route");
    third.unmount();

    // Returning to the page the visit began on still animates.
    pathname = "/";
    const back = render(<RouteFade>back</RouteFade>);
    expect(wrapper(back.container).className).toContain("u-route");
  });

  it("animates on a rerender in place too, for the day MainLayout moves into a route layout", () => {
    const { container, rerender } = render(<RouteFade>first</RouteFade>);
    pathname = "/products";
    rerender(<RouteFade>second</RouteFade>);
    expect(wrapper(container).className).toContain("u-route");

    // And it keeps animating once navigation has started, including on a
    // return to the page the visit began on.
    pathname = "/";
    rerender(<RouteFade>third</RouteFade>);
    expect(wrapper(container).className).toContain("u-route");
  });

  /**
   * A filter or a sort changes the query string many times per visit, and
   * usePathname excludes it — re-animating a grid under someone adjusting a
   * slider is noise, not motion. This pins the intent: same pathname, same
   * element, no restart.
   */
  it("does not restart when only the query string changes", () => {
    const { container, rerender } = render(<RouteFade>grid</RouteFade>);
    const before = wrapper(container);
    rerender(<RouteFade>grid, filtered</RouteFade>);
    expect(wrapper(container)).toBe(before);
    expect(wrapper(container).className).toBe("");
  });

  it("replaces the element on a real navigation, so the animation runs again", () => {
    const { container, rerender } = render(<RouteFade>first</RouteFade>);
    const before = wrapper(container);
    pathname = "/cart";
    rerender(<RouteFade>second</RouteFade>);
    expect(wrapper(container)).not.toBe(before);
    expect(wrapper(container).textContent).toBe("second");
  });

  it("renders its children exactly once", () => {
    const { container } = render(
      <RouteFade>
        <p>only me</p>
      </RouteFade>,
    );
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });
});
