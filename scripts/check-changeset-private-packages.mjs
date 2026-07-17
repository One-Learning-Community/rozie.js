#!/usr/bin/env node
// scripts/check-changeset-private-packages.mjs — quick 260716-npt Finding 3
// (Fix B).
//
// THE BUG: a `.changeset/*.md` whose YAML front-matter names a PRIVATE family
// root (e.g. `@rozie-ui/toast`, which carries `"private": true` — only its
// per-target leaves like `@rozie-ui/toast-react` publish) versions NOTHING
// and errors NOTHING under the current changesets config
// (`privatePackages.version: false` in .changeset/config.json silently
// no-ops a private package instead of failing). The changeset's summary text
// gets consumed into no CHANGELOG, no version bump happens anywhere, and the
// mistake is invisible until someone notices the described fix never shipped.
//
// THE GATE: scan every `.changeset/*.md` (skip README.md and config.json —
// config.json isn't `.md` so the glob already excludes it), parse the
// front-matter package-name keys, resolve each against the workspace, and
// FAIL LOUD (exit 1, naming every offending changeset + package) if any
// named package has `"private": true` in its `package.json`.
//
// Mirrors the style of the repo's other `scripts/check-*.mjs` guards
// (check-dep-drift.mjs, check-sidecar-staleness.mjs): dependency-free Node,
// `import.meta.url`-anchored ROOT, `--self-test` proving the gate is not
// vacuous against REAL workspace data.
//
// Zero new deps. Node 20+. ESM.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGESET_DIR = join(ROOT, '.changeset');

// Same workspace-glob discovery shape as scripts/release-precheck.mjs
// (readWorkspaceGlobs / expandGlob), duplicated intentionally rather than
// imported — each check-*.mjs gate stays a standalone, dependency-free
// script (T-24-SC3 precedent: a shared-module dependency between gates is
// itself an unreviewed-payload surface for a supply-chain gate).
const FALLBACK_GLOBS = [
  'packages/*',
  'packages/targets/*',
  'packages/runtime/*',
  'packages/ui/*',
  'packages/ui/*/packages/*',
];

