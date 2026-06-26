/**
 * surface.test.ts — the CommandPalette.rozie surface gate as a vitest test (so
 * it runs under `turbo run test`, not just scripts/compile-command-palette-check.mjs).
 *
 * Re-asserts the SAME contract the .mjs script checks:
 *   1. lowerToIR() emits ZERO error-severity diagnostics.
 *   2. The IR surface (name / props / model props / emits / slots / expose)
 *      matches the contract exactly.
 *   3. compile()×6 emits ZERO error-severity diagnostics + non-empty code. The
 *      DELIBERATE `focus` override is warn-only ROZ137 (accepted).
 *
 * Pure GLUE over the @rozie/core public API — no compiler/emitter/IR change.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src', 'CommandPalette.rozie');
// Use the ABSOLUTE source path as the compile filename so the <components>
// producer resolution (threadParamTypes) finds the vendored ./Listbox.rozie
// sibling on disk next to it.
const FILENAME = SRC;
const source = readFileSync(SRC, 'utf8');

const EXPECT = {
  name: 'CommandPalette',
  props: ['open', 'query', 'items', 'placeholder', 'emptyText', 'closeOnSelect', 'ariaLabel', 'idBase'],
  models: ['open', 'query'],
  emits: ['select'],
  // D-05 (BREAKING, Phase 999.4): the public slots are re-aligned to the vendored
  // listbox vocabulary — `#item {item,active}` → `#option {option,index,active,
  // selected,disabled}`; `#empty` gains `{query}`; `#footer` unchanged (a panel
  // sibling outside the listbox).
  slots: ['option', 'empty', 'footer'],
  expose: ['show', 'close', 'toggle', 'focus'],
} as const;

// D-07 (LOAD-BEARING): the authored CommandPalette.rozie must use the STABLE
// package-style specifier (which the codegen vendor-step remaps to the local
// sibling under Option B) and NEVER the relative form. This is the byte-identity
// invariant — switching B→A touches only codegen + the drift guard, never the
// authored source.
const STABLE_LISTBOX_SPECIFIER = '@rozie-ui/listbox/Listbox.rozie';
const RELATIVE_LISTBOX_SPECIFIER = './Listbox.rozie';

// The compiled shape: under Option B the codegen rewrites the stable specifier to
// the local vendored sibling BEFORE compile (so producer resolution finds it on
// disk). The surface gate must compile the SAME remapped source the leaves do.
const composedSource = source.replaceAll(STABLE_LISTBOX_SPECIFIER, RELATIVE_LISTBOX_SPECIFIER);

const sorted = (a: readonly string[]) => [...a].sort();

describe('CommandPalette.rozie surface gate', () => {
  const { ast } = parse(composedSource, { filename: FILENAME });
  const { ir, diagnostics: lowerDiags = [] } = lowerToIR(ast, {
    modifierRegistry: createDefaultRegistry(),
    filename: FILENAME,
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

  it('model:true props match (open + query — two models, no Angular CVA)', () => {
    const modelNames = ir.props
      .filter((p: { isModel?: boolean }) => p.isModel)
      .map((p: { name: string }) => p.name);
    expect(sorted(modelNames)).toEqual(sorted(EXPECT.models));
  });

  it('emits surface matches (select)', () => {
    expect(sorted(ir.emits)).toEqual(sorted(EXPECT.emits));
  });

  it('declares the option/empty/footer slots (D-05 re-aligned to listbox vocabulary)', () => {
    const slotNames = ir.slots.map((s: { name: string }) => s.name);
    expect(sorted(slotNames)).toEqual(sorted(EXPECT.slots));
  });

  it('D-07 byte-identity: composes via the STABLE specifier, never the relative form', () => {
    // Encodes the D-07 acceptance check at the source level: the authored file is
    // byte-identical between Option B (vendored) and a future Option A (published).
    // Only the codegen vendor-remap + the D-04 drift guard are B-specific.
    expect(source).toContain(`'${STABLE_LISTBOX_SPECIFIER}'`);
    expect(source).not.toContain(`'${RELATIVE_LISTBOX_SPECIFIER}'`);
  });

  it('expose surface matches (show/close/toggle/focus)', () => {
    const exposeNames = ir.expose.map((e: { name: string }) => e.name);
    expect(sorted(exposeNames)).toEqual(sorted(EXPECT.expose));
  });

  it('the OPEN verb is `show`, not `open` (would collide with the open model)', () => {
    const exposeNames = ir.expose.map((e: { name: string }) => e.name);
    expect(exposeNames).not.toContain('open');
    expect(exposeNames).toContain('show');
  });

  it('no expose-verb collides with the select emit (ROZ121) or a React model setter (ROZ524)', () => {
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
    const r = compile(composedSource, { target, filename: FILENAME });
    const errs = r.diagnostics.filter((d) => d.severity === 'error');
    expect(errs).toEqual([]);
    expect(r.code.length).toBeGreaterThan(0);
  });
});
