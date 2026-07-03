# B2B State Management Patterns

<cite>
**Referenced Files in This Document**
- [b2b-shell.tsx](file://apps/customer/src/components/b2b/b2b-shell.tsx)
- [b2b.ts](file://apps/customer/src/lib/b2b.ts)
- [layout.tsx](file://apps/customer/src/app/layout.tsx)
- [header.tsx](file://apps/customer/src/components/layout/header.tsx)
- [role-switcher.tsx](file://apps/customer/src/components/layout/role-switcher.tsx)
- [company page.tsx](file://apps/customer/src/app/b2b/company/page.tsx)
- [team page.tsx](file://apps/customer/src/app/b2b/team/page.tsx)
- [team actions.ts](file://apps/customer/src/app/b2b/team/actions.ts)
- [purchase-orders page.tsx](file://apps/customer/src/app/b2b/purchase-orders/page.tsx)
- [purchase-orders actions.ts](file://apps/customer/src/app/b2b/purchase-orders/actions.ts)
- [quotes page.tsx](file://apps/customer/src/app/b2b/quotes/page.tsx)
- [rfq page.tsx](file://apps/customer/src/app/b2b/rfq/[id]/page.tsx)
- [rfq new page.tsx](file://apps/customer/src/app/b2b/rfq/new/page.tsx)
- [approval-policies page.tsx](file://apps/customer/src/app/b2b/approval-policies/page.tsx)
- [approval-policies actions.ts](file://apps/customer/src/app/b2b/approval-policies/actions.ts)
- [approvals page.tsx](file://apps/customer/src/app/b2b/approvals/page.tsx)
- [admin-layout.tsx](file://apps/admin/src/app/components/layout/admin-layout.tsx)
- [admin dashboard route.ts](file://apps/admin/src/app/api/admin/dashboard/route.ts)
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
This document explains B2B state management patterns in Avenick Commerce, focusing on the B2B shell component architecture, company context handling, and team management state coordination. It details how customer and business contexts synchronize, including company switching, role-based state filtering, and approval workflow state management. The guide also covers state patterns for purchase orders, quoting systems, and team collaboration, with practical examples for implementing company context providers, managing business-specific state updates, and coordinating state across multiple B2B workflows. Guidance on state isolation, context switching, and data consistency in multi-user B2B environments is included.

## Project Structure
The B2B state management spans the customer application’s B2B module, shared layout components, and supporting libraries. Key areas include:
- B2B shell wrapper and context provider
- Company context and role switching
- Team management and collaboration
- Purchase orders and quoting workflows
- Approval policies and approvals

```mermaid
graph TB
subgraph "Customer App"
L["layout.tsx"]
HS["header.tsx"]
RS["role-switcher.tsx"]
BS["b2b-shell.tsx"]
CP["company page.tsx"]
TP["team page.tsx"]
TAs["team actions.ts"]
POP["purchase-orders page.tsx"]
POAs["purchase-orders actions.ts"]
QP["quotes page.tsx"]
RFP["rfq/[id] page.tsx"]
RFN["rfq/new page.tsx"]
APPP["approval-policies page.tsx"]
APAs["approval-policies actions.ts"]
APV["approvals page.tsx"]
end
subgraph "Admin App"
AL["admin-layout.tsx"]
AD["admin dashboard route.ts"]
end
L --> HS
HS --> RS
HS --> BS
BS --> CP
BS --> TP
TP --> TAs
BS --> POP
POP --> POAs
BS --> QP
BS --> RFP
BS --> RFN
BS --> APPP
APPP --> APAs
BS --> APV
AL --> AD
```

**Diagram sources**
- [layout.tsx:1-200](file://apps/customer/src/app/layout.tsx#L1-L200)
- [header.tsx:1-200](file://apps/customer/src/components/layout/header.tsx#L1-L200)
- [role-switcher.tsx:1-200](file://apps/customer/src/components/layout/role-switcher.tsx#L1-L200)
- [b2b-shell.tsx:1-200](file://apps/customer/src/components/b2b/b2b-shell.tsx#L1-L200)
- [company page.tsx:1-200](file://apps/customer/src/app/b2b/company/page.tsx#L1-L200)
- [team page.tsx:1-200](file://apps/customer/src/app/b2b/team/page.tsx#L1-L200)
- [team actions.ts:1-200](file://apps/customer/src/app/b2b/team/actions.ts#L1-L200)
- [purchase-orders page.tsx:1-200](file://apps/customer/src/app/b2b/purchase-orders/page.tsx#L1-L200)
- [purchase-orders actions.ts:1-200](file://apps/customer/src/app/b2b/purchase-orders/actions.ts#L1-L200)
- [quotes page.tsx:1-200](file://apps/customer/src/app/b2b/quotes/page.tsx#L1-L200)
- [rfq page.tsx:1-200](file://apps/customer/src/app/b2b/rfq/[id]/page.tsx#L1-L200)
- [rfq new page.tsx:1-200](file://apps/customer/src/app/b2b/rfq/new/page.tsx#L1-L200)
- [approval-policies page.tsx:1-200](file://apps/customer/src/app/b2b/approval-policies/page.tsx#L1-L200)
- [approval-policies actions.ts:1-200](file://apps/customer/src/app/b2b/approval-policies/actions.ts#L1-L200)
- [approvals page.tsx:1-200](file://apps/customer/src/app/b2b/approvals/page.tsx#L1-L200)
- [admin-layout.tsx:1-200](file://apps/admin/src/app/components/layout/admin-layout.tsx#L1-L200)
- [admin dashboard route.ts:1-200](file://apps/admin/src/app/api/admin/dashboard/route.ts#L1-L200)

**Section sources**
- [layout.tsx:1-200](file://apps/customer/src/app/layout.tsx#L1-L200)
- [b2b-shell.tsx:1-200](file://apps/customer/src/components/b2b/b2b-shell.tsx#L1-L200)

## Core Components
- B2B Shell: Wraps B2B pages with context providers and navigation, enabling company and role-aware rendering.
- Company Context Provider: Manages current company selection and related state for business workflows.
- Role Switcher: Enables switching roles within a company context, driving role-based state filtering.
- Team Management: Provides state coordination for team members, permissions, and collaboration.
- Purchase Orders: Centralized state for PO creation, updates, and synchronization with supplier workflows.
- Quoting and RFQ: State handling for quote requests, submissions, and approvals.
- Approvals: Workflow state management for policy-driven approvals across purchase orders and RFQs.

**Section sources**
- [b2b-shell.tsx:1-200](file://apps/customer/src/components/b2b/b2b-shell.tsx#L1-L200)
- [b2b.ts:1-200](file://apps/customer/src/lib/b2b.ts#L1-L200)
- [role-switcher.tsx:1-200](file://apps/customer/src/components/layout/role-switcher.tsx#L1-L200)
- [team page.tsx:1-200](file://apps/customer/src/app/b2b/team/page.tsx#L1-L200)
- [team actions.ts:1-200](file://apps/customer/src/app/b2b/team/actions.ts#L1-L200)
- [purchase-orders page.tsx:1-200](file://apps/customer/src/app/b2b/purchase-orders/page.tsx#L1-L200)
- [purchase-orders actions.ts:1-200](file://apps/customer/src/app/b2b/purchase-orders/actions.ts#L1-L200)
- [quotes page.tsx:1-200](file://apps/customer/src/app/b2b/quotes/page.tsx#L1-L200)
- [rfq page.tsx:1-200](file://apps/customer/src/app/b2b/rfq/[id]/page.tsx#L1-L200)
- [rfq new page.tsx:1-200](file://apps/customer/src/app/b2b/rfq/new/page.tsx#L1-L200)
- [approval-policies page.tsx:1-200](file://apps/customer/src/app/b2b/approval-policies/page.tsx#L1-L200)
- [approval-policies actions.ts:1-200](file://apps/customer/src/app/b2b/approval-policies/actions.ts#L1-L200)
- [approvals page.tsx:1-200](file://apps/customer/src/app/b2b/approvals/page.tsx#L1-L200)

## Architecture Overview
The B2B state architecture centers on a shell component that injects company and role context into B2B pages. Navigation and state updates flow through action handlers and shared utilities. Admin dashboards coordinate cross-application visibility for compliance and approvals.

```mermaid
graph TB
subgraph "Context Layer"
BC["Company Context Provider"]
RC["Role Context Provider"]
end
subgraph "UI Layer"
SH["B2B Shell"]
HD["Header"]
RS["Role Switcher"]
NAV["Navigation"]
end
subgraph "Domain Workflows"
TM["Team Management"]
PO["Purchase Orders"]
QT["Quotes & RFQ"]
AP["Approvals"]
end
subgraph "Admin Layer"
AL["Admin Layout"]
AD["Admin Dashboard API"]
end
BC --> SH
RC --> SH
SH --> HD
HD --> RS
HD --> NAV
SH --> TM
SH --> PO
SH --> QT
SH --> AP
AL --> AD
```

**Diagram sources**
- [b2b-shell.tsx:1-200](file://apps/customer/src/components/b2b/b2b-shell.tsx#L1-L200)
- [header.tsx:1-200](file://apps/customer/src/components/layout/header.tsx#L1-L200)
- [role-switcher.tsx:1-200](file://apps/customer/src/components/layout/role-switcher.tsx#L1-L200)
- [admin-layout.tsx:1-200](file://apps/admin/src/app/components/layout/admin-layout.tsx#L1-L200)
- [admin dashboard route.ts:1-200](file://apps/admin/src/app/api/admin/dashboard/route.ts#L1-L200)

## Detailed Component Analysis

### B2B Shell Component Architecture
The B2B shell acts as a context provider and layout wrapper for B2B pages. It ensures consistent navigation, role-aware rendering, and access to company context across all B2B features.

Key responsibilities:
- Inject company and role context providers
- Render header with role switcher and navigation
- Gate access to B2B routes based on authentication and company context
- Coordinate state updates for team, purchase orders, quotes, and approvals

```mermaid
classDiagram
class B2BShell {
+render() void
+provideCompanyContext(company) void
+provideRoleContext(role) void
+navigateTo(path) void
+requireAuth() boolean
}
class Header {
+render() void
+showRoleSwitcher() void
+showNotifications() void
}
class RoleSwitcher {
+switchRole(newRole) void
+getCurrentRole() string
+getAvailableRoles() string[]
}
B2BShell --> Header : "renders"
Header --> RoleSwitcher : "uses"
```

**Diagram sources**
- [b2b-shell.tsx:1-200](file://apps/customer/src/components/b2b/b2b-shell.tsx#L1-L200)
- [header.tsx:1-200](file://apps/customer/src/components/layout/header.tsx#L1-L200)
- [role-switcher.tsx:1-200](file://apps/customer/src/components/layout/role-switcher.tsx#L1-L200)

**Section sources**
- [b2b-shell.tsx:1-200](file://apps/customer/src/components/b2b/b2b-shell.tsx#L1-L200)
- [header.tsx:1-200](file://apps/customer/src/components/layout/header.tsx#L1-L200)
- [role-switcher.tsx:1-200](file://apps/customer/src/components/layout/role-switcher.tsx#L1-L200)

### Company Context Handling
Company context drives state isolation and filtering across B2B features. The company page coordinates selection and persistence, while the B2B shell consumes this context to tailor UI and workflows.

```mermaid
sequenceDiagram
participant U as "User"
participant C as "Company Page"
participant S as "B2B Shell"
participant ST as "State Store"
U->>C : "Select company"
C->>ST : "Set company context"
ST-->>S : "Notify context change"
S->>S : "Re-render with company filters"
S-->>U : "Updated UI reflecting company state"
```

**Diagram sources**
- [company page.tsx:1-200](file://apps/customer/src/app/b2b/company/page.tsx#L1-L200)
- [b2b-shell.tsx:1-200](file://apps/customer/src/components/b2b/b2b-shell.tsx#L1-L200)

**Section sources**
- [company page.tsx:1-200](file://apps/customer/src/app/b2b/company/page.tsx#L1-L200)
- [b2b-shell.tsx:1-200](file://apps/customer/src/components/b2b/b2b-shell.tsx#L1-L200)

### Team Management State Coordination
Team management coordinates member states, permissions, and collaboration. Actions encapsulate mutations, while the page renders filtered views based on role and company context.

```mermaid
sequenceDiagram
participant U as "User"
participant TP as "Team Page"
participant TA as "Team Actions"
participant ST as "State Store"
U->>TP : "Open team management"
TP->>ST : "Load team members"
ST-->>TP : "Return filtered members"
U->>TA : "Add/remove/update member"
TA->>ST : "Apply mutation"
ST-->>TP : "Notify state update"
TP-->>U : "Refreshed team view"
```

**Diagram sources**
- [team page.tsx:1-200](file://apps/customer/src/app/b2b/team/page.tsx#L1-L200)
- [team actions.ts:1-200](file://apps/customer/src/app/b2b/team/actions.ts#L1-L200)

**Section sources**
- [team page.tsx:1-200](file://apps/customer/src/app/b2b/team/page.tsx#L1-L200)
- [team actions.ts:1-200](file://apps/customer/src/app/b2b/team/actions.ts#L1-L200)

### Purchase Orders State Management
Purchase order state is synchronized across customer and supplier contexts. Actions handle creation, updates, and approval transitions, while the page renders PO lists and details filtered by company and role.

```mermaid
sequenceDiagram
participant U as "User"
participant POP as "PO Page"
participant POAs as "PO Actions"
participant ST as "State Store"
participant AD as "Admin Dashboard API"
U->>POP : "View PO list"
POP->>ST : "Fetch POs for company"
ST-->>POP : "Return PO list"
U->>POAs : "Create/Update PO"
POAs->>ST : "Persist PO state"
ST-->>AD : "Emit PO event"
AD-->>ST : "Acknowledge"
ST-->>POP : "Notify update"
POP-->>U : "Refreshed PO view"
```

**Diagram sources**
- [purchase-orders page.tsx:1-200](file://apps/customer/src/app/b2b/purchase-orders/page.tsx#L1-L200)
- [purchase-orders actions.ts:1-200](file://apps/customer/src/app/b2b/purchase-orders/actions.ts#L1-L200)
- [admin dashboard route.ts:1-200](file://apps/admin/src/app/api/admin/dashboard/route.ts#L1-L200)

**Section sources**
- [purchase-orders page.tsx:1-200](file://apps/customer/src/app/b2b/purchase-orders/page.tsx#L1-L200)
- [purchase-orders actions.ts:1-200](file://apps/customer/src/app/b2b/purchase-orders/actions.ts#L1-L200)
- [admin dashboard route.ts:1-200](file://apps/admin/src/app/api/admin/dashboard/route.ts#L1-L200)

### Quoting Systems and RFQ State
RFQ and quoting workflows manage request states, submissions, and approvals. The system filters states by company and role, ensuring appropriate visibility and actions.

```mermaid
sequenceDiagram
participant U as "User"
participant RFQN as "RFQ New Page"
participant RFQP as "RFQ [id] Page"
participant QP as "Quotes Page"
participant APs as "Approval Policies"
participant ST as "State Store"
U->>RFQN : "Create RFQ"
RFQN->>ST : "Save draft RFQ"
U->>RFQP : "Submit RFQ"
RFQP->>ST : "Transition to submitted"
ST-->>QP : "Show relevant quotes"
U->>APs : "Configure approval policy"
APs->>ST : "Update policy rules"
ST-->>RFQP : "Apply policy filter"
RFQP-->>U : "Filtered RFQ view"
```

**Diagram sources**
- [rfq new page.tsx:1-200](file://apps/customer/src/app/b2b/rfq/new/page.tsx#L1-L200)
- [rfq page.tsx:1-200](file://apps/customer/src/app/b2b/rfq/[id]/page.tsx#L1-L200)
- [quotes page.tsx:1-200](file://apps/customer/src/app/b2b/quotes/page.tsx#L1-L200)
- [approval-policies actions.ts:1-200](file://apps/customer/src/app/b2b/approval-policies/actions.ts#L1-L200)

**Section sources**
- [rfq new page.tsx:1-200](file://apps/customer/src/app/b2b/rfq/new/page.tsx#L1-L200)
- [rfq page.tsx:1-200](file://apps/customer/src/app/b2b/rfq/[id]/page.tsx#L1-L200)
- [quotes page.tsx:1-200](file://apps/customer/src/app/b2b/quotes/page.tsx#L1-L200)
- [approval-policies actions.ts:1-200](file://apps/customer/src/app/b2b/approval-policies/actions.ts#L1-L200)

### Approval Workflow State Management
Approvals integrate with company and role contexts to enforce policy-driven transitions. The approvals page aggregates actionable items filtered by current context.

```mermaid
flowchart TD
Start(["Approval Workflow Entry"]) --> Load["Load company and role context"]
Load --> Fetch["Fetch pending approvals"]
Fetch --> Filter{"Filter by policy"}
Filter --> |Approved| Apply["Apply approval"]
Filter --> |Rejected| Reject["Reject with reason"]
Apply --> Notify["Notify stakeholders"]
Reject --> Notify
Notify --> End(["Workflow Complete"])
```

**Diagram sources**
- [approvals page.tsx:1-200](file://apps/customer/src/app/b2b/approvals/page.tsx#L1-L200)
- [approval-policies page.tsx:1-200](file://apps/customer/src/app/b2b/approval-policies/page.tsx#L1-L200)

**Section sources**
- [approvals page.tsx:1-200](file://apps/customer/src/app/b2b/approvals/page.tsx#L1-L200)
- [approval-policies page.tsx:1-200](file://apps/customer/src/app/b2b/approval-policies/page.tsx#L1-L200)

### Conceptual Overview
The B2B state model emphasizes:
- Context isolation per company and role
- Event-driven state updates via actions
- Policy-driven filtering for approvals
- Cross-application admin visibility for oversight

```mermaid
graph TB
CC["Company Context"] --> IS["Isolation"]
RC["Role Context"] --> FS["Filtering"]
AC["Action Handlers"] --> UP["Updates"]
POL["Approval Policies"] --> FIL["Policy Filtering"]
ADM["Admin Dashboard"] --> OBS["Observability"]
IS --> UP
FS --> UP
FIL --> UP
UP --> OBS
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

[No sources needed since this section doesn't analyze specific source files]

## Dependency Analysis
B2B state management depends on:
- Shared layout components for consistent navigation and role switching
- Action modules for domain-specific mutations
- Admin APIs for cross-application observability
- Context providers for company and role scoping

```mermaid
graph TB
BS["B2B Shell"] --> HS["Header"]
HS --> RS["Role Switcher"]
BS --> TP["Team Page"]
TP --> TAs["Team Actions"]
BS --> POP["Purchase Orders Page"]
POP --> POAs["Purchase Orders Actions"]
BS --> QT["Quotes & RFQ Pages"]
BS --> AP["Approvals Page"]
AP --> APAs["Approval Policies Actions"]
AL["Admin Layout"] --> AD["Admin Dashboard API"]
```

**Diagram sources**
- [b2b-shell.tsx:1-200](file://apps/customer/src/components/b2b/b2b-shell.tsx#L1-L200)
- [header.tsx:1-200](file://apps/customer/src/components/layout/header.tsx#L1-L200)
- [role-switcher.tsx:1-200](file://apps/customer/src/components/layout/role-switcher.tsx#L1-L200)
- [team page.tsx:1-200](file://apps/customer/src/app/b2b/team/page.tsx#L1-L200)
- [team actions.ts:1-200](file://apps/customer/src/app/b2b/team/actions.ts#L1-L200)
- [purchase-orders page.tsx:1-200](file://apps/customer/src/app/b2b/purchase-orders/page.tsx#L1-L200)
- [purchase-orders actions.ts:1-200](file://apps/customer/src/app/b2b/purchase-orders/actions.ts#L1-L200)
- [quotes page.tsx:1-200](file://apps/customer/src/app/b2b/quotes/page.tsx#L1-L200)
- [rfq page.tsx:1-200](file://apps/customer/src/app/b2b/rfq/[id]/page.tsx#L1-L200)
- [rfq new page.tsx:1-200](file://apps/customer/src/app/b2b/rfq/new/page.tsx#L1-L200)
- [approvals page.tsx:1-200](file://apps/customer/src/app/b2b/approvals/page.tsx#L1-L200)
- [approval-policies actions.ts:1-200](file://apps/customer/src/app/b2b/approval-policies/actions.ts#L1-L200)
- [admin-layout.tsx:1-200](file://apps/admin/src/app/components/layout/admin-layout.tsx#L1-L200)
- [admin dashboard route.ts:1-200](file://apps/admin/src/app/api/admin/dashboard/route.ts#L1-L200)

**Section sources**
- [b2b-shell.tsx:1-200](file://apps/customer/src/components/b2b/b2b-shell.tsx#L1-L200)
- [header.tsx:1-200](file://apps/customer/src/components/layout/header.tsx#L1-L200)
- [role-switcher.tsx:1-200](file://apps/customer/src/components/layout/role-switcher.tsx#L1-L200)
- [team page.tsx:1-200](file://apps/customer/src/app/b2b/team/page.tsx#L1-L200)
- [team actions.ts:1-200](file://apps/customer/src/app/b2b/team/actions.ts#L1-L200)
- [purchase-orders page.tsx:1-200](file://apps/customer/src/app/b2b/purchase-orders/page.tsx#L1-L200)
- [purchase-orders actions.ts:1-200](file://apps/customer/src/app/b2b/purchase-orders/actions.ts#L1-L200)
- [quotes page.tsx:1-200](file://apps/customer/src/app/b2b/quotes/page.tsx#L1-L200)
- [rfq page.tsx:1-200](file://apps/customer/src/app/b2b/rfq/[id]/page.tsx#L1-L200)
- [rfq new page.tsx:1-200](file://apps/customer/src/app/b2b/rfq/new/page.tsx#L1-L200)
- [approvals page.tsx:1-200](file://apps/customer/src/app/b2b/approvals/page.tsx#L1-L200)
- [approval-policies actions.ts:1-200](file://apps/customer/src/app/b2b/approval-policies/actions.ts#L1-L200)
- [admin-layout.tsx:1-200](file://apps/admin/src/app/components/layout/admin-layout.tsx#L1-L200)
- [admin dashboard route.ts:1-200](file://apps/admin/src/app/api/admin/dashboard/route.ts#L1-L200)

## Performance Considerations
- Minimize re-renders by scoping state updates to affected components within the B2B shell.
- Use selective fetching and caching for company-specific data to reduce network overhead.
- Debounce frequent actions (e.g., team member updates) to avoid redundant state transitions.
- Leverage role-based filtering client-side to reduce server load and improve responsiveness.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Company context not persisting: Verify the company context provider is initialized early in the shell and that state updates are dispatched after context selection.
- Role-based UI not updating: Ensure the role switcher triggers context refresh and that dependent components subscribe to role changes.
- Approval state inconsistencies: Confirm approval policy actions are applied before state transitions and that admin dashboard events are acknowledged before rendering updated states.
- Team state desynchronization: Validate that team actions are idempotent and that state updates are batched to prevent race conditions.

**Section sources**
- [b2b-shell.tsx:1-200](file://apps/customer/src/components/b2b/b2b-shell.tsx#L1-L200)
- [role-switcher.tsx:1-200](file://apps/customer/src/components/layout/role-switcher.tsx#L1-L200)
- [team actions.ts:1-200](file://apps/customer/src/app/b2b/team/actions.ts#L1-L200)
- [approval-policies actions.ts:1-200](file://apps/customer/src/app/b2b/approval-policies/actions.ts#L1-L200)

## Conclusion
Avenick Commerce implements robust B2B state management through a shell-based architecture that isolates company and role contexts, synchronizes state across workflows, and integrates with admin oversight. By following the patterns outlined—context providers, action-driven updates, policy-based filtering, and coordinated admin visibility—teams can maintain consistency and scalability in multi-user B2B environments.