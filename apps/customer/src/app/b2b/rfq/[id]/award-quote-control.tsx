"use client";

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Surface,
} from "@avenick/ui";
import { CheckCircle2 } from "lucide-react";
import { Money } from "@/components/b2b/money";
import { useB2BT } from "@/components/b2b/use-b2b-t";
import { awardSupplierQuote } from "../actions";

export function AwardQuoteControl({
  rfqId,
  quoteId,
  expectedFingerprint,
  sellerName,
  total,
  currency,
  validUntil,
}: {
  rfqId: string;
  quoteId: string;
  expectedFingerprint: string;
  sellerName: string;
  total: number;
  currency: string;
  validUntil: string;
}) {
  const t = useB2BT();
  const action = awardSupplierQuote.bind(null, rfqId, quoteId, expectedFingerprint);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="primary" size="sm">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t("rfq.deal.award.open")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("rfq.deal.award.title")}</DialogTitle>
          <DialogDescription>
            {t("rfq.deal.award.description", { seller: sellerName, validity: validUntil })}
          </DialogDescription>
        </DialogHeader>

        <Surface rung={1} className="p-4">
          <p className="u-meta text-ink-3">{t("rfq.deal.grandTotal")}</p>
          <Money amount={total} currency={currency} rank="section" className="mt-1" />
        </Surface>
        <Surface rung={1} tone="accent" className="p-4">
          <p className="u-ui font-medium text-ink-1">{t("rfq.deal.award.effectTitle")}</p>
          <p className="u-meta mt-1 text-ink-2">{t("rfq.deal.award.effectBody")}</p>
        </Surface>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">{t("common.cancel")}</Button>
          </DialogClose>
          <form action={action}>
            <Button type="submit" variant="primary" className="w-full sm:w-auto">
              {t("rfq.deal.award.confirm")}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
