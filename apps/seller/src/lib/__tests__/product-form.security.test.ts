import { describe, expect, it } from "vitest";
import { countryCommerceDefaults, parseSellerProductForm, SELLER_MUTABLE_PRODUCT_STATUSES } from "../product-form";

function validForm() {
  const form = new FormData();
  form.set("categoryId", "category-1");
  form.set("sku", "MCB-20A-001");
  form.set("nameEn", "Industrial circuit breaker");
  form.set("nameAr", "قاطع دائرة صناعي");
  form.set("imageUrl", "https://www.mennekes.org/fileadmin/products_media/mcb.jpg");
  form.set("origin", "SA");
  form.set("moq", "1");
  form.set("currency", "SAR");
  form.set("vatRate", "15");
  form.set("b2bEnabled", "on");
  form.set("b2bPrice", "120.50");
  return form;
}

describe("seller product submission form", () => {
  it("never exposes ACTIVE as a seller-controlled transition", () => {
    expect(SELLER_MUTABLE_PRODUCT_STATUSES).toContain("PENDING_REVIEW");
    expect(SELLER_MUTABLE_PRODUCT_STATUSES).not.toContain("ACTIVE");
  });
  it("parses a governed Saudi B2B listing without inventing a B2C rail", () => {
    const parsed = parseSellerProductForm(validForm());
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toMatchObject({ currency: "SAR", vatRate: 15, b2bEnabled: true, b2cEnabled: false, b2bPrice: 120.5 });
  });

  it("rejects missing channels and insecure image origins", () => {
    const noChannel = validForm();
    noChannel.delete("b2bEnabled");
    expect(parseSellerProductForm(noChannel).success).toBe(false);

    const insecureImage = validForm();
    insecureImage.set("imageUrl", "http://manufacturer.example/mcb.jpg");
    expect(parseSellerProductForm(insecureImage).success).toBe(false);

    const arbitraryImage = validForm();
    arbitraryImage.set("imageUrl", "https://attacker.example/mcb.jpg");
    expect(parseSellerProductForm(arbitraryImage).success).toBe(false);
  });

  it("derives market defaults instead of assuming AED", () => {
    expect(countryCommerceDefaults("SA")).toEqual({ currency: "SAR", vatRate: 15 });
    expect(countryCommerceDefaults("AE")).toEqual({ currency: "AED", vatRate: 5 });
  });
});
