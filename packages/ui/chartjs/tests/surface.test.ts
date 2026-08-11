/**
 * surface.test.ts — the Chart.rozie surface gate as a vitest test (so it runs
 * under `turbo run test`). Prior to this suite the family had NO test
 * directory at all and `vitest run --passWithNoTests` silently passed with
 * zero assertions (AUDIT.md RELEASE-PREP-GAP finding).
 *
 * Re-asserts the SAME contract a standalone compile-check would, PLUS the one
 * invariant no earlier `@rozie-ui` family needed — the 8 per-type variants:
 *
 *   1. lowerToIR() emits ZERO error-severity diagnostics for the generic Chart.
 *   2. The generic Chart's IR surface matches the SPEC contract exactly —
 *      11 props, 3 emits, 2 slots (`fallback` plain, `tooltip` portal carrying
 *      the `model` param), 15 expose verbs.
 *   3. Every `ir.expose` name has a `handleManifest` entry AND every
 *      `handleManifest` key is in `ir.expose` — codegen.mjs's own assert is
 *      one-directional (source → manifest); this closes the reverse direction
 *      so an orphaned manifest key fails loudly instead of silently
 *      documenting a verb that no longer exists.
 *   4. The per-type variant list codegen builds (`VARIANTS` + `makeVariantSource`,
 *      imported from scripts/codegen.mjs — the SAME source the barrels, the
 *      deep-import subpaths, and the IDE sidecars all use) has one entry per
 *      emitted component, and EVERY variant's lowered surface equals the
 *      generic surface minus the `type` prop (10 props; identical emits/
 *      slots/expose) — so adding a chart type, or accidentally dropping a
 *      prop from a variant's source transform, is caught.
 *   5. compile()×6 for the generic Chart emits ZERO error-severity diagnostics
 *      + non-empty code.
 *
 * Pure GLUE over the @rozie/core public API — no compiler/emitter/IR change.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { handleManifest } from '../scripts/handle-manifest.mjs';
import { VARIANTS, makeVariantSource } from '../scripts/codegen.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src', 'Chart.rozie');
const FILENAME = 'Chart.rozie';
const source = readFileSync(SRC, 'utf8');

const EXPECT = {
  name: 'Chart',
  props: [
    'data', 'options', 'type', 'height', 'width', 'plugins', 'updateMode',
    'redraw', 'ariaLabel', 'datasetIdKey', 'destroyDelay',
  ],
  emits: ['click', 'hover', 'datasetClick'],
  slots: ['fallback', 'tooltip'],
  expose: [
    'getChart', 'updateChart', 'resizeChart', 'resetChart', 'renderChart',
    'stopChart', 'clearChart', 'toBase64Image', 'setDatasetVisibility',
    'isDatasetVisible', 'hideDataset', 'showDataset', 'setActiveElements',
    'getActiveElements', 'getDatasetMeta',
  ],
} as const;

const VARIANT_NAMES = ['Line', 'Bar', 'Pie', 'Doughnut', 'PolarArea', 'Radar', 'Scatter', 'Bubble'];

const sorted = (a: readonly string[]) => [...a].sort();

describe('Chart.rozie surface gate (generic)', () => {
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

  it('props surface matches (11 props)', () => {
    const propNames = ir.props.map((p: { name: string }) => p.name);
    expect(sorted(propNames)).toEqual(sorted(EXPECT.props));
  });

  it('emits surface matches (3 events)', () => {
    expect(sorted(ir.emits)).toEqual(sorted(EXPECT.emits));
  });

  it('slot surface matches (2 slots)', () => {
    const slotNames = ir.slots.map((s: { name: string }) => s.name);
    expect(sorted(slotNames)).toEqual(sorted(EXPECT.slots));
  });

  it('tooltip is a portal slot carrying the `model` param', () => {
    const slot = ir.slots.find((s: { name: string }) => s.name === 'tooltip') as
      | { isPortal?: boolean; params?: { name: string }[] }
      | undefined;
    expect(slot?.isPortal, 'tooltip should be a portal slot').toBe(true);
    expect((slot?.params ?? []).map((p) => p.name)).toEqual(['model']);
  });

  it('fallback is a plain (non-portal) slot', () => {
    const slot = ir.slots.find((s: { name: string }) => s.name === 'fallback') as
      | { isPortal?: boolean }
      | undefined;
    expect(slot?.isPortal, 'fallback should NOT be a portal slot').toBeFalsy();
  });

  it('expose surface matches (15 verbs)', () => {
    const exposeNames = ir.expose.map((e: { name: string }) => e.name);
    expect(sorted(exposeNames)).toEqual(sorted(EXPECT.expose));
  });

  it('every ir.expose name has a handleManifest entry (codegen already asserts this direction)', () => {
    const exposeNames = ir.expose.map((e: { name: string }) => e.name);
    for (const name of exposeNames) {
      expect(handleManifest, `handleManifest is missing "${name}"`).toHaveProperty(name);
    }
  });

  it('every handleManifest key is in ir.expose (the REVERSE direction codegen does NOT check)', () => {
    const exposeNames = new Set(ir.expose.map((e: { name: string }) => e.name));
    for (const key of Object.keys(handleManifest)) {
      expect(exposeNames.has(key), `handleManifest has orphaned key "${key}" not in ir.expose`).toBe(
        true,
      );
    }
  });

  it('no prop name collides with an expose verb or an emit name', () => {
    const propNames = new Set(EXPECT.props);
    const clashExpose = EXPECT.expose.filter((e) => propNames.has(e));
    const clashEmits = EXPECT.emits.filter((e) => propNames.has(e));
    expect(clashExpose).toEqual([]);
    expect(clashEmits).toEqual([]);
  });

  const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const;
  it.each(TARGETS)('compile(%s) emits zero error diagnostics + non-empty code', (target) => {
    const r = compile(source, { target, filename: FILENAME });
    const errs = r.diagnostics.filter((d) => d.severity === 'error');
    expect(errs).toEqual([]);
    expect(r.code.length).toBeGreaterThan(0);
  });
});

describe('Chart.rozie per-type variant invariant (8 variants)', () => {
  it('VARIANTS (imported from codegen.mjs) has exactly the 8 expected names, in the SAME source the barrels/subpaths/sidecars use', () => {
    expect(VARIANTS.map((v: { name: string }) => v.name)).toEqual(VARIANT_NAMES);
  });

  it.each(VARIANT_NAMES)('%s: 10 props (generic minus `type`), identical emits/slots/expose', (name) => {
    const variant = VARIANTS.find((v: { name: string }) => v.name === name);
    expect(variant, `no VARIANTS entry for ${name}`).toBeDefined();

    const variantSource = makeVariantSource(source, variant);
    const { ast } = parse(variantSource, { filename: `${name}.rozie` });
    const { ir, diagnostics: lowerDiags = [] } = lowerToIR(ast, {
      modifierRegistry: createDefaultRegistry(),
    });

    const errs = lowerDiags.filter((d) => d.severity === 'error');
    expect(errs, `${name}: lowerToIR emitted error diagnostics`).toEqual([]);

    expect(ir.name).toBe(name);

    const propNames = ir.props.map((p: { name: string }) => p.name);
    const expectedVariantProps = EXPECT.props.filter((p) => p !== 'type');
    expect(propNames).not.toContain('type');
    expect(sorted(propNames)).toEqual(sorted(expectedVariantProps));

    expect(sorted(ir.emits)).toEqual(sorted(EXPECT.emits));

    const slotNames = ir.slots.map((s: { name: string }) => s.name);
    expect(sorted(slotNames)).toEqual(sorted(EXPECT.slots));

    const exposeNames = ir.expose.map((e: { name: string }) => e.name);
    expect(sorted(exposeNames)).toEqual(sorted(EXPECT.expose));
  });
});
