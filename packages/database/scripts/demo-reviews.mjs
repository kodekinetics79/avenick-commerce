/**
 * Attach DEMO product reviews, and remove them again.
 *
 * The catalogue is live with well over a thousand products and zero reviews,
 * so every tile in the rebuilt storefront draws an empty star row and the
 * reviews tab on a product page opens onto nothing. These rows are a STAGE
 * PROP: nobody bought these products, nobody wrote these words, and the stars
 * were dealt from a weighted table rather than earned.
 *
 * That is a deliberate, owner-approved demo compromise and it must not survive
 * contact with a real customer. Every row written here is therefore tagged, in
 * two independent ways, so removing them is exact rather than best-effort:
 *   · title and body both begin with DEMO_MARKER
 *   · the author is a purpose-built account under DEMO_EMAIL_DOMAIN
 * `node demo-reviews.mjs wipe` deletes exactly those and nothing else.
 *
 * Three properties are load-bearing and should survive any edit to this file:
 *
 *   `isVerified` is false on every row. That badge means "this buyer has a
 *   DELIVERED order containing this product" — product-reviews.ts stamps it
 *   from that rule and nothing else does. No demo reviewer has ever ordered
 *   anything, so a `true` here would be the one claim the storefront currently
 *   cannot make.
 *
 *   The authors are demo accounts, NOT the certification personas. Attributing
 *   this text to buyer@avenick.test would put words in a persona's mouth and
 *   flip their review eligibility to already-reviewed on whichever product got
 *   the row. The accounts carry no password hash and are left PENDING, so
 *   authorize() will not admit them and they do not inflate the ACTIVE
 *   consumer count the admin dashboard reports.
 *
 *   A product that already carries ANY review is skipped whole — the same rule
 *   as demo-images, where a real photograph is never replaced. It is also what
 *   makes a second `apply` a no-op.
 *
 * Ratings come from a J-shaped distribution (about 50/27/12/6/5 from five
 * stars down to one) and roughly a third of the catalogue is deliberately left
 * unreviewed, because a storefront where every product is a flawless 5.0 reads
 * as fabricated and never exercises the empty-state path the UI still has to
 * render.
 *
 * Note that this also moves a number nobody asked it to: the seller rating on
 * the seller portal's performance page and on admin seller detail is an
 * aggregate over ProductReview, so seeding here gives every seller a demo
 * standing too. `wipe` returns them to "no rating".
 *
 * Every choice is derived from a hash of the product id, so a wipe followed by
 * an apply reproduces the same catalogue rather than reshuffling it.
 *
 * Usage:
 *   node packages/database/scripts/demo-reviews.mjs apply
 *   node packages/database/scripts/demo-reviews.mjs wipe
 *   node packages/database/scripts/demo-reviews.mjs status
 */
import { PrismaClient } from "@prisma/client";

const DEMO_MARKER = "[DEMO REVIEW — not a real customer]";

// Reserved TLD, and a subdomain that says what these are. Both `apply` and
// `wipe` address the accounts through this suffix and nothing else.
const DEMO_EMAIL_DOMAIN = "@demo-reviewer.avenick.test";

// Twelve authors is the ceiling on reviews per product, because
// ProductReview is unique on [productId, userId] and a product never draws the
// same author twice. It is comfortably above the busiest product below.
const REVIEWER_COUNT = 12;

// Share of otherwise-unreviewed products that get any reviews at all. The rest
// keep the empty state on purpose.
const COVERAGE_PERCENT = 65;

// Weights are percentages and must total 100; `pick` rolls a hash mod 100.
const RATING_DISTRIBUTION = [
  { value: 5, weight: 50 },
  { value: 4, weight: 27 },
  { value: 3, weight: 12 },
  { value: 2, weight: 6 },
  { value: 1, weight: 5 },
];

const REVIEW_COUNT_DISTRIBUTION = [
  { value: 1, weight: 30 },
  { value: 2, weight: 24 },
  { value: 3, weight: 18 },
  { value: 4, weight: 12 },
  { value: 5, weight: 8 },
  { value: 6, weight: 4 },
  { value: 8, weight: 2 },
  { value: 11, weight: 2 },
];

