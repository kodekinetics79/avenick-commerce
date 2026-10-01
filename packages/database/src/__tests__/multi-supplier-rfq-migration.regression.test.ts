import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../prisma/migrations/20260930012000_multi_supplier_rfq_foundation/migration.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("multi-supplier RFQ migration", () => {
  it("does not mix a typed row variable into a multi-target PL/pgSQL INTO list", () => {
    // PostgreSQL error 42601: a composite row variable cannot be one target in
    // a multi-item INTO list. This escaped static checks and stopped a clean
    // database before any application test could run.
    expect(migration).not.toMatch(
      /SELECT\s+q\s*,\s*r\."companyId"\s+INTO\s+source_quote\s*,\s*source_company_id/i,
    );
    expect(migration).toMatch(/SELECT\s+q\.\*\s+INTO\s+source_quote/i);
    expect(migration).toMatch(/SELECT\s+r\."companyId"\s+INTO\s+source_company_id/i);
  });

  it("returns OLD from the PO-line guard during DELETE", () => {
    const guard = migration.match(
      /CREATE OR REPLACE FUNCTION "guard_quote_sourced_purchase_order_item"\(\)[\s\S]*?\$\$ LANGUAGE plpgsql;/,
    )?.[0];

    expect(guard).toBeDefined();
    expect(guard).toMatch(/RETURN\s+CASE\s+WHEN\s+TG_OP\s*=\s*'DELETE'\s+THEN\s+OLD\s+ELSE\s+NEW\s+END;/i);
    expect(guard).not.toMatch(/RETURN\s+NEW\s*;/i);
  });
});
