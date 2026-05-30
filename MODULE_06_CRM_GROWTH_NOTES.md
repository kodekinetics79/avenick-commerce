# Module 6: CRM & Growth

## Status: Complete

## New Pages Created

| Route | Description |
|---|---|
| `/admin/campaigns` | Campaign manager: multi-channel (Email/SMS/WhatsApp), funnel metrics, attributed revenue, status tabs, launch/schedule |
| `/admin/segments` | Customer segmentation: 8 RFM-style segments with counts, growth %, avg LTV, "Target" → campaigns |
| `/admin/retention` | Retention dashboard: churn risk list, lifecycle funnel, recommended win-back actions, call/email CTAs |

## Updated Files

| File | Changes |
|---|---|
| `apps/admin/src/app/crm/page.tsx` | Full rewrite: 4 stat cards, severity-coded smart alerts (HIGH/MEDIUM/LOW), lifecycle pipeline with segment bars, top-accounts table with health bars, recent activity feed |
| `packages/database/src/mock-data.ts` | Added `MOCK_CRM_ACCOUNTS`, `MOCK_CAMPAIGNS`, `MOCK_SEGMENTS`, `MOCK_RETENTION_RISKS`, `MOCK_LIFECYCLE_STAGES` |

## Design Highlights

### CRM Overview
- 4 KPI cards (B2C, B2B, Active, At-Risk)
- Smart alerts with severity colors and deep links to retention/campaigns/orders
- Lifecycle pipeline (Prospects → Leads → Active → At Risk → Churned) with segment bars
- Top accounts table with 5-segment health bars + numeric score
- Recent activity feed with type-coded avatars

### Campaign Manager
- Channel icons (Email/SMS/WhatsApp), status badges (Active/Scheduled/Completed)
- Funnel metrics per campaign: Sent → Opened (rate) → Clicked (CTR) → Converted (conv)
- Attributed revenue per campaign
- Scheduled campaigns show launch CTA instead of metrics

### Segments
- 8 colored segment cards (VIP, high-frequency, at-risk, new, cart abandoners, quote no-converts, dormant, single-purchase)
- Growth indicator (up/down), avg LTV, member count
- "View" + "Target" (→ campaigns) actions per segment
- Bottom CTA banner to create campaign

### Retention
- Retention rate, high-risk count, at-risk value, churned stats
- Lifecycle funnel visual with arrows
- Churn risk accounts: risk badge, days-since-order, recommended action, Call/Email CTAs
- Risk-prioritized (HIGH → MEDIUM → LOW)

## Testing Checklist
- [ ] `/crm` smart alerts show severity colors + deep links
- [ ] `/crm` lifecycle pipeline bars render
- [ ] `/crm` top accounts health bars (5-segment) work
- [ ] `/campaigns` channel icons + status badges correct
- [ ] `/campaigns` funnel metrics show rates
- [ ] `/campaigns` scheduled campaigns show launch CTA
- [ ] `/segments` 8 segment cards with growth indicators
- [ ] `/segments` "Target" links to /campaigns
- [ ] `/retention` churn risk list prioritized by risk
- [ ] `/retention` lifecycle funnel visual works
- [ ] `/retention` Call/Email CTAs per account
- [ ] Zero TypeScript errors ✓
- [ ] All 4 routes return 307 ✓

## Known Limitations
- All CRM data is mocked — requires `crm_accounts`, `campaigns`, `segments`, `crm_activities` DB tables
- Campaign launch/schedule, segment creation, win-back actions are UI-only
- Health scores and churn risk are static (no scoring engine yet)
- Activity feed not connected to real events

## MySQL Schema Notes (Future)
```sql
CREATE TABLE crm_accounts (
  id VARCHAR(36) PRIMARY KEY,
  account_type ENUM('B2C','B2B') NOT NULL,
  user_id VARCHAR(36),
  company_id VARCHAR(36),
  stage ENUM('PROSPECT','LEAD','CUSTOMER','AT_RISK','CHURNED') DEFAULT 'PROSPECT',
  health_score TINYINT DEFAULT 50,
  owner_id VARCHAR(36),
  last_activity_at DATETIME,
  lifetime_value DECIMAL(14,2) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE campaigns (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  channel ENUM('EMAIL','SMS','WHATSAPP','PUSH') NOT NULL,
  audience_segment_id VARCHAR(36),
  status ENUM('DRAFT','SCHEDULED','ACTIVE','COMPLETED','PAUSED') DEFAULT 'DRAFT',
  sent INT DEFAULT 0, opened INT DEFAULT 0, clicked INT DEFAULT 0, converted INT DEFAULT 0,
  attributed_revenue DECIMAL(14,2) DEFAULT 0,
  start_date DATE, end_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE segments (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  rule_json TEXT,            -- segment definition (avoid Postgres JSONB)
  member_count INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Next Module
Module 7: Finance
