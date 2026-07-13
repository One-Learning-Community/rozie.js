/**
 * compile-command-palette-check.mjs — the live compile() collision/surface gate
 * for the CommandPalette family (run BEFORE any leaf work, the otp/captcha
 * discipline).
 *
 * Pure GLUE over the @rozie/core public API. Asserts:
 *   1. lowerToIR() + compile()×6 emit ZERO error-severity diagnostics.
 *      The DELIBERATE `focus` $expose verb is a warn-only ROZ137 (accepted Lit
 *      override), filtered out by the error-severity gate.
 *   2. The IR surface matches the contract exactly.
 *   3. The OPEN verb is `show` (NOT `open`) — an `open` verb would collide with
 *      the `open` MODEL on React (both collapse onto generated open/setOpen
 *      state, the $data/model-key == $expose-verb class). `close`/`toggle`/
 *      `focus` are collision-checked against the single `select` emit + the
 *      React model setters.
 * THROWS (non-zero exit) on any drift. No compiler/emitter/IR change.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = resolve(ROOT, 'src/CommandPalette.rozie');
// Phase 75 (Option A): FILENAME must be the ABSOLUTE source path (not a bare
// relative label) so <components> producer resolution walks node_modules
// upward from command-palette/src regardless of the invoking process's cwd —
// resolveManifestProducer resolves from dirname(fromFile), not from cwd or
// resolverRoot (which feeds only the tsconfig-paths matcher).
const FILENAME = SRC;
const source = readFileSync(SRC, 'utf8');

const EXPECT = {
  name: 'CommandPalette',
  props: ['open', 'query', 'items', 'placeholder', 'emptyText', 'closeOnSelect', 'ariaLabel', 'idBase'],
  models: ['open', 'query'],
  emits: ['select'],
  // D-05 (BREAKING): re-aligned to the combobox slot vocabulary —
  // `#item {item,active}` → `#option {option,index,active,selected,disabled}`.
  // (Rule 1 fix, Phase 75: this EXPECT was stale — `item` — leftover from
  // before the slot-vocabulary rename landed; this script is not wired into
  // any package.json script/CI job so the drift went uncaught. Corrected to
  // match tests/surface.test.ts's already-correct EXPECT.slots and the real
  // ir.slots the compiler emits.)
  slots: ['option', 'empty', 'footer'],
  expose: ['show', 'close', 'toggle', 'focus'],
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

// OPEN verb must be `show`, not `open` (the model collision).
if (exposeNames.includes('open')) fail('expose verb `open` collides with the `open` MODEL — rename to `show`');

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
  const r = compile(source, { target, filename: FILENAME, resolverRoot: ROOT });
  const errs = r.diagnostics.filter((d) => d.severity === 'error');
  if (errs.length) fail(`compile(${target}) errors:\n${errs.map((d) => `  ${d.code} ${d.message}`).join('\n')}`);
  else if (!r.code || !r.code.length) fail(`compile(${target}) produced empty output with no diagnostics`);
}

if (process.exitCode) {
  console.error('\n✗ compile-command-palette-check FAILED');
} else {
  console.log(`✓ CommandPalette surface OK: ${EXPECT.props.length} props (${EXPECT.models.length} model) / ${EXPECT.emits.length} emit / ${EXPECT.slots.length} slots / ${EXPECT.expose.length} expose; compile()×6 zero-error (focus = accepted warn-only ROZ137).`);
}
