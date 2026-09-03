export type PortalName = "customer" | "seller" | "admin";

export declare const TARGETS: Record<PortalName, string>;
export declare function url(portal: PortalName, path?: string): string;
export declare const FORBIDDEN_ON_PUBLIC_PAGES: string[];
export declare const PUBLIC_CUSTOMER_ROUTES: string[];
