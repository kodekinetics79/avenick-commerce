import { describe, expect, it } from "vitest";
import {
  claimableDomainOf,
  domainMatchesCompany,
  emailDomainOf,
  isPublicMailboxDomain,
} from "../email-domain";

/**
 * These four functions are the whole of the "does this person work there?"
 * gate that stands in front of joining a company. Every case below is one the
 * gate has to get right for the flow to mean anything — the negative ones more
 * than the positive ones, because a false accept admits a stranger to a
 * customer's purchasing account.
 */
describe("emailDomainOf", () => {
  it("reads the domain, lower-cased and trimmed", () => {
    expect(emailDomainOf("A.Anas@Aramco.com")).toBe("aramco.com");
    expect(emailDomainOf("  a.anas@aramco.com  ")).toBe("aramco.com");
    expect(emailDomainOf("a.anas@mail.corp.aramco.com")).toBe("mail.corp.aramco.com");
  });

  it("refuses anything it cannot read with confidence", () => {
    // Each of these decides whether somebody is let near a company account, so
    // a best guess is not an acceptable answer for any of them.
    expect(emailDomainOf("a.anas@aramco@com")).toBeNull();
    expect(emailDomainOf("a.anas")).toBeNull();
    expect(emailDomainOf("@aramco.com")).toBeNull();
    expect(emailDomainOf("a.anas@")).toBeNull();
    expect(emailDomainOf("a.anas@aramco")).toBeNull();
    expect(emailDomainOf("a.anas@.aramco.com")).toBeNull();
    expect(emailDomainOf("a.anas@aramco.com.")).toBeNull();
    expect(emailDomainOf("a.anas@ar amco.com")).toBeNull();
    expect(emailDomainOf("")).toBeNull();
  });
});

describe("isPublicMailboxDomain", () => {
  it("knows the mailbox providers that belong to the public", () => {
    expect(isPublicMailboxDomain("gmail.com")).toBe(true);
    expect(isPublicMailboxDomain("GMAIL.COM")).toBe(true);
    expect(isPublicMailboxDomain("outlook.com")).toBe(true);
    expect(isPublicMailboxDomain("mailinator.com")).toBe(true);
  });

  it("does not mistake an employer for one", () => {
    expect(isPublicMailboxDomain("aramco.com")).toBe(false);
    // A company domain that merely contains a provider's name is not that
    // provider: matching on substrings here would hand "notgmail.com" to Google.
    expect(isPublicMailboxDomain("notgmail.com")).toBe(false);
    expect(isPublicMailboxDomain("gmail.com.sa")).toBe(false);
  });
});

describe("claimableDomainOf", () => {
  it("recognises a company at its founder's own work domain", () => {
    expect(claimableDomainOf("a.anas@aramco.com")).toBe("aramco.com");
  });

  it("refuses to let a company claim a public mailbox provider", () => {
    // THE case this list exists for: a company registered from a Gmail address
    // must never come to own gmail.com, or every Gmail user on earth passes its
    // "do you work here?" gate.
    expect(claimableDomainOf("founder@gmail.com")).toBeNull();
    expect(claimableDomainOf("founder@outlook.com")).toBeNull();
  });

  it("returns null rather than a guess for an unreadable address", () => {
    expect(claimableDomainOf("founder@@gmail.com")).toBeNull();
  });
});

describe("domainMatchesCompany", () => {
  it("admits an address at a recognised domain", () => {
    expect(domainMatchesCompany("s.otaibi@aramco.com", ["aramco.com"])).toBe(true);
    expect(domainMatchesCompany("S.Otaibi@ARAMCO.com", ["aramco.com"])).toBe(true);
    expect(domainMatchesCompany("s.otaibi@aramco.com", ["Aramco.com"])).toBe(true);
    expect(domainMatchesCompany("s.otaibi@aramco.sa", ["aramco.com", "aramco.sa"])).toBe(true);
  });

  it("refuses an address at any other domain", () => {
    expect(domainMatchesCompany("s.otaibi@gmail.com", ["aramco.com"])).toBe(false);
    // Subdomains are NOT the domain. Anyone who can stand up
    // aramco.com.attacker.net would otherwise pass.
    expect(domainMatchesCompany("s.otaibi@mail.aramco.com", ["aramco.com"])).toBe(false);
    expect(domainMatchesCompany("s.otaibi@aramco.com.attacker.net", ["aramco.com"])).toBe(false);
  });

  it("admits nobody when the company has no recognised domain", () => {
    // The empty list is "invite-only", not "anything goes". Getting this
    // backwards would open every invite-only company to the entire internet.
    expect(domainMatchesCompany("s.otaibi@aramco.com", [])).toBe(false);
  });

  it("refuses an address it cannot read", () => {
    expect(domainMatchesCompany("not-an-address", ["aramco.com"])).toBe(false);
  });
});
