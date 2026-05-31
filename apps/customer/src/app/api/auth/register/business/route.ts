import { NextRequest, NextResponse } from "next/server";
import { db } from "@avenick/database";
import bcrypt from "bcryptjs";
import { RegisterBusinessSchema } from "@avenick/types";
import type { Country, Industry, CompanySize } from "@avenick/database";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RegisterBusinessSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 });

    const { email, password, firstName, lastName, phone, language, companyNameEn, companyNameAr, crNumber, vatNumber, industry, companySize, country, city } = parsed.data;

    const existingUser = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) return NextResponse.json({ success: false, error: "Email already registered" }, { status: 409 });

    const existingCompany = crNumber ? await db.company.findUnique({ where: { crNumber } }) : null;
    if (existingCompany) return NextResponse.json({ success: false, error: "Company CR number already registered" }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        phone: phone ?? null,
        role: "COMPANY_ADMIN",
        status: "ACTIVE",
        language: language === "AR" ? "AR" : "EN",
      },
    });

    await db.company.create({
      data: {
        nameEn: companyNameEn,
        nameAr: companyNameAr ?? null,
        crNumber: crNumber ?? null,
        vatNumber: vatNumber ?? null,
        industry: industry as Industry,
        size: (companySize ?? "SMALL") as CompanySize,
        country: country as Country,
        city: city ?? "Dubai",
        status: "PENDING_VERIFICATION",
        members: { create: { userId: user.id, role: "COMPANY_ADMIN" } },
      },
    });

    return NextResponse.json({ success: true, message: "Business account created" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: "Registration failed" }, { status: 500 });
  }
}
