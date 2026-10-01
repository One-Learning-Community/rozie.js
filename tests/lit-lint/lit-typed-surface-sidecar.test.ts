/**
 * LIT-TYPED-SURFACE-SIDECAR — typed-surface phase 1. The Lit `.d.rozie.ts`
 * sidecar (`emitLitTypes`) must carry the same typed public surface the
 * compiled module declares: the `<types>` names, the exported
 * `Rozie<Name>EventMap` (extends `Omit<HTMLElementEventMap, <declared names>>`,
 * R14), typed
 * `addEventListener`/`removeEventListener` overloads on the `declare class`,
 * and typed `$expose` verbs. Strict `tsc` over a consumer of the sidecar.
 * The `@ts-expect-error` lines are the negatives (TS2578 if one stops erroring).
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { emitLitTypes } from '@rozie/target-lit';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

const CONSUMER_TS = `import TypedEvents, { type PingPayload, type Count, type RozieTypedEventsEventMap, type TypedEventsProps } from './TypedEvents';
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
// Scoped slot \`row\`: the same receiver property the compiled class declares.
type RowCtx = Parameters<NonNullable<TypedEvents['row']>>[0];
declare const ctx: RowCtx;
const sc: Count = ctx.count;
const st: string = ctx.tone;
// @ts-expect-error — tone is string, not number
const badTone: number = ctx.tone;
el.row = ({ count, tone }) => count.toFixed() + tone;
type PropsRow = NonNullable<TypedEventsProps['row']>;
const pr: PropsRow = (scope) => scope.count.toFixed();
// Lit events are DOM CustomEvents, never on<Event> props.
// @ts-expect-error — no onPing prop on the Lit surface
const np: TypedEventsProps['onPing'] = undefined;
void n; void k; void c0; void sc; void st; void badTone; void pr; void np;
`;

// R14 — `<emits>` names colliding with non-`Event` DOM map entries.
const DOM_EVENTS_FIXTURE = `<rozie name="DomEvents">
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
$expose({ fire })
</script>
<template>
  <button @click="fire()">x</button>
</template>
</rozie>
`;

const DOM_EVENTS_CONSUMER_TS = `import DomEvents, { type RozieDomEventsEventMap } from './DomEvents';
declare const el: DomEvents;
el.addEventListener('click', (e) => e.detail.toFixed());
// @ts-expect-error — click is the declared CustomEvent<number>, not a PointerEvent
el.addEventListener('click', (e) => e.clientX);
el.addEventListener('toggle', (e) => { const d: undefined = e.detail; void d; });
el.addEventListener('keydown', (e) => e.key.toUpperCase());
const kk: keyof RozieDomEventsEventMap = 'keydown';
void kk;
`;

function sidecarFor(source: string, filename: string): string {
  const { ast } = parse(source, { filename });
  if (!ast) throw new Error(`parse() returned null for ${filename}`);
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error(`lowerToIR() returned null for ${filename}`);
  return emitLitTypes(ir);
}

/** Strict `tsc --noEmit` over `{ '<Name>.d.ts': sidecar, 'Consumer.ts': consumer }`. */
function typecheckSidecar(name: string, dts: string, consumer: string): void {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-lit-typed-surface-sidecar-'));
  try {
    writeFileSync(join(tmpDir, `${name}.d.ts`), dts, 'utf8');
    writeFileSync(join(tmpDir, 'Consumer.ts'), consumer, 'utf8');
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
          skipLibCheck: false,
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        },
        include: ['*.ts'],
      }),
      'utf8',
    );
    symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
    try {
      execFileSync(resolve(HERE, 'node_modules/.bin/tsc'), ['--noEmit', '-p', 'tsconfig.json'], {
        cwd: tmpDir,
        stdio: 'pipe',
      });
    } catch (err) {
      const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
      const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
      throw new Error(
        `tsc --noEmit exited non-zero for the Lit ${name} sidecar consumer:\n${stdout}\n${stderr}`,
      );
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe('LIT-TYPED-SURFACE-SIDECAR — .d.rozie.ts consumer sees the typed public surface (typed-surface P1)', () => {
  it('Consumer.ts typechecks clean (strict) against the sidecar; negatives stay errors', () => {
    const dts = sidecarFor(
      readFileSync(resolve(ROOT, 'examples/TypedEvents.rozie'), 'utf8'),
      'TypedEvents.rozie',
    );
    // Fixture premise guard — fail loud rather than green-by-accident.
    expect(dts).toMatch(/export declare class TypedEvents extends LitElement/);
    typecheckSidecar('TypedEvents', dts, CONSUMER_TS);
  });

  it('DOM-name collisions (click/toggle): the sidecar event map Omits them (no TS2430)', () => {
    typecheckSidecar(
      'DomEvents',
      sidecarFor(DOM_EVENTS_FIXTURE, 'DomEvents.rozie'),
      DOM_EVENTS_CONSUMER_TS,
    );
  });
});
