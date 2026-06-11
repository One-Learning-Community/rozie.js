/*
 * Phase 41 Wave-0 De-Risk Probe — driver.
 *
 * Proves the SINGLE load-bearing unknown of the FlowCanvas redesign: that a
 * two-way `r-model:graph` DEEP-object write-back (a FRESH {nodes,connections}
 * object emitted via $model.graph) round-trips to the bound consumer and is
 * echo-safe on ALL 6 targets — compiled with NO packages/targets/* or
 * packages/core/* change.
 *
 * Steps (per 41-RESEARCH § Wave-0 De-Risk Probe):
 *   2. compile Probe + ProbeConsumer to all 6 → ZERO error diagnostics (gate).
 *   3. mount each compiled ProbeConsumer leaf; assert readout-len === '1' after
 *      the fresh-object write-back (THE make-or-break assertion).
 *   4. echo-safety: the probe's $watch fired a BOUNDED number of times.
 *   5. drag-frequency stress: 60 fresh-object write-backs converge to 60.
 *   6. validation feasibility: a connectioncreate-style typed predicate resolves
 *      a port type from a stubbed registry and rejects a mismatch — on all 6.
 *
 * Runs FROM tests/visual-regression/ (cwd) so the framework plugins + chromium
 * resolve. Engine-less + throwaway — isolated under scripts/probe-41/.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const RETE_ROOT = resolve(HERE, '..', '..'); // packages/ui/rete
const REPO_ROOT = resolve(RETE_ROOT, '..', '..', '..');
const VR_DIR = resolve(REPO_ROOT, 'tests', 'visual-regression');

// @playwright/test lives only in the VR package — resolve it from there.
const requireFromVr = createRequire(resolve(VR_DIR, 'noop.js'));
const pwModule = await import(pathToFileURL(requireFromVr.resolve('@playwright/test')).href);
const chromium = pwModule.chromium ?? pwModule.default.chromium;
const CONFIG = resolve(HERE, 'vite.probe.config.ts');
// Vite writes its compiled `.vite-temp` config beside the config file; that dir
// must be able to resolve `vite`. The probe config lives in packages/ui/rete
// (no vite there), so the driver copies it into VR_DIR for the build and points
// it back at the probe tree via PROBE41_DIR.
const CONFIG_IN_VR = resolve(VR_DIR, '.probe41.vite.config.ts');
// Per-target input HTML lives INSIDE the VR root so Vite's native resolver +
// framework plugins handle module resolution exactly as the real VR host.
const INPUT_DIR = resolve(VR_DIR, '.probe41-host');
const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'];

const log = (...a) => console.log(...a);
const results = {}; // target -> { compile, readout, watchFires, stress, validate }

// ─── STEP 2: compile gate (no-emitter-change hypothesis) ─────────────────────
function compileGate() {
  log('\n=== STEP 2: compile all 6 × 2 components (no-emitter-change gate) ===');
  const comps = { Probe: 'Probe.rozie', ProbeConsumer: 'ProbeConsumer.rozie' };
  let allClean = true;
  for (const t of TARGETS) {
    let clean = true;
    for (const [name, f] of Object.entries(comps)) {
      const abs = resolve(HERE, f);
      const r = compile(readFileSync(abs, 'utf8'), { target: t, filename: abs, resolverRoot: HERE });
      const errs = (r.diagnostics || []).filter((d) => d.severity === 'error');
      if (errs.length) {
        clean = false;
        allClean = false;
        log(`  ${t}/${name}: ${errs.length} ERROR diagnostics`);
        errs.forEach((e) => log(`     ${e.code}: ${e.message}`));
      }
    }
    results[t] = { compile: clean };
    log(`  ${t.padEnd(8)} compile: ${clean ? 'PASS (0 errors)' : 'FAIL'}`);
  }
  return allClean;
}

// ─── STEP 6: validation feasibility micro-check (pure, compile-level) ─────────
// Confirm the Phase-40 connectioncreate-cancel pipe shape can resolve a port
// type from a stubbed per-type registry and reject a mismatch — and that the
// predicate compiles on all 6 (it is the same pure synchronous shape Phase 40
// proved). We exercise the runtime predicate directly here + compile a probe of
// the predicate-bearing source on all 6.
function validationFeasibility() {
  log('\n=== STEP 6: typed-validation feasibility (stubbed registry) ===');
  // Stubbed per-TYPE port registry, keyed type::side::key (41-RESEARCH Pattern 2).
  const portReg = {
    'source::output::num': { portType: 'number' },
    'source::output::str': { portType: 'string' },
    'merge::input::num': { portType: 'number' },
    'merge::input::str': { portType: 'string' },
  };
  const nodes = { a: { type: 'source' }, b: { type: 'merge' } };
  const portTypeOf = (nodeId, side, key) => {
    const n = nodes[nodeId];
    if (!n) return null;
    const e = portReg[`${n.type}::${side}::${key}`];
    return e ? e.portType : null;
  };
  // connectioncreate predicate (generalization of FlowCanvas.rozie:645-667).
  const allow = (c) => {
    const src = portTypeOf(c.source, 'output', c.sourceOutput);
    const tgt = portTypeOf(c.target, 'input', c.targetInput);
    if (src != null && tgt != null && src !== tgt) return false;
    return true;
  };
  const matchOk = allow({ source: 'a', sourceOutput: 'num', target: 'b', targetInput: 'num' });
  const mismatchRejected = !allow({ source: 'a', sourceOutput: 'num', target: 'b', targetInput: 'str' });
  const runtimeOk = matchOk && mismatchRejected;
  log(`  runtime predicate: number→number accepted=${matchOk}, number→string rejected=${mismatchRejected}`);

  // Cross-target: the predicate runs in a pure $watch-style closure. Compile a
  // tiny source carrying that exact shape on all 6 → zero errors == feasible.
  const VALIDATE_SRC = `<rozie name="ValidateProbe">
<props>{ canConnect: { type: Function, default: null } }</props>
<data>{ portReg: { 'source::output::num': { portType: 'number' } }, lastReject: null }</data>
<script lang="ts">
const portTypeOf = (type, side, key) => {
  const e = $data.portReg[type + '::' + side + '::' + key]
  return e ? e.portType : null
}
const allow = (c) => {
  const src = portTypeOf(c.srcType, 'output', c.sourceOutput)
  const tgt = portTypeOf(c.tgtType, 'input', c.targetInput)
  if (src != null && tgt != null && src !== tgt) { $data.lastReject = c; return false }
  if (typeof $props.canConnect === 'function' && $props.canConnect(c) === false) return false
  return true
}
$onMount(() => { allow({ srcType: 'source', sourceOutput: 'num', tgtType: 'merge', targetInput: 'num' }) })
</script>
<template><span data-testid="vp">{{ $data.lastReject ? 'reject' : 'ok' }}</span></template>
</rozie>`;
  let compileOk = true;
  for (const t of TARGETS) {
    const r = compile(VALIDATE_SRC, { target: t, filename: 'ValidateProbe.rozie' });
    const errs = (r.diagnostics || []).filter((d) => d.severity === 'error');
    const ok = errs.length === 0;
    if (!ok) {
      compileOk = false;
      log(`  ${t}/ValidateProbe: ${errs.length} ERRORS`);
      errs.forEach((e) => log(`     ${e.code}: ${e.message}`));
    }
    results[t] = { ...(results[t] || {}), validate: ok && runtimeOk };
  }
  log(`  validation-feasibility: predicate compiles 6/6=${compileOk}, runtime reject works=${runtimeOk}`);
  return compileOk && runtimeOk;
}

// ─── per-target vite build ───────────────────────────────────────────────────
const TSCONFIG_APP = resolve(VR_DIR, 'tsconfig.app.json');

// Angular AOT: analog resolves the sibling tsconfig.app.json; its `include` must
// cover the probe's emitted .rozie.ts disk-cache + the copied host entry so the
// NgtscProgram gives them full AOT treatment (ɵcmp) — otherwise the runtime
// falls back to JIT ("JIT compiler unavailable"). Patch include temporarily.
function patchAngularTsconfig() {
  const orig = readFileSync(TSCONFIG_APP, 'utf8');
  const cfg = JSON.parse(orig);
  const extra = [
    '.probe41-host/**/*.ts',
    '../../packages/ui/rete/scripts/probe-41/**/*.rozie.ts',
  ];
  cfg.include = Array.from(new Set([...(cfg.include || []), ...extra]));
  writeFileSync(TSCONFIG_APP, JSON.stringify(cfg, null, 2));
  return orig;
}

