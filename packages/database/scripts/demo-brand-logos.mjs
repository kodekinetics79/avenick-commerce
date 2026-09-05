/**
 * Attach DEMO brand logos, and remove them again.
 *
 * Every brand row in the catalogue has `logoUrl` null, so the brand strip the
 * rebuilt storefront wants renders as a row of gaps. These marks are a STAGE
 * PROP: they are generated here, from nothing but the brand's own name, and
 * they are not any manufacturer's actual logo.
 *
 * That distinction is the whole reason this script draws instead of downloads.
 * 3M, Honeywell, Mennekes and Eaton are other people's trademarks; putting the
 * real mark on our storefront would assert a distribution relationship the
 * business does not have, and hotlinking it would put a third-party origin in
 * the customer app's image CSP as well. A generated initials tile asserts
 * nothing. It also carries the words DEMO PLACEHOLDER on its face, which is
 * deliberate and should not be quietly polished away — the mark is a prop, and
 * a prop that stops looking like one is how a demo compromise escapes.
 *
 * Assets are local, under apps/customer/public/brands/, because next.config
 * allow-lists remote image hosts and the storefront CSP is `img-src 'self'`.
 * They are written as SVG so they are text, diffable, and a few hundred bytes.
 *
 * Everything written here is tagged, in two independent ways, so removing it
 * is exact rather than best-effort:
 *   · the stored URL begins with DEMO_URL_PREFIX
 *   · the file on disk is named demo-<slug>.svg
 * `node demo-brand-logos.mjs wipe` nulls exactly those columns and deletes
 * exactly those files. A brand whose logoUrl points anywhere else is a real
 * logo somebody uploaded, and neither apply nor wipe touches it.
 *
 * The generated files are NOT produced at build time. `apply` writes them into
 * the customer app's public directory on the machine it runs on, so after
 * running it locally you must commit apps/customer/public/brands/ for the
 * deployed storefront to serve anything but 404s.
 *
 * Usage:
 *   node packages/database/scripts/demo-brand-logos.mjs apply
 *   node packages/database/scripts/demo-brand-logos.mjs wipe
 *   node packages/database/scripts/demo-brand-logos.mjs status
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../..");
const PUBLIC_DIR = path.join(REPO_ROOT, "apps", "customer", "public");
const ASSET_DIR = path.join(PUBLIC_DIR, "brands");

// Both tags in one place. The URL prefix is the database predicate; the file
// prefix is the disk predicate; they are the same string by construction.
const DEMO_FILE_PREFIX = "demo-";
const DEMO_URL_PREFIX = `/brands/${DEMO_FILE_PREFIX}`;
const DEMO_FILE_PATTERN = /^demo-[a-z0-9-]+\.svg$/;

// Muted, deliberately unbranded ink/paper pairs. Nothing here is anybody's
// house colour, which is the point: the tile must not resemble a real mark.
const PALETTE = [
  { ink: "#2f3a45", paper: "#eef1f4" },
  { ink: "#3a3f4b", paper: "#f0f0f3" },
  { ink: "#334642", paper: "#eaf1ee" },
  { ink: "#453a3a", paper: "#f4eeee" },
  { ink: "#3b4250", paper: "#edeff5" },
  { ink: "#42403a", paper: "#f3f1ea" },
];

const db = new PrismaClient();
const mode = process.argv[2] ?? "status";

const demoLogoWhere = { logoUrl: { startsWith: DEMO_URL_PREFIX } };

/** FNV-1a, used only so a brand keeps the same colour across runs. */
function hash(input) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * A filename is a path, so the slug is reduced to [a-z0-9-] rather than
 * trusted. Brand.slug is unique but the reduction is not injective, so
 * collisions get a hash suffix instead of silently overwriting each other.
 */
function assetName(slug, taken) {
  const base = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "brand";
  let candidate = base;
  if (taken.has(candidate)) candidate = `${base}-${hash(slug).toString(16).slice(0, 6)}`;
  taken.add(candidate);
  return candidate;
}

/** Up to two initials from the brand's own name. "3M" gives 3M, "Al Rawi Tools" gives AR. */
function initials(name) {
  const words = name.replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function escapeXml(value) {
  return value.replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]);
}

