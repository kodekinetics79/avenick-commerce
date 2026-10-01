import type { CurrencyAmount, CurrencyMetric, RevenueSplitByCurrency } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";

export type DashboardLocale = "ar" | "en";

/** Format each amount independently. This function must never add currencies. */
export function formatMoneySeries(rows: CurrencyAmount[], locale: DashboardLocale): string {
  if (rows.length === 0) return "—";
  return [...rows]
    .sort((a, b) => a.currency.localeCompare(b.currency))
    .map((row) => formatCurrency(row.amount, row.currency, locale))
    .join(" · ");
}

export type TrendState =
  | { kind: "measured"; trend: number }
  | { kind: "unmeasured" }
  | { kind: "multiple-currencies" };

/** A single badge cannot truthfully represent multiple independent trends. */
export function trendState(rows: CurrencyMetric[]): TrendState {
  if (rows.length > 1) return { kind: "multiple-currencies" };
  const trend = rows[0]?.trend;
  return trend === null || trend === undefined
    ? { kind: "unmeasured" }
    : { kind: "measured", trend };
}

export function channelPercent(
  row: RevenueSplitByCurrency,
  channel: "b2b" | "b2c",
): number {
  if (row.total <= 0) return 0;
  return Math.round((row[channel] / row.total) * 100);
}
