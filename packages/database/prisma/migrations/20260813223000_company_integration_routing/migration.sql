CREATE TABLE "IntegrationCompanyRoute" (
  "id" TEXT NOT NULL,
  "tenantKey" TEXT NOT NULL DEFAULT 'default',
  "companyId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'ORDER_SUBMISSION',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationCompanyRoute_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IntegrationCompanyRoute_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "IntegrationCompanyRoute_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "IntegrationCompanyRoute_tenantKey_companyId_connectionId_purpose_key"
  ON "IntegrationCompanyRoute"("tenantKey", "companyId", "connectionId", "purpose");
CREATE INDEX "IntegrationCompanyRoute_tenantKey_companyId_purpose_idx"
  ON "IntegrationCompanyRoute"("tenantKey", "companyId", "purpose");
CREATE INDEX "IntegrationCompanyRoute_connectionId_idx"
  ON "IntegrationCompanyRoute"("connectionId");
