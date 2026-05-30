import { NextRequest, NextResponse } from "next/server";
import { db } from "@manzil/database";
import bcrypt from "bcryptjs";
import { RegisterConsumerSchema } from "@manzil/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RegisterConsumerSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 });

    const { email, password, firstName, lastName, phone, language } = parsed.data;

    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return NextResponse.json({ success: false, error: "Email already registered" }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);
    await db.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        phone: phone ?? null,
        role: "CONSUMER",
        status: "ACTIVE",
        language: language === "AR" ? "AR" : "EN",
      },
    });

    return NextResponse.json({ success: true, message: "Account created successfully" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: "Registration failed" }, { status: 500 });
  }
}
