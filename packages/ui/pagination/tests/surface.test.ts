/**
 * surface.test.ts — the Pagination.rozie surface gate as a vitest test (so it
 * runs under `turbo run test`, not just the standalone
 * scripts/compile-pagination-check.mjs).
 *
 * Re-asserts the SAME contract the .mjs script checks:
 *   1. lowerToIR() emits ZERO error-severity diagnostics.
 *   2. The IR surface (name / props / model props / emits / slots / expose)
 *      matches the contract exactly.
 *   3. compile()×6 emits ZERO error-severity diagnostics + non-empty code
 *      (ROZ127 slot==prop, ROZ121 expose-verb==event, ROZ524 React model-setter,
 *      Lit reserved-lifecycle, ROZ720 Angular @for track all surface here as
 *      compile() errors).
 *
 * Pure GLUE over the @rozie/core public API — no compiler/emitter/IR change.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src', 'Pagination.rozie');
const FILENAME = 'Pagination.rozie';
const source = readFileSync(SRC, 'utf8');

const EXPECT = {
  name: 'Pagination',
  props: ['modelValue', 'totalPages', 'total', 'pageSize', 'siblingCount', 'boundaryCount', 'disabled', 'ariaLabel'],
  models: ['modelValue'],
  emits: ['change'],
  slots: ['prevControl', 'nextControl', 'item', 'ellipsis'] as string[],
  expose: ['goto', 'next', 'prev', 'first', 'last'],
} as const;

const sorted = (a: readonly string[]) => [...a].sort();

describe('Pagination.rozie surface gate', () => {
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

  it('props surface matches (8 props)', () => {
    const propNames = ir.props.map((p: { name: string }) => p.name);
    expect(sorted(propNames)).toEqual(sorted(EXPECT.props));
  });

  it('model:true props match (modelValue)', () => {
    const modelNames = ir.props
      .filter((p: { isModel?: boolean }) => p.isModel)
      .map((p: { name: string }) => p.name);
    expect(sorted(modelNames)).toEqual(sorted(EXPECT.models));
  });

  it('emits surface matches (change)', () => {
    expect(sorted(ir.emits)).toEqual(sorted(EXPECT.emits));
  });

  it('slots surface matches (prevControl/nextControl/item/ellipsis)', () => {
    const slotNames = ir.slots.map((s: { name: string }) => s.name);
    expect(sorted(slotNames)).toEqual(sorted(EXPECT.slots));
  });

  it('no slot name collides with a prop name (ROZ127)', () => {
    const slotNames = new Set(ir.slots.map((s: { name: string }) => s.name));
    const propNames = ir.props.map((p: { name: string }) => p.name);
    expect(propNames.filter((n: string) => slotNames.has(n))).toEqual([]);
  });

  it('expose surface matches (goto/next/prev/first/last)', () => {
    const exposeNames = ir.expose.map((e: { name: string }) => e.name);
    expect(sorted(exposeNames)).toEqual(sorted(EXPECT.expose));
  });

  it('exposes no `render` verb (would clobber the Lit lifecycle method)', () => {
    const exposeNames = ir.expose.map((e: { name: string }) => e.name);
    expect(exposeNames).not.toContain('render');
  });

  it('no expose-verb collides with an emit (ROZ121) or the React modelValue setter (ROZ524)', () => {
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
