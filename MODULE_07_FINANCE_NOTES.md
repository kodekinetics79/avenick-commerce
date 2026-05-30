# Module 7: Finance

## Status: Complete

## New Pages Created

| Route | Description |
|---|---|
| `/admin/payments` | Transaction ledger: gateway, method, status (Succeeded/Pending/Failed/Refunded), retry/receipt actions |
| `/admin/settlements` | Supplier payouts: gross − commission − handling = net payout, period, pay-now/statement actions |
| `/admin/vat` | VAT periods: UAE 5% / KSA 15%, output/input/net-due, filing deadlines, file-return CTA |

## Updated Files

| File | Changes |
|---|---|
| `apps/admin/src/app/finance/page.tsx` | Rewrite: orange→purple/green, deep links to payments/settlements/vat, settlement + credit-exposure alert row, commission breakdown from settlement data |
| `packages/database/src/mock-data.ts` | Added `MOCK_PAYMENTS`, `MOCK_SETTLEMENTS`, `MOCK_VAT_PERIODS`, `MOCK_CREDIT_ACCOUNTS` |

## Design Highlights

### Finance Overview
- 4 KPI cards (Invoiced, Collected w/ rate, Outstanding, VAT payable → links to /vat)
- Two-up alert row: pending settlements + credit exposure
- Commission breakdown (gross, avg rate, B2B/B2C split) computed from settlements
- Recent invoices table (purple B2B / blue B2C badges)

### Payments
- Stats: Collected, Pending, Failed, Total Txns
- Failed-payment red alert
- Method icons (Bank/Card/mada/Apple Pay/Credit Terms), gateway column
- Status-specific actions: Retry (failed), Receipt (succeeded)

### Settlements
- Stats: Pending payout, GMV, Commission earned, Pending sellers
- Math breakdown per row: gross − commission (−rate) − handling = net payout
- "Process All Pending" header CTA, Pay-Now / Statement per row
- Bi-weekly settlement note

### VAT
- Stats: Net due (open), Output VAT, Input VAT (reclaimable), Open periods
- Filing deadline reminder banner
- UAE (FTA) + KSA (ZATCA) periods, country/rate columns
- File Return CTA on open periods

## Testing Checklist
- [ ] `/finance` VAT card links to /vat
- [ ] `/finance` settlement + credit alerts render
- [ ] `/finance` commission breakdown shows
- [ ] `/payments` failed alert + method icons + retry button
- [ ] `/settlements` net payout math correct (gross − comm − handling)
- [ ] `/settlements` Pay-Now on pending rows
- [ ] `/vat` filing deadline banner + File Return CTA
- [ ] `/vat` UAE 5% and KSA 15% rows both present
- [ ] Zero TypeScript errors ✓
- [ ] All 4 routes return 307 ✓

## Known Limitations
- All finance data mocked — requires `payments`, `settlements`, `vat_periods`, `credit_accounts` tables
- Process payout / file return / retry payment are UI-only
- Commission breakdown B2B/B2C split is estimated (68/32) not from real data
- No PDF statement/receipt generation yet

## MySQL Schema Notes (Future)
```sql
CREATE TABLE payments (
  id VARCHAR(36) PRIMARY KEY,
  reference VARCHAR(50) UNIQUE NOT NULL,
  invoice_id VARCHAR(36),
  order_id VARCHAR(36),
  method ENUM('BANK_TRANSFER','CREDIT_CARD','MADA','APPLE_PAY','CREDIT_TERMS') NOT NULL,
  gateway VARCHAR(100),
  amount DECIMAL(14,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'AED',
  status ENUM('PENDING','SUCCEEDED','FAILED','REFUNDED') DEFAULT 'PENDING',
  processed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE settlements (
  id VARCHAR(36) PRIMARY KEY,
  seller_id VARCHAR(36) NOT NULL,
  period_end DATE NOT NULL,
  gross_sales DECIMAL(14,2) NOT NULL,
  commission DECIMAL(14,2) NOT NULL,
  commission_rate DECIMAL(5,2),
  handling_fees DECIMAL(12,2) DEFAULT 0,
  net_payout DECIMAL(14,2) NOT NULL,
  status ENUM('PENDING','PROCESSING','PAID') DEFAULT 'PENDING',
  paid_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vat_periods (
  id VARCHAR(36) PRIMARY KEY,
  country VARCHAR(5) NOT NULL,
  period_label VARCHAR(50) NOT NULL,
  rate DECIMAL(5,2) NOT NULL,
  output_vat DECIMAL(14,2) DEFAULT 0,
  input_vat DECIMAL(14,2) DEFAULT 0,
  net_vat_due DECIMAL(14,2) DEFAULT 0,
  status ENUM('OPEN','FILED') DEFAULT 'OPEN',
  filing_deadline DATE,
  filed_at DATETIME
);
```

## Next Module
Module 8: Support / Disputes
