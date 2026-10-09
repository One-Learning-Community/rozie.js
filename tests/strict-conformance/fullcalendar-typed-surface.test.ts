/**
 * FULLCALENDAR-TYPED-SURFACE — typed public surface phase 1 (Task 18, second adopter).
 *
 * `compile(FullCalendar.rozie)` for react/solid/lit, then a strict consumer
 * (importing through the leaf's committed barrel `src/index.ts`, so the barrel's
 * type re-exports are proven too) sees:
 *   - typed event payloads (`eventClick` → FullCalendarEventPointer, `datesSet`
 *     view string, `loading` boolean, `unselect` jsEvent nullable),
 *   - the `event` portal-slot `arg` typed `EventContentArg` (real
 *     `@fullcalendar/core` types, resolved from the leaf's node_modules),
 *   - typed handle verbs (`getApi()?.render()`, `gotoDate('2026-01-01')`),
 *   - `allDay: boolean` read on the eventDrop / eventResize event refs (`event` and
 *     `oldEvent`) with no getApi() lookup (261008-mmw).
 * Negatives are `@ts-expect-error` (TS2578 if one stops erroring) AND a separate
 * run of each negative WITHOUT the directive pins the specific TS error.
 * (vue / svelte / angular live in their own harness dirs.)
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { compile } from '@rozie/core';
import { typecheckCompiled, totalErrors } from './strict-conformance.harness.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FC = resolve(ROOT, 'packages/ui/fullcalendar');
const SRC = readFileSync(resolve(FC, 'src/FullCalendar.rozie'), 'utf8');

function compiled(target: 'react' | 'solid' | 'lit'): string {
  const r = compile(SRC, { target, filename: 'FullCalendar.rozie', sourceMap: false });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  // No post-emit type aid: the source builds its engine options with the
  // null-let idiom (typeNeutralize → `any`), as the published leaf does.
  return r.code;
}

/** The committed leaf barrel — consumers import the package entry, not the module. */
const barrel = (target: string): string => readFileSync(resolve(FC, 'packages', target, 'src/index.ts'), 'utf8');

const REACT_PRELUDE = `import { useRef } from 'react';
import FullCalendar, { type FullCalendarHandle, type EventContentArg, type FullCalendarEventPointer, type FullCalendarEventClick } from './index';
const h = useRef<FullCalendarHandle>(null);
`;
const REACT_OK = `${REACT_PRELUDE}
h.current?.getApi()?.render();
h.current?.gotoDate('2026-01-01');
h.current?.changeView('dayGridMonth');
const d: Date | null | undefined = h.current?.getDate();
void d;
export const ok = (
  <FullCalendar
    ref={h}
    onEventClick={(p) => { const id: string = p.event.id; p.jsEvent.preventDefault(); const q: FullCalendarEventClick = p; void id; void q; }}
    onEventMouseEnter={(p) => { const x: number = p.jsEvent.clientX; const q: FullCalendarEventPointer = p; void x; void q; }}
    onDatesSet={(p) => { const v: string = p.view; void v; }}
    onLoading={(p) => { const b: boolean = p.isLoading; void b; }}
    onEventDrop={(p) => { const a: boolean = p.event.allDay; const b: boolean = p.oldEvent.allDay; void a; void b; }}
    onEventResize={(p) => { const a: boolean = p.event.allDay; const b: boolean = p.oldEvent.allDay; void a; void b; }}
    onUnselect={(p) => { p.jsEvent?.preventDefault(); }}
    renderEvent={({ arg }) => { const a: EventContentArg = arg; return arg.event.title + a.timeText; }}
  />
);
`;
const REACT_NEG = {
  keyboard: { line: `export const bad = <FullCalendar onEventClick={(p) => p.jsEvent.clientX} />;`, match: /TS2339: Property 'clientX' does not exist on type 'MouseEvent \| KeyboardEvent'/ },
  payload: { line: `export const bad = <FullCalendar onEventClick={(p) => p.event.nope} />;`, match: /TS2339: Property 'nope' does not exist on type 'FullCalendarEventRef'/ },
  nullable: { line: `export const bad = <FullCalendar onUnselect={(p) => p.jsEvent.preventDefault()} />;`, match: /TS18047: 'p\.jsEvent' is possibly 'null'/ },
  slot: { line: `export const bad = <FullCalendar renderEvent={({ arg }) => arg.nope} />;`, match: /TS2339: Property 'nope' does not exist on type 'EventContentArg'/ },
  verb: { line: `h.current?.gotoDate();`, match: /TS2554: Expected 1 arguments, but got 0/ },
};

