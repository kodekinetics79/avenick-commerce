# Module 2: B2B Trade

## Status: Complete

## New Pages Created

| Route | App | Description |
|---|---|---|
| `/b2b/rfq/[id]` | customer | RFQ detail with received quotes, comparison, accept/decline, timeline |
| `/b2b/approvals` | customer | Approval center with pending/approved/rejected POs, urgency levels |
| `/b2b/company` | customer | Company profile: contact info, team members, credit/payment, documents |

## Updated Pages

| File | Changes |
|---|---|
| `apps/customer/src/app/b2b/page.tsx` | Alert banner for pending approvals, clickable RFQ rows → `/b2b/rfq/[id]`, account manager card, quick links panel, "new quote!" pulse badge |
| `apps/customer/src/app/b2b/rfq/new/page.tsx` | Multi-section form: RFQ title/category, priority selector (Normal/Urgent/Critical), multi-item line items with add/remove, specs per item, notes + attachment placeholder, post-submit flow with process steps |
| `apps/customer/src/app/b2b/quotes/page.tsx` | Grouped by RFQ, accept/decline per quote, "best price" badge, convert-to-order for accepted, stats row |
| `apps/admin/src/app/rfqs/page.tsx` | "Assign Supplier" action button for 0-quote RFQs, "Compare Quotes" for QUOTED status |
| `apps/admin/src/app/companies/page.tsx` | Replaced inline `style` credit bar with segment-based Tailwind approach |
| `packages/auth/src/middleware.ts` | Added `/deals`, `/brands`, `/cart`, `/wishlist`, `/categories` to customer public paths |

## Testing Checklist
- [ ] `/b2b` dashboard shows pending approval alert banner
- [ ] RFQ rows are clickable, link to `/b2b/rfq/[rfq_id]`
- [ ] `/b2b/rfq/rfq_001` shows 2 quotes with best price badge
- [ ] Accept quote button visible on RECEIVED quotes
- [ ] `/b2b/rfq/new` multi-item form works (add/remove items)
- [ ] Priority selector highlights selected option
- [ ] Form submit shows success screen with process steps
- [ ] `/b2b/quotes` grouped by RFQ with accept/decline actions
- [ ] `/b2b/approvals` shows pending POs with approve/reject buttons
- [ ] `/b2b/company` shows team members table and credit summary
- [ ] `/deals`, `/wishlist`, `/cart`, `/brands` accessible without login (200)
- [ ] Admin `/rfqs` shows "Assign Supplier" for no-response RFQs
- [ ] Admin `/companies` credit bar renders without inline styles
- [ ] Zero TypeScript errors at app level

## Known Limitations
- Accept/Approve/Reject buttons are UI-only (no API calls) — requires API route integration
- RFQ `[id]` page reads from MOCK_RFQS; only `rfq_001` has mock quotes — others show empty state
- "Convert to Order" button is placeholder — requires orders module
- Team invitations on company profile are placeholder
- Attachment upload on RFQ form is deferred

## MySQL Schema Notes (Future)
```sql
CREATE TABLE rfq_requests (
  id VARCHAR(36) PRIMARY KEY,
  rfq_number VARCHAR(50) UNIQUE NOT NULL,
  buyer_id VARCHAR(36) NOT NULL,
  company_id VARCHAR(36),
  title VARCHAR(300) NOT NULL,
  category VARCHAR(100),
  priority ENUM('NORMAL','URGENT','CRITICAL') DEFAULT 'NORMAL',
  status ENUM('DRAFT','SUBMITTED','UNDER_REVIEW','QUOTED','NEGOTIATING','ACCEPTED','REJECTED','EXPIRED') DEFAULT 'DRAFT',
  required_by DATE,
  delivery_city VARCHAR(100),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rfq_items (
  id VARCHAR(36) PRIMARY KEY,
  rfq_id VARCHAR(36) NOT NULL,
  description VARCHAR(500) NOT NULL,
  quantity INT NOT NULL,
  unit VARCHAR(50) DEFAULT 'pcs',
  target_price DECIMAL(12,2),
  specs TEXT
);

CREATE TABLE purchase_order_approvals (
  id VARCHAR(36) PRIMARY KEY,
  order_ref VARCHAR(50) NOT NULL,
  company_id VARCHAR(36) NOT NULL,
  requester_id VARCHAR(36) NOT NULL,
  approver_id VARCHAR(36),
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'AED',
  urgency ENUM('NORMAL','HIGH','CRITICAL') DEFAULT 'NORMAL',
  status ENUM('PENDING','APPROVED','REJECTED') DEFAULT 'PENDING',
  notes TEXT,
  due_by DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME
);
```

## Next Module
Module 3: Supplier/Seller Portal
