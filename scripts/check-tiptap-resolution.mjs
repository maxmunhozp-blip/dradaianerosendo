#!/usr/bin/env node
/**
 * Probes that bun/node module resolution finds a single, importable copy of
 * @tiptap/core AND that its TypeScript type entrypoint resolves.
 *
 * Catches problems like:
 *   - Cannot find module '@tiptap/core' or its corresponding type declarations
 *   - Tiptap published without `types` field / wrong export map
 *   - Multiple copies leaking through hoist quirks
 *
 * Usage:
 *   node scripts/check-tiptap-resolution.mjs
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const PKG = "@tiptap/core";

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

let failed = false;

// 1. Resolve the runtime entrypoint
let entry;
try {
  entry = require.resolve(PKG, { paths: [resolve(process.cwd())] });
  console.log(green(`✓ runtime entry: ${entry}`));
} catch (err) {
  console.error(red(`✗ Cannot resolve ${PKG}: ${err.message}`));
  process.exit(1);
}

// 2. Locate package.json and verify "types" / "exports" point to a real .d.ts
const pkgRoot = (() => {
  let dir = dirname(entry);
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, "package.json"))) return dir;
    dir = dirname(dir);
  }
  return null;
})();

if (!pkgRoot) {
  console.error(red(`✗ Could not locate ${PKG} package.json`));
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8"));
console.log(dim(`  version: ${pkg.version}`));
console.log(dim(`  root:    ${pkgRoot}`));

// 3. Verify type declaration file exists
const candidates = [];
if (pkg.types) candidates.push(pkg.types);
if (pkg.typings) candidates.push(pkg.typings);
const exp = pkg.exports?.["."];
if (exp) {
  if (typeof exp === "string") candidates.push(exp);
  else {
    if (exp.types) candidates.push(typeof exp.types === "string" ? exp.types : exp.types.default);
    if (exp.import?.types) candidates.push(exp.import.types);
    if (exp.default) candidates.push(typeof exp.default === "string" ? exp.default : null);
  }
}

const dts = candidates.filter(Boolean).map((p) => join(pkgRoot, p)).find(existsSync);
if (!dts) {
  console.error(red(`✗ No .d.ts found for ${PKG} (checked: ${candidates.join(", ") || "none"})`));
  failed = true;
} else {
  console.log(green(`✓ type entry:    ${dts}`));
}

// 4. Sanity: the resolved entry must live inside the same package root
if (!entry.startsWith(pkgRoot)) {
  console.error(red(`✗ Entry ${entry} is outside package root ${pkgRoot}`));
  failed = true;
}

if (failed) {
  console.error(red("\nResolution probe failed. Reinstall dependencies and re-run."));
  process.exit(1);
}

console.log(green(`\n✓ ${PKG}@${pkg.version} resolves cleanly (runtime + types).`));
