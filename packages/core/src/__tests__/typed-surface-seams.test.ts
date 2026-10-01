import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import _generate from '@babel/generator';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import { renderPropsInterface } from '../codegen/renderPropsInterface.js';
import { synthesizeHandleType } from '../codegen/synthesizeHandleType.js';
import { renderTypesBlock, typesExportedNames } from '../codegen/renderTypesBlock.js';
import { exposeSignatureOverload, exposeSignatureMethodOverload, exposeSignatureAnnotation } from '../codegen/exposeSignatures.js';
import { parseAuthoredType } from '../codegen/renderAuthoredType.js';
import * as t from '@babel/types';
import { lowerSlotParamType } from '../codegen/slotParamTypeLowering.js';
import { renderEmitHandlerType } from '../codegen/renderPropsInterface.js';

const gen = (typeof _generate === 'function' ? _generate : (_generate as any).default) as typeof _generate;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const ir = (s: string) => lowerToIR(parse(s, { filename: 'P.rozie' }).ast!, { modifierRegistry: createDefaultRegistry() }).ir!;
const TYPED = readFileSync(resolve(ROOT, 'examples/TypedEvents.rozie'), 'utf8');

describe('typed-surface shared seams', () => {
  it('sidecar: typed handlers, typed slot ctx, <types> prelude', () => {
    const out = renderPropsInterface(ir(TYPED), { slotChildrenType: 'ReactNode', target: 'react', includeTypesBlock: true });
    expect(out).toContain('export interface PingPayload');
    expect(out).toContain('onPing?: (payload: PingPayload) => void;');
    expect(out).toContain('onReset?: () => void;');
    expect(out).toMatch(/renderRow\?: \(params: \{ count: Count; tone: string \}\)/);
  });
  it('handle: typed verbs use the signature, untyped keep (...args: any[]) => any', () => {
    const h = synthesizeHandleType(ir(TYPED), 'TypedEventsHandle')!;
    expect(h).toContain('getCount: () => number;');
    expect(h).toContain('clear: (...args: any[]) => any;');
  });
  it('renderTypesBlock / typesExportedNames', () => {
    const r = ir(TYPED);
    expect(renderTypesBlock(r)).toContain('export type Count');
    expect(typesExportedNames(r)).toEqual(['Count', 'PingPayload']);
    expect(renderTypesBlock(ir('<rozie name="N"><template><div></div></template></rozie>'))).toBe('');
  });
  it('expose overload/annotation builders print valid TS', () => {
    const sig = parseAuthoredType('(date: DateInput, opts?: { x: number }) => void');
    if ('error' in sig || !t.isTSFunctionType(sig.type)) throw new Error('bad');
    expect(gen(exposeSignatureOverload('gotoDate', sig.type)).code).toBe('function gotoDate(date: DateInput, opts?: {\n  x: number;\n}): void;');
    expect(gen(t.classBody([exposeSignatureMethodOverload('gotoDate', sig.type)])).code).toContain('gotoDate(date: DateInput');
    // A bare TSTypeAnnotation cannot be printed standalone by @babel/generator
    // (it prints only inside its owner) — assert it in its real placement, an
    // Angular-style class field.
    expect(gen(t.classProperty(t.identifier('gotoDate'), null, exposeSignatureAnnotation(sig.type))).code).toBe('gotoDate: (date: DateInput, opts?: {\n  x: number;\n}) => void;');
  });
  it('byte-identity: a component with nothing declared renders exactly as before', () => {
    const plain = readFileSync(resolve(ROOT, 'examples/Dropdown.rozie'), 'utf8');
    const before = renderPropsInterface(ir(plain), { slotChildrenType: 'ReactNode', target: 'react' });
    const after = renderPropsInterface(ir(plain), { slotChildrenType: 'ReactNode', target: 'react', includeTypesBlock: true });
    expect(after).toBe(before);
  });
  it('lowerSlotParamType: authored prints verbatim; unauthored function types keep the variadic floor', () => {
    const fn = parseAuthoredType('(x: number) => void');
    const str = parseAuthoredType('string');
    if ('error' in fn || 'error' in str) throw new Error('bad');
    expect(lowerSlotParamType(undefined)).toBe('any');
    expect(lowerSlotParamType(undefined, true)).toBe('any');
    expect(lowerSlotParamType(fn.type)).toBe('(...args: any[]) => any');
    expect(lowerSlotParamType(str.type)).toBe('any');
    expect(lowerSlotParamType(fn.type, true)).toBe('(x: number) => void');
    expect(lowerSlotParamType(str.type, true)).toBe('string');
  });
  it('lowerSlots marks :param-types slots as authored', () => {
    const row = ir(TYPED).slots.find((s) => s.name === 'row')!;
    expect(row.paramTypesAuthored).toBe(true);
  });
  it('renderEmitHandlerType', () => {
    const num = parseAuthoredType('number');
    if ('error' in num) throw new Error('bad');
    const loc = { start: 0, end: 0 };
    expect(renderEmitHandlerType(undefined)).toBe('(...args: any[]) => void');
    expect(renderEmitHandlerType({ name: 'r', payload: null, docs: null, sourceLoc: loc })).toBe('() => void');
    expect(renderEmitHandlerType({ name: 's', payload: num.type, docs: null, sourceLoc: loc })).toBe('(payload: number) => void');
  });
});