/**
 * The mark itself: initials, the brand's name as a wordmark, and a footer that
 * says what this is. The comment, the <title> and the visible footer each say
 * "demo placeholder" independently, so the file cannot be mistaken for a real
 * asset by a person, a screen reader, or a grep.
 */
function svgFor(brand) {
  const { ink, paper } = PALETTE[hash(brand.slug) % PALETTE.length];
  const name = escapeXml(brand.nameEn.length > 24 ? `${brand.nameEn.slice(0, 23)}…` : brand.nameEn);
  const mark = escapeXml(initials(brand.nameEn));
  const font = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif";
  // A double hyphen terminates an XML comment early, and "<" opens a tag; the
  // brand name is operator-supplied text, so neither reaches the comment raw.
  const inComment = brand.nameEn.replace(/-{2,}/g, "-").replace(/[<>&]/g, " ");
  return `<!-- DEMO PLACEHOLDER. Generated by packages/database/scripts/demo-brand-logos.mjs
     from the brand name alone. This is NOT ${inComment}'s logo or trademark,
     and its presence asserts no relationship with them. Remove with:
     node packages/database/scripts/demo-brand-logos.mjs wipe -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160" width="320" height="160" role="img" aria-labelledby="demoTitle demoDesc">
  <title id="demoTitle">Demo placeholder mark for ${name}</title>
  <desc id="demoDesc">Generated placeholder, not the brand's own logo or trademark.</desc>
  <rect width="320" height="160" rx="12" fill="${paper}"/>
  <rect x="0.75" y="0.75" width="318.5" height="158.5" rx="11.25" fill="none" stroke="${ink}" stroke-opacity="0.16"/>
  <text x="160" y="74" text-anchor="middle" font-family="${font}" font-size="46" font-weight="700" letter-spacing="2" fill="${ink}">${mark}</text>
  <text x="160" y="104" text-anchor="middle" font-family="${font}" font-size="15" font-weight="500" letter-spacing="1" fill="${ink}" fill-opacity="0.78">${name}</text>
  <text x="160" y="132" text-anchor="middle" font-family="${font}" font-size="9" letter-spacing="1.6" fill="${ink}" fill-opacity="0.5">DEMO PLACEHOLDER</text>
</svg>
`;
}

function listDemoFiles() {
  if (!fs.existsSync(ASSET_DIR)) return [];
  return fs.readdirSync(ASSET_DIR).filter((file) => DEMO_FILE_PATTERN.test(file));
}

/**
 * The customer app has to be in this checkout for the assets to have anywhere
 * to live. Running this from a deploy image that only contains the database
 * package would otherwise write a directory nothing serves.
 */
function requirePublicDir() {
  if (fs.existsSync(PUBLIC_DIR)) return;
  console.error(
    `demo-brand-logos: ${PUBLIC_DIR} does not exist.\n` +
      "Run this from a full checkout — the assets are served by the customer app, not the database package.",
  );
  process.exit(1);
}

