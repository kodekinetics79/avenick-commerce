# Branding Update Notes — Manzil → Avenick Commerce

## Files Changed

### Customer App

| File | Old Value | New Value |
|------|-----------|-----------|
| `apps/customer/src/app/layout.tsx` | `"Manzil \| منزل"` (title) | `"Avenick Commerce"` |
| `apps/customer/src/app/layout.tsx` | `"%s \| Manzil"` (template) | `"%s \| Avenick Commerce"` |
| `apps/customer/src/app/layout.tsx` | description with "منزل" | Updated description |
| `apps/customer/src/components/layout/header.tsx` | `منزل <span>Manzil</span>` (logo) | `Avenick <span>Commerce</span>` |
| `apps/customer/src/components/layout/header.tsx` | "Deals" and "Brands" added to nav | New nav items |
| `apps/customer/src/components/layout/footer.tsx` | `منزل <span>Manzil</span>` | `Avenick <span>Commerce</span>` |
| `apps/customer/src/components/layout/footer.tsx` | `© ... Manzil. All rights reserved. منصة منزل` | `© ... Avenick Commerce. All rights reserved.` |
| `apps/customer/src/app/login/page.tsx` | `<h1>منزل</h1>` | `<h1>Welcome to Avenick Commerce</h1>` |
| `apps/customer/src/app/login/page.tsx` | `"Sign in to your account / تسجيل الدخول"` | `"B2B-first. B2C-ready. Built for modern trade."` |
| `apps/customer/src/app/login/page.tsx` | `buyer@manzil.test` | `buyer@avenick.test` |
| `apps/customer/src/app/page.tsx` | `منزل` / `"Your destination for everything"` | `"Avenick Commerce"` / `"B2B-first. B2C-ready."` |
| `apps/customer/src/app/page.tsx` | placehold image alt "Manzil Marketplace" | "Avenick Commerce Marketplace" |
| `apps/customer/src/app/b2b/register/page.tsx` | `"Grow Your Business with Manzil"` | `"Grow Your Business with Avenick Commerce"` |

### Seller App

| File | Old Value | New Value |
|------|-----------|-----------|
| `apps/seller/src/app/layout.tsx` | `"Seller Central \| Manzil"` | `"Seller Central \| Avenick Commerce"` |
| `apps/seller/src/app/layout.tsx` | `"Manzil Seller Central — Manage your store"` | `"Avenick Commerce Seller Central — Manage your store"` |
| `apps/seller/src/app/login/page.tsx` | `"مركز البائع — منزل"` | `"Avenick Commerce — Modern Trade OS"` |
| `apps/seller/src/app/login/page.tsx` | `seller@manzil.test` | `seller@avenick.test` |
| `apps/seller/src/components/layout/seller-layout.tsx` | `"Seller Central"` (top bar) | `"Avenick Commerce — Seller Central"` |

### Admin App

| File | Old Value | New Value |
|------|-----------|-----------|
| `apps/admin/src/app/layout.tsx` | `"Admin Console \| Manzil"` | `"Admin Console \| Avenick Commerce"` |
| `apps/admin/src/app/layout.tsx` | `"Manzil Admin Console"` | `"Avenick Commerce Admin Console"` |
| `apps/admin/src/app/login/page.tsx` | `"Manzil Platform Operations"` | `"Avenick Commerce — Platform Operations"` |
| `apps/admin/src/app/login/page.tsx` | `admin@manzil.test` | `admin@avenick.test` |
| `apps/admin/src/app/dashboard/page.tsx` | `"Manzil Platform Operations"` (subheading) | `"Avenick Commerce — Modern trade command center"` |
| `apps/admin/src/components/layout/admin-layout.tsx` | `"منزل Admin"` (sidebar brand) | `"Avenick Commerce"` |
| `apps/admin/src/components/layout/admin-layout.tsx` | `"Operations Console"` | `"Modern Trade OS"` |

## What Was NOT Changed

- Package names: `@manzil/auth`, `@manzil/database`, `@manzil/ui`, `@manzil/utils`, `@manzil/types` — kept as-is
- Database name: `manzil_db` in `DATABASE_URL`
- Environment variables: no env vars changed
- `manzil-cart` localStorage key in `apps/customer/src/stores/cart.ts` — internal identifier, not user-visible
- `MANZIL_LOCALE` cookie name in header.tsx — internal, not user-visible
- File and folder names (would break imports)
- API route paths
- i18n message keys
