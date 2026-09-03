import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db, getCustomerSegments } from "@avenick/database";
import { BadgePercent, Crown, Moon, TicketPercent, Users, UserRoundPlus, Megaphone } from "lucide-react";
import { createCoupon, createPromotion, createReferralProgram, setPromotionStatus } from "./actions";
import { CONTROL } from "@/components/console/chrome";
import Link from "next/link";
import {
  Button, CellGrid, Dateline, EmptyState, Field, LedgerTable, PageHeader,
  SectionHeader, Stat, StatusPill, Surface, type PillTone,
} from "@avenick/ui";

export const metadata = { title: "Campaigns & Promotions" };
export const dynamic = "force-dynamic";

const CURRENCIES = ["SAR", "AED", "QAR", "KWD", "OMR", "BHD", "USD"] as const;

const STATUS_TONE: Record<string, PillTone> = {
  ACTIVE: "success",
  DRAFT: "neutral",
  PAUSED: "warning",
  ENDED: "neutral",
};

/**
 * Whether checkout treats a promotion as coupon-only.
 *
 * `createCoupon` writes `eligibility.requiresCoupon = true` on the promotion the
 * moment a code is issued against it, and `evaluatePromotions` skips any rule
 * carrying that flag. It is the rule's own record of the answer, which the
 * presence of a coupon row in a truncated fetch is not.
 */
