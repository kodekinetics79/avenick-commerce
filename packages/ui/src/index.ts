/**
 * @avenick/ui — the Meridian design system.
 *
 * Rule for every surface team: if a page needs a surface treatment these
 * primitives do not offer, the fix is a PR to this package. Never a local
 * `<div className="rounded-2xl border border-border bg-card shadow-sm">`.
 *
 * Reference: packages/ui/DESIGN_SYSTEM.md
 */

/* ── Foundation ─────────────────────────────────────────────────────────── */
// Variants live outside the "use client" button module so a server component
// can call them; see button-variants.ts.
export * from "./button-variants";
export * from "./surface";
export * from "./ambient-field";
export * from "./divider";
export * from "./specular-surface";

/* ── Type & truth ───────────────────────────────────────────────────────── */
export * from "./eyebrow";
export * from "./num";
export * from "./dateline";
export * from "./page-header";
export * from "./section-header";

/* ── Data display ───────────────────────────────────────────────────────── */
export * from "./stat";
export * from "./cell-grid";
export * from "./meter";
export * from "./ledger-table";
export * from "./status-pill";
export * from "./tier-mark";
export * from "./metric-card";
export * from "./table-shell";
export * from "./data-table";
export * from "./timeline";
export * from "./currency-display";
export * from "./hijri-date";

/* ── Layers & chrome ────────────────────────────────────────────────────── */
export * from "./layer";
export * from "./sticky-glass-bar";
export * from "./nav-item";
export * from "./dialog";
export * from "./button";
export * from "./badge";
export * from "./status-badge";
export * from "./card";
export * from "./alert-card";
export * from "./ai-insight-card";
export * from "./avatar";
export * from "./theme-toggle";
export * from "./language-toggle";

/* ── Forms ──────────────────────────────────────────────────────────────── */
export * from "./field";
export * from "./input";
export * from "./textarea";
export * from "./select";
export * from "./checkbox";
export * from "./radio-group";
export * from "./switch";
export * from "./combobox";
export * from "./file-upload";

/* ── Motion & state ─────────────────────────────────────────────────────── */
export * from "./reveal";
export * from "./reveal-root";
export * from "./commit-row";

/* ── Loading & empty ────────────────────────────────────────────────────── */
export * from "./skeleton";
export * from "./spinner";
export * from "./page-loader";
export * from "./empty-state";
