import { describe, expect, it } from "vitest";
import { manufacturerDescription, parseMennekesProductPage } from "../services/demo-product-enrichment";

const fixture = `
  <script type="application/ld+json" id="ext-schema-jsonld">{"@graph":[{"@type":"Product","brand":"MENNEKES","name":"Plug PowerTOP Xtra","sku":"13501","gtin13":"4015394305002","image":"/fileadmin/products_media/produktbilder/13501.png"}]}</script>
  <table class="figure-table">
    <tr><th>Ampere</th><td>16 A</td></tr><tr><th>Poles</th><td>3 p</td></tr>
    <tr><th>Voltage</th><td>110 V</td></tr><tr><th>Hertz</th><td>50-60 Hz</td></tr>
    <tr><th>Protection type</th><td>IP54</td></tr><tr><th>Certifications</th><td>VDE<br />EAC</td></tr>
  </table>`;

describe("official demo product enrichment", () => {
  it("binds manufacturer identity, image and technical facts into a fingerprinted record", () => {
    const product = parseMennekesProductPage(fixture, "13501");
    expect(product).toMatchObject({
      partNumber: "13501",
      name: "Plug PowerTOP Xtra",
      gtin13: "4015394305002",
      imageUrl: "https://www.mennekes.org/fileadmin/products_media/produktbilder/13501.png",
      specifications: { Ampere: "16 A", Voltage: "110 V", "Protection type": "IP54", Certifications: "VDE, EAC" },
    });
    expect(product.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(manufacturerDescription(product)).toContain("Source: https://www.mennekes.org/industry/product-details/13501/");
  });

  it("fails closed when the official identity differs", () => {
    expect(() => parseMennekesProductPage(fixture, "13502")).toThrow(/identity/i);
  });
});
