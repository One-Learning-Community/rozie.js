#!/usr/bin/env node
// @ts-check
//
// release-precheck.mjs — mechanical pre-publish guard for the Rozie.js monorepo.
//
// PURPOSE
// -------
// Encode the recurring mechanical release footguns this project keeps hitting
// as a single fail-loud script:
//   (a) forgot-to-bump → `pnpm publish` (no --force) SILENTLY skips an
//       already-published version, so consumers get stale code.
//   (b) stale scaffold description copied from the template family.
//   (c) wrong `repository.directory` (and url/homepage/bugs) after a leaf
//       copy-paste.
//   (d) `files` / `exports` referencing artifacts that don't exist.
//   (e) a published leaf depending on an @rozie/runtime-* version that is not
//       yet on npm → a dangling published dependency.
//   (f) PUBLISHED-TARBALL DRIFT — the registry is silently serving stale
//       bytes for a version that already exists there. `pnpm publish`
//       (no --force) skips an already-published version, so any commit that
//       regenerates a package's shipped source WITHOUT a version bump leaves
//       npm permanently stale under that version number. Detected by
//       `npm pack`-ing the CURRENT local version and byte-comparing every
//       shipped file (plus a reverse pass for files the `files` field would
//       ship but the tarball is missing) against the worktree. See
//       RELEASING.md §6 item 10 (D1) for the reference derivation this check
//       mechanizes, and §7 for the 2026-08-04 stale-publish finding.
//
// TWO-LAYER GUARD MODEL (see RELEASING.md for the full rationale):
//   * The REAL pre-publish guard is the releaser's LOCAL pre-flight:
//       `pnpm release:precheck --gate`
//     run AFTER building and BEFORE dispatching release.yml. It owns the
//     timing-sensitive checks — (a) version-vs-npm and (e) workspace-dep-on-npm
//     — because those can only be evaluated against the registry just before a
//     dispatch.
//   * release.yml runs this ONLY as an ADVISORY step: AUDIT mode + --skip-npm,
//     `continue-on-error: true`. It surfaces the deterministic, network-free
//     structural checks (b/c/d) in the run log without ever blocking a publish
//     or false-failing on registry timing. A CI hard --gate is IMPOSSIBLE here:
//     the toolchain publishes earlier in the same run (there is never an
//     "all built, nothing published" moment), and in a combined toolchain+leaf
//     release the freshly-bumped @rozie/runtime-* is not on npm yet at the
//     moment the leaves build — check (e) would false-fail.
//
// MODES
// -----
//   (default) AUDIT  — report; already-published is the EXPECTED steady state
//                      (NOT a failure). Exit 1 only on a genuine structural
//                      problem (b/c/d) or a hard dep break.
//   --gate / --pre-publish — already-published becomes a HARD FAIL
//                      (forgot-to-bump). Registry-unreachable becomes a FAIL
//                      (a network blip must not greenlight a publish).
//   --skip-npm / --offline — skip ALL registry GETs; only the deterministic
//                      checks (b/c/d) run. Never hangs. This is the CI mode.
//   --filter <name> (repeatable) / positional names — scope to a subset by
//                      exact package name. Default = all publishable.
//   --tarball          Run check (f) — published-tarball drift. Implied by
//                      --gate. Ignored under --skip-npm. Costs roughly one
//                      `npm pack` + extract per in-scope package (~4-6 min
//                      unscoped, ~102 registry packs). This is the guard
//                      against the silently-skipped-republish class.
//   --help
//
// Zero new deps. Node 20+ (global fetch + AbortController). ESM.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORG_SUBSTR = 'One-Learning-Community/rozie.js';
const REGISTRY = 'https://registry.npmjs.org';
const REGISTRY_TIMEOUT_MS = 8000;
const STALE_DESC_RE = /TODO|PLACEHOLDER|FIXME|describe your package|scaffold/i;

