# Executive Command Center

**Route:** `/admin/dashboard` · **Audience:** Founder, CEO, COO, marketplace admin, investor, enterprise client.

A premium, real-time commerce command center — not a basic admin screen. Built entirely on the
new design-system primitives (`PageHeader`, `MetricCard`, `SectionHeader`, `AIInsightCard`).

---

## Layout (top → bottom)

1. **PageHeader** — eyebrow "Avenick Commerce · Modern Trade OS", title "Executive Command Center",
   description, Live indicator pill, AI Insights CTA (accent/teal).
2. **Quick Actions** — Create RFQ (primary), Invite Supplier, Launch Campaign, Review Delayed Orders,
   Open Warehouse Queue, View AI Insights (dark).
3. **Marketplace KPIs** — 12 executive metric cards (2-col mobile → 4-col desktop).
4. **AI Recommendations** (2/3) + **Operational Health** (1/3).
5. **Visual row 1** — Revenue Split (B2B/B2C), RFQ Funnel, Order Lifecycle.
6. **Visual row 2** — Top Categories, Top Suppliers, Top Customers.

## 1. Executive KPI cards (12)
GMV · B2B Revenue · B2C Revenue · Marketplace Commission · Active Companies · Active B2C Customers ·
Active Suppliers · RFQ Conversion Rate · Order Fulfillment Rate · Warehouse Utilization ·
Open Disputes (urgent) · Delayed Orders (urgent). Each shows icon, value, trend %, sub-label.

## 2. AI recommendation panel (6)
Declining high-value B2B account · Supplier delay risk · RFQs needing backup suppliers ·
Abandoned-cart recovery · Warehouse bottleneck · Price optimization. Each = `AIInsightCard`
with confidence %, tag, and a deep-link action (→ retention / orders / rfqs / campaigns / warehouse / pricing).

## 3. Operational health (5)
RFQs pending response · Orders stuck in processing · Supplier docs expiring · Tickets near SLA breach ·
Low inventory. Severity dot (amber/red) + count + deep link. Plus a pending-supplier-review callout.

## 4. Visual sections
- **Revenue split** B2B vs B2C (segmented bar + legend, total)
- **RFQ funnel** Created → Sent → Quoted → Accepted (segmented bars)
- **Order lifecycle** Confirmed/Processing/Shipped/Delivered/Disputed
- **Top categories** by GMV (share bars)
- **Top suppliers** (rank, rating, orders, GMV)
- **Top customers** (orders, spend, B2B/B2C tag)

## 5. Quick actions
Create RFQ → `/rfqs` · Invite Supplier → `/sellers/pending` · Launch Campaign → `/campaigns` ·
Review Delayed Orders → `/orders?status=PROCESSING` · Open Warehouse Queue → `/warehouse/pickpack` ·
View AI Insights → `/ai-insights`.

---

## Data
- **Live (DB via `getAdminDashboard()`):** GMV (month), active companies, active sellers, pending reviews.
  GMV falls back to executive mock when the DB has no paid orders (demo-safe).
- **Mock (`MOCK_EXECUTIVE` in `packages/database/src/mock-data.ts`):** KPI deltas, revenue split,
  RFQ funnel, order lifecycle, top categories/suppliers, AI recommendations, operational health.
- Reuses `MOCK_TOP_CUSTOMERS`.

## UX
- Strong hierarchy (eyebrow → title → KPIs → AI → ops → analytics)
- Segmented bars only (no inline width styles)
- Responsive: 2→4 col KPIs; 3-col analytics collapse to 1 on mobile; quick actions wrap
- Empty-safe: live values fall back to mock so cards never render blank in demo

## MySQL analytics schema notes (future)
```sql
-- Pre-aggregated daily marketplace metrics for fast dashboard reads
CREATE TABLE analytics_daily (
  id VARCHAR(36) PRIMARY KEY,
  metric_date DATE NOT NULL,
  gmv DECIMAL(16,2) DEFAULT 0,
  b2b_revenue DECIMAL(16,2) DEFAULT 0,
  b2c_revenue DECIMAL(16,2) DEFAULT 0,
  commission DECIMAL(16,2) DEFAULT 0,
  orders_count INT DEFAULT 0,
  delayed_orders INT DEFAULT 0,
  fulfillment_rate DECIMAL(5,2),
  rfq_conversion_rate DECIMAL(5,2),
  active_companies INT, active_customers INT, active_suppliers INT,
  warehouse_utilization DECIMAL(5,2),
  open_disputes INT,
  UNIQUE KEY uq_metric_date (metric_date)
);

CREATE TABLE category_performance (
  id VARCHAR(36) PRIMARY KEY,
  metric_date DATE NOT NULL,
  category_id VARCHAR(36) NOT NULL,
  gmv DECIMAL(16,2) DEFAULT 0,
  orders_count INT DEFAULT 0,
  INDEX idx_date_cat (metric_date, category_id)
);
```
Populate via a nightly job aggregating `orders`, `order_items`, `rfq_requests`, `disputes`.

## Known limitations
- Executive KPIs (revenue split, conversion, fulfillment, warehouse) are mock; wire to
  `analytics_daily` when the analytics pipeline exists.
- AI recommendations are rule/mock-based (UI-ready for a real model).
- Quick-action targets are real routes; the actions themselves open those pages (no inline modals).
