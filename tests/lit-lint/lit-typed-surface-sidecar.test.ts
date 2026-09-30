/**
 * LIT-TYPED-SURFACE-SIDECAR — typed-surface phase 1. The Lit `.d.rozie.ts`
 * sidecar (`emitLitTypes`) must carry the same typed public surface the
 * compiled module declares: the `<types>` names, the exported
 * `Rozie<Name>EventMap` (extends HTMLElementEventMap), typed
 * `addEventListener`/`removeEventListener` overloads on the `declare class`,
 * and typed `$expose` verbs. Strict `tsc` over a consumer of the sidecar.
 * The `@ts-expect-error` lines are the negatives (TS2578 if one stops erroring).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, symlinkSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parse, lowerToIR, createDefaultRegistry } from '@rozie/core';
import { emitLitTypes } from '@rozie/target-lit';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

const CONSUMER_TS = `import TypedEvents, { type PingPayload, type Count, type RozieTypedEventsEventMap } from './TypedEvents';
declare const el: TypedEvents;
el.addEventListener('ping', (e) => { const p: PingPayload = e.detail; p.count.toFixed(); });
el.addEventListener('select', (e) => e.detail.toFixed());
el.addEventListener('row-open', (e) => e.detail.index.toFixed());
el.addEventListener('click', (e) => e.clientX.toFixed());
el.addEventListener('reset', (e) => { const d: undefined = e.detail; void d; });
el.removeEventListener('ping', (e) => { e.detail.count.toFixed(); });
// @ts-expect-error — reset has no payload: its detail is undefined
el.addEventListener('reset', (e) => e.detail.toFixed());
// @ts-expect-error — payload has no 'nope'
el.addEventListener('ping', (e) => e.detail.nope);
const n: number = el.getCount();
el.jump(3);
el.clear('anything');
// @ts-expect-error — bump takes no arguments
el.bump(1);
const k: keyof RozieTypedEventsEventMap = 'row-open';
const c0: Count = 1;
const q = document.querySelector('rozie-typed-events');
q?.addEventListener('select', (e) => e.detail.toFixed());
void n; void k; void c0;
`;

describe('LIT-TYPED-SURFACE-SIDECAR — .d.rozie.ts consumer sees the typed public surface (typed-surface P1)', () => {
  it('Consumer.ts typechecks clean (strict) against the sidecar; negatives stay errors', () => {
    const src = readFileSync(resolve(ROOT, 'examples/TypedEvents.rozie'), 'utf8');
    const { ast } = parse(src, { filename: 'TypedEvents.rozie' });
    if (!ast) throw new Error('parse() returned null for TypedEvents.rozie');
    const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
    if (!ir) throw new Error('lowerToIR() returned null for TypedEvents.rozie');
    const dts = emitLitTypes(ir);

    // Fixture premise guard — fail loud rather than green-by-accident.
    expect(dts).toMatch(/export declare class TypedEvents extends LitElement/);

    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-lit-typed-surface-sidecar-'));
    try {
      writeFileSync(join(tmpDir, 'TypedEvents.d.ts'), dts, 'utf8');
      writeFileSync(join(tmpDir, 'Consumer.ts'), CONSUMER_TS, 'utf8');
      writeFileSync(
        join(tmpDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'Bundler',
            strict: true,
            exactOptionalPropertyTypes: true,
            noEmit: true,
            skipLibCheck: true,
            lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          },
          include: ['*.ts'],
        }),
        'utf8',
      );
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');

      const tscBin = resolve(HERE, 'node_modules/.bin/tsc');
      try {
        execFileSync(tscBin, ['--noEmit', '-p', 'tsconfig.json'], { cwd: tmpDir, stdio: 'pipe' });
      } catch (err) {
        const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
        const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
        throw new Error(
          'tsc --noEmit exited non-zero for the Lit typed-surface sidecar consumer:\n' + stdout + '\n' + stderr,
        );
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