/**
 * Portal slots with `:param-types` (Task 18, FullCalendar): the producer-side
 * `$portals.<name>(container, scope)` method must take the AUTHORED scope type,
 * or passing `scope` into the typed slot fn fails strict tsc (TS2345
 * `{ arg: unknown }` → `{ arg: EventContentArg }`). Unauthored portal slots keep
 * `{ arg: unknown }` byte-identically.
 */
describe('typed-surface: portal-slot scope type', () => {
  const PORTAL = `<rozie name="P">
<types>
export interface Cell { day: number }
</types>
<script>
$onMount(() => {
  const a = $portals.typed(document.body, { arg: 1 })
  const b = $portals.plain(document.body, { arg: 2 })
  return () => { a(); b() }
})
</script>
<template>
<div />
<slot name="typed" portal :params="['arg']" :param-types="{ arg: 'Cell' }" />
<slot name="plain" portal :params="['arg']" />
</template>
</rozie>`;
  for (const target of ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const) {
    it(`${target}: typed portal scope is the authored type; untyped stays unknown`, async () => {
      const { compile } = await import('../compile.js');
      const r = compile(PORTAL, { target, filename: 'P.rozie', sourceMap: false });
      expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      expect(r.code).toMatch(/typed: \(container: HTMLElement, scope: \{ arg: Cell \}\)/);
      expect(r.code).toMatch(/plain: \(container: HTMLElement, scope: \{ arg: unknown \}\)/);
    });
  }
});

/**
 * A comment BETWEEN two `<types>` statements is attached by Babel both as the
 * previous statement's trailing comment and the next one's leading comment;
 * generating each statement separately printed it twice (Task 18: FullCalendar's
 * JSDoc on `FullCalendarUnselect` doubled in every leaf).
 */
describe('typed-surface: renderTypesBlock comment fidelity', () => {
  it('a JSDoc between statements renders exactly once; leading + final trailing comments survive', () => {
    const src = `<rozie name="C">
<types>
// header
export interface A { a: number }
/** Doc for B. */
export interface B { b: number }
export type Z = A | B // trailing
</types>
<template><div /></template>
</rozie>`;
    const out = renderTypesBlock(ir(src));
    expect(out.split('/** Doc for B. */').length - 1).toBe(1);
    expect(out.split('// header').length - 1).toBe(1);
    expect(out.split('// trailing').length - 1).toBe(1);
  });
});
