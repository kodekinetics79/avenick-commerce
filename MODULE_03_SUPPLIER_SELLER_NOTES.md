# Module 3: Supplier / Seller Portal

## Status: Complete

## New Pages Created

| Route | Description |
|---|---|
| `/quotes/submit` | Submit quotation form for an RFQ: line items, pricing, VAT calc, payment terms, lead time, notes |
| `/quotes` | Quote history: all submitted quotes with win rate, status tabs, accepted value stat |
| `/shipments` | Shipment tracking: cards per shipment, carrier/tracking, status, exception alert, mark shipped |
| `/invoices` | Invoice management: paid/pending/overdue stats, VAT-compliant table, PDF download placeholder |

## Updated Files

| File | Changes |
|---|---|
| `app/dashboard/page.tsx` | Fixed inline style health bar → segment-based Tailwind |
| `app/products/page.tsx` | Fixed inline style health bar → segment-based Tailwind |
| `app/onboarding/page.tsx` | Fixed inline style progress bar → segment-based Tailwind; orange → green |
| `app/orders/page.tsx` | Replaced orange filter tabs → slate-900 active, cleaner tab row; green totals; Mark Ready / Ship quick-action buttons; better empty state |
| `app/messages/page.tsx` | Orange → blue/green/amber; "Submit Quote" CTA links to `/quotes/submit?rfq=ID`; "Needs Response" badge on pending RFQs; cleaner thread list |
| `components/layout/seller-layout.tsx` | Orange → green-600/500/400 throughout (brand avatar, tier badge, active state) |

## Testing Checklist
- [ ] Dashboard health bar renders as segments (no inline style)
- [ ] Products page health bar segments work
- [ ] Onboarding progress bar segments work, no orange
- [ ] Orders page filter tabs (slate-900 active, no orange)
- [ ] Orders "Mark Ready" and "Ship" quick actions visible
- [ ] Messages page — "Submit Quote" links to `/quotes/submit`
- [ ] Messages "Needs Response" amber badge on pending RFQs
- [ ] `/quotes/submit?rfq=rfq_pending_001` shows RFQ summary and form
- [ ] Submit Quote form — add/remove line items
- [ ] Submit Quote VAT calculation updates live
- [ ] Submit Quote success state shows
- [ ] `/quotes` page shows stats + history table
- [ ] `/shipments` shows shipment cards with tracking info
- [ ] Exception alert shown when shipments have exceptions
- [ ] `/invoices` shows overdue alert if applicable
- [ ] All 11 seller routes return 307 (auth redirect) ✓
- [ ] Zero app-level TypeScript errors ✓
- [ ] Seller sidebar brand color is green (not orange) ✓

## Known Limitations
- Submit Quote API call is mocked (setTimeout)
- Shipments data is fully mocked — requires `shipments` DB table/service
- Invoices are fully mocked — requires integration with orders/payments
- "Mark Shipped", "Resolve Issue", "Mark Ready" buttons are UI-only
- PDF invoice download is placeholder
- Returns page not yet implemented (nav item exists)
- Commission page not yet implemented (nav item exists)

## MySQL Schema Notes (Future)
```sql
CREATE TABLE shipments (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  seller_id VARCHAR(36) NOT NULL,
  carrier VARCHAR(100),
  tracking_number VARCHAR(200),
  status ENUM('PENDING_PICKUP','IN_TRANSIT','DELIVERED','EXCEPTION') DEFAULT 'PENDING_PICKUP',
  origin_address TEXT,
  destination_address TEXT,
  shipped_at DATETIME,
  estimated_delivery DATE,
  weight_kg DECIMAL(8,2),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE seller_quotes (
  id VARCHAR(36) PRIMARY KEY,
  rfq_id VARCHAR(36) NOT NULL,
  seller_id VARCHAR(36) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  vat_amount DECIMAL(12,2),
  currency VARCHAR(10) DEFAULT 'AED',
  valid_until DATE,
  payment_terms VARCHAR(50),
  lead_time_days INT,
  notes TEXT,
  status ENUM('PENDING','ACCEPTED','DECLINED','EXPIRED') DEFAULT 'PENDING',
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Next Module
Module 4: Orders & Fulfillment
