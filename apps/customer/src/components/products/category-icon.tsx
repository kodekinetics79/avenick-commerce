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

export function categoryIcon(iconName: string | null | undefined): LucideIcon {
  if (!iconName) return Package;
  return CATEGORY_ICONS[iconName] ?? Package;
}
