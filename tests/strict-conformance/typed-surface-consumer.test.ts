/**
 * TYPED-SURFACE-CONSUMER — typed public surface phase 1. A strict consumer of
 * examples/TypedEvents.rozie sees typed emit payloads, typed slot params, a
 * typed `$expose` handle, and can import the `<types>` names. The
 * `@ts-expect-error` lines are the negatives (TS2578 if one stops erroring).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { compile } from '@rozie/core';
import { typecheckCompiled, totalErrors } from './strict-conformance.harness.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURE = readFileSync(resolve(ROOT, 'examples/TypedEvents.rozie'), 'utf8');

const REACT_CONSUMER = `import { useRef } from 'react';
import TypedEvents, { type TypedEventsHandle, type PingPayload, type Count } from './TypedEvents';

export function App() {
  const ref = useRef<TypedEventsHandle>(null);
  const n: number | undefined = ref.current?.getCount();
  ref.current?.jump(3);
  ref.current?.clear('anything');
  // @ts-expect-error — bump takes no arguments
  ref.current?.bump(1);
  const c0: Count = 1;
  void c0;
  void n;
  return (
    <>
      <TypedEvents
        ref={ref}
        tone="info"
        onPing={(p: PingPayload) => p.count.toFixed()}
        onReset={() => {}}
        onSelect={(v) => v.toFixed()}
        onRowOpen={(r) => r.index.toFixed()}
        renderRow={({ count, tone }) => { const c: Count = count; return <span>{c.toFixed()}{tone}</span>; }}
      />
      {/* @ts-expect-error — payload has no 'nope' */}
      <TypedEvents onPing={(p) => p.nope} />
      {/* @ts-expect-error — reset has no payload: a handler requiring an argument is rejected */}
      <TypedEvents onReset={(x: number) => {}} />
      {/* @ts-expect-error — tone is string, not number */}
      <TypedEvents renderRow={({ tone }) => { const x: number = tone; return null; }} />
    </>
  );
}
`;

const SOLID_CONSUMER = `import TypedEvents, { type TypedEventsHandle, type PingPayload, type Count } from './TypedEvents';
let h: TypedEventsHandle | undefined;
export const n: number | undefined = h?.getCount();
h?.jump(3);
h?.clear('anything');
// @ts-expect-error — bump takes no arguments
h?.bump(1);
export const c0: Count = 1;
export const ok = (
  <TypedEvents
    ref={(x) => { h = x; }}
    tone="info"
    onPing={(p: PingPayload) => p.count.toFixed()}
    onReset={() => {}}
    onSelect={(v) => v.toFixed()}
    onRowOpen={(r) => r.index.toFixed()}
    rowSlot={(ctx) => { const c: Count = ctx.count; return <span>{c.toFixed()}{ctx.tone}</span>; }}
  />
);
// @ts-expect-error — payload has no 'nope'
export const bad = <TypedEvents onPing={(p) => p.nope} />;
// @ts-expect-error — reset has no payload: a handler requiring an argument is rejected
export const badReset = <TypedEvents onReset={(x: number) => {}} />;
// @ts-expect-error — tone is string, not number
export const badTone = <TypedEvents rowSlot={(ctx) => { const x: number = ctx.tone; return <span>{x}</span>; }} />;
`;

// Lit: the element class is the consumer surface. Events are typed through the
// generated `Rozie<Name>EventMap` (extends HTMLElementEventMap) via
// `addEventListener` overloads; the scoped slot's ctx is the parameter of the
// `row` render-function property; exposed verbs are public methods.
const LIT_CONSUMER = `import TypedEvents, { type PingPayload, type Count, type RozieTypedEventsEventMap } from './TypedEvents';
declare const el: TypedEvents;
el.addEventListener('ping', (e) => { const p: PingPayload = e.detail; p.count.toFixed(); });
el.addEventListener('select', (e) => e.detail.toFixed());
el.addEventListener('row-open', (e) => e.detail.index.toFixed());
el.addEventListener('click', (e) => e.clientX.toFixed());
el.addEventListener('reset', (e) => { const d: undefined = e.detail; void d; });
el.addEventListener('reset', () => {});
el.removeEventListener('ping', (e) => { e.detail.count.toFixed(); });
// @ts-expect-error — reset has no payload: its detail is undefined
el.addEventListener('reset', (e) => e.detail.toFixed());
const n: number = el.getCount();
el.getCount().toFixed();
el.jump(3);
el.clear('anything');
// @ts-expect-error — bump takes no arguments
el.bump(1);
// @ts-expect-error — payload has no 'nope'
el.addEventListener('ping', (e) => e.detail.nope);
type K = keyof RozieTypedEventsEventMap;
const k: K = 'reset';
const c0: Count = 1;
type RowCtx = Parameters<NonNullable<TypedEvents['row']>>[0];
declare const ctx: RowCtx;
const sc: Count = ctx.count;
const st: string = ctx.tone;
// @ts-expect-error — tone is string, not number
const bad: number = ctx.tone;
el.row = ({ count, tone }) => count.toFixed() + tone;
void n; void k; void c0; void sc; void st; void bad;
`;

// Lit DOM-name collisions (R14): `<emits>` names whose HTMLElementEventMap type
// is NOT plain `Event` (`click` → PointerEvent, `toggle` → ToggleEvent). The
// event map must Omit them (no TS2430 in the compiled module), the consumer
// sees the declared CustomEvent, and undeclared DOM events stay inherited.
// Also covers `$expose` verbs that are FIELD ARROWS (typed + untyped fallback).
const LIT_DOM_EVENTS_FIXTURE = `<rozie name="DomEvents">
<emits>
{
  click: { payload: 'number' },
  toggle: {},
}
</emits>
<script>
function fire() {
  $emit('click', 1)
  $emit('toggle')
}
const reset2 = () => {
  fire()
}
const loose = (...a) => a.length
$expose({ fire, reset2, loose }, { reset2: '() => void' })
</script>
<template>
  <button @click="fire()">x</button>
