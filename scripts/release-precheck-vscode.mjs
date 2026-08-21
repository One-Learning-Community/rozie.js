#!/usr/bin/env node
// release-precheck-vscode — mechanical pre-publish guard for the Rozie VS Code
// extension (`tools/textmate`).
//
// WHY THIS IS A SEPARATE SCRIPT FROM release-precheck.mjs
//
// The npm precheck discovers packages by expanding `pnpm-workspace.yaml` globs.
// `tools/textmate` is deliberately OUTSIDE the pnpm workspace — it carries its
// own lockfile so `vsce`/`esbuild` never enter the monorepo's dependency graph
// — so the npm script cannot see it, and changesets cannot version it either.
// Rather than restructure the workspace, this mirrors the SAME check letters
// (a)-(f) from RELEASING.md against the VS Code Marketplace instead of npm.
//
// Deliberate divergences from the npm path, all structural:
//   (e) has no workspace-dep analogue. The shared failure is "the published
//       artifact cannot resolve a dependency at load time", so here it asserts
//       every declared runtime dep is actually INLINED into dist/extension.js.
//       Declaring a dep is fine if bundled — `vscode-languageclient` is.
//   (f) is not tarball drift but SERVER-BUNDLE drift: `server/server-standalone.cjs`
//       inlines @rozie/core at build time, so a stale bundle means the shipped
//       editor understands fewer diagnostics than the compiler emits.
//
// Modes and exit codes match release-precheck.mjs so both feel like one tool.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT_DIR = path.join(REPO_ROOT, 'tools', 'textmate');
const PKG_PATH = path.join(EXT_DIR, 'package.json');
const CORE_CODES = path.join(REPO_ROOT, 'packages/core/src/diagnostics/codes.ts');
const SERVER_BUNDLE = path.join(EXT_DIR, 'server', 'server-standalone.cjs');
const ORG_SUBSTR = 'One-Learning-Community/rozie.js';
const STALE_DESC_RE = /TODO|PLACEHOLDER|FIXME|describe your package|scaffold/i;
const GALLERY = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery';
const GALLERY_TIMEOUT_MS = 8000;

const GLYPH = { OK: 'ok', FAIL: 'FAIL', WARN: 'warn', SKIP: '-' };
const ok = (detail = '') => ({ status: 'OK', detail });
const fail = (detail) => ({ status: 'FAIL', detail });
const warn = (detail) => ({ status: 'WARN', detail });
const skip = (detail) => ({ status: 'SKIP', detail });

function parseArgs(argv) {
  const opts = { mode: 'audit', skipRemote: false, help: false };
  for (const a of argv) {
    if (a === '--gate' || a === '--pre-publish') opts.mode = 'gate';
    else if (a === '--skip-marketplace' || a === '--offline') opts.skipRemote = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else {
      console.error(`Unknown flag: ${a} (try --help)`);
      process.exit(2);
    }
  }
  return opts;
}

