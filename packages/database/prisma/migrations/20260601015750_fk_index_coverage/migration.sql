-- CreateIndex
CREATE INDEX "AuditLog_sellerId_idx" ON "AuditLog"("sellerId");

-- CreateIndex
CREATE INDEX "ProductReview_userId_idx" ON "ProductReview"("userId");

-- CreateIndex
CREATE INDEX "RFQRequest_companyId_idx" ON "RFQRequest"("companyId");

-- CreateIndex
CREATE INDEX "RequisitionListItem_productId_idx" ON "RequisitionListItem"("productId");
