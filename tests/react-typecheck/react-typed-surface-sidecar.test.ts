/**
 * REACT-TYPED-SURFACE-SIDECAR — typed-surface phase 1. The React `.d.ts`
 * sidecar (`emitReactTypes`) carries typed emit handlers, slot params, the
 * typed `$expose` handle (via forwardRef) and the `<types>` names.
 * `@ts-expect-error` lines are the negatives (TS2578 if one stops erroring).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, symlinkSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parse, lowerToIR, createDefaultRegistry } from '@rozie/core';
import { emitReactTypes } from '@rozie/target-react';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

const CONSUMER_TSX = `import { useRef } from 'react';
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

describe('REACT-TYPED-SURFACE-SIDECAR — .d.ts consumer sees the typed public surface (typed-surface P1)', () => {
  it('Consumer.tsx typechecks clean against the sidecar; negatives stay errors', () => {
    const src = readFileSync(resolve(ROOT, 'examples/TypedEvents.rozie'), 'utf8');
    const { ast } = parse(src, { filename: 'TypedEvents.rozie' });
    if (!ast) throw new Error('parse() returned null for TypedEvents.rozie');
    const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
    if (!ir) throw new Error('lowerToIR() returned null for TypedEvents.rozie');
    const dts = emitReactTypes(ir);
    expect(dts).toMatch(/export interface TypedEventsProps/);

    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-react-typed-surface-sidecar-'));
    try {
      writeFileSync(join(tmpDir, 'TypedEvents.d.ts'), dts, 'utf8');
      writeFileSync(join(tmpDir, 'Consumer.tsx'), CONSUMER_TSX, 'utf8');
      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');

      const tscBin = resolve(HERE, 'node_modules/.bin/tsc');
      try {
        execFileSync(tscBin, ['--noEmit', '-p', 'tsconfig.json'], { cwd: tmpDir, stdio: 'pipe' });
      } catch (err) {
        const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
        const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
        throw new Error('tsc --noEmit exited non-zero for the React typed-surface sidecar consumer:\n' + stdout + '\n' + stderr);
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
