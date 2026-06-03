#!/usr/bin/env node
// scripts/check-dep-drift.mjs — Phase 24 Plan 02 (SPEC req 8 / T-24-SC1..SC3).
//
// THE THREAT (T-24-SC1, tampering / supply chain): a dependency update can pull
// in a NEW transitive package — a typosquat, a compromised maintainer release, a
// freshly-injected payload — and the FIRST place that new package becomes visible
// in this repo is `pnpm-lock.yaml`. Direct deps get human eyes at PR time; the
// transitive closure rarely does. This gate fails CI on ANY resolved package
// NAME that is not in the checked-in allowlist (`scripts/dep-allowlist.txt`), so
// a new transitive payload cannot land without a human reviewing the allowlist
// diff and re-running `--update`.
//
// SCOPE (D-05): the allowlist contains ALL resolved (transitive) package names,
// not just direct/prod deps. NAMES ONLY (D-06) — a version bump of an already-
// allowlisted name does NOT fail the gate. Pinning versions/hashes is a heavier
// supply-chain control deliberately out of scope for this gate.
//
// EXTRACTION (D-05): names are read from the `packages:` block of pnpm-lock.yaml
// ONLY — sliced strictly between the line matching `^packages:` and the line
// matching `^snapshots:`. The `packages:` keys are version-clean (`name@version`);
// the `snapshots:` keys carry peer-dependency suffix parens (e.g.
// `'foo@1.2.3(bar@4.5.6)'`) which would corrupt the name parse, so `snapshots:`
// is NEVER read. For each indented key, the name is `key.slice(0, key.lastIndexOf('@'))`
// — `lastIndexOf` finds the VERSION `@`, preserving any leading `@scope/`
// (`'@scope/pkg@1.2.3'` → `@scope/pkg`; `'pkg@1.2.3'` → `pkg`).
//
// NO YAML-PARSER DEPENDENCY (T-24-SC3, D-05): adding a dependency to a dependency
// gate would be self-defeating (it would itself be an unreviewed transitive
// payload). This gate is dependency-free Node — a text slice + `lastIndexOf('@')`
// string parse. The `packages:` keys are flat and well-formed enough that no
// general YAML parse is needed.
//
// `--update` mode: re-snapshot — rewrite `scripts/dep-allowlist.txt` from the
// CURRENT lockfile (sorted, one name per line, trailing newline). Run this after
// a reviewed, legitimate dependency change; the diff is PR-reviewable.
//
// `--self-test` mode (T-24-SC2, against a vacuous gate): prove the gate is NOT
// vacuous. (1) Build an in-memory allowlist MINUS one real lockfile name and
// assert the gate REJECTS (the removed name is reported as new/unallowlisted).
// (2) Build an allowlist where one entry is a synthetically VERSION-BUMPED form
// of a real name and assert the gate PASSES (proves names-only — the bump does
// not register as a new name). Exit non-zero if EITHER invariant fails.
//
// Structure mirrors scripts/check-sidecar-staleness.mjs (the repo's other
// dependency-free `.mjs` gate: `import.meta.url` ROOT anchoring, `--self-test`
// negative-path automation, clear exit-non-zero messaging).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCKFILE = join(ROOT, 'pnpm-lock.yaml');
const ALLOWLIST = join(ROOT, 'scripts', 'dep-allowlist.txt');

/**
 * Slice the text of `pnpm-lock.yaml` strictly between the `^packages:` line and
 * the `^snapshots:` line (D-05). Only `packages:` keys are version-clean; the
 * `snapshots:` block carries peer-suffix parens that would corrupt the parse.
 * Throws if either boundary is missing (a malformed/unexpected lockfile shape
 * must fail loudly, not silently extract zero names).
 */
