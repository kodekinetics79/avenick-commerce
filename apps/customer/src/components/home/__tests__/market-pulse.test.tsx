// @vitest-environment jsdom

import * as React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketPulse, type MarketPulseItem } from "../market-pulse";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { name?: string }) => values?.name ?? key,
}));

vi.mock("next/image", () => ({
  default: ({ src }: { src: string }) => <span data-image-src={src} />,
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

describe("market pulse", () => {
  it("rotates real catalogue links and lets the visitor pause the motion", () => {
    const { container } = render(<MarketPulse items={ITEMS} />);
    const slides = Array.from(container.querySelectorAll(".marketplace-pulse-slide"));

    expect(slides[0]?.getAttribute("data-active")).toBe("true");
    expect(slides[1]?.getAttribute("data-active")).toBe("false");
    expect(screen.getByRole("link", { name: /Cable gland/ }).getAttribute("href")).toBe(
      "/products/cable-gland",
    );

    act(() => vi.advanceTimersByTime(5600));
    expect(slides[1]?.getAttribute("data-active")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "marketPulsePause" }));
    act(() => vi.advanceTimersByTime(11200));
    expect(slides[1]?.getAttribute("data-active")).toBe("true");
  });

  it("does not auto-rotate or expose a pause control under reduced motion", () => {
    installMotionPreference(true);
    const { container } = render(<MarketPulse items={ITEMS} />);
    const slides = Array.from(container.querySelectorAll(".marketplace-pulse-slide"));

    act(() => vi.advanceTimersByTime(11200));
    expect(slides[0]?.getAttribute("data-active")).toBe("true");
    expect(screen.queryByRole("button", { name: "marketPulsePause" })).toBeNull();
  });
});
