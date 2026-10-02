// @vitest-environment jsdom

import * as React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeroMarketSignal } from "../hero-market-signal";
import type { MarketPulseItem } from "../market-pulse";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

const ITEMS: MarketPulseItem[] = [
  {
    id: "trend:1",
    slug: "cable-gland",
    name: "Cable gland",
    detail: "CG-32",
    imageUrl: "/cable-gland.png",
    kind: "trending",
  },
  {
    id: "ordered:2",
    slug: "terminal-lug",
    name: "Terminal lug",
    detail: "TL-40",
    imageUrl: null,
    kind: "ordered",
  },
  {
    id: "verified:3",
    slug: "verified-connector",
    name: "Verified connector",
    detail: "13619",
    imageUrl: "/verified-connector.png",
    kind: "verified",
  },
];

function installMotionPreference(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: reduced,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  installMotionPreference(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("hero market signal", () => {
  it("surfaces live catalogue activity above the fold and lets visitors pause it", () => {
    render(<HeroMarketSignal items={ITEMS} />);

    expect(screen.getByRole("link", { name: /Cable gland/ }).getAttribute("href")).toBe(
      "/products/cable-gland",
    );

    act(() => vi.advanceTimersByTime(4400));
    expect(screen.getByRole("link", { name: /Terminal lug/ }).getAttribute("href")).toBe(
      "/products/terminal-lug",
    );

    fireEvent.click(screen.getByRole("button", { name: "marketPulsePause" }));
    act(() => vi.advanceTimersByTime(8800));
    expect(screen.getByRole("link", { name: /Terminal lug/ })).toBeTruthy();
  });

  it("stays still and removes the pause control when reduced motion is requested", () => {
    installMotionPreference(true);
    render(<HeroMarketSignal items={ITEMS} />);

    act(() => vi.advanceTimersByTime(8800));
    expect(screen.getByRole("link", { name: /Cable gland/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "marketPulsePause" })).toBeNull();
  });
});
