# User Account Management

<cite>
**Referenced Files in This Document**
- [page.tsx](file://apps/customer/src/app/account/page.tsx)
- [orders/page.tsx](file://apps/customer/src/app/account/orders/page.tsx)
- [addresses/page.tsx](file://apps/customer/src/app/b2b/addresses/page.tsx)
- [actions.ts](file://apps/customer/src/app/b2b/addresses/actions.ts)
- [validated-form.tsx](file://apps/customer/src/components/b2b/validated-form.tsx)
- [reorder-button.tsx](file://apps/customer/src/components/b2b/reorder-button.tsx)
- [route.ts](file://apps/customer/src/app/api/auth/[...nextauth]/route.ts)
- [auth-instance.ts](file://apps/customer/src/lib/auth-instance.ts)
- [auth.ts](file://apps/customer/src/lib/auth.ts)
- [layout.tsx](file://apps/customer/src/components/layout/main-layout.tsx)
- [header.tsx](file://apps/customer/src/components/layout/header.tsx)
- [role-switcher.tsx](file://apps/customer/src/components/layout/role-switcher.tsx)
- [login/page.tsx](file://apps/customer/src/app/login/page.tsx)
- [register/page.tsx](file://apps/customer/src/app/register/page.tsx)
- [orders/[id]/page.tsx](file://apps/customer/src/app/orders/[id]/page.tsx)
- [orders/route.ts](file://apps/customer/src/app/api/orders/route.ts)
- [cart.ts](file://apps/customer/src/stores/cart.ts)
- [wishlist.ts](file://apps/customer/src/stores/wishlist.ts)
- [email.ts](file://apps/customer/src/lib/email.ts)
- [middleware.ts](file://apps/customer/src/middleware.ts)
- [request.ts](file://apps/customer/src/i18n/request.ts)
- [en.json](file://apps/customer/messages/en.json)
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
This document describes the User Account Management features implemented in the customer-facing application. It covers the customer profile management interface, personal information editing, password change functionality, and account security features. It also explains order history display, order status tracking, order details viewing, and order reordering capabilities. Address book management, default address selection, and shipping/billing address handling are documented, along with authentication integration, session management, user preference storage, and GDPR compliance considerations for customer data handling.

## Project Structure
The customer application exposes account-related pages under the account route, integrates with NextAuth for authentication, and provides B2B-specific features such as address management and order reordering. The structure below highlights the relevant files and their roles in user account management.

```mermaid
graph TB
subgraph "Customer App"
A["Account Page<br/>apps/customer/src/app/account/page.tsx"]
B["Account Orders List<br/>apps/customer/src/app/account/orders/page.tsx"]
C["B2B Addresses<br/>apps/customer/src/app/b2b/addresses/page.tsx"]
D["Address Actions<br/>apps/customer/src/app/b2b/addresses/actions.ts"]
E["Validated Form Component<br/>apps/customer/src/components/b2b/validated-form.tsx"]
F["Reorder Button Component<br/>apps/customer/src/components/b2b/reorder-button.tsx"]
G["Auth API Route<br/>apps/customer/src/app/api/auth/[...nextauth]/route.ts"]
H["Auth Instance<br/>apps/customer/src/lib/auth-instance.ts"]
I["Auth Utilities<br/>apps/customer/src/lib/auth.ts"]
J["Main Layout<br/>apps/customer/src/components/layout/main-layout.tsx"]
K["Header & Role Switcher<br/>apps/customer/src/components/layout/header.tsx<br/>apps/customer/src/components/layout/role-switcher.tsx"]
L["Login Page<br/>apps/customer/src/app/login/page.tsx"]
M["Register Page<br/>apps/customer/src/app/register/page.tsx"]
N["Order Details<br/>apps/customer/src/app/orders/[id]/page.tsx"]
O["Orders API<br/>apps/customer/src/app/api/orders/route.ts"]
P["Cart Store<br/>apps/customer/src/stores/cart.ts"]
Q["Wishlist Store<br/>apps/customer/src/stores/wishlist.ts"]
R["Email Utilities<br/>apps/customer/src/lib/email.ts"]
S["Middleware<br/>apps/customer/src/middleware.ts"]
T["i18n Request<br/>apps/customer/src/i18n/request.ts"]
U["Messages EN<br/>apps/customer/messages/en.json"]
end
A --> B
A --> C
C --> D
D --> E
B --> N
N --> O
A --> G
G --> H
H --> I
A --> J
J --> K
L --> G
M --> G
A --> P
A --> Q
A --> R
A --> S
A --> T
A --> U
```

**Diagram sources**
- [page.tsx:1-200](file://apps/customer/src/app/account/page.tsx#L1-L200)
- [orders/page.tsx:1-200](file://apps/customer/src/app/account/orders/page.tsx#L1-L200)
- [addresses/page.tsx:1-200](file://apps/customer/src/app/b2b/addresses/page.tsx#L1-L200)
- [actions.ts:1-200](file://apps/customer/src/app/b2b/addresses/actions.ts#L1-L200)
- [validated-form.tsx:1-200](file://apps/customer/src/components/b2b/validated-form.tsx#L1-L200)
- [reorder-button.tsx:1-200](file://apps/customer/src/components/b2b/reorder-button.tsx#L1-L200)
- [route.ts:1-200](file://apps/customer/src/app/api/auth/[...nextauth]/route.ts#L1-L200)
- [auth-instance.ts:1-200](file://apps/customer/src/lib/auth-instance.ts#L1-L200)
- [auth.ts:1-200](file://apps/customer/src/lib/auth.ts#L1-L200)
- [layout.tsx:1-200](file://apps/customer/src/components/layout/main-layout.tsx#L1-L200)
- [header.tsx:1-200](file://apps/customer/src/components/layout/header.tsx#L1-L200)
- [role-switcher.tsx:1-200](file://apps/customer/src/components/layout/role-switcher.tsx#L1-L200)
- [login/page.tsx:1-200](file://apps/customer/src/app/login/page.tsx#L1-L200)
- [register/page.tsx:1-200](file://apps/customer/src/app/register/page.tsx#L1-L200)
- [orders/[id]/page.tsx](file://apps/customer/src/app/orders/[id]/page.tsx#L1-L200)
- [orders/route.ts:1-200](file://apps/customer/src/app/api/orders/route.ts#L1-L200)
- [cart.ts:1-200](file://apps/customer/src/stores/cart.ts#L1-L200)
- [wishlist.ts:1-200](file://apps/customer/src/stores/wishlist.ts#L1-L200)
- [email.ts:1-200](file://apps/customer/src/lib/email.ts#L1-L200)
- [middleware.ts:1-200](file://apps/customer/src/middleware.ts#L1-L200)
- [request.ts:1-200](file://apps/customer/src/i18n/request.ts#L1-L200)
- [en.json:1-200](file://apps/customer/messages/en.json#L1-L200)

**Section sources**
- [page.tsx:1-200](file://apps/customer/src/app/account/page.tsx#L1-L200)
- [orders/page.tsx:1-200](file://apps/customer/src/app/account/orders/page.tsx#L1-L200)
- [addresses/page.tsx:1-200](file://apps/customer/src/app/b2b/addresses/page.tsx#L1-L200)
- [actions.ts:1-200](file://apps/customer/src/app/b2b/addresses/actions.ts#L1-L200)
- [validated-form.tsx:1-200](file://apps/customer/src/components/b2b/validated-form.tsx#L1-L200)
- [reorder-button.tsx:1-200](file://apps/customer/src/components/b2b/reorder-button.tsx#L1-L200)
- [route.ts:1-200](file://apps/customer/src/app/api/auth/[...nextauth]/route.ts#L1-L200)
- [auth-instance.ts:1-200](file://apps/customer/src/lib/auth-instance.ts#L1-L200)
- [auth.ts:1-200](file://apps/customer/src/lib/auth.ts#L1-L200)
- [layout.tsx:1-200](file://apps/customer/src/components/layout/main-layout.tsx#L1-L200)
- [header.tsx:1-200](file://apps/customer/src/components/layout/header.tsx#L1-L200)
- [role-switcher.tsx:1-200](file://apps/customer/src/components/layout/role-switcher.tsx#L1-L200)
- [login/page.tsx:1-200](file://apps/customer/src/app/login/page.tsx#L1-L200)
- [register/page.tsx:1-200](file://apps/customer/src/app/register/page.tsx#L1-L200)
- [orders/[id]/page.tsx](file://apps/customer/src/app/orders/[id]/page.tsx#L1-L200)
- [orders/route.ts:1-200](file://apps/customer/src/app/api/orders/route.ts#L1-L200)
- [cart.ts:1-200](file://apps/customer/src/stores/cart.ts#L1-L200)
- [wishlist.ts:1-200](file://apps/customer/src/stores/wishlist.ts#L1-L200)
- [email.ts:1-200](file://apps/customer/src/lib/email.ts#L1-L200)
- [middleware.ts:1-200](file://apps/customer/src/middleware.ts#L1-L200)
- [request.ts:1-200](file://apps/customer/src/i18n/request.ts#L1-L200)
- [en.json:1-200](file://apps/customer/messages/en.json#L1-L200)

## Core Components
- Customer Account Dashboard: Provides access to profile, orders, addresses, and preferences.
- Authentication Integration: NextAuth-based login, registration, and session management.
- Order Management: View order history, track status, view details, and reorder items.
- Address Book: Manage multiple addresses, set defaults, and handle shipping/billing.
- Security and Preferences: Password change, session controls, and user preference storage.
- GDPR Compliance: Data handling policies via middleware and localized messaging.

**Section sources**
- [page.tsx:1-200](file://apps/customer/src/app/account/page.tsx#L1-L200)
- [route.ts:1-200](file://apps/customer/src/app/api/auth/[...nextauth]/route.ts#L1-L200)
- [orders/page.tsx:1-200](file://apps/customer/src/app/account/orders/page.tsx#L1-L200)
- [orders/[id]/page.tsx](file://apps/customer/src/app/orders/[id]/page.tsx#L1-L200)
- [addresses/page.tsx:1-200](file://apps/customer/src/app/b2b/addresses/page.tsx#L1-L200)
- [actions.ts:1-200](file://apps/customer/src/app/b2b/addresses/actions.ts#L1-L200)
- [validated-form.tsx:1-200](file://apps/customer/src/components/b2b/validated-form.tsx#L1-L200)
- [reorder-button.tsx:1-200](file://apps/customer/src/components/b2b/reorder-button.tsx#L1-L200)
- [auth-instance.ts:1-200](file://apps/customer/src/lib/auth-instance.ts#L1-L200)
- [auth.ts:1-200](file://apps/customer/src/lib/auth.ts#L1-L200)
- [middleware.ts:1-200](file://apps/customer/src/middleware.ts#L1-L200)
- [en.json:1-200](file://apps/customer/messages/en.json#L1-L200)

## Architecture Overview
The user account management architecture centers around the customer app’s account routes, NextAuth for authentication, and B2B-specific modules for addresses and reordering. The layout and header components provide navigation and role switching. Stores manage shopping cart and wishlist data. Middleware enforces authentication and localization.

```mermaid
graph TB
Client["Browser"]
Layout["Main Layout<br/>apps/customer/src/components/layout/main-layout.tsx"]
Header["Header & Role Switcher<br/>apps/customer/src/components/layout/header.tsx<br/>apps/customer/src/components/layout/role-switcher.tsx"]
Account["Account Dashboard<br/>apps/customer/src/app/account/page.tsx"]
OrdersList["Orders List<br/>apps/customer/src/app/account/orders/page.tsx"]
OrderDetails["Order Details<br/>apps/customer/src/app/orders/[id]/page.tsx"]
Addresses["Addresses<br/>apps/customer/src/app/b2b/addresses/page.tsx"]
AuthAPI["NextAuth API<br/>apps/customer/src/app/api/auth/[...nextauth]/route.ts"]
AuthLib["Auth Utilities<br/>apps/customer/src/lib/auth.ts"]
AuthInstance["Auth Instance<br/>apps/customer/src/lib/auth-instance.ts"]
Stores["Stores (Cart/Wishlist)<br/>apps/customer/src/stores/cart.ts<br/>apps/customer/src/stores/wishlist.ts"]
Middleware["Middleware<br/>apps/customer/src/middleware.ts"]
Client --> Layout
Layout --> Header
Layout --> Account
Account --> OrdersList
OrdersList --> OrderDetails
Account --> Addresses
Account --> AuthAPI
AuthAPI --> AuthInstance
AuthInstance --> AuthLib
Account --> Stores
Client --> Middleware
```

**Diagram sources**
- [layout.tsx:1-200](file://apps/customer/src/components/layout/main-layout.tsx#L1-L200)
- [header.tsx:1-200](file://apps/customer/src/components/layout/header.tsx#L1-L200)
- [role-switcher.tsx:1-200](file://apps/customer/src/components/layout/role-switcher.tsx#L1-L200)
- [page.tsx:1-200](file://apps/customer/src/app/account/page.tsx#L1-L200)
- [orders/page.tsx:1-200](file://apps/customer/src/app/account/orders/page.tsx#L1-L200)
- [orders/[id]/page.tsx](file://apps/customer/src/app/orders/[id]/page.tsx#L1-L200)
- [addresses/page.tsx:1-200](file://apps/customer/src/app/b2b/addresses/page.tsx#L1-L200)
- [route.ts:1-200](file://apps/customer/src/app/api/auth/[...nextauth]/route.ts#L1-L200)
- [auth.ts:1-200](file://apps/customer/src/lib/auth.ts#L1-L200)
- [auth-instance.ts:1-200](file://apps/customer/src/lib/auth-instance.ts#L1-L200)
- [cart.ts:1-200](file://apps/customer/src/stores/cart.ts#L1-L200)
- [wishlist.ts:1-200](file://apps/customer/src/stores/wishlist.ts#L1-L200)
- [middleware.ts:1-200](file://apps/customer/src/middleware.ts#L1-L200)

## Detailed Component Analysis

### Customer Profile Management Interface
- Purpose: Central hub for managing personal information, preferences, and account security.
- Key areas:
  - Personal information editing: form-based updates with validation.
  - Password change: secure update flow integrated with authentication.
  - Account security: session management and logout controls.
  - Preferences: user preference storage and retrieval.
- Implementation anchors:
  - Dashboard page for account overview.
  - Authentication routes for secure operations.
  - Layout and header for navigation and role switching.

**Section sources**
- [page.tsx:1-200](file://apps/customer/src/app/account/page.tsx#L1-L200)
- [route.ts:1-200](file://apps/customer/src/app/api/auth/[...nextauth]/route.ts#L1-L200)
- [layout.tsx:1-200](file://apps/customer/src/components/layout/main-layout.tsx#L1-L200)
- [header.tsx:1-200](file://apps/customer/src/components/layout/header.tsx#L1-L200)
- [role-switcher.tsx:1-200](file://apps/customer/src/components/layout/role-switcher.tsx#L1-L200)

### Personal Information Editing
- Mechanism: Validated forms for safe updates.
- Validation: Client-side and server-side checks to ensure data integrity.
- Integration: Uses validated form component and backend actions.

```mermaid
sequenceDiagram
participant U as "User"
participant A as "Account Page"
participant VF as "Validated Form Component"
participant AC as "Server Actions"
U->>A : Open edit profile
A->>VF : Render form with current data
U->>VF : Submit edited fields
VF->>VF : Validate inputs
VF->>AC : Call server action to save
AC-->>VF : Return success/error
VF-->>U : Show feedback and update UI
```

**Diagram sources**
- [validated-form.tsx:1-200](file://apps/customer/src/components/b2b/validated-form.tsx#L1-L200)
- [page.tsx:1-200](file://apps/customer/src/app/account/page.tsx#L1-L200)

**Section sources**
- [validated-form.tsx:1-200](file://apps/customer/src/components/b2b/validated-form.tsx#L1-L200)
- [page.tsx:1-200](file://apps/customer/src/app/account/page.tsx#L1-L200)

### Password Change Functionality
- Secure update: Requires authenticated session.
- Flow: Enter current password and new password, submit securely.
- Integration: NextAuth-based authentication and session management.

```mermaid
sequenceDiagram
participant U as "User"
participant AP as "Account Page"
participant AA as "Auth API Route"
participant AI as "Auth Instance"
participant AU as "Auth Utilities"
U->>AP : Open change password
AP->>AA : Submit password change request
AA->>AI : Verify current session
AI->>AU : Validate and update credentials
AU-->>AI : Confirm update
AI-->>AA : Return result
AA-->>AP : Show success/error
AP-->>U : Feedback and redirect if needed
```

**Diagram sources**
- [route.ts:1-200](file://apps/customer/src/app/api/auth/[...nextauth]/route.ts#L1-L200)
- [auth-instance.ts:1-200](file://apps/customer/src/lib/auth-instance.ts#L1-L200)
- [auth.ts:1-200](file://apps/customer/src/lib/auth.ts#L1-L200)

**Section sources**
- [route.ts:1-200](file://apps/customer/src/app/api/auth/[...nextauth]/route.ts#L1-L200)
- [auth-instance.ts:1-200](file://apps/customer/src/lib/auth-instance.ts#L1-L200)
- [auth.ts:1-200](file://apps/customer/src/lib/auth.ts#L1-L200)

### Account Security Features
- Session management: Enforced via middleware and NextAuth.
- Role switching: Allows seamless transitions between customer and B2B roles.
- Logout: Integrated with authentication provider.

```mermaid
flowchart TD
Start(["Access Protected Page"]) --> CheckSession["Check Active Session"]
CheckSession --> HasSession{"Session Valid?"}
HasSession --> |Yes| AllowAccess["Allow Access"]
HasSession --> |No| RedirectLogin["Redirect to Login"]
AllowAccess --> RoleSwitch["Role Switch Available"]
RoleSwitch --> End(["Proceed"])
RedirectLogin --> End
```

**Diagram sources**
- [middleware.ts:1-200](file://apps/customer/src/middleware.ts#L1-L200)
- [role-switcher.tsx:1-200](file://apps/customer/src/components/layout/role-switcher.tsx#L1-L200)
- [login/page.tsx:1-200](file://apps/customer/src/app/login/page.tsx#L1-L200)

**Section sources**
- [middleware.ts:1-200](file://apps/customer/src/middleware.ts#L1-L200)
- [role-switcher.tsx:1-200](file://apps/customer/src/components/layout/role-switcher.tsx#L1-L200)
- [login/page.tsx:1-200](file://apps/customer/src/app/login/page.tsx#L1-L200)

### Order History Display and Tracking
- Order list: Paginated view of past orders with status indicators.
- Status tracking: Real-time status updates via API.
- Sorting and filtering: Optional enhancements for usability.

```mermaid
sequenceDiagram
participant U as "User"
participant OL as "Orders List"
participant OA as "Orders API"
participant OD as "Order Details"
U->>OL : Load orders
OL->>OA : Fetch order list
OA-->>OL : Return orders with statuses
U->>OD : Click order to view details
OD->>OA : Fetch order details
OA-->>OD : Return order items and metadata
OD-->>U : Display details and status
```

**Diagram sources**
- [orders/page.tsx:1-200](file://apps/customer/src/app/account/orders/page.tsx#L1-L200)
- [orders/[id]/page.tsx](file://apps/customer/src/app/orders/[id]/page.tsx#L1-L200)
- [orders/route.ts:1-200](file://apps/customer/src/app/api/orders/route.ts#L1-L200)

**Section sources**
- [orders/page.tsx:1-200](file://apps/customer/src/app/account/orders/page.tsx#L1-L200)
- [orders/[id]/page.tsx](file://apps/customer/src/app/orders/[id]/page.tsx#L1-L200)
- [orders/route.ts:1-200](file://apps/customer/src/app/api/orders/route.ts#L1-L200)

### Order Details Viewing and Reordering
- Details: Items, quantities, pricing, shipping/billing info, status timeline.
- Reorder: One-click re-add items to cart using reorder button component.

```mermaid
sequenceDiagram
participant U as "User"
participant OD as "Order Details"
participant RB as "Reorder Button"
participant API as "Orders API"
participant Cart as "Cart Store"
U->>OD : View order details
OD->>API : Fetch order items
API-->>OD : Return items
U->>RB : Click reorder
RB->>API : Get cart payload
API-->>RB : Return items for cart
RB->>Cart : Add items to cart
RB-->>U : Show success
```

**Diagram sources**
- [orders/[id]/page.tsx](file://apps/customer/src/app/orders/[id]/page.tsx#L1-L200)
- [reorder-button.tsx:1-200](file://apps/customer/src/components/b2b/reorder-button.tsx#L1-L200)
- [orders/route.ts:1-200](file://apps/customer/src/app/api/orders/route.ts#L1-L200)
- [cart.ts:1-200](file://apps/customer/src/stores/cart.ts#L1-L200)

**Section sources**
- [orders/[id]/page.tsx](file://apps/customer/src/app/orders/[id]/page.tsx#L1-L200)
- [reorder-button.tsx:1-200](file://apps/customer/src/components/b2b/reorder-button.tsx#L1-L200)
- [orders/route.ts:1-200](file://apps/customer/src/app/api/orders/route.ts#L1-L200)
- [cart.ts:1-200](file://apps/customer/src/stores/cart.ts#L1-L200)

### Address Book Management and Default Address Selection
- Address management: CRUD operations for multiple addresses.
- Default selection: Set primary shipping/billing address.
- Validation: Ensures required fields and formats.

```mermaid
flowchart TD
Start(["Open Address Book"]) --> List["List Saved Addresses"]
List --> Edit{"Edit Address?"}
Edit --> |Yes| Validate["Validate Address Fields"]
Validate --> Save["Save Address"]
Edit --> |No| Default{"Set Default?"}
Default --> |Yes| MakeDefault["Mark as Default"]
Default --> |No| End(["Done"])
Save --> End
MakeDefault --> End
```

**Diagram sources**
- [addresses/page.tsx:1-200](file://apps/customer/src/app/b2b/addresses/page.tsx#L1-L200)
- [actions.ts:1-200](file://apps/customer/src/app/b2b/addresses/actions.ts#L1-L200)
- [validated-form.tsx:1-200](file://apps/customer/src/components/b2b/validated-form.tsx#L1-L200)

**Section sources**
- [addresses/page.tsx:1-200](file://apps/customer/src/app/b2b/addresses/page.tsx#L1-L200)
- [actions.ts:1-200](file://apps/customer/src/app/b2b/addresses/actions.ts#L1-L200)
- [validated-form.tsx:1-200](file://apps/customer/src/components/b2b/validated-form.tsx#L1-L200)

### Shipping and Billing Address Handling
- Separate fields for shipping and billing.
- Copy shipping to billing option.
- Validation ensures completeness and correctness.

**Section sources**
- [addresses/page.tsx:1-200](file://apps/customer/src/app/b2b/addresses/page.tsx#L1-L200)
- [validated-form.tsx:1-200](file://apps/customer/src/components/b2b/validated-form.tsx#L1-L200)

### Authentication Integration and Session Management
- NextAuth integration: Handles OAuth, callbacks, and session persistence.
- Login/Register: Dedicated pages with provider-based authentication.
- Session enforcement: Middleware validates access to protected routes.

```mermaid
sequenceDiagram
participant U as "User"
participant LP as "Login Page"
participant RP as "Register Page"
participant NA as "NextAuth API"
participant MI as "Middleware"
U->>LP : Navigate to login
LP->>NA : Submit credentials
NA-->>LP : Return session
LP-->>U : Redirect to account
U->>RP : Navigate to register
RP->>NA : Submit registration
NA-->>RP : Return session
RP-->>U : Redirect to account
U->>MI : Access protected page
MI->>NA : Verify session
NA-->>MI : Session valid/invalid
MI-->>U : Grant/deny access
```

**Diagram sources**
- [login/page.tsx:1-200](file://apps/customer/src/app/login/page.tsx#L1-L200)
- [register/page.tsx:1-200](file://apps/customer/src/app/register/page.tsx#L1-L200)
- [route.ts:1-200](file://apps/customer/src/app/api/auth/[...nextauth]/route.ts#L1-L200)
- [middleware.ts:1-200](file://apps/customer/src/middleware.ts#L1-L200)

**Section sources**
- [login/page.tsx:1-200](file://apps/customer/src/app/login/page.tsx#L1-L200)
- [register/page.tsx:1-200](file://apps/customer/src/app/register/page.tsx#L1-L200)
- [route.ts:1-200](file://apps/customer/src/app/api/auth/[...nextauth]/route.ts#L1-L200)
- [middleware.ts:1-200](file://apps/customer/src/middleware.ts#L1-L200)

### User Preference Storage
- Preferences: Stored per user session and persisted via backend.
- Retrieval: Loaded on account page initialization.
- Stores: Cart and wishlist maintained client-side for convenience.

**Section sources**
- [page.tsx:1-200](file://apps/customer/src/app/account/page.tsx#L1-L200)
- [cart.ts:1-200](file://apps/customer/src/stores/cart.ts#L1-L200)
- [wishlist.ts:1-200](file://apps/customer/src/stores/wishlist.ts#L1-L200)

### GDPR Compliance Considerations
- Data handling: Middleware and localized messaging support privacy controls.
- Localization: Messages and consent flows localized for regions.
- Consent and transparency: UI surfaces consent and data usage information.

**Section sources**
- [middleware.ts:1-200](file://apps/customer/src/middleware.ts#L1-L200)
- [en.json:1-200](file://apps/customer/messages/en.json#L1-L200)
- [request.ts:1-200](file://apps/customer/src/i18n/request.ts#L1-L200)

## Dependency Analysis
The account management features depend on authentication, routing, stores, and UI components. The diagram below outlines key dependencies.

```mermaid
graph TB
Account["Account Page"] --> OrdersList["Orders List"]
Account --> Addresses["Addresses"]
Account --> AuthAPI["Auth API"]
OrdersList --> OrderDetails["Order Details"]
OrderDetails --> Reorder["Reorder Button"]
Addresses --> ValidatedForm["Validated Form"]
Account --> Stores["Cart/Wishlist"]
Account --> Layout["Layout/Header"]
AuthAPI --> AuthInstance["Auth Instance"]
AuthInstance --> AuthUtils["Auth Utils"]
Account --> Middleware["Middleware"]
Account --> I18N["i18n Request"]
Account --> Messages["Messages EN"]
```

**Diagram sources**
- [page.tsx:1-200](file://apps/customer/src/app/account/page.tsx#L1-L200)
- [orders/page.tsx:1-200](file://apps/customer/src/app/account/orders/page.tsx#L1-L200)
- [orders/[id]/page.tsx](file://apps/customer/src/app/orders/[id]/page.tsx#L1-L200)
- [addresses/page.tsx:1-200](file://apps/customer/src/app/b2b/addresses/page.tsx#L1-L200)
- [actions.ts:1-200](file://apps/customer/src/app/b2b/addresses/actions.ts#L1-L200)
- [validated-form.tsx:1-200](file://apps/customer/src/components/b2b/validated-form.tsx#L1-L200)
- [reorder-button.tsx:1-200](file://apps/customer/src/components/b2b/reorder-button.tsx#L1-L200)
- [route.ts:1-200](file://apps/customer/src/app/api/auth/[...nextauth]/route.ts#L1-L200)
- [auth-instance.ts:1-200](file://apps/customer/src/lib/auth-instance.ts#L1-L200)
- [auth.ts:1-200](file://apps/customer/src/lib/auth.ts#L1-L200)
- [layout.tsx:1-200](file://apps/customer/src/components/layout/main-layout.tsx#L1-L200)
- [header.tsx:1-200](file://apps/customer/src/components/layout/header.tsx#L1-L200)
- [middleware.ts:1-200](file://apps/customer/src/middleware.ts#L1-L200)
- [request.ts:1-200](file://apps/customer/src/i18n/request.ts#L1-L200)
- [en.json:1-200](file://apps/customer/messages/en.json#L1-L200)

**Section sources**
- [page.tsx:1-200](file://apps/customer/src/app/account/page.tsx#L1-L200)
- [orders/page.tsx:1-200](file://apps/customer/src/app/account/orders/page.tsx#L1-L200)
- [orders/[id]/page.tsx](file://apps/customer/src/app/orders/[id]/page.tsx#L1-L200)
- [addresses/page.tsx:1-200](file://apps/customer/src/app/b2b/addresses/page.tsx#L1-L200)
- [actions.ts:1-200](file://apps/customer/src/app/b2b/addresses/actions.ts#L1-L200)
- [validated-form.tsx:1-200](file://apps/customer/src/components/b2b/validated-form.tsx#L1-L200)
- [reorder-button.tsx:1-200](file://apps/customer/src/components/b2b/reorder-button.tsx#L1-L200)
- [route.ts:1-200](file://apps/customer/src/app/api/auth/[...nextauth]/route.ts#L1-L200)
- [auth-instance.ts:1-200](file://apps/customer/src/lib/auth-instance.ts#L1-L200)
- [auth.ts:1-200](file://apps/customer/src/lib/auth.ts#L1-L200)
- [layout.tsx:1-200](file://apps/customer/src/components/layout/main-layout.tsx#L1-L200)
- [header.tsx:1-200](file://apps/customer/src/components/layout/header.tsx#L1-L200)
- [middleware.ts:1-200](file://apps/customer/src/middleware.ts#L1-L200)
- [request.ts:1-200](file://apps/customer/src/i18n/request.ts#L1-L200)
- [en.json:1-200](file://apps/customer/messages/en.json#L1-L200)

## Performance Considerations
- Minimize re-renders: Use server actions and client components judiciously.
- Lazy loading: Defer heavy components until needed.
- Caching: Utilize browser caching for static assets and API responses where appropriate.
- Store synchronization: Keep cart and wishlist stores in sync with backend to avoid stale data.

## Troubleshooting Guide
- Authentication failures: Verify NextAuth configuration and callback URLs.
- Session issues: Check middleware and cookie settings.
- Form validation errors: Ensure validated form component handles all required fields.
- Order retrieval problems: Confirm API routes return proper status codes and data.
- Address management errors: Validate server actions and error handling.

**Section sources**
- [route.ts:1-200](file://apps/customer/src/app/api/auth/[...nextauth]/route.ts#L1-L200)
- [middleware.ts:1-200](file://apps/customer/src/middleware.ts#L1-L200)
- [validated-form.tsx:1-200](file://apps/customer/src/components/b2b/validated-form.tsx#L1-L200)
- [orders/route.ts:1-200](file://apps/customer/src/app/api/orders/route.ts#L1-L200)
- [actions.ts:1-200](file://apps/customer/src/app/b2b/addresses/actions.ts#L1-L200)

## Conclusion
The User Account Management system integrates authentication, order management, and address handling within a cohesive customer experience. It leverages NextAuth for secure sessions, validated forms for safe data entry, and reusable components for consistent UX. Middleware and localization support robust security and compliance. The architecture supports scalability and maintainability while ensuring a smooth user journey from profile management to order fulfillment.

## Appendices
- Additional resources: Email utilities for notifications, stores for cart and wishlist, and internationalization for localized experiences.

**Section sources**
- [email.ts:1-200](file://apps/customer/src/lib/email.ts#L1-L200)
- [cart.ts:1-200](file://apps/customer/src/stores/cart.ts#L1-L200)
- [wishlist.ts:1-200](file://apps/customer/src/stores/wishlist.ts#L1-L200)
- [request.ts:1-200](file://apps/customer/src/i18n/request.ts#L1-L200)
- [en.json:1-200](file://apps/customer/messages/en.json#L1-L200)