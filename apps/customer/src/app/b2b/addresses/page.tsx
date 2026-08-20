import { B2BShell } from "@/components/b2b/b2b-shell";
import { db } from "@avenick/database";
import { getB2BContext } from "@/lib/b2b";
import { createAddress, setDefaultAddress, deleteAddress } from "./actions";
import { ValidatedForm } from "@/components/b2b/validated-form";
import { MapPin, Plus, Building2, Star } from "lucide-react";

export const metadata = { title: "Delivery Sites — Avenick for Business" };

const COUNTRY_LABEL: Record<string, string> = { AE: "UAE", SA: "Saudi Arabia", QA: "Qatar", KW: "Kuwait", OM: "Oman", BH: "Bahrain" };

export default async function AddressesPage() {
  const ctx = await getB2BContext();
  if (!ctx) {
    return (
      <B2BShell title="Delivery Sites">
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-semibold">No company account</p>
          <p className="text-sm text-muted-foreground mt-1">Sign in with a company account to manage delivery sites.</p>
        </div>
      </B2BShell>
    );
  }

  const addresses = await db.address.findMany({
    where: { companyId: ctx.companyId },
    orderBy: [{ isDefault: "desc" }, { label: "asc" }],
  });
  const isAdmin = ctx.member.role === "COMPANY_ADMIN";

  return (
    <B2BShell
      title="Delivery Sites"
      description="Manage the locations orders can be shipped to across your organization."
    >
      {isAdmin && (
        <ValidatedForm action={createAddress} className="rounded-2xl border border-border bg-card p-5 mb-6">
          <div className="flex items-center gap-2 text-sm font-semibold mb-4"><Plus className="h-4 w-4 text-primary" /> Add a site</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <input name="label" required placeholder="Site name (e.g. Main warehouse)" className="h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <input name="line1" required placeholder="Address line 1" className="h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <input name="line2" placeholder="Address line 2 (optional)" className="h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <input name="city" required placeholder="City" className="h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <select name="country" aria-label="Country" className="h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring">
              {Object.entries(COUNTRY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <div className="flex gap-2">
              <input name="postalCode" placeholder="Postal code" className="flex-1 h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              <button type="submit" className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 hover:shadow-glow-sm transition-all active:scale-[0.98]">Add</button>
            </div>
          </div>
        </ValidatedForm>
      )}

      {addresses.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <MapPin className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-semibold">No delivery sites yet</p>
          <p className="text-sm text-muted-foreground mt-1">Add your first location to ship orders to it.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {addresses.map((a) => (
            <div key={a.id} className={`rounded-2xl border p-5 ${a.isDefault ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary shrink-0"><MapPin className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <p className="font-semibold truncate flex items-center gap-1.5">{a.label}{a.isDefault && <Star className="h-3.5 w-3.5 text-primary fill-current shrink-0" />}</p>
                    <p className="text-xs text-muted-foreground">{COUNTRY_LABEL[a.country] ?? a.country}</p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                {a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />
                {a.city}{a.postalCode ? ` ${a.postalCode}` : ""}
              </p>
              {isAdmin && (
                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border">
                  {!a.isDefault && (
                    <form action={setDefaultAddress.bind(null, a.id)}>
                      <button type="submit" className="text-xs font-medium text-primary hover:underline">Set default</button>
                    </form>
                  )}
                  <form action={deleteAddress.bind(null, a.id)} className="ms-auto">
                    <button type="submit" className="text-xs font-medium text-muted-foreground hover:text-danger">Remove</button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </B2BShell>
  );
}
