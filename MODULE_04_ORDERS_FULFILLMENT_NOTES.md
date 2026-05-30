# Module 4: Orders & Fulfillment

## Status: Complete

## New Pages Created

| Route | App | Description |
|---|---|---|
| `/returns` | customer | Full return/exchange flow: select order → choose items + reason → submit → success with process steps |
| `/admin/orders` | admin | Full order management: stats, GMV, filter by status+type, dispute alert, status action buttons |
| `/admin/orders/[id]` | admin | Order detail: full timeline, items with supplier, status action buttons, customer card, shipping address, order meta |

## Updated Files

| File | Changes |
|---|---|
| `customer/account/orders/page.tsx` | Filter tabs, stats row (in progress/shipped/delivered), green colors, clickable cards with status chips, "Returns" link, shipped tracking CTA |
| `customer/orders/[id]/page.tsx` | Full rewrite: tracking card with copy/show timeline, improved connected timeline with current step ring, items with thumbnails, 2-col delivery+summary grid, Return/Issue/Invoice actions, buyer protection badge |
| `packages/auth/src/middleware.ts` | Added `/returns` to customer public paths |

## Testing Checklist
- [ ] `/account/orders` filter tabs work (All/Processing/Shipped/Delivered/Cancelled)
- [ ] `/account/orders` stats show correct counts
- [ ] Order cards show status chip, B2B badge, green total
- [ ] "Shipped" orders show "Track shipment" CTA
- [ ] "Delivered" orders show "Return or exchange" link
- [ ] `/orders/ord_001` loads correctly (DELIVERED order)
- [ ] `/orders/ord_002` loads correctly (SHIPPED order — tracking card shown)
- [ ] Timeline shows connected lines with green completed, blue current, gray future
- [ ] "Show Timeline" on tracking card toggles shipment events
- [ ] Copy tracking number button works
- [ ] Return/Exchange button visible on delivered orders
- [ ] `/returns` page shows delivered orders
- [ ] Returns form: select items, type, reason
- [ ] Returns success state shows process steps
- [ ] `/admin/orders` shows order table with filters
- [ ] Admin orders type filter (B2C/B2B) works
- [ ] "Process/Ship/Deliver" quick action buttons visible per status
- [ ] "Resolve" shown for disputed orders
- [ ] `/admin/orders/[id]` loads with full detail
- [ ] Admin order detail timeline matches status history
- [ ] Status action buttons visible in admin order detail
- [ ] Zero TypeScript errors ✓
- [ ] All routes return 200/307 ✓

## Known Limitations
- Status action buttons (Process/Ship/Mark Delivered) are UI-only — require API routes
- Tracking "Track Live" button is placeholder
- Invoice download is placeholder
- Returns form doesn't write to DB — requires `returns` table
- Admin shipments page doesn't exist yet (nav link present)

## MySQL Schema Notes (Future)
```sql
CREATE TABLE return_requests (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  return_type ENUM('RETURN','EXCHANGE','REPAIR') NOT NULL,
  reason VARCHAR(200) NOT NULL,
  notes TEXT,
  status ENUM('PENDING','APPROVED','REJECTED','COMPLETED') DEFAULT 'PENDING',
  refund_amount DECIMAL(12,2),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME
);

CREATE TABLE return_items (
  id VARCHAR(36) PRIMARY KEY,
  return_id VARCHAR(36) NOT NULL,
  order_item_id VARCHAR(36) NOT NULL,
  quantity INT NOT NULL,
  condition VARCHAR(100)
);
```

## Next Module
Module 5: Warehouse / 3PL
