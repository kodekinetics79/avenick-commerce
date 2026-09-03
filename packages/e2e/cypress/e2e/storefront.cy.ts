import { FORBIDDEN_ON_PUBLIC_PAGES, PUBLIC_CUSTOMER_ROUTES } from "../../targets.mjs";

/**
 * Public customer storefront journeys, Cypress edition.
 *
 * Unauthenticated and read-only, so this is safe to point at any environment.
 */

describe("storefront reachability", () => {
  PUBLIC_CUSTOMER_ROUTES.forEach((route) => {
    it(`renders public route ${route}`, () => {
      cy.request({ url: route, failOnStatusCode: false }).its("status").should("be.lessThan", 400);

      cy.visit(route);
      cy.get("body").should("be.visible");
      cy.get("body").should("not.contain.text", "Application error");
      cy.get("body").should("not.contain.text", "This page could not be found");
    });
  });
});

describe("catalog discovery", () => {
  it("products listing renders content", () => {
    cy.visit("/products");
    cy.get("body").invoke("text").should("have.length.greaterThan", 0);
  });

  it("home exposes catalog navigation", () => {
    cy.visit("/");
    cy.get('a[href^="/products"]').should("exist");
    cy.get('a[href^="/brands"]').should("exist");
  });
});

describe("D-01 — no credentials on the customer login page", () => {
  // Expected to FAIL until apps/customer/src/app/login/page.tsx:65 is fixed.
  // See AVENICK_GATE_1_WORKTREE_AUDIT_2026-08-17.md.
  it("login page leaks no credential strings", () => {
    cy.visit("/login");

    FORBIDDEN_ON_PUBLIC_PAGES.forEach((secret) => {
      cy.get("body").should("not.contain.text", secret);
    });
  });
});

describe("authorization fails closed", () => {
  it("checkout redirects an anonymous visitor to login", () => {
    cy.visit("/checkout");
    cy.location("pathname").should("match", /\/login/);
  });
});
