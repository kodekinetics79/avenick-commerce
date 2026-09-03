import type { ImportRow } from "@/app/products/actions";

/**
 * The CSV contract, in one place.
 *
 * The import tells a seller with a bad header to "export the CSV first to get
 * the right format". That sentence is only true while one list defines both
 * sides, so the export writer and the import reader share this module rather
 * than each carrying their own copy of the column names.
 */
export const PRODUCT_CSV_HEADERS = ["sku", "nameEn", "nameAr", "status", "price", "stock"] as const;

/** The minimum a row needs to be exportable; ProductRow satisfies it structurally. */
export interface ProductCsvSource {
  sku: string;
  nameEn: string;
  nameAr: string;
  status: string;
  price: number | null;
  available: number;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildProductCsv(rows: readonly ProductCsvSource[]): string {
  const lines = [PRODUCT_CSV_HEADERS.join(",")];
  for (const row of rows) {
    lines.push([row.sku, row.nameEn, row.nameAr, row.status, row.price ?? "", row.available].map(csvCell).join(","));
  }
  return lines.join("\n");
}

export function downloadCsv(contents: string, filename: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); field = ""; row = []; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/**
 * Turn a parsed grid into the rows the server action accepts, or say why it
 * cannot. The refusals are the file's problem, not the seller's: they name the
 * missing thing rather than reporting a generic failure.
 */
export function toImportRows(grid: string[][]): { rows: ImportRow[] } | { error: { title: string; detail: string } } {
  if (grid.length < 2) {
    return { error: { title: "Nothing to import", detail: "The file has a header row but no data rows under it." } };
  }
  const header = grid[0].map((cell) => cell.trim().toLowerCase());
  const indexOf = (name: string) => header.indexOf(name.toLowerCase());
  const skuIndex = indexOf("sku");
  if (skuIndex === -1) {
    return {
      error: {
        title: "No “sku” column",
        detail: `A row is matched to a listing by its SKU, so that column is required. Expected header: ${PRODUCT_CSV_HEADERS.join(", ")}.`,
      },
    };
  }
  const cols = {
    nameEn: indexOf("nameen"),
    nameAr: indexOf("namear"),
    status: indexOf("status"),
    price: indexOf("price"),
    stock: indexOf("stock"),
  };
  return {
    rows: grid.slice(1).map((row) => ({
      sku: row[skuIndex] ?? "",
      nameEn: cols.nameEn >= 0 ? row[cols.nameEn] : undefined,
      nameAr: cols.nameAr >= 0 ? row[cols.nameAr] : undefined,
      status: cols.status >= 0 ? row[cols.status] : undefined,
      price: cols.price >= 0 ? row[cols.price] : undefined,
      stock: cols.stock >= 0 ? row[cols.stock] : undefined,
    })),
  };
}

/**
 * Split "SKU \"ABC\": reason" into its two halves so the report can set the SKU
 * in the mono face beside the sentence. A message that does not carry a SKU is
 * returned whole rather than mangled.
 */
export function splitImportIssue(message: string): { sku: string | null; detail: string } {
  const match = /^SKU "(.*?)"(?::\s*)?(.*)$/.exec(message);
  if (!match) return { sku: null, detail: message };
  const detail = match[2].trim();
  return { sku: match[1], detail: detail === "" ? message : detail };
}
