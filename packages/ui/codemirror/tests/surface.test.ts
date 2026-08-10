/**
 * surface.test.ts — the CodeMirror.rozie surface gate as a vitest test (so it
 * runs under `turbo run test`). Prior to this suite the family had NO test
 * directory at all and `vitest run --passWithNoTests` silently passed with zero
 * assertions (AUDIT.md finding D7S-08).
 *
 * Re-asserts the SAME contract a standalone compile-check would:
 *   1. lowerToIR() emits ZERO error-severity diagnostics.
 *   2. The IR surface (name / props / model props / emits / slots + portal-
 *      reactive flags / expose) matches the SPEC contract exactly — 10 props,
 *      ZERO emits (D-08: the model:value path is the only change channel), 5
 *      slots (panel/topPanel mount-once, tooltip reactive, gutter/decoration
 *      reactive multi-instance), 12 expose verbs.
 *   3. Every `ir.expose` name has a `handleManifest` entry AND every
 *      `handleManifest` key is in `ir.expose` — codegen.mjs's own assert is
 *      one-directional (source → manifest); this closes the reverse direction
 *      so an orphaned manifest key (one that no longer matches a real expose
 *      verb) fails loudly instead of silently documenting a verb that no
 *      longer exists.
 *   4. compile()×6 emits ZERO error-severity diagnostics + non-empty code.
 *   5. NO model-prop == emit-name collision (there IS no emit surface at all,
 *      so this is vacuously true, but pinned explicitly per the family
 *      convention — the MapLibre zoom/pitch lesson).
 *
 * Pure GLUE over the @rozie/core public API — no compiler/emitter/IR change.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { handleManifest } from '../scripts/handle-manifest.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src', 'CodeMirror.rozie');
const FILENAME = 'CodeMirror.rozie';
const source = readFileSync(SRC, 'utf8');

const EXPECT = {
  name: 'CodeMirror',
  props: [
    'value', 'language', 'theme', 'readOnly', 'height', 'placeholder',
    'extensions', 'basicSetup', 'gutterLines', 'decorations',
  ],
  // `value` is the ONLY model:true prop (D-08 — the sole change channel).
  models: ['value'],
  // Zero events by design (D-08): the updateListener → $model.value path is the
  // only change channel. No $emit call anywhere in the source.
  emits: [] as string[],
  slots: ['panel', 'topPanel', 'tooltip', 'gutter', 'decoration'],
  expose: [
    'getView', 'focus', 'getValue', 'replaceValue', 'dispatch', 'insertText',
    'getSelection', 'setSelection', 'undo', 'redo', 'selectAll', 'scrollToPos',
  ],
} as const;

const sorted = (a: readonly string[]) => [...a].sort();

describe('CodeMirror.rozie surface gate', () => {
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

  it('props surface matches (10 props)', () => {
    const propNames = ir.props.map((p: { name: string }) => p.name);
    expect(sorted(propNames)).toEqual(sorted(EXPECT.props));
  });

  it('model:true props match (value only)', () => {
    const modelNames = ir.props
      .filter((p: { isModel?: boolean }) => p.isModel)
      .map((p: { name: string }) => p.name);
    expect(sorted(modelNames)).toEqual(sorted(EXPECT.models));
  });

  it('emits surface is empty (D-08 — no events, model:value is the sole channel)', () => {
    expect(ir.emits).toEqual(EXPECT.emits);
  });

  it('slot surface matches (5 portal slots)', () => {
    const slotNames = ir.slots.map((s: { name: string }) => s.name);
    expect(sorted(slotNames)).toEqual(sorted(EXPECT.slots));
  });

  it('panel + topPanel are mount-once portal slots (not reactive)', () => {
    for (const name of ['panel', 'topPanel']) {
      const slot = ir.slots.find((s: { name: string }) => s.name === name) as
        | { isPortal?: boolean; isReactive?: boolean }
        | undefined;
      expect(slot?.isPortal, `${name} should be a portal slot`).toBe(true);
      expect(slot?.isReactive, `${name} should NOT be reactive`).toBeFalsy();
    }
  });

  it('tooltip is a REACTIVE portal slot', () => {
    const slot = ir.slots.find((s: { name: string }) => s.name === 'tooltip') as
      | { isPortal?: boolean; isReactive?: boolean }
      | undefined;
    expect(slot?.isPortal, 'tooltip should be a portal slot').toBe(true);
    expect(slot?.isReactive, 'tooltip should be REACTIVE').toBe(true);
  });

  it('gutter + decoration are REACTIVE portal slots (multi-instance)', () => {
    for (const name of ['gutter', 'decoration']) {
      const slot = ir.slots.find((s: { name: string }) => s.name === name) as
        | { isPortal?: boolean; isReactive?: boolean }
        | undefined;
      expect(slot?.isPortal, `${name} should be a portal slot`).toBe(true);
      expect(slot?.isReactive, `${name} should be REACTIVE`).toBe(true);
    }
  });

  it('expose surface matches (12 verbs)', () => {
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

  it('no model-prop == emit-name collision (Vue defineModel vs defineEmits, Angular ModelSignal vs OutputEmitterRef)', () => {
    const models = new Set<string>(EXPECT.models);
    const clash = ir.emits.filter((e: string) => models.has(e));
    expect(clash).toEqual([]);
  });

  const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const;
  it.each(TARGETS)('compile(%s) emits zero error diagnostics + non-empty code', (target) => {
    const r = compile(source, { target, filename: FILENAME });
    const errs = r.diagnostics.filter((d) => d.severity === 'error');
    expect(errs).toEqual([]);
    expect(r.code.length).toBeGreaterThan(0);
  });
});
