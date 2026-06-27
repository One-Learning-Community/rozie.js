/**
 * compile-headless-core-check.mjs — Phase 64 P0 LOAD-BEARING boundary gate.
 *
 * The single most important empirical proof of the whole phase: a CROSS-PACKAGE
 * bare-specifier `.rzts` script-partial (`@rozie-ui/headless-core/smoke.rzts`)
 * resolves + inlines (via inlineScriptPartials()) + compiles with ZERO errors on
 * ALL SIX targets. No such import exists anywhere else in the repo today (every
 * other `.rzts` import is relative same-package), so this gate de-risks P1–P4.
 *
 * Pure GLUE over the @rozie/core public `compile()` API. UNLIKE the per-family
 * surface gates there is NO component IR here (the partial exports a pure
 * function, not a component) — so we DROP the props/emits/slots/expose EXPECT
 * assertions and assert ONLY:
 *   1. compile()×6 emits ZERO error-severity diagnostics (a failed cross-package
 *      resolve surfaces here as ROZ945 CROSS_PACKAGE_LOOKUP_FAILED).
 *   2. r.code is non-empty on every target.
 *
 * The host source is SYNTHETIC (an in-memory smoke `.rozie` string) whose
 * `<script>` imports the partial via the BARE specifier — so compile() exercises
 * the real cross-package resolution + inline path. `filename` is rooted inside
 * the headless-core package so the package's own `exports` map self-resolves the
 * specifier (enhanced-resolve self-reference); `resolverRoot` matches.
 *
 * THROWS (non-zero exit) on any drift. No compiler/emitter/IR change.
 */
import { resolve } from 'node:path';
import { compile } from '@rozie/core';

const ROOT = resolve(import.meta.dirname, '..');
// A synthetic host path INSIDE the package so the package's own `exports` map
// self-resolves `@rozie-ui/headless-core/smoke.rzts` (this file need not exist).
const FILENAME = resolve(ROOT, 'scripts', '__smoke-host.rozie');

// The BARE specifier — NOT a relative path. This is the whole point of P0.
const BARE_SPECIFIER = '@rozie-ui/headless-core/smoke.rzts';

const source = `<rozie name="HeadlessCoreSmokeHost">
<script lang="ts">
import { headlessCoreSmoke } from '${BARE_SPECIFIER}'
const probe = headlessCoreSmoke(41)
</script>
<template>
  <div data-testid="headless-core-smoke">{{ probe }}</div>
</template>
</rozie>
`;

const fail = (msg) => { console.error(`✗ ${msg}`); process.exitCode = 1; };

// A surviving runtime import to the partial means it did NOT dissolve. Match the
// import STATEMENT form only (`from '@rozie-ui/headless-core…'`) — NOT the raw
// package string, because Vue preserves the partial's leading comment banner
// (which mentions the specifier in prose); React strips comments. The import
// form is the true dissolve signal.
const SURVIVING_IMPORT = /from\s*['"]@rozie-ui\/headless-core/;

const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'];
let okCount = 0;
for (const target of TARGETS) {
  const r = compile(source, { target, filename: FILENAME, resolverRoot: ROOT });
  const errs = r.diagnostics.filter((d) => d.severity === 'error');
  if (errs.length) {
    // A failed cross-package resolve surfaces here (ROZ945
    // CROSS_PACKAGE_LOOKUP_FAILED / ROZ945 resolve failure) — the primary gate.
    fail(`compile(${target}) errors:\n${errs.map((d) => `  ${d.code} ${d.message}`).join('\n')}`);
  } else if (!r.code || !r.code.length) {
    fail(`compile(${target}) produced empty output with no diagnostics`);
  } else if (!r.code.includes('headlessCoreSmoke') || !r.code.includes('n + 1')) {
    // The partial's declaration (`const headlessCoreSmoke = (n) => n + 1`) must
    // be SPLICED into the host body — if resolution silently no-op'd, the symbol
    // + its body would be absent.
    fail(`compile(${target}) code lacks the inlined partial decl — splice did not land`);
  } else if (SURVIVING_IMPORT.test(r.code)) {
    // The partial must DISSOLVE — zero runtime import to headless-core survives.
    fail(`compile(${target}) still carries a runtime import to @rozie-ui/headless-core — partial did NOT dissolve`);
  } else {
    okCount += 1;
  }
}

if (process.exitCode) {
  console.error('\n✗ compile-headless-core-check FAILED — cross-package bare .rzts boundary NOT proven');
} else {
  console.log(`✓ headless-core boundary OK: cross-package bare specifier '${BARE_SPECIFIER}' resolves + inlines + compiles zero-error on ${okCount}/6 targets.`);
}
