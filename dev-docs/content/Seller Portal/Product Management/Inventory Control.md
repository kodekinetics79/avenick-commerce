# Inventory Control

<cite>
**Referenced Files in This Document**
- [page.tsx](file://apps/seller/src/app/inventory/page.tsx)
- [page.tsx](file://apps/admin/src/app/warehouse/stock/page.tsx)
- [page.tsx](file://apps/admin/src/app/warehouse/page.tsx)
- [inventory.ts](file://packages/database/src/services/inventory.ts)
- [schema.prisma](file://packages/database/prisma/schema.prisma)
- [route.ts](file://packages/database/src/services/orders.ts)
- [MODULE_05_WAREHOUSE_3PL_NOTES.md](file://MODULE_05_WAREHOUSE_3PL_NOTES.md)
- [PHASE3_IMPLEMENTATION_NOTES.md](file://PHASE3_IMPLEMENTATION_NOTES.md)
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
This document describes the Inventory Control system in the commerce platform. It covers stock level tracking, automatic inventory updates from orders, manual stock adjustments, low-stock alerts and thresholds, inventory reservation during order processing, backorder handling, restocking procedures, bulk inventory updates, CSV import/export, inventory synchronization with external systems, analytics such as stock turnover and carrying costs, and warehouse location tracking with multi-location inventory management.

## Project Structure
The Inventory Control system spans three primary areas:
- Frontend pages for sellers and administrators to view and manage inventory
- Database schema modeling inventory, locations, and movements
- Backend services orchestrating inventory reservations and adjustments

```mermaid
graph TB
subgraph "Seller App"
SInv["apps/seller/src/app/inventory/page.tsx"]
end
subgraph "Admin App"
AStock["apps/admin/src/app/warehouse/stock/page.tsx"]
AWarehouse["apps/admin/src/app/warehouse/page.tsx"]
end
subgraph "Database Layer"
Schema["packages/database/prisma/schema.prisma"]
SvcInv["packages/database/src/services/inventory.ts"]
SvcOrders["packages/database/src/services/orders.ts"]
end
SInv --> SvcInv
AStock --> Schema
AWarehouse --> Schema
SvcOrders --> Schema
SvcInv --> Schema
```

**Diagram sources**
- [page.tsx](file://apps/seller/src/app/inventory/page.tsx)
- [page.tsx](file://apps/admin/src/app/warehouse/stock/page.tsx)
- [page.tsx](file://apps/admin/src/app/warehouse/page.tsx)
- [inventory.ts](file://packages/database/src/services/inventory.ts)
- [schema.prisma](file://packages/database/prisma/schema.prisma)
- [route.ts](file://packages/database/src/services/orders.ts)

**Section sources**
- [page.tsx](file://apps/seller/src/app/inventory/page.tsx)
- [page.tsx](file://apps/admin/src/app/warehouse/stock/page.tsx)
- [page.tsx](file://apps/admin/src/app/warehouse/page.tsx)
- [inventory.ts](file://packages/database/src/services/inventory.ts)
- [schema.prisma](file://packages/database/prisma/schema.prisma)
- [route.ts](file://packages/database/src/services/orders.ts)

## Core Components
- InventoryStock: Tracks on-hand quantities, reserved quantities, reorder point, and warehouse location association.
- InventoryLocation: Represents warehouse locations and bins with unique codes.
- InventoryMovement: Records inventory adjustments and transactions for auditability.
- getSellerInventory: Aggregates stock per product, computes available quantity, and flags low/out-of-stock conditions.
- adjustInventory: Performs atomic stock adjustments and logs movements.
- Order placement: Reserves inventory across stock rows greedily and prevents overselling.

Key capabilities:
- Multi-location tracking via InventoryLocation and InventoryStock
- Low-stock thresholds via reorderPoint and computed flags
- Reservation and backorder prevention during order creation
- Movement audit trail via InventoryMovement

**Section sources**
- [inventory.ts](file://packages/database/src/services/inventory.ts)
- [schema.prisma](file://packages/database/prisma/schema.prisma)
- [route.ts](file://packages/database/src/services/orders.ts)

## Architecture Overview
The system integrates frontend dashboards with Prisma models and backend services. Sellers view their inventory with low/out indicators. Administrators manage stock, apply filters, and trigger replenishment. Orders reserve inventory atomically to prevent overselling.

```mermaid
sequenceDiagram
participant UI_Seller as "Seller Inventory Page"
participant UI_Admin as "Admin Stock Manager"
participant DB as "Prisma Models"
participant SvcInv as "Inventory Service"
participant SvcOrders as "Orders Service"
UI_Seller->>SvcInv : getSellerInventory(sellerId)
SvcInv->>DB : query InventoryStock + Location + Product
DB-->>SvcInv : stock rows
SvcInv-->>UI_Seller : mapped stock with available/isLow/isOut
UI_Admin->>DB : filter InventoryStock (low/out/aging)
DB-->>UI_Admin : filtered rows
UI_Seller->>SvcInv : adjustInventory(stockId, qty, type)
SvcInv->>DB : update InventoryStock + create InventoryMovement
DB-->>SvcInv : success
SvcInv-->>UI_Seller : new quantity
UI_Admin->>SvcOrders : place order (items)
SvcOrders->>DB : transaction with availability check
DB-->>SvcOrders : reserved stock rows
SvcOrders-->>UI_Admin : order created
```

**Diagram sources**
- [page.tsx](file://apps/seller/src/app/inventory/page.tsx)
- [page.tsx](file://apps/admin/src/app/warehouse/stock/page.tsx)
- [inventory.ts](file://packages/database/src/services/inventory.ts)
- [route.ts](file://packages/database/src/services/orders.ts)
- [schema.prisma](file://packages/database/prisma/schema.prisma)

## Detailed Component Analysis

### InventoryStock and Locations
- InventoryStock holds productId/variantId, locationId, qty, reservedQty, and reorderPoint.
- InventoryLocation defines warehouse associations and physical codes (zone/aisle/bin).
- Indexes and relations ensure efficient queries and referential integrity.

```mermaid
erDiagram
WAREHOUSE {
string id PK
string nameEn
string type
}
INVENTORY_LOCATION {
string id PK
string warehouseId FK
string code UK
}
INVENTORY_STOCK {
string id PK
string productId FK
string variantId FK
string locationId FK
int qty
int reservedQty
int reorderPoint
}
INVENTORY_MOVEMENT {
string id PK
string stockId FK
string type
int qty
}
WAREHOUSE ||--o{ INVENTORY_LOCATION : "has"
INVENTORY_LOCATION ||--o{ INVENTORY_STOCK : "contains"
INVENTORY_STOCK ||--o{ INVENTORY_MOVEMENT : "logs"
```

**Diagram sources**
- [schema.prisma](file://packages/database/prisma/schema.prisma)

**Section sources**
- [schema.prisma](file://packages/database/prisma/schema.prisma)

### Seller Inventory Dashboard
- Displays stock rows with product image, SKU, warehouse, on-hand, reserved, available, reorder point, and status.
- Highlights low/out items and provides quick actions to replenish.

```mermaid
flowchart TD
Start(["Load Seller Inventory"]) --> Fetch["Call getSellerInventory(sellerId)"]
Fetch --> Map["Compute available = qty - reservedQty<br/>isLow = available <= reorderPoint<br/>isOut = available <= 0"]
Map --> Render["Render table with status badges"]
Render --> Alerts{"Any low/out?"}
Alerts --> |Yes| ShowBanner["Show low/out alert banner"]
Alerts --> |No| Done["Done"]
```

**Diagram sources**
- [page.tsx](file://apps/seller/src/app/inventory/page.tsx)
- [inventory.ts](file://packages/database/src/services/inventory.ts)

**Section sources**
- [page.tsx](file://apps/seller/src/app/inventory/page.tsx)
- [inventory.ts](file://packages/database/src/services/inventory.ts)

### Admin Stock Manager
- Filters: All, Low Stock, Out of Stock, Aging (60+ days).
- Search input (client-side UI with server-side filtering).
- Color-coded Available column and Reorder action for low/out items.

```mermaid
flowchart TD
Start(["Admin Stock Manager"]) --> Filter["Apply filter (low/out/aging)"]
Filter --> Search["Search by SKU/name"]
Search --> Load["db.inventoryStock.findMany(...)"]
Load --> Render["Render table with status badges"]
Render --> Action{"Low/Out?"}
Action --> |Yes| Reorder["Show Reorder button"]
Action --> |No| Done["Done"]
```

**Diagram sources**
- [page.tsx](file://apps/admin/src/app/warehouse/stock/page.tsx)
- [schema.prisma](file://packages/database/prisma/schema.prisma)

**Section sources**
- [page.tsx](file://apps/admin/src/app/warehouse/stock/page.tsx)
- [MODULE_05_WAREHOUSE_3PL_NOTES.md](file://MODULE_05_WAREHOUSE_3PL_NOTES.md)

### Low-Stock Alerts and Thresholds
- Thresholds: reorderPoint determines low stock; available = qty - reservedQty.
- Alerts: Seller dashboard highlights out-of-stock and low-stock SKUs.
- Aging: Admin dashboard surfaces aging inventory (60+ days) for review.

```mermaid
flowchart TD
A["Compute available"] --> B{"available <= reorderPoint?"}
B --> |Yes| Low["Flag isLow"]
B --> |No| OK["OK"]
A --> C{"available <= 0?"}
C --> |Yes| Out["Flag isOut"]
C --> |No| OK2["OK"]
```

**Diagram sources**
- [inventory.ts](file://packages/database/src/services/inventory.ts)
- [page.tsx](file://apps/admin/src/app/warehouse/page.tsx)

**Section sources**
- [inventory.ts](file://packages/database/src/services/inventory.ts)
- [page.tsx](file://apps/admin/src/app/warehouse/page.tsx)
- [MODULE_05_WAREHOUSE_3PL_NOTES.md](file://MODULE_05_WAREHOUSE_3PL_NOTES.md)

### Automatic Inventory Updates from Orders
- Orders are created atomically with inventory reservation.
- Availability across all matching stock rows is summed; if insufficient, the operation fails.
- Reservation is greedy across rows ordered by last update time to distribute reservations fairly.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Orders as "Orders Service"
participant DB as "Prisma"
Client->>Orders : submit order(items)
Orders->>DB : start transaction
loop for each item
Orders->>DB : findMany stock rows (productId + variantId?)
DB-->>Orders : stock rows
Orders->>Orders : sum available = Σ(qty - reservedQty)
alt available < quantity
Orders-->>Client : error "insufficient stock"
else
Orders->>DB : update reservedQty across rows (greedy)
end
end
Orders->>DB : create order
DB-->>Orders : order created
Orders-->>Client : order response
```

**Diagram sources**
- [route.ts](file://packages/database/src/services/orders.ts)

**Section sources**
- [route.ts](file://packages/database/src/services/orders.ts)
- [PHASE3_IMPLEMENTATION_NOTES.md](file://PHASE3_IMPLEMENTATION_NOTES.md)

### Manual Stock Adjustments
- adjustInventory supports INCREASE, DECREASE, and ADJUSTMENT types.
- Enforces non-negative resulting quantities.
- Logs each adjustment as an InventoryMovement for auditability.

```mermaid
flowchart TD
Start(["adjustInventory(stockId, qty, type)"]) --> Load["Load current stock"]
Load --> Valid{"stock exists and newQty >= 0?"}
Valid --> |No| Err["Throw error"]
Valid --> |Yes| Tx["Begin transaction"]
Tx --> Update["Update qty = newQty"]
Update --> Log["Create InventoryMovement"]
Log --> Commit["Commit"]
Commit --> Done["Return newQty"]
```

**Diagram sources**
- [inventory.ts](file://packages/database/src/services/inventory.ts)
- [schema.prisma](file://packages/database/prisma/schema.prisma)

**Section sources**
- [inventory.ts](file://packages/database/src/services/inventory.ts)

### Backorder Handling and Restocking
- Backorders occur when available inventory is insufficient at order time; the order creation fails with a clear message.
- After restocking, reserved inventory remains reserved until fulfilled or released; administrators can reconcile and release as needed.
- Movement logs enable tracing of adjustments and resolutions.

```mermaid
flowchart TD
O["Order submitted"] --> Avail["Compute available across stock rows"]
Avail --> Enough{"available >= requested?"}
Enough --> |No| BO["Fail with 'insufficient stock'"]
Enough --> |Yes| Reserve["Reserve inventory greedily"]
Reserve --> Create["Create order"]
Create --> Fulfill["Fulfillment"]
Fulfill --> Release["Release or settle reserved inventory"]
```

**Diagram sources**
- [route.ts](file://packages/database/src/services/orders.ts)
- [inventory.ts](file://packages/database/src/services/inventory.ts)

**Section sources**
- [route.ts](file://packages/database/src/services/orders.ts)
- [PHASE3_IMPLEMENTATION_NOTES.md](file://PHASE3_IMPLEMENTATION_NOTES.md)

### Bulk Inventory Updates and CSV Import/Export
- CSV import/export is supported in product management contexts, enabling bulk updates to product attributes and stock levels.
- The import process validates headers, parses CSV rows, and applies updates with feedback and error reporting.
- Export generates a CSV with standardized headers for downstream reconciliation.

Note: While dedicated inventory CSV endpoints are not present in the referenced files, the existing product CSV infrastructure demonstrates the capability and can be extended to inventory.

**Section sources**
- [page.tsx](file://apps/seller/src/components/products-table.tsx)
- [MODULE_05_WAREHOUSE_3PL_NOTES.md](file://MODULE_05_WAREHOUSE_3PL_NOTES.md)

### Inventory Analytics
- Aging inventory: Admin dashboard surfaces items aged 60+ days for review.
- Utilization and capacity: Warehouse overview shows utilization percentages and free capacity per location.
- Category stock distribution: Admin dashboard visualizes stock by category for strategic planning.

```mermaid
graph TB
Aging["Aging Inventory Table (60+ days)"] --> Review["Review & Replenish"]
Util["Warehouse Utilization Bars"] --> Capacity["Free Capacity Insight"]
Category["Stock by Category"] --> Planning["Demand Planning"]
```

**Diagram sources**
- [page.tsx](file://apps/admin/src/app/warehouse/page.tsx)
- [MODULE_05_WAREHOUSE_3PL_NOTES.md](file://MODULE_05_WAREHOUSE_3PL_NOTES.md)

**Section sources**
- [page.tsx](file://apps/admin/src/app/warehouse/page.tsx)
- [MODULE_05_WAREHOUSE_3PL_NOTES.md](file://MODULE_05_WAREHOUSE_3PL_NOTES.md)

### Warehouse Location Tracking and Multi-Location Management
- InventoryStock references InventoryLocation via locationId.
- InventoryLocation belongs to a Warehouse and includes physical codes (zone/aisle/bin).
- Multi-location inventory enables distributed fulfillment and centralized reporting.

```mermaid
classDiagram
class Warehouse {
+string id
+string nameEn
+string type
}
class InventoryLocation {
+string id
+string warehouseId
+string code
+string zone
+string aisle
+string bin
}
class InventoryStock {
+string id
+string productId
+string variantId
+string locationId
+int qty
+int reservedQty
+int reorderPoint
}
Warehouse "1" --> "many" InventoryLocation : "owns"
InventoryLocation "1" --> "many" InventoryStock : "contains"
```

**Diagram sources**
- [schema.prisma](file://packages/database/prisma/schema.prisma)

**Section sources**
- [schema.prisma](file://packages/database/prisma/schema.prisma)

## Dependency Analysis
- Seller Inventory depends on getSellerInventory for aggregated stock and computed flags.
- Admin Stock Manager depends on Prisma models for filtering and rendering.
- Orders Service depends on InventoryStock to enforce availability and reserve inventory.
- Inventory Service encapsulates stock adjustments and movement logging.

```mermaid
graph LR
SInv["Seller Inventory Page"] --> SvcInv["Inventory Service"]
AStock["Admin Stock Manager"] --> Schema["Prisma Models"]
Orders["Orders Service"] --> Schema
SvcInv --> Schema
```

**Diagram sources**
- [page.tsx](file://apps/seller/src/app/inventory/page.tsx)
- [page.tsx](file://apps/admin/src/app/warehouse/stock/page.tsx)
- [inventory.ts](file://packages/database/src/services/inventory.ts)
- [route.ts](file://packages/database/src/services/orders.ts)
- [schema.prisma](file://packages/database/prisma/schema.prisma)

**Section sources**
- [page.tsx](file://apps/seller/src/app/inventory/page.tsx)
- [page.tsx](file://apps/admin/src/app/warehouse/stock/page.tsx)
- [inventory.ts](file://packages/database/src/services/inventory.ts)
- [route.ts](file://packages/database/src/services/orders.ts)
- [schema.prisma](file://packages/database/prisma/schema.prisma)

## Performance Considerations
- Use indexes on productId, variantId, and locationId for fast stock lookups.
- Prefer server-side filtering for large datasets (as seen in Admin Stock Manager).
- Batch operations for bulk updates to reduce round trips.
- Monitor transaction contention during high-order volumes; consider optimistic locking and retry strategies.

## Troubleshooting Guide
Common issues and resolutions:
- Insufficient stock during order placement: Verify available equals or exceeds requested quantity across stock rows; ensure no concurrent oversell conflicts.
- Negative stock after adjustment: adjustInventory prevents negative quantities; confirm inputs and permissions.
- Missing low/out alerts: Confirm reorderPoint values and computed flags; check UI filters.
- Aging inventory not surfaced: Ensure aging thresholds and warehouse filters are configured as intended.

**Section sources**
- [route.ts](file://packages/database/src/services/orders.ts)
- [inventory.ts](file://packages/database/src/services/inventory.ts)
- [page.tsx](file://apps/admin/src/app/warehouse/page.tsx)

## Conclusion
The Inventory Control system provides robust multi-location tracking, automated reservations during order processing, and clear low-stock and aging insights. Manual adjustments and movement logging ensure auditability, while the modular design supports future extensions such as dedicated inventory CSV endpoints and deeper analytics.

## Appendices
- Implementation notes confirm atomic order creation with oversell guards and improved error semantics.
- Module notes document warehouse pages, filters, and UI behaviors.

**Section sources**
- [PHASE3_IMPLEMENTATION_NOTES.md](file://PHASE3_IMPLEMENTATION_NOTES.md)
- [MODULE_05_WAREHOUSE_3PL_NOTES.md](file://MODULE_05_WAREHOUSE_3PL_NOTES.md)