const SOLID_PRELUDE = `import FullCalendar, { type FullCalendarHandle, type EventContentArg, type FullCalendarEventPointer, type FullCalendarEventClick } from './index';
let h: FullCalendarHandle | undefined;
`;
const SOLID_OK = `${SOLID_PRELUDE}
h?.getApi()?.render();
h?.gotoDate('2026-01-01');
h?.changeView('dayGridMonth');
export const ok = (
  <FullCalendar
    ref={(x) => { h = x; }}
    onEventClick={(p) => { const id: string = p.event.id; p.jsEvent.preventDefault(); const q: FullCalendarEventClick = p; void id; void q; }}
    onEventMouseEnter={(p) => { const x: number = p.jsEvent.clientX; const q: FullCalendarEventPointer = p; void x; void q; }}
    onDatesSet={(p) => { const v: string = p.view; void v; }}
    onLoading={(p) => { const b: boolean = p.isLoading; void b; }}
    onEventDrop={(p) => { const a: boolean = p.event.allDay; const b: boolean = p.oldEvent.allDay; void a; void b; }}
    onEventResize={(p) => { const a: boolean = p.event.allDay; const b: boolean = p.oldEvent.allDay; void a; void b; }}
    onUnselect={(p) => { p.jsEvent?.preventDefault(); }}
    eventSlot={({ arg }) => { const a: EventContentArg = arg; return <span>{arg.event.title + a.timeText}</span>; }}
  />
);
`;
const SOLID_NEG = {
  keyboard: { line: `export const bad = <FullCalendar onEventClick={(p) => p.jsEvent.clientX} />;`, match: /TS2339: Property 'clientX' does not exist on type 'MouseEvent \| KeyboardEvent'/ },
  payload: { line: `export const bad = <FullCalendar onEventClick={(p) => p.event.nope} />;`, match: /TS2339: Property 'nope' does not exist on type 'FullCalendarEventRef'/ },
  nullable: { line: `export const bad = <FullCalendar onUnselect={(p) => p.jsEvent.preventDefault()} />;`, match: /TS18047: 'p\.jsEvent' is possibly 'null'/ },
  slot: { line: `export const bad = <FullCalendar eventSlot={({ arg }) => <span>{arg.nope}</span>} />;`, match: /TS2339: Property 'nope' does not exist on type 'EventContentArg'/ },
  verb: { line: `h?.gotoDate();`, match: /TS2554: Expected 1 arguments, but got 0/ },
};

