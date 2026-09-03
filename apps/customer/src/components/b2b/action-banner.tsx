import { CheckCircle2, XCircle } from "lucide-react";
import { Dateline, Surface } from "@avenick/ui";
import { getB2BT } from "./i18n";
import type { B2BKey } from "./messages";

/**
 * The outcome of an action that reports itself through the query string.
 *
 * Every governed purchase-order transition, and the requisition-list line
 * writer, redirect with their outcome rather than returning it: they are bound
 * to plain forms and have no return channel. This is the surface that renders
 * it — and until now the requisition-list half was written and then never read,
 * so a buyer who added a withdrawn SKU was told nothing at all.
 *
 * Financial and inventory actions must state what happened. This is the surface that makes the
 * difference between "approved" and "silently did nothing" visible, and round
 * one already got that part right. What it looked like was a coloured box.
 *
 * It is now built from the system's own COMMIT gesture — `.u-commit` — the same
 * 3px inline-start rule that marks an acted-on row in a queue: always present,
 * always 3px, only its colour changes, with a soft wash scaled in from the
 * inline start beneath it. That is deliberate. An approver who has just cleared
 * four purchase orders should recognise the mark on the banner as the same mark
 * that appeared on the row, rather than learning a second visual language for
 * the same event. The `.u-pop` entry is CSS `@starting-style`: no JavaScript, no
 * library, and nothing to interrupt.
 *
 * The Dateline is not decoration either: an approval is a record, and saying
 * where the record went is what separates a confirmation from a toast.
 *
 * WHY EVERY OUTCOME IS AN ACTION CODE RATHER THAN A SENTENCE
 * The server action redirects with `?poDone=approve`, not with an English
 * sentence, so the outcome can be stated in the reader's language. The action
 * has no locale of its own — it runs before the page — so the sentence has to be
 * chosen here.
 *
 * It is also the reason `done` accepts NOTHING BUT a known code. Both parameters
 * come off the query string, which anyone can write: a link to
 * `/b2b/lists?listDone=<any sentence>` would otherwise paint arbitrary text
 * inside this product's own "Recorded." receipt, which is a phishing surface
 * wearing the platform's chrome. An unrecognised `done` renders nothing at all.
 *
 * `error` is the one exception, and it is deliberate: it carries the SERVER's
 * own reason ("already decided", "price changed, re-approval required"), which
 * is data rather than copy and is the only actionable part of the message. A
 * refusal is also the branch an attacker gains least from. The failures this app
 * raises itself travel as codes and are translated.
 */
/** The outcomes that travel as a code. `{sku}`/`{name}` are filled from `arg`. */
const DONE_KEY: Record<string, B2BKey> = {
  approve: "po.done.approve",
  reject: "po.done.reject",
  order: "po.done.order",
  cancel: "po.done.cancel",
  listAdded: "act.list.itemAdded",
  listFreeText: "act.list.itemFreeText",
};

/** The failures this app raises itself. Anything else is the server's own reason. */
const ERROR_KEY: Record<string, B2BKey> = {
  identity: "po.error.identity",
  failed: "po.error.failed",
  listUnavailable: "act.list.skuUnavailable",
};

export async function ActionBanner({
  done,
  error,
  arg,
  basis = "po.banner.basis",
}: {
  done?: string;
  error?: string;
  /**
   * The one value a coded outcome names — a SKU, a product name. Truncated,
   * because it reaches this component through the query string and a receipt is
   * not a place to render an unbounded stranger-supplied run.
   */
  arg?: string;
  /**
   * WHERE THE RECORD WENT, and it must be true of the page it is rendered on.
   * The default cites the purchase-order register and the company's approval
   * trail, which is exactly right for a governed PO transition and exactly wrong
   * for a requisition line — that is written to neither. A banner that cites the
   * wrong register is a claim the database does not hold, so every caller that
   * is not a purchase order passes its own.
   */
  basis?: B2BKey;
}) {
  if (!done && !error) return null;
  const t = await getB2BT();

  const values = arg ? { sku: arg.slice(0, 120), name: arg.slice(0, 120) } : undefined;
  const doneKey = done ? DONE_KEY[done] : undefined;
  const errorKey = error ? ERROR_KEY[error] : undefined;

  const isError = Boolean(error);
  // An unknown `done` is not shown at all; an unknown `error` is the server's
  // own reason and is shown verbatim.
  const message = isError ? (errorKey ? t(errorKey, values) : error!) : doneKey ? t(doneKey, values) : null;
  if (message === null) return null;

  const Icon = isError ? XCircle : CheckCircle2;

  return (
    <Surface
      rung={2}
      // role="alert" for a refusal and role="status" for a receipt. An alert is
      // assertive by default and interrupts, which is right when an approval did
      // NOT happen and wrong when one did; pairing role="alert" with
      // aria-live="polite" would quietly downgrade the one case that needs to
      // interrupt, so the live-region hint is set only on the polite branch.
      role={isError ? "alert" : "status"}
      aria-live={isError ? undefined : "polite"}
      // data-commit, not data-tone: a tone would paint the whole surface as a
      // permanent coloured wash, which is what an alert looks like. This is not
      // an alert, it is a receipt.
      data-commit={isError ? "failed" : "committed"}
      className="u-commit u-pop flex items-start gap-3 overflow-hidden border-s-[3px] px-4 py-3"
    >
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${isError ? "text-danger-ink" : "text-success-ink"}`}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="u-ui">
          <span className={`font-medium ${isError ? "text-danger-ink" : "text-success-ink"}`}>
            {isError ? t("po.banner.failed") : t("po.banner.recorded")}
          </span>{" "}
          <span className="text-ink-1">{message}</span>
        </p>
        {!isError && <Dateline className="mt-0.5">{t(basis)}</Dateline>}
      </div>
    </Surface>
  );
}
