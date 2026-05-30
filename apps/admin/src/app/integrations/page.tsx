import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Plug, Search, RefreshCw, CheckCircle, Clock, AlertTriangle, ExternalLink, Settings } from "lucide-react";

export const metadata = { title: "Integration Hub" };

type IntegrationStatus = "CONNECTED" | "AVAILABLE" | "COMING_SOON";

const INTEGRATIONS: Array<{
  id: string;
  name: string;
  purpose: string;
  category: string;
  status: IntegrationStatus;
  lastSync?: string;
  iconBg: string;
  iconColor: string;
  icon: string;
}> = [
  {
    id: "int_erp",
    name: "SAP ERP",
    purpose: "Sync orders, inventory, and financials with your SAP system",
    category: "ERP",
    status: "CONNECTED",
    lastSync: "5 min ago",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    icon: "ERP",
  },
  {
    id: "int_crm",
    name: "Salesforce CRM",
    purpose: "Sync B2B accounts, contacts, and deal pipeline",
    category: "CRM",
    status: "CONNECTED",
    lastSync: "12 min ago",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
    icon: "CRM",
  },
  {
    id: "int_payment",
    name: "Stripe / Telr",
    purpose: "Accept cards, mada, BNPL, and B2B invoice payments",
    category: "Payments",
    status: "CONNECTED",
    lastSync: "Real-time",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    icon: "PAY",
  },
  {
    id: "int_shipping",
    name: "Aramex / DHL",
    purpose: "Book shipments, generate AWBs, and track deliveries",
    category: "Shipping",
    status: "CONNECTED",
    lastSync: "15 min ago",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    icon: "SHP",
  },
  {
    id: "int_wms",
    name: "Deposco WMS",
    purpose: "Warehouse management, pick/pack, and stock sync",
    category: "Warehouse",
    status: "AVAILABLE",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    icon: "WMS",
  },
  {
    id: "int_accounting",
    name: "Zoho Books",
    purpose: "Auto-generate invoices, reconcile payments, and manage VAT",
    category: "Accounting",
    status: "CONNECTED",
    lastSync: "1 hour ago",
    iconBg: "bg-yellow-100",
    iconColor: "text-yellow-600",
    icon: "ACC",
  },
  {
    id: "int_whatsapp",
    name: "WhatsApp Business API",
    purpose: "Send order updates, RFQ alerts, and marketing messages",
    category: "Messaging",
    status: "CONNECTED",
    lastSync: "Real-time",
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    icon: "WA",
  },
  {
    id: "int_search",
    name: "Algolia Search",
    purpose: "AI-powered product search, faceting, and recommendations",
    category: "Search",
    status: "CONNECTED",
    lastSync: "Instant",
    iconBg: "bg-pink-100",
    iconColor: "text-pink-600",
    icon: "SCH",
  },
  {
    id: "int_ai",
    name: "OpenAI / Claude",
    purpose: "AI recommendations, content generation, and risk scoring",
    category: "AI Provider",
    status: "CONNECTED",
    lastSync: "Real-time",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
    icon: "AI",
  },
  {
    id: "int_storage",
    name: "AWS S3 / Cloudflare R2",
    purpose: "Store product images, documents, and export files",
    category: "Storage",
    status: "CONNECTED",
    lastSync: "Real-time",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    icon: "S3",
  },
  {
    id: "int_vat",
    name: "Zatca / GAZT VAT",
    purpose: "Automated VAT filing and e-invoicing for KSA regulations",
    category: "Tax / VAT",
    status: "AVAILABLE",
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    icon: "VAT",
  },
  {
    id: "int_sso",
    name: "Azure AD SSO",
    purpose: "Single sign-on for enterprise B2B buyers and admin staff",
    category: "Identity",
    status: "COMING_SOON",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-500",
    icon: "SSO",
  },
];

const STATUS_CONFIG: Record<IntegrationStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  CONNECTED: { label: "Connected", color: "bg-green-100 text-green-700", icon: CheckCircle },
  AVAILABLE: { label: "Available", color: "bg-blue-100 text-blue-700", icon: Clock },
  COMING_SOON: { label: "Coming Soon", color: "bg-slate-100 text-slate-500", icon: AlertTriangle },
};

export default async function IntegrationsPage() {
  await requireAdminSession();

  const connected = INTEGRATIONS.filter((i) => i.status === "CONNECTED").length;
  const available = INTEGRATIONS.filter((i) => i.status === "AVAILABLE").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
              <Plug className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Integration Hub</h1>
              <p className="text-muted-foreground text-sm">Connect external services and manage data flows</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input type="text" placeholder="Search integrations..." className="bg-transparent text-sm text-slate-600 placeholder:text-slate-400 outline-none w-36" />
            </div>
            <button type="button" className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-sm transition-colors">
              <RefreshCw className="h-3.5 w-3.5" /> Sync All
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <p className="text-2xl font-bold text-green-700">{connected}</p>
            <p className="text-xs text-green-600 mt-1">Connected & Active</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-2xl font-bold text-blue-700">{available}</p>
            <p className="text-xs text-blue-600 mt-1">Available to Connect</p>
          </div>
          <div className="bg-white border border-border rounded-2xl p-4">
            <p className="text-2xl font-bold">{INTEGRATIONS.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total in Catalog</p>
          </div>
        </div>

        {/* Integration cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {INTEGRATIONS.map((integration) => {
            const cfg = STATUS_CONFIG[integration.status];
            const StatusIcon = cfg.icon;

            return (
              <div key={integration.id} className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 font-mono text-xs font-bold ${integration.iconBg} ${integration.iconColor}`}>
                    {integration.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-sm text-slate-800 truncate">{integration.name}</h3>
                    </div>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">{integration.category}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 mb-3 leading-relaxed">{integration.purpose}</p>

                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold ${cfg.color}`}>
                    <StatusIcon className="h-3 w-3" />
                    {cfg.label}
                  </span>
                  {integration.lastSync && (
                    <span className="text-xs text-muted-foreground">Synced {integration.lastSync}</span>
                  )}
                </div>

                <div className="flex gap-2">
                  {integration.status === "CONNECTED" ? (
                    <>
                      <button type="button" className="flex-1 flex items-center justify-center gap-1 text-xs border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                        <Settings className="h-3 w-3" /> Configure
                      </button>
                      <button type="button" className="flex items-center justify-center gap-1 text-xs border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                        <ExternalLink className="h-3 w-3" /> Logs
                      </button>
                    </>
                  ) : integration.status === "AVAILABLE" ? (
                    <button type="button" className="flex-1 flex items-center justify-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                      <Plug className="h-3 w-3" /> Connect
                    </button>
                  ) : (
                    <button type="button" disabled className="flex-1 text-xs bg-slate-100 text-slate-400 px-3 py-1.5 rounded-lg cursor-not-allowed">
                      Coming Soon
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