// ---------------------------------------------------------------------------
// Check (f) allowlist — keyed `name@version` (D-07: a bump re-arms the check
// automatically, since the key no longer matches). An allowlisted drift
// reports WARN (never FAIL) and always prints the reason + ref so the parked
// item stays visible in every run.
// ---------------------------------------------------------------------------
const TARBALL_DRIFT_ALLOWLIST = {
  '@rozie-ui/popover-lit@0.1.2': {
    reason:
      'public slot-scope type drift (unknown -> any on the anchor render-prop scope) parked pending an API decision, not a mechanical patch ripple',
    ref: '.planning/todos/pending/rozie-ui-stale-publish-reconciliation.md',
  },
};

// Fallback workspace globs if pnpm-workspace.yaml cannot be read. MUST include
// packages/targets/* per the plan (those @rozie/target-* are inlined into core
// and not in the publish steps, but if public they should at least be audited).
const FALLBACK_GLOBS = [
  'packages/*',
  'packages/targets/*',
  'packages/runtime/*',
  'packages/ui/*',
  'packages/ui/*/packages/*',
];

// ---------------------------------------------------------------------------
// CLI parsing (hand-rolled; no commander)
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = { mode: 'audit', skipNpm: false, tarball: false, help: false, filters: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--gate' || a === '--pre-publish') opts.mode = 'gate';
    else if (a === '--skip-npm' || a === '--offline') opts.skipNpm = true;
    else if (a === '--tarball') opts.tarball = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--filter') {
      const v = argv[++i];
      if (v) opts.filters.push(v);
    } else if (a.startsWith('--filter=')) {
      opts.filters.push(a.slice('--filter='.length));
    } else if (a.startsWith('-')) {
      console.error(`Unknown flag: ${a} (try --help)`);
      process.exit(2);
    } else {
      opts.filters.push(a); // positional package name
    }
  }
  return opts;
}

function printHelp() {
  console.log(`release-precheck — mechanical pre-publish guard for Rozie.js

Usage: node scripts/release-precheck.mjs [options] [package-name ...]

Modes:
  (default)            AUDIT — report; already-published == OK (steady state).
  --gate, --pre-publish  Already-published becomes a HARD FAIL (forgot-to-bump);
                       registry-unreachable becomes a FAIL. Run this LOCALLY,
                       post-build + pre-dispatch, as the real pre-publish guard.
  --skip-npm, --offline  Skip ALL registry GETs (only b/c/d run); never hangs.
                       This is the mode the CI advisory step uses. Check (f)
                       never runs under --skip-npm, even with --tarball.
  --tarball             Run check (f) — published-tarball drift (implied by
                       --gate). Detects the "regenerated without a version
                       bump" class: npm-packs the CURRENT local version and
                       byte-compares every shipped file against the worktree.
                       Costs ~one registry pack per in-scope package (roughly
                       4-6 minutes unscoped across the full workspace).
  --filter <name>      Scope to a package by exact name (repeatable). Positional
                       names work too. Default = all publishable packages.
  --help, -h           This help.

Checks: (a) version vs npm  (b) description quality  (c) url/dir accuracy
        (d) files+exports resolve on disk  (e) @rozie/* workspace deps on npm
        (f) published-tarball drift (--tarball or --gate only)`);
}

// ---------------------------------------------------------------------------
// Discovery — read pnpm-workspace.yaml globs at runtime, expand, filter private
// ---------------------------------------------------------------------------
function readWorkspaceGlobs() {
  const file = path.join(REPO_ROOT, 'pnpm-workspace.yaml');
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
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
    // A non-list, non-blank line at any other key ends the packages block.
    if (/^\S/.test(line)) break;
  }
  return globs.length ? globs : null;
}