if (mode === "status") {
  const [active, withLogo, demo, files] = await Promise.all([
    db.brand.count({ where: { isActive: true } }),
    db.brand.count({ where: { isActive: true, logoUrl: { not: null } } }),
    db.brand.findMany({ where: demoLogoWhere, select: { slug: true, logoUrl: true }, orderBy: { slug: "asc" } }),
    Promise.resolve(listDemoFiles()),
  ]);
  console.log(
    `active brands:    ${active}\n` +
      `with a logo:      ${withLogo}\n` +
      `demo logos (db):  ${demo.length}\n` +
      `demo files (disk):${String(files.length).padStart(3)}  in ${path.relative(REPO_ROOT, ASSET_DIR)}`,
  );
  // Either half of the pair can go missing — the column survives a branch that
  // does not carry the assets, the file survives a database that was reset —
  // and each shows up as a broken image rather than an error, so name both.
  const onDisk = new Set(files.map((file) => `/brands/${file}`));
  const missingFiles = demo.filter((brand) => !onDisk.has(brand.logoUrl));
  const referenced = new Set(demo.map((brand) => brand.logoUrl));
  const orphanFiles = files.filter((file) => !referenced.has(`/brands/${file}`));
  if (missingFiles.length > 0) console.log(`\n⚠️  ${missingFiles.length} brand(s) point at a demo file that is not on disk: ${missingFiles.map((b) => b.slug).join(", ")}`);
  if (orphanFiles.length > 0) console.log(`\n⚠️  ${orphanFiles.length} demo file(s) on disk that no brand references: ${orphanFiles.join(", ")}`);
} else if (mode === "wipe") {
  // Column first: the predicate is the URL prefix, so a real uploaded logo can
  // never match. Anything else in that column is somebody's actual asset.
  const { count } = await db.brand.updateMany({ where: demoLogoWhere, data: { logoUrl: null } });
  console.log(`cleared ${count} demo logoUrl values`);

  // Then the files, by the same prefix. Nothing else in apps/customer/public
  // is considered, and the pattern refuses anything a traversal could hide in.
  let removed = 0;
  for (const file of listDemoFiles()) {
    fs.unlinkSync(path.join(ASSET_DIR, file));
    removed += 1;
  }
  console.log(`removed ${removed} demo logo files from ${path.relative(REPO_ROOT, ASSET_DIR)}`);
  if (removed > 0) console.log("Commit the deletion — the deployed storefront serves whatever is in git, not what is on this machine.");
} else if (mode === "apply") {
  requirePublicDir();
  fs.mkdirSync(ASSET_DIR, { recursive: true });

  const brands = await db.brand.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, nameEn: true, logoUrl: true },
    orderBy: { slug: "asc" },
  });
  console.log(`${brands.length} active brands`);

  const taken = new Set();
  let wrote = 0;
  let unchanged = 0;
  let linked = 0;
  const kept = [];
  for (const brand of brands) {
    // A real logo is never replaced — the same rule demo-images applies to a
    // real photograph. Only a null column or one this script already owns.
    if (brand.logoUrl && !brand.logoUrl.startsWith(DEMO_URL_PREFIX)) {
      kept.push(brand.slug);
      continue;
    }
    const file = `${DEMO_FILE_PREFIX}${assetName(brand.slug, taken)}.svg`;
    const target = path.join(ASSET_DIR, file);
    const svg = svgFor(brand);
    // Byte-identical on a re-run, so the working tree stays clean.
    if (fs.existsSync(target) && fs.readFileSync(target, "utf8") === svg) {
      unchanged += 1;
    } else {
      fs.writeFileSync(target, svg, "utf8");
      wrote += 1;
    }
    // Re-stating the guard in the predicate rather than trusting the read
    // above: a real logo uploaded between the two would otherwise be clobbered.
    const { count } = await db.brand.updateMany({
      where: { id: brand.id, OR: [{ logoUrl: null }, { logoUrl: { startsWith: DEMO_URL_PREFIX } }] },
      data: { logoUrl: `/brands/${file}` },
    });
    linked += count;
  }
  // A brand renamed or re-slugged since the last run leaves its old file
  // behind. Only files under the demo prefix are considered, and only those no
  // brand row points at — an inactive brand still holding a demo logoUrl keeps
  // its asset.
  const referenced = new Set((await db.brand.findMany({ where: demoLogoWhere, select: { logoUrl: true } })).map((b) => b.logoUrl));
  let orphaned = 0;
  for (const file of listDemoFiles()) {
    if (referenced.has(`/brands/${file}`)) continue;
    fs.unlinkSync(path.join(ASSET_DIR, file));
    orphaned += 1;
  }

  console.log(`wrote ${wrote} logo files, ${unchanged} already current`);
  console.log(`pointed ${linked} brands at a demo logo`);
  if (orphaned > 0) console.log(`removed ${orphaned} demo file(s) no brand references any more`);
  if (kept.length > 0) console.log(`left alone (already has a real logo): ${kept.join(", ")}`);
  console.log(
    `\nCommit ${path.relative(REPO_ROOT, ASSET_DIR)} — these files are served from the customer app's\n` +
      "public directory, so a deploy built from git will 404 on every one of them until they are in git.",
  );
} else {
  console.error("usage: demo-brand-logos.mjs apply|wipe|status");
  process.exitCode = 1;
}
await db.$disconnect();
