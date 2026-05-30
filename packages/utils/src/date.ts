import { format, formatDistanceToNow, isAfter, isBefore, addDays } from "date-fns";
import { ar, enUS } from "date-fns/locale";

type Locale = "ar" | "en";

export function formatDate(date: Date | string, locale: Locale = "en"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd MMM yyyy", { locale: locale === "ar" ? ar : enUS });
}

export function formatDateTime(date: Date | string, locale: Locale = "en"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd MMM yyyy, HH:mm", { locale: locale === "ar" ? ar : enUS });
}

export function formatRelative(date: Date | string, locale: Locale = "en"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, {
    addSuffix: true,
    locale: locale === "ar" ? ar : enUS,
  });
}

export function isExpired(date: Date | string): boolean {
  const d = typeof date === "string" ? new Date(date) : date;
  return isBefore(d, new Date());
}

export function isExpiringSoon(date: Date | string, withinDays = 30): boolean {
  const d = typeof date === "string" ? new Date(date) : date;
  return isAfter(d, new Date()) && isBefore(d, addDays(new Date(), withinDays));
}

export function getDeliveryEstimate(
  daysMin: number,
  daysMax: number,
  locale: Locale = "en",
): string {
  const min = addDays(new Date(), daysMin);
  const max = addDays(new Date(), daysMax);
  const opts = { locale: locale === "ar" ? ar : enUS };
  return `${format(min, "dd MMM", opts)} – ${format(max, "dd MMM", opts)}`;
}
