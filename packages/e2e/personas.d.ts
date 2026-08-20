import type { PortalName } from "./targets";

export interface Persona {
  email: string;
  portal: PortalName;
  role: string;
  label: string;
  deniedPortals: PortalName[];
}

export declare const SEED_PASSWORD: string;
export declare const PERSONAS: Record<string, Persona>;
export declare function storageStatePath(name: string): string;
export declare function assertPasswordConfigured(): void;
