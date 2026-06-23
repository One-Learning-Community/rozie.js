/**
 * compile-toast-check.mjs — the live compile() collision/surface gate for the
 * Toaster family (run BEFORE any leaf work, the slider/captcha/otp discipline).
 *
 * Pure GLUE over the @rozie/core public API. Asserts:
 *   1. lowerToIR() + compile()×6 emit ZERO error-severity diagnostics
 *      (ROZ127 slot==prop, ROZ121 expose-verb==event, ROZ524 React model-setter,
 *      Lit reserved-lifecycle — all surface here as compile() errors). Toaster's
 *      surface is collision-free: zero emits (no ROZ121), zero models (no ROZ524),
 *      and `show`/`dismiss`/`clear` are not inherited host-element members (no
 *      ROZ137), so compile()×6 is fully clean — zero error AND zero warning.
 *   2. The IR surface matches the contract exactly (incl. the zero-emits fact).
 * THROWS (non-zero exit) on any drift. No compiler/emitter/IR change.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = resolve(ROOT, 'src/Toaster.rozie');
const FILENAME = 'Toaster.rozie';
const source = readFileSync(SRC, 'utf8');

const EXPECT = {
  name: 'Toaster',
  props: ['position', 'duration', 'max', 'disablePauseOnHover', 'ariaLabel'],
  models: [],
  emits: [],
  slots: ['toast'],
  expose: ['show', 'dismiss', 'clear'],
};

const fail = (msg) => { console.error(`✗ ${msg}`); process.exitCode = 1; };
const setEq = (a, b) => a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

// ── 1. lower + surface assertions ──────────────────────────────────────────
const { ast } = parse(source, { filename: FILENAME });
const { ir, diagnostics: lowerDiags = [] } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
const lowerErrs = lowerDiags.filter((d) => d.severity === 'error');
if (lowerErrs.length) fail(`lowerToIR errors:\n${lowerErrs.map((d) => `  ${d.code} ${d.message}`).join('\n')}`);

if (ir.name !== EXPECT.name) fail(`name: got ${ir.name}, want ${EXPECT.name}`);

const propNames = ir.props.map((p) => p.name);
if (!setEq(propNames, EXPECT.props)) fail(`props mismatch:\n  got:  ${propNames.sort().join(', ')}\n  want: ${[...EXPECT.props].sort().join(', ')}`);

const modelNames = ir.props.filter((p) => p.isModel).map((p) => p.name);
if (!setEq(modelNames, EXPECT.models)) fail(`model:true props: got [${modelNames.sort()}], want [${[...EXPECT.models].sort()}]`);

if (!setEq(ir.emits, EXPECT.emits)) fail(`emits mismatch:\n  got:  ${[...ir.emits].sort().join(', ')}\n  want: ${[...EXPECT.emits].sort().join(', ')}`);
if (ir.emits.length !== 0) fail(`Toaster must emit NOTHING (the imperative handle replaces events); got [${[...ir.emits].join(', ')}]`);

const slotNames = ir.slots.map((s) => s.name);
if (!setEq(slotNames, EXPECT.slots)) fail(`slots mismatch: got [${slotNames.sort()}], want [${[...EXPECT.slots].sort()}]`);

const exposeNames = ir.expose.map((e) => e.name);
if (!setEq(exposeNames, EXPECT.expose)) fail(`expose mismatch: got [${exposeNames.sort()}], want [${[...EXPECT.expose].sort()}]`);

// event⇄verb (ROZ121) + model-setter (ROZ524) collision guard asserted directly.
const emitSet = new Set(ir.emits);
const verbEmitClash = exposeNames.filter((v) => emitSet.has(v));
if (verbEmitClash.length) fail(`expose-verb == emit collision (ROZ121): [${verbEmitClash.join(', ')}]`);
const modelSetters = new Set(modelNames.map((m) => `set${m[0].toUpperCase()}${m.slice(1)}`));
const verbSetterClash = exposeNames.filter((v) => modelSetters.has(v));
if (verbSetterClash.length) fail(`expose-verb == React model-setter collision (ROZ524): [${verbSetterClash.join(', ')}]`);

// ── 2. compile()×6 — collision gates surface here as error diagnostics ──────
const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'];
for (const target of TARGETS) {
  const r = compile(source, { target, filename: FILENAME });
  const errs = r.diagnostics.filter((d) => d.severity === 'error');
  if (errs.length) fail(`compile(${target}) errors:\n${errs.map((d) => `  ${d.code} ${d.message}`).join('\n')}`);
  else if (!r.code || !r.code.length) fail(`compile(${target}) produced empty output with no diagnostics`);
}

if (process.exitCode) {
  console.error('\n✗ compile-toast-check FAILED');
} else {
  console.log(`✓ Toaster surface OK: ${EXPECT.props.length} props (${EXPECT.models.length} model) / ${EXPECT.emits.length} emits / ${EXPECT.slots.length} slot / ${EXPECT.expose.length} expose; compile()×6 zero-error (zero emits → handle-only; collision-free).`);
}
