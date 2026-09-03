"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Landmark, Save } from "lucide-react";
import { Button, Input, Textarea } from "@avenick/ui";
import { useToast } from "@/components/toast";
import { updateSellerBankAction, updateSellerProfileAction, type SettingsActionState } from "./actions";

/**
 * Both forms post through a server action and then `router.refresh()` so the
 * server-rendered parts of the page (profile summary, masked payout account,
 * the sidebar name) re-read from the database instead of trusting the form.
 */
function useSettingsSubmit(action: (prev: SettingsActionState, formData: FormData) => Promise<SettingsActionState>) {
  const router = useRouter();
  const [state, setState] = React.useState<SettingsActionState>({});
  const [pending, startTransition] = React.useTransition();

  function submit(formData: FormData, onSaved?: () => void) {
    setState({});
    startTransition(async () => {
      try {
        const result = await action({}, formData);
        setState(result);
        if (result.ok) {
          // The toast/reset only fires for a real write; a no-op submit is
          // reported inline as "nothing changed", not celebrated as a save.
          if ((result.changed ?? []).length > 0) onSaved?.();
          router.refresh();
        }
      } catch {
        // The action itself reports every refusal it can name (validation,
        // permission, service errors). Reaching here means the call did not
        // complete — network, or a masked server error — so say that and no more.
        setState({ error: "The request did not complete. Refresh the page and try again." });
      }
    });
  }

  return { state, pending, submit };
}

function StatusLine({ state, savedLabel, nothingChangedLabel }: { state: SettingsActionState; savedLabel: string; nothingChangedLabel: string }) {
  if (state.error) {
    return (
      <p role="alert" className="flex items-center gap-1.5 text-sm text-danger">
        <AlertCircle className="h-4 w-4 shrink-0" /> {state.error}
      </p>
    );
  }
  if (state.ok) {
    // `changed` is what the service actually wrote; an unchanged submit is
    // reported as such rather than as a save that did not happen.
    const changed = state.changed ?? [];
    return (
      <p role="status" className="flex items-center gap-1.5 text-sm text-success">
        <CheckCircle2 className="h-4 w-4 shrink-0" /> {changed.length > 0 ? savedLabel : nothingChangedLabel}
      </p>
    );
  }
  return null;
}

export interface BusinessProfileFormProps {
  initial: {
    businessNameEn: string;
    businessNameAr: string | null;
    description: string | null;
    descriptionAr: string | null;
    city: string;
  };
}

export function BusinessProfileForm({ initial }: BusinessProfileFormProps) {
  const { toast } = useToast();
  const { state, pending, submit } = useSettingsSubmit(updateSellerProfileAction);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(new FormData(event.currentTarget), () => toast({ title: "Business details saved", variant: "success" }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input name="businessNameEn" label="Business name (EN)" defaultValue={initial.businessNameEn} required maxLength={120} autoComplete="organization" />
        <Input name="businessNameAr" label="Business name (AR)" defaultValue={initial.businessNameAr ?? ""} maxLength={120} dir="rtl" />
      </div>
      <div>
        <label htmlFor="settings-description" className="mb-1.5 block text-sm font-medium text-foreground">Description (EN)</label>
        <Textarea id="settings-description" name="description" defaultValue={initial.description ?? ""} maxLength={2000} rows={4} placeholder="What you sell and who you serve" />
      </div>
      <div>
        <label htmlFor="settings-description-ar" className="mb-1.5 block text-sm font-medium text-foreground">Description (AR)</label>
        <Textarea id="settings-description-ar" name="descriptionAr" defaultValue={initial.descriptionAr ?? ""} maxLength={2000} rows={4} dir="rtl" />
      </div>
      <div className="max-w-sm">
        <Input name="city" label="City" defaultValue={initial.city} required maxLength={80} autoComplete="address-level2" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <StatusLine state={state} savedLabel="Business details saved." nothingChangedLabel="Nothing to save — the details already match." />
        <Button type="submit" loading={pending} size="sm">
          <Save className="h-4 w-4" /> Save business details
        </Button>
      </div>
    </form>
  );
}

export interface PayoutAccountFormProps {
  /** Whether an account is on file; the masked summary itself is rendered by the server page. */
  configured: boolean;
}

/**
 * The stored IBAN is never sent back to the browser, so the form starts empty
 * and replaces the account as a whole: the service refuses a partial payout
 * record, and pre-filling a masked IBAN would either save the mask or force
 * the seller to clear it first.
 */
export function PayoutAccountForm({ configured }: PayoutAccountFormProps) {
  const { toast } = useToast();
  const { state, pending, submit } = useSettingsSubmit(updateSellerBankAction);
  const formRef = React.useRef<HTMLFormElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(new FormData(event.currentTarget), () => {
      formRef.current?.reset();
      toast({ title: "Payout account saved", variant: "success" });
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Landmark className="h-4 w-4 text-primary" />
        {configured ? "Replace payout account" : "Add payout account"}
      </div>
      <Input
        name="iban"
        label="IBAN"
        required
        minLength={15}
        maxLength={64}
        autoComplete="off"
        spellCheck={false}
        className="font-mono uppercase"
        placeholder="Country code, check digits, account"
        hint="Checked against the IBAN checksum before it is stored. Spaces are ignored."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input name="bankName" label="Bank name" required maxLength={120} autoComplete="off" />
        <Input name="accountName" label="Account holder name" required maxLength={120} autoComplete="off" hint="Exactly as it appears on the bank account." />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <StatusLine state={state} savedLabel="Payout account saved." nothingChangedLabel="That is already the payout account on file." />
        <Button type="submit" loading={pending} size="sm" variant={configured ? "secondary" : "primary"}>
          <Save className="h-4 w-4" /> {configured ? "Replace account" : "Save account"}
        </Button>
      </div>
    </form>
  );
}
