// @vitest-environment jsdom

import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FieldErrorProvider } from "@/components/b2b/validated-form";
import { PasswordInput, ValidatedPasswordField } from "../password-field";

afterEach(cleanup);

/**
 * No password field on sign-in or either registration form had a show-password
 * control, on a rule that demands an uppercase letter and a number and a
 * sign-in that is rate-limited.
 *
 * What these hold is the contract the control has to keep: a real button with
 * a constant name and its state in aria-pressed, a field that still looks like a
 * password field to a password manager (name, autocomplete, and type=password
 * again at the moment the form is submitted), and — on /b2b/register — the
 * server's per-field message still reaching the control.
 */
describe("show-password control", () => {
  it("is a real toggle button with a constant name and its state in aria-pressed", () => {
    render(<PasswordInput id="login-password" name="password" label="Password" autoComplete="current-password" revealLabel="Show password" />);

    const input = screen.getByLabelText("Password") as HTMLInputElement;
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(input.type).toBe("password");
    expect(toggle.getAttribute("type")).toBe("button");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe("login-password");

    fireEvent.click(toggle);
    expect(input.type).toBe("text");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    // Same name in both states: the state is announced by aria-pressed alone.
    expect(screen.getByRole("button", { name: "Show password" })).toBe(toggle);

    fireEvent.click(toggle);
    expect(input.type).toBe("password");
  });

  it("leaves autofill hints intact and conceals the value again on submit", () => {
    render(
      <form onSubmit={(e) => e.preventDefault()} data-testid="form">
        <PasswordInput id="reg-password" name="password" label="Password" autoComplete="new-password" revealLabel="Show password" />
      </form>,
    );
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input.name).toBe("password");
    expect(input.getAttribute("autocomplete")).toBe("new-password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input.type).toBe("text");

    fireEvent.submit(screen.getByTestId("form"));
    expect(input.type).toBe("password");
    expect(screen.getByRole("button", { name: "Show password" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("does not submit the form it sits in", () => {
    let submitted = 0;
    render(
      <form onSubmit={(e) => { e.preventDefault(); submitted += 1; }}>
        <PasswordInput name="password" label="Password" revealLabel="Show password" />
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(submitted).toBe(0);
  });

  it("keeps the buyer suite's server message wired to the control on /b2b/register", () => {
    render(
      <FieldErrorProvider errors={{ password: "Password: Must contain a number" }}>
        <ValidatedPasswordField name="password" label="Password" required minLength={8} autoComplete="new-password" revealLabel="Show password" />
      </FieldErrorProvider>,
    );
    const input = screen.getByLabelText(/Password/) as HTMLInputElement;
    expect(input.type).toBe("password");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toBe(
      "Password: Must contain a number",
    );

    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle.getAttribute("aria-controls")).toBe(input.id);
    fireEvent.click(toggle);
    expect(input.type).toBe("text");
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });
});
