import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db, getCustomerSegments } from "@avenick/database";
import { BadgePercent, Crown, Moon, TicketPercent, Users, UserRoundPlus } from "lucide-react";
import { createCoupon, createPromotion, createReferralProgram, setPromotionStatus } from "./actions";

export const metadata = { title: "Campaigns & Promotions" };
export const dynamic = "force-dynamic";

const input = "h-10 rounded-xl border border-input bg-background px-3 text-sm";

export default async function CampaignsPage() {
  await requireAdminSession();

  const [segments, promotions, coupons, referrals] = await Promise.all([
    getCustomerSegments(),
    db.commercePromotion.findMany({ orderBy: [{ createdAt: "desc" }], take: 100 }),
    db.promotionCoupon.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    db.referralProgram.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  const couponByPromotion = new Map<string, typeof coupons>();
  for (const coupon of coupons) {
    const rows = couponByPromotion.get(coupon.promotionId) ?? [];
    rows.push(coupon);
    couponByPromotion.set(coupon.promotionId, rows);
  }

  const audiences = [
    { icon: Crown, title: "High-value buyers", count: segments.highValue.length, detail: "Top 20% by lifetime spend" },
    { icon: Moon, title: "Dormant buyers", count: segments.dormant60d, detail: "No purchase for 60+ days" },
    { icon: Users, title: "Active buyers", count: segments.activeLast30d, detail: "Purchased in the last 30 days" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Campaigns & Commercial Offers</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Platform-governed promotions, coupon codes, referrals and live customer audiences. Discount amounts are evaluated again by checkout; the browser never supplies the commercial answer.
          </p>
        </div>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {audiences.map((audience) => {
            const Icon = audience.icon;
            return (
              <div key={audience.title} className="rounded-2xl border bg-white p-5">
                <Icon className="h-5 w-5 text-primary mb-3" />
                <p className="text-2xl font-bold">{audience.count}</p>
                <p className="font-semibold text-sm mt-1">{audience.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{audience.detail}</p>
              </div>
            );
          })}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <form action={createPromotion} className="rounded-2xl border bg-white p-5 space-y-4">
            <div className="flex items-center gap-2">
              <BadgePercent className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-semibold">Create promotion</h2>
                <p className="text-xs text-muted-foreground">New offers begin in Draft and must be explicitly activated.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className={`${input} sm:col-span-2`} name="name" placeholder="Promotion name" required minLength={2} maxLength={120} />
              <select className={input} name="type" defaultValue="PERCENTAGE">
                <option value="PERCENTAGE">Percentage discount</option>
                <option value="FIXED_AMOUNT">Fixed amount</option>
              </select>
              <select className={input} name="currency" defaultValue="SAR">
                {['SAR','AED','QAR','KWD','OMR','BHD','USD'].map((currency) => <option key={currency}>{currency}</option>)}
              </select>
              <input className={input} name="value" type="number" min="0.01" step="0.01" placeholder="Discount value" required />
              <input className={input} name="minOrderAmount" type="number" min="0" step="0.01" placeholder="Minimum order" />
              <input className={input} name="maxDiscountAmount" type="number" min="0" step="0.01" placeholder="Maximum discount" />
              <input className={input} name="usageLimit" type="number" min="1" step="1" placeholder="Total usage limit" />
              <input className={input} name="perCustomerLimit" type="number" min="1" step="1" placeholder="Per-customer limit" />
              <input className={input} name="priority" type="number" min="1" step="1" defaultValue="100" aria-label="Priority" />
              <input className={input} name="startsAt" type="datetime-local" aria-label="Starts at" />
              <input className={input} name="endsAt" type="datetime-local" aria-label="Ends at" />
              <label className="flex items-center gap-2 text-sm px-1"><input name="stackable" type="checkbox" /> Allow stacking</label>
              <textarea className="sm:col-span-2 min-h-20 rounded-xl border border-input bg-background p-3 text-sm" name="description" placeholder="Internal offer description" maxLength={1000} />
            </div>
            <button className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white" type="submit">Create draft promotion</button>
          </form>

          <div className="space-y-6">
            <form action={createCoupon} className="rounded-2xl border bg-white p-5 space-y-4">
              <div className="flex items-center gap-2"><TicketPercent className="h-5 w-5 text-primary" /><h2 className="font-semibold">Issue coupon code</h2></div>
              {promotions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Create a promotion first; coupon codes always resolve to a governed promotion.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select className={`${input} sm:col-span-2`} name="promotionId" required>
                    {promotions.map((promotion) => <option key={promotion.id} value={promotion.id}>{promotion.name} · {promotion.status}</option>)}
                  </select>
                  <input className={input} name="code" placeholder="SUMMER20" required pattern="[A-Za-z0-9_-]{3,40}" />
                  <input className={input} name="usageLimit" type="number" min="1" step="1" placeholder="Total uses" />
                  <input className={input} name="perCustomerLimit" type="number" min="1" step="1" placeholder="Uses / customer" />
                  <input className={input} name="startsAt" type="datetime-local" aria-label="Coupon starts at" />
                  <input className={input} name="endsAt" type="datetime-local" aria-label="Coupon ends at" />
                  <button className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white sm:col-span-2" type="submit">Create coupon</button>
                </div>
              )}
            </form>

            <form action={createReferralProgram} className="rounded-2xl border bg-white p-5 space-y-4">
              <div className="flex items-center gap-2"><UserRoundPlus className="h-5 w-5 text-primary" /><h2 className="font-semibold">Create referral program</h2></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className={`${input} sm:col-span-2`} name="name" placeholder="Referral program name" required />
                <select className={input} name="currency" defaultValue="SAR">{['SAR','AED','QAR','KWD','OMR','BHD','USD'].map((currency) => <option key={currency}>{currency}</option>)}</select>
                <input className={input} name="maxUsesPerCode" type="number" min="1" step="1" placeholder="Max uses / code" />
                <input className={input} name="referrerRewardValue" type="number" min="0" step="0.01" placeholder="Referrer reward" required />
                <input className={input} name="refereeRewardValue" type="number" min="0" step="0.01" placeholder="New buyer reward" required />
                <input className={input} name="startsAt" type="datetime-local" aria-label="Referral starts at" />
                <input className={input} name="endsAt" type="datetime-local" aria-label="Referral ends at" />
                <button className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white sm:col-span-2" type="submit">Create draft referral program</button>
              </div>
            </form>
          </div>
        </section>

        <section className="rounded-2xl border bg-white overflow-hidden">
          <div className="p-5 border-b"><h2 className="font-semibold">Promotion register</h2><p className="text-xs text-muted-foreground mt-1">Every status change is written to the immutable audit stream.</p></div>
          {promotions.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No promotions configured.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left"><tr><th className="p-3">Promotion</th><th className="p-3">Rule</th><th className="p-3">Limits</th><th className="p-3">Codes</th><th className="p-3">Status</th><th className="p-3">Control</th></tr></thead>
                <tbody>
                  {promotions.map((promotion) => (
                    <tr key={promotion.id} className="border-t align-top">
                      <td className="p-3"><p className="font-medium">{promotion.name}</p><p className="text-xs text-muted-foreground">Priority {promotion.priority}{promotion.stackable ? ' · stackable' : ' · exclusive'}</p></td>
                      <td className="p-3">{promotion.type === 'PERCENTAGE' ? `${Number(promotion.value)}%` : `${promotion.currency ?? ''} ${Number(promotion.value).toFixed(2)}`}</td>
                      <td className="p-3 text-xs text-muted-foreground">{promotion.usageLimit ? `${promotion.usageLimit} total` : 'No total cap'}<br />{promotion.perCustomerLimit ? `${promotion.perCustomerLimit} / buyer` : 'No buyer cap'}</td>
                      <td className="p-3 text-xs">{(couponByPromotion.get(promotion.id) ?? []).map((coupon) => <span key={coupon.id} className="mr-1 mb-1 inline-block rounded bg-muted px-2 py-1 font-mono">{coupon.code}</span>)}</td>
                      <td className="p-3"><span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">{promotion.status}</span></td>
                      <td className="p-3"><div className="flex flex-wrap gap-1">{['ACTIVE','PAUSED','ENDED'].filter((status) => status !== promotion.status).map((status) => <form action={setPromotionStatus.bind(null, promotion.id, status)} key={status}><button className="rounded-lg border px-2 py-1 text-xs hover:bg-muted" type="submit">{status === 'ACTIVE' ? 'Activate' : status === 'PAUSED' ? 'Pause' : 'End'}</button></form>)}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-semibold mb-3">Referral programs</h2>
          {referrals.length === 0 ? <p className="text-sm text-muted-foreground">No referral programs configured.</p> : <div className="grid md:grid-cols-2 gap-3">{referrals.map((program) => <div key={program.id} className="rounded-xl border p-3"><div className="flex justify-between gap-3"><p className="font-medium text-sm">{program.name}</p><span className="text-xs rounded-full bg-muted px-2 py-1">{program.status}</span></div><p className="text-xs text-muted-foreground mt-2">Referrer: {program.currency} {Number(program.referrerRewardValue).toFixed(2)} · New buyer: {program.currency} {Number(program.refereeRewardValue).toFixed(2)}</p></div>)}</div>}
        </section>
      </div>
    </AdminLayout>
  );
}
