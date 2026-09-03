"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle, Send, Plus, Trash2, AlertCircle } from "lucide-react";
import { B2BShell } from "@/components/b2b/b2b-shell";
import {
  Button,
  Dateline,
  Eyebrow,
  Field,
  PageHeader,
  Surface,
  Textarea,
} from "@avenick/ui";
import { SelectField, TextField } from "@/components/b2b/controls";
import { submitRFQ } from "../actions";

type Priority = "NORMAL" | "URGENT" | "CRITICAL";

interface RFQItem {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  targetPrice: string;
  specs: string;
}

export interface RFQCategoryOption {
  slug: string;
  label: string;
}

/**
 * Priority is recorded in the RFQ notes for the assigned supplier to read.
 * Nothing routes or times an RFQ by priority, so the descriptions describe
 * what the buyer is telling the supplier — not a response window.
 */
const PRIORITY_CONFIG: Record<Priority, { label: string; rule: string; desc: string }> = {
  NORMAL:   { label: "Normal",   rule: "border-b-border-strong", desc: "Routine purchase" },
  URGENT:   { label: "Urgent",   rule: "border-b-warning",       desc: "Needed soon — flagged to the supplier" },
  CRITICAL: { label: "Critical", rule: "border-b-danger",        desc: "Blocking — flagged to the supplier" },
};

/** The order the options are presented and arrowed through, least to most urgent. */
const PRIORITY_KEYS: Priority[] = ["NORMAL", "URGENT", "CRITICAL"];

/** Units the RFQ form offers. Free text is not accepted by the API. */
const UNITS = ["pcs", "boxes", "kg", "liters", "sets", "meters", "bags", "pallets"];

