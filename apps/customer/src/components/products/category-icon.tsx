import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  Briefcase,
  Building2,
  Cpu,
  Factory,
  HardHat,
  Package,
  ShieldCheck,
  Stethoscope,
  Truck,
  UtensilsCrossed,
  Wrench,
  Zap,
} from "lucide-react";

/**
 * Category.iconName is a lucide icon name chosen by whoever created the
 * category. Only a curated subset is bundled — importing the whole lucide
 * namespace would pull every icon into the page — so an unknown or missing
 * name falls back to a neutral box. The icon is decoration, not a fact about
 * the category, which is why a fallback here is acceptable where a fallback
 * label would not be.
 */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Boxes,
  Briefcase,
  Building2,
  Cpu,
  Factory,
  HardHat,
  Package,
  ShieldCheck,
  Stethoscope,
  Truck,
  UtensilsCrossed,
  Wrench,
  Zap,
};

/**
 * Ordered, so the fallback below is stable: index N always maps to the same
 * icon for the same slug, on the server and the client and across deploys.
 */
const FALLBACK_ICONS: LucideIcon[] = [
  Zap, Cpu, Wrench, Boxes, Factory, ShieldCheck, Truck, Briefcase, Building2, HardHat,
];

/**
 * Pick a stable icon for a category that carries no iconName.
 *
 * Every category in the live catalogue has a null iconName, so the fallback was
 * the ONLY branch taken — and it returned the same neutral box for all of them.
 * Seven identical tiles in a row is what makes a populated catalogue read as an
 * unfinished one. Deriving the icon from the slug gives the row variety without
 * claiming anything: the icon is decoration, which is exactly why varying it is
 * safe where varying a label would not be.
 */
function fallbackIcon(slug: string | null | undefined): LucideIcon {
  if (!slug) return Package;
  let hash = 0;
  for (let index = 0; index < slug.length; index += 1) {
    hash = (hash * 31 + slug.charCodeAt(index)) | 0;
  }
  return FALLBACK_ICONS[Math.abs(hash) % FALLBACK_ICONS.length] ?? Package;
}

export function categoryIcon(iconName: string | null | undefined, slug?: string | null): LucideIcon {
  if (iconName && CATEGORY_ICONS[iconName]) return CATEGORY_ICONS[iconName]!;
  return fallbackIcon(slug ?? iconName ?? null);
}
