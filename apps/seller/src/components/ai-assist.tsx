"use client";

import * as React from "react";
import { Sparkles, Copy, Check } from "lucide-react";
import { Button, Dateline, Field, Layer, Surface, Textarea } from "@avenick/ui";
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
  /**
   * The reason there is no draft, when there is no draft. Separate from
   * `result` on purpose — see the comment in generate().
   */
  const [unavailable, setUnavailable] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const fieldId = React.useId();

  async function generate() {
    setLoading(true);
    setResult("");
    setUnavailable("");
    try {
      const r = await fetch("/api/ai/draft", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, context }) });
      const d = await r.json();
      if (!r.ok || d.success === false) {
        toast({ title: d.error ?? "Couldn't generate a draft", variant: "error" });
        setLoading(false);
        return;
      }

      const text: string = d.data?.text ?? "";
      if (d.data?.ai === true && text.trim()) {
        setResult(text);
      } else if (d.data?.ai === true) {
        // ai:true with an empty body. generateDraft trims the model's reply and
        // can hand back an empty string, and the old branch put that straight
        // into `result`: the panel rendered a blank plate with a Copy button
        // beside it and the footer went back to saying "Generate", so nothing on
        // screen said anything had happened. Say that nothing came back.
        setUnavailable("The service returned an empty draft. Try again, or add more detail above.");
      } else {
        /**
         * When `ai` is false the API has NOT returned a template — it returns a
         * sentence explaining why there is nothing ("AI drafting is not
         * configured in this environment", "Couldn't reach the AI service").
         * This UI used to drop that sentence into the draft panel and raise a
         * toast reading "Draft ready (template)", so a seller could copy
         * "AI drafting is not configured in this environment." straight into a
         * reply to a buyer. There is no template. It is shown as the
         * unavailable state it actually is, with no Copy control on it.
         */
        setUnavailable(text || "Drafting is unavailable right now.");
      }
    } catch {
      toast({ title: "Couldn't generate a draft", variant: "error" });
    }
    setLoading(false);
  }

  // The "Copied" acknowledgement is a timer, and a timer that outlives its
  // component sets state on something that is gone.
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  async function copy() {
    // The confirmation waits for the write. It used to fire regardless, so a
    // rejected clipboard permission produced a "Copied to clipboard" toast for
    // a clipboard that had not been written.
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      toast({ title: "Copied to clipboard", variant: "success" });
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Couldn't copy the draft", description: "Select the text and copy it manually.", variant: "error" });
    }
  }

  const heading = title ?? (kind === "rfq" ? "Draft a quote reply" : "Write listing copy");

  return (
    <>
      {/* The trigger. Callers that need it to sit in a toolbar pass buttonClass
          and own the styling; everyone else gets the system's secondary button
          rather than the old indigo→violet gradient with a glow on hover. */}
      {buttonClass ? (
        <button type="button" onClick={() => setOpen(true)} className={buttonClass}>
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {label}
        </button>
      ) : (
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {label}
        </Button>
      )}

      {/* The shared <Layer>, so this sheet arrives with a focus trap, Escape, a
          scroll lock and the same Z entry as every other layer in the product.
          The hand-rolled overlay it replaces had a scrim you could only dismiss
          with a mouse and no way out on the keyboard at all. */}
      <Layer
        open={open}
        onOpenChange={setOpen}
        title={heading}
        description="A starting point written from the text you enter. Read it before you send it."
        size="lg"
        footer={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={generate} loading={loading}>
              {!loading && <Sparkles className="h-4 w-4" aria-hidden="true" />}
              {result || unavailable ? "Regenerate" : "Generate"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field
            label={kind === "rfq" ? "RFQ details / what to address" : "Product name & key specs"}
            htmlFor={fieldId}
            hint="Only this text is sent. Nothing is read from your catalogue."
          >
            <Textarea
              id={fieldId}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
              placeholder={kind === "rfq" ? "e.g. Safety helmets EN397 × 200, needed in Dubai within 2 weeks" : "e.g. CNC bearing assortment, hardened steel, ISO 9001"}
              className="resize-none"
            />
          </Field>

          {unavailable && (
            // Not a draft, and deliberately not shaped like one: no copy control,
            // no result framing. Saying plainly that there is nothing is the
            // honest surface here.
            <Surface rung={1} tone="warning" className="p-3.5">
              <p className="u-ui text-ink-1">{unavailable}</p>
            </Surface>
          )}

          {result && (
            // Rung 1: the draft is output to read and lift from, not an object to
            // act on — the actions on it are the two controls beneath the rule.
            <Surface rung={1} className="p-3.5">
              <p className="u-body whitespace-pre-wrap text-ink-1">{result}</p>
              {/* LAW E. What this text is, and what it is not, stated at the
                  point where somebody is about to send it to a buyer. */}
              <Dateline className="mt-3">
                Written from the text above · not checked against your catalogue, stock, prices or lead times
              </Dateline>
              <div className="mt-3 flex items-center gap-2 border-t border-hairline pt-3">
                <Button type="button" variant="secondary" size="xs" onClick={copy}>
                  {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </Surface>
          )}
        </div>
      </Layer>
    </>
  );
}