function requiresCoupon(eligibility: unknown): boolean {
  if (!eligibility || typeof eligibility !== "object" || Array.isArray(eligibility)) return false;
  return (eligibility as Record<string, unknown>)["requiresCoupon"] === true;
}

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

  return (
    <AdminLayout>
      <div className="space-y-section">
        <PageHeader
          eyebrow="CRM"
          title="Campaigns and commercial offers"
          description="Platform-governed promotions, coupon codes and referral programmes, against live customer audiences."
          dateline="Every discount is evaluated again by checkout against the stored rule; the browser never supplies the commercial answer. New offers are created in DRAFT and do nothing until an administrator activates them, and every status change is written to the audit stream."
        />

        {/* The audiences are counts of real buyers, computed at request time —
            not a segmentation model and not an estimate. Each says exactly what
            it counted, because "high value" means nothing until it names its own
            cut-off. */}
        <section aria-label="Live audiences">
          <SectionHeader title="Live audiences" description="Counted from paid orders when this page was requested." />
          <CellGrid cols={{ base: 1, sm: 3 }} density="compact">
            <Stat
              label="High-value buyers"
              value={segments.highValue.length}
              icon={Crown}
              note="The top fifth by lifetime spend"
            />
            <Stat
              label="Dormant buyers"
              value={segments.dormant60d}
              icon={Moon}
              note="No paid order in the last 60 days"
            />
            <Stat
              label="Active buyers"
              value={segments.activeLast30d}
              icon={Users}
              note="At least one paid order in the last 30 days"
            />
          </CellGrid>
        </section>

        <div className="grid grid-cols-1 gap-block xl:grid-cols-2">
          {/* Every field carries a real <label>. Round one used placeholders as
              labels throughout, which vanish the moment a character is typed and
              are never announced as names — on a form that sets discount ceilings
              and usage caps, that is a correctness problem, not a polish one. */}
          <Surface rung={2} className="p-4">
            <form action={createPromotion} className="space-y-3">
              <SectionHeader
                icon={BadgePercent}
                title="Create a promotion"
                description="It is created in DRAFT and applies to nothing until it is activated."
              />
              <Field label="Promotion name" htmlFor="promo-name" required>
                <input id="promo-name" className={CONTROL} data-rung={1} name="name" required minLength={2} maxLength={120} />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Discount type" htmlFor="promo-type" required>
                  <select id="promo-type" className={CONTROL} data-rung={1} name="type" defaultValue="PERCENTAGE">
                    <option value="PERCENTAGE">Percentage of the order</option>
                    <option value="FIXED_AMOUNT">Fixed amount off</option>
                  </select>
                </Field>
                <Field label="Currency" htmlFor="promo-currency" required hint="Used for fixed amounts and for every cap below.">
                  <select id="promo-currency" className={CONTROL} data-rung={1} name="currency" defaultValue="SAR">
                    {CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}
                  </select>
                </Field>
                <Field label="Discount value" htmlFor="promo-value" required hint="A percentage may not exceed 100.">
                  <input id="promo-value" className={CONTROL} data-rung={1} name="value" type="number" min="0.01" step="0.01" required />
                </Field>
                <Field label="Minimum order" htmlFor="promo-min" hint="Leave blank for no minimum.">
                  <input id="promo-min" className={CONTROL} data-rung={1} name="minOrderAmount" type="number" min="0" step="0.01" />
                </Field>
                <Field label="Maximum discount" htmlFor="promo-max" hint="Leave blank for no ceiling.">
                  <input id="promo-max" className={CONTROL} data-rung={1} name="maxDiscountAmount" type="number" min="0" step="0.01" />
                </Field>
                <Field label="Priority" htmlFor="promo-priority" hint="Lower numbers are considered first.">
                  <input id="promo-priority" className={CONTROL} data-rung={1} name="priority" type="number" min="1" step="1" defaultValue="100" />
                </Field>
                <Field label="Total redemptions" htmlFor="promo-usage" hint="Leave blank for no cap.">
                  <input id="promo-usage" className={CONTROL} data-rung={1} name="usageLimit" type="number" min="1" step="1" />
                </Field>
                <Field label="Redemptions per buyer" htmlFor="promo-per" hint="Leave blank for no cap.">
                  <input id="promo-per" className={CONTROL} data-rung={1} name="perCustomerLimit" type="number" min="1" step="1" />
                </Field>
                <Field label="Starts at" htmlFor="promo-starts">
                  <input id="promo-starts" className={CONTROL} data-rung={1} name="startsAt" type="datetime-local" />
                </Field>
                <Field label="Ends at" htmlFor="promo-ends" hint="Must be after the start.">
                  <input id="promo-ends" className={CONTROL} data-rung={1} name="endsAt" type="datetime-local" />
                </Field>
              </div>
              <Field label="Internal description" htmlFor="promo-desc" hint="Never shown to a buyer.">
                <textarea
                  id="promo-desc"
                  className={`${CONTROL} min-h-[72px] py-2`}
                  data-rung={1}
                  name="description"
                  maxLength={1000}
                />
              </Field>
              <label className="u-ui flex items-center gap-2 text-ink-1">
                <input name="stackable" type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" />
                Allow this offer to stack with others
              </label>
              <Button type="submit" size="sm">Create draft promotion</Button>
            </form>
          </Surface>

          <div className="space-y-block">
            <Surface rung={2} className="p-4">
              <form action={createCoupon} className="space-y-3">
                <SectionHeader
                  icon={TicketPercent}
                  title="Issue a coupon code"
                  description="A code always resolves to a governed promotion; it never carries a discount of its own."
                />
                {promotions.length === 0 ? (
                  <EmptyState
                    eyebrow="Nothing to attach to"
                    headline="There is no promotion for a code to resolve to."
                    body="Create a promotion first. Issuing a code also switches that promotion to coupon-only, so checkout cannot apply it automatically and then apply it again when the buyer types the code."
                  />
                ) : (
                  <>
                    <Field label="Promotion this code applies" htmlFor="coupon-promotion" required>
                      <select id="coupon-promotion" className={CONTROL} data-rung={1} name="promotionId" required>
                        {promotions.map((promotion) => (
                          <option key={promotion.id} value={promotion.id}>
                            {promotion.name} · {promotion.status}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Code" htmlFor="coupon-code" required hint="3–40 letters, numbers, hyphens or underscores.">
                        <input
                          id="coupon-code"
                          className={`${CONTROL} u-mono uppercase`}
                          data-rung={1}
                          name="code"
                          required
                          pattern="[A-Za-z0-9_-]{3,40}"
                        />
                      </Field>
                      <Field label="Total redemptions" htmlFor="coupon-usage" hint="Leave blank for no cap.">
                        <input id="coupon-usage" className={CONTROL} data-rung={1} name="usageLimit" type="number" min="1" step="1" />
                      </Field>
                      <Field label="Redemptions per buyer" htmlFor="coupon-per" hint="Leave blank for no cap.">
                        <input id="coupon-per" className={CONTROL} data-rung={1} name="perCustomerLimit" type="number" min="1" step="1" />
                      </Field>
                      <Field label="Starts at" htmlFor="coupon-starts">
                        <input id="coupon-starts" className={CONTROL} data-rung={1} name="startsAt" type="datetime-local" />
                      </Field>
                      <Field label="Ends at" htmlFor="coupon-ends" hint="Must be after the start.">
                        <input id="coupon-ends" className={CONTROL} data-rung={1} name="endsAt" type="datetime-local" />
                      </Field>
                    </div>
                    <Button type="submit" variant="secondary" size="sm">Issue the code</Button>
                  </>
                )}
              </form>
            </Surface>

            <Surface rung={2} className="p-4">
              <form action={createReferralProgram} className="space-y-3">
                <SectionHeader
                  icon={UserRoundPlus}
                  title="Create a referral programme"
                  description="Both rewards are fixed amounts in the currency chosen here."
                />
                <Field label="Programme name" htmlFor="referral-name" required>
                  <input id="referral-name" className={CONTROL} data-rung={1} name="name" required minLength={2} maxLength={120} />
                </Field>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Currency" htmlFor="referral-currency" required>
                    <select id="referral-currency" className={CONTROL} data-rung={1} name="currency" defaultValue="SAR">
                      {CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}
                    </select>
                  </Field>
                  <Field label="Uses per code" htmlFor="referral-uses" hint="Leave blank for no cap.">
                    <input id="referral-uses" className={CONTROL} data-rung={1} name="maxUsesPerCode" type="number" min="1" step="1" />
                  </Field>
                  <Field label="Reward to the referrer" htmlFor="referral-referrer" required>
                    <input id="referral-referrer" className={CONTROL} data-rung={1} name="referrerRewardValue" type="number" min="0" step="0.01" required />
                  </Field>
                  <Field label="Reward to the new buyer" htmlFor="referral-referee" required>
                    <input id="referral-referee" className={CONTROL} data-rung={1} name="refereeRewardValue" type="number" min="0" step="0.01" required />
                  </Field>
                  <Field label="Starts at" htmlFor="referral-starts">
                    <input id="referral-starts" className={CONTROL} data-rung={1} name="startsAt" type="datetime-local" />
                  </Field>
                  <Field label="Ends at" htmlFor="referral-ends" hint="Must be after the start.">
                    <input id="referral-ends" className={CONTROL} data-rung={1} name="endsAt" type="datetime-local" />
                  </Field>
                </div>
                <Button type="submit" variant="secondary" size="sm">Create draft programme</Button>
              </form>
            </Surface>
          </div>
        </div>

        <LedgerTable
          title="Promotion register"
          dateline="The 100 most recently created promotions · every status change is appended to the audit stream"
          rows={promotions}
          getRowKey={(p) => p.id}
          stickyHead
          columns={[
            {
              key: "promotion",
              label: "Promotion",
              render: (p) => (
                <>
                  <span className="block truncate font-medium text-ink-1">{p.name}</span>
                  <span className="u-meta block text-ink-3">
                    Priority <span className="fig">{p.priority}</span> · {p.stackable ? "stacks with others" : "exclusive"}
                  </span>
                </>
              ),
            },
            {
              key: "rule",
              label: "Rule",
              numeric: true,
              width: "132px",
              render: (p) =>
                p.type === "PERCENTAGE"
                  ? `${Number(p.value)}%`
                  : `${p.currency ?? ""} ${Number(p.value).toFixed(2)}`.trim(),
            },
            {
              key: "limits",
              label: "Caps",
              hideOnMobile: true,
              width: "168px",
              render: (p) => (
                <span className="u-meta block text-ink-2">
                  {p.usageLimit ? `${p.usageLimit} in total` : "No total cap"}
                  <br />
                  {p.perCustomerLimit ? `${p.perCustomerLimit} per buyer` : "No per-buyer cap"}
                </span>
              ),
            },
            {
              key: "codes",
              label: "Codes",
              width: "180px",
              render: (p) => {
                const rows = couponByPromotion.get(p.id) ?? [];
                // "Applied automatically" is a statement about how CHECKOUT
                // treats this rule, so it is read from the rule itself, not from
                // whether a coupon row happened to land inside the hundred most
                // recent codes fetched above. A promotion whose codes fall
                // outside that window is still coupon-gated, and printing
                // "Applied automatically" against it would tell an operator the
                // opposite of what the engine does.
                if (rows.length === 0) {
                  return requiresCoupon(p.eligibility) ? (
                    <span className="u-meta text-ink-3">Code required · none in the latest 100</span>
                  ) : (
                    <span className="u-meta text-ink-3">Applied automatically</span>
                  );
                }
                return (
                  <span className="flex flex-wrap gap-1">
                    {rows.map((coupon) => (
                      <span key={coupon.id} className="u-mono u-meta rounded-nested bg-neutral-soft px-1.5 py-0.5 text-ink-2">
                        {coupon.code}
                      </span>
                    ))}
                  </span>
                );
              },
            },
            {
              key: "status",
              label: "Status",
              width: "108px",
              render: (p) => (
                <StatusPill tone={STATUS_TONE[p.status] ?? "neutral"} dot={p.status === "ACTIVE"}>
                  {p.status}
                </StatusPill>
              ),
            },
            {
              key: "control",
              label: "Control",
              align: "end",
              width: "212px",
              render: (p) => (
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {["ACTIVE", "PAUSED", "ENDED"]
                    .filter((next) => next !== p.status)
                    .map((next) => (
                      <form key={next} action={setPromotionStatus.bind(null, p.id, next)}>
                        {/* Activating is the one step that starts discounting
                            money, so it is the only raised control here. */}
                        <Button type="submit" variant={next === "ACTIVE" ? "secondary" : "ghost"} size="xs">
                          {next === "ACTIVE" ? "Activate" : next === "PAUSED" ? "Pause" : "End"}
                          <span className="sr-only"> {p.name}</span>
                        </Button>
                      </form>
                    ))}
                </div>
              ),
            },
          ]}
          empty={
            <EmptyState
              variant="certificate"
              glyph={<Megaphone />}
              eyebrow="Nothing configured"
              headline="No promotion has been created on this platform."
              body="Until one exists and is activated, checkout applies no platform discount at all. The form above creates one in DRAFT, where it affects nothing."
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/segments">Review the audiences first</Link>
                </Button>
              }
            />
          }
        />

        <LedgerTable
          title="Referral programmes"
          dateline="The 50 most recently created programmes"
          rows={referrals}
          getRowKey={(r) => r.id}
          density="compact"
          columns={[
            {
              key: "name",
              label: "Programme",
              render: (r) => <span className="block truncate text-ink-1">{r.name}</span>,
            },
            {
              key: "referrer",
              label: "Referrer reward",
              numeric: true,
              render: (r) => `${r.currency} ${Number(r.referrerRewardValue).toFixed(2)}`,
            },
            {
              key: "referee",
              label: "New buyer reward",
              numeric: true,
              render: (r) => `${r.currency} ${Number(r.refereeRewardValue).toFixed(2)}`,
            },
            {
              key: "status",
              label: "Status",
              align: "end",
              width: "108px",
              render: (r) => (
                <StatusPill tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</StatusPill>
              ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Nothing configured"
              headline="No referral programme has been created."
              body="A programme appears here as soon as one is created, and starts in DRAFT."
            />
          }
        />

        <Dateline>
          Discount values, caps and eligibility are re-evaluated by checkout against the stored rule on every order.
          Nothing on this screen is the authority on what a buyer is actually charged.
        </Dateline>
      </div>
    </AdminLayout>
  );
}
