# Module 10: Pricing & Commission Layer

## Status: Complete

## New Page Created

| Route | Description |
|---|---|
| `/admin/pricing` | Pricing & Commission center: margin analysis, bulk tiers, commission rules, contract pricing |

## Updated Files

| File | Changes |
|---|---|
| `apps/admin/src/components/layout/admin-layout.tsx` | Added "Pricing & Commission" nav item to Commerce group (Coins icon) |
| `packages/database/src/mock-data.ts` | Added `MOCK_PRICING_PRODUCTS`, `MOCK_BULK_TIERS`, `MOCK_CONTRACT_PRICING`, `MOCK_COMMISSION_RULES` |

## Design Highlights

### Pricing & Commission Page
- **4 stat cards**: avg gross margin (color-coded), active contracts, commission rules, bulk tiers
- **Margin Analysis table**: computes per-product gross margin live
  - `Gross Margin = B2C Price − Supplier Cost − Commission − Handling Fee`
  - Shows supplier cost, B2C/B2B price, commission (amount + rate), handling, VAT, gross margin (AED + %)
  - Margin % color-coded: ≥35% green, ≥20% amber, <20% red
- **Bulk Pricing Tiers**: Standard/Bulk/Wholesale/Enterprise with savings % vs base tier
- **Commission Rules**: default B2C/B2B, category-specific, tier-based, volume, new-seller promo; active/scheduled status
- **Contract Pricing**: customer-specific negotiated prices, discount vs standard, expiring highlight + renew CTA

## Pricing Concepts Covered (per spec)
- ✓ B2C retail price
- ✓ B2B bulk price
- ✓ Supplier base price (cost)
- ✓ Marketplace selling price
- ✓ Bulk price tiers
- ✓ Customer-specific / contract pricing
- ✓ Commission rules (multiple scopes)
- ✓ Warehouse handling fee
- ✓ VAT/tax (pass-through)
- ✓ Gross margin preview (live computed)
- RFQ negotiated price → handled in Module 2 (B2B quotes)
- Delivery fee → handled in cart/checkout (Module 1)

## Testing Checklist
- [ ] `/pricing` appears in Commerce nav group
- [ ] Margin analysis table computes gross margin correctly
- [ ] Margin % color-coded (green/amber/red)
- [ ] Bulk tiers show savings % vs base
- [ ] Commission rules show active/scheduled status
- [ ] Contract pricing shows discount + expiring highlight
- [ ] Zero TypeScript errors ✓
- [ ] Route returns 307 ✓

## Known Limitations
- All pricing data mocked — `ProductPrice` table exists in schema but page uses mock for richer demo
- Margin calc is illustrative (real calc would use actual `ProductPrice` + `SellerProfile.commissionRate`)
- New rule / edit / renew actions are UI-only
- No price-change history/audit integration yet (would log to Module 9 audit trail)

## MySQL Schema Notes (Future)
```sql
CREATE TABLE commission_rules (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  scope_type ENUM('GLOBAL','CATEGORY','SELLER','SELLER_TIER','VOLUME') NOT NULL,
  scope_value VARCHAR(200),
  rate DECIMAL(5,2) NOT NULL,
  rate_type ENUM('PERCENTAGE','FIXED') DEFAULT 'PERCENTAGE',
  status ENUM('ACTIVE','SCHEDULED','INACTIVE') DEFAULT 'ACTIVE',
  priority INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contract_pricing (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  contract_price DECIMAL(12,2) NOT NULL,
  min_qty INT DEFAULT 1,
  valid_from DATE,
  valid_until DATE,
  status ENUM('ACTIVE','EXPIRING','EXPIRED') DEFAULT 'ACTIVE',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_company_product (company_id, product_id)
);

-- bulk tiers already supported by existing ProductPrice (minQty/maxQty/type)
```

## Module Series Status
Completed modules 1–10. Remaining Phase-3 pages (AI Insights, Automation, Integrations) already
exist and are functional from Phase 3 — available for enhancement passes if desired.