function buildTarget(target) {
  rmSync(resolve(HERE, 'dist', target), { recursive: true, force: true });
  writeFileSync(CONFIG_IN_VR, readFileSync(CONFIG, 'utf8'));
  const tsconfigOrig = target === 'angular' ? patchAngularTsconfig() : null;
  // Copy the host files INTO the VR root (.probe41-host/) so Vite's native
  // resolver + each framework plugin apply (bare imports like solid-js/web,
  // zone.js, svelte/internal resolve against VR's node_modules; the framework
  // transform only runs on files under root). Rewrite the relative .rozie import
  // to the ABSOLUTE probe path so the @rozie/unplugin loader still finds it.
  mkdirSync(INPUT_DIR, { recursive: true });
  writeFileSync(resolve(INPUT_DIR, 'mount-common.ts'), readFileSync(resolve(HERE, 'host', 'mount-common.ts'), 'utf8'));
  const probeConsumerAbs = resolve(HERE, 'ProbeConsumer.rozie');
  const entrySrc = readFileSync(resolve(HERE, 'host', `entry.${target}.ts`), 'utf8').replace(
    /['"]\.\.\/ProbeConsumer\.rozie['"]/g,
    JSON.stringify(probeConsumerAbs),
  );
  const entryInVr = resolve(INPUT_DIR, `entry.${target}.ts`);
  writeFileSync(entryInVr, entrySrc);
  const inputHtml = resolve(INPUT_DIR, `${target}.html`);
  writeFileSync(
    inputHtml,
    `<!doctype html><html><head><meta charset="UTF-8"><title>probe-${target}</title></head><body><script type="module" src="${entryInVr}"></script></body></html>`,
  );
  const res = spawnSync(
    'pnpm',
    ['exec', 'vite', 'build', '--config', CONFIG_IN_VR],
    {
      cwd: VR_DIR,
      env: {
        ...process.env,
        ROZIE_TARGET: target,
        PROBE41_DIR: HERE,
        PROBE41_DEPS_DIR: VR_DIR,
        PROBE41_INPUT_HTML: inputHtml,
      },
      encoding: 'utf8',
    },
  );
  // Angular's AOT prebuild drops cross-tree .rozie.ts disk-cache artifacts beside
  // the probe sources; sweep them so they don't poison the next target's build or
  // leak into git status (the VR build-cells cleanup analog). Restore tsconfig.
  if (target === 'angular') {
    if (tsconfigOrig != null) writeFileSync(TSCONFIG_APP, tsconfigOrig);
    for (const n of ['Probe', 'ProbeConsumer']) {
      rmSync(resolve(HERE, `${n}.rozie.ts`), { force: true });
      rmSync(resolve(HERE, `${n}.ts`), { force: true });
    }
  }
  const builtHtml = resolve(HERE, 'dist', target, '.probe41-host', `${target}.html`);
  const ok = res.status === 0 && existsSync(builtHtml);
  if (!ok) {
    log(`  [${target}] BUILD FAILED (status ${res.status})`);
    if (res.stdout) log(res.stdout.split('\n').slice(-25).join('\n'));
    if (res.stderr) log(res.stderr.split('\n').slice(-25).join('\n'));
  }
  return ok;
}

// ─── static file server for a built dist/<target> ───────────────────────────
import { extname, join, normalize } from 'node:path';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.map': 'application/json', '.svg': 'image/svg+xml' };
function serve(rootDir, port) {
  const server = createServer((req, res) => {
    try {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      let fp = normalize(join(rootDir, p));
      if (!fp.startsWith(rootDir)) { res.writeHead(403); return res.end(); }
      if (existsSync(fp) && readFileSync(fp) && !extname(fp)) fp = join(fp, 'index.html');
      if (!existsSync(fp)) { res.writeHead(404); return res.end('not found'); }
      const body = readFileSync(fp);
      res.writeHead(200, { 'Content-Type': MIME[extname(fp)] || 'application/octet-stream' });
      res.end(body);
    } catch (e) {
      res.writeHead(500); res.end(String(e));
    }
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}

// ─── STEP 3/4/5: mount + behavioral asserts ─────────────────────────────────
async function mountAndAssert(target, browser, port) {
  // Built assets reference the base path `/${target}/...`, so serve the parent
  // dist/ dir and request `/${target}/host/entry.${target}.html`.
  const distRoot = resolve(HERE, 'dist');
  const server = await serve(distRoot, port);
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const out = { readout: false, watchFires: null, stress: false, readoutVal: null, stressVal: null };
  try {
    await page.goto(`http://localhost:${port}/${target}/.probe41-host/${target}.html`, { waitUntil: 'load' });
    // STEP 3: after the probe's 50ms fresh-object write-back, readout-len === '1'.
    const readEl = page.locator('[data-testid="readout-len"]');
    await readEl.waitFor({ state: 'attached', timeout: 8000 });
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="readout-len"]') ||
          document.querySelector('rozie-probe-consumer')?.shadowRoot?.querySelector('[data-testid="readout-len"]');
        return el && el.textContent && el.textContent.trim() === '1';
      },
      { timeout: 8000 },
    ).catch(() => {});
    out.readoutVal = (await readEl.textContent().catch(() => null))?.trim() ?? null;
    out.readout = out.readoutVal === '1';
    // STEP 4: echo-safety — bounded watch fires (a small constant, here exactly 1
    // for one write-back; allow up to 3 as the bounded ceiling).
    const wf = (await page.locator('[data-testid="probe-watch-fires"]').textContent().catch(() => null))?.trim();
    out.watchFires = wf == null ? null : Number(wf);
    // STEP 5: drag-frequency stress — 60 successive fresh-object write-backs must
    // CONVERGE to a stable final value (no dropped/stale/batched-away updates).
    // The final length is ≥60 (all 60 stress writes land); whether it is exactly
    // 61 depends on whether the stress closure captured $data.g before or after
    // the probe's own 50ms write-back — both 60 and 61 prove convergence (the
    // Pitfall-2 property: every fresh-object emit lands, none are coalesced away).
    await page.evaluate(() => window.__probe?.stress?.());
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="readout-len"]') ||
          document.querySelector('rozie-probe-consumer')?.shadowRoot?.querySelector('[data-testid="readout-len"]');
        const n = el && el.textContent ? Number(el.textContent.trim()) : NaN;
        return n >= 60;
      },
      { timeout: 8000 },
    ).catch(() => {});
    out.stressVal = (await readEl.textContent().catch(() => null))?.trim() ?? null;
    out.stress = out.stressVal != null && Number(out.stressVal) >= 60;
  } catch (e) {
    errors.push(String(e));
  } finally {
    await page.close();
    server.close();
  }
  if (errors.length) log(`  [${target}] page errors: ${errors.slice(0, 4).join(' | ')}`);
  return out;
}

