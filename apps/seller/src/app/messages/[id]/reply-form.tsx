"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle, Info, Loader2, Lock, Send } from "lucide-react";
import { Button, Textarea } from "@avenick/ui";
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
        <p className="flex items-start gap-2 text-sm text-muted-foreground bg-secondary/50 border border-border rounded-xl px-3 py-2">
          <Lock className="h-4 w-4 mt-0.5 shrink-0" />
          This thread is closed. Replies are no longer accepted on it.
        </p>
      )}

      <Textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={isOpen ? "Write your reply to the buyer…" : "Thread closed"}
        maxLength={maxLength}
        disabled={disabled}
        rows={4}
        aria-label="Reply"
      />

      {state.error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="flex items-start gap-2 text-sm text-success bg-success/5 border border-success/20 rounded-xl px-3 py-2">
          <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {state.buyerVisible
            ? "Reply sent. The buyer will see it on their RFQ page."
            : "Reply recorded. This thread has no RFQ, so the buyer cannot read it yet."}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {hasRfq
            ? "The buyer can read replies on their RFQ page."
            : "The buyer can read replies on their RFQ page; general threads are not yet visible to buyers."}
        </p>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${remaining < 0 ? "text-danger" : "text-muted-foreground"}`}>{remaining} left</span>
          <Button type="submit" size="sm" disabled={disabled || !body.trim()}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {pending ? "Sending…" : "Send reply"}
          </Button>
        </div>
      </div>
    </form>
  );
}
