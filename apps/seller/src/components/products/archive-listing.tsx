"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle, Archive } from "lucide-react";
import { Button, Dateline, Surface } from "@avenick/ui";
import { archiveProductAction } from "@/app/products/actions";
import { useToast } from "@/components/toast";

export interface ArchiveListingProps {
  productId: string;
  /** Shown in the confirmation so the seller can see what they are removing. */
  productName: string;
}

/**
 * Taking a listing down.
 *
 * Two-step on purpose: archiving is the one catalogue action that removes a
 * listing from every surface at once, and the platform has a single primary
 * action per panel, so the destructive one must be asked for twice rather than
 * sit one stray click away from Save.
 *
 * The refusal from the server is rendered verbatim. It carries the count of
 * reserved units or open order lines, which is the thing the seller has to
 * clear — a generic "cannot archive" would send them looking for it themselves.
 */
export function ArchiveListing({ productId, productName }: ArchiveListingProps) {
  const t = useTranslations("sellerCatalog");
  const router = useRouter();
  const { toast } = useToast();
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function archive() {
    setError(null);
    startTransition(async () => {
      const result = await archiveProductAction(productId);
      if (result.ok) {
        toast({ title: t("archive.doneToast"), variant: "success" });
        router.push("/products");
        router.refresh();
        return;
      }
      setError(result.error);
      setConfirming(false);
    });
  }

  return (
    <Surface as="section" rung={2} className="space-y-3 p-5">
      <div>
        <h2 className="u-h3 text-ink-1">{t("archive.title")}</h2>
        <p className="u-ui mt-1 text-ink-2">{t("archive.description")}</p>
      </div>

      {error && (
        <p role="alert" className="u-ui flex items-start gap-1.5 text-danger-ink">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}

      {confirming ? (
        <div className="space-y-3">
          <p className="u-ui text-ink-1">{t("archive.confirm", { name: productName })}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" size="sm" loading={pending} onClick={archive}>
              {t("archive.confirmAction")}
            </Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
              {t("archive.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => { setError(null); setConfirming(true); }}>
          <Archive className="h-4 w-4" aria-hidden="true" /> {t("archive.action")}
        </Button>
      )}

      <Dateline>{t("archive.reversibleNote")}</Dateline>
    </Surface>
  );
}