// Expand a single glob whose only wildcard is `*` matching one path segment.
function expandGlob(glob) {
  const segments = glob.split('/');
  let dirs = [REPO_ROOT];
  for (const seg of segments) {
    const next = [];
    if (seg === '*') {
      for (const d of dirs) {
        let entries;
        try {
          entries = fs.readdirSync(d, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const e of entries) {
          if (e.isDirectory()) next.push(path.join(d, e.name));
        }
      }
    } else {
      for (const d of dirs) {
        const p = path.join(d, seg);
        try {
          if (fs.statSync(p).isDirectory()) next.push(p);
        } catch {
          /* not a directory / does not exist */
        }
      }
    }
    dirs = next;
  }
  return dirs;
}

// Build the publishable map (name -> { name, version, dir, abs, pkg }) for every
// workspace member with `private !== true`, PLUS a set of private workspace
// package names. The private set lets check (e) distinguish a genuinely-missing
// dep from a dep on a package that exists in the repo but will NEVER publish
// (a bundled @rozie/target-* listed as a runtime dependency → a dangling dep).
function discoverWorkspace() {
  const globs = readWorkspaceGlobs() || FALLBACK_GLOBS;
  const seenDirs = new Set();
  const byName = new Map();
  const privateNames = new Set();
  for (const glob of globs) {
    for (const dir of expandGlob(glob)) {
      if (seenDirs.has(dir)) continue;
      seenDirs.add(dir);
      const pkgPath = path.join(dir, 'package.json');
      let pkg;
      try {
        pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      } catch {
        continue; // no package.json (e.g. an intermediate dir)
      }
      if (!pkg.name) continue;
      if (pkg.private === true) {
        privateNames.add(pkg.name);
        continue;
      }
      byName.set(pkg.name, {
        name: pkg.name,
        version: pkg.version,
        dir: path.relative(REPO_ROOT, dir).split(path.sep).join('/'),
        abs: dir,
        pkg,
      });
    }
  }
  return { byName, privateNames };
}

// ---------------------------------------------------------------------------
// Registry helpers
// ---------------------------------------------------------------------------
// Direct GET of an exact version. `npm view` lags on the FIRST-EVER publish of a
// brand-new package name; the direct version document does not.
async function registryHas(name, version) {
  const url = `${REGISTRY}/${encodeURIComponent(name)}/${version}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REGISTRY_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: 'application/json' },
    });
    if (res.status === 200) return { published: true };
    if (res.status === 404) return { published: false };
    return { error: `HTTP ${res.status}` };
  } catch (err) {
    const e = /** @type {any} */ (err);
    return { error: e && e.name === 'AbortError' ? 'timeout' : (e && e.message) || 'network error' };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Per-package checks. Each returns { status, detail }.
//   status ∈ 'OK' | 'WARN' | 'FAIL' | 'SKIP'
// ---------------------------------------------------------------------------

// (a) VERSION vs npm
async function checkVersion(entry, opts) {
  if (opts.skipNpm) return { status: 'SKIP', detail: 'registry skipped (--skip-npm)' };
  const r = await registryHas(entry.name, entry.version);
  if (r.error) {
    const msg = `registry unreachable (${r.error})`;
    return opts.mode === 'gate'
      ? { status: 'FAIL', detail: `${msg} — refusing to greenlight` }
      : { status: 'WARN', detail: msg };
  }
  if (r.published) {
    return opts.mode === 'gate'
      ? { status: 'FAIL', detail: `${entry.version} already on npm — BUMP before publish (pnpm skips it silently)` }
      : { status: 'OK', detail: `${entry.version} published (steady state)` };
  }
  return { status: 'OK', detail: `${entry.version} not yet on npm` };
}

// (b) DESCRIPTION quality — deterministic, network-free.
function checkDescription(entry) {
  const d = entry.pkg.description;
  if (!d || typeof d !== 'string' || d.trim() === '') {
    return { status: 'FAIL', detail: 'description missing/empty' };
  }
  if (d.trim().length < 20) {
    return { status: 'FAIL', detail: `description too short (${d.trim().length} chars)` };
  }
  if (STALE_DESC_RE.test(d)) {
    return { status: 'FAIL', detail: 'description looks like scaffold/placeholder text' };
  }
  return { status: 'OK', detail: 'ok' };
}

// (c) URL accuracy — deterministic, network-free.
function checkUrls(entry) {
  const p = entry.pkg;
  const problems = [];
  const repoUrl = p.repository && (typeof p.repository === 'string' ? p.repository : p.repository.url);
  const bugsUrl = p.bugs && (typeof p.bugs === 'string' ? p.bugs : p.bugs.url);
  if (!repoUrl || !repoUrl.includes(ORG_SUBSTR)) problems.push('repository.url missing/wrong');
  if (!p.homepage || !String(p.homepage).includes(ORG_SUBSTR)) problems.push('homepage missing/wrong');
  if (!bugsUrl || !bugsUrl.includes(ORG_SUBSTR)) problems.push('bugs.url missing/wrong');
  const dir = p.repository && typeof p.repository === 'object' ? p.repository.directory : undefined;
  if (!dir) {
    problems.push('repository.directory missing');
  } else if (dir !== entry.dir) {
    problems.push(`repository.directory "${dir}" != actual "${entry.dir}" (copy-paste error?)`);
  }
  return problems.length
    ? { status: 'FAIL', detail: problems.join('; ') }
    : { status: 'OK', detail: 'ok' };
}

// Collect every concrete path referenced by an exports field. Handles BOTH
// forms: a STRING shorthand value (e.g. "./source": "./src/Captcha.tsx") and an
// OBJECT of conditions / nested subpaths. Never Object.entries() a string.
function collectExportPaths(exportsField) {
  const out = [];
  const visit = (val) => {
    if (typeof val === 'string') {
      out.push(val);
    } else if (val && typeof val === 'object') {
      for (const v of Object.values(val)) visit(v);
    }
  };
  visit(exportsField);
  return out;
}

// (d) files present + exports/main/module/types resolve on disk.
function checkFilesExports(entry, opts) {
  const p = entry.pkg;
  if (!Array.isArray(p.files) || p.files.length === 0) {
    return { status: 'FAIL', detail: '`files` missing or empty' };
  }
  const refs = new Set();
  for (const f of ['main', 'module', 'types']) {
    if (typeof p[f] === 'string') refs.add(p[f]);
  }
  if (p.exports !== undefined) {
    for (const r of collectExportPaths(p.exports)) refs.add(r);
  }
  const broken = [];
  let artifactsMissing = false;
  const distDir = path.join(entry.abs, 'dist');
  const hasDist = fs.existsSync(distDir);
  for (const ref of refs) {
    if (ref.includes('*')) continue; // skip glob/pattern entries
    const abs = path.join(entry.abs, ref);
    if (fs.existsSync(abs)) continue;
    const firstSeg = ref.replace(/^\.\//, '').split('/')[0];
    if (firstSeg === 'dist' && !hasDist) {
      artifactsMissing = true; // build hasn't run yet
    } else {
      broken.push(ref);
    }
  }
  if (broken.length) {
    return { status: 'FAIL', detail: `missing referenced file(s): ${broken.join(', ')}` };
  }
  if (artifactsMissing) {
    const msg = 'dist artifacts missing — run build first (this check assumes a prior build)';
    return opts.mode === 'gate' ? { status: 'FAIL', detail: msg } : { status: 'WARN', detail: msg };
  }
  return { status: 'OK', detail: `${refs.size} path(s) resolve` };
}

// (e) workspace dep resolvability — the registry half is TIMING-SENSITIVE (local
// --gate only); the private-package half is deterministic (runs even offline).
async function checkWorkspaceDeps(entry, byName, privateNames, opts) {
  const deps = entry.pkg.dependencies || {};
  const wsDeps = Object.entries(deps).filter(
    ([name, spec]) => name.startsWith('@rozie/') && typeof spec === 'string' && spec.startsWith('workspace:'),
  );
  if (wsDeps.length === 0) return { status: 'OK', detail: 'no @rozie/* workspace deps' };

  const problems = []; // { msg, sev: 'FAIL' | 'WARN' }
  const registryDeps = [];
  for (const [depName] of wsDeps) {
    if (privateNames.has(depName)) {
      // Deterministic dangling-dep: a private workspace package never publishes,
      // so pnpm rewrites this `workspace:` runtime dep to a version that will
      // 404 on npm. (Bundled deps like @rozie/target-* belong in devDeps.)
      problems.push({
        msg: `${depName} is a PRIVATE workspace package (never published) — a published runtime dep on it is dangling; if it is bundled at build time it must move to devDependencies`,
        sev: opts.mode === 'gate' ? 'FAIL' : 'WARN',
      });
    } else if (byName.has(depName)) {
      registryDeps.push(depName);
    } else {
      problems.push({ msg: `${depName}: not found in workspace (cannot resolve target version)`, sev: 'WARN' });
    }
  }

  if (registryDeps.length) {
    if (opts.skipNpm) {
      problems.push({ msg: `registry resolvability of ${registryDeps.join(', ')} skipped (--skip-npm)`, sev: 'WARN' });
    } else {
      for (const depName of registryDeps) {
        const dep = byName.get(depName);
        const r = await registryHas(depName, dep.version);
        if (r.error) {
          problems.push({
            msg: `${depName}@${dep.version}: registry unreachable (${r.error})`,
            sev: opts.mode === 'gate' ? 'FAIL' : 'WARN',
          });
        } else if (!r.published) {
          // Hard break in BOTH modes: would publish a leaf with a dangling dep.
          problems.push({ msg: `${depName}@${dep.version} NOT on npm — publish runtimes FIRST`, sev: 'FAIL' });
        }
      }
    }
  }

  if (problems.length === 0) return { status: 'OK', detail: `${wsDeps.length} dep(s) resolve` };
  const status = problems.some((p) => p.sev === 'FAIL') ? 'FAIL' : 'WARN';
  return { status, detail: problems.map((p) => p.msg).join('; ') };
}

// ---------------------------------------------------------------------------
// (f) PUBLISHED-TARBALL DRIFT — mechanized port of the validated derivation
// (RELEASING.md §6 item 10 / 260804-hzx PLAN.md §1.2). Ports two mandatory
// pack-time normalizations or the comparison produces ~100% false positives:
//   1. pnpm rewrites every "workspace:*" @rozie/* dep VALUE to a concrete pin
//      at pack time — map any @rozie/-scoped dep value to a constant on both
//      sides before comparing.
//   2. pnpm reorders dependency keys at pack time — sort before comparing.
// ---------------------------------------------------------------------------

// Convert one `files` field entry (positive or `!`-negated) into a matcher.
// A bare entry with no glob metacharacter (e.g. "dist", "src") matches itself
// AND everything nested under it (npm `files`-field directory semantics). A
// glob entry is compiled segment-by-segment so `**` can match ZERO OR MORE
// path segments (not one-or-more) — required for `!src/**/__tests__/**` to
// exclude `src/__tests__/x.ts` (no intermediate directory), and `*` matches
// within a single segment only (never crosses `/`).
function compileFilesPattern(pattern) {
  const negative = pattern.startsWith('!');
  const pat = negative ? pattern.slice(1) : pattern;
  if (!/[*?]/.test(pat)) {
    const prefix = pat.replace(/\/+$/, '');
    return { negative, test: (rel) => rel === prefix || rel.startsWith(`${prefix}/`) };
  }
  const segs = pat.split('/');
  let re = '^';
  segs.forEach((seg, i) => {
    const isLast = i === segs.length - 1;
    if (seg === '**') {
      re += isLast ? '.*' : '(?:[^/]+/)*';
    } else {
      const escaped = seg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
      re += escaped;
      if (!isLast) re += '/';
    }
  });
  re += '$';
  const regex = new RegExp(re);
  return { negative, test: (rel) => regex.test(rel) };
}

// Include-if-any-positive-matches AND no-negative-matches (negation-aware).
function shipsPath(rel, filesField) {
  const compiled = (filesField || []).map(compileFilesPattern);
  const positives = compiled.filter((p) => !p.negative);
  const negatives = compiled.filter((p) => p.negative);
  if (!positives.some((p) => p.test(rel))) return false;
  return !negatives.some((p) => p.test(rel));
}

// Recursively list every FILE (not dir) under `root`, relative to `root`,
// forward-slash-joined regardless of platform.
function walkFiles(root) {
  const out = [];
  const stack = [''];
  while (stack.length) {
    const rel = stack.pop();
    const abs = rel ? path.join(root, rel) : root;
    let entries;
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) stack.push(childRel);
      else if (e.isFile()) out.push(childRel);
    }
  }
  return out.sort();
}

function filesEqual(a, b) {
  try {
    return Buffer.compare(fs.readFileSync(a), fs.readFileSync(b)) === 0;
  } catch {
    return false;
  }
}

// Normalization 1 — map every @rozie/-scoped dep VALUE to a constant, sort keys.
function normalizeDepMap(obj) {
  return Object.entries(obj || {})
    .map(([k, v]) => [k, /^@rozie\//.test(k) ? 'ROZIE-PIN' : v])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

// Projection compared for package.json — dependency/peerDependency maps
// (normalized), sorted `files`, and the artifact-locating fields. Never
// compare the raw file (pnpm mutates it at pack time in ways unrelated to
// drift — see the two normalizations above).
function normalizePkgProjection(pkg) {
  return {
    dependencies: normalizeDepMap(pkg.dependencies),
    peerDependencies: normalizeDepMap(pkg.peerDependencies),
    files: (pkg.files || []).slice().sort(),
    exports: pkg.exports ?? null,
    main: pkg.main ?? null,
    types: pkg.types ?? null,
    webTypes: pkg['web-types'] ?? null,
    customElements: pkg.customElements ?? null,
  };
}

async function checkTarballDrift(entry, opts) {
  // D-06: never under --skip-npm; only when --tarball is passed OR mode is gate.
  if (opts.skipNpm) return { status: 'SKIP', detail: 'tarball drift check skipped (--skip-npm)' };
  if (!opts.tarball && opts.mode !== 'gate') {
    return { status: 'SKIP', detail: 'tarball drift check not requested (pass --tarball; implied by --gate)' };
  }

  const r = await registryHas(entry.name, entry.version);
  if (r.error) {
    return { status: 'WARN', detail: `registry unreachable (${r.error}) — tarball drift check skipped` };
  }
  if (!r.published) {
    // Expected steady state for every package in a pending bump set.
    return { status: 'SKIP', detail: 'pending publish' };
  }

  const allowlistEntry = TARBALL_DRIFT_ALLOWLIST[`${entry.name}@${entry.version}`];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rozie-precheck-tarball-'));
  try {
    const pack = spawnSync('npm', ['pack', `${entry.name}@${entry.version}`, '--silent'], {
      cwd: tmp,
      encoding: 'utf8',
    });
    if (pack.status !== 0) {
      const lastLine = ((pack.stderr || pack.stdout || '').trim().split('\n').pop() || '').trim();
      return {
        status: opts.mode === 'gate' ? 'FAIL' : 'WARN',
        detail: `npm pack failed: ${lastLine || `exit ${pack.status}`}`,
      };
    }
    const tgz = fs.readdirSync(tmp).find((f) => f.endsWith('.tgz'));
    if (!tgz) {
      return { status: opts.mode === 'gate' ? 'FAIL' : 'WARN', detail: 'npm pack produced no tarball' };
    }
    const untar = spawnSync('tar', ['xzf', tgz], { cwd: tmp });
    if (untar.status !== 0) {
      return { status: opts.mode === 'gate' ? 'FAIL' : 'WARN', detail: `tar extraction failed (exit ${untar.status})` };
    }

    const pkgDir = path.join(tmp, 'package');
    const drift = [];

    // git ls-files first — needed both for the reverse pass AND to detect
    // the THIRD normalization below.
    const ls = spawnSync('git', ['ls-files'], { cwd: entry.abs, encoding: 'utf8' });
    const tracked = ls.status === 0 ? ls.stdout.split('\n').filter(Boolean).sort() : [];

    // Normalization 3 — a package with NO git-tracked LICENSE of its own gets
    // one SYNTHESIZED by `pnpm publish` at pack time (copied from the
    // workspace-root LICENSE). That is expected pack-time behavior, not
    // drift, for every toolchain/runtime package (none carries its own
    // LICENSE). A package that DOES carry its own git-tracked LICENSE (e.g.
    // captcha-angular, flatpickr-vue) is compared normally — that is exactly
    // how the stale-copyright-holder class in those leaves is caught.
    const hasOwnLicense = tracked.includes('LICENSE');
    const isExcluded = (rel) =>
      rel.startsWith('dist/') ||
      rel === 'CHANGELOG.md' ||
      rel === 'package.json' ||
      (rel === 'LICENSE' && !hasOwnLicense);

    // Forward pass: every shipped tarball file must exist in the worktree
    // and be byte-identical.
    for (const rel of walkFiles(pkgDir)) {
      if (isExcluded(rel)) continue;
      const worktreeFile = path.join(entry.abs, rel);
      if (!fs.existsSync(worktreeFile)) {
        drift.push(`GONE:${rel}`);
        continue;
      }
      if (!filesEqual(path.join(pkgDir, rel), worktreeFile)) drift.push(rel);
    }

    // Reverse pass: every worktree file the leaf's `files` field WOULD ship
    // must actually be present in the tarball.
    for (const rel of tracked) {
      if (isExcluded(rel)) continue;
      if (!shipsPath(rel, entry.pkg.files)) continue;
      if (!fs.existsSync(path.join(pkgDir, rel))) drift.push(`NEW:${rel}`);
    }

    // package.json — normalized projection only (see normalizePkgProjection).
    let tarballPkg = {};
    try {
      tarballPkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
    } catch {
      /* falls through to a manifest-drift finding below */
    }
    if (JSON.stringify(normalizePkgProjection(tarballPkg)) !== JSON.stringify(normalizePkgProjection(entry.pkg))) {
      drift.push('package.json:manifest');
    }

    if (drift.length === 0) return { status: 'OK', detail: 'byte-identical to published tarball' };
    if (allowlistEntry) {
      return {
        status: 'WARN',
        detail: `ALLOWLISTED — ${allowlistEntry.reason} (ref: ${allowlistEntry.ref}); drifted: ${drift.join(', ')}`,
      };
    }
    return { status: 'FAIL', detail: `stale publish — drifted: ${drift.join(', ')}` };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Repo-wide structural check (not per-package): a .changeset/*.md naming a
// PRIVATE family root versions nothing under the current changesets config
// (privatePackages.version:false silently no-ops it). Deterministic,
// network-free — belongs alongside checks (b/c/d) and runs in EVERY mode,
// including the CI --skip-npm advisory step (quick 260716-npt Fix B).
// ---------------------------------------------------------------------------
function checkChangesetPrivatePackages() {
  const scriptPath = path.join(REPO_ROOT, 'scripts', 'check-changeset-private-packages.mjs');
  const result = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8' });
  if (result.status === 0) {
    return { status: 'OK', detail: (result.stdout || '').trim() || 'no private-root changeset entries' };
  }
  const detail = ((result.stdout || '') + (result.stderr || '')).trim() || `exit code ${result.status}`;
  return { status: 'FAIL', detail };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const GLYPH = { OK: 'ok', WARN: 'warn', FAIL: 'FAIL', SKIP: '—' };

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function verdictOf(checks) {
  const vals = Object.values(checks).map((c) => c.status);
  if (vals.includes('FAIL')) return 'FAIL';
  if (vals.includes('WARN')) return 'WARN';
  return 'OK';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  const { byName, privateNames } = discoverWorkspace();
  let entries = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));

  if (opts.filters.length) {
    const want = new Set(opts.filters);
    const unknown = opts.filters.filter((f) => !byName.has(f));
    if (unknown.length) {
      console.error(`Unknown package name(s): ${unknown.join(', ')}`);
      console.error('Run without --filter to see the discovered publishable set.');
      process.exit(2);
    }
    entries = entries.filter((e) => want.has(e.name));
  }

  console.log(`release-precheck — mode: ${opts.mode.toUpperCase()}${opts.skipNpm ? ' (registry skipped)' : ''}`);
  console.log(`scope: ${opts.filters.length ? entries.map((e) => e.name).join(', ') : `all ${entries.length} publishable package(s)`}`);
  console.log('');

  // Repo-wide structural check, once — not per-package (Fix B, quick 260716-npt).
  const changesetCheck = checkChangesetPrivatePackages();
  if (changesetCheck.status === 'FAIL') {
    console.log(`✗ changeset private-package guard: ${changesetCheck.detail}`);
  } else {
    console.log(`ok changeset private-package guard: ${changesetCheck.detail}`);
  }
  console.log('');

  const rows = [];
  for (const entry of entries) {
    const checks = {
      a: await checkVersion(entry, opts),
      b: checkDescription(entry),
      c: checkUrls(entry),
      d: checkFilesExports(entry, opts),
      e: await checkWorkspaceDeps(entry, byName, privateNames, opts),
      f: await checkTarballDrift(entry, opts),
    };
    rows.push({ entry, checks, verdict: verdictOf(checks) });
  }

  // Summary table.
  const nameW = Math.max(20, ...rows.map((r) => r.entry.name.length));
  const verW = Math.max(7, ...rows.map((r) => String(r.entry.version).length));
  console.log(
    `${pad('package', nameW)}  ${pad('version', verW)}  ${pad('npm', 5)}  ${pad('desc', 5)}  ${pad('url', 5)}  ${pad('files', 5)}  ${pad('deps', 5)}  ${pad('tarball', 5)}  verdict`,
  );
  console.log('-'.repeat(nameW + verW + 7 * 7 + 9));
  for (const { entry, checks, verdict } of rows) {
    console.log(
      `${pad(entry.name, nameW)}  ${pad(entry.version, verW)}  ${pad(GLYPH[checks.a.status], 5)}  ${pad(GLYPH[checks.b.status], 5)}  ${pad(GLYPH[checks.c.status], 5)}  ${pad(GLYPH[checks.d.status], 5)}  ${pad(GLYPH[checks.e.status], 5)}  ${pad(GLYPH[checks.f.status], 5)}  ${verdict}`,
    );
  }
  console.log('');

  // Per-package detail for anything not fully OK.
  let anyFail = changesetCheck.status === 'FAIL';
  let anyWarn = false;
  for (const { entry, checks, verdict } of rows) {
    if (verdict === 'OK') continue;
    if (verdict === 'FAIL') anyFail = true;
    if (verdict === 'WARN') anyWarn = true;
    console.log(`${verdict === 'FAIL' ? '✗' : '!'} ${entry.name}`);
    for (const [key, label] of [
      ['a', 'version'],
      ['b', 'description'],
      ['c', 'url/dir'],
      ['d', 'files/exports'],
      ['e', 'workspace-deps'],
      ['f', 'tarball-drift'],
    ]) {
      const c = checks[key];
      if (c.status === 'FAIL' || c.status === 'WARN') {
        console.log(`    [${c.status}] (${label}) ${c.detail}`);
      }
    }
  }

  console.log('');
  if (anyFail) {
    console.log('RESULT: FAIL — fix the items above before publishing.');
    process.exit(1);
  }
  if (anyWarn) {
    console.log('RESULT: PASS (with warnings) — warnings do not block.');
  } else {
    console.log('RESULT: PASS — all checks clean.');
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('release-precheck crashed:', err);
  process.exit(2);
});
