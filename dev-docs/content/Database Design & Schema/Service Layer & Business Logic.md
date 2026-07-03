# Service Layer & Business Logic

<cite>
**Referenced Files in This Document**
- [products.ts](file://packages/database/src/services/products.ts)
- [orders.ts](file://packages/database/src/services/orders.ts)
- [inventory.ts](file://packages/database/src/services/inventory.ts)
- [admin.ts](file://packages/database/src/services/admin.ts)
- [index.ts](file://packages/database/src/index.ts)
- [schema.prisma](file://packages/database/prisma/schema.prisma)
- [package.json](file://packages/database/package.json)
- [DATABASE_NOTES.md](file://DATABASE_NOTES.md)
- [PHASE2_IMPLEMENTATION_NOTES.md](file://PHASE2_IMPLEMENTATION_NOTES.md)
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
This document describes the database service layer architecture used in Avenick Commerce. It focuses on the service abstraction pattern that encapsulates business logic and data access operations, and documents the responsibilities of key services: ProductsService, OrdersService, and InventoryService. It explains how these services enforce business rules, coordinate transactions, maintain data consistency, and transform raw database records into domain-aware outputs. It also covers administrative workflows and the separation of concerns between raw database operations and business logic.

## Project Structure
The service layer is implemented under the database package and exposes typed service functions backed by Prisma. The package integrates with Prisma client generation and provides a central index that exports the database client and shared types.

```mermaid
graph TB
subgraph "Database Package"
IDX["packages/database/src/index.ts"]
PRISMA["packages/database/prisma/schema.prisma"]
PKG["packages/database/package.json"]
end
subgraph "Services"
SRV_PRODUCTS["packages/database/src/services/products.ts"]
SRV_ORDERS["packages/database/src/services/orders.ts"]
SRV_INVENTORY["packages/database/src/services/inventory.ts"]
SRV_ADMIN["packages/database/src/services/admin.ts"]
end
SRV_PRODUCTS --> IDX
SRV_ORDERS --> IDX
SRV_INVENTORY --> IDX
SRV_ADMIN --> IDX
IDX --> PRISMA
PKG --> PRISMA
```

**Diagram sources**
- [index.ts](file://packages/database/src/index.ts)
- [schema.prisma](file://packages/database/prisma/schema.prisma)
- [package.json](file://packages/database/package.json)
- [products.ts](file://packages/database/src/services/products.ts)
- [orders.ts](file://packages/database/src/services/orders.ts)
- [inventory.ts](file://packages/database/src/services/inventory.ts)
- [admin.ts](file://packages/database/src/services/admin.ts)

**Section sources**
- [index.ts](file://packages/database/src/index.ts)
- [schema.prisma](file://packages/database/prisma/schema.prisma)
- [package.json](file://packages/database/package.json)
- [DATABASE_NOTES.md](file://DATABASE_NOTES.md)
- [PHASE2_IMPLEMENTATION_NOTES.md](file://PHASE2_IMPLEMENTATION_NOTES.md)

## Core Components
This section outlines the primary services and their responsibilities, focusing on how they encapsulate business logic and orchestrate data access.

- ProductsService (products.ts)
  - Catalog listing and search with pagination and filtering
  - Product retrieval by slug with rich includes (images, prices, inventory, variants, reviews)
  - Seller dashboard metrics aggregation (counts, revenue, recent orders)
  - Complexity: Listing and search use filtered queries with includes; dashboard aggregates use multiple counts and raw SQL for low-stock thresholds.

- OrdersService (orders.ts)
  - Order creation with server-side pricing resolution, VAT computation, and inventory reservation
  - Transactional order persistence and status history logging
  - Order status updates with actor attribution
  - Seller-centric order listing with pagination and includes
  - Complexity: Pricing resolution selects best applicable tier; inventory reservation uses greedy allocation across stock rows; transaction ensures atomicity.

- InventoryService (inventory.ts)
  - Inventory listing for a seller with pagination and optional low-stock filter
  - Inventory adjustments (in, out, adjustment) with validation and movement logging
  - Complexity: Adjustments run in a transaction to keep stock and movement logs consistent.

- AdminService (admin.ts)
  - Administrative dashboard metrics (GMV, active sellers, pending reviews)
  - Approve/reject seller and product workflows with audit logging
  - Document review actions for compliance
  - Complexity: Aggregates use groupBy and count; approvals/rejections run in transactions and log audit events.

**Section sources**
- [products.ts](file://packages/database/src/services/products.ts)
- [orders.ts](file://packages/database/src/services/orders.ts)
- [inventory.ts](file://packages/database/src/services/inventory.ts)
- [admin.ts](file://packages/database/src/services/admin.ts)

## Architecture Overview
The service layer follows a clean architecture pattern:
- Services depend on a centralized database client exported from the package index.
- Business logic is encapsulated within service functions, including validation, pricing, tax, and inventory checks.
- Transactions are used to ensure atomicity for operations that modify multiple entities (e.g., order creation, inventory adjustments, admin approvals).
- Data transformations normalize raw database records into domain-friendly shapes (e.g., computed availability flags, aggregated metrics).

```mermaid
graph TB
Client["Caller (API routes / UI)"]
SVC_PRODUCTS["ProductsService<br/>listProducts, getProductBySlug, getSellerDashboard"]
SVC_ORDERS["OrdersService<br/>createOrder, updateOrderStatus, getOrdersForSeller"]
SVC_INVENTORY["InventoryService<br/>getSellerInventory, adjustInventory"]
SVC_ADMIN["AdminService<br/>getAdminDashboard, approveSeller, rejectSeller, approveProduct, rejectProduct"]
DB_CLIENT["Prisma Client (db)"]
PRISMA_SCHEMA["Prisma Schema"]
Client --> SVC_PRODUCTS
Client --> SVC_ORDERS
Client --> SVC_INVENTORY
Client --> SVC_ADMIN
SVC_PRODUCTS --> DB_CLIENT
SVC_ORDERS --> DB_CLIENT
SVC_INVENTORY --> DB_CLIENT
SVC_ADMIN --> DB_CLIENT
DB_CLIENT --> PRISMA_SCHEMA
```

**Diagram sources**
- [index.ts](file://packages/database/src/index.ts)
- [schema.prisma](file://packages/database/prisma/schema.prisma)
- [products.ts](file://packages/database/src/services/products.ts)
- [orders.ts](file://packages/database/src/services/orders.ts)
- [inventory.ts](file://packages/database/src/services/inventory.ts)
- [admin.ts](file://packages/database/src/services/admin.ts)

## Detailed Component Analysis

### ProductsService
Responsibilities:
- List products with pagination, search, category/seller filters, and channel enablement flags.
- Retrieve product by slug with rich includes for images, prices, inventory, variants, reviews, and compliance.
- Compute seller dashboard metrics including order counts, pending orders, low stock items, issues, compliance, payouts, active listings, monthly revenue, recent orders, unread messages, and RFQ counts.

Key methods and behaviors:
- listProducts(params): Applies filters, pagination, and includes; returns paginated results with total and page metadata.
- getProductBySlug(slug): Returns a single product with images, active prices, inventory with location and warehouse, category, brand, seller profile, approved compliance docs, variants with active prices, and latest reviews.
- getSellerDashboard(sellerId): Executes multiple aggregations concurrently, including counts, sums, and a raw SQL query to compute low-stock items.

Validation and transformations:
- Filters exclude deleted items and apply case-insensitive search across name and SKU.
- Includes ensure primary images, active prices, and related entities are fetched efficiently.
- Dashboard computes derived flags (low stock/out-of-stock) and aggregates monetary values.

Operational notes:
- Uses Promise.all for efficient parallel reads.
- Uses raw SQL for low-stock threshold evaluation to compare qty and reorderPoint across inventory rows.

**Section sources**
- [products.ts](file://packages/database/src/services/products.ts)

### OrdersService
Responsibilities:
- Create orders with server-side pricing resolution, VAT calculation, and inventory reservation.
- Update order status with actor attribution and status history logging.
- List orders for a seller with pagination and includes.

Key methods and behaviors:
- generateOrderNumber(): Creates a collision-resistant, human-readable order number using time and randomness.
- createOrder(input): Validates non-empty items, resolves unit prices from active tiers, computes totals, and performs inventory reservation within a transaction. Throws explicit errors for missing products, missing pricing tiers, and insufficient stock.
- updateOrderStatus(orderId, status, actorId?, message?): Updates order status and writes a status history record atomically.
- getOrdersForSeller(sellerId, params): Lists orders associated with a seller’s items, with optional status filter and includes.

Business rule enforcement:
- Pricing resolution selects the best applicable tier based on channel, currency, and min/max quantities.
- VAT rates are jurisdiction-specific (KSA vs GCC).
- Inventory reservation prevents overselling by allocating greedily across stock rows and ensuring availability meets demand.

Transactions:
- Order creation and inventory reservation occur in a single transaction.
- Status updates and history logging occur in a separate transaction.

**Section sources**
- [orders.ts](file://packages/database/src/services/orders.ts)

### InventoryService
Responsibilities:
- List inventory for a seller with pagination and optional low-stock filtering.
- Adjust inventory quantities (in, out, adjustment) with validation and movement logging.

Key methods and behaviors:
- getSellerInventory(sellerId, params): Fetches inventory stock with product and location/warehouse details, computes availability and low/out flags, and optionally filters to low-stock items.
- adjustInventory(stockId, qty, type, reference?, notes?, actorId?): Validates stock existence and resulting quantity, then updates stock and logs movement in a transaction.

Business rule enforcement:
- Prevents negative quantities for OUT adjustments.
- Requires exact stock record presence for adjustments.

Transactions:
- Stock update and movement creation occur atomically.

**Section sources**
- [inventory.ts](file://packages/database/src/services/inventory.ts)

### AdminService
Responsibilities:
- Provide administrative dashboard metrics (GMV, active sellers, pending reviews, open RFQs).
- Approve/reject sellers and products with audit logging.
- Review seller documents and product compliance documents.

Key methods and behaviors:
- getAdminDashboard(): Computes GMV for today/month/year, counts active sellers and companies, pending reviews, and recent orders; groups order statuses.
- approveSeller(sellerId, actorId): Activates a seller and logs an audit event.
- rejectSeller(sellerId, actorId, reason): Rejects a seller and logs an audit event with reason.
- approveProduct(productId, actorId): Publishes a product and logs an audit event.
- rejectProduct(productId, actorId, reason): Rejects a product, logs an audit event, and creates a product issue.

Transactions:
- Seller and product approvals/rejections run in transactions and include audit log entries.

**Section sources**
- [admin.ts](file://packages/database/src/services/admin.ts)

### Class Model of Service Functions
```mermaid
classDiagram
class ProductsService {
+listProducts(params)
+getProductBySlug(slug)
+getSellerDashboard(sellerId)
}
class OrdersService {
+generateOrderNumber()
+createOrder(input)
+updateOrderStatus(orderId, status, actorId?, message?)
+getOrdersForSeller(sellerId, params)
}
class InventoryService {
+getSellerInventory(sellerId, params)
+adjustInventory(stockId, qty, type, reference?, notes?, actorId?)
}
class AdminService {
+getAdminDashboard()
+approveSeller(sellerId, actorId)
+rejectSeller(sellerId, actorId, reason)
+reviewDocument(docId, status, actorId, reason?)
+reviewProductCompliance(docId, status, actorId, reason?)
+approveProduct(productId, actorId)
+rejectProduct(productId, actorId, reason)
}
class PrismaClient {
+db
}
ProductsService --> PrismaClient : "uses"
OrdersService --> PrismaClient : "uses"
InventoryService --> PrismaClient : "uses"
AdminService --> PrismaClient : "uses"
```

**Diagram sources**
- [products.ts](file://packages/database/src/services/products.ts)
- [orders.ts](file://packages/database/src/services/orders.ts)
- [inventory.ts](file://packages/database/src/services/inventory.ts)
- [admin.ts](file://packages/database/src/services/admin.ts)
- [index.ts](file://packages/database/src/index.ts)

## Dependency Analysis
- Centralized database client: All services import the Prisma client from the package index, ensuring consistent configuration and type safety.
- Prisma schema: Entities and relations are defined in the Prisma schema; services rely on these relations for includes and joins.
- Package scripts: The database package defines Prisma commands for generation, seeding, migration, and deployment.

```mermaid
graph LR
PKG["packages/database/package.json"]
PRISMA["packages/database/prisma/schema.prisma"]
IDX["packages/database/src/index.ts"]
SRV_PRODUCTS["services/products.ts"]
SRV_ORDERS["services/orders.ts"]
SRV_INVENTORY["services/inventory.ts"]
SRV_ADMIN["services/admin.ts"]
PKG --> PRISMA
PRISMA --> IDX
IDX --> SRV_PRODUCTS
IDX --> SRV_ORDERS
IDX --> SRV_INVENTORY
IDX --> SRV_ADMIN
```

**Diagram sources**
- [package.json](file://packages/database/package.json)
- [schema.prisma](file://packages/database/prisma/schema.prisma)
- [index.ts](file://packages/database/src/index.ts)
- [products.ts](file://packages/database/src/services/products.ts)
- [orders.ts](file://packages/database/src/services/orders.ts)
- [inventory.ts](file://packages/database/src/services/inventory.ts)
- [admin.ts](file://packages/database/src/services/admin.ts)

**Section sources**
- [package.json](file://packages/database/package.json)
- [schema.prisma](file://packages/database/prisma/schema.prisma)
- [index.ts](file://packages/database/src/index.ts)

## Performance Considerations
- Efficient queries with includes: Services fetch only required relations (e.g., primary images, active prices, inventory) to minimize payload size and reduce round-trips.
- Parallelization: Dashboard computations and listing operations use Promise.all to execute independent queries concurrently.
- Pagination: Listing APIs accept page and limit parameters to avoid large result sets.
- Aggregation and grouping: Metrics are computed via database aggregates and groupBy to offload work to the database engine.
- Raw SQL for thresholds: Low-stock computation uses a single raw SQL query to compare columns efficiently.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Missing product or pricing tier during order creation: The service throws explicit errors when a product is unavailable or no active price matches the order channel and quantity. Verify product availability and active pricing tiers.
- Insufficient stock during order creation: The service validates total available quantity across inventory rows and throws an error if demand exceeds supply. Check inventoryStock reservations and reorder points.
- Negative inventory adjustment: Adjustments that would drop quantity below zero are rejected. Ensure OUT adjustments do not exceed available quantity.
- Nonexistent stock record: Adjustments require an existing stock record; verify the stockId and product association.
- Transaction failures: Operations that modify multiple entities run in transactions. Failures indicate constraint violations or conflicting concurrent operations; inspect related entities and retry if appropriate.

**Section sources**
- [orders.ts](file://packages/database/src/services/orders.ts)
- [inventory.ts](file://packages/database/src/services/inventory.ts)

## Conclusion
The Avenick Commerce service layer cleanly separates business logic from raw database operations. Services encapsulate pricing, tax, inventory reservation, and audit workflows while leveraging Prisma for type-safe data access. Transactions ensure consistency for critical operations, and rich includes provide domain-ready outputs. Administrative workflows integrate with audit logging and compliance review processes. Together, these patterns deliver a robust, maintainable, and scalable service layer.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Example Workflows

#### Order Fulfillment Workflow
```mermaid
sequenceDiagram
participant Client as "Client"
participant Orders as "OrdersService"
participant DB as "Prisma Client"
Client->>Orders : "createOrder(items, currency, type)"
Orders->>DB : "findMany(products with prices/inventory)"
Orders->>Orders : "resolveUnitPrice per item"
Orders->>DB : "$transaction(begin)"
loop "for each item"
Orders->>DB : "findMany(inventoryStock rows)"
Orders->>Orders : "compute available qty"
Orders->>DB : "update(reserve inventory)"
end
Orders->>DB : "create(order with items)"
Orders->>DB : "create(statusHistory)"
Orders->>DB : "$transaction(commit)"
Orders-->>Client : "Order with items and history"
```

**Diagram sources**
- [orders.ts](file://packages/database/src/services/orders.ts)
- [index.ts](file://packages/database/src/index.ts)

#### Inventory Management Process
```mermaid
flowchart TD
Start(["Adjust Inventory Request"]) --> Validate["Validate stockId and quantity"]
Validate --> TypeCheck{"Type?"}
TypeCheck --> |IN| Add["Compute newQty = qty + delta"]
TypeCheck --> |OUT| Deduct["Compute newQty = qty - delta"]
TypeCheck --> |ADJUSTMENT| Set["Set newQty = delta"]
Add --> TxBegin["$transaction(begin)"]
Deduct --> TxBegin
Set --> TxBegin
TxBegin --> UpdateStock["Update inventoryStock.qty"]
UpdateStock --> Log["Create inventoryMovement"]
Log --> TxCommit["$transaction(commit)"]
TxCommit --> Done(["New Quantity"])
Validate --> |Invalid| Error["Throw error"]
```

**Diagram sources**
- [inventory.ts](file://packages/database/src/services/inventory.ts)
- [index.ts](file://packages/database/src/index.ts)

#### Product Catalog Operations
```mermaid
flowchart TD
SearchStart(["Search/List Products"]) --> ApplyFilters["Apply filters (category, seller, status, channel)"]
ApplyFilters --> Paginate["Compute skip/take and order"]
Paginate --> IncludeRelations["Include images/prices/inventory/category/brand/seller/issues"]
IncludeRelations --> ExecQuery["Execute findMany + count"]
ExecQuery --> ReturnResults["Return {products, total, page, limit, totalPages}"]
```

**Diagram sources**
- [products.ts](file://packages/database/src/services/products.ts)
- [index.ts](file://packages/database/src/index.ts)