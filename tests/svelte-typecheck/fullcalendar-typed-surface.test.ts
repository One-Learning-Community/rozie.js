/**
 * SVELTE-FULLCALENDAR-TYPED-SURFACE — typed public surface phase 1 (Task 18).
 * svelte-checks compile(FullCalendar.rozie): `oneventclick` / `ondatesset` /
 * `onloading` payloads are typed, the `event` portal-slot snippet `arg` is
 * `EventContentArg`, handle verbs are typed, and the `<types>` names are
 * importable from the component module (the Svelte leaf's package entry).
 * `@fullcalendar/*` resolves to the REAL engine types here (path-mapped to the
 * fullcalendar Svelte leaf's node_modules) — the harness-wide
 * engine-modules.d.ts `any` stub is not in this temp project. Negatives are
 * pinned to the specific svelte-check message. (The harness tsconfig has
 * strictNullChecks off, so the nullable-`unselect.jsEvent` negative lives in
 * the strict harnesses.)
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
const LEAF = resolve(ROOT, 'packages/ui/fullcalendar/packages/svelte');
const SRC = readFileSync(resolve(ROOT, 'packages/ui/fullcalendar/src/FullCalendar.rozie'), 'utf8');

const IMPORTS = `import FullCalendar, { type EventContentArg, type FullCalendarEventPointer } from './FullCalendar.svelte';`;

const OK = `<script lang="ts">
  ${IMPORTS}
  let inst: ReturnType<typeof FullCalendar> | undefined = $state();
  inst?.getApi()?.render();
  inst?.gotoDate('2026-01-01');
  inst?.changeView('dayGridMonth');
  const onClick = (p: FullCalendarEventPointer) => { const id: string = p.event.id; p.jsEvent.preventDefault(); void id; };
</script>

<FullCalendar
  bind:this={inst}
  oneventclick={onClick}
  ondatesset={(p) => { const v: string = p.view; void v; }}
  onloading={(p) => { const b: boolean = p.isLoading; void b; }}
>
  {#snippet event({ arg })}{(arg satisfies EventContentArg).event.title}{/snippet}
</FullCalendar>
`;

const NEGATIVES: Array<{ name: string; markup: string; script?: string; match: RegExp }> = [
  {
    name: 'eventClick payload event ref has no `nope`',
    markup: `<FullCalendar oneventclick={(p) => p.event.nope} />`,
    match: /Property 'nope' does not exist on type 'FullCalendarEventRef'/,
  },
  {
    name: 'event snippet arg is EventContentArg',
    markup: `<FullCalendar>{#snippet event({ arg })}{arg.nope}{/snippet}</FullCalendar>`,
    match: /Property 'nope' does not exist on type 'EventContentArg'/,
  },
  {
    name: 'handle gotoDate() requires its date argument',
    script: `let inst: ReturnType<typeof FullCalendar> | undefined = $state();\n  inst?.gotoDate();`,
    markup: `<FullCalendar bind:this={inst} />`,
    match: /Expected 1 arguments, but got 0/,
  },
];

function svelteCheck(files: Record<string, string>): { threw: boolean; output: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-svelte-fullcalendar-'));
  try {
    for (const [name, code] of Object.entries(files)) writeFileSync(join(tmpDir, name), code, 'utf8');
    copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.base.json'));
    writeFileSync(
      join(tmpDir, 'tsconfig.json'),
      JSON.stringify({
        extends: './tsconfig.base.json',
        compilerOptions: { paths: { '@fullcalendar/*': [join(LEAF, 'node_modules/@fullcalendar/*')] } },
      }),
    );
    symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
    try {
      execFileSync(resolve(HERE, 'node_modules/.bin/svelte-check'), ['--tsconfig', './tsconfig.json', '--threshold', 'error', '--output', 'human'], { cwd: tmpDir, stdio: 'pipe' });
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

describe('SVELTE-FULLCALENDAR-TYPED-SURFACE — typed payloads, portal-slot arg, handle, module type exports', () => {
  const r0 = compile(SRC, { target: 'svelte', filename: 'FullCalendar.rozie', sourceMap: false });
  const svelte = r0.code;

  it('compiles without errors', () => {
    expect(r0.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('typed consumer is svelte-check clean', () => {
    const r = svelteCheck({ 'FullCalendar.svelte': svelte, 'Consumer.svelte': OK });
    expect(r.threw, r.output).toBe(false);
  });

  for (const neg of NEGATIVES) {
    it(`negative fails for the right reason: ${neg.name}`, () => {
      const consumer = `<script lang="ts">\n  ${IMPORTS}\n  void (null as EventContentArg | FullCalendarEventPointer | null);\n  ${neg.script ?? ''}\n</script>\n\n${neg.markup}\n`;
      const r = svelteCheck({ 'FullCalendar.svelte': svelte, 'Consumer.svelte': consumer });
      expect(r.threw).toBe(true);
      expect(r.output).toMatch(neg.match);
      expect(r.output).not.toMatch(/TS2304|TS2614|TS2307|Cannot find name|has no exported member|Cannot find module/);
    });
  }
});
