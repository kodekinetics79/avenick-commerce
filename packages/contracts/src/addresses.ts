import { z } from "zod";

import { CountrySchema } from "./enums";
import { IdSchema } from "./primitives";
import { successEnvelope } from "./envelope";

/**
 * Addresses, in the shape the `Address` table actually stores — including
 * `lat`/`lng`, which exist as columns and which a mobile app is the first
 * client able to fill in from the device.
 *
 * The field bounds match `AddressSchema` in `@avenick/types/schemas` so the
 * app cannot collect an address the web would reject, with two deliberate
 * differences: `line1` uses the checkout minimum of 3 rather than 5 (the two
 * disagree today — see the report), and every optional column is `nullable`
 * on the response so "not set" is one value rather than two.
 */
export const AddressSchema = z
  .object({
    id: IdSchema,
    label: z.string().min(1).max(50),
    line1: z.string().min(3).max(240),
    line2: z.string().max(240).nullable(),
    city: z.string().min(2).max(120),
    country: CountrySchema,
    postalCode: z.string().max(20).nullable(),
    /** WGS84, matching the Decimal(10,8) / Decimal(11,8) columns. */
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    isDefault: z.boolean(),
  })
  .strict();

export type Address = z.infer<typeof AddressSchema>;

export const CreateAddressRequestSchema = z
  .object({
    label: z.string().trim().min(1).max(50),
    line1: z.string().trim().min(3).max(240),
    line2: z.string().trim().max(240).optional(),
    city: z.string().trim().min(2).max(120),
    country: CountrySchema,
    postalCode: z.string().trim().max(20).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    /**
     * Setting this true clears the flag on the account's other addresses —
     * a server-side operation, because two default addresses is a state no
     * client should be able to create.
     */
    isDefault: z.boolean().default(false),
  })
  .strict()
  .refine((body) => (body.latitude == null) === (body.longitude == null), {
    path: ["longitude"],
    message: "latitude and longitude are supplied together or not at all",
  });

/** PATCH: every field optional, empty patch rejected, same rules otherwise. */
export const UpdateAddressRequestSchema = z
  .object({
    label: z.string().trim().min(1).max(50).optional(),
    line1: z.string().trim().min(3).max(240).optional(),
    line2: z.string().trim().max(240).nullable().optional(),
    city: z.string().trim().min(2).max(120).optional(),
    country: CountrySchema.optional(),
    postalCode: z.string().trim().max(20).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    isDefault: z.boolean().optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "Provide at least one field to change",
  });

export const AddressPathParamsSchema = z.object({ id: IdSchema }).strict();

/**
 * An account holds a handful of addresses, so the list is returned whole.
 * Cursoring a five-item collection costs a round trip to learn there is no
 * second page.
 */
export const AddressListResponseSchema = successEnvelope(z.array(AddressSchema).max(100));

export const AddressResponseSchema = successEnvelope(AddressSchema);

export const AddressDeletedSchema = z.object({ id: IdSchema, deleted: z.literal(true) }).strict();

export const DeleteAddressResponseSchema = successEnvelope(AddressDeletedSchema);
