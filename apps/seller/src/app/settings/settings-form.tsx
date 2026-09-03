"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle, CheckCircle2, Landmark, Save } from "lucide-react";
import { Button, Field, Input, Textarea } from "@avenick/ui";
import { useToast } from "@/components/toast";
import { updateSellerBankAction, updateSellerProfileAction, type SettingsActionState } from "./actions";

/**
 * Both forms post through a server action and then `router.refresh()` so the
 * server-rendered parts of the page (profile summary, masked payout account,
 * the sidebar name) re-read from the database instead of trusting the form.
 */
function useSettingsSubmit(action: (prev: SettingsActionState, formData: FormData) => Promise<SettingsActionState>) {
  const router = useRouter();
  const t = useTranslations("sellerRelations");
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
        setState({ error: t("settings.requestIncomplete") });
      }
    });
  }

  return { state, pending, submit };
}

function StatusLine({ state, savedLabel, nothingChangedLabel }: { state: SettingsActionState; savedLabel: string; nothingChangedLabel: string }) {
  if (state.error) {
    return (
      <p role="alert" className="u-ui flex items-center gap-1.5 text-danger-ink">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" /> {state.error}
      </p>
    );
  }
  if (state.ok) {
    // `changed` is what the service actually wrote; an unchanged submit is
    // reported as such rather than as a save that did not happen.
    const changed = state.changed ?? [];
    return (
      <p role="status" className="u-ui flex items-center gap-1.5 text-success-ink">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> {changed.length > 0 ? savedLabel : nothingChangedLabel}
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
  const t = useTranslations("sellerRelations");
  const { toast } = useToast();
  const { state, pending, submit } = useSettingsSubmit(updateSellerProfileAction);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(new FormData(event.currentTarget), () => toast({ title: t("settings.profile.savedToast"), variant: "success" }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input name="businessNameEn" label={t("settings.profile.nameEn")} defaultValue={initial.businessNameEn} required maxLength={120} autoComplete="organization" />
        <Input name="businessNameAr" label={t("settings.profile.nameAr")} defaultValue={initial.businessNameAr ?? ""} maxLength={120} dir="rtl" />
      </div>
      <Field label={t("settings.profile.descriptionEn")} htmlFor="settings-description">
        <Textarea id="settings-description" name="description" defaultValue={initial.description ?? ""} maxLength={2000} rows={4} placeholder={t("settings.profile.descriptionPlaceholder")} />
      </Field>
      <Field label={t("settings.profile.descriptionAr")} htmlFor="settings-description-ar">
        <Textarea id="settings-description-ar" name="descriptionAr" defaultValue={initial.descriptionAr ?? ""} maxLength={2000} rows={4} dir="rtl" lang="ar" />
      </Field>
      <div className="max-w-sm">
        <Input name="city" label={t("settings.profile.city")} defaultValue={initial.city} required maxLength={80} autoComplete="address-level2" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <StatusLine state={state} savedLabel={t("settings.profile.saved")} nothingChangedLabel={t("settings.profile.nothingChanged")} />
        <Button type="submit" loading={pending} size="sm">
          <Save className="h-4 w-4" /> {t("settings.profile.save")}
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
  const t = useTranslations("sellerRelations");
  const { toast } = useToast();
  const { state, pending, submit } = useSettingsSubmit(updateSellerBankAction);
  const formRef = React.useRef<HTMLFormElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(new FormData(event.currentTarget), () => {
      formRef.current?.reset();
      toast({ title: t("settings.payout.savedToast"), variant: "success" });
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <p className="u-ui flex items-center gap-2 font-medium text-ink-1">
        <Landmark className="h-4 w-4 text-ink-3" aria-hidden="true" />
        {configured ? t("settings.payout.replaceHeading") : t("settings.payout.addHeading")}
      </p>
      <Input
        name="iban"
        label={t("settings.payout.iban")}
        required
        minLength={15}
        maxLength={64}
        autoComplete="off"
        spellCheck={false}
        className="u-mono uppercase"
        placeholder={t("settings.payout.ibanPlaceholder")}
        hint={t("settings.payout.ibanHint")}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input name="bankName" label={t("settings.payout.bankName")} required maxLength={120} autoComplete="off" />
        <Input name="accountName" label={t("settings.payout.accountHolderName")} required maxLength={120} autoComplete="off" hint={t("settings.payout.accountHolderHint")} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <StatusLine state={state} savedLabel={t("settings.payout.saved")} nothingChangedLabel={t("settings.payout.nothingChanged")} />
        <Button type="submit" loading={pending} size="sm" variant={configured ? "secondary" : "primary"}>
          <Save className="h-4 w-4" /> {configured ? t("settings.payout.replace") : t("settings.payout.save")}
        </Button>
      </div>
    </form>
  );
}
