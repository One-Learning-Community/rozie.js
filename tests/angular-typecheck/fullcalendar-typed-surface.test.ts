/**
 * ANGULAR-FULLCALENDAR-TYPED-SURFACE — typed public surface phase 1 (Task 18).
 * tsc-checks compile(FullCalendar.rozie) through the leaf's committed barrel
 * (`export * from './FullCalendar'`): every output is `OutputEmitterRef<P>` with
 * the authored payload, the `event` portal-slot template ctx `arg` is
 * `EventContentArg`, handle verbs are typed, and the `<types>` names are
 * importable from the package entry. `@fullcalendar/*` resolves to the REAL
 * engine types (path-mapped to the fullcalendar Angular leaf's node_modules).
 * Negatives are pinned to specific TS codes + messages.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, readFileSync, symlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const LEAF = resolve(ROOT, 'packages/ui/fullcalendar/packages/angular');
const SRC = readFileSync(resolve(ROOT, 'packages/ui/fullcalendar/src/FullCalendar.rozie'), 'utf8');
const BARREL = readFileSync(resolve(LEAF, 'src/index.ts'), 'utf8');

const PRELUDE = `import { FullCalendar, type EventContentArg, type FullCalendarEventPointer, type FullCalendarEventClick, type FullCalendarDatesSet } from './index';
import type { TemplateRef, OutputEmitterRef } from '@angular/core';
declare const c: FullCalendar;
type EventCtx = NonNullable<FullCalendar['eventTpl']> extends TemplateRef<infer C> ? C : never;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
`;

const OK = `${PRELUDE}
c.eventClick.subscribe((p) => { const id: string = p.event.id; p.jsEvent.preventDefault(); const q: FullCalendarEventClick = p; void id; void q; });
c.eventMouseEnter.subscribe((p) => { const x: number = p.jsEvent.clientX; const q: FullCalendarEventPointer = p; void x; void q; });
c.datesSet.subscribe((p) => { const v: string = p.view; void v; });
c.loading.subscribe((p) => { const b: boolean = p.isLoading; void b; });
c.unselect.subscribe((p) => p.jsEvent?.preventDefault());
c.getApi()?.render();
c.gotoDate('2026-01-01');
c.changeView('dayGridMonth');
declare const ctx: EventCtx;
const a: EventContentArg = ctx.arg;
const t: string = ctx.arg.event.title;
const datesSetTyped: Equal<typeof c.datesSet, OutputEmitterRef<FullCalendarDatesSet>> = true;
void a; void t; void datesSetTyped;
`;

const NEGATIVES: Array<{ name: string; body: string; match: RegExp }> = [
  {
    name: 'eventClick payload event ref has no `nope`',
    body: `c.eventClick.subscribe((p) => p.event.nope);`,
    match: /TS2339: Property 'nope' does not exist on type 'FullCalendarEventRef'/,
  },
  {
    name: 'eventClick jsEvent may be a KeyboardEvent (no clientX on the union)',
    body: `c.eventClick.subscribe((p) => p.jsEvent.clientX);`,
    match: /TS2339: Property 'clientX' does not exist on type 'MouseEvent \| KeyboardEvent'/,
  },
  {
    name: 'unselect jsEvent is nullable (programmatic clearSelection)',
    body: `c.unselect.subscribe((p) => p.jsEvent.preventDefault());`,
    match: /TS18047: 'p\.jsEvent' is possibly 'null'/,
  },
  {
    name: 'event slot ctx arg is EventContentArg',
    body: `declare const ctx: EventCtx;\nctx.arg.nope;`,
    match: /TS2339: Property 'nope' does not exist on type 'EventContentArg'/,
  },
  {
    name: 'handle gotoDate() requires its date argument',
    body: `c.gotoDate();`,
    match: /TS2554: Expected 1 arguments, but got 0/,
  },
];

function tsc(files: Record<string, string>): { threw: boolean; output: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-angular-fullcalendar-'));
  try {
    for (const [name, code] of Object.entries(files)) writeFileSync(join(tmpDir, name), code, 'utf8');
    copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.base.json'));
    // Real `@fullcalendar/*` types, resolved from the fullcalendar Angular leaf.
    writeFileSync(
      join(tmpDir, 'tsconfig.json'),
      JSON.stringify({
        extends: './tsconfig.base.json',
        compilerOptions: { paths: { '@fullcalendar/*': [join(LEAF, 'node_modules/@fullcalendar/*')] } },
      }),
    );
    symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
    try {
      execFileSync(resolve(HERE, 'node_modules/.bin/tsc'), ['--noEmit', '-p', 'tsconfig.json'], { cwd: tmpDir, stdio: 'pipe' });
      return { threw: false, output: '' };
    } catch (err) {
      return {
        threw: true,
        output: ((err as { stdout?: Buffer }).stdout?.toString() ?? '') + ((err as { stderr?: Buffer }).stderr?.toString() ?? ''),
      };
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe('ANGULAR-FULLCALENDAR-TYPED-SURFACE — typed outputs, portal-slot ctx, handle, barrel type exports', () => {
  const r0 = compile(SRC, { target: 'angular', filename: 'FullCalendar.rozie', sourceMap: false, angular: { cva: false } });
  // Same strict-gate aid the family codegen applies (scripts/codegen.mjs).
  const ng = r0.code.replace('const opts = {', 'const opts: Record<string, any> = {');

  it('compiles without errors and emits typed outputs', () => {
    expect(r0.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(ng).toMatch(/eventClick = output<FullCalendarEventClick>\(\);/);
  });

  it('typed consumer tsc-checks clean', () => {
    const r = tsc({ 'FullCalendar.ts': ng, 'index.ts': BARREL, 'consumer.ts': OK });
    expect(r.threw, r.output).toBe(false);
  });

  for (const neg of NEGATIVES) {
    it(`negative fails for the right reason: ${neg.name}`, () => {
      const r = tsc({ 'FullCalendar.ts': ng, 'index.ts': BARREL, 'consumer.ts': `${PRELUDE}\n${neg.body}\n` });
      expect(r.threw).toBe(true);
      expect(r.output).toMatch(neg.match);
      expect(r.output).not.toMatch(/TS2304|TS2614|TS2305|TS2307|Cannot find name|has no exported member/);
    });
  }
});
