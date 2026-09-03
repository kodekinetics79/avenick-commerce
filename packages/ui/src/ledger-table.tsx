import * as React from "react";
import { cn } from "@avenick/utils";
import { Surface } from "./surface";
import { Eyebrow } from "./eyebrow";
import { Dateline } from "./dateline";

/**
 * LedgerTable — a table that reads as a printed ledger rather than a grid of boxes.
 *
 * The rules, and they are the whole component:
 *   · no zebra striping and no vertical column rules — a 1px hairline BETWEEN
 *     rows is the only interior line, because a rule per column is what makes a
 *     twelve-column admin table read as boxes inside boxes;
 *   · a 2px --border-strong underrule beneath a micro-caps head;
 *   · numeric columns are text-end and tabular, so digits align down the column;
 *   · row height comes from the portal's --row-h token, so the same component is
 *     44px on the storefront and 32px in the console;
 *   · the whole thing sits in a rung-1 well, and the sticky head is the ONLY
 *     glass permitted inside a table.
 *
 * `empty` is required. There is no undefined empty state in this system: in a
 * product whose truth law forbids filling a blank surface with fiction, an
 * honest empty surface has to read as deliberate rather than broken.
 */
export interface LedgerColumn<Row> {
  key: string;
  label: string;
  /** Numeric columns get tabular figures and inline-end alignment. */
  numeric?: boolean;
  align?: "start" | "center" | "end";
  /** Any CSS width, e.g. "160px" or "20%". */
  width?: string;
  /** Cell renderer. Defaults to reading `row[key]`. */
  render?: (row: Row, index: number) => React.ReactNode;
  /** Hides the column below the sm breakpoint. */
  hideOnMobile?: boolean;
}

export interface LedgerTableProps<Row> {
  columns: LedgerColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row, index: number) => string;
  /** Rendered in place of the table body when `rows` is empty. Required. */
  empty: React.ReactNode;
  density?: "comfortable" | "compact";
  stickyHead?: boolean;
  /** Optional title above the table. */
  title?: string;
  /** Provenance for the whole table — what these rows are, over what window. */
  dateline?: string;
  /** Toolbar rendered opposite the title. */
  toolbar?: React.ReactNode;
  /** Footer note, e.g. pagination summary. */
  footer?: React.ReactNode;
  /** Per-row attributes, e.g. the data-commit state from useCommitState. */
  rowProps?: (row: Row, index: number) => React.HTMLAttributes<HTMLTableRowElement>;
  className?: string;
}

export function LedgerTable<Row>({
  columns,
  rows,
  getRowKey,
  empty,
  density = "comfortable",
  stickyHead = false,
  title,
  dateline,
  toolbar,
  footer,
  rowProps,
  className,
}: LedgerTableProps<Row>) {
  const cellPadding = density === "compact" ? "px-3" : "px-4";

  return (
    <Surface rung={1} className={cn("overflow-hidden", className)}>
      {(title || toolbar || dateline) && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 pb-3">
          <div className="min-w-0">
            {title && <h2 className="u-h3 text-ink-1">{title}</h2>}
            {dateline && <Dateline className="mt-0.5">{dateline}</Dateline>}
          </div>
          {toolbar && <div className="flex items-center gap-2 ms-auto shrink-0">{toolbar}</div>}
        </div>
      )}

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse">
          <thead
            className={cn(
              // The sticky head lifts off the well on scroll. This is the one
              // place a blurred surface is allowed inside a table.
              stickyHead && "sticky top-0 z-10",
            )}
            data-rung={stickyHead ? 4 : undefined}
            data-glass={stickyHead ? "true" : undefined}
          >
            <tr className="border-b-2 border-border-strong">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    cellPadding,
                    "py-2 align-middle whitespace-nowrap",
                    col.numeric || col.align === "end" ? "text-end" : col.align === "center" ? "text-center" : "text-start",
                    col.hideOnMobile && "hidden sm:table-cell",
                  )}
                >
                  <Eyebrow as="span" className="block">
                    {col.label}
                  </Eyebrow>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const extra = rowProps?.(row, index) ?? {};
                return (
                  <tr
                    key={getRowKey(row, index)}
                    {...extra}
                    className={cn(
                      "u-ledger-row border-b border-hairline last:border-b-0",
                      extra.className,
                    )}
                    style={{ height: "var(--row-h)", ...extra.style }}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          cellPadding,
                          "align-middle text-ui text-ink-1",
                          col.numeric && "fig text-end",
                          !col.numeric && col.align === "end" && "text-end",
                          !col.numeric && col.align === "center" && "text-center",
                          col.hideOnMobile && "hidden sm:table-cell",
                        )}
                      >
                        {col.render
                          ? col.render(row, index)
                          : ((row as Record<string, unknown>)[col.key] as React.ReactNode)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {footer && (
        <div className="u-meta border-t border-hairline px-4 py-2.5 text-ink-3">{footer}</div>
      )}
    </Surface>
  );
}