</template>
</rozie>
`;

const LIT_DOM_EVENTS_CONSUMER = `import DomEvents, { type RozieDomEventsEventMap } from './DomEvents';
declare const el: DomEvents;
el.addEventListener('click', (e) => e.detail.toFixed());
// @ts-expect-error — click is the declared CustomEvent<number>, not a PointerEvent
el.addEventListener('click', (e) => e.clientX);
el.addEventListener('toggle', (e) => { const d: undefined = e.detail; void d; });
el.addEventListener('keydown', (e) => e.key.toUpperCase());
el.reset2();
// @ts-expect-error — reset2 takes no arguments
el.reset2(1);
el.loose('anything', 2);
el.fire('anything');
const kk: keyof RozieDomEventsEventMap = 'keydown';
void kk;
`;

describe('TYPED-SURFACE-CONSUMER — strict consumer (typed-surface P1)', () => {
  it('react', () => {
    const { code, diagnostics } = compile(FIXTURE, {
      target: 'react',
      filename: 'TypedEvents.rozie',
      sourceMap: false,
    });
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const { raw, inventory } = typecheckCompiled({
      target: 'react',
      files: { 'TypedEvents.tsx': code, 'Consumer.tsx': REACT_CONSUMER },
      nodeModulesFrom: 'packages/ui/combobox/packages/react',
    });
    expect(totalErrors(inventory), raw).toBe(0);
  });

  it('solid', () => {
    const { code, diagnostics } = compile(FIXTURE, {
      target: 'solid',
      filename: 'TypedEvents.rozie',
      sourceMap: false,
    });
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const { raw, inventory } = typecheckCompiled({
      target: 'solid',
      files: { 'TypedEvents.tsx': code, 'Consumer.tsx': SOLID_CONSUMER },
      nodeModulesFrom: 'packages/ui/combobox/packages/solid',
    });
    expect(totalErrors(inventory), raw).toBe(0);
  });
  it('lit', () => {
    const { code, diagnostics } = compile(FIXTURE, {
      target: 'lit',
      filename: 'TypedEvents.rozie',
      sourceMap: false,
    });
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const { raw, inventory } = typecheckCompiled({
      target: 'lit',
      files: { 'TypedEvents.ts': code, 'Consumer.ts': LIT_CONSUMER },
      nodeModulesFrom: 'packages/ui/combobox/packages/lit',
    });
    expect(totalErrors(inventory), raw).toBe(0);
  });
  it('lit — DOM-name collisions (click/toggle) + field-arrow exposed verbs', () => {
    const { code, diagnostics } = compile(LIT_DOM_EVENTS_FIXTURE, {
      target: 'lit',
      filename: 'DomEvents.rozie',
      sourceMap: false,
    });
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    // Field-arrow verbs carry the signature annotation / the untyped fallback.
    expect(code).toContain('reset2: () => void = () => {');
    expect(code).toContain('loose: (...args: any[]) => any = ');
    const { raw, inventory } = typecheckCompiled({
      target: 'lit',
      files: { 'DomEvents.ts': code, 'Consumer.ts': LIT_DOM_EVENTS_CONSUMER },
      nodeModulesFrom: 'packages/ui/combobox/packages/lit',
    });
    expect(totalErrors(inventory), raw).toBe(0);
  });
});
