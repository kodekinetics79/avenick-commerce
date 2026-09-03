import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db } from "@avenick/database";
import Link from "next/link";
import { Award, Search } from "lucide-react";
import {
  Button,
  CellGrid,
  EmptyState,
  Eyebrow,
  Field,
  FieldWell,
  Input,
  Num,
  PageHeader,
  StatusPill,
  Surface,
} from "@avenick/ui";

export const metadata = { title: "Brands" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { search?: string };
}

/** A server component cannot useId, and this control is unique on the page. */
const SEARCH_ID = "brand-search";

export default async function BrandsPage({ searchParams }: PageProps) {
  await requireAdminSession();

  const search = searchParams.search?.trim() || undefined;
  const brands = await db.brand.findMany({
    where: search
      ? {
          OR: [
            { nameEn: { contains: search, mode: "insensitive" } },
            { nameAr: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { nameEn: "asc" },
    include: { _count: { select: { products: { where: { deletedAt: null } } } } },
  });
  const totalProducts = brands.reduce((s, b) => s + b._count.products, 0);

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Catalogue"
          title="Brands"
          description={`${brands.length.toLocaleString()} brand${brands.length === 1 ? "" : "s"} · ${totalProducts.toLocaleString()} listings between them.`}
          // The count is of live listings, not of every row ever written. Saying
          // which is the difference between a figure and a claim.
          dateline={
            search
              ? `Brands whose English or Arabic name contains "${search}" · listing counts exclude deleted listings`
              : "Every brand in the catalogue, A to Z · listing counts exclude deleted listings"
          }
        />

        {/* Recessed, because law A reads "recessed = context or input", and a
            search bar is both. */}
        <FieldWell className="p-3">
          <form method="get" action="/brands" className="flex flex-wrap items-start gap-2">
            {/* The control had no label at all — a placeholder is not one, and a
                screen reader announced it as an unnamed edit field. */}
            <div className="min-w-0 flex-1 basis-64">
              {/* Field reserves its message line whether or not there is a
                  message, so the line is given a true one rather than left as
                  dead space: it states exactly what the query matches on. */}
              <Field
                label="Search brands"
                htmlFor={SEARCH_ID}
                hideLabel
                hint="Matches the English and Arabic name only."
              >
                <Input
                  id={SEARCH_ID}
                  type="search"
                  name="search"
                  defaultValue={search ?? ""}
                  placeholder="Search brands by English or Arabic name"
                  startIcon={<Search className="h-4 w-4" aria-hidden="true" />}
                />
              </Field>
            </div>
            <Button type="submit" variant="secondary">Search</Button>
            {search && (
              <Button variant="ghost" asChild>
                <Link href="/brands">Clear</Link>
              </Button>
            )}
          </form>
        </FieldWell>

        {brands.length === 0 ? (
          <Surface rung={1}>
            <EmptyState
              eyebrow="Nothing recorded"
              headline={search ? `No brand's name contains "${search}".` : "No brands are recorded in the catalogue."}
              body={
                search
                  ? "Brands are matched on their English and Arabic names only."
                  : "Brands are created as sellers list branded products; none has been created yet."
              }
              icon={<Award className="h-3.5 w-3.5" aria-hidden="true" />}
              action={
                search ? (
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/brands">Show every brand</Link>
                  </Button>
                ) : undefined
              }
            />
          </Surface>
        ) : (
          // One panel divided by hairlines. A brand carries three facts; twenty
          // of them as twenty bordered cards with an icon tile each was twenty
          // objects saying nothing that the names did not already say.
          <CellGrid cols={{ base: 2, sm: 3, lg: 4 }}>
            {brands.map((b) => (
              <div key={b.id} className="min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="u-ui truncate font-medium text-ink-1">{b.nameEn}</p>
                  <StatusPill tone={b.isActive ? "success" : "neutral"}>{b.isActive ? "Active" : "Inactive"}</StatusPill>
                </div>
                {b.nameAr && <p className="u-meta truncate text-ink-2" dir="rtl">{b.nameAr}</p>}
                <div className="pt-1">
                  <Eyebrow>{b._count.products === 1 ? "Listing" : "Listings"}</Eyebrow>
                  <Num value={b._count.products} />
                </div>
                {b.country && <p className="u-meta text-ink-3">{b.country}</p>}
              </div>
            ))}
          </CellGrid>
        )}
      </div>
    </AdminLayout>
  );
}
