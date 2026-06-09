/**
 * probe-37-00.mjs — Wave-0 de-risk compile-probe (Phase 37 A1/A2).
 *
 * TEMPORARY Wave-0 SCOPE-FENCE probe. The shipped codegen.mjs is single-source
 * (compiles only MapLibre.rozie); Wave 1 (Plan 02) generalizes it to loop over
 * the sibling child sources. Until then, this probe applies the SAME
 * error-diagnostic SCOPE FENCE to the NEW child sources across all 6 targets so
 * Wave 0 can confirm A1 (provider-that-also-consumes) + A2 (renderless child)
 * compile clean BEFORE the bulk replication.
 *
 * Exit 0 = all listed sources compiled clean on all 6 targets (no
 * error-severity diagnostic). A throw = the A1/A2 compiler-gap surface — do NOT
 * edit any emitter; escalate.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile } from '@rozie/core';

const ROOT = resolve(import.meta.dirname, '..'); // packages/ui/maplibre
const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'];
const SOURCES = process.argv.slice(2);

if (SOURCES.length === 0) {
  console.error('usage: node scripts/probe-37-00.mjs <Source.rozie> [Layer.rozie ...]');
  process.exit(2);
}

for (const name of SOURCES) {
  const path = resolve(ROOT, 'src', name);
  const source = readFileSync(path, 'utf8');
  for (const target of TARGETS) {
    const r = compile(source, { target, filename: name });
    const errs = r.diagnostics.filter((d) => d.severity === 'error');
    if (errs.length) {
      throw new Error(
        `probe ${name} [${target}]: compile emitted error diagnostics (SCOPE FENCE — do NOT edit any emitter; escalate the gap):\n` +
          errs.map((e) => `  ${e.code}: ${e.message}`).join('\n'),
      );
    }
    console.log(`probe: ${name.padEnd(16)} ${target.padEnd(8)} ✓`);
  }
}
console.log(`probe: done — ${SOURCES.length} source(s) × ${TARGETS.length} targets compiled clean.`);
