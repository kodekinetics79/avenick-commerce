#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const registryPath = path.join(repositoryRoot, "ops/release/frontend-availability.json");
const apps = ["customer", "seller", "admin"];
const allowedAvailability = new Set(["operational", "limited", "read_only", "unavailable", "simulated"]);

function walk(directory, predicate) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute, predicate) : predicate(absolute) ? [absolute] : [];
  });
}

function appRouteFromFile(appRoot, file) {
  const relative = path.relative(appRoot, path.dirname(file)).replaceAll(path.sep, "/");
  const withoutGroups = relative.split("/").filter((part) => !/^\(.+\)$/.test(part));
  return `/${withoutGroups.join("/")}`.replace(/\/$/, "") || "/";
}

function routeMatcher(route) {
  const escaped = route
    .split("/")
    .map((segment) => {
      if (/^\[\[\.\.\..+\]\]$/.test(segment)) return "(?:.+)?";
      if (/^\[\.\.\..+\]$/.test(segment)) return ".+";
      if (/^\[.+\]$/.test(segment) || segment === "__DYNAMIC__") return "[^/]+";
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return new RegExp(`^${escaped}/?$`);
}

function normalizedTarget(raw) {
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  const pathname = raw.split(/[?#]/, 1)[0] || "/";
  return pathname.replace(/\$\{[^}]+\}/g, "__DYNAMIC__").replace(/\/$/, "") || "/";
}

function sourceLocation(source, index) {
  const before = source.slice(0, index);
  return before.split("\n").length;
}

function collectDestinations(file) {
  const source = fs.readFileSync(file, "utf8");
  const destinations = [];
  const patterns = [
    /\bhref\s*=\s*(?:{\s*)?(["'`])([^"'`]+)\1/g,
    /\bhref\s*:\s*(["'`])([^"'`]+)\1/g,
    /\baction\s*=\s*(["'])((?:\\.|(?!\1).)+)\1/g,
    /\b(?:redirect|permanentRedirect|router\.(?:push|replace))\s*\(\s*(["'`])([^"'`]+)\1/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const target = normalizedTarget(match[2]);
      if (target) destinations.push({ target, line: sourceLocation(source, match.index ?? 0) });
    }
  }
  return destinations;
}

function relative(file) {
  return path.relative(repositoryRoot, file).replaceAll(path.sep, "/");
}

const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const failures = [];
const summary = {};

if (registry.schemaVersion !== 1) failures.push("availability registry schemaVersion must be 1");

for (const app of apps) {
  const appRoot = path.join(repositoryRoot, "apps", app, "src", "app");
  const sourceRoot = path.join(repositoryRoot, "apps", app, "src");
  const pageFiles = walk(appRoot, (file) => file.endsWith(`${path.sep}page.tsx`));
  const pageRoutes = pageFiles.map((file) => appRouteFromFile(appRoot, file));
  const matchers = pageRoutes.map((route) => ({ route, matcher: routeMatcher(route) }));
  const sourceFiles = walk(sourceRoot, (file) => /\.(?:ts|tsx)$/.test(file) && !/\.(?:test|spec)\./.test(file));
  const destinations = sourceFiles.flatMap((file) => collectDestinations(file).map((destination) => ({ ...destination, file })));

  for (const destination of destinations) {
    if (!matchers.some(({ matcher }) => matcher.test(destination.target))) {
      failures.push(`${relative(destination.file)}:${destination.line} points to missing internal page ${destination.target}`);
    }
  }

  const appRegistry = registry.apps?.[app];
  if (!appRegistry) {
    failures.push(`availability registry is missing app ${app}`);
    continue;
  }
  const screens = new Map(Object.entries(appRegistry.screens ?? {}));
  for (const [route, contract] of screens) {
    if (!matchers.some(({ matcher }) => matcher.test(route))) {
      failures.push(`${app} availability contract references missing page ${route}`);
    }
    if (!allowedAvailability.has(contract.availability)) {
      failures.push(`${app} ${route} has invalid availability ${String(contract.availability)}`);
    }
    if (contract.availability === "operational" && !contract.evidence) {
      failures.push(`${app} ${route} is operational without evidence`);
    }
    if (contract.availability !== "operational" && !contract.limitation) {
      failures.push(`${app} ${route} must state its limitation`);
    }
  }

  const navigationSources = new Set(appRegistry.navigationSources ?? []);
  for (const source of navigationSources) {
    const absolute = path.join(repositoryRoot, source);
    if (!fs.existsSync(absolute)) {
      failures.push(`${app} navigation source does not exist: ${source}`);
      continue;
    }
    for (const destination of collectDestinations(absolute)) {
      const matchingContract = [...screens.entries()].find(([route]) => routeMatcher(route).test(destination.target));
      if (!matchingContract) {
        failures.push(`${source}:${destination.line} exposes ${destination.target} without an availability contract`);
      }
    }
  }

  summary[app] = {
    pages: pageRoutes.length,
    checkedDestinations: destinations.length,
    registeredNavigationScreens: screens.size,
    availability: [...screens.values()].reduce((counts, contract) => {
      counts[contract.availability] = (counts[contract.availability] ?? 0) + 1;
      return counts;
    }, {}),
  };
}

if (failures.length) {
  console.error(`frontend contracts FAILED (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({ status: "pass", ...summary }, null, 2));
