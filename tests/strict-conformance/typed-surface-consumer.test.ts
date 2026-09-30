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
});
