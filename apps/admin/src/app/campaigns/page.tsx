import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getCustomerSegments } from "@avenick/database";
import { Megaphone, Users, Moon, Crown, ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Campaigns" };
export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  await requireAdminSession();

  // Campaign execution (email/SMS sends) is not enabled yet. Rather than
  // showing fabricated campaign stats, surface the real audiences that a
  // campaign engine would target.
  const s = await getCustomerSegments();

  const audiences = [
    {
      icon: Crown,
      color: "bg-amber-50 border-amber-200 text-amber-600",
      title: "High-value buyers",
      count: s.highValue.length,
      description: "Top 20% by lifetime spend — candidates for loyalty offers and account management.",
      href: "/segments",
    },
    {
      icon: Moon,
      color: "bg-slate-50 border-border text-muted-foreground",
      title: "Dormant buyers (60d+)",
      count: s.dormant60d,
      description: "Purchased before but not recently — candidates for win-back campaigns.",
      href: "/retention",
    },
    {
      icon: Users,
      color: "bg-green-50 border-green-200 text-green-600",
      title: "Active buyers (30d)",
      count: s.activeLast30d,
      description: "Recently purchasing — candidates for cross-sell and replenishment reminders.",
      href: "/segments",
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground text-sm">Audience targeting for marketing campaigns, built on live segments.</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
          <Megaphone className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Campaign delivery is not configured yet</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Sending (email/SMS/WhatsApp) requires the Resend and Twilio integrations to be enabled. The audiences below are
              live and ready to target once delivery is connected — no fabricated campaign metrics are shown here.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {audiences.map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.title} href={a.href} className={`group rounded-2xl border p-5 transition-transform hover:-translate-y-0.5 ${a.color.split(" ").slice(0, 2).join(" ")}`}>
                <div className="flex items-center justify-between mb-3">
                  <Icon className={`h-5 w-5 ${a.color.split(" ")[2]}`} />
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <p className="text-2xl font-bold">{a.count}</p>
                <p className="font-semibold text-sm mt-0.5">{a.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{a.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
