/**
 * surface.test.ts — the Toaster.rozie surface gate as a vitest test (so it runs
 * under `turbo run test`, not just the standalone scripts/compile-toast-check.mjs).
 *
 * Re-asserts the SAME contract the .mjs script checks:
 *   1. lowerToIR() emits ZERO error-severity diagnostics.
 *   2. The IR surface (name / props / model props / emits / slots / expose)
 *      matches the contract exactly — including the single `dismissed` emit
 *      (the family's first event) and the single `toast` scoped slot.
 *   3. compile()×6 emits ZERO error-severity diagnostics + non-empty code
 *      (ROZ127 slot==prop, ROZ121 expose-verb==event, ROZ524 React model-setter,
 *      Lit reserved-lifecycle all surface here as compile() errors). Toaster is
 *      collision-free, so compile()×6 is fully clean.
 *
 * Pure GLUE over the @rozie/core public API — no compiler/emitter/IR change.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src', 'Toaster.rozie');
const FILENAME = 'Toaster.rozie';
const source = readFileSync(SRC, 'utf8');

const EXPECT = {
  name: 'Toaster',
  props: ['position', 'duration', 'max', 'disablePauseOnHover', 'ariaLabel', 'disableSwipe'],
  models: [] as string[],
  emits: ['dismissed'] as string[],
  slots: ['toast'],
  expose: ['show', 'dismiss', 'clear', 'patch', 'promise'],
} as const;

const sorted = (a: readonly string[]) => [...a].sort();

describe('Toaster.rozie surface gate', () => {
  const { ast } = parse(source, { filename: FILENAME });
  const { ir, diagnostics: lowerDiags = [] } = lowerToIR(ast, {
    modifierRegistry: createDefaultRegistry(),
  });

  it('lowerToIR emits zero error diagnostics', () => {
    const errs = lowerDiags.filter((d) => d.severity === 'error');
    expect(errs).toEqual([]);
  });

  it('component name matches (Toaster)', () => {
    expect(ir.name).toBe(EXPECT.name);
  });

  it('props surface matches (6 props)', () => {
    const propNames = ir.props.map((p: { name: string }) => p.name);
    expect(sorted(propNames)).toEqual(sorted(EXPECT.props));
  });

  it('declares no model:true props (a notification host, not a form control)', () => {
    const modelNames = ir.props
      .filter((p: { isModel?: boolean }) => p.isModel)
      .map((p: { name: string }) => p.name);
    expect(sorted(modelNames)).toEqual(sorted(EXPECT.models));
  });

  it('emits exactly [\'dismissed\'] (the first family event; clear() emits nothing)', () => {
    expect(sorted(ir.emits)).toEqual(sorted(EXPECT.emits));
    expect(ir.emits.length).toBe(1);
  });

  it('declares the single `toast` scoped slot', () => {
    const slotNames = ir.slots.map((s: { name: string }) => s.name);
    expect(sorted(slotNames)).toEqual(sorted(EXPECT.slots));
  });

  it('expose surface matches (show/dismiss/clear/patch/promise)', () => {
    const exposeNames = ir.expose.map((e: { name: string }) => e.name);
    expect(sorted(exposeNames)).toEqual(sorted(EXPECT.expose));
  });

  it('exposes no `render` verb (would clobber the Lit lifecycle method)', () => {
    const exposeNames = ir.expose.map((e: { name: string }) => e.name);
    expect(exposeNames).not.toContain('render');
  });

  it('no expose-verb collides with an emit (ROZ121) or a React model setter (ROZ524)', () => {
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
