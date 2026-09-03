"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, FileUp, ShieldCheck } from "lucide-react";
import { Surface, CellGrid, Button, Eyebrow, Num, Dateline } from "@avenick/ui";

type ImportResult = {
  success: boolean;
  applied?: boolean;
  error?: string;
  data?: {
    rowCount?: number;
    counts?: Record<string, number>;
    verifiedPriceRows?: number;
    sourceStockRows?: number;
    mediaMappedRows?: number;
    warnings?: string[];
    errors?: string[];
    applyEnabled?: boolean;
    imported?: number;
    activeWithVerifiedPrice?: number;
    draftMissingPrice?: number;
    rowsWithSourceStock?: number;
    rowsWithMappedMedia?: number;
    sellerKeys?: string[];
  };
};

export function CatalogImportClient() {
  const t = useTranslations("adminCommerce.catalogImport");
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function submit(apply: boolean) {
    if (!file) return;
    apply ? setApplying(true) : setValidating(true);
    try {
      const response = await fetch(`/api/pilot/catalog-import${apply ? "?apply=1" : ""}`, {
        method: "POST",
        headers: { "content-type": file.name.endsWith(".gz") ? "application/gzip" : "application/json" },
        body: file,
      });
      const body = await response.json() as ImportResult;
      setResult(body);
    } catch (error) {
      setResult({ success: false, error: error instanceof Error ? error.message : t("requestFailed") });
    } finally {
      setValidating(false);
      setApplying(false);
    }
  }

  const data = result?.data;
  const readyToApply = Boolean(result?.success && !result.applied && data?.applyEnabled && file);

  const busy = validating || applying;
  const rows = data ? (data.imported ?? data.rowCount ?? 0) : 0;
  const verified = data ? (data.activeWithVerifiedPrice ?? data.verifiedPriceRows ?? 0) : 0;

  return (
    <div className="space-y-4">
      <Surface tone="warning" className="flex gap-3 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-warning-ink" aria-hidden="true" />
        <div>
          <p className="u-ui font-medium text-ink-1">{t("protected.title")}</p>
          <p className="u-meta mt-1 max-w-prose text-ink-2">{t("protected.body")}</p>
        </div>
      </Surface>

      <Surface className="p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-nested bg-neutral-soft text-ink-3">
            <FileUp className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="u-h3 text-ink-1">{t("upload.title")}</h2>
            <Dateline className="mt-0.5">{t("upload.dateline")}</Dateline>
          </div>
        </div>

        {/* The drop target is recessed — it is an input, and law A says every
            place you can put something into is pressed into the page. */}
        <input
          data-rung={1}
          aria-label={t("upload.fileLabel")}
          className="u-focus mt-5 block w-full border border-dashed border-border p-4 text-ui text-ink-1 file:me-3 file:rounded-nested file:border file:border-border file:bg-surface-3 file:px-3 file:py-1 file:text-meta file:font-medium file:text-ink-1"
          type="file"
          accept=".json,.gz,application/json,application/gzip"
          onChange={(event) => { setFile(event.target.files?.[0] ?? null); setResult(null); }}
        />
        {file && (
          <Dateline className="mt-2">
            {t("upload.selected", { name: file.name, size: (file.size / 1024).toFixed(1) })}
          </Dateline>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={!file || busy}
            loading={validating}
            onClick={() => void submit(false)}
          >
            {!validating && <ShieldCheck className="h-4 w-4" aria-hidden="true" />} {t("upload.validate")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={!readyToApply || applying}
            loading={applying}
            onClick={() => void submit(true)}
          >
            {!applying && <FileUp className="h-4 w-4" aria-hidden="true" />} {t("upload.apply")}
          </Button>
          {/* Applying writes rows. Say so beside the control, not after it. */}
          <span className="u-meta text-ink-3">
            {readyToApply ? t("upload.readyNote") : t("upload.notReadyNote")}
          </span>
        </div>

        {/* The API returns one result for the whole file, so there is no
            percentage to report and a progress bar here would be an invented
            number. This states what is actually true: the request is in flight. */}
        {busy && (
          <p role="status" className="u-meta mt-3 text-ink-2">
            {applying ? t("busy.applying") : t("busy.validating")}
          </p>
        )}
      </Surface>

      {result && (
        // A rejection is announced assertively: the operator has just handed the
        // platform a commercial file and needs to hear that it was refused, not
        // find out later. A pass stays polite.
        <Surface role={result.success ? "status" : "alert"} tone={result.success ? "success" : "danger"} className="p-5">
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-ink" aria-hidden="true" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger-ink" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <p className="u-lead font-medium text-ink-1">
                {result.success ? (result.applied ? t("result.applied") : t("result.validated")) : t("result.rejected")}
              </p>
              {result.error && <p className="u-ui mt-1 max-w-prose text-danger-ink">{result.error}</p>}

              {/* The reasons, not just the verdict. The API returns up to a
                  hundred per-row validation errors and this screen used to show
                  none of them, so an operator was told the catalogue was
                  rejected and never which rows did it. Errors are the reason
                  the rejection panel exists, so they are open by default;
                  warnings, which do not block the import, stay folded away. */}
              {(data?.errors?.length ?? 0) > 0 && (
                <div data-rung={1} className="mt-3 border border-danger-rule p-3">
                  <Eyebrow className="text-danger-ink">
                    {t("result.errorsTitle", { count: String(data!.errors!.length) })}
                  </Eyebrow>
                  <ul className="u-mono mt-2 max-h-64 space-y-0.5 overflow-auto text-meta leading-5 text-ink-2">
                    {data!.errors!.map((message, index) => (
                      <li key={`${index}-${message}`}>{message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {data && (
                <CellGrid cols={{ base: 2, lg: 4 }} density="compact" className="mt-4">
                  {[
                    [t("result.rows"), rows],
                    [t("result.verified"), verified],
                    [t("result.draft"), data.draftMissingPrice ?? Math.max(0, (data.rowCount ?? 0) - (data.verifiedPriceRows ?? 0))],
                    [t("result.sourceStock"), data.rowsWithSourceStock ?? data.sourceStockRows ?? 0],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <Eyebrow>{label}</Eyebrow>
                      <div className="mt-1.5"><Num value={value as number} /></div>
                    </div>
                  ))}
                </CellGrid>
              )}

              {data?.counts && (
                <Dateline className="mt-3">
                  {t("result.sellerRows", {
                    rows: Object.entries(data.counts).map(([seller, count]) => `${seller} ${count}`).join(" · "),
                  })}
                </Dateline>
              )}

              {result.success && !result.applied && !data?.applyEnabled && (
                <p className="u-meta mt-3 font-medium text-warning-ink">{t("result.validationOnly")}</p>
              )}

              {(data?.warnings?.length ?? 0) > 0 && (
                <details className="mt-3">
                  <summary className="u-focus u-ui cursor-pointer rounded-nested font-medium text-ink-1">
                    {t("result.warningsTitle", { count: String(data!.warnings!.length) })}
                  </summary>
                  <div
                    data-rung={1}
                    className="u-mono mt-2 max-h-48 overflow-auto border border-border p-3 text-meta leading-5 text-ink-2"
                  >
                    {data!.warnings!.map((warning) => <div key={warning}>{warning}</div>)}
                  </div>
                </details>
              )}
            </div>
          </div>
        </Surface>
      )}
    </div>
  );
}
