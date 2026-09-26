// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileNav } from "../mobile-nav";

const navigation = vi.hoisted(() => ({
  pathname: "/products",
  prevented: false,
}));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("../locale-toggle", () => ({
  LocaleToggle: () => <button>Language</button>,
}));
// Model Next's navigation after its caller's handler, without leaving jsdom.
vi.mock("next/link", () => ({
  default: React.forwardRef<HTMLAnchorElement, React.ComponentProps<"a">>(
    function Link({ onClick, ...props }, ref) {
      return (
        <a
          {...props}
          ref={ref}
          onClick={(event) => {
            onClick?.(event);
            navigation.prevented = event.defaultPrevented;
            event.preventDefault();
          }}
        />
      );
    },
  ),
}));
vi.stubGlobal("React", React);
afterEach(cleanup);
beforeEach(() => {
  navigation.pathname = "/products";
  navigation.prevented = false;
});

function Harness({ arabic = false }: { arabic?: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div dir={arabic ? "rtl" : "ltr"}>
      <button onClick={() => setOpen(true)}>Menu</button>
      <MobileNav
        open={open}
        onOpenChange={setOpen}
        title="Navigation"
        closeLabel="Close"
        navLabel="Shop navigation"
        accountLabel="Account navigation"
        items={[
          { href: "/products", label: arabic ? "المنتجات" : "Shop" },
          { href: "/products?category=tools", label: "Tools" },
        ]}
        accountItems={[{ href: "/products?b2b=true", label: "Business" }]}
        signIn={{ href: "/products?signIn=1", label: "Sign in" }}
        action={{ href: "/products?currency=SAR", label: "Footer action" }}
        themeLabels={{ toDark: "Dark", toLight: "Light" }}
        isActive={(href) => href === navigation.pathname}
      />
    </div>
  );
}

describe("mobile navigation recovery", () => {
  it.each(["Shop", "Tools", "Business", "Sign in", "Footer action"])(
    "dismisses on ordinary %s activation without cancelling navigation",
    async (name) => {
      const user = userEvent.setup();
      render(<Harness />);
      await user.click(screen.getByRole("button", { name: "Menu" }));
      await user.click(screen.getByRole("link", { name }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(navigation.prevented).toBe(false);
    },
  );

  it.each([false, true])(
    "keeps Enter navigation and restores usable focus (Arabic=%s)",
    async (arabic) => {
      const user = userEvent.setup();
      render(<Harness arabic={arabic} />);
      const trigger = screen.getByRole("button", { name: "Menu" });
      await user.click(trigger);
      screen.getByRole("link", { name: arabic ? "المنتجات" : "Shop" }).focus();
      await user.keyboard("{Enter}");
      expect(screen.queryByRole("dialog")).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(trigger));
      expect(navigation.prevented).toBe(false);
    },
  );

  it.each([
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
  ])("preserves modified activation %j", async (modifier) => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    for (const name of ["Shop", "Business", "Sign in", "Footer action"]) {
      fireEvent.click(screen.getByRole("link", { name }), modifier);
      expect(screen.getByRole("dialog")).toBeTruthy();
      expect(navigation.prevented).toBe(false);
    }
  });

  it("still dismisses with Escape and a subsequent pathname change", async () => {
    const user = userEvent.setup();
    const view = render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Menu" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Menu" }));
    navigation.pathname = "/account";
    view.rerender(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("leaves cancelled activation and a new browsing context open", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const link = screen.getByRole("link", { name: "Shop" });
    const cancelled = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    cancelled.preventDefault();
    fireEvent(link, cancelled);
    expect(screen.getByRole("dialog")).toBeTruthy();
    link.setAttribute("target", "_blank");
    fireEvent.click(link);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(navigation.prevented).toBe(false);
  });

  it("restores focus after footer Enter activation with exit-animation styles", async () => {
    const user = userEvent.setup();
    render(
      <>
        <style>
          {
            '[role="dialog"][data-state="open"] { animation-name: sheet-in; } [role="dialog"][data-state="closed"] { animation-name: sheet-out; }'
          }
        </style>
        <Harness />
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Menu" });
    await user.click(trigger);
    screen.getByRole("link", { name: "Footer action" }).focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