function readWorkspaceGlobs() {
  const file = join(ROOT, 'pnpm-workspace.yaml');
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  const lines = text.split(/\r?\n/);
  const globs = [];
  let inPackages = false;
  for (const line of lines) {
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    const m = line.match(/^\s*-\s*["']?([^"'\s#]+)["']?\s*(?:#.*)?$/);
    if (m) {
      globs.push(m[1]);
      continue;
    }
    if (line.trim() === '') continue;
    if (/^\S/.test(line)) break;
  }
  return globs.length ? globs : null;
}

function expandGlob(glob) {
  const segments = glob.split('/');
  let dirs = [ROOT];
  for (const seg of segments) {
    const next = [];
    if (seg === '*') {
      for (const d of dirs) {
        let entries;
        try {
          entries = readdirSync(d, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const e of entries) {
          if (e.isDirectory()) next.push(join(d, e.name));
        }
      }
    } else {
      for (const d of dirs) {
        const p = join(d, seg);
        try {
          if (statSync(p).isDirectory()) next.push(p);
        } catch {
          /* not a directory / does not exist */
        }
      }
    }
    dirs = next;
  }
  return dirs;
}

/**
 * Build a Map<packageName, { private: boolean, dir: string }> covering EVERY
 * workspace member (publishable AND private) — the private set is exactly
 * what this gate needs to catch.
 */
function discoverWorkspacePackages() {
  const globs = readWorkspaceGlobs() || FALLBACK_GLOBS;
  const seenDirs = new Set();
  const byName = new Map();
  for (const glob of globs) {
    for (const dir of expandGlob(glob)) {
      if (seenDirs.has(dir)) continue;
      seenDirs.add(dir);
      const pkgPath = join(dir, 'package.json');
      let pkg;
      try {
        pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      } catch {
        continue; // no package.json (intermediate dir, e.g. a family root's `packages/` container)
      }
      if (!pkg.name) continue;
      byName.set(pkg.name, { private: pkg.private === true, dir: dir });
    }
  }
  return byName;
}

/**
 * Parse a changeset `.md` file's YAML front-matter (the block between the
 * first two `---` lines) and return the package-name keys it lists. Front-
 * matter lines look like `"@scope/pkg": patch` or `pkg: minor` — a simple
 * line-oriented parse (no YAML dependency, matching the project's
 * dependency-free-gate convention) is sufficient for the changesets-authored
 * shape.
 */
function parseChangesetPackageNames(text) {
  const lines = text.split(/\r?\n/);
  let dashCount = 0;
  const names = [];
  for (const line of lines) {
    if (/^---\s*$/.test(line)) {
      dashCount++;
      if (dashCount === 2) break;
      continue;
    }
    if (dashCount !== 1) continue;
    const m = line.match(/^\s*["']?([^"':]+)["']?\s*:\s*\S+\s*$/);
    if (m) names.push(m[1].trim());
  }
  return names;
}

function listChangesetFiles() {
  let entries;
  try {
    entries = readdirSync(CHANGESET_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name.toLowerCase() !== 'readme.md')
    .map((e) => join(CHANGESET_DIR, e.name));
}

/**
 * The core check, factored out so `--self-test` can drive it against
 * synthetic input. Returns an array of offenders:
 *   { file, pkgName }
 */
function findPrivatePackageOffenders(changesetFiles, workspaceByName, readFile = (f) => readFileSync(f, 'utf8')) {
  const offenders = [];
  for (const file of changesetFiles) {
    const text = readFile(file);
    const names = parseChangesetPackageNames(text);
    for (const name of names) {
      const entry = workspaceByName.get(name);
      if (entry && entry.private) {
        offenders.push({ file, pkgName: name });
      }
    }
  }
  return offenders;
}

function runGate() {
  const workspaceByName = discoverWorkspacePackages();
  const changesetFiles = listChangesetFiles();
  const offenders = findPrivatePackageOffenders(changesetFiles, workspaceByName);

  if (offenders.length > 0) {
    console.error(
      `✗ changeset private-package guard FAILED — ${offenders.length} changeset entry/entries name a PRIVATE`,
    );
    console.error('  family root (privatePackages.version:false silently versions NOTHING for these):');
    for (const { file, pkgName } of offenders) {
      console.error(`  + ${pkgName}  (in ${file.replace(ROOT + '/', '')})`);
    }
    console.error('');
    console.error('  Fix: point the changeset at the PUBLISHED per-target leaf package name(s)');
    console.error('  (e.g. "@rozie-ui/<family>-react", "@rozie-ui/<family>-vue", ...) instead of the');
    console.error('  private family root.');
    process.exit(1);
  }

  console.log(
    `✓ changeset private-package guard OK — ${changesetFiles.length} changeset file(s) scanned, no private-root entries.`,
  );
  process.exit(0);
}

/**
 * `--self-test`: prove the gate is NOT vacuous against REAL workspace data.
 *   (1) A synthetic changeset naming a KNOWN private family root
 *       (`@rozie-ui/toast`) MUST be rejected.
 *   (2) A synthetic changeset naming a KNOWN published leaf
 *       (`@rozie-ui/toast-react`) MUST pass.
 * Exit 0 only if BOTH hold.
 */
function runSelfTest() {
  const workspaceByName = discoverWorkspacePackages();

  const PRIVATE_ROOT = '@rozie-ui/toast';
  const PUBLISHED_LEAF = '@rozie-ui/toast-react';

  const privateEntry = workspaceByName.get(PRIVATE_ROOT);
  if (!privateEntry || !privateEntry.private) {
    console.error(`✗ self-test FAILED: expected ${PRIVATE_ROOT} to be a discovered PRIVATE workspace package —`);
    console.error('  the workspace discovery is broken, or the fixture package changed shape.');
    process.exit(1);
  }
  const leafEntry = workspaceByName.get(PUBLISHED_LEAF);
  if (!leafEntry || leafEntry.private) {
    console.error(`✗ self-test FAILED: expected ${PUBLISHED_LEAF} to be a discovered PUBLIC workspace package —`);
    console.error('  the workspace discovery is broken, or the fixture package changed shape.');
    process.exit(1);
  }

  const fakeFiles = ['self-test-private-root.md', 'self-test-published-leaf.md'];
  const fakeContents = {
    'self-test-private-root.md': `---\n"${PRIVATE_ROOT}": patch\n---\n\nsynthetic self-test changeset.\n`,
    'self-test-published-leaf.md': `---\n"${PUBLISHED_LEAF}": patch\n---\n\nsynthetic self-test changeset.\n`,
  };
  const readFile = (f) => fakeContents[f.split('/').pop()];

  const offenders = findPrivatePackageOffenders(fakeFiles, workspaceByName, readFile);
  const offenderNames = offenders.map((o) => o.pkgName);

  if (!offenderNames.includes(PRIVATE_ROOT)) {
    console.error(`✗ self-test FAILED: a changeset naming the private root ${PRIVATE_ROOT} was NOT rejected —`);
    console.error('  the gate is vacuous on the private-root path.');
    process.exit(1);
  }
  if (offenderNames.includes(PUBLISHED_LEAF)) {
    console.error(`✗ self-test FAILED: a changeset naming the published leaf ${PUBLISHED_LEAF} was incorrectly`);
    console.error('  rejected — the gate false-positives on legitimate changesets.');
    process.exit(1);
  }

  console.log('✓ self-test passed — the gate rejects a private-root changeset and accepts a published-leaf one:');
  console.log(`    private-root path: "${PRIVATE_ROOT}" is correctly flagged.`);
  console.log(`    published-leaf path: "${PUBLISHED_LEAF}" is correctly accepted.`);
  process.exit(0);
}

if (process.argv.includes('--self-test')) {
  runSelfTest();
} else {
  runGate();
}
