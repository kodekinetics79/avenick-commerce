import { z } from "zod";

import { LanguageSchema } from "./enums";
import { IdSchema, TimestampSchema } from "./primitives";
import { successEnvelope } from "./envelope";

/**
 * Push-notification device registration.
 *
 * NOTE FOR THE BACKEND: there is no device or push-token model in
 * `schema.prisma` at all. `Notification` rows exist and are read in-app; there
 * is nothing to deliver one to a phone with. This contract states what the app
 * will send; the table does not exist yet. See the report.
 */

export const DevicePlatformSchema = z.enum(["ios", "android"]);

export const RegisterDeviceRequestSchema = z
  .object({
    /**
     * The installation's stable id, minted by the app and reused across token
     * rotations. It is the key: an APNs/FCM token changes on reinstall, on
     * restore, and at the platform's discretion, so keying on the token alone
     * accumulates dead rows that are still sent to.
     */
    deviceId: IdSchema,
    /** The APNs or FCM token. Long: FCM tokens run past 160 characters. */
    pushToken: z.string().min(16).max(4096),
    platform: DevicePlatformSchema,
    /** Marketing version, e.g. "1.4.0". Used to stop pushing to builds that cannot render the payload. */
    appVersion: z.string().regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/, "Use a semantic version, e.g. 1.4.0"),
    osVersion: z.string().max(40).optional(),
    /** Which language to send notifications in. Defaults to the account's. */
    language: LanguageSchema.optional(),
    /** IANA zone, so a delivery notification does not arrive at 3am. */
    timeZone: z.string().max(64).optional(),
  })
  .strict();

export const DeviceSchema = z
  .object({
    id: IdSchema,
    deviceId: IdSchema,
    platform: DevicePlatformSchema,
    appVersion: z.string().max(40),
    language: LanguageSchema,
    registeredAt: TimestampSchema,
    lastSeenAt: TimestampSchema,
  })
  .strict();

/**
 * Registration is idempotent on `deviceId`: re-registering the same
 * installation with a rotated token updates the row rather than creating a
 * second one, so a phone never receives a notification twice.
 */
export const RegisterDeviceResponseSchema = successEnvelope(DeviceSchema);

/**
 * DELETE /v1/devices?deviceId=... — the sign-out companion.
 *
 * The identifier travels in the query string rather than a body: a DELETE with
 * a body is legal but is dropped or rejected by enough proxies and HTTP
 * clients that it is not worth relying on from a mobile network.
 */
export const DeleteDeviceQuerySchema = z.object({ deviceId: IdSchema }).strict();

export const DeviceDeletedSchema = z.object({ deviceId: IdSchema, deleted: z.literal(true) }).strict();

export const DeleteDeviceResponseSchema = successEnvelope(DeviceDeletedSchema);
