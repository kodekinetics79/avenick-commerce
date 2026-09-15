import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  AcknowledgementSchema,
  CursorQuerySchema,
  ERROR_CODE_VALUES,
  ErrorEnvelopeSchema,
  PageMetaSchema,
  pageEnvelope,
  successEnvelope,
} from "../envelope";

const requestId = "req_01HZX9K3QW";

describe("the error envelope", () => {
  it("covers the whole taxonomy and nothing else", () => {
    expect([...ERROR_CODE_VALUES].sort()).toEqual(
      [
        "conflict",
        "forbidden",
        "internal",
        "not_found",
        "payment_required",
        "rate_limited",
        "unauthenticated",
        "upstream_unavailable",
        "validation_failed",
      ].sort(),
    );
  });

  it("round-trips a validation failure with field detail", () => {
    const value = {
      error: {
        code: "validation_failed" as const,
        message: "moqMin cannot exceed moqMax",
        requestId,
        fieldErrors: { moqMin: ["moqMin cannot exceed moqMax"] },
      },
    };
    expect(ErrorEnvelopeSchema.parse(value)).toEqual(value);
  });

  it("refuses an error with no requestId, because a failure nobody can look up is not reportable", () => {
    const result = ErrorEnvelopeSchema.safeParse({ error: { code: "internal", message: "boom" } });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain("error.requestId");
  });

  it("refuses a code outside the taxonomy", () => {
    expect(ErrorEnvelopeSchema.safeParse({ error: { code: "teapot", message: "no", requestId } }).success).toBe(false);
  });

  it("refuses the legacy { success, error } shape the existing routes use", () => {
    expect(ErrorEnvelopeSchema.safeParse({ success: false, error: "Unauthorized" }).success).toBe(false);
  });

  it("refuses an empty fieldErrors list, which claims a field failed without saying how", () => {
    expect(
      ErrorEnvelopeSchema.safeParse({ error: { code: "validation_failed", message: "x", requestId, fieldErrors: { qty: [] } } })
        .success,
    ).toBe(false);
  });
});

describe("the success envelope", () => {
  const Payload = z.object({ id: z.string() }).strict();

  it("round-trips data with no meta", () => {
    expect(successEnvelope(Payload).parse({ data: { id: "p1" } })).toEqual({ data: { id: "p1" } });
  });

  it("rejects a sibling key beside data, which is how /api/products grew its page block", () => {
    const result = successEnvelope(Payload).safeParse({ data: { id: "p1" }, success: true, total: 42 });
    expect(result.success).toBe(false);
  });

  it("requires meta on a paginated collection", () => {
    const List = pageEnvelope(Payload);
    expect(List.safeParse({ data: [{ id: "p1" }] }).success).toBe(false);
    expect(List.parse({ data: [{ id: "p1" }], meta: { cursor: "abc", hasMore: true } })).toEqual({
      data: [{ id: "p1" }],
      meta: { cursor: "abc", hasMore: true },
    });
  });

  it("has no total: hasMore is the only claim a cursor page makes about what follows", () => {
    expect(Object.keys(PageMetaSchema.shape).sort()).toEqual(["cursor", "hasMore"]);
    expect(PageMetaSchema.safeParse({ cursor: null, hasMore: false, total: 900 }).success).toBe(false);
  });

  it("uses a null cursor for the last page rather than omitting it", () => {
    expect(PageMetaSchema.parse({ cursor: null, hasMore: false })).toEqual({ cursor: null, hasMore: false });
    expect(PageMetaSchema.safeParse({ hasMore: false }).success).toBe(false);
  });
});

describe("cursor pagination query", () => {
  it("defaults the limit and coerces the query string", () => {
    expect(CursorQuerySchema.parse({})).toEqual({ limit: 24 });
    expect(CursorQuerySchema.parse({ limit: "50", cursor: "abc" })).toEqual({ limit: 50, cursor: "abc" });
  });

  it("caps the limit at the ceiling /api/products already enforces", () => {
    expect(CursorQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
    expect(CursorQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
  });

  it("has no page or offset parameter", () => {
    expect(CursorQuerySchema.safeParse({ page: 2 }).success).toBe(false);
    expect(CursorQuerySchema.safeParse({ offset: 20 }).success).toBe(false);
  });
});

describe("acknowledgement", () => {
  it("cannot express failure, so it is never used to report one", () => {
    expect(AcknowledgementSchema.parse({ ok: true })).toEqual({ ok: true });
    expect(AcknowledgementSchema.safeParse({ ok: false }).success).toBe(false);
  });
});
