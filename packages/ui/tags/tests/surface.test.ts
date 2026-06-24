/**
 * surface.test.ts — the Tags.rozie surface gate as a vitest test (so it runs
 * under `turbo run test`, not just the standalone scripts/compile-tags-check.mjs).
 *
 * Re-asserts the SAME contract the .mjs script checks:
 *   1. lowerToIR() emits ZERO error-severity diagnostics.
 *   2. The IR surface (name / props / model props / emits / slots / expose)
 *      matches the contract exactly.
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
const SRC = resolve(HERE, '..', 'src', 'Tags.rozie');
const FILENAME = 'Tags.rozie';
const source = readFileSync(SRC, 'utf8');

const EXPECT = {
  name: 'Tags',
  props: [
    'modelValue',
    'delimiters',
    'allowDuplicates',
    'max',
    'disabled',
    'readonly',
    'validate',
    'placeholder',
    'ariaLabel',
  ],
  models: ['modelValue'],
  emits: ['add', 'remove', 'change'],
  slots: ['tag'],
  expose: ['clear', 'focusInput'],
} as const;

const sorted = (a: readonly string[]) => [...a].sort();

describe('Tags.rozie surface gate', () => {
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

  it('props surface matches (9 props)', () => {
    const propNames = ir.props.map((p: { name: string }) => p.name);
    expect(sorted(propNames)).toEqual(sorted(EXPECT.props));
  });

  it('model:true props match (modelValue)', () => {
    const modelNames = ir.props
      .filter((p: { isModel?: boolean }) => p.isModel)
      .map((p: { name: string }) => p.name);
    expect(sorted(modelNames)).toEqual(sorted(EXPECT.models));
  });

  it('emits surface matches (add/remove/change)', () => {
    expect(sorted(ir.emits)).toEqual(sorted(EXPECT.emits));
  });

  it('declares the scoped tag slot', () => {
    const slotNames = ir.slots.map((s: { name: string }) => s.name);
    expect(sorted(slotNames)).toEqual(sorted(EXPECT.slots));
  });

  it('expose surface matches (clear/focusInput)', () => {
    const exposeNames = ir.expose.map((e: { name: string }) => e.name);
    expect(sorted(exposeNames)).toEqual(sorted(EXPECT.expose));
  });

  it('exposes no `render` verb (would clobber the Lit lifecycle method)', () => {
    const exposeNames = ir.expose.map((e: { name: string }) => e.name);
    expect(exposeNames).not.toContain('render');
  });

  it('no slot name collides with a prop (ROZ127)', () => {
    const slotNames = ir.slots.map((s: { name: string }) => s.name);
    const propSet = new Set(ir.props.map((p: { name: string }) => p.name));
    expect(slotNames.filter((s: string) => propSet.has(s))).toEqual([]);
  });

  it('no expose-verb collides with an emit (ROZ121) or the React model setter (ROZ524)', () => {
    const exposeNames = ir.expose.map((e: { name: string }) => e.name);
    const emitSet = new Set(ir.emits);
    expect(exposeNames.filter((v: string) => emitSet.has(v))).toEqual([]);
    const modelNames = ir.props
      .filter((p: { isModel?: boolean }) => p.isModel)
      .map((p: { name: string }) => p.name);
    const setters = new Set(modelNames.map((m: string) => `set${m[0].toUpperCase()}${m.slice(1)}`));
    expect(exposeNames.filter((v: string) => setters.has(v))).toEqual([]);
  });

  it('no plain helper collides with an Angular CVA method name', () => {
    // A single model:true prop generates a ControlValueAccessor; a PLAIN helper
    // named writeValue/registerOnChange/registerOnTouched/setDisabledState would
    // collide at the ng-packagr build (TS2300). The funnel is `commitTokens`.
    const cvaMethods = ['writeValue', 'registerOnChange', 'registerOnTouched', 'setDisabledState'];
    const exposeNames = new Set(ir.expose.map((e: { name: string }) => e.name));
    for (const m of cvaMethods) expect(exposeNames.has(m)).toBe(false);
  });

  const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const;
  it.each(TARGETS)('compile(%s) emits zero error diagnostics + non-empty code', (target) => {
    const r = compile(source, { target, filename: FILENAME });
    const errs = r.diagnostics.filter((d) => d.severity === 'error');
    expect(errs).toEqual([]);
    expect(r.code.length).toBeGreaterThan(0);
  });
});
