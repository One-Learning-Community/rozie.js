/**
 * compile-maplibre-check.mjs — the live compile() collision/surface gate for
 * Phase 35 (run BEFORE any leaf work, the TipTap/Chart.js discipline).
 *
 * Pure GLUE over the @rozie/core public API. Asserts:
 *   1. lowerToIR() + compile()×6 emit ZERO error-severity diagnostics
 *      (ROZ127 slot==prop, ROZ121 expose-verb==event, ROZ524 React model-setter,
 *      Lit reserved-lifecycle — all surface here as compile() errors).
 *   2. The IR surface matches the SPEC contract exactly.
 * THROWS (non-zero exit) on any drift. No compiler/emitter/IR change.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = resolve(ROOT, 'src/MapLibre.rozie');
const FILENAME = 'MapLibre.rozie';
const source = readFileSync(SRC, 'utf8');

const EXPECT = {
  name: 'MapLibre',
  props: [
    'center', 'zoom', 'bearing', 'pitch', 'mapStyle', 'minZoom', 'maxZoom',
    'maxBounds', 'bounds', 'fitBoundsOptions', 'dragPan', 'dragRotate',
    'scrollZoom', 'doubleClickZoom', 'boxZoom', 'keyboard', 'touchZoomRotate',
    'touchPitch', 'markers', 'popups', 'sources', 'layers', 'interactiveLayerIds',
    'controls', 'options',
  ],
  models: ['center', 'zoom', 'bearing', 'pitch'],
  // 20 emits. NOTE: continuous `zoom`/`pitch` are intentionally absent — they
  // would collide with the `zoom`/`pitch` model:true camera props (Vue defineModel
  // vs defineEmits, Angular ModelSignal vs OutputEmitterRef). The terminal
  // `zoomend`/`pitchend` carry the event need; `move`/`rotate` stay (no clash).
  emits: [
    'load', 'idle', 'move', 'rotate', 'dragstart', 'drag',
    'dragend', 'click', 'dblclick', 'contextmenu', 'mousemove', 'error',
    'styledata', 'sourcedata', 'moveend', 'zoomend', 'rotateend', 'pitchend',
    'mouseenter', 'mouseleave',
  ],
  slots: ['marker', 'popup', 'control'],
  expose: ['getMap', 'flyTo', 'easeTo', 'jumpTo', 'fitBounds', 'getCenter', 'getZoom', 'resize'],
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

// portal/reactive flags
const slotByName = Object.fromEntries(ir.slots.map((s) => [s.name, s]));
for (const n of ['marker', 'popup', 'control']) {
  if (!slotByName[n]?.isPortal) fail(`slot ${n} should be a portal slot`);
}
for (const n of ['marker', 'popup']) {
  if (!slotByName[n]?.isReactive) fail(`slot ${n} should be a REACTIVE portal slot`);
}
if (slotByName.control?.isReactive) fail(`slot control should be MOUNT-ONCE (not reactive)`);

const exposeNames = ir.expose.map((e) => e.name);
if (!setEq(exposeNames, EXPECT.expose)) fail(`expose mismatch: got [${exposeNames.sort()}], want [${[...EXPECT.expose].sort()}]`);

// model-prop == emit-name collision guard (Vue defineModel vs defineEmits,
// Angular ModelSignal vs OutputEmitterRef). compile()'s ROZ diagnostics don't
// flag this class today, so assert it here.
const modelSet = new Set(modelNames);
const modelEmitClash = ir.emits.filter((e) => modelSet.has(e));
if (modelEmitClash.length) fail(`model-prop == emit collision (Vue/Angular two-way clash): [${modelEmitClash.join(', ')}]`);

// ── 2. compile()×6 — collision gates surface here as error diagnostics ──────
const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'];
for (const target of TARGETS) {
  const r = compile(source, { target, filename: FILENAME });
  const errs = r.diagnostics.filter((d) => d.severity === 'error');
  if (errs.length) fail(`compile(${target}) errors:\n${errs.map((d) => `  ${d.code} ${d.message}`).join('\n')}`);
  else if (!r.code || !r.code.length) fail(`compile(${target}) produced empty output with no diagnostics`);
}

if (process.exitCode) {
  console.error('\n✗ compile-maplibre-check FAILED');
} else {
  console.log(`✓ MapLibre surface OK: ${EXPECT.props.length} props (${EXPECT.models.length} model) / ${EXPECT.emits.length} emits / ${EXPECT.slots.length} slots / ${EXPECT.expose.length} expose; compile()×6 zero-error.`);
}
