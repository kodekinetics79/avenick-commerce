import { maskIban, parseSellerBankDetails } from "@avenick/database";
import { platformContacts } from "@avenick/utils/portal-config";
import { format } from "date-fns";
import { Building2, CreditCard, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSellerPermission } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import {
  Dateline,
  Eyebrow,
  FieldWell,
  PageHeader,
  SectionHeader,
  Surface,
  TierMark,
} from "@avenick/ui";
import { BusinessProfileForm, PayoutAccountForm } from "./settings-form";

export async function generateMetadata() {
  const t = await getTranslations("sellerRelations");
  return { title: t("settings.metaTitle") };
}

/**
 * The seller types this page knows a label for. Presentation only; the stored
 * value is what the badge shows when the enum grows past this list. The KEYS
 * are the Prisma enum and are never translated; each label is
 * sellerRelations.sellerType.<KEY>.
 */
const KNOWN_SELLER_TYPES = ["MANUFACTURER", "DISTRIBUTOR", "IMPORTER", "RETAILER"] as const;

/** Statuses this page knows a label for; anything else prints its raw value. */
const KNOWN_SELLER_STATUSES = ["PENDING_REVIEW", "ACTIVE", "SUSPENDED", "REJECTED"] as const;

export default async function SettingsPage() {
  const { seller, membership } = await requireSellerPermission("settings.manage");
  const t = await getTranslations("sellerRelations");
  const bank = parseSellerBankDetails(seller.bankDetails);
  const { support } = platformContacts();

  // Registration identity and platform decisions are shown, never edited, here:
  // changing any of them re-opens verification, which is an admin decision.
  const registration = [
    { label: t("settings.registration.crNumber"), value: seller.crNumber },
    { label: t("settings.registration.vatNumber"), value: seller.vatNumber ?? t("settings.registration.notProvided") },
    { label: t("settings.registration.country"), value: seller.country },
    {
      label: t("settings.registration.sellerType"),
      value: (KNOWN_SELLER_TYPES as readonly string[]).includes(seller.type)
        ? t(`sellerType.${seller.type}`)
        : seller.type.replace(/_/g, " "),
    },
    { label: t("settings.registration.tier"), value: seller.tier },
    {
      label: t("settings.registration.status"),
      value: (KNOWN_SELLER_STATUSES as readonly string[]).includes(seller.status)
        ? t(`sellerStatus.${seller.status}`)
        : seller.status.replace(/_/g, " "),
    },
    { label: t("settings.registration.commissionRate"), value: `${Number(seller.commissionRate)}%` },
  ];

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="max-w-3xl space-y-block">
        <PageHeader
          eyebrow={t("settings.eyebrow")}
          title={t("settings.title")}
          description={t("settings.description")}
        />

        {/* Profile summary — re-read from the database after every save */}
        <Surface rung={2} className="flex items-center gap-4 p-5">
          <span
            aria-hidden="true"
            className="u-h3 grid h-14 w-14 shrink-0 place-items-center rounded-pill bg-neutral-soft text-ink-2"
          >
            {seller.businessNameEn.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="u-h3 truncate text-ink-1">{seller.businessNameEn}</p>
            {seller.businessNameAr && (
              <p className="u-ui text-ink-2" dir="rtl" lang="ar">
                {seller.businessNameAr}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <TierMark tier={seller.tier} />
              <span className="u-meta u-mono text-ink-3">{t("settings.idLabel")}: {seller.id.slice(0, 8)}…</span>
            </div>
          </div>
        </Surface>

        {/* Business profile — seller-editable */}
        <Surface as="section" rung={2} className="p-5">
          <SectionHeader
            icon={Building2}
            eyebrow={t("settings.sellerEditable")}
            title={t("settings.profile.title")}
            description={t("settings.profile.description")}
          />
          <BusinessProfileForm
            initial={{
              businessNameEn: seller.businessNameEn,
              businessNameAr: seller.businessNameAr,
              description: seller.description,
              descriptionAr: seller.descriptionAr,
              city: seller.city,
            }}
          />
        </Surface>

        {/* Registration — read-only */}
        <Surface as="section" rung={2} className="p-5">
          <SectionHeader
            icon={ShieldCheck}
            eyebrow={t("settings.readOnly")}
            title={t("settings.registration.title")}
            description={t("settings.registration.description")}
          />
          {/* Recessed, because this block is context rather than something to act on. */}
          <FieldWell className="divide-y divide-hairline overflow-hidden">
            {registration.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <Eyebrow>{item.label}</Eyebrow>
                <span className="u-ui fig text-end font-medium text-ink-1">{item.value}</span>
              </div>
            ))}
          </FieldWell>
          <Dateline className="mt-3">
            {t("settings.registration.contactSupport")}
            {support && (
              <>
                {" "}
                <a href={`mailto:${support}`} className="u-focus rounded-nested text-primary-ink hover:underline">
                  {support}
                </a>
              </>
            )}
          </Dateline>
        </Surface>

        {/* Payout account — seller-editable, IBAN shown masked */}
        <Surface as="section" rung={2} className="p-5">
          <SectionHeader
            icon={CreditCard}
            eyebrow={t("settings.sellerEditable")}
            title={t("settings.payout.title")}
            description={t("settings.payout.description")}
          />
          <FieldWell className="mb-5 p-4">
            {bank ? (
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="min-w-0">
                  <dt>
                    <Eyebrow as="span">{t("settings.payout.iban")}</Eyebrow>
                  </dt>
                  <dd className="u-ui u-mono mt-0.5 truncate font-medium text-ink-1" dir="ltr">
                    {maskIban(bank.iban)}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt>
                    <Eyebrow as="span">{t("settings.payout.bank")}</Eyebrow>
                  </dt>
                  <dd className="u-ui mt-0.5 truncate font-medium text-ink-1">{bank.bankName}</dd>
                </div>
                <div className="min-w-0">
                  <dt>
                    <Eyebrow as="span">{t("settings.payout.accountHolder")}</Eyebrow>
                  </dt>
                  <dd className="u-ui mt-0.5 truncate font-medium text-ink-1">{bank.accountName}</dd>
                </div>
                {bank.updatedAt && !Number.isNaN(Date.parse(bank.updatedAt)) && (
                  <div className="sm:col-span-3">
                    <dt className="sr-only">{t("settings.payout.lastChangedLabel")}</dt>
                    <dd>
                      <Dateline>{t("settings.payout.lastChanged", { date: format(new Date(bank.updatedAt), "MMM d, yyyy") })}</Dateline>
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="u-ui text-ink-2">{t("settings.payout.none")}</p>
            )}
          </FieldWell>
          <PayoutAccountForm configured={bank !== null} />
        </Surface>
      </div>
    </SellerLayout>
  );
}
