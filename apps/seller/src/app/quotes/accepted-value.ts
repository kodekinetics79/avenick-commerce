/**
 * Accepted quote value, grouped by the currency each quote was written in.
 *
 * A seller quoting a Saudi buyer in SAR and a UAE buyer in AED has two totals,
 * not one: adding the numbers and labelling the sum AED overstates or
 * understates the figure by whatever the rate happens to be, and nothing on the
 * page would say so. Grouping keeps every figure in the currency it was agreed
 * in — a total is only ever shown beside its own code.
 */
export interface AcceptedTotal {
  currency: string;
  total: number;
}

export function groupAcceptedValueByCurrency(
  rows: ReadonlyArray<{ currency: string; totalQuoted: string | number | null }>,
): AcceptedTotal[] {
  const byCurrency = new Map<string, number>();
  for (const row of rows) {
    // A quote with no total contributes nothing but must not invent a zero-value
    // currency group either — an accepted RFQ that was never priced is a data
    // gap, and an empty group would read as "accepted, worth nothing".
    if (row.totalQuoted === null || row.totalQuoted === undefined) continue;
    const value = Number(row.totalQuoted);
    if (!Number.isFinite(value)) continue;
    byCurrency.set(row.currency, (byCurrency.get(row.currency) ?? 0) + value);
  }
  // Largest first so the seller's main market leads; ties fall back to the code
  // so the order is stable between renders rather than insertion-dependent.
  return [...byCurrency.entries()]
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => b.total - a.total || a.currency.localeCompare(b.currency));
}