export function NewRFQForm({
  categories,
  currency,
}: {
  /** Catalog categories loaded by the server page; empty when none could be loaded. */
  categories: RFQCategoryOption[];
  /** The buyer's company currency, or null when the viewer has no company context. */
  currency: string | null;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>("NORMAL");
  const [items, setItems] = useState<RFQItem[]>([
    { id: "1", description: "", quantity: "", unit: "pcs", targetPrice: "", specs: "" },
  ]);

  const priorityRefs = useRef<Partial<Record<Priority, HTMLButtonElement | null>>>({});

  /**
   * Arrow-key travel inside the priority radiogroup.
   *
   * Selection follows focus, which is the expected behaviour for a radio group
   * whose options carry no further consequence. The inline arrows are read
   * against the element's own computed direction rather than assumed to be
   * left-is-previous, so ArrowRight still means "the next option" in Arabic.
   */
  function movePriority(event: React.KeyboardEvent<HTMLButtonElement>, key: Priority) {
    const rtl = typeof window !== "undefined" && getComputedStyle(event.currentTarget).direction === "rtl";
    let step = 0;
    if (event.key === "ArrowDown") step = 1;
    else if (event.key === "ArrowUp") step = -1;
    else if (event.key === "ArrowRight") step = rtl ? -1 : 1;
    else if (event.key === "ArrowLeft") step = rtl ? 1 : -1;
    else return;

    event.preventDefault();
    const index = PRIORITY_KEYS.indexOf(key);
    const next = PRIORITY_KEYS[(index + step + PRIORITY_KEYS.length) % PRIORITY_KEYS.length]!;
    setPriority(next);
    priorityRefs.current[next]?.focus();
  }

  function addItem() {
    setItems((prev) => [...prev, { id: String(Date.now()), description: "", quantity: "", unit: "pcs", targetPrice: "", specs: "" }]);
  }

  function removeItem(id: string) {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateItem(id: string, field: keyof RFQItem, value: string) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, [field]: value } : i));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const category = String(form.get("category") ?? "").trim();
    const requiredBy = String(form.get("requiredBy") ?? "").trim();
    const city = String(form.get("city") ?? "").trim();
    const extraNotes = String(form.get("notes") ?? "").trim();

    const validItems = items.filter((i) => i.description.trim() && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      setError("Add at least one item with a description and quantity.");
      return;
    }

    const payload = {
      notes:
        [
          title && `Subject: ${title}`,
          category && `Category: ${category}`,
          city && `Delivery: ${city}`,
          `Priority: ${priority}`,
          extraNotes,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      requiredBy: requiredBy || undefined,
      items: validItems.map((i) => ({
        nameEn: i.description.trim(),
        quantity: Number(i.quantity),
        // The target price carries the buyer's company currency; a target with
        // no known currency is recorded per unit only rather than labelled
        // with a currency the buyer never chose.
        notes:
          [
            i.specs.trim(),
            i.targetPrice.trim() && `Target: ${i.targetPrice}${currency ? ` ${currency}` : ""}/${i.unit}`,
          ]
            .filter(Boolean)
            .join(" · ") || undefined,
      })),
    };

    setLoading(true);
    try {
      const actionData = new FormData();
      actionData.set("payload", JSON.stringify(payload));
      // On success the server action redirects to the new RFQ's detail page.
      const result = await submitRFQ({}, actionData);
      if (result?.error) setError(result.error);
      else setSubmitted(true);
    } catch (err) {
      // Next.js signals a successful server-action redirect by throwing.
      if (err && typeof err === "object" && "digest" in err && String((err as { digest?: string }).digest).includes("NEXT_REDIRECT")) {
        throw err;
      }
      setError("Couldn't submit the RFQ — please retry.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <B2BShell>
        <div className="max-w-xl space-y-block">
          <div>
            <Eyebrow className="mb-1 flex items-center gap-1.5 text-success-ink">
              <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" /> Recorded
            </Eyebrow>
            <h1 className="u-h1 text-ink-1">Your request for quotation has been recorded.</h1>
            <Dateline className="mt-1.5">
              Response times are not guaranteed and no reminder is sent · track it from your quotes list
            </Dateline>
          </div>

          {/* Steps describe the implemented single-supplier RFQ flow. Automatic
              distribution to matching suppliers and side-by-side comparison are
              not implemented — an RFQ carries at most one supplier. */}
          <Surface rung={1} className="p-5">
            <Eyebrow className="mb-3">What happens next</Eyebrow>
            <ol className="space-y-2">
              {[
                "RFQ recorded against your company",
                "A supplier is assigned to the request",
                "You review the quote when it is submitted",
                "Accepting the quote closes the RFQ; the order is raised separately",
              ].map((step, i) => (
                <li key={step} className="u-ui flex items-start gap-2.5 text-ink-1">
                  <span className="u-meta mt-px grid h-5 w-5 shrink-0 place-items-center rounded-pill bg-neutral-soft font-medium text-ink-2">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </Surface>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="primary"><Link href="/b2b/quotes">View quotes</Link></Button>
            <Button asChild variant="ghost"><Link href="/b2b">Back to overview</Link></Button>
          </div>
        </div>
      </B2BShell>
    );
  }

  return (
    <B2BShell>
      <div className="max-w-3xl">
        <PageHeader
          breadcrumbs={[{ label: "Overview", href: "/b2b" }, { label: "New RFQ" }]}
          eyebrow="Request for quotation"
          title="Create a request for quotation"
          description="Describe what you need and in what quantity. A supplier prices it; nothing is committed by sending it."
          linkComponent={Link}
        />

        <form onSubmit={handleSubmit} className="space-y-block">
          {/* Header info */}
          <Surface rung={2} className="p-5">
            <h2 className="u-h3 mb-4 text-ink-1">The request</h2>
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <Field label="Subject" htmlFor="rfq-title" required className="sm:col-span-2">
                <TextField
                  id="rfq-title"
                  name="title"
                  placeholder="e.g. Safety equipment for a construction site"
                  required
                />
              </Field>
              {/* Options are the catalog's own categories. When none loaded,
                  the buyer types one — the category is free text in the RFQ
                  notes either way, so no list is invented here. */}
              <Field label="Category" htmlFor="rfq-category" required>
                {categories.length > 0 ? (
                  <SelectField id="rfq-category" name="category" required defaultValue="">
                    <option value="" disabled>Select a category</option>
                    {categories.map((c) => <option key={c.slug} value={c.label}>{c.label}</option>)}
                    <option value="Other">Other</option>
                  </SelectField>
                ) : (
                  <TextField id="rfq-category" name="category" placeholder="e.g. Safety & PPE" required />
                )}
              </Field>
              <Field label="Required by" htmlFor="rfq-required-by" required>
                <TextField id="rfq-required-by" name="requiredBy" type="date" required />
              </Field>
              <Field
                label="Delivery city"
                htmlFor="rfq-city"
                hint="Optional — helps the supplier quote freight."
              >
                <TextField id="rfq-city" name="city" placeholder="City, country" />
              </Field>
              {/* No "Preferred supplier" field: the RFQ API accepts none, so an
                  input here would silently discard what the buyer typed. */}
            </div>
          </Surface>

          {/* Priority. The selected card is RAISED and carries a coloured
              underrule; the unselected ones are flat. Depth says "chosen"
              before colour does. */}
          <Surface rung={2} className="p-5">
            <h2 className="u-h3 mb-1 text-ink-1">Priority</h2>
            <Dateline className="mb-3">
              Recorded in the request notes for the supplier to read · nothing routes or times an RFQ by priority
            </Dateline>
            <div
              role="radiogroup"
              aria-label="Priority"
              className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            >
              {PRIORITY_KEYS.map((key) => {
                const cfg = PRIORITY_CONFIG[key];
                const selected = priority === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    // A radiogroup is ONE tab stop with arrow keys inside it, not
                    // three tab stops. Declaring role="radio" and then leaving
                    // every option tabbable and the arrow keys dead promises a
                    // keyboard contract the widget does not honour, which is
                    // worse for a screen-reader user than plain buttons would be.
                    tabIndex={selected ? 0 : -1}
                    ref={(node) => {
                      priorityRefs.current[key] = node;
                    }}
                    onKeyDown={(event) => movePriority(event, key)}
                    // data-rung carries the whole surface treatment: the selected
                    // option is raised off the card, the others are pressed into
                    // it. Depth says "chosen" before the coloured underrule does.
                    data-rung={selected ? 3 : 1}
                    // data-focus-lift rather than u-focus: on an element that
                    // already carries a rung, the plain focus utility REPLACES
                    // the box-shadow, so focusing the chosen option flattened it.
                    // The focus-lift rule keeps the elevation under the ring.
                    data-focus-lift=""
                    onClick={() => setPriority(key)}
                    className={`border border-border p-3 text-start outline-none ${selected ? `border-b-2 ${cfg.rule}` : ""}`}
                  >
                    <p className="u-ui font-medium text-ink-1">{cfg.label}</p>
                    <p className="u-meta mt-0.5 text-ink-2">{cfg.desc}</p>
                  </button>
                );
              })}
            </div>
          </Surface>

          {/* Line items */}
          <Surface rung={2} className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="u-h3 text-ink-1">Line items</h2>
              <Button type="button" variant="secondary" size="sm" onClick={addItem}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add item
              </Button>
            </div>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <fieldset key={item.id} className="border-s-2 border-hairline ps-4">
                  <legend className="sr-only">Item {idx + 1}</legend>
                  <div className="mb-2 flex items-center justify-between">
                    <Eyebrow as="span">Item {idx + 1}</Eyebrow>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        aria-label={`Remove item ${idx + 1}`}
                        onClick={() => removeItem(item.id)}
                        className="hover:text-danger-ink"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                    <Field label="Description" htmlFor={`item-${item.id}-description`} required className="sm:col-span-2">
                      <TextField
                        id={`item-${item.id}-description`}
                        value={item.description}
                        onChange={(e) => updateItem(item.id, "description", e.target.value)}
                        placeholder="e.g. Safety Helmet EN397, Hard Shell, Various Sizes"
                        required
                      />
                    </Field>
                    <Field label="Quantity" htmlFor={`item-${item.id}-quantity`} required>
                      <TextField
                        id={`item-${item.id}-quantity`}
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                        placeholder="100"
                        min={1}
                        required
                      />
                    </Field>
                    <Field label="Unit" htmlFor={`item-${item.id}-unit`}>
                      <SelectField
                        id={`item-${item.id}-unit`}
                        value={item.unit}
                        onChange={(e) => updateItem(item.id, "unit", e.target.value)}
                      >
                        {UNITS.map((u) => <option key={u}>{u}</option>)}
                      </SelectField>
                    </Field>
                    <Field
                      label={`Target unit price${currency ? ` (${currency})` : ""}`}
                      htmlFor={`item-${item.id}-target`}
                      hint={currency ? undefined : "No company currency is set, so a target is recorded per unit only."}
                    >
                      <TextField
                        id={`item-${item.id}-target`}
                        type="number"
                        value={item.targetPrice}
                        onChange={(e) => updateItem(item.id, "targetPrice", e.target.value)}
                        placeholder="0.00"
                        min={0}
                        step="0.01"
                      />
                    </Field>
                    <Field label="Specifications" htmlFor={`item-${item.id}-specs`}>
                      <TextField
                        id={`item-${item.id}-specs`}
                        value={item.specs}
                        onChange={(e) => updateItem(item.id, "specs", e.target.value)}
                        placeholder="Brand, certifications, colour…"
                      />
                    </Field>
                  </div>
                </fieldset>
              ))}
            </div>
          </Surface>

          {/* Additional notes — no attachment control: RFQs carry no documents,
              and a "coming soon" button is a promise, not a feature. */}
          <Surface rung={2} className="p-5">
            <Field label="Additional notes" htmlFor="rfq-notes">
              <Textarea
                id="rfq-notes"
                name="notes"
                placeholder="Any special delivery requirements, packaging instructions, compliance certifications (e.g. SASO, Halal), payment preference, etc."
                rows={3}
              />
            </Field>
          </Surface>

          <Dateline>
            Recorded against your company and tracked in your quotes list · no review or response time is guaranteed
          </Dateline>

          {error && (
            <Surface
              rung={2}
              tone="danger"
              role="alert"
              className="flex items-start gap-2 p-3"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger-ink" aria-hidden="true" />
              <p className="u-ui text-ink-1">{error}</p>
            </Surface>
          )}

          <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
            <Send className="h-4 w-4" aria-hidden="true" />
            Submit RFQ
          </Button>
        </form>
      </div>
    </B2BShell>
  );
}
