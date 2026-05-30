"use client";

import * as React from "react";
import { Upload, X, FileText, Image } from "lucide-react";
import { cn } from "@manzil/utils";

interface FileUploadProps {
  accept?: string;
  maxSize?: number; // bytes
  multiple?: boolean;
  onFilesChange?: (files: File[]) => void;
  className?: string;
  label?: string;
  sublabel?: string;
  disabled?: boolean;
}

interface UploadedFile {
  file: File;
  preview?: string;
}

export function FileUpload({
  accept = "image/*,application/pdf",
  maxSize = 20 * 1024 * 1024,
  multiple = false,
  onFilesChange,
  className,
  label = "Drop files here or click to upload",
  sublabel,
  disabled,
}: FileUploadProps) {
  const [files, setFiles] = React.useState<UploadedFile[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function processFiles(fileList: FileList) {
    setError(null);
    const valid: UploadedFile[] = [];
    for (const file of Array.from(fileList)) {
      if (file.size > maxSize) {
        setError(`${file.name} exceeds the maximum file size`);
        continue;
      }
      const preview = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined;
      valid.push({ file, preview });
    }
    const next = multiple ? [...files, ...valid] : valid.slice(0, 1);
    setFiles(next);
    onFilesChange?.(next.map((f) => f.file));
  }

  function remove(idx: number) {
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);
    onFilesChange?.(next.map((f) => f.file));
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files); }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer",
          dragging ? "border-primary-600 bg-primary-50" : "border-border hover:border-primary-400 hover:bg-muted/30",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-center">{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground text-center">{sublabel}</p>}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          disabled={disabled}
          onChange={(e) => e.target.files && processFiles(e.target.files)}
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
              {f.preview ? (
                <img src={f.preview} alt={f.file.name} className="h-10 w-10 rounded object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                  {f.file.type === "application/pdf" ? (
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Image className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(f.file.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); remove(i); }}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
