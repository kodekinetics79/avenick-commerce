# Inter-Application Communication

<cite>
**Referenced Files in This Document**
- [config.ts](file://packages/auth/src/config.ts)
- [index.ts](file://packages/auth/src/index.ts)
- [middleware.ts](file://packages/auth/src/middleware.ts)
- [auth-instance.ts](file://apps/admin/src/lib/auth-instance.ts)
- [auth-instance.ts](file://apps/customer/src/lib/auth-instance.ts)
- [auth-instance.ts](file://apps/seller/src/lib/auth-instance.ts)
- [admin route.ts](file://apps/admin/src/app/api/auth/[...nextauth]/route.ts)
- [customer route.ts](file://apps/customer/src/app/api/auth/[...nextauth]/route.ts)
- [seller route.ts](file://apps/seller/src/app/api/auth/[...nextauth]/route.ts)
- [admin middleware.ts](file://apps/admin/src/middleware.ts)
- [customer middleware.ts](file://apps/customer/src/middleware.ts)
- [seller middleware.ts](file://apps/seller/src/middleware.ts)
- [admin layout.tsx](file://apps/admin/src/components/layout/admin-layout.tsx)
- [customer role-switcher.tsx](file://apps/customer/src/components/layout/role-switcher.tsx)
- [admin dashboard-view.tsx](file://apps/admin/src/app/dashboard/dashboard-view.tsx)
- [customer page.tsx](file://apps/customer/src/app/account/page.tsx)
- [seller page.tsx](file://apps/seller/src/app/dashboard/page.tsx)
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
This document describes the inter-application communication architecture and shared authentication system across three portals: Admin, Customer, and Seller. It explains the centralized authentication implementation using NextAuth.js, the role-based access control (RBAC) model, middleware patterns, session management, shared authentication guards, token-based flows, and cross-application user context management. It also covers inter-application data sharing patterns, API communication protocols, state synchronization mechanisms, middleware configuration per portal, authentication flow coordination, and security considerations. Finally, it addresses user experience continuity, navigation patterns, and seamless role transitions between applications.

## Project Structure
The solution is organized as a monorepo with three Next.js applications under apps/, each exposing its own authentication endpoints and middleware. A shared authentication package under packages/auth provides the centralized NextAuth.js configuration, guards, and middleware utilities. Each portal exposes a NextAuth-compatible API route that delegates to a shared handlers instance.

```mermaid
graph TB
subgraph "Shared Authentication Package"
PkgAuth["packages/auth<br/>NextAuth Config + Guards + Middleware"]
end
subgraph "Admin Portal"
AdminApp["apps/admin<br/>Next.js App"]
AdminAuthRoute["apps/admin/src/app/api/auth/[...nextauth]/route.ts"]
AdminMiddleware["apps/admin/src/middleware.ts"]
AdminLibAuth["apps/admin/src/lib/auth-instance.ts"]
end
subgraph "Customer Portal"
CustomerApp["apps/customer<br/>Next.js App"]
CustomerAuthRoute["apps/customer/src/app/api/auth/[...nextauth]/route.ts"]
CustomerMiddleware["apps/customer/src/middleware.ts"]
CustomerLibAuth["apps/customer/src/lib/auth-instance.ts"]
end
subgraph "Seller Portal"
SellerApp["apps/seller<br/>Next.js App"]
SellerAuthRoute["apps/seller/src/app/api/auth/[...nextauth]/route.ts"]
SellerMiddleware["apps/seller/src/middleware.ts"]
SellerLibAuth["apps/seller/src/lib/auth-instance.ts"]
end
PkgAuth --> AdminLibAuth
PkgAuth --> CustomerLibAuth
PkgAuth --> SellerLibAuth
AdminLibAuth --> AdminAuthRoute
CustomerLibAuth --> CustomerAuthRoute
SellerLibAuth --> SellerAuthRoute
AdminAuthRoute --> PkgAuth
CustomerAuthRoute --> PkgAuth
SellerAuthRoute --> PkgAuth
AdminMiddleware --> PkgAuth
CustomerMiddleware --> PkgAuth
SellerMiddleware --> PkgAuth
```

**Diagram sources**
- [config.ts:88-93](file://packages/auth/src/config.ts#L88-L93)
- [admin route.ts:1-3](file://apps/admin/src/app/api/auth/[...nextauth]/route.ts#L1-L3)
- [customer route.ts:1-3](file://apps/customer/src/app/api/auth/[...nextauth]/route.ts#L1-L3)
- [seller route.ts:1-3](file://apps/seller/src/app/api/auth/[...nextauth]/route.ts#L1-L3)
- [admin middleware.ts](file://apps/admin/src/middleware.ts)
- [customer middleware.ts](file://apps/customer/src/middleware.ts)
- [seller middleware.ts](file://apps/seller/src/middleware.ts)

**Section sources**
- [config.ts:57-85](file://packages/auth/src/config.ts#L57-L85)
- [index.ts:1-3](file://packages/auth/src/index.ts#L1-L3)

## Core Components
- Centralized NextAuth.js configuration with JWT strategy and cookie customization per app.
- Shared authentication handlers exported from the auth package and imported by each portal.
- Middleware utilities for protected routes and role enforcement.
- Guards for protecting pages and API routes.
- Portal-specific authentication routes delegating to shared handlers.

Key implementation patterns:
- Each portal defines an API route under its app/api/auth/[...nextauth]/ that re-exports the shared handlers.
- Each portal creates a local auth-instance.ts that initializes the shared createAuth(appName) with the portal’s identifier.
- Middleware is configured per portal to enforce authentication and roles.
- Session storage uses JWT with a 30-day max age and app-scoped cookie names.

**Section sources**
- [config.ts:39-93](file://packages/auth/src/config.ts#L39-L93)
- [index.ts:1-3](file://packages/auth/src/index.ts#L1-L3)
- [admin route.ts:1-3](file://apps/admin/src/app/api/auth/[...nextauth]/route.ts#L1-L3)
- [customer route.ts:1-3](file://apps/customer/src/app/api/auth/[...nextauth]/route.ts#L1-L3)
- [seller route.ts:1-3](file://apps/seller/src/app/api/auth/[...nextauth]/route.ts#L1-L3)

## Architecture Overview
The authentication architecture is shared across all portals via a single NextAuth.js configuration. Each portal registers its own NextAuth endpoint and middleware, but both delegate to the shared auth package. This ensures consistent authentication behavior, session management, and RBAC enforcement across applications.

```mermaid
sequenceDiagram
participant Browser as "Browser"
participant AdminRoute as "Admin /api/auth/[...nextauth]"
participant CustomerRoute as "Customer /api/auth/[...nextauth]"
participant SellerRoute as "Seller /api/auth/[...nextauth]"
participant AuthPkg as "packages/auth/config.ts"
participant AdminMW as "Admin middleware.ts"
participant CustomerMW as "Customer middleware.ts"
participant SellerMW as "Seller middleware.ts"
Browser->>AdminRoute : "GET /api/auth/signin"
AdminRoute->>AuthPkg : "handlers.GET(...)"
AuthPkg-->>AdminRoute : "NextAuth handler"
AdminRoute-->>Browser : "Redirect to provider"
Browser->>AdminRoute : "POST /api/auth/callback"
AdminRoute->>AuthPkg : "handlers.POST(...)"
AuthPkg-->>AdminRoute : "NextAuth handler"
AdminRoute-->>Browser : "Set session cookies"
Browser->>AdminMW : "Protected route"
AdminMW->>AuthPkg : "auth(req)"
AuthPkg-->>AdminMW : "Session/JWT payload"
AdminMW-->>Browser : "Allow or redirect"
```

**Diagram sources**
- [admin route.ts:1-3](file://apps/admin/src/app/api/auth/[...nextauth]/route.ts#L1-L3)
- [customer route.ts:1-3](file://apps/customer/src/app/api/auth/[...nextauth]/route.ts#L1-L3)
- [seller route.ts:1-3](file://apps/seller/src/app/api/auth/[...nextauth]/route.ts#L1-L3)
- [config.ts:88-93](file://packages/auth/src/config.ts#L88-L93)
- [admin middleware.ts](file://apps/admin/src/middleware.ts)
- [customer middleware.ts](file://apps/customer/src/middleware.ts)
- [seller middleware.ts](file://apps/seller/src/middleware.ts)

## Detailed Component Analysis

### Centralized Authentication Configuration
The shared configuration builds a NextAuth.js adapter with:
- Credentials provider for password-based login.
- JWT strategy with custom callbacks to attach role and language to tokens and sessions.
- App-scoped cookie names to prevent cross-app cookie collisions.
- Sign-in and error pages mapped to a unified login route.
- Session duration set to 30 days.

```mermaid
flowchart TD
Start(["Initialize createAuth(appName)"]) --> BuildConfig["Build NextAuth config<br/>with credentials provider,<br/>JWT callbacks, app-scoped cookies"]
BuildConfig --> ExportHandlers["Export handlers, auth, signIn, signOut"]
ExportHandlers --> End(["Ready for portal import"])
```

**Diagram sources**
- [config.ts:39-93](file://packages/auth/src/config.ts#L39-L93)
- [config.ts:88-93](file://packages/auth/src/config.ts#L88-L93)

**Section sources**
- [config.ts:39-93](file://packages/auth/src/config.ts#L39-L93)

### Portal Authentication Routes
Each portal exposes a NextAuth-compatible API route that simply re-exports the shared handlers. This ensures identical authentication flows across Admin, Customer, and Seller.

```mermaid
sequenceDiagram
participant Client as "Client"
participant PortalRoute as "Portal /api/auth/[...nextauth]"
participant SharedHandlers as "Shared handlers"
participant NextAuth as "NextAuth Runtime"
Client->>PortalRoute : "GET /api/auth/... (signin/callback/...)"
PortalRoute->>SharedHandlers : "handlers.GET/POST(...)"
SharedHandlers->>NextAuth : "Dispatch to NextAuth"
NextAuth-->>SharedHandlers : "Response"
SharedHandlers-->>PortalRoute : "Response"
PortalRoute-->>Client : "HTTP response"
```

**Diagram sources**
- [admin route.ts:1-3](file://apps/admin/src/app/api/auth/[...nextauth]/route.ts#L1-L3)
- [customer route.ts:1-3](file://apps/customer/src/app/api/auth/[...nextauth]/route.ts#L1-L3)
- [seller route.ts:1-3](file://apps/seller/src/app/api/auth/[...nextauth]/route.ts#L1-L3)
- [index.ts:1-3](file://packages/auth/src/index.ts#L1-L3)

**Section sources**
- [admin route.ts:1-3](file://apps/admin/src/app/api/auth/[...nextauth]/route.ts#L1-L3)
- [customer route.ts:1-3](file://apps/customer/src/app/api/auth/[...nextauth]/route.ts#L1-L3)
- [seller route.ts:1-3](file://apps/seller/src/app/api/auth/[...nextauth]/route.ts#L1-L3)

### Portal Authentication Instances
Each portal creates a local auth-instance.ts that initializes the shared createAuth(appName) with the portal’s identifier. This enables app-scoped cookie names and consistent behavior across portals.

```mermaid
graph LR
Pkg["packages/auth/config.ts<br/>createAuth(appName)"]
AdminInst["apps/admin/lib/auth-instance.ts"]
CustomerInst["apps/customer/lib/auth-instance.ts"]
SellerInst["apps/seller/lib/auth-instance.ts"]
Pkg --> AdminInst
Pkg --> CustomerInst
Pkg --> SellerInst
```

**Diagram sources**
- [config.ts:88-93](file://packages/auth/src/config.ts#L88-L93)
- [auth-instance.ts](file://apps/admin/src/lib/auth-instance.ts)
- [auth-instance.ts](file://apps/customer/src/lib/auth-instance.ts)
- [auth-instance.ts](file://apps/seller/src/lib/auth-instance.ts)

**Section sources**
- [config.ts:88-93](file://packages/auth/src/config.ts#L88-L93)
- [auth-instance.ts](file://apps/admin/src/lib/auth-instance.ts)
- [auth-instance.ts](file://apps/customer/src/lib/auth-instance.ts)
- [auth-instance.ts](file://apps/seller/src/lib/auth-instance.ts)

### Middleware Implementation Patterns
Each portal defines middleware.ts to protect routes. The middleware uses the shared auth function to extract session data and enforce authentication and role checks. This pattern is repeated consistently across Admin, Customer, and Seller.

```mermaid
flowchart TD
MWStart(["Incoming Request"]) --> ExtractSession["Call shared auth(req)"]
ExtractSession --> HasSession{"Has session?"}
HasSession --> |No| Redirect["Redirect to /login"]
HasSession --> |Yes| CheckRole["Check role permissions"]
CheckRole --> Allowed{"Allowed?"}
Allowed --> |No| Forbidden["Return 403"]
Allowed --> |Yes| Continue["Proceed to route handler"]
Redirect --> MWEnd(["Exit"])
Forbidden --> MWEnd
Continue --> MWEnd
```

**Diagram sources**
- [admin middleware.ts](file://apps/admin/src/middleware.ts)
- [customer middleware.ts](file://apps/customer/src/middleware.ts)
- [seller middleware.ts](file://apps/seller/src/middleware.ts)
- [config.ts:62-77](file://packages/auth/src/config.ts#L62-L77)

**Section sources**
- [admin middleware.ts](file://apps/admin/src/middleware.ts)
- [customer middleware.ts](file://apps/customer/src/middleware.ts)
- [seller middleware.ts](file://apps/seller/src/middleware.ts)

### Role-Based Access Control (RBAC) and Guards
The shared configuration attaches role and language to JWT tokens and sessions via callbacks. Guards (from packages/auth/guards) can be used to restrict access to routes and pages based on roles. While the guards module is exported, the specific guard implementations are not shown here; however, the token structure supports enforcing role-based restrictions in middleware and pages.

```mermaid
classDiagram
class Token {
+string sub
+UserRole role
+string language
}
class Session {
+string id
+string userId
+UserRole role
+string language
}
class RBAC {
+checkRole(tokenOrSession, requiredRoles) bool
}
Token --> Session : "mapped in callbacks"
RBAC --> Token : "validates"
RBAC --> Session : "validates"
```

**Diagram sources**
- [config.ts:62-77](file://packages/auth/src/config.ts#L62-L77)

**Section sources**
- [config.ts:62-77](file://packages/auth/src/config.ts#L62-L77)

### Session Management Strategies
- Strategy: JWT
- Max age: 30 days
- Cookie names: App-scoped (e.g., customer.session-token, admin.session-token)
- Callbacks: Attach role and language to token and session

These strategies ensure consistent session behavior across portals while preventing cookie collisions.

**Section sources**
- [config.ts:57-85](file://packages/auth/src/config.ts#L57-L85)

### Cross-Application User Context Management
- Shared NextAuth configuration ensures consistent user identity and claims across Admin, Customer, and Seller.
- App-scoped cookies prevent cross-app session leakage.
- JWT-based sessions enable stateless verification and easy propagation across services.

**Section sources**
- [config.ts:57-85](file://packages/auth/src/config.ts#L57-L85)

### Inter-Application Data Sharing and API Communication
- Authentication endpoints are standardized across portals, enabling consistent token issuance and validation.
- Middleware enforces access control uniformly, supporting secure inter-application navigation and data access.
- Shared guards and auth utilities facilitate consistent RBAC enforcement across APIs and pages.

[No sources needed since this section provides conceptual guidance]

### User Experience Continuity and Seamless Role Transitions
- Unified login experience via shared NextAuth handlers.
- Role-aware navigation components (e.g., role switcher in Customer portal) enable seamless transitions between roles.
- Consistent session duration and cookie scoping reduce friction across applications.

**Section sources**
- [customer role-switcher.tsx](file://apps/customer/src/components/layout/role-switcher.tsx)

## Dependency Analysis
The dependency graph shows how each portal depends on the shared auth package for authentication behavior, while maintaining independent API routes and middleware.

```mermaid
graph TB
Pkg["packages/auth/config.ts"]
AdminRoute["apps/admin/src/app/api/auth/[...nextauth]/route.ts"]
CustomerRoute["apps/customer/src/app/api/auth/[...nextauth]/route.ts"]
SellerRoute["apps/seller/src/app/api/auth/[...nextauth]/route.ts"]
AdminMW["apps/admin/src/middleware.ts"]
CustomerMW["apps/customer/src/middleware.ts"]
SellerMW["apps/seller/src/middleware.ts"]
Pkg --> AdminRoute
Pkg --> CustomerRoute
Pkg --> SellerRoute
Pkg --> AdminMW
Pkg --> CustomerMW
Pkg --> SellerMW
```

**Diagram sources**
- [config.ts:88-93](file://packages/auth/src/config.ts#L88-L93)
- [admin route.ts:1-3](file://apps/admin/src/app/api/auth/[...nextauth]/route.ts#L1-L3)
- [customer route.ts:1-3](file://apps/customer/src/app/api/auth/[...nextauth]/route.ts#L1-L3)
- [seller route.ts:1-3](file://apps/seller/src/app/api/auth/[...nextauth]/route.ts#L1-L3)
- [admin middleware.ts](file://apps/admin/src/middleware.ts)
- [customer middleware.ts](file://apps/customer/src/middleware.ts)
- [seller middleware.ts](file://apps/seller/src/middleware.ts)

**Section sources**
- [index.ts:1-3](file://packages/auth/src/index.ts#L1-L3)

## Performance Considerations
- JWT strategy reduces server-side session storage overhead.
- App-scoped cookies minimize cross-app cache pollution.
- Middleware checks are lightweight and rely on parsed JWT claims.
- Consider optimizing cookie sizes and avoiding unnecessary callbacks for high-traffic routes.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Cookies not persisting across apps: Verify app-scoped cookie names and SameSite/Cross-site policies.
- Role not reflected in session: Confirm JWT callbacks are attaching role and language to token/session.
- Middleware redirects to login unexpectedly: Check auth(req) extraction and ensure protected routes call middleware.
- Inconsistent login experience: Ensure all portals expose the same NextAuth API route and import the same shared handlers.

**Section sources**
- [config.ts:57-85](file://packages/auth/src/config.ts#L57-L85)
- [config.ts:62-77](file://packages/auth/src/config.ts#L62-L77)
- [admin middleware.ts](file://apps/admin/src/middleware.ts)
- [customer middleware.ts](file://apps/customer/src/middleware.ts)
- [seller middleware.ts](file://apps/seller/src/middleware.ts)

## Conclusion
The inter-application communication architecture leverages a shared NextAuth.js configuration to deliver a consistent, secure, and scalable authentication and authorization system across Admin, Customer, and Seller portals. App-scoped cookies, JWT-based sessions, and middleware-driven RBAC enforcement ensure seamless user experiences, predictable navigation, and robust security. The standardized API routes and guards simplify maintenance and enable reliable cross-application user context management.