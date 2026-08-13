import { NextResponse } from "next/server";
import { getServerB2BContext, B2B_APPROVER_ROLES } from "@/lib/b2b-server";

export const dynamic = "force-dynamic";

const COMPANY_CURRENCY: Record<string, string> = {
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
  KW: "KWD",
  OM: "OMR",
  BH: "BHD",
};

export async function GET() {
  const ctx = await getServerB2BContext();
  if (!ctx) {
    return NextResponse.json({ success: false, error: "Active company account required" }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    data: {
      companyId: ctx.companyId,
      companyName: ctx.company.nameEn,
      country: ctx.company.country,
      currency: COMPANY_CURRENCY[ctx.company.country] ?? "USD",
      memberRole: ctx.member.role,
      spendLimit: ctx.member.spendLimit == null ? null : Number(ctx.member.spendLimit),
      isApprover: B2B_APPROVER_ROLES.includes(ctx.member.role),
      paymentTermsDays: ctx.company.paymentTerms,
      creditLimit: ctx.company.creditLimit == null ? null : Number(ctx.company.creditLimit),
    },
  });
}