function printHelp() {
  console.log(`release-precheck-vscode — pre-publish guard for the Rozie VS Code extension

Usage: node scripts/release-precheck-vscode.mjs [options]

Modes:
  (default)              AUDIT — report; already-published == OK (steady state).
  --gate, --pre-publish  Already-published becomes a HARD FAIL (forgot-to-bump);
                         marketplace-unreachable becomes a FAIL. Run this
                         LOCALLY, post-build + pre-dispatch.
  --skip-marketplace, --offline
                         Skip the gallery query (only b/c/d/e/f run). This is
                         the mode the CI advisory step uses.
  --help, -h             This help.

Checks: (a) version vs Marketplace   (b) description quality
        (c) url/dir accuracy         (d) contributed files resolve on disk
        (e) runtime deps are bundled (f) staged server bundle vs @rozie/core

Build first — checks (d) and (f) read dist/ and server/, which are gitignored
build outputs. From the extension root: pnpm bundle:server && pnpm build`);
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// --- (a) version vs Marketplace -------------------------------------------
async function publishedVersion(id) {
  const body = JSON.stringify({
    filters: [{ criteria: [{ filterType: 7, value: id }] }],
    flags: 914,
  });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), GALLERY_TIMEOUT_MS);
  try {
    const res = await fetch(GALLERY, {
      method: 'POST',
      headers: {
        Accept: 'application/json;api-version=3.0-preview.1',
        'Content-Type': 'application/json',
      },
      body,
      signal: ctl.signal,
    });
    if (!res.ok) return { reachable: false, detail: `gallery HTTP ${res.status}` };
    const json = await res.json();
    const ext = json?.results?.[0]?.extensions?.[0];
    return { reachable: true, version: ext?.versions?.[0]?.version ?? null };
  } catch (err) {
    return { reachable: false, detail: err.name === 'AbortError' ? 'timeout' : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

async function checkVersion(pkg, opts) {
  const id = `${pkg.publisher}.${pkg.name}`;
  if (opts.skipRemote) return skip('marketplace query skipped');
  const res = await publishedVersion(id);
  if (!res.reachable) {
    return opts.mode === 'gate'
      ? fail(
          `marketplace unreachable (${res.detail}) — cannot confirm ${pkg.version} is unpublished`,
        )
      : warn(`marketplace unreachable (${res.detail})`);
  }
  if (res.version === null) return ok(`${id} not yet on the Marketplace (first publish)`);
  if (res.version === pkg.version) {
    const msg = `${id}@${pkg.version} is ALREADY on the Marketplace — vsce will reject the republish; bump first`;
    return opts.mode === 'gate' ? fail(msg) : ok(`already published at ${res.version}`);
  }
  return ok(`marketplace at ${res.version}, local ${pkg.version}`);
}

// --- (b) description -------------------------------------------------------
function checkDescription(pkg) {
  const d = (pkg.description ?? '').trim();
  if (!d) return fail('missing description');
  if (d.length < 20) return fail(`description too short (${d.length} chars)`);
  if (STALE_DESC_RE.test(d)) return fail('description looks like unedited scaffold text');
  return ok();
}

// --- (c) urls + repository.directory --------------------------------------
function checkUrls(pkg) {
  const problems = [];
  const repoUrl = pkg.repository?.url ?? '';
  if (!repoUrl.includes(ORG_SUBSTR))
    problems.push(`repository.url does not point at ${ORG_SUBSTR}`);
  if (!(pkg.homepage ?? '').includes(ORG_SUBSTR))
    problems.push('homepage does not point at the repo');
  if (!(pkg.bugs?.url ?? '').includes(ORG_SUBSTR))
    problems.push('bugs.url does not point at the repo');
  if (pkg.repository?.directory !== 'tools/textmate') {
    problems.push(
      `repository.directory is ${JSON.stringify(pkg.repository?.directory)}, expected "tools/textmate"`,
    );
  }
  if (!pkg.publisher) problems.push('missing publisher (vsce cannot publish without it)');
  if (!pkg.license) problems.push('missing license');
  return problems.length ? fail(problems.join('; ')) : ok();
}

// --- (d) every contributed path resolves on disk ---------------------------
function checkFiles(pkg) {
  const missing = [];
  const need = (rel, label) => {
    if (!rel) return;
    if (!existsSync(path.join(EXT_DIR, rel))) missing.push(`${label}: ${rel}`);
  };
  need(pkg.main, 'main');
  need(pkg.icon, 'icon');
  for (const g of pkg.contributes?.grammars ?? []) need(g.path, 'grammar');
  for (const l of pkg.contributes?.languages ?? []) need(l.configuration, 'language-configuration');
  // The bundled server is what makes this a language extension rather than a
  // bare grammar; shipping without it silently degrades to highlighting only.
  if (!existsSync(SERVER_BUNDLE))
    missing.push('server/server-standalone.cjs (run `pnpm bundle:server`)');
  for (const f of ['README.md', 'CHANGELOG.md', 'LICENSE']) {
    if (!existsSync(path.join(EXT_DIR, f))) missing.push(`marketplace page file: ${f}`);
  }
  return missing.length ? fail(`unresolved: ${missing.join(', ')}`) : ok();
}

// --- (e) every declared runtime dep is actually bundled --------------------
//
// The npm path checks "workspace deps already on npm". The analogue here is
// narrower but the same failure in spirit — a dependency the published artifact
// cannot resolve at load time. `vsce publish --no-dependencies` ships NO
// node_modules, so a runtime dep is fine if and only if esbuild inlined it
// (build.mjs runs `bundle: true` with `external: ['vscode']`). Declaring a dep
// is therefore harmless on its own; what breaks users is a dep that survives
// bundling as a bare `require(...)` with nothing on disk to resolve it.
function checkDeps(pkg) {
  const deps = Object.keys(pkg.dependencies ?? {});
  if (deps.length === 0) return ok('no runtime deps declared');
  const main = path.join(EXT_DIR, pkg.main ?? '');
  if (!pkg.main || !existsSync(main)) {
    return fail(`cannot verify bundling of ${deps.join(', ')} — ${pkg.main ?? 'main'} not built`);
  }
  const bundleSrc = readFileSync(main, 'utf8');
  const external = deps.filter((d) => {
    const esc = d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`require\\(\\s*["']${esc}["']\\s*\\)|from\\s*["']${esc}["']`).test(bundleSrc);
  });
  if (external.length === 0) {
    return ok(`${deps.length} dep(s) inlined into ${pkg.main} (publishes --no-dependencies)`);
  }
  return fail(
    `runtime dep(s) NOT bundled and left as bare imports in ${pkg.main}: ${external.join(', ')} — ` +
      '`--no-dependencies` ships no node_modules, so the extension will fail to activate. ' +
      'Remove them from build.mjs `external`, or ship them.',
  );
}

// --- (f) staged server bundle vs @rozie/core -------------------------------
function coreCodes() {
  const src = readFileSync(CORE_CODES, 'utf8');
  const out = new Set();
  for (const m of src.matchAll(/^\s*[A-Z0-9_]+:\s*'(ROZ\d{3})'/gm)) out.add(m[1]);
  return out;
}

function checkServerDrift() {
  if (!existsSync(SERVER_BUNDLE)) return fail('server bundle absent — run `pnpm bundle:server`');
  const bundled = new Set(
    [...readFileSync(SERVER_BUNDLE, 'utf8').matchAll(/ROZ\d{3}/g)].map((m) => m[0]),
  );
  const core = coreCodes();
  const missing = [...core].filter((c) => !bundled.has(c)).sort();
  if (missing.length === 0)
    return ok(`${bundled.size} codes staged, covers all ${core.size} core codes`);
  return fail(
    `staged server is STALE — missing ${missing.length} diagnostic code(s) core can emit ` +
      `(${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ', …' : ''}); re-run \`pnpm bundle:server\``,
  );
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) return printHelp();

  const pkg = readJson(PKG_PATH);
  const id = `${pkg.publisher}.${pkg.name}`;

  const checks = {
    a: await checkVersion(pkg, opts),
    b: checkDescription(pkg),
    c: checkUrls(pkg),
    d: checkFiles(pkg),
    e: checkDeps(pkg),
    f: checkServerDrift(),
  };

  const values = Object.values(checks);
  const verdict = values.some((c) => c.status === 'FAIL')
    ? 'FAIL'
    : values.some((c) => c.status === 'WARN')
      ? 'WARN'
      : 'OK';

  const labels = {
    a: 'version',
    b: 'description',
    c: 'url/dir',
    d: 'files',
    e: 'deps',
    f: 'server-drift',
  };

  console.log('');
  console.log(`release-precheck-vscode — ${id}@${pkg.version}  (mode: ${opts.mode})`);
  console.log('-'.repeat(72));
  for (const [key, label] of Object.entries(labels)) {
    const c = checks[key];
    console.log(`  (${key}) ${label.padEnd(13)} ${GLYPH[c.status].padEnd(5)} ${c.detail}`);
  }
  console.log('');

  if (verdict === 'FAIL') {
    console.log('RESULT: FAIL — fix the items above before publishing.');
    process.exit(1);
  }
  if (verdict === 'WARN') {
    console.log('RESULT: PASS (with warnings) — warnings do not block.');
  } else {
    console.log('RESULT: PASS — all checks clean.');
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('release-precheck-vscode crashed:', err);
  process.exit(2);
});
