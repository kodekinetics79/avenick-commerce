# Module 8: Support / Disputes

## Status: Complete

## New Pages Created

| Route | Description |
|---|---|
| `/admin/support/[id]` | Ticket detail: chat-style conversation, reply box, internal notes (amber, not customer-visible), SLA bar, quick actions sidebar |
| `/admin/disputes` | Buyer–seller disputes: parties, dispute type, evidence count, seller-response status, mediate/review actions |
| `/admin/sla` | SLA monitor: response/resolution targets, compliance gauge, performance-by-type table, recent breaches list |

## Updated Files

| File | Changes |
|---|---|
| `apps/admin/src/app/support/page.tsx` | Rewrite: deep links to disputes/sla, type-colored badges, SLA urgency pulse dot, escalated alert, clickable rows → ticket detail |
| `apps/customer/src/app/support/page.tsx` | orange→green branding |
| `packages/database/src/mock-data.ts` | Added `MOCK_TICKET_THREAD`, `MOCK_DISPUTES`, `MOCK_SLA_METRICS` |

## Design Highlights

### Support Tickets
- 4 status stat cards (Open/In Progress/Escalated/Closed)
- Escalated red alert banner
- Type-colored badges (Delivery/Refund/Billing/Quality/Account)
- SLA-remaining column with pulse dot when urgent (<1h)
- Rows link to `/support/[id]`

### Ticket Detail
- Chat-style conversation (agent right/dark, buyer left/light)
- Reply box + attach
- Internal notes panel (amber, "not visible to customer")
- SLA bar with at-risk/on-track indicator
- Quick actions: reassign, convert to dispute, refund, close

### Disputes
- 4 stats (Open, Disputed Value, Awaiting Seller, Resolved)
- Per-dispute card: buyer vs seller parties, dispute type, evidence count, seller-response status
- High-priority red border, Review/Mediate/Remind actions per status

### SLA Monitor
- Top metrics: avg first response, avg resolution, compliance %, breaches this week
- Overall health gauge (20-segment bar)
- Performance-by-type table with per-type compliance bars + below-target flags
- Recent breaches list linking to tickets

## Testing Checklist
- [ ] `/support` rows link to ticket detail
- [ ] `/support` SLA urgency pulse dot on <1h tickets
- [ ] `/support` escalated alert + type badges
- [ ] `/support/TKT-001` shows conversation thread
- [ ] Ticket detail internal notes panel (amber)
- [ ] Ticket detail SLA bar at-risk indicator
- [ ] `/disputes` shows buyer vs seller parties
- [ ] `/disputes` high-priority red border + actions per status
- [ ] `/sla` compliance gauge + by-type table
- [ ] `/sla` below-target types flagged red
- [ ] `/sla` breaches link to tickets
- [ ] Customer `/support` uses green (no orange) ✓
- [ ] Zero TypeScript errors ✓
- [ ] All routes return 307 ✓

## Known Limitations
- All support/dispute/SLA data mocked — requires `support_tickets`, `ticket_messages`, `disputes`, `dispute_evidence` tables
- Reply/escalate/resolve/mediate actions are UI-only
- SLA timers are static strings (no live countdown engine)
- Evidence files are count-only (no upload/view)
- Ticket detail always renders MOCK_TICKET_THREAD content regardless of [id] (header meta uses list lookup)

## MySQL Schema Notes (Future)
```sql
CREATE TABLE support_tickets (
  id VARCHAR(36) PRIMARY KEY,
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  order_id VARCHAR(36),
  type ENUM('DELIVERY','REFUND','BILLING','QUALITY','ACCOUNT') NOT NULL,
  subject VARCHAR(300) NOT NULL,
  status ENUM('OPEN','IN_PROGRESS','ESCALATED','CLOSED') DEFAULT 'OPEN',
  priority ENUM('LOW','MEDIUM','HIGH') DEFAULT 'MEDIUM',
  assigned_to VARCHAR(36),
  sla_due_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME
);

CREATE TABLE ticket_messages (
  id VARCHAR(36) PRIMARY KEY,
  ticket_id VARCHAR(36) NOT NULL,
  sender_type ENUM('BUYER','AGENT','SYSTEM') NOT NULL,
  is_internal TINYINT(1) DEFAULT 0,
  body TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE disputes (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  buyer_id VARCHAR(36) NOT NULL,
  seller_id VARCHAR(36) NOT NULL,
  type ENUM('ITEM_NOT_RECEIVED','NOT_AS_DESCRIBED','DAMAGED','REFUND_REQUEST') NOT NULL,
  amount DECIMAL(12,2),
  status ENUM('OPEN','AWAITING_SELLER','UNDER_REVIEW','RESOLVED_BUYER','RESOLVED_SELLER') DEFAULT 'OPEN',
  priority ENUM('LOW','MEDIUM','HIGH') DEFAULT 'MEDIUM',
  opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME
);
```

## Next Module
Module 9: AI Insights (enhance existing /ai-insights), then Automation, Integrations, Admin/Settings, Pricing.
