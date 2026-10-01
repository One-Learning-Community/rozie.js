/**
 * ANGULAR-TYPED-SURFACE — typed public surface phase 1 (Task 13).
 *
 * Compiles examples/TypedEvents.rozie to an Angular standalone component and
 * `tsc --noEmit`s it:
 *   - the component itself (`<types>` names at module top resolve, no TS2304;
 *     the untyped rest-arg `jump(...a)` implementation is accepted by the typed
 *     `(to: number) => void` class-property annotation, no TS2322/TS2394), and
 *   - a typed consumer (payloads, no-payload event, slot ctx, handle, importable
 *     `<types>` names), plus separate expected-fail runs pinned to TS codes.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, readFileSync, symlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { emitAngularTypes } from '@rozie/target-angular';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const SRC = readFileSync(resolve(ROOT, 'examples/TypedEvents.rozie'), 'utf8');

const PRELUDE = `import { TypedEvents, type PingPayload, type Count } from './TypedEvents';
import type { TemplateRef, OutputEmitterRef } from '@angular/core';
declare const c: TypedEvents;
type RowCtx = NonNullable<TypedEvents['rowTpl']> extends TemplateRef<infer C> ? C : never;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
`;

const CONSUMER = `${PRELUDE}
c.ping.subscribe((p: PingPayload) => p.count.toFixed());
c.select.subscribe((v) => v.toFixed());
c.rowOpen.subscribe((r) => r.index.toFixed());
c.reset.subscribe(() => {});
const n: number = c.getCount();
c.getCount().toFixed();
c.jump(3);
c.clear('anything');
const c0: Count = 1;
declare const ctx: RowCtx;
const k: Count = ctx.count;
const tone: string = ctx.tone;
const resetIsVoid: Equal<typeof c.reset, OutputEmitterRef<void>> = true;
const pingIsTyped: Equal<typeof c.ping, OutputEmitterRef<PingPayload>> = true;
void n; void c0; void k; void tone; void resetIsVoid; void pingIsTyped;
`;

// Each negative must fail for the RIGHT reason: a specific TS code + message.
const NEGATIVES: Array<{ name: string; body: string; match: RegExp }> = [
  {
    name: 'payload field that does not exist',
    body: `c.ping.subscribe((p) => p.nope);`,
    match: /TS2339: Property 'nope' does not exist on type 'PingPayload'/,
  },
  {
    name: 'no-payload event subscriber requiring an argument',
    body: `c.reset.subscribe((x: number) => x);`,
    match: /TS2345: Argument of type '\(x: number\) => number' is not assignable to parameter of type '\(value: void\) => void'/,
  },
  {
    name: 'slot tone (string) assigned to number',
    body: `declare const ctx: RowCtx;\nconst bad: number = ctx.tone;`,
    match: /TS2322: Type 'string' is not assignable to type 'number'/,
  },
  {
    name: 'handle bump() takes no arguments',
    body: `c.bump(1);`,
    match: /TS2554: Expected 0 arguments, but got 1/,
  },
  {
    name: 'handle jump() requires a number',
    body: `c.jump('x');`,
    match: /TS2345: Argument of type 'string' is not assignable to parameter of type 'number'/,
  },
  {
    name: 'handle getCount() returns number, not string',
    body: `const s: string = c.getCount();`,
    match: /TS2322: Type 'number' is not assignable to type 'string'/,
  },
];

function tsc(files: Record<string, string>): { threw: boolean; output: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-angular-typed-'));
  try {
    for (const [name, code] of Object.entries(files)) writeFileSync(join(tmpDir, name), code, 'utf8');
    copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
    symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
    try {
      execFileSync(resolve(HERE, 'node_modules/.bin/tsc'), ['--noEmit', '-p', 'tsconfig.json'], {
        cwd: tmpDir,
        stdio: 'pipe',
      });
      return { threw: false, output: '' };
    } catch (err) {
      return {
        threw: true,
        output:
          ((err as { stdout?: Buffer }).stdout?.toString() ?? '') +
          ((err as { stderr?: Buffer }).stderr?.toString() ?? ''),
      };
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function compiled(): string {
  const result = compile(SRC, { target: 'angular', filename: 'TypedEvents.rozie', sourceMap: false });
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return result.code;
}

describe('ANGULAR-TYPED-SURFACE — typed outputs / <types> at module top / typed handle', () => {
  const ng = compiled();

  it('emits typed outputs, <types> above @Component, and annotated handle members', () => {
    expect(ng).toMatch(/ping = output<PingPayload>\(\);/);
    expect(ng).toMatch(/reset = output<void>\(\);/);
    expect(ng).toMatch(/select = output<number>\(\);/);
    expect(ng).toMatch(/rowOpen = output<\{\s*index: number;?\s*\}>\(\{ alias: 'row-open' \}\);/);
    expect(ng.indexOf('export interface PingPayload')).toBeGreaterThanOrEqual(0);
    expect(ng.indexOf('export interface PingPayload')).toBeLessThan(ng.indexOf('@Component'));
    expect(ng).toMatch(/jump: \(to: number\) => void = \(\.\.\.a: any\[\]\) =>/);
    expect(ng).toMatch(/clear: \(\.\.\.args: any\[\]\) => any = \(\) =>/);
    expect(ng).not.toMatch(/import\.meta\.url/);
  });

  it('the component itself tsc-checks clean (no TS2304 for <types> names, no TS2322/TS2394 for jump)', () => {
    const r = tsc({ 'TypedEvents.ts': ng });
    expect(r.output).not.toMatch(/TS2304|Cannot find name/);
    expect(r.output).not.toMatch(/TS2394|TS2322/);
    expect(r.threw, r.output).toBe(false);
  });

  it('typed consumer (payload, no-payload, slot ctx, handle, <types> names) tsc-checks clean', () => {
    const r = tsc({ 'TypedEvents.ts': ng, 'consumer.ts': CONSUMER });
    expect(r.threw, r.output).toBe(false);
  });

  for (const neg of NEGATIVES) {
    it(`negative fails for the right reason: ${neg.name}`, () => {
      const r = tsc({ 'TypedEvents.ts': ng, 'consumer.ts': `${PRELUDE}\n${neg.body}\n` });
      expect(r.threw).toBe(true);
      expect(r.output).toMatch(neg.match);
      expect(r.output).not.toMatch(/TS2304|TS2614|TS2305|Cannot find name|has no exported member/);
    });
  }

  it('sidecar: .d.rozie.ts exports <types> and types the handle', () => {
    const { ast } = parse(SRC, { filename: 'TypedEvents.rozie' });
    if (!ast) throw new Error('parse() null');
    const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
    if (!ir) throw new Error('lowerToIR() null');
    const dts = emitAngularTypes(ir);
    expect(dts).toMatch(/export interface PingPayload/);
    // M5 (final wave): events are outputs on Angular, not `on<Event>` props —
    // the declared class carries them typed, and the Props interface does not.
    expect(dts).not.toMatch(/\bon(Ping|Reset|Select|RowOpen)\??:/);
    const consumer = `import { TypedEvents, type PingPayload, type Count } from './TypedEventsSidecar';
declare const c: TypedEvents;
c.ping.subscribe((p) => { const q: PingPayload = p; q.count.toFixed(); });
c.reset.subscribe(() => {});
c.select.subscribe((v) => v.toFixed());
c.rowOpen.subscribe((r) => r.index.toFixed());
// @ts-expect-error — payload has no 'nope'
c.ping.subscribe((p) => p.nope);
const n: number = c.getCount();
c.jump(3);
c.clear('anything');
const c0: Count = 1;
const p: PingPayload = { count: 1, label: 'x' };
// @ts-expect-error — bump takes no arguments
c.bump(1);
void n; void c0; void p;
`;
    const r = tsc({ 'TypedEventsSidecar.d.ts': dts, 'consumer.ts': consumer });
    expect(r.threw, r.output).toBe(false);
  });
});
