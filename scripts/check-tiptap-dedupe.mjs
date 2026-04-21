#!/usr/bin/env node
/**
 * Ensures only ONE copy of @tiptap/core is installed.
 *
 * Multiple copies cause the classic Tiptap error:
 *   "Looks like multiple versions of prosemirror-model / @tiptap/core were loaded"
 * which breaks the editor schema at runtime.
 *
 * Checks performed:
 *   1. node_modules: walk every nested `@tiptap/core/package.json` and collect versions.
 *   2. Lockfile: scan bun.lock / package-lock.json / yarn.lock for duplicate entries.
 *
 * Exits 1 if more than one resolved version is found.
 *
 * Usage:
 *   node scripts/check-tiptap-dedupe.mjs
 *   npm run check:deps
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const PKG = "@tiptap/core";
const ROOT = resolve(process.cwd());

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

/** Recursively find every node_modules/@tiptap/core/package.json under root. */
function findInstalledCopies(dir, found = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = join(dir, entry.name);
    if (entry.name === "node_modules") {
      const candidate = join(full, "@tiptap", "core", "package.json");
      if (existsSync(candidate)) {
        try {
          const pkg = JSON.parse(readFileSync(candidate, "utf8"));
          found.push({ path: candidate, version: pkg.version });
        } catch { /* ignore */ }
      }
      // recurse into nested node_modules
      try {
        for (const sub of readdirSync(full, { withFileTypes: true })) {
          if (sub.isDirectory()) findInstalledCopies(join(full, sub.name), found);
        }
      } catch { /* ignore */ }
    } else if (!entry.name.startsWith(".")) {
      // skip dotfolders, but recurse into normal folders (rare top-level case)
      try {
        if (statSync(full).isDirectory()) findInstalledCopies(full, found);
      } catch { /* ignore */ }
    }
  }
  return found;
}

/** Scan supported lockfiles for declared versions of @tiptap/core. */
function scanLockfiles() {
  const findings = [];

  // bun.lock (text-based, key looks like: "@tiptap/core@3.22.0":)
  const bunLock = join(ROOT, "bun.lock");
  if (existsSync(bunLock)) {
    const text = readFileSync(bunLock, "utf8");
    const re = /["']?@tiptap\/core["']?\s*[:@]\s*["']?(\d+\.\d+\.\d+[\w.\-+]*)["']?/g;
    const versions = new Set();
    let m;
    while ((m = re.exec(text)) !== null) versions.add(m[1]);
    findings.push({ file: "bun.lock", versions: [...versions] });
  }

  // package-lock.json (npm v7+)
  const npmLock = join(ROOT, "package-lock.json");
  if (existsSync(npmLock)) {
    try {
      const lock = JSON.parse(readFileSync(npmLock, "utf8"));
      const versions = new Set();
      const packages = lock.packages || {};
      for (const [path, meta] of Object.entries(packages)) {
        if (path.endsWith("node_modules/@tiptap/core") && meta?.version) {
          versions.add(meta.version);
        }
      }
      findings.push({ file: "package-lock.json", versions: [...versions] });
    } catch { /* ignore */ }
  }

  // yarn.lock
  const yarnLock = join(ROOT, "yarn.lock");
  if (existsSync(yarnLock)) {
    const text = readFileSync(yarnLock, "utf8");
    const versions = new Set();
    const re = /^"?@tiptap\/core@[^"\n]+"?:\s*\n\s+version\s+"([^"]+)"/gm;
    let m;
    while ((m = re.exec(text)) !== null) versions.add(m[1]);
    findings.push({ file: "yarn.lock", versions: [...versions] });
  }

  return findings;
}

console.log(dim(`Checking single-instance constraint for ${PKG}...`));

const installed = findInstalledCopies(ROOT);
const installedVersions = [...new Set(installed.map((i) => i.version))];
const lockfiles = scanLockfiles();

let failed = false;

if (installed.length === 0) {
  console.log(yellow(`! No installed copy of ${PKG} found in node_modules (run install first).`));
} else {
  console.log(`Installed copies: ${installed.length}`);
  for (const i of installed) console.log(dim(`  - ${i.version}  ${i.path}`));
  if (installedVersions.length > 1) {
    console.error(red(`✗ Multiple versions of ${PKG} resolved: ${installedVersions.join(", ")}`));
    failed = true;
  }
}

for (const lf of lockfiles) {
  if (lf.versions.length === 0) {
    console.log(dim(`  ${lf.file}: no entries`));
    continue;
  }
  console.log(`${lf.file} versions: ${lf.versions.join(", ")}`);
  if (lf.versions.length > 1) {
    console.error(red(`✗ ${lf.file} declares multiple versions of ${PKG}: ${lf.versions.join(", ")}`));
    failed = true;
  }
}

if (failed) {
  console.error(red("\nFix:"));
  console.error("  1. Ensure package.json has an `overrides` (npm) and `resolutions` (bun/yarn) entry pinning @tiptap/core.");
  console.error("  2. Delete node_modules and the lockfile, then reinstall.");
  console.error("  3. Re-run `npm run check:deps`.");
  process.exit(1);
}

console.log(green(`✓ Single version of ${PKG} resolved everywhere.`));