// Copy is banded by rating so a two-star row does not read like a rave. It is
// deliberately generic trade language: no product name, no seller name, no
// claim about delivery times the platform would have to stand behind.
const REVIEW_TEXT = {
  5: {
    titles: ["Exactly as specified", "Would order again", "Straightforward reorder", "Matched the datasheet"],
    bodies: [
      "Specification matched the datasheet and it dropped straight into the existing assembly.",
      "Third time we have bought this line and the build quality has not slipped.",
      "Packaging was solid and the paperwork matched the purchase order line for line.",
      "Fitted without an adapter, which saved us most of a shift.",
    ],
  },
  4: {
    titles: ["Good, with one caveat", "Solid for the price", "Does the job"],
    bodies: [
      "Does what it should. The documentation is thin on tolerances and we had to measure them ourselves.",
      "Good value for the specification, though the finish is rougher than the listing photographs suggest.",
      "No complaints about the part itself. We would have liked more detail on the packaging quantity.",
    ],
  },
  3: {
    titles: ["Adequate", "Fine, not exceptional", "Mixed"],
    bodies: [
      "Serviceable for light duty. We would not put it on a production line without testing it first.",
      "Works, but the finish is not what the photographs suggest and one unit needed rework.",
      "Average for the price. Nothing wrong with it, nothing that would make us specify it again.",
    ],
  },
  2: {
    titles: ["Disappointing", "Not to the datasheet"],
    bodies: [
      "Arrived with a dented housing. It was replaced without argument, but the swap cost us a week.",
      "The thread pitch did not match the published datasheet, so the whole batch had to be re-machined.",
    ],
  },
  1: {
    titles: ["Would not reorder", "Failed early"],
    bodies: [
      "Wrong variant shipped twice against a clear order line. Returned it and sourced elsewhere.",
      "Failed inside a month of light duty. Not what we expect at this specification.",
    ],
  },
};

const db = new PrismaClient();
const mode = process.argv[2] ?? "status";

const demoUserWhere = { email: { endsWith: DEMO_EMAIL_DOMAIN } };
const demoTitleWhere = { title: { startsWith: DEMO_MARKER } };

/** FNV-1a. Not a security hash — it is here so the same catalogue comes back after a wipe. */
function hash(input) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Weighted choice from a table whose weights total 100. */
function pick(distribution, roll) {
  let cursor = 0;
  for (const entry of distribution) {
    cursor += entry.weight;
    if (roll < cursor) return entry.value;
  }
  return distribution[distribution.length - 1].value;
}

function fromBank(bank, seed) {
  return bank[hash(seed) % bank.length];
}

/** Both fields carry the marker, so neither one alone is what identifies a demo row. */
function reviewText(productId, userId, rating) {
  const band = REVIEW_TEXT[rating];
  const title = `${DEMO_MARKER} ${fromBank(band.titles, `${productId}:${userId}:title`)}`;
  const body = `${DEMO_MARKER} ${fromBank(band.bodies, `${productId}:${userId}:body`)} Placeholder copy seeded for the POC demo; no customer wrote this.`;
  // The service caps title at 120 and body at 2000. Nothing here comes close,
  // but the slice keeps that true if the banks are ever extended.
  return { title: title.slice(0, 120), body: body.slice(0, 2000) };
}

/**
 * The authors. Upserted by email so a re-run reuses them rather than
 * multiplying them, and never given a credential: `passwordHash` stays null
 * and the status stays PENDING, so there is no account here to sign into.
 * The storefront prints "first name + last initial", which makes every one of
 * these reviews signed "Demo R." — a fabricated review must not carry a
 * plausible human name.
 */
async function ensureReviewers() {
  const reviewers = [];
  for (let index = 1; index <= REVIEWER_COUNT; index += 1) {
    const number = String(index).padStart(2, "0");
    const email = `demo-reviewer-${number}${DEMO_EMAIL_DOMAIN}`;
    const user = await db.user.upsert({
      where: { email },
      // Re-running must not resurrect a suspended or soft-deleted demo account
      // silently, and must never grow a password. Names are reconciled so an
      // edit to the labelling here reaches accounts that already exist.
      update: { firstName: "Demo", lastName: "Reviewer", passwordHash: null },
      create: {
        email,
        passwordHash: null,
        firstName: "Demo",
        lastName: "Reviewer",
        role: "CONSUMER",
        status: "PENDING",
        language: "EN",
      },
      select: { id: true },
    });
    reviewers.push(user.id);
  }
  return reviewers;
}

