/**
 * surface.test.ts — the Cropper.rozie surface gate as a vitest test (so it runs
 * under `turbo run test`, not just the standalone scripts/compile-cropper-check.mjs).
 *
 * Re-asserts the SAME contract the .mjs script checks:
 *   1. lowerToIR() emits ZERO error-severity diagnostics.
 *   2. The IR surface (name / props / model props / emits / slots / expose)
 *      matches the SPEC contract exactly.
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
const SRC = resolve(HERE, '..', 'src', 'Cropper.rozie');
const FILENAME = 'Cropper.rozie';
const source = readFileSync(SRC, 'utf8');

const EXPECT = {
  name: 'Cropper',
  props: [
    'src', 'data', 'aspectRatio', 'viewMode', 'dragMode', 'disabled', 'guides',
    'center', 'background', 'movable', 'rotatable', 'scalable', 'zoomable',
    'zoomOnWheel', 'cropBoxMovable', 'cropBoxResizable', 'autoCrop',
    'autoCropArea', 'responsive', 'options',
  ],
  models: ['data'],
  emits: ['ready', 'crop', 'cropstart', 'cropmove', 'cropend', 'zoom'],
  slots: [] as string[],
  expose: [
    'getCropper', 'getData', 'getCroppedCanvas', 'getCroppedDataURL', 'reset',
    'clear', 'showCropBox', 'replace', 'rotateTo', 'rotateBy', 'zoomTo', 'zoomBy',
    'scaleX', 'scaleY', 'enable', 'disable', 'setAspectRatio', 'setDragMode',
  ],
} as const;

const sorted = (a: readonly string[]) => [...a].sort();

describe('Cropper.rozie surface gate', () => {
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

  it('props surface matches (20 props)', () => {
    const propNames = ir.props.map((p: { name: string }) => p.name);
    expect(sorted(propNames)).toEqual(sorted(EXPECT.props));
  });

  it('model:true props match (data)', () => {
    const modelNames = ir.props
      .filter((p: { isModel?: boolean }) => p.isModel)
      .map((p: { name: string }) => p.name);
    expect(sorted(modelNames)).toEqual(sorted(EXPECT.models));
  });

  it('emits surface matches (6 emits)', () => {
    expect(sorted(ir.emits)).toEqual(sorted(EXPECT.emits));
  });

  it('declares no slots', () => {
    const slotNames = ir.slots.map((s: { name: string }) => s.name);
    expect(sorted(slotNames)).toEqual(sorted(EXPECT.slots));
  });

  it('expose surface matches (18 verbs)', () => {
    const exposeNames = ir.expose.map((e: { name: string }) => e.name);
    expect(sorted(exposeNames)).toEqual(sorted(EXPECT.expose));
  });

  it('no expose-verb collides with an emit (ROZ121) or the React data-model setter (ROZ524)', () => {
    const exposeNames = ir.expose.map((e: { name: string }) => e.name);
    const emitSet = new Set(ir.emits);
    expect(exposeNames.filter((v: string) => emitSet.has(v))).toEqual([]);
    const modelNames = ir.props
      .filter((p: { isModel?: boolean }) => p.isModel)
      .map((p: { name: string }) => p.name);
    const setters = new Set(modelNames.map((m: string) => `set${m[0].toUpperCase()}${m.slice(1)}`));
    expect(exposeNames.filter((v: string) => setters.has(v))).toEqual([]);
  });

  const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const;
  it.each(TARGETS)('compile(%s) emits zero error diagnostics + non-empty code', (target) => {
    const r = compile(source, { target, filename: FILENAME });
    const errs = r.diagnostics.filter((d) => d.severity === 'error');
    expect(errs).toEqual([]);
    expect(r.code.length).toBeGreaterThan(0);
  });
});
