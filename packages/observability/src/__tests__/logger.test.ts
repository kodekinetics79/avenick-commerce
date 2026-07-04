import { describe, it, expect, vi, afterEach } from "vitest";
import { createLogger } from "../logger";

describe("structured logger", () => {
  afterEach(() => vi.restoreAllMocks());

  it("emits a single JSON line with level, service, msg and timestamp", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    createLogger("test-svc").info("hello", { requestId: "req-1", status: 200 });

    expect(spy).toHaveBeenCalledOnce();
    const line = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(line).toMatchObject({
      level: "info",
      service: "test-svc",
      msg: "hello",
      requestId: "req-1",
      status: 200,
    });
    expect(typeof line.at).toBe("string");
  });

  it("routes warn/error to stderr and unwraps Error objects", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    createLogger("test-svc").error("boom", new Error("kaboom"));

    const line = JSON.parse(errSpy.mock.calls[0]![0] as string);
    expect(line.level).toBe("error");
    expect(line.error).toBe("kaboom");
    expect(line.stack).toContain("kaboom");
  });

  it("respects LOG_LEVEL by suppressing lower levels", () => {
    const prev = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = "warn";
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    createLogger("test-svc").info("should be dropped");
    expect(spy).not.toHaveBeenCalled();
    process.env.LOG_LEVEL = prev;
  });

  it("with() merges base fields into every line", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    createLogger("test-svc").with({ requestId: "req-9" }).info("scoped");
    const line = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(line.requestId).toBe("req-9");
  });
});