if (mode === "status") {
  const [products, withReview, demoReviews, demoReviewers, byRating] = await Promise.all([
    db.product.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    db.product.count({ where: { deletedAt: null, status: "ACTIVE", reviews: { some: {} } } }),
    db.productReview.count({ where: demoTitleWhere }),
    db.user.count({ where: demoUserWhere }),
    db.productReview.groupBy({ by: ["rating"], where: demoTitleWhere, _count: { _all: true }, orderBy: { rating: "desc" } }),
  ]);
  const total = byRating.reduce((sum, row) => sum + row._count._all, 0);
  const weighted = byRating.reduce((sum, row) => sum + row.rating * row._count._all, 0);
  console.log(
    `active products:  ${products}\n` +
      `with a review:    ${withReview}\n` +
      `demo reviews:     ${demoReviews}\n` +
      `demo reviewers:   ${demoReviewers}`,
  );
  if (total > 0) {
    console.log(`demo average:     ${(weighted / total).toFixed(2)}`);
    for (const row of byRating) {
      const share = Math.round((row._count._all / total) * 100);
      console.log(`  ${row.rating}★ ${String(row._count._all).padStart(6)}  ${"█".repeat(Math.round(share / 2))} ${share}%`);
    }
  }
  // A demo review the marker cannot see would survive a wipe. There should
  // never be one; say so out loud if there is.
  // `NOT (title LIKE ...)` is unknown for a NULL title in SQL, so a titleless
  // row would slip past a bare NOT. Name that case explicitly.
  const untagged = await db.productReview.count({
    where: { user: { is: demoUserWhere }, OR: [{ title: null }, { NOT: demoTitleWhere }] },
  });
  if (untagged > 0) console.log(`\n⚠️  ${untagged} review(s) by a demo account are NOT tagged with the marker; wipe will leave them.`);
} else if (mode === "wipe") {
  // Resolved to ids first rather than filtered through the relation, so the
  // delete predicate is a plain column match and both tags must hold: written
  // by a demo account AND carrying the marker. A real customer's review can
  // satisfy neither.
  const demoUsers = await db.user.findMany({ where: demoUserWhere, select: { id: true } });
  const ids = demoUsers.map((user) => user.id);
  const { count } = await db.productReview.deleteMany({ where: { ...demoTitleWhere, userId: { in: ids } } });
  console.log(`removed ${count} demo reviews`);

  // The accounts go too, but only once they hold nothing: `reviews: none`
  // means a row this script did not write is enough to keep the account alive
  // rather than cascade into it.
  try {
    const removed = await db.user.deleteMany({ where: { ...demoUserWhere, reviews: { none: {} } } });
    console.log(`removed ${removed.count} demo reviewer accounts`);
  } catch (error) {
    console.log(
      `demo reviewer accounts left in place: ${error?.message ?? error}\n` +
        "Something else references them. Their reviews are gone; the accounts are inert (no password, PENDING).",
    );
  }
} else if (mode === "apply") {
  const reviewers = await ensureReviewers();
  console.log(`${reviewers.length} demo reviewer accounts ready`);

  // Only products with NO review at all. A real customer's review is never
  // joined by a fabricated one, and a second run finds nothing to do.
  const targets = await db.product.findMany({
    where: { deletedAt: null, status: "ACTIVE", reviews: { none: {} } },
    select: { id: true },
    orderBy: { sku: "asc" },
  });
  console.log(`${targets.length} products without a review`);

  const rows = [];
  let covered = 0;
  for (const product of targets) {
    if (hash(`${product.id}:covered`) % 100 >= COVERAGE_PERCENT) continue;
    covered += 1;
    const count = pick(REVIEW_COUNT_DISTRIBUTION, hash(`${product.id}:count`) % 100);
    // Consecutive authors from a rotating start, so a product never draws the
    // same author twice and the unique constraint is respected by construction
    // rather than by the database refusing us.
    const offset = hash(`${product.id}:offset`) % REVIEWER_COUNT;
    for (let slot = 0; slot < count; slot += 1) {
      const userId = reviewers[(offset + slot) % REVIEWER_COUNT];
      const rating = pick(RATING_DISTRIBUTION, hash(`${product.id}:${userId}:rating`) % 100);
      const { title, body } = reviewText(product.id, userId, rating);
      rows.push({
        productId: product.id,
        userId,
        rating,
        title,
        body,
        // Never true. The badge means a delivered order, and there is none.
        isVerified: false,
        createdAt: new Date(Date.now() - (7 + (hash(`${product.id}:${userId}:age`) % 233)) * 86_400_000),
      });
    }
  }
  console.log(`${covered} products selected, ${targets.length - covered} left with no reviews on purpose`);

  let written = 0;
  const BATCH = 500;
  for (let start = 0; start < rows.length; start += BATCH) {
    // skipDuplicates is the belt to the braces above: if a review appeared
    // between the read and this write, the unique constraint wins and we
    // move on instead of failing the run half-applied.
    const { count } = await db.productReview.createMany({ data: rows.slice(start, start + BATCH), skipDuplicates: true });
    written += count;
  }
  console.log(`wrote ${written} demo reviews${written < rows.length ? ` (${rows.length - written} skipped as duplicates)` : ""}`);
} else {
  console.error("usage: demo-reviews.mjs apply|wipe|status");
  process.exitCode = 1;
}
await db.$disconnect();