function slicePackagesBlock(lockText) {
  const lines = lockText.split('\n');
  let start = -1;
  let end = -1;
  for (let i = 0; i < lines.length; i++) {
    if (start === -1 && /^packages:\s*$/.test(lines[i])) {
      start = i + 1;
      continue;
    }
    if (start !== -1 && /^snapshots:\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  if (start === -1) {
    throw new Error('check-dep-drift: could not find a `packages:` block in pnpm-lock.yaml');
  }
  if (end === -1) {
    throw new Error('check-dep-drift: could not find the `snapshots:` boundary after `packages:` in pnpm-lock.yaml');
  }
  return lines.slice(start, end);
}

/**
 * Given a `packages:` key line, return the resolved package NAME, or null if the
 * line is not a package key (blank, resolution/engines metadata, etc.).
 *
 * A package key is a top-level-of-the-block entry: exactly 2-space indented,
 * ending in `:`, optionally single-quoted. e.g.
 *   `  '@scope/pkg@1.2.3':`  → `@scope/pkg`
 *   `  pkg@1.2.3:`           → `pkg`
 * Nested metadata (`    resolution: {...}`) is 4-space indented and is skipped.
 */
function nameFromPackageKeyLine(line) {
  // Package keys are indented exactly two spaces (block members). Deeper
  // indentation is per-package metadata (resolution/engines/dependencies).
  const m = /^ {2}('?)([^']+?)\1:\s*$/.exec(line);
  if (!m) return null;
  const key = m[2];
  const at = key.lastIndexOf('@');
  // A valid `name@version` key has an `@` that is NOT the leading scope `@`.
  if (at <= 0) return null;
  return key.slice(0, at);
}

/**
 * Read pnpm-lock.yaml and return the deduped, sorted set of resolved package
 * names from the `packages:` block.
 */
function extractNames(lockText) {
  const blockLines = slicePackagesBlock(lockText);
  const names = new Set();
  for (const line of blockLines) {
    const name = nameFromPackageKeyLine(line);
    if (name !== null) names.add(name);
  }
  return [...names].sort();
}

/** Read the checked-in allowlist into a sorted array of names (ignores blanks). */
function readAllowlist(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .sort();
}

/**
 * The core diff, factored out so `--self-test` can drive it against synthetic
 * inputs. Returns the sorted list of lockfile names absent from the allowlist.
 */
function findNewNames(lockfileNames, allowlistNames) {
  const allowed = new Set(allowlistNames);
  return lockfileNames.filter((n) => !allowed.has(n)).sort();
}

function serializeAllowlist(names) {
  return `${names.join('\n')}\n`;
}

function runUpdate() {
  const lockText = readFileSync(LOCKFILE, 'utf8');
  const names = extractNames(lockText);
  writeFileSync(ALLOWLIST, serializeAllowlist(names), 'utf8');
  console.log(`✓ wrote ${names.length} resolved package name(s) to scripts/dep-allowlist.txt`);
  process.exit(0);
}

function runGate() {
  const lockText = readFileSync(LOCKFILE, 'utf8');
  const lockfileNames = extractNames(lockText);

  let allowlistText;
  try {
    allowlistText = readFileSync(ALLOWLIST, 'utf8');
  } catch {
    console.error('✗ scripts/dep-allowlist.txt is missing — run `node scripts/check-dep-drift.mjs --update`');
    console.error('  to snapshot the current resolved-dependency name set.');
    process.exit(1);
  }
  const allowlistNames = readAllowlist(allowlistText);

  const newNames = findNewNames(lockfileNames, allowlistNames);
  if (newNames.length > 0) {
    console.error(`✗ dependency-drift gate FAILED — ${newNames.length} resolved package name(s) in`);
    console.error('  pnpm-lock.yaml are NOT in scripts/dep-allowlist.txt (new transitive');
    console.error('  dependency detected — a potential supply-chain payload, T-24-SC1). Review');
    console.error('  each new name, confirm it is legitimate, then run');
    console.error('  `node scripts/check-dep-drift.mjs --update` to re-snapshot the allowlist:');
    for (const n of newNames.slice(0, 40)) console.error(`  + ${n}`);
    if (newNames.length > 40) console.error(`  … and ${newNames.length - 40} more`);
    process.exit(1);
  }

  console.log(
    `✓ dependency-drift OK — all ${lockfileNames.length} resolved package name(s) are allowlisted (names only; version bumps ignored).`,
  );
  process.exit(0);
}

/**
 * `--self-test` (T-24-SC2): prove the gate is not vacuous against the REAL
 * lockfile-derived name set.
 *   (1) Removed-name path: an allowlist missing one real name MUST be rejected,
 *       and that exact name MUST be the reported new name.
 *   (2) Version-bump path: an allowlist that version-bumps one real name (i.e.
 *       the bump is irrelevant because we compare NAMES) MUST pass — proving the
 *       gate is names-only (D-06) and a version bump never registers as drift.
 * Exit 0 only if BOTH hold.
 */
function runSelfTest() {
  const lockText = readFileSync(LOCKFILE, 'utf8');
  const lockfileNames = extractNames(lockText);
  if (lockfileNames.length === 0) {
    console.error('✗ self-test FAILED: extracted zero package names from pnpm-lock.yaml — the');
    console.error('  packages:-block slice or key parse is broken.');
    process.exit(1);
  }

  // (1) Removed-name path: drop one real name from a copy of the allowlist and
  // assert the gate reports exactly that name as new.
  const victim = lockfileNames[0];
  const withoutVictim = lockfileNames.filter((n) => n !== victim);
  const reportedNew = findNewNames(lockfileNames, withoutVictim);
  if (!reportedNew.includes(victim)) {
    console.error('✗ self-test FAILED: removing a real package name from the allowlist did NOT');
    console.error(`  make the gate report it as a new/unallowlisted name (the gate is vacuous).`);
    console.error(`    removed: ${victim}`);
    console.error(`    reported new: ${reportedNew.length === 0 ? '(none)' : reportedNew.join(', ')}`);
    process.exit(1);
  }
  // The removed name MUST be the ONLY thing reported new (full allowlist minus one).
  if (reportedNew.length !== 1) {
    console.error('✗ self-test FAILED: the full allowlist minus one name should report EXACTLY one');
    console.error(`  new name, but the gate reported ${reportedNew.length}. The diff is not sound.`);
    console.error(`    reported new: ${reportedNew.join(', ')}`);
    process.exit(1);
  }

  // (2) Version-bump path: synthesize a bumped form of `victim` IN THE ALLOWLIST.
  // Because the gate compares NAMES (the allowlist holds bare names), a bumped
  // entry like `${victim}-IGNORED-VERSION-SUFFIX` would NOT match `victim` — so
  // to prove names-only correctly we model the lockfile getting a version bump
  // while the allowlist keeps the SAME name: the gate must still pass. The
  // allowlist already holds bare names, so any version movement in the lockfile
  // resolves to the same extracted name. Assert: the full real allowlist passes
  // (zero new names), which IS the version-bump-immune steady state.
  const fullAllowlist = lockfileNames.slice();
  const newAgainstFull = findNewNames(lockfileNames, fullAllowlist);
  if (newAgainstFull.length !== 0) {
    console.error('✗ self-test FAILED: the lockfile name set diffed against itself reported new');
    console.error(`  names (${newAgainstFull.length}) — the names-only diff is not stable.`);
    process.exit(1);
  }
  // Explicitly exercise the names-only property: an allowlist whose only change
  // from reality is that one name's UNDERLYING version differs is, by name, the
  // identical set — so a synthetic "the lockfile bumped victim's version" still
  // extracts `victim` and matches. Model this directly: confirm a duplicate
  // version-suffixed name does not leak into the extracted set (lastIndexOf).
  const bumpedKeyName = nameFromPackageKeyLine(`  '${victim}@9999.0.0':`);
  if (bumpedKeyName !== victim) {
    console.error('✗ self-test FAILED: a version-bumped key for an allowlisted name did NOT extract');
    console.error(`  to the same name — the gate would treat a version bump as a new dependency.`);
    console.error(`    expected: ${victim}  got: ${bumpedKeyName}`);
    process.exit(1);
  }

  console.log('✓ self-test passed — the gate rejects a removed name and ignores version bumps:');
  console.log(`    removed-name path: dropping "${victim}" reports it as the sole new name.`);
  console.log(`    version-bump path: "${victim}@9999.0.0" extracts to "${victim}" (names-only).`);
  process.exit(0);
}

if (process.argv.includes('--update')) {
  runUpdate();
} else if (process.argv.includes('--self-test')) {
  runSelfTest();
} else {
  runGate();
}
