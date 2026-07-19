/**
 * compile-lexical-check.mjs — the live compile() surface gate for @rozie-ui/lexical
 * PLUS the family-unique D-05/REQ-37 Svelte-compile acceptance check.
 *
 * GENERIC per-source (run BEFORE any leaf work): it globs EVERY `src/*.rozie`, so
 * later waves add plugin/toolbar/decorator sources without editing this gate. For
 * each source it asserts:
 *   1. lowerToIR() + compile()×6 (react/vue/svelte/angular/solid/lit — Lit
 *      graduated into the shipped family in 76-09 per D-01/D-10) emit ZERO
 *      error-severity diagnostics + non-empty code.
 *   2. THE D-05/REQ-37 ACCEPTANCE CHECK: the emitted Svelte output compiles clean
 *      under the repo's Svelte 5 compiler (`generate: 'client'`) with NO
 *      `dollar_prefix_invalid` (and no other error). This proves every authored
 *      source uses the namespace-import form (`import * as lexical from 'lexical'`)
 *      — the one convention that survives the Svelte `$`-prefix reservation
 *      (spike 013). A named `$`-import would hard-fail here.
 *
 * Pure GLUE over the @rozie/core public API + the Svelte compiler. NO
 * compiler/emitter/IR change. THROWS (non-zero exit) on any drift.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { compile as svelteCompile } from 'svelte/compiler';

const ROOT = resolve(import.meta.dirname, '..');
const SRC_DIR = resolve(ROOT, 'src');
// 6 targets — Lit graduated from v1.1 staging into the shipped family in 76-09 (D-10).
const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'];

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
};

function discoverSources() {
  if (!existsSync(SRC_DIR)) return [];
  return readdirSync(SRC_DIR)
    .filter((f) => f.endsWith('.rozie'))
    .sort();
}

const sources = discoverSources();
if (sources.length === 0) {
  console.error('✗ compile-lexical-check: no src/*.rozie sources found');
  process.exit(1);
}

for (const filename of sources) {
  const name = filename.slice(0, -'.rozie'.length);
  const source = readFileSync(resolve(SRC_DIR, filename), 'utf8');

  // 1a. lower once — zero error diagnostics.
  const { ast } = parse(source, { filename });
  const { diagnostics: lowerDiags = [] } = lowerToIR(ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  const lowerErrs = lowerDiags.filter((d) => d.severity === 'error');
  if (lowerErrs.length) {
    fail(`lowerToIR(${name}) errors:\n${lowerErrs.map((d) => `    ${d.code} ${d.message}`).join('\n')}`);
  }

  // 1b. compile()×5 — zero error diagnostics + non-empty code. Capture the Svelte
  // emit for the D-05 acceptance check.
  let svelteCode = null;
  for (const target of TARGETS) {
    const r = compile(source, { target, filename });
    const errs = r.diagnostics.filter((d) => d.severity === 'error');
    if (errs.length) {
      fail(`compile(${target}, ${name}) errors:\n${errs.map((d) => `    ${d.code} ${d.message}`).join('\n')}`);
    } else if (!r.code || !r.code.length) {
      fail(`compile(${target}, ${name}) produced empty output with no diagnostics`);
    }
    if (target === 'svelte') svelteCode = r.code;
  }

  // 2. D-05/REQ-37 acceptance — the emitted Svelte compiles clean, no
  // dollar_prefix_invalid. In Svelte 5 an invalid `$` prefix is a compile ERROR
  // (thrown); any residual dollar_prefix warning is also caught.
  if (svelteCode) {
    try {
      const result = svelteCompile(svelteCode, { generate: 'client', filename: `${name}.svelte` });
      const dp = (result.warnings ?? []).filter((w) => String(w.code ?? '').includes('dollar_prefix'));
      if (dp.length) {
        fail(`svelte(${name}) reported dollar_prefix warning(s): ${dp.map((w) => w.code).join(', ')}`);
      }
    } catch (e) {
      const code = e && e.code ? e.code : '(no code)';
      const msg = e && e.message ? String(e.message).split('\n')[0] : String(e);
      fail(`svelte(${name}) compile error: ${code} — ${msg}`);
    }
  }
}

if (process.exitCode) {
  console.error('\n✗ compile-lexical-check FAILED');
} else {
  console.log(
    `✓ lexical surface OK: ${sources.length} source(s) — compile()×${TARGETS.length} zero-error + emitted Svelte compiles clean (no dollar_prefix_invalid).`,
  );
}