async function main() {
  const gateOk = compileGate();
  if (!gateOk) {
    log('\n*** STEP 2 GATE FAILED — an emitter change would be needed. SCOPE-FENCE BLOCKER. ***');
    process.exit(2);
  }
  validationFeasibility();

  log('\n=== STEP 3/4/5: per-target build + mount + behavioral asserts ===');
  const browser = await chromium.launch();
  let port = 4191;
  for (const t of TARGETS) {
    log(`\n--- ${t} ---`);
    const built = buildTarget(t);
    if (!built) {
      results[t] = { ...(results[t] || {}), readout: false, stress: false, buildFailed: true };
      continue;
    }
    const r = await mountAndAssert(t, browser, port++);
    results[t] = { ...(results[t] || {}), ...r };
    log(`  readout-len after write-back = ${r.readoutVal} (expect 1) → ${r.readout ? 'PASS' : 'FAIL'}`);
    log(`  watchFires = ${r.watchFires} (bounded ≤3) → ${r.watchFires != null && r.watchFires >= 1 && r.watchFires <= 3 ? 'PASS' : 'FAIL'}`);
    log(`  stress readout = ${r.stressVal} (converge ≥60) → ${r.stress ? 'PASS' : 'FAIL'}`);
  }
  await browser.close();
  rmSync(CONFIG_IN_VR, { force: true });
  rmSync(INPUT_DIR, { recursive: true, force: true });

  // ─── summary table ─────────────────────────────────────────────────────────
  log('\n=== PER-TARGET PROBE RESULTS ===');
  log('target   | compile | readout=1 | watchFires(≤3) | stress=61 | validate');
  log('---------|---------|-----------|----------------|-----------|---------');
  let allPass = true;
  for (const t of TARGETS) {
    const r = results[t] || {};
    const wfOk = r.watchFires != null && r.watchFires >= 1 && r.watchFires <= 3;
    const pass = r.compile && r.readout && wfOk && r.stress && r.validate;
    if (!pass) allPass = false;
    log(
      `${t.padEnd(8)} | ${(r.compile ? 'PASS' : 'FAIL').padEnd(7)} | ${(r.readout ? 'PASS' : 'FAIL').padEnd(9)} | ${String(r.watchFires).padEnd(3)}${(wfOk ? 'PASS' : 'FAIL').padEnd(11)} | ${(r.stress ? 'PASS' : 'FAIL').padEnd(9)} | ${r.validate ? 'PASS' : 'FAIL'}`,
    );
  }
  log(`\n${allPass ? '>>> ALL 6 GREEN — no-emitter-change hypothesis HOLDS, deep write-back proven.' : '>>> NOT ALL GREEN — see failures above (potential BLOCKER / scope decision).'}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(3); });
