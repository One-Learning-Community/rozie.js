/**
 * surface.test.ts — the MapLibre.rozie surface gate as a vitest test (so it runs
 * under `turbo run test`, not just the standalone scripts/compile-maplibre-check.mjs).
 *
 * Re-asserts the SAME contract the .mjs script checks (Wave 1):
 *   1. lowerToIR() emits ZERO error-severity diagnostics.
 *   2. The IR surface (name / props / model props / emits / slots + portal-reactive
 *      flags / expose) matches the SPEC contract exactly.
 *   3. compile()×6 emits ZERO error-severity diagnostics + non-empty code
 *      (ROZ127 slot==prop, ROZ121 expose-verb==event, ROZ524 React model-setter,
 *      Lit reserved-lifecycle all surface here as compile() errors).
 *
 * Pure GLUE over the @rozie/core public API — no compiler/emitter/IR change.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src', 'MapLibre.rozie');
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
  // 20 emits — continuous `zoom`/`pitch` omitted (would collide with the
  // zoom/pitch model:true camera props on Vue/Angular; terminal zoomend/pitchend
  // carry the need). move/rotate stay (center/bearing models ≠ those names).
  emits: [
    'load', 'idle', 'move', 'rotate', 'dragstart', 'drag',
    'dragend', 'click', 'dblclick', 'contextmenu', 'mousemove', 'error',
    'styledata', 'sourcedata', 'moveend', 'zoomend', 'rotateend', 'pitchend',
    'mouseenter', 'mouseleave',
  ],
  // marker/popup/control = the reactive portal slots (config-array path); '' = the
  // default slot that hosts the Phase 37 declarative <Source>/<Layer> children (added
  // in 37-01). All coexist.
  slots: ['', 'marker', 'popup', 'control'],
  expose: ['getMap', 'flyTo', 'easeTo', 'jumpTo', 'fitBounds', 'getCenter', 'getZoom', 'resize'],
} as const;

const sorted = (a: readonly string[]) => [...a].sort();

describe('MapLibre.rozie surface gate', () => {
  const { ast } = parse(source, { filename: FILENAME });
  const { ir, diagnostics: lowerDiags = [] } = lowerToIR(ast, {
    modifierRegistry: createDefaultRegistry(),
  });

  it('lowerToIR emits zero error diagnostics', () => {
    const errs = lowerDiags.filter((d) => d.severity === 'error');
    expect(errs).toEqual([]);
  });

  it('component name matches', () => {
    expect(ir.name).toBe(EXPECT.name);
  });

  it('props surface matches (25 props)', () => {
    const propNames = ir.props.map((p: { name: string }) => p.name);
    expect(sorted(propNames)).toEqual(sorted(EXPECT.props));
  });

  it('model:true props match (center/zoom/bearing/pitch)', () => {
    const modelNames = ir.props
      .filter((p: { isModel?: boolean }) => p.isModel)
      .map((p: { name: string }) => p.name);
    expect(sorted(modelNames)).toEqual(sorted(EXPECT.models));
  });

  it('emits surface matches (20 emits)', () => {
    expect(sorted(ir.emits)).toEqual(sorted(EXPECT.emits));
  });

  it('slots surface matches (marker/popup/control)', () => {
    const slotNames = ir.slots.map((s: { name: string }) => s.name);
    expect(sorted(slotNames)).toEqual(sorted(EXPECT.slots));
  });

  it('marker/popup/control are portal slots; marker/popup are REACTIVE, control is mount-once', () => {
    const slotByName = Object.fromEntries(
      ir.slots.map((s: { name: string }) => [s.name, s]),
    ) as Record<string, { isPortal?: boolean; isReactive?: boolean }>;
    for (const n of ['marker', 'popup', 'control']) {
      expect(slotByName[n]?.isPortal, `${n} should be a portal slot`).toBe(true);
    }
    for (const n of ['marker', 'popup']) {
      expect(slotByName[n]?.isReactive, `${n} should be REACTIVE`).toBe(true);
    }
    expect(
      Boolean(slotByName.control?.isReactive),
      'control should be MOUNT-ONCE (not reactive)',
    ).toBe(false);
  });

  it('expose surface matches (8 verbs)', () => {
    const exposeNames = ir.expose.map((e: { name: string }) => e.name);
    expect(sorted(exposeNames)).toEqual(sorted(EXPECT.expose));
  });

  const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const;
  it.each(TARGETS)('compile(%s) emits zero error diagnostics + non-empty code', (target) => {
    const r = compile(source, { target, filename: FILENAME });
    const errs = r.diagnostics.filter((d) => d.severity === 'error');
    expect(errs).toEqual([]);
    expect(r.code.length).toBeGreaterThan(0);
  });
});
