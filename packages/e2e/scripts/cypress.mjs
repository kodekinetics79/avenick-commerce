#!/usr/bin/env node
/**
 * Cypress launcher.
 *
 * VS Code — and other Electron-hosted terminals — export ELECTRON_RUN_AS_NODE=1.
 * Cypress ships its own Electron binary, and that variable makes it boot as plain
 * Node, so it rejects its own launch flags and dies with:
 *
 *   Cypress.app/Contents/MacOS/Cypress: bad option: --no-sandbox
 *   Cypress.app/Contents/MacOS/Cypress: bad option: --smoke-test
 *
 * Clearing the variable for the child process keeps `pnpm e2e:cypress` working in
 * an IDE terminal, a plain shell, and CI alike. `env -u` would do the same on
 * macOS/Linux but not on Windows, so this stays a Node shim.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

// Cypress 15 restricts its `exports` map, so `cypress/bin/cypress` cannot be
// resolved directly. `./package.json` is exported, so resolve through that and
// read the declared `bin` path — which stays correct if Cypress moves the file.
const require = createRequire(import.meta.url);
const pkgJsonPath = require.resolve("cypress/package.json");
const cypressBin = path.join(path.dirname(pkgJsonPath), require(pkgJsonPath).bin.cypress);

const result = spawnSync(process.execPath, [cypressBin, ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
});

process.exit(result.status ?? 1);
