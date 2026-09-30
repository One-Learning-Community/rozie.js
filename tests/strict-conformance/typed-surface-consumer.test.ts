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
});
