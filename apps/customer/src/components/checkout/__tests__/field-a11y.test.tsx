// @vitest-environment jsdom

import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Field } from "@avenick/ui";
import { CheckoutField } from "../checkout-field";

afterEach(cleanup);

describe("Field", () => {
  /**
   * The defect this covers: the message line existed but had no id, so a
   * control could be announced as invalid with no way to reach the reason.
   * Checkout kept a private copy of the whole component to get around it.
   */
  it("associates the message with the control it describes", () => {
    render(
      <Field id="ck-line1" label="Address line 1" required error="Enter a street address.">
        {(a11y) => <input {...a11y} />}
      </Field>,
    );

    const input = screen.getByRole("textbox");
    const describedBy = input.getAttribute("aria-describedby")!;
    expect(input.id).toBe("ck-line1");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-required")).toBe("true");
    expect(document.getElementById(describedBy)?.textContent).toBe("Enter a street address.");
  });

  it("labels the control, so clicking the label focuses it", () => {
    render(
      <Field id="ck-city" label="City">
        {(a11y) => <input {...a11y} />}
      </Field>,
    );
    expect(screen.getByLabelText("City")).toBe(screen.getByRole("textbox"));
  });

  it("describes the control with the hint when there is no error, and is not invalid", () => {
    render(
      <Field id="ck-label" label="Address label" hint="For example Home or Office.">
        {(a11y) => <input {...a11y} />}
      </Field>,
    );
    const input = screen.getByRole("textbox");
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toBe(
      "For example Home or Office.",
    );
  });

  it("generates an id when the call site gives none, and keeps label and message pointing at the same control", () => {
    render(
      <Field label="Note">
        {(a11y) => <input {...a11y} />}
      </Field>,
    );
    const input = screen.getByRole("textbox");
    expect(input.id).toBeTruthy();
    expect(screen.getByLabelText("Note")).toBe(input);
    expect(input.getAttribute("aria-describedby")).toBe(`${input.id}-msg`);
  });

  /** 138 call sites pass a plain element. They must keep working exactly as before. */
  it("still renders a plain child, with the label associated through htmlFor", () => {
    render(
      <Field htmlFor="legacy" label="Legacy">
        <input id="legacy" />
      </Field>,
    );
    expect(screen.getByLabelText("Legacy")).toBe(screen.getByRole("textbox"));
  });

  /**
   * Checkout's own field is now this component under another name. If it ever
   * drifts back into a private copy, the wiring is what will be lost first.
   */
  it("is what CheckoutField renders", () => {
    render(
      <CheckoutField id="ck-city" label="City" required error="Pick a city we serve.">
        {(a11y) => <input {...a11y} />}
      </CheckoutField>,
    );
    const input = screen.getByRole("textbox");
    expect(input.id).toBe("ck-city");
    expect(input.getAttribute("aria-required")).toBe("true");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toBe(
      "Pick a city we serve.",
    );
  });

  it("reserves the message line even when there is nothing to say", () => {
    const { container } = render(
      <Field id="empty" label="Empty">
        {(a11y) => <input {...a11y} />}
      </Field>,
    );
    const message = container.querySelector("#empty-msg")!;
    expect(message).not.toBeNull();
    expect(message.className).toContain("min-h-[18px]");
  });
});
