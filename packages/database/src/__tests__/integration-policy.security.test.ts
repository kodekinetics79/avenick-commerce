import { describe, expect, it } from "vitest";
import { governedIntegrationPolicy } from "../services/integration-policy";

const environment = {
  NODE_ENV: "production",
  INTEGRATION_D365_BASE_URL: "https://erp.example.test/api",
  INTEGRATION_D365_CREDENTIAL_REF: "env:INTEGRATION_D365_TOKEN",
};

describe("governed integration deployment allowlist", () => {
  it("accepts only the exact deployment-owned endpoint and dedicated credential", () => {
    expect(governedIntegrationPolicy({
      system: "D365", baseUrl: "https://erp.example.test/api/", credentialsRef: "env:INTEGRATION_D365_TOKEN",
    }, environment)).toMatchObject({ baseUrl: "https://erp.example.test/api", credentialEnvironmentKey: "INTEGRATION_D365_TOKEN" });
  });

  it("rejects SSRF endpoints, credential injection, arbitrary secrets, and unprovisioned systems", () => {
    expect(() => governedIntegrationPolicy({ system: "D365", baseUrl: "https://169.254.169.254/latest", credentialsRef: "env:INTEGRATION_D365_TOKEN" }, environment)).toThrow(/allowlisted/);
    expect(() => governedIntegrationPolicy({ system: "D365", baseUrl: "https://erp.example.test/api?next=https://evil.test", credentialsRef: "env:INTEGRATION_D365_TOKEN" }, environment)).toThrow(/query/);
    expect(() => governedIntegrationPolicy({ system: "D365", baseUrl: "https://erp.example.test/api", credentialsRef: "env:DATABASE_URL" }, environment)).toThrow(/allowlisted/);
    expect(() => governedIntegrationPolicy({ system: "SAP", baseUrl: "https://sap.example.test", credentialsRef: "env:INTEGRATION_SAP_TOKEN" }, environment)).toThrow(/not provisioned/);
  });
});
