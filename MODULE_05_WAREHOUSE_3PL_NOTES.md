# Module 5: Warehouse / 3PL

## Status: Complete

## New Pages Created

| Route | Description |
|---|---|
| `/admin/warehouse/inbound` | Inbound shipment tracking: supplier POs, carrier/tracking, arrived/discrepancy alerts, "Receive" action |
| `/admin/warehouse/stock` | Stock manager: DB-connected (InventoryStock), filters (low/out/aging), search, adjust/reorder actions |
| `/admin/warehouse/pickpack` | Fulfillment pipeline: pick → pack → dispatch with visual pipeline bar, urgent order alerts, stage filter tabs |

## Updated Files

| File | Changes |
|---|---|
| `apps/admin/src/app/warehouse/page.tsx` | Full rewrite: 3 warehouse cards with segment utilization bars (no inline styles), quick stats as links, category stock bar chart (segments), aging inventory table, quick nav grid |

## Design Highlights

### Warehouse Overview
- 4 quick-stat cards linking to sub-pages
- Warehouse cards: segment-based utilization bar (color-coded: green/amber/red)
- Stock by category: segment bars, total value footer
- Aging inventory table (90+ days = red, 60-90 = amber)
- Quick navigation grid to all 4 warehouse sub-pages

### Inbound Goods
- Stats: In Transit, Arrived at Dock, Discrepancies, Expected Value
- Red alert for discrepancies
- Amber alert for arrived-but-not-received shipments with "Start Receiving" CTA
- Status tabs with count badges
- Table with Receive/Track/Resolve action buttons per status

### Stock Manager
- DB-connected via `db.inventoryStock.findMany`
- Filters: All / Low Stock / Out of Stock / Aging
- Search input (UI — server-side filter on low/out)
- Color-coded Available column: green OK, amber low, red out
- Reorder button visible for low/out-of-stock items

### Pick / Pack / Dispatch
- Visual pipeline bar: 6 stages with counts
- Order cards with stage-appropriate action buttons
- Urgent badge with red border on urgent orders
- Stage filter tabs: Pick List / Pack Queue / Dispatch
- Assignee shown on each order card

## Testing Checklist
- [ ] `/warehouse` utilization bars are segment-based (no inline styles) ✓
- [ ] `/warehouse` warehouse cards show 3 locations
- [ ] `/warehouse` stock by category bars work
- [ ] `/warehouse` aging inventory table shows
- [ ] `/warehouse/inbound` discrepancy alert visible (1 item)
- [ ] `/warehouse/inbound` "ARRIVED" amber alert visible (1 item)
- [ ] `/warehouse/inbound` status tabs filter correctly
- [ ] `/warehouse/inbound` "Receive" button on ARRIVED rows
- [ ] `/warehouse/stock` loads from DB (InventoryStock)
- [ ] `/warehouse/stock?filter=low` shows only low stock
- [ ] `/warehouse/stock?filter=out` shows only out-of-stock
- [ ] `/warehouse/stock` search input renders
- [ ] `/warehouse/pickpack` pipeline visual bar shows counts
- [ ] `/warehouse/pickpack?tab=pick` filters to pick stage
- [ ] `/warehouse/pickpack?tab=dispatch` shows packed orders
- [ ] Urgent orders show red border + URGENT badge
- [ ] Zero TypeScript errors ✓
- [ ] All routes return 307 (auth redirect) ✓

## Known Limitations
- Inbound shipments are fully mocked — requires `inbound_shipments` / `purchase_orders` DB table
- "Receive Goods", "Mark Picked/Packed/Dispatched" are UI-only — require API routes
- Stock search is frontend only (input rendered, no server search implemented)
- Aging inventory is mocked — requires `created_at` on InventoryStock or a separate table
- Pick list assignment is mocked — requires a `fulfillment_assignments` table

## MySQL Schema Notes (Future)
```sql
CREATE TABLE purchase_orders (
  id VARCHAR(36) PRIMARY KEY,
  po_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id VARCHAR(36) NOT NULL,
  warehouse_id VARCHAR(36) NOT NULL,
  status ENUM('SCHEDULED','IN_TRANSIT','ARRIVED','RECEIVING','RECEIVED','DISCREPANCY') DEFAULT 'SCHEDULED',
  carrier VARCHAR(100),
  tracking_number VARCHAR(200),
  expected_arrival DATE,
  received_at DATETIME,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fulfillment_queue (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  warehouse_id VARCHAR(36) NOT NULL,
  status ENUM('PICK_PENDING','PICKING','PICKED','PACKING','PACKED','DISPATCHED') DEFAULT 'PICK_PENDING',
  assigned_to VARCHAR(36),
  priority ENUM('NORMAL','URGENT') DEFAULT 'NORMAL',
  due_by DATETIME,
  dispatched_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Next Module
Module 6: CRM & Growth
