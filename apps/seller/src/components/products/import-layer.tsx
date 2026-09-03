"use client";

import * as React from "react";
import { AlertCircle, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { Button, Dateline, Eyebrow, FieldWell, Layer } from "@avenick/ui";
import { SELLER_BULK_STATUSES } from "@/lib/product-status-transitions";
import { importProductsCsv } from "@/app/products/actions";
import { PRODUCT_CSV_HEADERS, parseCsv, splitImportIssue, toImportRows } from "./csv";
import type { ActionReportData } from "./action-report";

/**
 * The CSV import, as a sheet rather than a hidden file input.
 *
 * The old control was an invisible `<input type="file">` behind a button: no
 * statement of what the file has to contain, no drop target, and a result
 * squeezed into a four-second toast that showed the first problem and counted
 * the rest. A spreadsheet import is the one action in this portal that can
 * touch a hundred listings at once, so it gets a surface where the seller can
 * read the format before choosing a file and read every refusal afterwards.
 *
 * The layer closes only when the platform has actually answered; a file this
 * page can reject on its own (no data rows, no SKU column) is refused in place,
 * so the seller can pick another file without reopening anything.
 */
export function ImportLayer({
  open,
  onOpenChange,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Handed the report so it can live on the page rather than inside a modal. */
  onComplete: (report: ActionReportData) => void;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [problem, setProblem] = React.useState<{ title: string; detail: string } | null>(null);

  async function run(file: File) {
    setProblem(null);
    setPending(true);
    try {
      const parsed = toImportRows(parseCsv(await file.text()));
      if ("error" in parsed) {
        setProblem(parsed.error);
        return;
      }

      const result = await importProductsCsv(parsed.rows);

      // A row can be updated and still have had a cell refused (a status the
      // seller may not set, an unparseable price), which lands in `errors` with
      // nothing in `skipped`. Reporting only skips let an import read as wholly
      // applied, so every line the platform returned is listed.
      const notes: string[] = [];
      if (result.skipped > 0) {
        notes.push(
          `${result.skipped} row${result.skipped === 1 ? "" : "s"} changed nothing. A row whose SKU cell is empty is counted here without a line of its own, because there is no listing to name.`,
        );
      }
      // Derived from the answer rather than from a copy of the server's batch
      // ceiling: rows the platform neither updated nor skipped were never seen.
      const unprocessed = parsed.rows.length - (result.updated + result.skipped);
      if (unprocessed > 0) {
        notes.push(
          `${unprocessed} row${unprocessed === 1 ? " was" : "s were"} not processed — an import is applied in a bounded batch. Split the file and import the remainder.`,
        );
      }

      onComplete({
        tone: result.updated > 0 ? (result.errors.length > 0 ? "warning" : "success") : "danger",
        headline: `${result.updated} listing${result.updated === 1 ? "" : "s"} updated from ${file.name}`,
        dateline: `Rows matched to your catalog by SKU · ${parsed.rows.length} data row${parsed.rows.length === 1 ? "" : "s"} read from the file`,
        linesTitle: "What the platform refused",
        lines: result.errors.map((message, index) => {
          const { sku, detail } = splitImportIssue(message);
          return { key: `${index}-${message}`, label: sku ?? "Row", detail };
        }),
        ...(notes.length > 0 ? { note: notes.join(" ") } : {}),
      });
      onOpenChange(false);
    } catch (error) {
      setProblem({
        title: "The import did not run",
        detail: error instanceof Error ? error.message : "Nothing was changed. Try the file again.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Layer
      open={open}
      onOpenChange={(next) => {
        // Never yank a running import out from under the seller: the request is
        // already with the platform and its answer is what the report is built
        // from. This is the only place the layer refuses to close.
        if (!pending) onOpenChange(next);
      }}
      title="Import a product CSV"
      description="Existing listings are matched by SKU and updated. A SKU that is not already in your catalog is reported back, never created."
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = ""; // allow re-importing the same file
            if (file) void run(file);
          }}
        />

        {/* A real <button>, so the drop target is reachable from the keyboard
            and carries the system focus ring. Dragging is an enhancement on top
            of it, never the only way in. */}
        <button
          type="button"
          disabled={pending}
          onClick={() => fileRef.current?.click()}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (pending) return;
            const dropped = event.dataTransfer.files;
            if (!dropped || dropped.length === 0) return;
            // One import at a time, and say so rather than swallowing the rest:
            // silently applying the first of four dropped files and discarding
            // three is exactly the kind of unreported outcome this panel exists
            // to stop.
            if (dropped.length > 1) {
              setProblem({
                title: "One file at a time",
                detail: `${dropped.length} files were dropped. Nothing was imported — drop the one you want applied.`,
              });
              return;
            }
            void run(dropped[0]);
          }}
          data-dragging={dragging ? "true" : "false"}
          data-rung={1}
          className={[
            "u-focus flex w-full flex-col items-center gap-2 border-2 border-dashed border-border px-6 py-10 text-center",
            "transition-[border-color,background-color] duration-hover ease-standard",
            "hover:border-border-strong disabled:opacity-60",
            "data-[dragging=true]:border-primary",
          ].join(" ")}
        >
          {pending ? (
            <Loader2 className="h-6 w-6 animate-spin text-ink-3" aria-hidden="true" />
          ) : (
            <UploadCloud className="h-6 w-6 text-ink-3" aria-hidden="true" />
          )}
          <span className="u-body font-medium text-ink-1">
            {pending ? "Applying the file…" : dragging ? "Drop the file to import it" : "Drop a CSV here, or choose a file"}
          </span>
          <span className="u-meta text-ink-3">Comma separated, with a header row.</span>
        </button>

        {problem && (
          <p role="alert" className="flex items-start gap-2 text-ui text-danger-ink">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-medium">{problem.title}.</span> {problem.detail}
            </span>
          </p>
        )}

        <FieldWell padded className="space-y-2">
          <Eyebrow className="flex items-center gap-1.5">
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" /> Columns
          </Eyebrow>
          <p className="u-mono text-meta text-ink-1">{PRODUCT_CSV_HEADERS.join(",")}</p>
          <ul className="u-ui space-y-1 text-ink-2">
            <li>
              <span className="u-mono text-meta text-ink-1">sku</span> — required. It is how a row finds its listing.
            </li>
            <li>
              <span className="u-mono text-meta text-ink-1">nameEn</span>,{" "}
              <span className="u-mono text-meta text-ink-1">nameAr</span>,{" "}
              <span className="u-mono text-meta text-ink-1">price</span>,{" "}
              <span className="u-mono text-meta text-ink-1">stock</span> — optional. An empty cell leaves that value alone.
            </li>
            <li>
              <span className="u-mono text-meta text-ink-1">status</span> — optional. The only values a cell may carry are{" "}
              {SELLER_BULK_STATUSES.map((value, index) => (
                <React.Fragment key={value}>
                  {index > 0 && " or "}
                  {/* The literal cell value, not the label the table shows: this
                      is what has to be typed into the spreadsheet, so it is set
                      in the mono face like every other identifier here. */}
                  <span className="u-mono text-meta text-ink-1">{value}</span>
                </React.Fragment>
              ))}
              . Every other move belongs to review or to the platform, and a cell asking for one is reported back rather
              than applied.
            </li>
          </ul>
          <Dateline>Export the table first to get a file already in this shape.</Dateline>
        </FieldWell>
      </div>
    </Layer>
  );
}
