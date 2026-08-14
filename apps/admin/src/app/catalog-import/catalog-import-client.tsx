"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, ShieldCheck } from "lucide-react";

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
      setResult({ success: false, error: error instanceof Error ? error.message : "Catalog request failed" });
    } finally {
      setValidating(false);
      setApplying(false);
    }
  }

  const data = result?.data;
  const readyToApply = Boolean(result?.success && !result.applied && data?.applyEnabled && file);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Protected pilot-data path</p>
            <p className="mt-1 text-xs leading-5">Commercial catalog files are sent directly to the authenticated Admin API and are never committed to Git. Validate first. Applying is separately gated by deployment environment controls.</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><FileUp className="h-5 w-5 text-primary" /></div>
          <div><h2 className="font-semibold">Upload normalized pilot catalog</h2><p className="text-xs text-muted-foreground">Accepted: version-1 JSON or JSON.gz · maximum 8 MB</p></div>
        </div>
        <input
          className="mt-5 block w-full rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm"
          type="file"
          accept=".json,.gz,application/json,application/gzip"
          onChange={(event) => { setFile(event.target.files?.[0] ?? null); setResult(null); }}
        />
        {file && <p className="mt-2 text-xs text-muted-foreground">Selected: {file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button disabled={!file || validating || applying} onClick={() => void submit(false)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50">
            {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Validate only
          </button>
          <button disabled={!readyToApply || applying} onClick={() => void submit(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-primary px-4 text-sm font-semibold text-primary disabled:opacity-40">
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Apply to pilot database
          </button>
        </div>
      </div>

      {result && (
        <div className={`rounded-2xl border p-5 ${result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          <div className="flex items-start gap-3">
            {result.success ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-700" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-red-700" />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{result.success ? (result.applied ? "Catalog applied" : "Validation passed") : "Catalog rejected"}</p>
              {result.error && <p className="mt-1 text-sm text-red-700">{result.error}</p>}
              {data && (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Rows", data.imported ?? data.rowCount ?? 0],
                    ["Verified price", data.activeWithVerifiedPrice ?? data.verifiedPriceRows ?? 0],
                    ["Draft / no price", data.draftMissingPrice ?? Math.max(0, (data.rowCount ?? 0) - (data.verifiedPriceRows ?? 0))],
                    ["Source stock", data.rowsWithSourceStock ?? data.sourceStockRows ?? 0],
                  ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-white/70 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-bold">{value}</p></div>)}
                </div>
              )}
              {data?.counts && <p className="mt-3 text-xs text-muted-foreground">Seller rows: {Object.entries(data.counts).map(([seller, count]) => `${seller} ${count}`).join(" · ")}</p>}
              {result.success && !result.applied && !data?.applyEnabled && <p className="mt-3 text-xs font-medium text-amber-800">This deployment is validation-only. Pilot write gates are not enabled.</p>}
              {(data?.warnings?.length ?? 0) > 0 && <details className="mt-3 text-xs"><summary className="cursor-pointer font-medium">Warnings ({data!.warnings!.length} shown)</summary><div className="mt-2 max-h-48 overflow-auto rounded-lg bg-white/70 p-3 font-mono leading-5">{data!.warnings!.map((warning) => <div key={warning}>{warning}</div>)}</div></details>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
