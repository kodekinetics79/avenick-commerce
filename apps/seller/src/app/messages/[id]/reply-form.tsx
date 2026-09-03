"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle, CheckCircle, Lock, Send } from "lucide-react";
import { Button, Dateline, Field, Surface, Textarea } from "@avenick/ui";
import { replyToThreadAction, type ReplyActionState } from "../actions";

interface ReplyFormProps {
  threadId: string;
  /** Closed threads render the composer disabled with the reason, not hidden. */
  isOpen: boolean;
  /** Whether the thread hangs off an RFQ — the only place the buyer can read replies today. */
  hasRfq: boolean;
  maxLength: number;
}

export function ReplyForm({ threadId, isOpen, hasRfq, maxLength }: ReplyFormProps) {
  const router = useRouter();
  const t = useTranslations("sellerRelations");
  const [body, setBody] = React.useState("");
  const [state, setState] = React.useState<ReplyActionState>({});
  const [pending, startTransition] = React.useTransition();
  const fieldId = React.useId();

  const disabled = !isOpen || pending;
  const remaining = maxLength - body.length;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = body.trim();
    if (!clean) {
      setState({ error: t("reply.writeSomething") });
      return;
    }
    setState({});
    startTransition(async () => {
      try {
        const result = await replyToThreadAction({ threadId, body: clean });
        if (result.error) {
          setState(result);
          return;
        }
        setBody("");
        setState(result);
        // The action revalidated this route; refresh pulls the new message
        // into the conversation above without a full navigation.
        router.refresh();
      } catch (err) {
        // A session redirect from the action surfaces as a thrown NEXT_REDIRECT.
        if (err && typeof err === "object" && "digest" in err && String((err as { digest?: string }).digest).includes("NEXT_REDIRECT")) {
          throw err;
        }
        setState({ error: t("reply.sendFailed") });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {!isOpen && (
        <Surface rung={1} className="flex items-start gap-2 px-3 py-2">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
          <p className="u-ui text-ink-2">{t("reply.threadClosed")}</p>
        </Surface>
      )}

      <Field label={t("reply.fieldLabel")} htmlFor={fieldId} hideLabel>
        <Textarea
          id={fieldId}
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={isOpen ? t("reply.placeholder") : t("reply.placeholderClosed")}
          maxLength={maxLength}
          disabled={disabled}
          rows={4}
        />
      </Field>

      {state.error && (
        <Surface role="alert" rung={2} tone="danger" className="flex items-start gap-2 px-3 py-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger-ink" aria-hidden="true" />
          <p className="u-ui text-danger-ink">{state.error}</p>
        </Surface>
      )}
      {state.ok && (
        <Surface role="status" rung={2} tone="success" className="flex items-start gap-2 px-3 py-2">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success-ink" aria-hidden="true" />
          <p className="u-ui text-success-ink">
            {state.buyerVisible ? t("reply.sentVisible") : t("reply.recordedNotVisible")}
          </p>
        </Surface>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Who can actually read this reply is provenance, not fine print. */}
        <Dateline className="max-w-desc">
          {hasRfq ? t("reply.provenanceRfq") : t("reply.provenanceNoRfq")}
        </Dateline>
        <div className="flex items-center gap-3">
          <span className={`u-meta fig ${remaining < 0 ? "text-danger-ink" : "text-ink-3"}`}>
            {t("reply.charactersLeft", { n: String(remaining) })}
          </span>
          <Button type="submit" size="sm" loading={pending} disabled={disabled || !body.trim()}>
            {!pending && <Send className="h-3.5 w-3.5" aria-hidden="true" />}
            {pending ? t("reply.sending") : t("reply.send")}
          </Button>
        </div>
      </div>
    </form>
  );
}
