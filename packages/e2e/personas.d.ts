import type { PortalName } from "./targets";

export interface Persona {
  email: string;
  portal: PortalName;
  role: string;
  label: string;
  deniedPortals: PortalName[];
}

export type PersonaSetName = "seed" | "shared";

export declare const SEED_PASSWORD: string;
export declare const PERSONA_SETS: Record<PersonaSetName, Record<string, string | null>>;
export declare const PERSONA_SET: PersonaSetName;
export declare const PERSONAS: Record<string, Persona>;
export declare function storageStatePath(name: string): string;
export declare function assertPasswordConfigured(): void;
