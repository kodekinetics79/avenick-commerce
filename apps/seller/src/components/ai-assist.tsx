"use client";

import * as React from "react";
import { Sparkles, X, Copy, Check, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/components/toast";

export function AiAssist({
  kind,
  seed = "",
  label = "AI assist",
  title,
  buttonClass,
}: {
  kind: "rfq" | "listing";
  seed?: string;
  label?: string;
  title?: string;
  buttonClass?: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [context, setContext] = React.useState(seed);
  const [result, setResult] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  async function generate() {
    setLoading(true);
    setResult("");
    try {
      const r = await fetch("/api/ai/draft", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, context }) });
      const d = await r.json();
      setResult(d.text ?? "");
      if (d.ai === false && d.text) toast({ title: "Draft ready (template)", description: "Set ANTHROPIC_API_KEY for AI-generated drafts.", variant: "info" });
    } catch {
      toast({ title: "Couldn't generate a draft", variant: "error" });
    }
    setLoading(false);
  }

  function copy() {
    navigator.clipboard.writeText(result);
    setCopied(true);
    toast({ title: "Copied to clipboard", variant: "success" });
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass ?? "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-gradient-to-r from-primary-600 to-accent-600 text-white text-sm font-semibold hover:opacity-90 hover:shadow-glow-sm transition-all active:scale-[0.98]"}
      >
        <Sparkles className="h-3.5 w-3.5" /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-popover text-popover-foreground shadow-elevated overflow-hidden animate-fade-up">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-primary-500 to-accent-600 text-white"><Sparkles className="h-4 w-4" /></span>
                <p className="font-semibold text-sm">{title ?? (kind === "rfq" ? "Draft a quote reply" : "Write listing copy")}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>

            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{kind === "rfq" ? "RFQ details / what to address" : "Product name & key specs"}</label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={3}
                  placeholder={kind === "rfq" ? "e.g. Safety helmets EN397 × 200, needed in Dubai within 2 weeks" : "e.g. CNC bearing assortment, hardened steel, ISO 9001"}
                  className="w-full px-3 py-2.5 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <button
                type="button"
                onClick={generate}
                disabled={loading}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {result ? "Regenerate" : "Generate"}
              </button>

              {result && (
                <div className="rounded-xl border border-border bg-card p-3.5">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{result}</p>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                    <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
                    </button>
                    <button type="button" onClick={generate} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" /> Regenerate</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
