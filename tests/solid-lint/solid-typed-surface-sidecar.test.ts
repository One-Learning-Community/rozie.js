/**
 * SOLID-TYPED-SURFACE-SIDECAR — typed-surface phase 1. The Solid `.d.rozie.ts`
 * sidecar (`emitSolidTypes`) carries typed emit handlers, and the
 * `<types>` names. (Slot params: NOT covered here — the shared sidecar names
 * the slot prop `renderRow` while the compiled module names it `rowSlot`, a
 * pre-existing Solid sidecar/inline mismatch; slot ctx types are proven in
 * tests/strict-conformance.) (The handle is exercised via the compiled-module consumer
 * in tests/strict-conformance: Solid's `ref` is `unknown` on every component.)
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, symlinkSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parse, lowerToIR, createDefaultRegistry } from '@rozie/core';
import { emitSolidTypes } from '@rozie/target-solid';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

const CONSUMER_TSX = `import TypedEvents, { type PingPayload, type Count } from './TypedEvents';

export const c0: Count = 1;
export const ok = (
  <TypedEvents
    tone="info"
    onPing={(p: PingPayload) => p.count.toFixed()}
    onReset={() => {}}
    onSelect={(v) => v.toFixed()}
    onRowOpen={(r) => r.index.toFixed()}
  />
);
// @ts-expect-error — payload has no 'nope'
export const bad = <TypedEvents onPing={(p) => p.nope} />;
// @ts-expect-error — reset has no payload: a handler requiring an argument is rejected
export const badReset = <TypedEvents onReset={(x: number) => {}} />;
`;

describe('SOLID-TYPED-SURFACE-SIDECAR — .d.ts consumer sees the typed public surface (typed-surface P1)', () => {
  it('Consumer.tsx typechecks clean against the sidecar; negatives stay errors', () => {
    const src = readFileSync(resolve(ROOT, 'examples/TypedEvents.rozie'), 'utf8');
    const { ast } = parse(src, { filename: 'TypedEvents.rozie' });
    if (!ast) throw new Error('parse() returned null for TypedEvents.rozie');
    const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
    if (!ir) throw new Error('lowerToIR() returned null for TypedEvents.rozie');
    const dts = emitSolidTypes(ir);

    // Fixture premise guard — fail loud rather than green-by-accident.
    expect(dts).toMatch(/export interface TypedEventsProps/);

    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-solid-typed-surface-sidecar-'));
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
        throw new Error(
          'tsc --noEmit exited non-zero for the Solid typed-surface sidecar consumer:\n' + stdout + '\n' + stderr,
        );
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
