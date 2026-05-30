import { z } from "zod";

// ─── Auth ────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
});

export const RegisterConsumerSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  email: z.string().email(),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Invalid phone number").optional(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[0-9]/, "Must contain a number"),
  language: z.enum(["AR", "EN"]).default("AR"),
});

export const RegisterBusinessSchema = z.object({
  // Company info
  companyNameEn: z.string().min(2).max(100),
  companyNameAr: z.string().min(2).max(100).optional(),
  crNumber: z.string().min(5).max(30),
  vatNumber: z.string().max(30).optional(),
  industry: z.enum([
    "FOOD_BEVERAGE", "CONSTRUCTION", "HEALTHCARE", "HOSPITALITY",
    "RETAIL", "MANUFACTURING", "OIL_GAS", "TECHNOLOGY", "OTHER",
  ]),
  companySize: z.enum(["MICRO", "SMALL", "MEDIUM", "LARGE", "ENTERPRISE"]),
  country: z.enum(["AE", "SA", "QA", "KW", "BH", "OM"]),
  city: z.string().min(2).max(50),
  // Admin user info
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  email: z.string().email(),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/).optional(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
  language: z.enum(["AR", "EN"]).default("AR"),
});

// ─── Product ─────────────────────────────────────────────────────────────────

export const CreateProductSchema = z.object({
  sku: z.string().min(3).max(50),
  nameEn: z.string().min(2).max(200),
  nameAr: z.string().min(2).max(200),
  descriptionEn: z.string().max(5000).optional(),
  descriptionAr: z.string().max(5000).optional(),
  categoryId: z.string().cuid(),
  brand: z.string().max(100).optional(),
  origin: z.string().length(2).optional(),
  weight: z.number().positive().optional(),
  isB2CEnabled: z.boolean().default(false),
  isB2BEnabled: z.boolean().default(true),
  tags: z.array(z.string()).max(20).default([]),
  pricingTiers: z.array(
    z.object({
      minQty: z.number().int().positive(),
      maxQty: z.number().int().positive().optional(),
      priceAED: z.number().positive(),
      priceSAR: z.number().positive().optional(),
      type: z.enum(["B2B", "B2C"]),
    }),
  ).min(1),
  inventoryQty: z.number().int().nonnegative().default(0),
  reorderPoint: z.number().int().nonnegative().default(10),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;

// ─── Order ────────────────────────────────────���──────────────────────────────

export const CreateOrderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().cuid(),
      variantId: z.string().cuid().optional(),
      quantity: z.number().int().positive(),
    }),
  ).min(1),
  shippingAddressId: z.string().cuid().optional(),
  shippingAddress: z.object({
    label: z.string(),
    line1: z.string().min(5),
    line2: z.string().optional(),
    city: z.string(),
    country: z.enum(["AE", "SA", "QA", "KW", "BH", "OM"]),
    postalCode: z.string().optional(),
  }).optional(),
  currency: z.enum(["AED", "SAR", "QAR", "KWD", "BHD", "OMR", "USD"]).default("AED"),
  notes: z.string().max(500).optional(),
});

// ─── Seller Onboarding ────────────────────��──────────────────────────────────

export const SellerOnboardingSchema = z.object({
  businessNameEn: z.string().min(2).max(100),
  businessNameAr: z.string().min(2).max(100).optional(),
  crNumber: z.string().min(5).max(30),
  vatNumber: z.string().max(30).optional(),
  type: z.enum(["MANUFACTURER", "DISTRIBUTOR", "IMPORTER", "RETAILER"]),
  country: z.enum(["AE", "SA", "QA", "KW", "BH", "OM"]),
  city: z.string().min(2).max(50),
  description: z.string().max(1000).optional(),
  descriptionAr: z.string().max(1000).optional(),
  bankIban: z.string().min(15).max(34).optional(),
  bankName: z.string().max(100).optional(),
  bankAccountName: z.string().max(100).optional(),
});

// ─── Address ─────────────────────────────────────────────────────────────────

export const AddressSchema = z.object({
  label: z.string().min(1).max(50),
  line1: z.string().min(5).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(2).max(100),
  country: z.enum(["AE", "SA", "QA", "KW", "BH", "OM"]),
  postalCode: z.string().max(20).optional(),
  isDefault: z.boolean().default(false),
});

// ─── Purchase Order ────��─────────────────────────────────────────────────────

export const CreatePOSchema = z.object({
  companyId: z.string().cuid(),
  items: z.array(
    z.object({
      productId: z.string().cuid(),
      quantity: z.number().int().positive(),
    }),
  ).min(1),
  requiredDate: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  currency: z.enum(["AED", "SAR", "QAR", "KWD", "BHD", "OMR", "USD"]).default("AED"),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterConsumerInput = z.infer<typeof RegisterConsumerSchema>;
export type RegisterBusinessInput = z.infer<typeof RegisterBusinessSchema>;
export type SellerOnboardingInput = z.infer<typeof SellerOnboardingSchema>;
export type AddressInput = z.infer<typeof AddressSchema>;
export type CreatePOInput = z.infer<typeof CreatePOSchema>;
