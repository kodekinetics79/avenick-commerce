# Module 1: B2C Marketplace

## Status: Complete

## Changes Made

### New Files
- `apps/customer/src/stores/wishlist.ts` — Zustand + persist store for wishlist (replaces MOCK_WISHLIST_PRODUCTS)

### Updated Files

| File | Changes |
|---|---|
| `components/products/product-card.tsx` | Wishlist heart button, star rating display, discount badge, delivery badge, `type="button"` fix |
| `app/products/page.tsx` | Filter sidebar (categories, price range, in-stock), sort dropdown, pagination, better empty state |
| `app/products/[slug]/page.tsx` | Fixed bad fetch pattern (now uses `useEffect`), tabs (Description/Specs/Reviews/Shipping), mock reviews, B2B pricing grid, trust badges, related seller info, wishlist button |
| `app/cart/page.tsx` | Free shipping progress (segment bars, no inline styles), promo code input (AVENICK10 = 10% off), save-for-later, delivery estimate, better empty state |
| `app/wishlist/page.tsx` | Now reads from Zustand store (real state), Add All to Cart, remove from wishlist |
| `app/search/page.tsx` | Popular searches, category browse, better empty state with suggestions |

## Testing Checklist
- [ ] Product card shows heart/wishlist button
- [ ] Wishlist button persists across page navigation (Zustand persist)
- [ ] Product card shows star rating and discount badge
- [ ] Products page filter sidebar works (category, price, in-stock)
- [ ] Products page sort dropdown works
- [ ] Products page pagination renders for >24 results
- [ ] Product detail uses `useEffect` (no double-fetch)
- [ ] Product detail tabs switch correctly
- [ ] Product detail reviews section renders mock reviews
- [ ] Cart free shipping progress bar works without inline styles
- [ ] Cart promo code AVENICK10 applies 10% discount
- [ ] Cart save-for-later moves item to wishlist
- [ ] Wishlist page reads live store state
- [ ] Search page shows popular searches when no query
- [ ] Search empty state shows suggested keywords

## Known Limitations
- Product ratings are mocked (4.2 default) — no reviews table in schema yet
- Wishlist is client-side only (not persisted to DB) — requires auth + API integration
- Promo code is hardcoded for demo (AVENICK10)
- Product detail still client-rendered — could be improved with server component + API route returning full data
- Price range filter is wired to URL but Prisma query does not yet filter by price (price is on related `ProductPrice` table — requires join filter)

## MySQL Schema Notes (Future)
```sql
CREATE TABLE product_reviews (
  id VARCHAR(36) PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title VARCHAR(200),
  body TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product (product_id)
);

CREATE TABLE wishlists (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_product (user_id, product_id)
);

CREATE TABLE promo_codes (
  id VARCHAR(36) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_pct DECIMAL(5,2),
  discount_fixed DECIMAL(10,2),
  min_order DECIMAL(10,2),
  expires_at DATETIME,
  is_active TINYINT(1) DEFAULT 1
);
```

## Next Module
Proceed to Module 2: B2B Trade (companies, RFQs, quotes, approvals).
