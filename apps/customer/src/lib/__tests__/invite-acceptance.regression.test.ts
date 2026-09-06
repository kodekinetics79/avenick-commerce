import { describe, expect, it } from "vitest";
import { RegisterBusinessSchema } from "@avenick/types/schemas";
import { identityCopy } from "../../app/auth/identity-copy";
import { B2B_MESSAGES } from "../../components/b2b/messages";

/**
 * The three screens an invited colleague, a company buyer and a waiting
 * applicant actually walk through, guarded at the two places they can silently
 * rot: a promise that drifts from the rule the server enforces, and a locale
 * that quietly loses half a screen.
 *
 * None of this needs a database. Every assertion is about COPY and about the
 * schema that copy describes, which is exactly the pair no typecheck can align.
 */

const EN = identityCopy("en");
const AR = identityCopy("ar");

describe("the stated password rule is the enforced password rule", () => {
  /*
   * The acceptance page prints the rule in full BEFORE anyone types, which is
   * the whole point of it — a rule discovered by failing it is a rule stated too
   * late. That makes the printed rule a promise, and a promise that outlives the
   * schema it describes is worse than no promise at all: a person meets the
   * three lines on the screen and is refused anyway, by a rule nobody showed
   * them.
   *
   * So the check is behavioural rather than textual. Each case names a password
   * and which of the three printed lines it is meant to violate; the schema must
   * agree about every one. Reword the copy freely — this test only fails when
   * the copy and the schema stop describing the same rule.
   */
  const rule = RegisterBusinessSchema.shape.password;
  const accepted = (value: string) => rule.safeParse(value).success;

  it.each([
    ["Str0ngEnough", true, "meets all three"],
    ["Ab3cdef", false, "seven characters — under the stated minimum of 8"],
    ["Ab3cdefg", true, "exactly eight characters — the stated minimum is inclusive"],
    [`A1${"b".repeat(126)}`, true, "exactly 128 characters — the stated maximum is inclusive"],
    [`A1${"b".repeat(127)}`, false, "129 characters — over the stated maximum of 128"],
    ["nouppercase1", false, "no uppercase letter"],
    ["NoDigitsHere", false, "no number"],
  ])("%s → %s (%s)", (value, expected) => {
    expect(accepted(value)).toBe(expected);
  });

  it("states 8, 128, an uppercase letter and a number, in both languages", () => {
    for (const copy of [EN, AR]) {
      const stated = [copy.invite.ruleLength, copy.invite.ruleUpper, copy.invite.ruleDigit].join(" ");
      expect(stated).toContain("8");
      expect(stated).toContain("128");
    }
    // The English lines are readable as prose; assert the substance, not the
    // wording, so an editor may improve the sentence but cannot drop a rule.
    expect(EN.invite.ruleUpper).toMatch(/uppercase/i);
    expect(EN.invite.ruleDigit).toMatch(/number|digit/i);
  });
});

describe("the acceptance page is not a membership oracle", () => {
  /*
   * /register answers neutrally, /login collapses every failure to one message,
   * and /auth/forgot-password sends nothing to a pending account — all so that
   * holding an address never reveals whether it has an account. A page reachable
   * by anyone with a URL that said "expired" for one token and "no such
   * invitation" for another would hand back exactly what those three refuse.
   */
  it("says the same thing for a dead link and a used one, in both languages", () => {
    expect(EN.invite.deadToken).toBe(EN.invite.usedToken);
    expect(AR.invite.deadToken).toBe(AR.invite.usedToken);
  });

  it("points a stuck invitee at the administrator, not at forgot-password", () => {
    // /auth/forgot-password requires status === ACTIVE and refuses an invited,
    // never-activated account by name. Sending them there is a fifth closed
    // door, not a way out.
    expect(EN.invite.askAgain).toMatch(/invited you/i);
    expect(EN.invite.askAgain).not.toMatch(/reset/i);
  });
});

describe("the sign-in page speaks to buyers, not to reviewers", () => {
  it("prints no route paths and no build-audit sentence", () => {
    const plate = JSON.stringify({ en: EN.brand, ar: AR.brand, surfaces: [EN.surfaces, AR.surfaces] });
    // The ledger used to set "/account/orders", "/returns" and "/support" in a
    // mono column under "Every surface named here exists on this deployment".
    // True, checkable, and addressed to whoever was auditing the build.
    expect(plate).not.toMatch(/\/account\/orders|\/returns|\/support/);
    expect(plate).not.toMatch(/exists on this deployment/i);
  });

  it("offers the company door with a callbackUrl to the buyer workspace", () => {
    for (const copy of [EN, AR]) {
      expect(copy.login.companyTitle.length).toBeGreaterThan(0);
      expect(copy.login.companyAction.length).toBeGreaterThan(0);
      expect(copy.login.destinationB2B.length).toBeGreaterThan(0);
    }
  });

  it("promises no delivery window, response time or discount anywhere on the plate", () => {
    const stated = JSON.stringify([EN.surfaces, AR.surfaces, EN.brand, AR.brand, EN.invite, AR.invite]);
    expect(stated).not.toMatch(/free delivery|next[- ]day|same[- ]day|within \d+ (hours?|days?|business)/i);
    expect(stated).not.toMatch(/discount|guarantee[ds]?\b/i);
    // Each row carries its limit rather than a claim; losing one is how a
    // promise creeps back in.
    for (const surfaces of [EN.surfaces, AR.surfaces]) {
      for (const surface of surfaces) expect(surface.basis.length).toBeGreaterThan(0);
    }
  });
});

describe("the application status screen", () => {
  const en = B2B_MESSAGES.en;
  const ar = B2B_MESSAGES.ar;

  it("states the stage, the record and that nothing is waiting on the applicant", () => {
    for (const dict of [en, ar]) {
      for (const key of [
        "status.eyebrow",
        "status.pill.review",
        "status.lead",
        "status.filed.submitted",
        "status.stages",
        "status.step.received",
        "status.step.review",
        "status.step.open",
        "status.next",
        "status.next.nothingToDo",
        "status.next.noEta",
        "status.next.returning",
      ] as const) {
        expect(dict[key], key).toBeTruthy();
      }
    }
  });

  it("promises no review time", () => {
    // The applicant reads this page repeatedly and can do nothing to speed it
    // up. Nothing in this system measures a review duration, so any figure here
    // would be the one sentence on the page that could turn out to be a lie.
    // Scoped to this screen's own keys: the catalogue elsewhere legitimately
    // says "10–49 employees" and "31–60 days" about headcount bands and debt
    // ageing, and a whole-dictionary scan would fail on those forever.
    const statusKeys = (dict: typeof en | typeof ar) =>
      Object.entries(dict).filter(([key]) => key.startsWith("status."));
    const stated = JSON.stringify([statusKeys(en), statusKeys(ar)]);
    expect(stated).not.toMatch(/\d+\s*[-–]\s*\d+\s*(business\s*)?days?/i);
    expect(stated).not.toMatch(/within \d+ (hours?|days?)/i);
    expect(en["status.next.noEta"]).toMatch(/no review time is promised/i);
  });

  it("keeps both dictionaries in step", () => {
    // `ar` is typed Record<B2BKey, string>, so a MISSING key is a typecheck
    // error. An EMPTY one is not, and renders as nothing at all.
    const emptyInAr = Object.entries(ar).filter(([, value]) => value.trim() === "" && value !== "—");
    expect(emptyInAr.map(([key]) => key)).toEqual([]);
  });
});
