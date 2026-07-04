# Avenick Client Pilot

## Portal URLs

| Role | Frontend | Backend |
| --- | --- | --- |
| Customer and company buyer | `https://avenick.vercel.app` | `https://avenick-commerce.onrender.com` |
| Seller | `https://avenick-seller.vercel.app` | `https://avenick-seller.onrender.com` |
| Platform admin | `https://avenick-admin.vercel.app` | `https://avenick-admin.onrender.com` |

If the seller or admin Vercel project uses a different production domain, update
its `NEXTAUTH_URL` on Render and the corresponding URL in this document.

## Demo Accounts

All seeded accounts use `Password123!`.

| Role | Email |
| --- | --- |
| Customer | `buyer@avenick.test` |
| Company buyer and approver | `company@avenick.test` |
| Seller owner | `seller@avenick.test` |
| Platform administrator | `admin@avenick.test` |

## Required Environment Contract

Use the same Neon connection for `DATABASE_URL` and `DIRECT_URL` on all three
Render services. Neon recommends a pooled URL for runtime and a direct URL for
migrations when both are available.

Each Vercel frontend and its matching Render backend must share identical
`AUTH_SECRET` and `NEXTAUTH_SECRET` values. Secrets may differ between portals.

Customer Vercel:

```env
AUTH_SECRET=<customer-shared-secret>
NEXTAUTH_SECRET=<customer-shared-secret>
NEXTAUTH_URL=https://avenick.vercel.app
NEXT_PUBLIC_BACKEND_URL=https://avenick-commerce.onrender.com
AUTH_TRUST_HOST=true
```

Seller Vercel:

```env
AUTH_SECRET=<seller-shared-secret>
NEXTAUTH_SECRET=<seller-shared-secret>
NEXTAUTH_URL=https://avenick-seller.vercel.app
NEXT_PUBLIC_SELLER_BACKEND_URL=https://avenick-seller.onrender.com
AUTH_TRUST_HOST=true
```

Admin Vercel:

```env
AUTH_SECRET=<admin-shared-secret>
NEXTAUTH_SECRET=<admin-shared-secret>
NEXTAUTH_URL=https://avenick-admin.vercel.app
NEXT_PUBLIC_ADMIN_BACKEND_URL=https://avenick-admin.onrender.com
AUTH_TRUST_HOST=true
```

Every Render service additionally requires:

```env
DATABASE_URL=<neon-pooled-url>
DIRECT_URL=<neon-direct-url>
NODE_ENV=production
AUTH_TRUST_HOST=true
```

## Client Demonstration

1. Open the customer storefront and show products, brands, search, and deals.
2. Sign in as `company@avenick.test` and open **Avenick for Business**.
3. Show company spend, open RFQs, recent orders, and the pending approval alert.
4. Open **Quotes & RFQs**, inspect `RFQ-2026-002`, and explain the supplier quote.
5. Create a new RFQ for a realistic bulk requirement.
6. Open **Purchase Orders** and show pending, approved, and rejected examples.
7. Sign in to the seller portal and open the RFQ inbox.
8. Select the new RFQ, enter unit prices, and submit the supplier quote.
9. Return to the buyer portal, open the quoted RFQ, and accept it.
10. Approve a pending PO, place it as an order, and show the generated invoice.
11. Sign in to the admin portal and show marketplace GMV, active companies,
    suppliers, pending seller review, and the audit trail.

## Verification Gate

Before every client session:

```bash
pnpm turbo run build --filter=@avenick/customer --filter=@avenick/seller --filter=@avenick/admin
curl -fsS https://avenick-commerce.onrender.com/api/ready
curl -fsS https://avenick-seller.onrender.com/api/ready
curl -fsS https://avenick-admin.onrender.com/api/ready
```

Run `pnpm --filter @avenick/database db:seed` only against the dedicated pilot
database. The seed intentionally resets demo transactions to a known state.
