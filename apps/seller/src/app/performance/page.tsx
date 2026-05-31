import { requireSellerSession } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { MOCK_SELLER_PERFORMANCE } from "@avenick/database";
import { TrendingUp, Clock, RotateCcw, MessageSquare, CheckCircle, AlertTriangle, XCircle, Star, Award, BarChart2, Target } from "lucide-react";

export const metadata = { title: "Performance" };

const PLATFORM_BENCHMARKS = {
  onTimeDelivery: 91,
  returnRate: 2.8,
  avgResponseTime: "3.5h",
  qualityScore: 88,
};

const SCORE_METRICS = [
  {
    key: "onTimeDelivery",
    label: "On-time Delivery",
    labelAr: "التسليم في الموعد",
    icon: TrendingUp,
    iconColor: "text-green-500",
    iconBg: "bg-green-50",
    weight: 40,
    unit: "%",
    higher: true,
    target: 90,
  },
  {
    key: "returnRate",
    label: "Return Rate",
    labelAr: "معدل الإرجاع",
    icon: RotateCcw,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-50",
    weight: 20,
    unit: "%",
    higher: false,
    target: 3,
  },
  {
    key: "avgResponseTime",
    label: "Avg Response Time",
    labelAr: "متوسط وقت الاستجابة",
    icon: MessageSquare,
    iconColor: "text-purple-500",
    iconBg: "bg-purple-50",
    weight: 20,
    unit: "",
    higher: false,
    target: "4h",
  },
  {
    key: "qualityScore",
    label: "Quality Score",
    labelAr: "درجة الجودة",
    icon: Star,
    iconColor: "text-amber-500",
    iconBg: "bg-amber-50",
    weight: 20,
    unit: "/100",
    higher: true,
    target: 85,
  },
] as const;

/** Map a 0-100 value to a Tailwind width class (nearest 5%). */
function toWidthClass(value: number): string {
  const clamped = Math.min(Math.max(Math.round(value / 5) * 5, 0), 100);
  const MAP: Record<number, string> = {
    0: "w-0", 5: "w-[5%]", 10: "w-[10%]", 15: "w-[15%]", 20: "w-1/5",
    25: "w-1/4", 30: "w-[30%]", 35: "w-[35%]", 40: "w-2/5", 45: "w-[45%]",
    50: "w-1/2", 55: "w-[55%]", 60: "w-3/5", 65: "w-[65%]", 70: "w-[70%]",
    75: "w-3/4", 80: "w-4/5", 85: "w-[85%]", 90: "w-[90%]", 95: "w-[95%]",
    100: "w-full",
  };
  return MAP[clamped] ?? "w-full";
}

/** Map a 0-100 score to a fixed Tailwind height class for the trend bar. */
function toBarHeightClass(score: number): string {
  const clamped = Math.min(Math.max(Math.round(score / 10) * 10, 0), 100);
  const MAP: Record<number, string> = {
    0: "h-0", 10: "h-[7px]", 20: "h-3.5", 30: "h-5", 40: "h-7",
    50: "h-9", 60: "h-11", 70: "h-[52px]", 80: "h-[58px]",
    90: "h-16", 100: "h-[72px]",
  };
  return MAP[clamped] ?? "h-[72px]";
}

