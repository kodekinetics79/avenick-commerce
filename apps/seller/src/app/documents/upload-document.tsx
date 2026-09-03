"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Upload, X } from "lucide-react";
import { Button } from "@avenick/ui";
import type { DocumentType } from "@avenick/database";
import { useToast } from "@/components/toast";
import { recordSellerDocumentAction } from "./actions";

/**
 * Compliance document uploader.
 *
 * Three pieces share one context so the server-rendered page can put the
 * trigger buttons wherever a document is (header, expiry banners, each card)
 * and the form in one place:
 *
 *   <DocumentUploader>        provider — holds open/preset state
 *   <UploadDocumentButton>    any button that opens the form, optionally preset to a type
 *   <UploadDocumentPanel>     the form itself
 *
 * The upload itself is three steps, each of which can fail on its own and is
 * reported on its own: presign (POST /api/uploads/presign), PUT to storage
 * with exactly the headers the grant names, then the server action that
 * records the object key. A failure between PUT and record leaves an orphan
 * object and no row; the seller is told so and asked to retry.
 */

export interface DocumentTypeOption {
  value: DocumentType;
  label: string;
  /** Whether the form asks for an expiry date for this type. */
  expires: boolean;
}

export interface DocumentUploaderProps {
  /** browserDirectUploadsEnabled() on the server; false renders the honest disabled state. */
  enabled: boolean;
  /** Whether the acting member holds documents.manage. */
  canManage: boolean;
  types: readonly DocumentTypeOption[];
  /** Byte ceiling for a seller document, from the upload policy. */
  maxBytes: number;
  /** Comma-separated extension list for the file input, from the upload policy. */
  accept: string;
  /** Open on first render (deep link from another page), optionally preset. */
  initialOpen?: boolean;
  initialType?: DocumentType | null;
  children: React.ReactNode;
}

interface UploaderContextValue {
  enabled: boolean;
  canManage: boolean;
  types: readonly DocumentTypeOption[];
  maxBytes: number;
  accept: string;
  open: boolean;
  presetType: DocumentType | null;
  openWith: (type: DocumentType | null) => void;
  close: () => void;
}

const UploaderContext = React.createContext<UploaderContextValue | null>(null);

function useUploader(): UploaderContextValue {
  const value = React.useContext(UploaderContext);
  if (!value) throw new Error("UploadDocument components must be rendered inside <DocumentUploader>");
  return value;
}

export function DocumentUploader({
  enabled,
  canManage,
  types,
  maxBytes,
  accept,
  initialOpen = false,
  initialType = null,
  children,
}: DocumentUploaderProps) {
  const [open, setOpen] = React.useState(initialOpen && canManage);
  const [presetType, setPresetType] = React.useState<DocumentType | null>(initialType);

  const value = React.useMemo<UploaderContextValue>(
    () => ({
      enabled,
      canManage,
      types,
      maxBytes,
      accept,
      open,
      presetType,
      openWith: (type) => {
        setPresetType(type);
        setOpen(true);
      },
      close: () => setOpen(false),
    }),
    [enabled, canManage, types, maxBytes, accept, open, presetType],
  );

  return <UploaderContext.Provider value={value}>{children}</UploaderContext.Provider>;
}

export interface UploadDocumentButtonProps {
  /** Preset the type picker — the "Renew" affordance on an expiring row. */
  type?: DocumentType | null;
  className?: string;
  children: React.ReactNode;
}

/**
 * Renders nothing when the member cannot upload or the environment cannot
 * store files: a control that could only fail is not a control.
 */
export function UploadDocumentButton({ type = null, className, children }: UploadDocumentButtonProps) {
  const uploader = useUploader();
  if (!uploader.canManage || !uploader.enabled) return null;
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        uploader.openWith(type);
        // Bring the form into view when the trigger sits far down a long list.
        requestAnimationFrame(() => document.getElementById("upload-document-panel")?.scrollIntoView({ block: "nearest" }));
      }}
    >
      {children}
    </button>
  );
}

const FIELD =
  "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

type Phase = "idle" | "presign" | "put" | "record";

