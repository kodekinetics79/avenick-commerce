export type IntegrationPolicyEnvironment = Record<string, string | undefined>;

function normalizedSystem(system: string) {
  const value = system.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{1,31}$/.test(value)) throw new Error("Integration system is invalid");
  return value;
}

function normalizedBaseUrl(raw: string, allowHttp: boolean) {
  const url = new URL(raw);
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Integration base URL cannot contain credentials, query parameters, or fragments");
  }
  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
    throw new Error("Integration base URL must use HTTPS");
  }
  return url.toString().replace(/\/$/, "");
}

/**
 * Deployment-owned exact allowlist. Admin input can select a provisioned
 * endpoint/credential pair but can never choose an arbitrary host or env var.
 */
export function governedIntegrationPolicy(
  input: { system: string; baseUrl: string; credentialsRef: string },
  environment: IntegrationPolicyEnvironment = process.env,
) {
  const system = normalizedSystem(input.system);
  const prefix = `INTEGRATION_${system}`;
  const configuredBaseUrl = environment[`${prefix}_BASE_URL`];
  const configuredCredentialRef = environment[`${prefix}_CREDENTIAL_REF`];
  if (!configuredBaseUrl || !configuredCredentialRef) {
    throw new Error(`Integration ${system} is not provisioned in the deployment allowlist`);
  }
  if (!/^env:INTEGRATION_[A-Z][A-Z0-9_]{1,80}$/.test(configuredCredentialRef)) {
    throw new Error("Integration credential allowlist must reference a dedicated INTEGRATION_* environment variable");
  }
  const allowHttp = environment.NODE_ENV !== "production";
  const baseUrl = normalizedBaseUrl(input.baseUrl, allowHttp);
  const expectedBaseUrl = normalizedBaseUrl(configuredBaseUrl, allowHttp);
  if (baseUrl !== expectedBaseUrl) throw new Error("Integration base URL is not deployment-allowlisted");
  if (input.credentialsRef !== configuredCredentialRef) throw new Error("Integration credential reference is not deployment-allowlisted");
  return { baseUrl, credentialsRef: configuredCredentialRef, credentialEnvironmentKey: configuredCredentialRef.slice(4) };
}
