import { maskIban, parseSellerBankDetails } from "@avenick/database";
import { platformContacts } from "@avenick/utils/portal-config";
import { format } from "date-fns";
import { Building2, CreditCard, Settings, ShieldCheck } from "lucide-react";
import { requireSellerPermission } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
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
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground">How your store presents itself and where it is paid</p>
          </div>
        </div>

        {/* Profile summary — re-read from the database after every save */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center text-white font-bold text-xl shrink-0">
              {seller.businessNameEn.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-lg truncate">{seller.businessNameEn}</p>
              {seller.businessNameAr && <p className="text-sm text-muted-foreground" dir="rtl">{seller.businessNameAr}</p>}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">{seller.tier}</span>
                <span className="text-xs text-muted-foreground">ID: {seller.id.slice(0, 8)}…</span>
              </div>
            </div>
          </div>
        </div>

        {/* Business profile — seller-editable */}
        <section className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-3">
            <Building2 className="h-4 w-4 text-primary" />
            <div>
              <h2 className="font-semibold text-sm">Business Profile</h2>
              <p className="text-xs text-muted-foreground">Names, description and city shown to buyers</p>
            </div>
          </div>
          <div className="p-5">
            <BusinessProfileForm
              initial={{
                businessNameEn: seller.businessNameEn,
                businessNameAr: seller.businessNameAr,
                description: seller.description,
                descriptionAr: seller.descriptionAr,
                city: seller.city,
              }}
            />
          </div>
        </section>

        {/* Registration — read-only */}
        <section className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <div>
              <h2 className="font-semibold text-sm">Registration &amp; Platform Terms</h2>
              <p className="text-xs text-muted-foreground">Verified at onboarding and set by the platform — not editable here</p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {registration.map((item) => (
              <div key={item.label} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="text-sm font-medium">{item.value}</span>
              </div>
            ))}
          </div>
          <p className="px-5 py-3 border-t border-border text-xs text-muted-foreground">
            Contact support to change registration details.
            {support && (
              <>
                {" "}
                <a href={`mailto:${support}`} className="text-primary hover:underline">{support}</a>
              </>
            )}
          </p>
        </section>

        {/* Payout account — seller-editable, IBAN shown masked */}
        <section className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-3">
            <CreditCard className="h-4 w-4 text-primary" />
            <div>
              <h2 className="font-semibold text-sm">Banking &amp; Payouts</h2>
              <p className="text-xs text-muted-foreground">Bank account details held on file for payouts</p>
            </div>
          </div>
          <div className="px-5 py-4 border-b border-border">
            {bank ? (
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">IBAN</dt>
                  <dd className="font-mono font-medium" dir="ltr">{maskIban(bank.iban)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Bank</dt>
                  <dd className="font-medium truncate">{bank.bankName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Account holder</dt>
                  <dd className="font-medium truncate">{bank.accountName}</dd>
                </div>
                {bank.updatedAt && !Number.isNaN(Date.parse(bank.updatedAt)) && (
                  <div className="sm:col-span-3">
                    <dt className="sr-only">Last changed</dt>
                    <dd className="text-xs text-muted-foreground">Last changed {format(new Date(bank.updatedAt), "MMM d, yyyy")}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No payout account on file.</p>
            )}
          </div>
          <div className="p-5">
            <PayoutAccountForm configured={bank !== null} />
          </div>
        </section>
      </div>
    </SellerLayout>
  );
}
