import * as React from "react";
import { Dateline } from "@avenick/ui";

export type SpecRow = {
  label: string;
  /** null means the supplier has not recorded it. */
  value: string | null;
  mono?: boolean;
};

/**
 * The specification list.
 *
 * THE REPEATED NULL IS GONE. The previous version printed "Not recorded" on its
 * own row for every field the supplier had left blank, so a sparsely-filled
 * product rendered a wall whose loudest signal was absence. Truth does not
 * require printing the same null eight times: the recorded facts get the table,
 * and the unrecorded field NAMES are collapsed into a single provenance line
 * beneath it. Nothing is hidden and nothing is invented — the reader still
 * learns exactly which fields the supplier left blank, in one line instead of
 * eight rows.
 *
 * Two columns of dense label/figure pairs on a hairline grid, which is the
 * ledger voice this product speaks everywhere else. A procurement manager reads
 * a spec table the way he reads a datasheet: down the values, not across the
 * labels — so the values are end-aligned and the SKU is set in mono.
 */
export function SpecList({ rows, unrecordedLabel }: { rows: SpecRow[]; unrecordedLabel: (fields: string) => string }) {
  const recorded = rows.filter((row) => row.value !== null);
  const unrecorded = rows.filter((row) => row.value === null);

  return (
    <>
      <dl className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
        {recorded.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-4 border-b border-hairline py-2.5"
          >
            <dt className="u-ui text-ink-3">{row.label}</dt>
            <dd className={`u-ui text-end text-ink-1 ${row.mono ? "u-mono" : "fig"}`}>{row.value}</dd>
          </div>
        ))}
      </dl>

      {unrecorded.length > 0 && (
        <Dateline className="mt-3">
          {unrecordedLabel(unrecorded.map((row) => row.label).join(" · "))}
        </Dateline>
      )}
    </>
  );
}
