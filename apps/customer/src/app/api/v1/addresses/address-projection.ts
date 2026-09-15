import type { Address } from "@avenick/contracts";
import type { Country, Prisma } from "@avenick/database";

import { toNumber } from "../_lib/dto";

/**
 * The `Address` row as the contract carries it.
 *
 * Two renamings, both deliberate and both in the contract rather than here:
 * the columns are `lat` / `lng` and the fields are `latitude` / `longitude`,
 * because an abbreviation in a generated Dart model is a field somebody has to
 * look up. `Decimal(10, 8)` / `Decimal(11, 8)` carry more precision than a
 * double, but WGS84 degrees at eight decimals is roughly a millimetre and a
 * double holds fifteen significant digits, so nothing is lost on this trip.
 */
export interface AddressRow {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  country: Country;
  postalCode: string | null;
  lat: Prisma.Decimal | null;
  lng: Prisma.Decimal | null;
  isDefault: boolean;
}

export const ADDRESS_SELECT = {
  id: true,
  label: true,
  line1: true,
  line2: true,
  city: true,
  country: true,
  postalCode: true,
  lat: true,
  lng: true,
  isDefault: true,
} as const;

export function toAddress(row: AddressRow): Address {
  return {
    id: row.id,
    label: row.label,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    country: row.country,
    postalCode: row.postalCode,
    latitude: row.lat == null ? null : toNumber(row.lat),
    longitude: row.lng == null ? null : toNumber(row.lng),
    isDefault: row.isDefault,
  };
}
