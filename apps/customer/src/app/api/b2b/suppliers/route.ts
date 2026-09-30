import { NextResponse } from "next/server";
import { db } from "@avenick/database";
import { getServerB2BContext } from "@/lib/b2b-server";

export const dynamic = "force-dynamic";
const RESULT_LIMIT = 20;

export async function GET(request: Request) {
  const ctx = await getServerB2BContext();
  if (!ctx) return NextResponse.json({ success: false, error: "Active company account required" }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (query.length < 2) return NextResponse.json({ success: true, data: { suppliers: [] } });

  const suppliers = await db.sellerProfile.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      OR: [
        { businessNameEn: { contains: query, mode: "insensitive" } },
        { businessNameAr: { contains: query, mode: "insensitive" } },
        { city: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: [{ businessNameEn: "asc" }, { id: "asc" }],
    take: RESULT_LIMIT,
    select: {
      id: true,
      businessNameEn: true,
      businessNameAr: true,
      city: true,
      country: true,
      tier: true,
      documents: {
        where: {
          status: "APPROVED",
          reviewedAt: { not: null },
          OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
        },
        take: 1,
        select: { type: true, reviewedAt: true },
      },
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      suppliers: suppliers.map(({ documents, ...supplier }) => ({
        ...supplier,
        verification: documents[0]?.reviewedAt
          ? { type: documents[0].type, reviewedAt: documents[0].reviewedAt.toISOString() }
          : null,
      })),
    },
  });
}
