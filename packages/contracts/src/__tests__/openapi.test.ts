import { describe, expect, it } from "vitest";

import { V1_ENDPOINTS, buildOpenApiDocument } from "../openapi/document";

const document = buildOpenApiDocument();

const operations = Object.entries(document.paths ?? {}).flatMap(([routePath, item]) =>
  Object.keys(item as Record<string, unknown>)
    .filter((key) => ["get", "post", "put", "patch", "delete"].includes(key))
    .map((method) => `${method.toUpperCase()} ${routePath}`),
);

describe("the OpenAPI document", () => {
  it("is OpenAPI 3.1", () => {
    expect(document.openapi).toBe("3.1.0");
  });

  it("describes exactly the declared v1 surface — no missing route, no stray one", () => {
    expect(operations.sort()).toEqual([...V1_ENDPOINTS].sort());
  });

  it("answers every operation's failures with the one error envelope", () => {
    for (const [routePath, item] of Object.entries(document.paths ?? {})) {
      for (const [method, operation] of Object.entries(item as Record<string, any>)) {
        if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
        const failureCodes = Object.keys(operation.responses).filter((status) => Number(status) >= 400);
        expect(failureCodes.length, `${method} ${routePath} declares no failure`).toBeGreaterThan(0);
        // Every route can fault, so every route documents the 500.
        expect(failureCodes, `${method} ${routePath} omits 500`).toContain("500");
        for (const status of failureCodes) {
          expect(
            operation.responses[status].content["application/json"].schema.$ref,
            `${method} ${routePath} ${status} does not use ErrorEnvelope`,
          ).toBe("#/components/schemas/ErrorEnvelope");
        }
      }
    }
  });

  it("wraps every success in { data } and never returns a bare payload", () => {
    for (const [routePath, item] of Object.entries(document.paths ?? {})) {
      for (const [method, operation] of Object.entries(item as Record<string, any>)) {
        if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
        const success = operation.responses["200"];
        expect(success, `${method} ${routePath} has no 200`).toBeDefined();
        const schema = success.content["application/json"].schema;
        expect(Object.keys(schema.properties), `${method} ${routePath} 200 is not enveloped`).toContain("data");
      }
    }
  });

  it("gives every list endpoint a required cursor meta and no total", () => {
    for (const routePath of ["/v1/products", "/v1/brands", "/v1/orders"]) {
      const schema = (document.paths as any)[routePath].get.responses["200"].content["application/json"].schema;
      expect(Object.keys(schema.properties).sort()).toEqual(["data", "meta"]);
      expect(schema.required).toEqual(expect.arrayContaining(["data", "meta"]));
      expect(JSON.stringify(schema)).not.toContain("total");
    }
  });

  it("takes a cursor, never a page or offset, on every paginated read", () => {
    for (const routePath of ["/v1/products", "/v1/brands", "/v1/orders"]) {
      const names = ((document.paths as any)[routePath].get.parameters ?? []).map((parameter: any) => parameter.name);
      expect(names).toContain("cursor");
      expect(names).not.toContain("page");
      expect(names).not.toContain("offset");
    }
  });

  it("keeps both VAT components required and non-nullable on the quote's totals", () => {
    const totals = (document.components?.schemas as any).OrderTotals;
    expect(totals.required).toEqual(expect.arrayContaining(["goodsVatAmount", "shippingVatAmount", "vatAmount", "total"]));
    expect(totals.properties.goodsVatAmount.type).toBe("number");
    expect(totals.properties.shippingVatAmount.type).toBe("number");
    expect(totals.additionalProperties).toBe(false);
  });

  it("keeps the placed-order totals honest: the components are nullable there, and only there", () => {
    const persisted = (document.components?.schemas as any).PersistedOrderTotals;
    // OpenAPI 3.1 expresses nullable as a type union.
    expect(persisted.properties.goodsVatAmount.type).toEqual(expect.arrayContaining(["number", "null"]));
    expect(persisted.properties.shippingVatAmount.type).toEqual(expect.arrayContaining(["number", "null"]));
  });

  it("keeps the product card lean and the detail fat — they are different types", () => {
    const card = (document.components?.schemas as any).ProductCard;
    const detail = (document.components?.schemas as any).ProductDetail;
    for (const fatField of ["descriptionEn", "descriptionAr", "prices", "variants", "seller", "tags"]) {
      expect(Object.keys(card.properties), `ProductCard should not carry ${fatField}`).not.toContain(fatField);
      expect(Object.keys(detail.properties), `ProductDetail should carry ${fatField}`).toContain(fatField);
    }
  });

  it("describes every image as a descriptor, never as a bare string", () => {
    const image = (document.components?.schemas as any).Image;
    expect(Object.keys(image.properties).sort()).toEqual(["alt", "blurhash", "height", "url", "width"]);
    expect(image.required).toEqual(expect.arrayContaining(["url", "width", "height"]));
  });

  it("leaves the public catalogue and the sign-in endpoints unauthenticated, and guards the rest", () => {
    const anonymous = ["GET /v1/products", "GET /v1/products/{slug}", "GET /v1/categories", "GET /v1/brands", "POST /v1/auth/token", "POST /v1/auth/refresh", "POST /v1/auth/otp/request", "POST /v1/auth/otp/verify"];
    for (const [routePath, item] of Object.entries(document.paths ?? {})) {
      for (const [method, operation] of Object.entries(item as Record<string, any>)) {
        if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
        const key = `${method.toUpperCase()} ${routePath}`;
        if (anonymous.includes(key)) {
          expect(operation.security, `${key} should be anonymous`).toEqual([]);
        } else {
          expect(operation.security, `${key} should require a bearer token`).toEqual([{ bearerAuth: [] }]);
        }
      }
    }
  });

  it("leaves no dangling $ref", () => {
    const refs = [...JSON.stringify(document).matchAll(/"\$ref":"(#\/components\/schemas\/[^"]+)"/g)].map((match) => match[1]);
    const defined = new Set(Object.keys(document.components?.schemas ?? {}).map((name) => `#/components/schemas/${name}`));
    for (const ref of new Set(refs)) expect([...defined], `dangling ${ref}`).toContain(ref);
  });

  it("is deterministic, which is what makes the staleness gate meaningful", () => {
    expect(JSON.stringify(buildOpenApiDocument())).toBe(JSON.stringify(buildOpenApiDocument()));
  });
});