export default async function PerformancePage() {
  const { seller } = await requireSellerSession();
  const perf = MOCK_SELLER_PERFORMANCE;

  const slaColor = perf.slaStatus === "GREEN" ? "bg-green-100 text-green-700 border-green-200" :
    perf.slaStatus === "AMBER" ? "bg-amber-100 text-amber-700 border-amber-200" :
    "bg-red-100 text-red-700 border-red-200";

  const SlaIcon = perf.slaStatus === "GREEN" ? CheckCircle : perf.slaStatus === "AMBER" ? AlertTriangle : XCircle;

  const scoreRing = perf.overallScore >= 80 ? "#22c55e" : perf.overallScore >= 60 ? "#f59e0b" : "#ef4444";
  const scoreLabel = perf.overallScore >= 90 ? "Excellent" : perf.overallScore >= 80 ? "Very Good" : perf.overallScore >= 60 ? "Good" : "Needs Improvement";

  const metrics = {
    onTimeDelivery: perf.onTimeDelivery,
    returnRate: perf.returnRate,
    avgResponseTime: perf.avgResponseTime,
    qualityScore: 91,
  };

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} performanceScore={perf.overallScore}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Seller Performance</h1>
          <p className="text-muted-foreground text-sm">Your performance metrics — last 30 days</p>
        </div>

        {/* Overall score card */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold text-foreground">Overall Score</h2>
              <p className="text-xs text-muted-foreground">Calculated from all performance metrics</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${slaColor}`}>
              <SlaIcon className="h-4 w-4" />
              SLA: {perf.slaStatus}
            </span>
          </div>

          <div className="flex items-center gap-6">
            {/* SVG ring */}
            <div className="relative h-24 w-24 shrink-0">
              <svg className="h-24 w-24 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke={scoreRing}
                  strokeWidth="3.5"
                  strokeDasharray={`${perf.overallScore} ${100 - perf.overallScore}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-foreground">{perf.overallScore}</span>
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-baseline gap-2 mb-1">
                <p className="text-3xl font-bold text-foreground">{perf.overallScore}<span className="text-lg text-muted-foreground font-normal">/100</span></p>
                <span className={`text-sm font-semibold ${perf.overallScore >= 80 ? "text-green-600" : perf.overallScore >= 60 ? "text-amber-600" : "text-red-600"}`}>
                  {scoreLabel}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Platform average: 84/100</p>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">You: <span className="font-semibold text-muted-foreground">{perf.overallScore}</span></span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                  <span className="text-muted-foreground">Platform avg: <span className="font-semibold text-muted-foreground">84</span></span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span className="text-muted-foreground">Top 10%: <span className="font-semibold text-muted-foreground">95+</span></span>
                </div>
              </div>
            </div>

            {/* Tier badge */}
            <div className="hidden sm:flex flex-col items-center gap-1 shrink-0">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/25">
                <Award className="h-7 w-7 text-white" />
              </div>
              <span className="text-xs font-semibold text-orange-600">{seller.tier}</span>
            </div>
          </div>
        </div>

        {/* Score breakdown */}
        <div>
          <h2 className="font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
            Score Breakdown
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SCORE_METRICS.map((metric) => {
              const value = metrics[metric.key as keyof typeof metrics];
              const platformValue = PLATFORM_BENCHMARKS[metric.key as keyof typeof PLATFORM_BENCHMARKS];
              const numValue = typeof value === "number" ? value : parseFloat(String(value));
              const numPlatform = typeof platformValue === "number" ? platformValue : parseFloat(String(platformValue));
              const numTarget = typeof metric.target === "number" ? metric.target : 0;

              const isGood = metric.higher
                ? numValue >= numTarget
                : numValue <= numTarget;
              const beatsPlatform = metric.higher ? numValue >= numPlatform : numValue <= numPlatform;

              const Icon = metric.icon;

              return (
                <div key={metric.key} className="bg-white rounded-2xl border border-border shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${metric.iconBg}`}>
                        <Icon className={`h-4 w-4 ${metric.iconColor}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">{metric.label}</p>
                        <p className="text-[11px] text-muted-foreground">{metric.weight}% of total score</p>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className={`text-2xl font-bold ${isGood ? "text-green-600" : "text-amber-600"}`}>
                        {value}{metric.unit}
                      </p>
                    </div>
                  </div>

                  {/* Comparison bars */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-20 shrink-0">You</span>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${isGood ? "bg-green-500" : "bg-amber-500"} ${toWidthClass(Math.min(numValue, 100))}`} />
                      </div>
                      <span className={`font-semibold w-12 text-end ${isGood ? "text-green-600" : "text-amber-600"}`}>
                        {value}{metric.unit}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-20 shrink-0">Platform avg</span>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full bg-slate-300 ${toWidthClass(Math.min(numPlatform, 100))}`} />
                      </div>
                      <span className="text-muted-foreground w-12 text-end">{platformValue}{metric.unit}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-20 shrink-0">Target</span>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full bg-blue-300 ${toWidthClass(Math.min(numTarget, 100))}`} />
                      </div>
                      <span className="text-blue-400 w-12 text-end">{metric.target}{metric.unit}</span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-1.5">
                    <Target className="h-3 w-3 text-muted-foreground" />
                    {beatsPlatform ? (
                      <span className="text-xs text-green-600 font-medium">Above platform average</span>
                    ) : (
                      <span className="text-xs text-amber-600 font-medium">Below platform average — improve to boost score</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly trend */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
          <h2 className="font-semibold text-muted-foreground mb-4">Monthly Score Trend</h2>
          <div className="flex items-end gap-3 h-28">
            {perf.monthlyTrend.map((m) => {
              const barColor = m.score >= 80 ? "bg-green-500" : m.score >= 60 ? "bg-amber-500" : "bg-red-400";
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group">
                  <span className="text-xs font-semibold text-muted-foreground group-hover:text-muted-foreground transition-colors">{m.score}</span>
                  <div
                    className={`w-full rounded-t-lg ${barColor} transition-all hover:opacity-90 ${toBarHeightClass(m.score)}`}
                    title={`${m.month}: ${m.score}/100`}
                  />
                  <span className="text-[10px] text-muted-foreground">{m.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* SLA compliance */}
        <div className={`rounded-2xl border p-4 ${slaColor}`}>
          <div className="flex items-center gap-2 mb-1">
            <SlaIcon className="h-4 w-4" />
            <p className="font-semibold text-sm">SLA Compliance — {perf.slaStatus}</p>
          </div>
          <p className="text-xs opacity-80">
            {perf.slaStatus === "GREEN"
              ? "You are meeting all SLA requirements. Keep up the excellent work to maintain your tier."
              : perf.slaStatus === "AMBER"
              ? "You are approaching SLA breach thresholds. Review your fulfillment times to avoid penalties."
              : "You have breached SLA thresholds. Immediate action required to avoid account suspension."}
          </p>
        </div>

        {/* Improvement tips */}
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
          <p className="font-semibold text-orange-800 text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            How to improve your score
          </p>
          <ul className="space-y-1.5 text-xs text-orange-700 list-disc list-inside">
            <li>Respond to RFQ requests within 4 hours to boost response rate</li>
            <li>Ship orders within the promised timeframe — on-time delivery is 40% of your score</li>
            <li>Keep product listings updated with accurate stock levels to reduce cancellations</li>
            <li>Resolve customer issues quickly to avoid escalations and return rate spikes</li>
            <li>Upload quality product images and accurate descriptions to reduce return rates</li>
          </ul>
        </div>
      </div>
    </SellerLayout>
  );
}
