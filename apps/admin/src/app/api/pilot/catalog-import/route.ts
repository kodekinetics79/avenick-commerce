import { NextRequest, NextResponse } from "next/server";
import { gunzipSync } from "node:zlib";
import { getCurrentAdmin } from "@/lib/auth";
import {
  applyPilotCatalog,
  validatePilotCatalog,
  type PilotCatalogFile,
} from "@avenick/database/pilot-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_DECOMPRESSED_BYTES = 32 * 1024 * 1024;

function canApplyPilotImport() {
  if (process.env.PILOT_CATALOG_IMPORT !== "1") return false;
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PILOT_CATALOG_IMPORT !== "1") return false;
  return true;
}

function decodeCatalog(bytes: Uint8Array, contentType: string) {
  const isGzip = contentType.includes("gzip") || (bytes[0] === 0x1f && bytes[1] === 0x8b);
  const raw = isGzip
    ? gunzipSync(bytes, { maxOutputLength: MAX_DECOMPRESSED_BYTES })
    : Buffer.from(bytes);
  if (raw.byteLength > MAX_DECOMPRESSED_BYTES) {
    throw new Error("Catalog expands beyond the 32 MB decompressed limit");
  }
  return JSON.parse(raw.toString("utf8")) as PilotCatalogFile;
}

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Administrator authentication required" }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ success: false, error: "Catalog upload exceeds the 8 MB pilot-import limit" }, { status: 413 });
  }

  try {
    const arrayBuffer = await request.arrayBuffer();
    if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ success: false, error: "Catalog file is empty or too large" }, { status: 400 });
    }
    const file = decodeCatalog(new Uint8Array(arrayBuffer), request.headers.get("content-type") ?? "");
    const validation = validatePilotCatalog(file);
    const apply = request.nextUrl.searchParams.get("apply") === "1";

    if (validation.errors.length) {
      return NextResponse.json({
        success: false,
        error: "Catalog validation failed",
        data: {
          ...validation,
          errors: validation.errors.slice(0, 100),
          warnings: validation.warnings.slice(0, 100),
          rowCount: file.records?.length ?? 0,
        },
      }, { status: 422 });
    }

    if (!apply) {
      return NextResponse.json({
        success: true,
        applied: false,
        data: {
          ...validation,
          warnings: validation.warnings.slice(0, 100),
          rowCount: file.records.length,
          applyEnabled: canApplyPilotImport(),
        },
      });
    }

    if (!canApplyPilotImport()) {
      return NextResponse.json({
        success: false,
        error: "Pilot catalog writes are disabled for this deployment. Enable the explicit pilot-import environment gates first.",
      }, { status: 409 });
    }

    const result = await applyPilotCatalog(file, {
      actorId: admin.userId,
      assetBaseUrl: process.env.PILOT_ASSET_BASE_URL?.trim() || undefined,
      testPassword: process.env.PILOT_TEST_PASSWORD?.trim() || undefined,
    });
    return NextResponse.json({ success: true, applied: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog import failed";
    const tooLarge = /output length|decompressed limit|buffer/i.test(message);
    return NextResponse.json({ success: false, error: tooLarge ? "Catalog expands beyond the allowed decompressed size" : message }, { status: tooLarge ? 413 : 400 });
  }
}
