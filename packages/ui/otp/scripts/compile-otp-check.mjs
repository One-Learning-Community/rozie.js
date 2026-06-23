/**
 * compile-otp-check.mjs — the live compile() collision/surface gate for the Otp
 * family (run BEFORE any leaf work, the slider/captcha discipline).
 *
 * Pure GLUE over the @rozie/core public API. Asserts:
 *   1. lowerToIR() + compile()×6 emit ZERO error-severity diagnostics
 *      (ROZ127 slot==prop, ROZ121 expose-verb==event, ROZ524 React model-setter,
 *      Lit reserved-lifecycle — all surface here as compile() errors). The
 *      DELIBERATE `focus` override is a warn-only ROZ137 (accepted), so it is
 *      filtered out by the error-severity gate.
 *   2. The IR surface matches the contract exactly.
 * THROWS (non-zero exit) on any drift. No compiler/emitter/IR change.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = resolve(ROOT, 'src/Otp.rozie');
const FILENAME = 'Otp.rozie';
const source = readFileSync(SRC, 'utf8');

const EXPECT = {
  name: 'Otp',
  props: ['value', 'length', 'type', 'mask', 'autoFocus', 'disabled', 'placeholder', 'ariaLabel'],
  models: ['value'],
  emits: ['change', 'complete'],
  slots: [],
  expose: ['focus', 'clear'],
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
  console.error('\n✗ compile-otp-check FAILED');
} else {
  console.log(`✓ Otp surface OK: ${EXPECT.props.length} props (${EXPECT.models.length} model) / ${EXPECT.emits.length} emits / ${EXPECT.slots.length} slots / ${EXPECT.expose.length} expose; compile()×6 zero-error (focus = accepted warn-only ROZ137).`);
}
