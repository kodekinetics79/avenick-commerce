import { describe, it, expect } from "vitest";
import { statusSummary, type StatusComponent } from "../probes";

const proc = (name: string, status: StatusComponent["status"]): StatusComponent => ({
  name,
  kind: "process",
  status,
});

describe("statusSummary — process health is scoped", () => {
  it("reports operational process health when every process component is healthy", () => {
    const s = statusSummary("customer", [proc("api", "operational"), proc("database", "operational")]);
    expect(s.processStatus).toBe("operational");
  });

  it("takes the worst process component", () => {
    const s = statusSummary("customer", [proc("api", "operational"), proc("database", "down")]);
    expect(s.processStatus).toBe("down");
  });

  it("does not let a journey or integration component change process health", () => {
    const s = statusSummary("customer", [
      proc("api", "operational"),
      { name: "primary-journeys", kind: "journey", status: "down" },
      { name: "external-integrations", kind: "integration", status: "down" },
    ]);
    expect(s.processStatus).toBe("operational");
  });
});

describe("statusSummary — journeys are never assumed healthy", () => {
  it("reports unverified when no journey component is declared", () => {
    // Process health says nothing about whether anyone can actually buy.
    const s = statusSummary("customer", [proc("api", "operational")]);
    expect(s.journeyStatus).toBe("unverified");
  });

  it("reports unverified when the journey synthetic has not run", () => {
    const s = statusSummary("customer", [
      proc("api", "operational"),
      { name: "primary-journeys", kind: "journey", status: "unverified" },
    ]);
    expect(s.journeyStatus).toBe("unverified");
  });

  it("reports degraded when a primary route synthetic fails", () => {
    const s = statusSummary("customer", [
      proc("api", "operational"),
      { name: "primary-journeys", kind: "journey", status: "degraded" },
    ]);
    expect(s.journeyStatus).toBe("degraded");
    expect(s.status).not.toBe("operational");
  });

  it("only reports operational journeys when a synthetic actually passed", () => {
    const s = statusSummary("customer", [
      proc("api", "operational"),
      { name: "primary-journeys", kind: "journey", status: "operational" },
    ]);
    expect(s.journeyStatus).toBe("operational");
  });
});

describe("statusSummary — integrations", () => {
  it("does not count zero configured integrations as active", () => {
    const s = statusSummary("customer", [
      proc("api", "operational"),
      { name: "external-integrations", kind: "integration", status: "not_configured" },
    ]);
    const integration = s.components.find((c) => c.name === "external-integrations");
    expect(integration?.status).toBe("not_configured");
  });

  it("treats not_configured as absence, not as a fault", () => {
    const s = statusSummary("customer", [
      proc("api", "operational"),
      { name: "external-integrations", kind: "integration", status: "not_configured" },
      { name: "primary-journeys", kind: "journey", status: "operational" },
    ]);
    expect(s.status).toBe("operational");
  });

  it("falls back to unverified when every component is unconfigured", () => {
    const s = statusSummary("customer", [
      { name: "external-integrations", kind: "integration", status: "not_configured" },
    ]);
    expect(s.status).toBe("unverified");
    expect(s.processStatus).toBe("unverified");
  });
});

describe("statusSummary — ranking", () => {
  it("ranks unverified as worse than degraded", () => {
    // Not knowing cannot be reasoned about; a measured partial failure can.
    const s = statusSummary("customer", [proc("a", "degraded"), proc("b", "unverified")]);
    expect(s.processStatus).toBe("unverified");
  });

  it("ranks down as worst", () => {
    const s = statusSummary("customer", [proc("a", "unverified"), proc("b", "down")]);
    expect(s.processStatus).toBe("down");
  });

  it("defaults an unspecified kind to process", () => {
    const s = statusSummary("customer", [{ name: "api", status: "degraded" }]);
    expect(s.processStatus).toBe("degraded");
  });
});
