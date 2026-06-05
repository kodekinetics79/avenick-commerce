# Business Intelligence & Analytics

<cite>
**Referenced Files in This Document**
- [admin-dashboard-page.tsx](file://apps/admin/src/app/dashboard/page.tsx)
- [admin-dashboard-view.tsx](file://apps/admin/src/app/dashboard/dashboard-view.tsx)
- [ai-insights-page.tsx](file://apps/admin/src/app/ai-insights/page.tsx)
- [customer-analytics-page.tsx](file://apps/customer/src/app/b2b/analytics/page.tsx)
- [seller-analytics-page.tsx](file://apps/seller/src/app/analytics/page.tsx)
- [performance-page.tsx](file://apps/admin/src/app/performance/page.tsx)
- [auth-lib.ts](file://apps/admin/src/lib/auth.ts)
- [auth-lib.ts](file://apps/customer/src/lib/auth-instance.ts)
- [auth-lib.ts](file://apps/seller/src/lib/auth.ts)
- [utils-format-currency.ts](file://packages/utils/src/format-currency.ts)
- [database-index.ts](file://packages/database/src/index.ts)
- [database-executive-mocks.ts](file://packages/database/src/executive-mocks.ts)
- [database-models.ts](file://packages/database/src/models.ts)
- [admin-layout.tsx](file://apps/admin/src/components/layout/admin-layout.tsx)
- [seller-layout.tsx](file://apps/seller/src/components/layout/seller-layout.tsx)
- [b2b-shell.tsx](file://apps/customer/src/components/b2b/b2b-shell.tsx)
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

## Introduction
This document describes the Business Intelligence and Analytics platform that powers market insights, performance metrics, and strategic decision support across the commerce ecosystem. It covers:
- Executive dashboards for KPIs, sales trends, and market position
- AI-powered insights generation and recommendation engines
- Competitive analysis, pricing intelligence, and demand forecasting
- Customer behavior analytics, sales funnel optimization, and conversion rate analysis
- Report generation, custom dashboards, and data export
- Market trend analysis, seasonal pattern recognition, and growth opportunity identification
- Integrations with external market data sources and real-time analytics processing

## Project Structure
The analytics platform spans three Next.js applications:
- Admin portal: executive dashboards, AI insights, supplier performance, and administrative analytics
- Customer (B2B) portal: spend analytics and procurement insights
- Seller portal: product and sales performance analytics

```mermaid
graph TB
subgraph "Admin Portal"
AD["Admin Dashboard<br/>page.tsx"]
AV["Admin Layout<br/>admin-layout.tsx"]
AI["AI Insights<br/>ai-insights/page.tsx"]
PERF["Supplier Performance<br/>performance/page.tsx"]
end
subgraph "Customer Portal"
CA["Spend Analytics<br/>customer/b2b/analytics/page.tsx"]
B2B["B2B Shell<br/>b2b-shell.tsx"]
end
subgraph "Seller Portal"
SA["Analytics<br/>seller/analytics/page.tsx"]
SL["Seller Layout<br/>seller-layout.tsx"]
end
subgraph "Shared Packages"
DB["@avenick/database<br/>models.ts"]
UT["@avenick/utils<br/>format-currency.ts"]
end
AD --> AV
AI --> AV
PERF --> AV
CA --> B2B
SA --> SL
AD --> DB
AI --> DB
PERF --> DB
CA --> DB
SA --> DB
AD --> UT
CA --> UT
SA --> UT
```

**Diagram sources**
- [admin-dashboard-page.tsx:1-28](file://apps/admin/src/app/dashboard/page.tsx#L1-L28)
- [admin-dashboard-view.tsx](file://apps/admin/src/app/dashboard/dashboard-view.tsx)
- [ai-insights-page.tsx:1-318](file://apps/admin/src/app/ai-insights/page.tsx#L1-L318)
- [performance-page.tsx:1-97](file://apps/admin/src/app/performance/page.tsx#L1-L97)
- [customer-analytics-page.tsx:1-121](file://apps/customer/src/app/b2b/analytics/page.tsx#L1-L121)
- [seller-analytics-page.tsx:1-156](file://apps/seller/src/app/analytics/page.tsx#L1-L156)
- [admin-layout.tsx](file://apps/admin/src/components/layout/admin-layout.tsx)
- [seller-layout.tsx](file://apps/seller/src/components/layout/seller-layout.tsx)
- [b2b-shell.tsx](file://apps/customer/src/components/b2b/b2b-shell.tsx)
- [database-index.ts](file://packages/database/src/index.ts)
- [utils-format-currency.ts](file://packages/utils/src/format-currency.ts)

**Section sources**
- [admin-dashboard-page.tsx:1-28](file://apps/admin/src/app/dashboard/page.tsx#L1-L28)
- [ai-insights-page.tsx:1-318](file://apps/admin/src/app/ai-insights/page.tsx#L1-L318)
- [customer-analytics-page.tsx:1-121](file://apps/customer/src/app/b2b/analytics/page.tsx#L1-L121)
- [seller-analytics-page.tsx:1-156](file://apps/seller/src/app/analytics/page.tsx#L1-L156)
- [performance-page.tsx:1-97](file://apps/admin/src/app/performance/page.tsx#L1-L97)

## Core Components
- Executive Dashboard (Admin): Renders live GMV and other KPIs, aggregates counts of pending profiles, and passes serializable data to the client-side dashboard view.
- AI Insights (Admin): Presents categorized AI-generated insights with confidence levels and recommended actions, integrating with internal operational domains (Commerce, B2B, Operations, Risk).
- Spend Analytics (Customer/B2B): Provides committed spend, monthly trends, and departmental breakdowns for procurement visibility.
- Supplier Performance (Admin): Displays marketplace-wide supplier scorecards, SLA metrics, and risk indicators.
- Sales Analytics (Seller): Shows revenue, units, monthly trends, top products, and category distribution.

**Section sources**
- [admin-dashboard-page.tsx:7-27](file://apps/admin/src/app/dashboard/page.tsx#L7-L27)
- [ai-insights-page.tsx:197-313](file://apps/admin/src/app/ai-insights/page.tsx#L197-L313)
- [customer-analytics-page.tsx:11-120](file://apps/customer/src/app/b2b/analytics/page.tsx#L11-L120)
- [performance-page.tsx:20-96](file://apps/admin/src/app/performance/page.tsx#L20-L96)
- [seller-analytics-page.tsx:11-155](file://apps/seller/src/app/analytics/page.tsx#L11-L155)

## Architecture Overview
The platform follows a layered architecture:
- UI Layer: Next.js pages and shared layouts/components
- Data Access Layer: Shared @avenick/database package for Prisma models and mocks
- Utilities: Shared @avenick/utils for formatting and helpers
- Authentication: Role-specific auth guards and sessions per app

```mermaid
graph TB
UI_Admin["Admin UI Pages<br/>dashboard, ai-insights, performance"]
UI_Customer["Customer UI Pages<br/>spend analytics"]
UI_Seller["Seller UI Pages<br/>analytics"]
Auth_Admin["Admin Auth Guard<br/>requireAdminSession"]
Auth_Customer["Customer Auth Instance<br/>auth-instance"]
Auth_Seller["Seller Auth Guard<br/>requireSellerSession"]
Utils["@avenick/utils<br/>format-currency"]
DB["@avenick/database<br/>Prisma models + mocks"]
UI_Admin --> Auth_Admin
UI_Customer --> Auth_Customer
UI_Seller --> Auth_Seller
UI_Admin --> DB
UI_Customer --> DB
UI_Seller --> DB
UI_Admin --> Utils
UI_Customer --> Utils
UI_Seller --> Utils
```

**Diagram sources**
- [admin-dashboard-page.tsx:1-2](file://apps/admin/src/app/dashboard/page.tsx#L1-L2)
- [ai-insights-page.tsx:1-2](file://apps/admin/src/app/ai-insights/page.tsx#L1-L2)
- [customer-analytics-page.tsx:1-4](file://apps/customer/src/app/b2b/analytics/page.tsx#L1-L4)
- [seller-analytics-page.tsx:1-3](file://apps/seller/src/app/analytics/page.tsx#L1-L3)
- [utils-format-currency.ts](file://packages/utils/src/format-currency.ts)
- [database-index.ts](file://packages/database/src/index.ts)

## Detailed Component Analysis

### Executive Dashboard (Admin)
The Admin Dashboard page fetches live metrics and falls back to mock data for demonstration. It renders a dashboard view component with serialized props.

```mermaid
sequenceDiagram
participant Browser as "Browser"
participant Page as "AdminDashboardPage<br/>page.tsx"
participant Auth as "requireAdminSession"
participant DB as "getAdminDashboard/db"
participant View as "DashboardView"
Browser->>Page : "GET /admin/dashboard"
Page->>Auth : "requireAdminSession()"
Auth-->>Page : "session ok"
Page->>DB : "getAdminDashboard()"
DB-->>Page : "dash {gmvMonth, activeCompanies, activeSellers}"
Page->>DB : "count sellers PENDING_REVIEW"
DB-->>Page : "pendingCount"
Page->>View : "render with exec, topCustomers, gmvMonth, activeCompanies, activeSellers, pendingCount"
View-->>Browser : "SSR HTML"
```

**Diagram sources**
- [admin-dashboard-page.tsx:7-27](file://apps/admin/src/app/dashboard/page.tsx#L7-L27)

**Section sources**
- [admin-dashboard-page.tsx:7-27](file://apps/admin/src/app/dashboard/page.tsx#L7-L27)

### AI Insights Engine (Admin)
The AI Insights page displays categorized insights with confidence indicators and links to relevant sections. It includes a recommended actions panel prioritized by AI.

```mermaid
flowchart TD
Start(["Load AI Insights"]) --> Tabs["Render Insight Tabs<br/>Commerce, B2B, Operations, Risk"]
Tabs --> Panels["Render Insight Cards<br/>title, description, confidence, tag, CTA"]
Panels --> Actions["Render Recommended Actions<br/>priority, label, link"]
Actions --> ModelInfo["Show AI Model Status<br/>version, freshness, signals, actions"]
ModelInfo --> End(["Ready"])
```

**Diagram sources**
- [ai-insights-page.tsx:197-313](file://apps/admin/src/app/ai-insights/page.tsx#L197-L313)

**Section sources**
- [ai-insights-page.tsx:10-187](file://apps/admin/src/app/ai-insights/page.tsx#L10-L187)
- [ai-insights-page.tsx:189-195](file://apps/admin/src/app/ai-insights/page.tsx#L189-L195)
- [ai-insights-page.tsx:197-313](file://apps/admin/src/app/ai-insights/page.tsx#L197-L313)

### Spend Analytics (Customer/B2B)
The B2B Spend Analytics page computes committed spend, monthly trends, and departmental distribution. It requires a B2B context and formats currency via shared utilities.

```mermaid
sequenceDiagram
participant Browser as "Browser"
participant Page as "SpendAnalyticsPage<br/>customer/b2b/analytics/page.tsx"
participant B2B as "getB2BContext"
participant DB as "db.purchaseOrder / companyMember"
participant Utils as "formatCurrency"
Browser->>Page : "GET /customer/b2b/analytics"
Page->>B2B : "getB2BContext()"
B2B-->>Page : "ctx {companyId, company}"
Page->>DB : "findMany purchaseOrders + companyMembers"
DB-->>Page : "pos, members"
Page->>Page : "compute totals, monthly trend, dept spend"
Page->>Utils : "formatCurrency(value, 'AED')"
Utils-->>Page : "formatted strings"
Page-->>Browser : "SSR HTML with KPIs, charts"
```

**Diagram sources**
- [customer-analytics-page.tsx:11-120](file://apps/customer/src/app/b2b/analytics/page.tsx#L11-L120)

**Section sources**
- [customer-analytics-page.tsx:11-120](file://apps/customer/src/app/b2b/analytics/page.tsx#L11-L120)

### Supplier Performance (Admin)
The Supplier Performance page aggregates marketplace-wide metrics and displays supplier scorecards with trend indicators.

```mermaid
flowchart TD
Start(["Load Supplier Performance"]) --> Metrics["Compute Avg Score, At-Risk Count"]
Metrics --> RiskAlert{"Any suppliers < 80?"}
RiskAlert --> |Yes| Alert["Render Risk Alert Banner"]
RiskAlert --> |No| NoAlert["No Alert"]
Alert --> Table["Render Scorecards Table<br/>Score, On-Time, Return Rate, Response, Trend"]
NoAlert --> Table
Table --> End(["Ready"])
```

**Diagram sources**
- [performance-page.tsx:20-96](file://apps/admin/src/app/performance/page.tsx#L20-L96)

**Section sources**
- [performance-page.tsx:9-15](file://apps/admin/src/app/performance/page.tsx#L9-L15)
- [performance-page.tsx:20-96](file://apps/admin/src/app/performance/page.tsx#L20-L96)

### Sales Analytics (Seller)
The Seller Analytics page computes revenue, units, monthly trends, top products, and category distribution.

```mermaid
sequenceDiagram
participant Browser as "Browser"
participant Page as "Seller Analytics<br/>seller/analytics/page.tsx"
participant Auth as "requireSellerSession"
participant DB as "db.orderItem"
participant Utils as "formatCurrency"
Browser->>Page : "GET /seller/analytics"
Page->>Auth : "requireSellerSession()"
Auth-->>Page : "seller session"
Page->>DB : "findMany orderItems (excl CANCELLED/PENDING_PAYMENT)"
DB-->>Page : "items with order/product"
Page->>Page : "compute totals, AOV, monthly trend, top products, categories"
Page->>Utils : "formatCurrency(value, 'AED')"
Utils-->>Page : "formatted strings"
Page-->>Browser : "SSR HTML with KPIs, charts"
```

**Diagram sources**
- [seller-analytics-page.tsx:11-155](file://apps/seller/src/app/analytics/page.tsx#L11-L155)

**Section sources**
- [seller-analytics-page.tsx:11-155](file://apps/seller/src/app/analytics/page.tsx#L11-L155)

### Conceptual Overview
The platform integrates real-time data with AI-driven insights to enable:
- Real-time dashboards and alerts
- Predictive signals for inventory, pricing, and demand
- Strategic recommendations aligned with business outcomes
- Cross-functional collaboration via shared insights and actions

```mermaid
graph TB
LiveData["Live Platform Data"] --> AI["AI Insights Engine"]
AI --> Insights["Insights & Confidence"]
Insights --> Actions["Recommended Actions"]
Actions --> Dashboards["Dashboards & Reports"]
Dashboards --> Decisions["Strategic Decisions"]
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

## Dependency Analysis
Key dependencies and relationships:
- UI pages depend on shared auth guards and layouts
- All analytics pages depend on @avenick/database for data access and @avenick/utils for formatting
- Mock data is used for executive dashboards and supplier performance to demonstrate capability

```mermaid
graph LR
AD_Page["Admin Dashboard Page"] --> AD_Layout["Admin Layout"]
AD_Page --> DB_Pkg["@avenick/database"]
AD_Page --> Utils_Pkg["@avenick/utils"]
AI_Page["AI Insights Page"] --> AD_Layout
AI_Page --> DB_Pkg
AI_Page --> Utils_Pkg
Perf_Page["Supplier Performance Page"] --> AD_Layout
Perf_Page --> DB_Pkg
Cust_Page["Customer Analytics Page"] --> B2B_Shell["B2B Shell"]
Cust_Page --> DB_Pkg
Cust_Page --> Utils_Pkg
Sell_Page["Seller Analytics Page"] --> Sell_Layout["Seller Layout"]
Sell_Page --> DB_Pkg
Sell_Page --> Utils_Pkg
```

**Diagram sources**
- [admin-dashboard-page.tsx:1-3](file://apps/admin/src/app/dashboard/page.tsx#L1-L3)
- [ai-insights-page.tsx:1-2](file://apps/admin/src/app/ai-insights/page.tsx#L1-L2)
- [performance-page.tsx:1-3](file://apps/admin/src/app/performance/page.tsx#L1-L3)
- [customer-analytics-page.tsx:1-5](file://apps/customer/src/app/b2b/analytics/page.tsx#L1-L5)
- [seller-analytics-page.tsx:1-5](file://apps/seller/src/app/analytics/page.tsx#L1-L5)
- [admin-layout.tsx](file://apps/admin/src/components/layout/admin-layout.tsx)
- [seller-layout.tsx](file://apps/seller/src/components/layout/seller-layout.tsx)
- [b2b-shell.tsx](file://apps/customer/src/components/b2b/b2b-shell.tsx)
- [database-index.ts](file://packages/database/src/index.ts)
- [utils-format-currency.ts](file://packages/utils/src/format-currency.ts)

**Section sources**
- [admin-dashboard-page.tsx:1-3](file://apps/admin/src/app/dashboard/page.tsx#L1-L3)
- [ai-insights-page.tsx:1-2](file://apps/admin/src/app/ai-insights/page.tsx#L1-L2)
- [performance-page.tsx:1-3](file://apps/admin/src/app/performance/page.tsx#L1-L3)
- [customer-analytics-page.tsx:1-5](file://apps/customer/src/app/b2b/analytics/page.tsx#L1-L5)
- [seller-analytics-page.tsx:1-5](file://apps/seller/src/app/analytics/page.tsx#L1-L5)

## Performance Considerations
- Server-side rendering (SSR) ensures fast initial loads for analytics pages.
- Currency formatting is centralized to reduce duplication and ensure consistency.
- Mock data fallbacks maintain UX continuity during development or when live data is unavailable.
- Efficient aggregation patterns compute KPIs and trends client-side after fetching minimal datasets.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common scenarios and resolutions:
- Missing B2B context in spend analytics: The page renders a friendly message and guidance when no company account is associated.
- Empty analytics data: Dedicated empty states guide users to take action (e.g., place purchase orders).
- Authentication failures: Auth guards redirect unauthenticated users appropriately; ensure role-based access aligns with the requested page.

**Section sources**
- [customer-analytics-page.tsx:13-23](file://apps/customer/src/app/b2b/analytics/page.tsx#L13-L23)
- [seller-analytics-page.tsx:88-94](file://apps/seller/src/app/analytics/page.tsx#L88-L94)

## Conclusion
The Business Intelligence and Analytics platform delivers actionable insights across the commerce ecosystem. It combines real-time dashboards, AI-driven recommendations, and domain-specific analytics to support strategic decision-making, optimize operations, and uncover growth opportunities. The modular architecture and shared packages facilitate maintainability and scalability.