const PHASE_LABEL: Record<Exclude<Phase, "idle">, string> = {
  presign: "Requesting upload…",
  put: "Uploading file…",
  record: "Recording document…",
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/** Tomorrow as YYYY-MM-DD in the viewer's local calendar, for the date input's floor. */
function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function UploadDocumentPanel() {
  const uploader = useUploader();
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const [type, setType] = React.useState<DocumentType | "">(uploader.presetType ?? "");
  const [file, setFile] = React.useState<File | null>(null);
  const [expiryDate, setExpiryDate] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [notice, setNotice] = React.useState<string | null>(null);

  // A trigger elsewhere on the page re-opens the form with its own preset; the
  // preset wins over whatever was half-typed, since the seller just chose it.
  React.useEffect(() => {
    if (uploader.open && uploader.presetType) setType(uploader.presetType);
  }, [uploader.open, uploader.presetType]);

  if (!uploader.canManage) return null;

  if (!uploader.enabled) {
    return (
      <div className="bg-card rounded-2xl border border-border p-4 flex items-start gap-3 text-sm text-muted-foreground">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Document uploads are not enabled in this environment — file storage is not configured, so no upload could
          be stored. Existing records are listed below.
        </p>
      </div>
    );
  }

  if (!uploader.open) return null;

  const selected = uploader.types.find((option) => option.value === type) ?? null;
  const busy = phase !== "idle";

  function reset() {
    setFile(null);
    setExpiryDate("");
    setNotice(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    if (!selected) {
      setNotice("Choose the document type first.");
      return;
    }
    if (!file) {
      setNotice("Choose a file to upload.");
      return;
    }
    if (file.size > uploader.maxBytes) {
      setNotice(`"${file.name}" is larger than ${formatBytes(uploader.maxBytes)} and was not uploaded.`);
      return;
    }

    // 1. Ask the server for a signed PUT. Everything that decides whether
    //    this file may land in the bucket is decided there.
    setPhase("presign");
    let grant: Response;
    try {
      grant = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          purpose: "seller-document",
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
    } catch {
      setPhase("idle");
      setNotice("Couldn't reach the upload service. Nothing was uploaded.");
      return;
    }
    const body = (await grant.json().catch(() => null)) as
      | { success?: boolean; error?: string; data?: { key?: string; url?: string; headers?: Record<string, string> } }
      | null;
    if (!grant.ok || body?.success === false || !body?.data) {
      setPhase("idle");
      setNotice(body?.error ?? `Upload is unavailable right now (HTTP ${grant.status}). Nothing was uploaded.`);
      return;
    }
    const { key, url, headers } = body.data;
    if (typeof key !== "string" || typeof url !== "string") {
      setPhase("idle");
      setNotice("The upload service returned a response this form can't use. Nothing was uploaded.");
      return;
    }

    // 2. PUT the bytes with exactly the headers the grant names; any other
    //    value breaks the signature and storage rejects the write.
    setPhase("put");
    const put = await fetch(url, { method: "PUT", body: file, headers: headers ?? undefined }).catch(() => null);
    if (!put || !put.ok) {
      setPhase("idle");
      setNotice(`Uploading "${file.name}" failed${put ? ` (HTTP ${put.status})` : ""}. No document was recorded.`);
      return;
    }

    // 3. Record the key. Only now does a SellerDocument row exist.
    setPhase("record");
    let result: Awaited<ReturnType<typeof recordSellerDocumentAction>>;
    try {
      result = await recordSellerDocumentAction({
        type: selected.value,
        fileKey: key,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        expiryDate: selected.expires && expiryDate ? expiryDate : null,
      });
    } catch {
      setPhase("idle");
      setNotice("The file was uploaded but could not be recorded. Please try again — the review only starts once the record exists.");
      return;
    }
    setPhase("idle");
    if (!result.ok) {
      setNotice(result.error);
      return;
    }

    toast({
      title: "Document submitted for review",
      description:
        result.supersededCount > 0
          ? `${selected.label} uploaded. It replaces the previous upload that was still awaiting review.`
          : `${selected.label} uploaded. It will appear as "Under review" until an admin decides.`,
      variant: "success",
    });
    reset();
    uploader.close();
    router.refresh();
  }

  return (
    <form
      id="upload-document-panel"
      onSubmit={submit}
      className="bg-card rounded-2xl border border-border p-5 space-y-4"
      aria-busy={busy}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Upload a document</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            One review is open per document type: uploading a type that is already awaiting review replaces that
            upload. A document that has been approved stays approved until the admin decides on the new one.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            reset();
            uploader.close();
          }}
          disabled={busy}
          className="h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
          aria-label="Close uploader"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Document type</span>
          <select
            className={FIELD}
            value={type}
            onChange={(event) => setType(event.target.value as DocumentType | "")}
            disabled={busy}
            required
          >
            <option value="">Select a type…</option>
            {uploader.types.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {selected?.expires && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Expiry date (optional)</span>
            <input
              type="date"
              className={FIELD}
              value={expiryDate}
              min={tomorrowIso()}
              onChange={(event) => setExpiryDate(event.target.value)}
              disabled={busy}
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              Used to warn you before this document lapses. Leave blank if the document does not state one.
            </span>
          </label>
        )}
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">File</span>
        <input
          ref={fileRef}
          type="file"
          accept={uploader.accept}
          className="block w-full text-sm text-muted-foreground file:me-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/70"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          disabled={busy}
          required
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          Accepted: {uploader.accept.split(",").join(", ")} · up to {formatBytes(uploader.maxBytes)}. The file is
          stored privately and is only visible to you and the review team.
        </span>
      </label>

      {notice && (
        <p className="flex items-start gap-1.5 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {notice}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || !selected || !file}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? PHASE_LABEL[phase as Exclude<Phase, "idle">] : "Upload for review"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            reset();
            uploader.close();
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
