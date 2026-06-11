# Product Analytics

<cite>
**Referenced Files in This Document**
- [apps/seller/src/app/analytics/page.tsx](file://apps/seller/src/app/analytics/page.tsx)
- [apps/customer/src/app/b2b/analytics/page.tsx](file://apps/customer/src/app/b2b/analytics/page.tsx)
- [apps/seller/src/app/performance/page.tsx](file://apps/seller/src/app/performance/page.tsx)
- [apps/admin/src/app/dashboard/dashboard-view.tsx](file://apps/admin/src/app/dashboard/dashboard-view.tsx)
- [apps/admin/src/app/ai-insights/page.tsx](file://apps/admin/src/app/ai-insights/page.tsx)
- [apps/admin/src/app/warehouse/page.tsx](file://apps/admin/src/app/warehouse/page.tsx)
- [apps/admin/src/app/pricing/page.tsx](file://apps/admin/src/app/pricing/page.tsx)
- [EXECUTIVE_DASHBOARD_NOTES.md](file://EXECUTIVE_DASHBOARD_NOTES.md)
- [MODULE_10_PRICING_COMMISSION_NOTES.md](file://MODULE_10_PRICING_COMMISSION_NOTES.md)
- [DATABASE_NOTES.md](file://DATABASE_NOTES.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document describes the Product Analytics system across the marketplace’s Admin, Seller, and B2B Customer applications. It focuses on:
- Sales performance metrics: revenue, units sold, conversion rates, average order value
- Traffic analytics: views, add-to-cart rates, bounce rates
- Product ranking and visibility: top products, category positioning
- Search performance and category positioning
- Customer sentiment: buyer ratings, return rates, response times
- Inventory analytics: stock efficiency, turnover ratios, carrying costs
- Competitive benchmarking, market share analysis, and trend identification
- Report generation, export capabilities, and custom dashboard creation

Where applicable, we map UI components and backend queries to actual source files and explain how analytics are computed and presented.

## Project Structure
The analytics surface spans three Next.js apps:
- Admin: Executive dashboards, AI insights, warehouse analytics, pricing and margins
- Seller: Sales performance, top products, category breakdown, performance benchmarking
- B2B Customer: Spend analytics by company and departments

```mermaid
graph TB
subgraph "Admin App"
AD_DASH["dashboard-view.tsx"]
AD_AI["ai-insights/page.tsx"]
AD_WH["warehouse/page.tsx"]
AD_PR["pricing/page.tsx"]
end
subgraph "Seller App"
SL_AN["analytics/page.tsx"]
SL_PERF["performance/page.tsx"]
end
subgraph "B2B Customer App"
B2B_AN["b2b/analytics/page.tsx"]
end
AD_DASH --> |"Exec KPIs"| AD_AI
AD_DASH --> |"Inventory & aging"| AD_WH
AD_DASH --> |"Margins & pricing"| AD_PR
SL_AN --> |"Sales metrics"| SL_PERF
B2B_AN --> |"Company spend"| AD_DASH
```

**Diagram sources**
- [apps/admin/src/app/dashboard/dashboard-view.tsx](file://apps/admin/src/app/dashboard/dashboard-view.tsx)
- [apps/admin/src/app/ai-insights/page.tsx](file://apps/admin/src/app/ai-insights/page.tsx)
- [apps/admin/src/app/warehouse/page.tsx](file://apps/admin/src/app/warehouse/page.tsx)
- [apps/admin/src/app/pricing/page.tsx](file://apps/admin/src/app/pricing/page.tsx)
- [apps/seller/src/app/analytics/page.tsx](file://apps/seller/src/app/analytics/page.tsx)
- [apps/seller/src/app/performance/page.tsx](file://apps/seller/src/app/performance/page.tsx)
- [apps/customer/src/app/b2b/analytics/page.tsx](file://apps/customer/src/app/b2b/analytics/page.tsx)

**Section sources**
- [apps/admin/src/app/dashboard/dashboard-view.tsx](file://apps/admin/src/app/dashboard/dashboard-view.tsx)
- [apps/admin/src/app/ai-insights/page.tsx](file://apps/admin/src/app/ai-insights/page.tsx)
- [apps/admin/src/app/warehouse/page.tsx](file://apps/admin/src/app/warehouse/page.tsx)
- [apps/admin/src/app/pricing/page.tsx](file://apps/admin/src/app/pricing/page.tsx)
- [apps/seller/src/app/analytics/page.tsx](file://apps/seller/src/app/analytics/page.tsx)
- [apps/seller/src/app/performance/page.tsx](file://apps/seller/src/app/performance/page.tsx)
- [apps/customer/src/app/b2b/analytics/page.tsx](file://apps/customer/src/app/b2b/analytics/page.tsx)

## Core Components
- Sales Analytics (Seller): Computes total revenue, units sold, monthly revenue trend, top products, and revenue by category. Also calculates average order value and order counts.
- Spend Analytics (B2B Customer): Aggregates committed spend, pending approvals, monthly trends, and departmental spend distribution.
- Performance Benchmarking (Seller): Compares seller metrics against marketplace benchmarks for on-time delivery, return rate, response time, and buyer rating.
- Executive Dashboard (Admin): Presents high-level KPIs, revenue split, RFQ funnel, order lifecycle, top categories/suppliers/customers, AI recommendations, and operational health.
- AI Insights (Admin): Provides actionable recommendations around pricing, inventory, and growth signals.
- Warehouse Analytics (Admin): Shows warehouse utilization, aging inventory, and stock by category/value.
- Pricing & Margins (Admin): Summarizes pricing tiers and margin analysis for B2C/B2B pricing.

**Section sources**
- [apps/seller/src/app/analytics/page.tsx](file://apps/seller/src/app/analytics/page.tsx)
- [apps/customer/src/app/b2b/analytics/page.tsx](file://apps/customer/src/app/b2b/analytics/page.tsx)
- [apps/seller/src/app/performance/page.tsx](file://apps/seller/src/app/performance/page.tsx)
- [apps/admin/src/app/dashboard/dashboard-view.tsx](file://apps/admin/src/app/dashboard/dashboard-view.tsx)
- [apps/admin/src/app/ai-insights/page.tsx](file://apps/admin/src/app/ai-insights/page.tsx)
- [apps/admin/src/app/warehouse/page.tsx](file://apps/admin/src/app/warehouse/page.tsx)
- [apps/admin/src/app/pricing/page.tsx](file://apps/admin/src/app/pricing/page.tsx)

## Architecture Overview
The analytics system is composed of:
- Data sources: database queries in server-side components
- Computation: client-side aggregation and chart rendering
- Presentation: reusable UI components and responsive layouts
- Executive pipeline: mock-driven dashboards with fallbacks for demo environments

```mermaid
sequenceDiagram
participant U as "User"
participant S as "Seller Analytics Page"
participant D as "Database"
participant R as "Renderer"
U->>S : "Open Analytics"
S->>D : "Fetch order items (filtered by seller and order status)"
D-->>S : "Order items with totals, quantities, timestamps"
S->>S : "Compute revenue, units, AOV, monthly trend, top products, categories"
S->>R : "Render KPIs, charts, and tables"
R-->>U : "Interactive analytics dashboard"
```

**Diagram sources**
- [apps/seller/src/app/analytics/page.tsx](file://apps/seller/src/app/analytics/page.tsx)

**Section sources**
- [apps/seller/src/app/analytics/page.tsx](file://apps/seller/src/app/analytics/page.tsx)
- [apps/admin/src/app/dashboard/dashboard-view.tsx](file://apps/admin/src/app/dashboard/dashboard-view.tsx)

## Detailed Component Analysis

### Sales Analytics (Seller)
Key metrics and computations:
- Revenue: sum of order item totals
- Units sold: sum of quantities
- Average Order Value (AOV): revenue / unique order count
- Monthly trend: revenue per calendar month over last six months
- Top products: revenue and units per product (top 6)
- Revenue by category: revenue and percentage share

```mermaid
flowchart TD
Start(["Load seller analytics"]) --> Fetch["Fetch order items for seller<br/>exclude cancelled/pending payment"]
Fetch --> ComputeTotals["Sum revenue and units<br/>count unique orders"]
ComputeTotals --> AOV["AOV = revenue / unique orders"]
ComputeTotals --> Trend["Aggregate revenue by month (last 6)"]
ComputeTotals --> TopProd["Group by product<br/>sum revenue and units"]
ComputeTotals --> CatBreakdown["Group by category<br/>sum revenue and compute %"]
Trend --> Render["Render KPIs, trend chart, top products, categories"]
TopProd --> Render
CatBreakdown --> Render
Render --> End(["Done"])
```

**Diagram sources**
- [apps/seller/src/app/analytics/page.tsx](file://apps/seller/src/app/analytics/page.tsx)

**Section sources**
- [apps/seller/src/app/analytics/page.tsx](file://apps/seller/src/app/analytics/page.tsx)

### Spend Analytics (B2B Customer)
Key metrics and computations:
- Committed spend: sum of approved/ordered purchase orders
- Pending approvals: sum of purchase orders awaiting approval
- Monthly spend: current month’s committed spend
- Departmental spend: grouped by requester department
- Monthly trend: last six months of committed spend

```mermaid
flowchart TD
StartB2B(["Load B2B spend analytics"]) --> Ctx["Get company context"]
Ctx --> QueryPO["Query purchase orders and members"]
QueryPO --> Filter["Filter committed vs pending"]
Filter --> Sum["Sum totals by status"]
Sum --> Dept["Map requester -> department<br/>aggregate spend per dept"]
Sum --> TrendB2B["Build monthly trend (6 months)"]
Dept --> RenderB2B["Render KPIs, departmental bars, trend"]
TrendB2B --> RenderB2B
RenderB2B --> EndB2B(["Done"])
```

**Diagram sources**
- [apps/customer/src/app/b2b/analytics/page.tsx](file://apps/customer/src/app/b2b/analytics/page.tsx)

**Section sources**
- [apps/customer/src/app/b2b/analytics/page.tsx](file://apps/customer/src/app/b2b/analytics/page.tsx)

### Performance Benchmarking (Seller)
Metrics compared to marketplace benchmarks:
- On-time delivery: % of delivered shipments within promised window
- Return rate: % of returned items
- Average response time: hours to first message response
- Buyer rating: average star rating

```mermaid
sequenceDiagram
participant S as "Seller Performance Page"
participant D as "Database"
participant C as "Benchmark Constants"
S->>D : "Query orders, delivered shipments, returns, message threads"
D-->>S : "Counts and timestamps"
S->>S : "Compute on-time delivery, return rate, response hours, rating"
S->>C : "Compare metrics to benchmarks"
S-->>S : "Render scorecard and trend bars"
```

**Diagram sources**
- [apps/seller/src/app/performance/page.tsx](file://apps/seller/src/app/performance/page.tsx)

**Section sources**
- [apps/seller/src/app/performance/page.tsx](file://apps/seller/src/app/performance/page.tsx)

### Executive Dashboard (Admin)
Highlights:
- KPIs: GMV, B2B/B2C revenue, commission, active companies/customers/suppliers, RFQ conversion, fulfillment rate, warehouse utilization
- Revenue split: B2B vs B2C segmented bar
- RFQ funnel: stages with counts
- Order lifecycle: stages with counts
- Top categories, suppliers, customers
- AI recommendations panel
- Operational health indicators

```mermaid
graph TB
KPIs["KPI Cards<br/>GMV, revenue, conversion, fulfillment, warehouse"] --> Split["Revenue Split B2B/B2C"]
KPIs --> Funnel["RFQ Funnel"]
KPIs --> Lifecycle["Order Lifecycle"]
KPIs --> TopCat["Top Categories"]
KPIs --> TopSup["Top Suppliers"]
KPIs --> TopCust["Top Customers"]
KPIs --> AI["AI Recommendations"]
KPIs --> Ops["Operational Health"]
```

**Diagram sources**
- [apps/admin/src/app/dashboard/dashboard-view.tsx](file://apps/admin/src/app/dashboard/dashboard-view.tsx)
- [EXECUTIVE_DASHBOARD_NOTES.md](file://EXECUTIVE_DASHBOARD_NOTES.md)

**Section sources**
- [apps/admin/src/app/dashboard/dashboard-view.tsx](file://apps/admin/src/app/dashboard/dashboard-view.tsx)
- [EXECUTIVE_DASHBOARD_NOTES.md](file://EXECUTIVE_DASHBOARD_NOTES.md)

### AI Insights (Admin)
Capabilities:
- Price optimization opportunities
- Category growth signals
- Inventory replenishment alerts
- Risk and opportunity insights
- Confidence scores and action links

```mermaid
flowchart TD
StartAI(["Load AI Insights"]) --> Classify["Classify insights by theme"]
Classify --> Rank["Rank by confidence"]
Rank --> RenderAI["Render cards with icons, tags, actions"]
RenderAI --> EndAI(["Done"])
```

**Diagram sources**
- [apps/admin/src/app/ai-insights/page.tsx](file://apps/admin/src/app/ai-insights/page.tsx)

**Section sources**
- [apps/admin/src/app/ai-insights/page.tsx](file://apps/admin/src/app/ai-insights/page.tsx)

### Warehouse Analytics (Admin)
Capabilities:
- Warehouse utilization and capacity
- Aging inventory with days in stock and value
- Stock by category/value
- Alerts for high-risk aging SKUs

```mermaid
flowchart TD
WHStart(["Load Warehouse"]) --> Util["Compute utilization per facility"]
Util --> Aging["Identify aging SKUs (>60/90 days)"]
Aging --> StockCat["Aggregate stock value by category"]
Util --> RenderWH["Render utilization charts and tables"]
Aging --> RenderWH
StockCat --> RenderWH
RenderWH --> WHEnd(["Done"])
```

**Diagram sources**
- [apps/admin/src/app/warehouse/page.tsx](file://apps/admin/src/app/warehouse/page.tsx)

**Section sources**
- [apps/admin/src/app/warehouse/page.tsx](file://apps/admin/src/app/warehouse/page.tsx)

### Pricing & Margins (Admin)
Capabilities:
- Bulk pricing tiers
- Price and margin analysis across B2C/B2B
- Commission rule overview

```mermaid
flowchart TD
PRStart(["Load Pricing"]) --> Tiers["List bulk tiers"]
PRStart --> Margin["Compute margins by channel"]
Tiers --> RenderPR["Render summary cards and tables"]
Margin --> RenderPR
RenderPR --> PREnd(["Done"])
```

**Diagram sources**
- [apps/admin/src/app/pricing/page.tsx](file://apps/admin/src/app/pricing/page.tsx)
- [MODULE_10_PRICING_COMMISSION_NOTES.md](file://MODULE_10_PRICING_COMMISSION_NOTES.md)

**Section sources**
- [apps/admin/src/app/pricing/page.tsx](file://apps/admin/src/app/pricing/page.tsx)
- [MODULE_10_PRICING_COMMISSION_NOTES.md](file://MODULE_10_PRICING_COMMISSION_NOTES.md)

## Dependency Analysis
- Seller Analytics depends on order items and order timestamps to compute revenue, units, and trends.
- B2B Spend Analytics depends on purchase orders and company member mappings to compute departmental spend.
- Performance Benchmarking compares seller metrics to hardcoded marketplace benchmarks.
- Executive Dashboard composes multiple data sources and uses mock data for KPIs and funnels when live data is unavailable.
- AI Insights and Warehouse rely on administrative datasets and mock data for demonstration.

```mermaid
graph LR
SL_AN["Seller Analytics"] --> DB["Database"]
B2B_AN["B2B Spend Analytics"] --> DB
SL_PERF["Seller Performance"] --> DB
AD_DASH["Admin Dashboard"] --> DB
AD_AI["AI Insights"] --> DB
AD_WH["Warehouse"] --> DB
AD_PR["Pricing & Margins"] --> DB
```

**Diagram sources**
- [apps/seller/src/app/analytics/page.tsx](file://apps/seller/src/app/analytics/page.tsx)
- [apps/customer/src/app/b2b/analytics/page.tsx](file://apps/customer/src/app/b2b/analytics/page.tsx)
- [apps/seller/src/app/performance/page.tsx](file://apps/seller/src/app/performance/page.tsx)
- [apps/admin/src/app/dashboard/dashboard-view.tsx](file://apps/admin/src/app/dashboard/dashboard-view.tsx)
- [apps/admin/src/app/ai-insights/page.tsx](file://apps/admin/src/app/ai-insights/page.tsx)
- [apps/admin/src/app/warehouse/page.tsx](file://apps/admin/src/app/warehouse/page.tsx)
- [apps/admin/src/app/pricing/page.tsx](file://apps/admin/src/app/pricing/page.tsx)

**Section sources**
- [apps/seller/src/app/analytics/page.tsx](file://apps/seller/src/app/analytics/page.tsx)
- [apps/customer/src/app/b2b/analytics/page.tsx](file://apps/customer/src/app/b2b/analytics/page.tsx)
- [apps/seller/src/app/performance/page.tsx](file://apps/seller/src/app/performance/page.tsx)
- [apps/admin/src/app/dashboard/dashboard-view.tsx](file://apps/admin/src/app/dashboard/dashboard-view.tsx)
- [apps/admin/src/app/ai-insights/page.tsx](file://apps/admin/src/app/ai-insights/page.tsx)
- [apps/admin/src/app/warehouse/page.tsx](file://apps/admin/src/app/warehouse/page.tsx)
- [apps/admin/src/app/pricing/page.tsx](file://apps/admin/src/app/pricing/page.tsx)

## Performance Considerations
- Efficient filtering: exclude cancelled/pending-payment orders to reduce computation overhead.
- Aggregation windows: limit rolling windows (e.g., last six months) to minimize dataset size.
- Memoization: cache department mappings and category totals to avoid repeated scans.
- Rendering: use responsive grid layouts and segmented bars to maintain interactivity without heavy libraries.
- Demo safety: fallbacks to mock data ensure consistent rendering even when live data is unavailable.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Blank analytics cards: verify session requirements and context availability (company context for B2B).
- Missing revenue data: confirm order statuses are excluded appropriately and items are included with totals and timestamps.
- Performance benchmarks not updating: ensure benchmark constants are aligned with intended targets and invert flags are set for rate metrics.
- Executive dashboard gaps: check mock data fallbacks and ensure mock datasets are loaded when live queries return no results.

**Section sources**
- [apps/seller/src/app/analytics/page.tsx](file://apps/seller/src/app/analytics/page.tsx)
- [apps/customer/src/app/b2b/analytics/page.tsx](file://apps/customer/src/app/b2b/analytics/page.tsx)
- [apps/seller/src/app/performance/page.tsx](file://apps/seller/src/app/performance/page.tsx)
- [apps/admin/src/app/dashboard/dashboard-view.tsx](file://apps/admin/src/app/dashboard/dashboard-view.tsx)

## Conclusion
The Product Analytics system integrates seller, B2B, and admin perspectives to deliver actionable insights:
- Sellers gain sales performance, top product/category visibility, and competitive benchmarking.
- Buyers and procurement teams see spend trends and departmental allocations.
- Administrators receive executive KPIs, AI-driven recommendations, warehouse insights, and pricing/margins summaries.

Future enhancements can include pre-aggregated analytics tables, export capabilities, and custom dashboard builder components.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Metrics Reference
- Sales: revenue, units sold, AOV, monthly trend, top products, category share
- Traffic: views, add-to-cart rates, bounce rates (conceptual; implementation depends on event tracking)
- Visibility: top products, category positioning, search performance (conceptual)
- Sentiment: buyer rating, return rate, response time
- Inventory: stock efficiency, turnover ratios, carrying costs, aging inventory
- Benchmarking: seller vs marketplace benchmarks
- Reports: export capabilities and custom dashboards (conceptual)

[No sources needed since this section provides general guidance]