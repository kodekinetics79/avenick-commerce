// @vitest-environment jsdom

import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { Footer } from "../footer";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

// footer.tsx has no React import: Next compiles JSX with the automatic
// runtime, and this suite's transform uses the classic one.
vi.stubGlobal("React", React);

afterEach(cleanup);

const hrefs = (root: HTMLElement) =>
  within(root)
    .queryAllByRole("link")
    .map((a) => a.getAttribute("href"));

describe("Footer", () => {
  /**
   * The footer is a server component and never reads the session, yet its
   * "Company" column carried "Sign in". A signed-in buyer saw "Sign in" on
   * every page while the header beside it said "Sign out". For a visitor with
   * no session it was a duplicate of "My account", which already answers with
   * the sign-in page. The session control belongs to the chrome that knows the
   * session.
   */
  it("offers no sign-in link, because it cannot know whether one is needed", () => {
    const { container } = render(<Footer />);
    expect(hrefs(container)).not.toContain("/login");
  });

  it("keeps the account with the buyer's own things, and Company about the platform", () => {
    const { getByRole } = render(<Footer />);
    const shop = getByRole("navigation", { name: "shop" });
    const company = getByRole("navigation", { name: "company" });

    expect(hrefs(shop)).toContain("/account");
    expect(hrefs(company)).toEqual(["/about", "/contact", "/support"]);
  });

  /**
   * A buyer who prints a product or policy page into a procurement file got
   * the help band and four link columns after the content. The whole footer,
   * help band included, stays out of print.
   */
  it("stays out of a printed page", () => {
    const { container } = render(<Footer />);
    expect(container.querySelector("footer")?.className).toContain("print:hidden");
  });
});
