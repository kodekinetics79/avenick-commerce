"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  Pause,
  Play,
} from "lucide-react";
import { useTranslations } from "next-intl";

export type MarketPulseKind = "trending" | "ordered" | "new";

export interface MarketPulseItem {
  id: string;
  slug: string;
  name: string;
  detail: string | null;
  imageUrl: string | null;
  kind: MarketPulseKind;
}

const ADVANCE_MS = 5600;

export function MarketPulse({ items }: { items: MarketPulseItem[] }) {
  const t = useTranslations("home");
  const total = items.length;
  const [index, setIndex] = React.useState(0);
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [tabHidden, setTabHidden] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const [stopped, setStopped] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  React.useEffect(() => {
    const sync = () => setTabHidden(document.visibilityState === "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  const rotating = total > 1 && !reducedMotion && !stopped && !hovered && !focused && !tabHidden;

  React.useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => setIndex((current) => (current + 1) % total), ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [index, rotating, total]);

  const step = React.useCallback(
    (delta: number) => setIndex((current) => (current + delta + total) % total),
    [total],
  );

  if (total === 0) return null;

  const kindLabel = (kind: MarketPulseKind) => {
    if (kind === "trending") return t("marketPulseTrending");
    if (kind === "ordered") return t("marketPulseOrdered");
    return t("marketPulseNew");
  };

  const kindBasis = (kind: MarketPulseKind) => {
    if (kind === "trending") return t("marketPulseTrendingBasis");
    if (kind === "ordered") return t("marketPulseOrderedBasis");
    return t("marketPulseNewBasis");
  };

  return (
    <section className="marketplace-pulse-section" aria-labelledby="marketplace-pulse-title">
      <div
        className="marketplace-pulse"
        role="group"
        aria-roledescription={t("marketPulseCarouselRole")}
        aria-label={t("marketPulseCarouselLabel")}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(event) =>
          setFocused(event.currentTarget.contains(event.relatedTarget as Node | null))
        }
      >
        <div className="marketplace-pulse-heading">
          <span className="marketplace-pulse-mark" aria-hidden="true">
            <Activity />
          </span>
          <div>
            <p>{t("marketPulseLive")}</p>
            <h2 id="marketplace-pulse-title">{t("marketPulseTitle")}</h2>
          </div>
          <span className="marketplace-pulse-count" aria-hidden="true">
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>

        <div className="marketplace-pulse-slides" aria-live={rotating ? "off" : "polite"}>
          {items.map((item, itemIndex) => {
            const active = itemIndex === index;
            return (
              <article
                key={item.id}
                className="marketplace-pulse-slide"
                data-active={active ? "true" : "false"}
                aria-hidden={active ? undefined : true}
              >
                <Link
                  href={`/products/${item.slug}`}
                  className="marketplace-pulse-link u-focus"
                  tabIndex={active ? undefined : -1}
                >
                  <span className="marketplace-pulse-image" aria-hidden="true">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt=""
                        fill
                        sizes="(max-width: 767px) 7rem, 18rem"
                      />
                    ) : (
                      <PackageSearch />
                    )}
                  </span>
                  <span className="marketplace-pulse-copy">
                    <span className="marketplace-pulse-kind">{kindLabel(item.kind)}</span>
                    <strong>{item.name}</strong>
                    {item.detail ? <small>{item.detail}</small> : null}
                    <span className="marketplace-pulse-basis">{kindBasis(item.kind)}</span>
                    <span className="marketplace-pulse-action">
                      {t("marketPulseView")}
                      <ArrowRight aria-hidden="true" className="rtl:rotate-180" />
                    </span>
                  </span>
                </Link>
              </article>
            );
          })}
        </div>

        {total > 1 ? (
          <div className="marketplace-pulse-controls">
            <button type="button" onClick={() => step(-1)} aria-label={t("marketPulsePrev")}>
              <ChevronLeft aria-hidden="true" className="rtl:rotate-180" />
            </button>
            <div className="marketplace-pulse-dots">
              {items.map((item, itemIndex) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setIndex(itemIndex)}
                  aria-label={t("marketPulseGoTo", { name: item.name })}
                  aria-current={itemIndex === index ? "true" : undefined}
                >
                  <span aria-hidden="true" />
                </button>
              ))}
            </div>
            {reducedMotion ? null : (
              <button
                type="button"
                onClick={() => setStopped((current) => !current)}
                aria-label={stopped ? t("marketPulsePlay") : t("marketPulsePause")}
              >
                {stopped ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
              </button>
            )}
            <button type="button" onClick={() => step(1)} aria-label={t("marketPulseNext")}>
              <ChevronRight aria-hidden="true" className="rtl:rotate-180" />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
