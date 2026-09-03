import { maskIban, parseSellerBankDetails } from "@avenick/database";
import { platformContacts } from "@avenick/utils/portal-config";
import { format } from "date-fns";
import { Building2, CreditCard, ShieldCheck } from "lucide-react";
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

export const metadata = { title: "Settings" };

/** Enum → label maps. Presentation only; the stored value is what the badge shows. */
const SELLER_TYPE_LABEL: Record<string, string> = {
  MANUFACTURER: "Manufacturer",
  DISTRIBUTOR: "Distributor",
  IMPORTER: "Importer",
  RETAILER: "Retailer",
};

export default async function SettingsPage() {
  const { seller, membership } = await requireSellerPermission("settings.manage");
  const bank = parseSellerBankDetails(seller.bankDetails);
  const { support } = platformContacts();

  // Registration identity and platform decisions are shown, never edited, here:
  // changing any of them re-opens verification, which is an admin decision.
  const registration = [
    { label: "CR Number", value: seller.crNumber },
    { label: "VAT Number", value: seller.vatNumber ?? "Not provided" },
    { label: "Country", value: seller.country },
    { label: "Seller Type", value: SELLER_TYPE_LABEL[seller.type] ?? seller.type.replace(/_/g, " ") },
    { label: "Tier", value: seller.tier },
    { label: "Status", value: seller.status.replace(/_/g, " ") },
    { label: "Commission Rate", value: `${Number(seller.commissionRate)}%` },
  ];

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="max-w-3xl space-y-block">
        <PageHeader
          eyebrow="Account"
          title="Settings"
          description="How your store presents itself to buyers, and where the platform pays you."
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
              <span className="u-meta u-mono text-ink-3">ID: {seller.id.slice(0, 8)}…</span>
            </div>
          </div>
        </Surface>

        {/* Business profile — seller-editable */}
        <Surface as="section" rung={2} className="p-5">
          <SectionHeader
            icon={Building2}
            eyebrow="Seller-editable"
            title="Business profile"
            description="Names, description and city shown to buyers"
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
            eyebrow="Read-only"
            title="Registration & platform terms"
            description="Verified at onboarding and set by the platform — not editable here"
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
            Contact support to change registration details.
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
            eyebrow="Seller-editable"
            title="Banking & payouts"
            description="Bank account details held on file for payouts"
          />
          <FieldWell className="mb-5 p-4">
            {bank ? (
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="min-w-0">
                  <dt>
                    <Eyebrow as="span">IBAN</Eyebrow>
                  </dt>
                  <dd className="u-ui u-mono mt-0.5 truncate font-medium text-ink-1" dir="ltr">
                    {maskIban(bank.iban)}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt>
                    <Eyebrow as="span">Bank</Eyebrow>
                  </dt>
                  <dd className="u-ui mt-0.5 truncate font-medium text-ink-1">{bank.bankName}</dd>
                </div>
                <div className="min-w-0">
                  <dt>
                    <Eyebrow as="span">Account holder</Eyebrow>
                  </dt>
                  <dd className="u-ui mt-0.5 truncate font-medium text-ink-1">{bank.accountName}</dd>
                </div>
                {bank.updatedAt && !Number.isNaN(Date.parse(bank.updatedAt)) && (
                  <div className="sm:col-span-3">
                    <dt className="sr-only">Last changed</dt>
                    <dd>
                      <Dateline>Last changed {format(new Date(bank.updatedAt), "MMM d, yyyy")}</Dateline>
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="u-ui text-ink-2">No payout account on file.</p>
            )}
          </FieldWell>
          <PayoutAccountForm configured={bank !== null} />
        </Surface>
      </div>
    </SellerLayout>
  );
}
