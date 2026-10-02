"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Pause, Play, Radio } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MarketPulseItem } from "./market-pulse";

const ADVANCE_MS = 4400;

export function HeroMarketSignal({ items }: { items: MarketPulseItem[] }) {
  const t = useTranslations("home");
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const total = items.length;

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const rotating = total > 1 && !paused && !hovered && !focused && !reducedMotion;

  React.useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => setIndex((current) => (current + 1) % total), ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [index, rotating, total]);

  if (total === 0) return null;

  const item = items[index] ?? items[0];
  if (!item) return null;
  const label =
    item.kind === "trending"
      ? t("marketPulseTrending")
      : item.kind === "ordered"
        ? t("marketPulseOrdered")
        : item.kind === "verified"
          ? t("marketPulseVerified")
          : t("marketPulseNew");

  return (
    <div
      className="marketplace-hero-signal"
      role="group"
      aria-label={t("marketPulseCarouselLabel")}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) =>
        setFocused(event.currentTarget.contains(event.relatedTarget as Node | null))
      }
    >
      <span className="marketplace-hero-signal-live" aria-hidden="true">
        <Radio />
      </span>
      <div
        key={item.id}
        className="marketplace-hero-signal-copy"
        aria-live={rotating ? "off" : "polite"}
      >
        <span>{label}</span>
        <Link href={`/products/${item.slug}`} className="u-focus">
          <strong>{item.name}</strong>
          <ArrowRight aria-hidden="true" className="rtl:rotate-180" />
        </Link>
      </div>
      {total > 1 ? (
        <div className="marketplace-hero-signal-controls">
          <span aria-hidden="true">
            {String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}
          </span>
          {reducedMotion ? null : (
            <button
              type="button"
              onClick={() => setPaused((current) => !current)}
              aria-label={paused ? t("marketPulsePlay") : t("marketPulsePause")}
            >
              {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
