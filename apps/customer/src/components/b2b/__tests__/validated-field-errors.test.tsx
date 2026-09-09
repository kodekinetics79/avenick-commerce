// @vitest-environment jsdom

import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  FieldErrorProvider,
  ValidatedSelectField,
  ValidatedTextField,
} from "../validated-form";

afterEach(cleanup);

/**
 * The defect these cover: /api/auth/register/business has always returned a
 * `fieldErrors` map naming each offending field, and /b2b/register rendered
 * only the flat sentence — under a control that had no id, no
 * `aria-describedby` and no error slot at all. A screen reader could be told a
 * field existed and never that it had been rejected.
 *
 * The form is driven through <ValidatedForm>, whose `<form action={fn}>` is a
 * Next-supplied capability that a bare react-dom 18.3 render does not have, so
 * these exercise the provider the form wraps its children in rather than a
 * simulated submission. What is under test is the wiring between a field's
 * NAME — the key the endpoint files its message under — and the control.
 */
describe("the registration form's fields carry the server's own reasons", () => {
  it("points a rejected text control at the message that explains it", () => {
    render(
      <FieldErrorProvider
        errors={{ crNumber: "Commercial registration number: String must contain at least 5 character(s)" }}
      >
        <ValidatedTextField name="crNumber" label="Commercial registration number" required />
      </FieldErrorProvider>,
    );

    const input = screen.getByLabelText(/Commercial registration number/);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-required")).toBe("true");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toBe(
      "Commercial registration number: String must contain at least 5 character(s)",
    );
  });

  it("points a rejected select at its own message and leaves its options alone", () => {
    render(
      <FieldErrorProvider errors={{ industry: "Industry: Invalid enum value." }}>
        <ValidatedSelectField name="industry" label="Industry" required defaultValue="">
          <option value="" disabled>
            Select an industry
          </option>
          <option value="ELECTRONICS">Electronics</option>
        </ValidatedSelectField>
      </FieldErrorProvider>,
    );

    const select = screen.getByLabelText(/Industry/);
    expect(select.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(select.getAttribute("aria-describedby")!)?.textContent).toBe(
      "Industry: Invalid enum value.",
    );
    expect(screen.getByRole("option", { name: "Electronics" })).toBeDefined();
  });

  it("marks only the field the server named, not the ones beside it", () => {
    render(
      <FieldErrorProvider errors={{ password: "Password must contain a number" }}>
        <ValidatedTextField type="password" name="password" label="Password" required />
        <ValidatedTextField type="email" name="email" label="Work email" required />
      </FieldErrorProvider>,
    );

    expect(screen.getByLabelText(/Password/).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText(/Work email/).getAttribute("aria-invalid")).toBeNull();
  });

  it("shows the hint, and is not invalid, when the last attempt named no field", () => {
    render(
      <FieldErrorProvider>
        <ValidatedTextField name="vatNumber" label="VAT number" hint="Add it now to have tax invoices issued against it." />
      </FieldErrorProvider>,
    );

    const input = screen.getByLabelText("VAT number");
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toBe(
      "Add it now to have tax invoices issued against it.",
    );
  });

  /**
   * The name is what the endpoint keys its map by AND what the browser posts.
   * If a field wrapper ever stopped passing it through, the message would land
   * on nothing and the value would never reach the server — the same silence,
   * twice.
   */
  it("posts under the same name it looks its message up by", () => {
    render(
      <FieldErrorProvider errors={{ companyNameEn: "Company name (English) is required." }}>
        <ValidatedTextField name="companyNameEn" label="Company name (English)" required />
      </FieldErrorProvider>,
    );
    expect(screen.getByLabelText(/Company name \(English\)/).getAttribute("name")).toBe("companyNameEn");
  });
});
