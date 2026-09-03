"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
      setState({ error: "Write a reply before sending." });
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
        setState({ error: "Couldn't send the reply — please retry." });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {!isOpen && (
        <Surface rung={1} className="flex items-start gap-2 px-3 py-2">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
          <p className="u-ui text-ink-2">This thread is closed. Replies are no longer accepted on it.</p>
        </Surface>
      )}

      <Field label="Your reply" htmlFor={fieldId} hideLabel>
        <Textarea
          id={fieldId}
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={isOpen ? "Write your reply to the buyer…" : "Thread closed"}
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
            {state.buyerVisible
              ? "Reply sent. The buyer will see it on their RFQ page."
              : "Reply recorded. This thread has no RFQ, so the buyer cannot read it yet."}
          </p>
        </Surface>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Who can actually read this reply is provenance, not fine print. */}
        <Dateline className="max-w-desc">
          {hasRfq
            ? "The buyer can read replies on their RFQ page."
            : "The buyer can read replies on their RFQ page; general threads are not yet visible to buyers."}
        </Dateline>
        <div className="flex items-center gap-3">
          <span className={`u-meta fig ${remaining < 0 ? "text-danger-ink" : "text-ink-3"}`}>{remaining} left</span>
          <Button type="submit" size="sm" loading={pending} disabled={disabled || !body.trim()}>
            {!pending && <Send className="h-3.5 w-3.5" aria-hidden="true" />}
            {pending ? "Sending…" : "Send reply"}
          </Button>
        </div>
      </div>
    </form>
  );
}
