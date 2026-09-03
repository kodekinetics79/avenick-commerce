"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Upload, X } from "lucide-react";
import { Button, Eyebrow, Field, Input, Surface, type ButtonProps } from "@avenick/ui";
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
  /** Button language, so a trigger never hand-rolls its own fill. */
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  children: React.ReactNode;
}

/**
 * Renders nothing when the member cannot upload or the environment cannot
 * store files: a control that could only fail is not a control.
 */
export function UploadDocumentButton({
  type = null,
  variant = "secondary",
  size = "sm",
  className,
  children,
}: UploadDocumentButtonProps) {
  const uploader = useUploader();
  if (!uploader.canManage || !uploader.enabled) return null;
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => {
        uploader.openWith(type);
        // Bring the form into view when the trigger sits far down a long list.
        requestAnimationFrame(() => document.getElementById("upload-document-panel")?.scrollIntoView({ block: "nearest" }));
      }}
    >
      {children}
    </Button>
  );
}

/* The native select, wearing the same recessed rung-1 material as <Input> and
   <Textarea>: everywhere you can type or choose is pressed into the page, and
   everywhere you can click stands off it. The focus ring is the shared two-stop
   .u-focus utility rather than a hand-written shadow. */
const SELECT_FIELD =
  "u-focus w-full border border-input bg-surface-1 px-3 text-ui text-ink-1 outline-none transition-[border-color,box-shadow] duration-press ease-standard disabled:cursor-not-allowed disabled:opacity-50";

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
  const typeFieldId = React.useId();
  const fileFieldId = React.useId();

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
      <Surface rung={1} className="flex items-start gap-3 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
        <p className="u-ui text-ink-2">
          Document uploads are not enabled in this environment — file storage is not configured, so no upload could
          be stored. Existing records are listed below.
        </p>
      </Surface>
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
    <Surface
      as="form"
      rung={2}
      id="upload-document-panel"
      onSubmit={submit}
      className="space-y-4 p-5"
      aria-busy={busy}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow className="mb-1">New filing</Eyebrow>
          <h2 className="u-h3 text-ink-1">Upload a document</h2>
          <p className="u-meta u-measure-desc mt-1 text-ink-2">
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
          className="u-focus grid h-8 w-8 shrink-0 place-items-center rounded-nested text-ink-3 transition-colors duration-press ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1 disabled:opacity-50"
          aria-label="Close uploader"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Document type" htmlFor={typeFieldId} required>
          <select
            id={typeFieldId}
            data-rung={1}
            className={SELECT_FIELD}
            style={{ height: "var(--control-h-md)" }}
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
        </Field>

        {selected?.expires && (
          <Input
            type="date"
            label="Expiry date (optional)"
            value={expiryDate}
            min={tomorrowIso()}
            onChange={(event) => setExpiryDate(event.target.value)}
            disabled={busy}
            hint="Used to warn you before this document lapses. Leave blank if the document does not state one."
          />
        )}
      </div>

      <Field
        label="File"
        htmlFor={fileFieldId}
        required
        hint={`Accepted: ${uploader.accept.split(",").join(", ")} · up to ${formatBytes(uploader.maxBytes)}. The file is stored privately and is only visible to you and the review team.`}
      >
        <input
          id={fileFieldId}
          ref={fileRef}
          type="file"
          accept={uploader.accept}
          className="u-focus block w-full rounded-nested text-ui text-ink-2 file:me-3 file:rounded-nested file:border-0 file:bg-surface-1 file:px-3 file:py-1.5 file:text-ui file:font-medium file:text-ink-1 hover:file:bg-surface-sunken"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          disabled={busy}
          required
        />
      </Field>

      {notice && (
        <Surface role="alert" rung={2} tone="warning" className="flex items-start gap-2 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden="true" />
          <p className="u-ui text-warning-ink">{notice}</p>
        </Surface>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy} disabled={!selected || !file}>
          {!busy && <Upload className="h-4 w-4" aria-hidden="true" />}
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
        {/* The upload is three steps that can each fail on their own, so which
            one is in flight is announced rather than only implied by a spinner. */}
        {busy && (
          <p role="status" className="u-meta text-ink-3">
            {PHASE_LABEL[phase as Exclude<Phase, "idle">]}
          </p>
        )}
      </div>
    </Surface>
  );
}