const LIT_PRELUDE = `import FullCalendar, { type EventContentArg, type FullCalendarEventPointer, type FullCalendarEventClick, type RozieFullCalendarEventMap } from './index';
declare const el: FullCalendar;
`;
const LIT_OK = `${LIT_PRELUDE}
el.addEventListener('event-click', (e) => { const id: string = e.detail.event.id; e.detail.jsEvent.preventDefault(); const q: FullCalendarEventClick = e.detail; void id; void q; });
el.addEventListener('event-mouse-enter', (e) => { const x: number = e.detail.jsEvent.clientX; const q: FullCalendarEventPointer = e.detail; void x; void q; });
el.addEventListener('dates-set', (e) => { const v: string = e.detail.view; void v; });
el.addEventListener('loading', (e) => { const b: boolean = e.detail.isLoading; void b; });
el.addEventListener('event-drop', (e) => { const a: boolean = e.detail.event.allDay; const b: boolean = e.detail.oldEvent.allDay; void a; void b; });
el.addEventListener('event-resize', (e) => { const a: boolean = e.detail.event.allDay; const b: boolean = e.detail.oldEvent.allDay; void a; void b; });
el.addEventListener('unselect', (e) => { e.detail.jsEvent?.preventDefault(); });
el.addEventListener('click', (e) => e.clientX.toFixed());
const sel: RozieFullCalendarEventMap['select'] = new CustomEvent('select', { detail: { start: new Date(), end: new Date(), startStr: '', endStr: '', allDay: true } });
void sel;
el.getApi()?.render();
el.gotoDate('2026-01-01');
el.changeView('dayGridMonth');
el.event = ({ arg }) => { const a: EventContentArg = arg; return arg.event.title + a.timeText; };
`;
const LIT_NEG = {
  keyboard: { line: `el.addEventListener('event-click', (e) => e.detail.jsEvent.clientX);`, match: /TS2339: Property 'clientX' does not exist on type 'MouseEvent \| KeyboardEvent'/ },
  payload: { line: `el.addEventListener('event-click', (e) => e.detail.event.nope);`, match: /TS2339: Property 'nope' does not exist on type 'FullCalendarEventRef'/ },
  nullable: { line: `el.addEventListener('unselect', (e) => e.detail.jsEvent.preventDefault());`, match: /TS18047: 'e\.detail\.jsEvent' is possibly 'null'/ },
  slot: { line: `el.event = ({ arg }) => arg.nope;`, match: /TS2339: Property 'nope' does not exist on type 'EventContentArg'/ },
  verb: { line: `el.gotoDate();`, match: /TS2554: Expected 1 arguments, but got 0/ },
};

/** Mark a negative statement with @ts-expect-error (all negatives are top-level statements). */
const expectErr = (line: string) => `// @ts-expect-error — negative\n${line}`;

const CASES = [
  { target: 'react' as const, file: 'FullCalendar.tsx', consumer: 'Consumer.tsx', ok: REACT_OK, neg: REACT_NEG },
  { target: 'solid' as const, file: 'FullCalendar.tsx', consumer: 'Consumer.tsx', ok: SOLID_OK, neg: SOLID_NEG },
  { target: 'lit' as const, file: 'FullCalendar.ts', consumer: 'Consumer.ts', ok: LIT_OK, neg: LIT_NEG },
];

describe('FULLCALENDAR-TYPED-SURFACE — typed payloads, portal-slot arg, handle; barrel re-exports (react/solid/lit)', () => {
  for (const c of CASES) {
    describe(c.target, () => {
      const code = compiled(c.target);
      const index = barrel(c.target);
      const run = (consumerSrc: string) =>
        typecheckCompiled({
          target: c.target,
          files: { [c.file]: code, 'index.ts': index, [c.consumer]: consumerSrc },
          nodeModulesFrom: `packages/ui/fullcalendar/packages/${c.target}`,
        });

      it('strict consumer with @ts-expect-error negatives is clean', () => {
        const withNegs =
          c.ok + '\n' + Object.values(c.neg).map((n, i) => expectErr(n.line).replace(/\bbad\b/, `bad${i}`)).join('\n') + '\n';
        const { raw, inventory } = run(withNegs);
        expect(totalErrors(inventory), raw).toBe(0);
      });

      for (const [name, neg] of Object.entries(c.neg)) {
        it(`negative (${name}) fails for the right reason when the directive is removed`, () => {
          const { raw, inventory } = run(`${c.ok}\n${neg.line.replace(/\bbad\b/, 'badX')}\n`);
          expect(totalErrors(inventory)).toBeGreaterThan(0);
          expect(raw).toMatch(neg.match);
          expect(raw).not.toMatch(/TS2304|TS2305|TS2614|Cannot find name/);
        });
      }
    });
  }
});
