# Module 9: Admin & Settings

## Status: Complete

## New Pages Created

| Route | Description |
|---|---|
| `/admin/audit` | Audit Trail: immutable log of admin + system actions, category-coded, action colors, security-flag highlight, search/filter/export |
| `/admin/settings` | Marketplace Settings: system health (services, uptime, latency), 4 config groups (General/Commerce/Notifications/Security) |

## Existing Pages Verified (no changes needed)
- `/admin/users` — User management (roles, status, portal) already complete from Phase 3
- `/admin/integrations` — Integration hub already complete from Phase 3

## Updated Files

| File | Changes |
|---|---|
| `packages/database/src/mock-data.ts` | Added `MOCK_AUDIT_LOGS`, `MOCK_SYSTEM_HEALTH` |

## Resolved
The Settings nav group (`/users`, `/integrations`, `/audit`, `/settings`) previously had two dead links (`/audit`, `/settings` → 404). All four now resolve.

## Design Highlights

### Audit Trail
- 4 stats (events 24h, admin actions, system events, security flags)
- Category icons + colors (Seller/Pricing/Finance/User/Security/etc.)
- Action color-coding (approved=green, rejected=red, flagged=amber)
- Security events highlighted red
- System actor for auto-events
- Immutability/retention footer note

### Settings
- System Health card: per-service status dots (operational/degraded pulse), latency, uptime
- Health summary: uptime 30d, avg response, API status, last deploy
- 4 settings groups with key-value rows + Edit buttons
- Commerce group exposes commission rates + VAT (ties to Finance/Pricing)
- Footer note linking config changes to audit trail

## Testing Checklist
- [ ] `/audit` shows event log with category badges
- [ ] `/audit` security events highlighted red
- [ ] `/audit` action colors (approved/rejected/flagged)
- [ ] `/settings` system health shows 6 services
- [ ] `/settings` degraded service (S3/MinIO) shows amber pulse
- [ ] `/settings` 4 config groups render
- [ ] No 404s in Settings nav group ✓
- [ ] Zero TypeScript errors ✓
- [ ] All 4 routes return 307 ✓

## Known Limitations
- Audit logs + system health are mocked — requires `audit_logs` table + real health-check probes
- Settings are read-only (Edit buttons are UI-only)
- No real RBAC enforcement beyond portal-level role check in middleware
- Search/filter/export on audit are UI-only

## MySQL Schema Notes (Future)
```sql
CREATE TABLE audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  actor_id VARCHAR(36),
  actor_name VARCHAR(200),
  actor_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  target TEXT,
  ip_address VARCHAR(45),
  metadata TEXT,                -- JSON-as-TEXT, MySQL-safe
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_actor (actor_id),
  INDEX idx_created (created_at)
);

CREATE TABLE marketplace_settings (
  id VARCHAR(36) PRIMARY KEY,
  setting_group VARCHAR(50) NOT NULL,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT,
  updated_by VARCHAR(36),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_group_key (setting_group, setting_key)
);
```

## Next Module
Module 10: Pricing & Commission Layer (new commerce module — not yet built)
