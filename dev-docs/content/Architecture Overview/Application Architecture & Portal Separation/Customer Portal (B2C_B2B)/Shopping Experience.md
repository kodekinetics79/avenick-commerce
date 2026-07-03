# Shopping Experience

<cite>
**Referenced Files in This Document**
- [cart.ts](file://apps/customer/src/stores/cart.ts)
- [wishlist.ts](file://apps/customer/src/stores/wishlist.ts)
- [page.tsx](file://apps/customer/src/app/cart/page.tsx)
- [page.tsx](file://apps/customer/src/app/checkout/page.tsx)
- [page.tsx](file://apps/customer/src/app/wishlist/page.tsx)
- [route.ts](file://apps/customer/src/app/api/payments/webhook/route.ts)
- [validated-form.tsx](file://apps/customer/src/components/b2b/validated-form.tsx)
- [actions.ts](file://apps/customer/src/app/b2b/addresses/actions.ts)
- [actions.ts](file://apps/customer/src/app/b2b/lists/actions.ts)
- [actions.ts](file://apps/customer/src/app/b2b/purchase-orders/actions.ts)
- [actions.ts](file://apps/customer/src/app/orders/actions.ts)
- [orders.tsx](file://apps/seller/src/app/orders/page.tsx)
- [orders-table.tsx](file://apps/seller/src/components/orders-table.tsx)
- [auth-instance.ts](file://apps/customer/src/lib/auth-instance.ts)
- [auth.ts](file://apps/admin/src/lib/auth.ts)
- [auth-instance.ts](file://apps/seller/src/lib/auth-instance.ts)
- [layout.tsx](file://apps/customer/src/app/layout.tsx)
- [layout.tsx](file://apps/admin/src/app/layout.tsx)
- [layout.tsx](file://apps/seller/src/app/layout.tsx)
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
This document describes the Shopping Experience subsystem of the Avenick Commerce platform. It focuses on the customer-facing shopping journey: cart management, checkout, payment processing, order confirmation, and wishlist operations. It also covers state management via local stores, user session handling, guest checkout options, and integration touchpoints for payments, shipping, taxes, and order placement. The content is derived from the customer application’s stores, pages, and supporting utilities.

## Project Structure
The Shopping Experience spans the customer application and integrates with shared libraries and backend APIs:
- Local state stores for cart and wishlist
- Pages for cart, checkout, and wishlist
- Payment webhook endpoint
- B2B utilities for validated forms and address management
- Order management for both customer and seller applications
- Authentication instances for session handling

```mermaid
graph TB
subgraph "Customer App"
CART["Cart Page<br/>app/cart/page.tsx"]
CHECKOUT["Checkout Page<br/>app/checkout/page.tsx"]
WISHLIST["Wishlist Page<br/>app/wishlist/page.tsx"]
STORE_CART["Cart Store<br/>stores/cart.ts"]
STORE_WISHLIST["Wishlist Store<br/>stores/wishlist.ts"]
PAYWEBHOOK["Payment Webhook<br/>app/api/payments/webhook/route.ts"]
VALIDFORM["Validated Form<br/>components/b2b/validated-form.tsx"]
ADDR_ACTIONS["Address Actions<br/>b2b/addresses/actions.ts"]
LIST_ACTIONS["List Actions<br/>b2b/lists/actions.ts"]
PO_ACTIONS["Purchase Order Actions<br/>b2b/purchase-orders/actions.ts"]
end
subgraph "Shared"
AUTH_CUST["Customer Auth Instance<br/>lib/auth-instance.ts"]
AUTH_ADMIN["Admin Auth<br/>admin/lib/auth.ts"]
AUTH_SELLER["Seller Auth Instance<br/>seller/lib/auth-instance.ts"]
end
subgraph "Seller App"
ORDERS_SELLER["Orders Page<br/>seller/app/orders/page.tsx"]
TABLE_SELLER["Orders Table<br/>seller/components/orders-table.tsx"]
end
CART --> STORE_CART
CHECKOUT --> STORE_CART
CHECKOUT --> PAYWEBHOOK
WISHLIST --> STORE_WISHLIST
CART --> AUTH_CUST
CHECKOUT --> AUTH_CUST
WISHLIST --> AUTH_CUST
VALIDFORM --> ADDR_ACTIONS
VALIDFORM --> LIST_ACTIONS
VALIDFORM --> PO_ACTIONS
ORDERS_SELLER --> TABLE_SELLER
```

**Diagram sources**
- [cart.ts](file://apps/customer/src/stores/cart.ts)
- [wishlist.ts](file://apps/customer/src/stores/wishlist.ts)
- [page.tsx](file://apps/customer/src/app/cart/page.tsx)
- [page.tsx](file://apps/customer/src/app/checkout/page.tsx)
- [page.tsx](file://apps/customer/src/app/wishlist/page.tsx)
- [route.ts](file://apps/customer/src/app/api/payments/webhook/route.ts)
- [validated-form.tsx](file://apps/customer/src/components/b2b/validated-form.tsx)
- [actions.ts](file://apps/customer/src/app/b2b/addresses/actions.ts)
- [actions.ts](file://apps/customer/src/app/b2b/lists/actions.ts)
- [actions.ts](file://apps/customer/src/app/b2b/purchase-orders/actions.ts)
- [auth-instance.ts](file://apps/customer/src/lib/auth-instance.ts)
- [auth.ts](file://apps/admin/src/lib/auth.ts)
- [auth-instance.ts](file://apps/seller/src/lib/auth-instance.ts)
- [orders.tsx](file://apps/seller/src/app/orders/page.tsx)
- [orders-table.tsx](file://apps/seller/src/components/orders-table.tsx)

**Section sources**
- [cart.ts](file://apps/customer/src/stores/cart.ts)
- [wishlist.ts](file://apps/customer/src/stores/wishlist.ts)
- [page.tsx](file://apps/customer/src/app/cart/page.tsx)
- [page.tsx](file://apps/customer/src/app/checkout/page.tsx)
- [page.tsx](file://apps/customer/src/app/wishlist/page.tsx)
- [route.ts](file://apps/customer/src/app/api/payments/webhook/route.ts)
- [validated-form.tsx](file://apps/customer/src/components/b2b/validated-form.tsx)
- [actions.ts](file://apps/customer/src/app/b2b/addresses/actions.ts)
- [actions.ts](file://apps/customer/src/app/b2b/lists/actions.ts)
- [actions.ts](file://apps/customer/src/app/b2b/purchase-orders/actions.ts)
- [auth-instance.ts](file://apps/customer/src/lib/auth-instance.ts)
- [auth.ts](file://apps/admin/src/lib/auth.ts)
- [auth-instance.ts](file://apps/seller/src/lib/auth-instance.ts)
- [orders.tsx](file://apps/seller/src/app/orders/page.tsx)
- [orders-table.tsx](file://apps/seller/src/components/orders-table.tsx)

## Core Components
- Cart Store: Manages items, quantities, totals, and persistence in local storage. Provides add, update quantity, remove, and clear operations.
- Wishlist Store: Manages saved items, supports share and remove actions.
- Cart Page: Renders cart contents, allows quantity updates and removals, and initiates checkout.
- Checkout Page: Collects shipping/billing details, validates inputs, triggers payment processing, and handles order confirmation.
- Payment Webhook: Receives asynchronous payment outcomes to reconcile order state.
- B2B Utilities: Validated forms and actions for addresses, lists, and purchase orders.
- Order Management: Customer and seller views for order lifecycle tracking.

**Section sources**
- [cart.ts](file://apps/customer/src/stores/cart.ts)
- [wishlist.ts](file://apps/customer/src/stores/wishlist.ts)
- [page.tsx](file://apps/customer/src/app/cart/page.tsx)
- [page.tsx](file://apps/customer/src/app/checkout/page.tsx)
- [page.tsx](file://apps/customer/src/app/wishlist/page.tsx)
- [route.ts](file://apps/customer/src/app/api/payments/webhook/route.ts)
- [validated-form.tsx](file://apps/customer/src/components/b2b/validated-form.tsx)
- [actions.ts](file://apps/customer/src/app/b2b/addresses/actions.ts)
- [actions.ts](file://apps/customer/src/app/b2b/lists/actions.ts)
- [actions.ts](file://apps/customer/src/app/b2b/purchase-orders/actions.ts)

## Architecture Overview
The Shopping Experience follows a layered pattern:
- UI Pages orchestrate user interactions for cart, checkout, and wishlist.
- Local Stores encapsulate state and persistence.
- Backend APIs handle payment webhooks, order creation, and B2B operations.
- Authentication instances manage sessions across roles.

```mermaid
graph TB
UI_CART["Cart Page"]
UI_CHECKOUT["Checkout Page"]
UI_WISHLIST["Wishlist Page"]
STORE_CART["Cart Store"]
STORE_WISHLIST["Wishlist Store"]
WEBHOOK["Payments Webhook"]
AUTH["Auth Instances"]
ORDERS["Order Management"]
UI_CART --> STORE_CART
UI_CHECKOUT --> STORE_CART
UI_CHECKOUT --> WEBHOOK
UI_WISHLIST --> STORE_WISHLIST
UI_CART --> AUTH
UI_CHECKOUT --> AUTH
UI_WISHLIST --> AUTH
WEBHOOK --> ORDERS
```

**Diagram sources**
- [page.tsx](file://apps/customer/src/app/cart/page.tsx)
- [page.tsx](file://apps/customer/src/app/checkout/page.tsx)
- [page.tsx](file://apps/customer/src/app/wishlist/page.tsx)
- [cart.ts](file://apps/customer/src/stores/cart.ts)
- [wishlist.ts](file://apps/customer/src/stores/wishlist.ts)
- [route.ts](file://apps/customer/src/app/api/payments/webhook/route.ts)
- [auth-instance.ts](file://apps/customer/src/lib/auth-instance.ts)
- [orders.tsx](file://apps/seller/src/app/orders/page.tsx)

## Detailed Component Analysis

### Cart Store and Persistence
The cart store maintains items and quantities, computes totals, and persists state locally. It exposes operations to add items, update quantities, remove items, and clear the cart. Persistence ensures continuity across browser sessions.

```mermaid
classDiagram
class CartStore {
+addItem(item)
+updateQuantity(id, delta)
+removeItem(id)
+clearCart()
+getItems()
+getTotal()
+persist()
}
```

**Diagram sources**
- [cart.ts](file://apps/customer/src/stores/cart.ts)

**Section sources**
- [cart.ts](file://apps/customer/src/stores/cart.ts)

### Wishlist Store and Sharing
The wishlist store manages saved items and supports sharing and removal. It complements the cart by enabling long-term item preservation and collaboration.

```mermaid
classDiagram
class WishlistStore {
+addItem(item)
+shareWishlist()
+removeItem(id)
+getItems()
}
```

**Diagram sources**
- [wishlist.ts](file://apps/customer/src/stores/wishlist.ts)

**Section sources**
- [wishlist.ts](file://apps/customer/src/stores/wishlist.ts)

### Cart Page Workflow
The cart page renders items from the cart store, allows quantity adjustments, and removals. It links to checkout when ready.

```mermaid
sequenceDiagram
participant U as "User"
participant P as "Cart Page"
participant S as "Cart Store"
U->>P : "Open cart"
P->>S : "Load items"
U->>P : "Adjust quantity/remove item"
P->>S : "updateQuantity/removeItem"
S-->>P : "Updated items"
U->>P : "Proceed to checkout"
P-->>U : "Navigate to checkout"
```

**Diagram sources**
- [page.tsx](file://apps/customer/src/app/cart/page.tsx)
- [cart.ts](file://apps/customer/src/stores/cart.ts)

**Section sources**
- [page.tsx](file://apps/customer/src/app/cart/page.tsx)
- [cart.ts](file://apps/customer/src/stores/cart.ts)

### Checkout Process Flow
The checkout page collects shipping and billing information, validates inputs, triggers payment processing, and confirms order completion. It relies on the cart store for totals and items.

```mermaid
sequenceDiagram
participant U as "User"
participant C as "Checkout Page"
participant S as "Cart Store"
participant V as "Validated Form"
participant W as "Payments Webhook"
participant O as "Order Management"
U->>C : "Open checkout"
C->>S : "Fetch items and totals"
U->>V : "Submit shipping/billing"
V-->>C : "Validation result"
C->>W : "Initiate payment"
W-->>O : "Webhook outcome"
O-->>C : "Order confirmed"
C-->>U : "Confirmation screen"
```

**Diagram sources**
- [page.tsx](file://apps/customer/src/app/checkout/page.tsx)
- [cart.ts](file://apps/customer/src/stores/cart.ts)
- [validated-form.tsx](file://apps/customer/src/components/b2b/validated-form.tsx)
- [route.ts](file://apps/customer/src/app/api/payments/webhook/route.ts)
- [orders.tsx](file://apps/seller/src/app/orders/page.tsx)

**Section sources**
- [page.tsx](file://apps/customer/src/app/checkout/page.tsx)
- [validated-form.tsx](file://apps/customer/src/components/b2b/validated-form.tsx)
- [route.ts](file://apps/customer/src/app/api/payments/webhook/route.ts)
- [orders.tsx](file://apps/seller/src/app/orders/page.tsx)

### Payment Webhook Integration
The payment webhook endpoint receives asynchronous payment outcomes. It reconciles order state based on the event payload and updates order management accordingly.

```mermaid
sequenceDiagram
participant PG as "Payment Gateway"
participant WH as "Payments Webhook"
participant OM as "Order Management"
PG-->>WH : "Webhook event"
WH->>WH : "Validate signature and parse payload"
WH->>OM : "Update order status"
OM-->>WH : "Acknowledge"
```

**Diagram sources**
- [route.ts](file://apps/customer/src/app/api/payments/webhook/route.ts)
- [orders.tsx](file://apps/seller/src/app/orders/page.tsx)

**Section sources**
- [route.ts](file://apps/customer/src/app/api/payments/webhook/route.ts)
- [orders.tsx](file://apps/seller/src/app/orders/page.tsx)

### Wishlist Page Workflow
The wishlist page displays saved items, supports sharing, and allows removal. It integrates with the wishlist store for state management.

```mermaid
sequenceDiagram
participant U as "User"
participant P as "Wishlist Page"
participant S as "Wishlist Store"
U->>P : "Open wishlist"
P->>S : "Load items"
U->>P : "Share/remove item"
P->>S : "shareWishlist/removeItem"
S-->>P : "Updated items"
```

**Diagram sources**
- [page.tsx](file://apps/customer/src/app/wishlist/page.tsx)
- [wishlist.ts](file://apps/customer/src/stores/wishlist.ts)

**Section sources**
- [page.tsx](file://apps/customer/src/app/wishlist/page.tsx)
- [wishlist.ts](file://apps/customer/src/stores/wishlist.ts)

### B2B Validation and Actions
B2B flows rely on validated forms and actions for addresses, lists, and purchase orders. These utilities ensure data integrity and streamline business workflows.

```mermaid
flowchart TD
Start(["Form Submission"]) --> Validate["Validate Inputs"]
Validate --> Valid{"Valid?"}
Valid --> |No| ShowErrors["Show Validation Errors"]
Valid --> |Yes| Submit["Execute Action"]
Submit --> UpdateUI["Update UI State"]
ShowErrors --> End(["End"])
UpdateUI --> End
```

**Diagram sources**
- [validated-form.tsx](file://apps/customer/src/components/b2b/validated-form.tsx)
- [actions.ts](file://apps/customer/src/app/b2b/addresses/actions.ts)
- [actions.ts](file://apps/customer/src/app/b2b/lists/actions.ts)
- [actions.ts](file://apps/customer/src/app/b2b/purchase-orders/actions.ts)

**Section sources**
- [validated-form.tsx](file://apps/customer/src/components/b2b/validated-form.tsx)
- [actions.ts](file://apps/customer/src/app/b2b/addresses/actions.ts)
- [actions.ts](file://apps/customer/src/app/b2b/lists/actions.ts)
- [actions.ts](file://apps/customer/src/app/b2b/purchase-orders/actions.ts)

### Order Management (Seller)
The seller application provides order management capabilities, including viewing orders and rendering order tables for fulfillment.

```mermaid
sequenceDiagram
participant S as "Seller"
participant OP as "Orders Page"
participant OT as "Orders Table"
S->>OP : "Open orders"
OP->>OT : "Render order list"
S->>OT : "View details and manage"
```

**Diagram sources**
- [orders.tsx](file://apps/seller/src/app/orders/page.tsx)
- [orders-table.tsx](file://apps/seller/src/components/orders-table.tsx)

**Section sources**
- [orders.tsx](file://apps/seller/src/app/orders/page.tsx)
- [orders-table.tsx](file://apps/seller/src/components/orders-table.tsx)

## Dependency Analysis
The Shopping Experience subsystem exhibits clear separation of concerns:
- UI Pages depend on local stores for state and on authentication instances for session context.
- Payment webhook depends on order management for state reconciliation.
- B2B utilities depend on action modules for server-side effects.
- Seller order management depends on UI components for rendering.

```mermaid
graph LR
CART_PAGE["Cart Page"] --> CART_STORE["Cart Store"]
CHECKOUT_PAGE["Checkout Page"] --> CART_STORE
CHECKOUT_PAGE --> PAY_WEBHOOK["Payments Webhook"]
WISHLIST_PAGE["Wishlist Page"] --> WISHLIST_STORE["Wishlist Store"]
CART_PAGE --> AUTH_CUST["Customer Auth"]
CHECKOUT_PAGE --> AUTH_CUST
WISHLIST_PAGE --> AUTH_CUST
VALIDATED_FORM["Validated Form"] --> ADDR_ACTIONS["Address Actions"]
VALIDATED_FORM --> LIST_ACTIONS["List Actions"]
VALIDATED_FORM --> PO_ACTIONS["Purchase Order Actions"]
PAY_WEBHOOK --> ORDERS_SELLER["Orders Page"]
```

**Diagram sources**
- [page.tsx](file://apps/customer/src/app/cart/page.tsx)
- [page.tsx](file://apps/customer/src/app/checkout/page.tsx)
- [page.tsx](file://apps/customer/src/app/wishlist/page.tsx)
- [cart.ts](file://apps/customer/src/stores/cart.ts)
- [wishlist.ts](file://apps/customer/src/stores/wishlist.ts)
- [route.ts](file://apps/customer/src/app/api/payments/webhook/route.ts)
- [validated-form.tsx](file://apps/customer/src/components/b2b/validated-form.tsx)
- [actions.ts](file://apps/customer/src/app/b2b/addresses/actions.ts)
- [actions.ts](file://apps/customer/src/app/b2b/lists/actions.ts)
- [actions.ts](file://apps/customer/src/app/b2b/purchase-orders/actions.ts)
- [auth-instance.ts](file://apps/customer/src/lib/auth-instance.ts)
- [orders.tsx](file://apps/seller/src/app/orders/page.tsx)

**Section sources**
- [cart.ts](file://apps/customer/src/stores/cart.ts)
- [wishlist.ts](file://apps/customer/src/stores/wishlist.ts)
- [page.tsx](file://apps/customer/src/app/cart/page.tsx)
- [page.tsx](file://apps/customer/src/app/checkout/page.tsx)
- [page.tsx](file://apps/customer/src/app/wishlist/page.tsx)
- [route.ts](file://apps/customer/src/app/api/payments/webhook/route.ts)
- [validated-form.tsx](file://apps/customer/src/components/b2b/validated-form.tsx)
- [actions.ts](file://apps/customer/src/app/b2b/addresses/actions.ts)
- [actions.ts](file://apps/customer/src/app/b2b/lists/actions.ts)
- [actions.ts](file://apps/customer/src/app/b2b/purchase-orders/actions.ts)
- [auth-instance.ts](file://apps/customer/src/lib/auth-instance.ts)
- [orders.tsx](file://apps/seller/src/app/orders/page.tsx)

## Performance Considerations
- Minimize re-renders by structuring store state efficiently and using selective updates.
- Persist cart and wishlist data locally to avoid repeated network requests during browsing.
- Debounce form inputs in checkout to reduce unnecessary validations.
- Batch UI updates after store mutations to improve perceived performance.
- Use optimistic updates for quick feedback during add-to-cart and wishlist operations, with reconciliation on server response.

## Troubleshooting Guide
Common issues and resolutions:
- Cart not persisting across sessions: Verify local storage availability and store persistence logic.
- Checkout validation errors: Confirm validated form rules and ensure proper error messaging.
- Payment webhook not updating order: Check webhook signature verification and payload parsing.
- Wishlist sharing failures: Validate share permissions and network connectivity.
- Session inconsistencies: Review authentication instance usage and cookie/session storage.

**Section sources**
- [cart.ts](file://apps/customer/src/stores/cart.ts)
- [wishlist.ts](file://apps/customer/src/stores/wishlist.ts)
- [validated-form.tsx](file://apps/customer/src/components/b2b/validated-form.tsx)
- [route.ts](file://apps/customer/src/app/api/payments/webhook/route.ts)
- [auth-instance.ts](file://apps/customer/src/lib/auth-instance.ts)

## Conclusion
The Shopping Experience subsystem integrates local state management, validated forms, and backend webhooks to deliver a robust shopping journey. The cart and wishlist stores provide reliable persistence, while checkout and payment webhook flows ensure secure transactions. B2B utilities and order management further enhance the ecosystem for both customers and sellers.