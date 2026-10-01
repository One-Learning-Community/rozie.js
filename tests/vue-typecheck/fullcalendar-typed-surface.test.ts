/**
 * VUE-FULLCALENDAR-TYPED-SURFACE — typed public surface phase 1 (Task 18).
 * vue-tsc-checks compile(FullCalendar.rozie) through the leaf's committed barrel
 * (`src/index.ts`): `@event-click` / `@dates-set` / `@loading` / `@unselect`
 * payloads are typed, the `event` portal-slot `arg` is `EventContentArg`, handle
 * verbs are typed, and the `<types>` names + `FullCalendarHandle` are importable
 * from the package entry. `@fullcalendar/*` resolves to the REAL engine types
 * (path-mapped to the fullcalendar Vue leaf's node_modules). Negatives are pinned
 * to the specific vue-tsc message (no vacuous passes).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, symlinkSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const LEAF = resolve(ROOT, 'packages/ui/fullcalendar/packages/vue');
const SRC = readFileSync(resolve(ROOT, 'packages/ui/fullcalendar/src/FullCalendar.rozie'), 'utf8');
const BARREL = readFileSync(resolve(LEAF, 'src/index.ts'), 'utf8');

const IMPORTS = `import { ref } from 'vue';
import { FullCalendar, type FullCalendarHandle, type EventContentArg, type FullCalendarEventPointer } from './index';`;

const OK = `<script setup lang="ts">
${IMPORTS}
const h = ref<FullCalendarHandle | null>(null);
h.value?.getApi()?.render();
h.value?.gotoDate('2026-01-01');
h.value?.changeView('dayGridMonth');
const onClick = (p: FullCalendarEventPointer) => { const id: string = p.event.id; p.jsEvent.preventDefault(); void id; };
</script>
<template>
  <FullCalendar
    ref="h"
    @event-click="onClick"
    @dates-set="(p) => { const v: string = p.view; void v; }"
    @loading="(p) => { const b: boolean = p.isLoading; void b; }"
    @unselect="(p) => p.jsEvent?.preventDefault()"
  >
    <template #event="{ arg }">{{ (arg satisfies EventContentArg).event.title }}</template>
  </FullCalendar>
</template>
`;

const NEGATIVES: Array<{ name: string; script?: string; template: string; match: RegExp }> = [
  {
    name: 'eventClick payload event ref has no `nope`',
    template: `<FullCalendar @event-click="(p) => p.event.nope" />`,
    match: /Property 'nope' does not exist on type 'FullCalendarEventRef'/,
  },
  {
    name: 'unselect jsEvent is nullable (programmatic clearSelection)',
    template: `<FullCalendar @unselect="(p) => p.jsEvent.preventDefault()" />`,
    match: /'p\.jsEvent' is possibly 'null'/,
  },
  {
    name: 'event slot arg is EventContentArg',
    template: `<FullCalendar><template #event="{ arg }">{{ arg.nope }}</template></FullCalendar>`,
    match: /Property 'nope' does not exist on type 'EventContentArg'/,
  },
  {
    name: 'handle gotoDate() requires its date argument',
    script: `const h = ref<FullCalendarHandle | null>(null);\nh.value?.gotoDate();`,
    template: `<FullCalendar ref="h" />`,
    match: /Expected 1 arguments, but got 0/,
  },
];

function run(files: Record<string, string>): { ok: boolean; out: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-vue-fullcalendar-'));
  try {
    copyFileSync(join(HERE, 'tsconfig.consumer.strict.json'), join(tmpDir, 'tsconfig.base.json'));
    // Real `@fullcalendar/*` types, resolved from the fullcalendar Vue leaf.
    writeFileSync(
      join(tmpDir, 'tsconfig.json'),
      JSON.stringify({
        extends: './tsconfig.base.json',
        compilerOptions: { paths: { '@fullcalendar/*': [join(LEAF, 'node_modules/@fullcalendar/*')] } },
      }),
    );
    symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
    for (const [name, body] of Object.entries(files)) writeFileSync(join(tmpDir, name), body, 'utf8');
    try {
      execFileSync(resolve(HERE, 'node_modules/.bin/vue-tsc'), ['--noEmit', '-p', 'tsconfig.json'], { cwd: tmpDir, stdio: 'pipe' });
      return { ok: true, out: '' };
    } catch (err) {
      const e = err as { stdout?: Buffer; stderr?: Buffer };
      return { ok: false, out: (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '') };
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe('VUE-FULLCALENDAR-TYPED-SURFACE — typed payloads, portal-slot arg, handle, barrel type exports', () => {
  const r0 = compile(SRC, { target: 'vue', filename: 'FullCalendar.rozie', sourceMap: false });
  // Same strict-gate aid the family codegen applies (scripts/codegen.mjs).
  const vue = r0.code.replace('const opts = {', 'const opts: Record<string, any> = {');

  it('compiles without errors', () => {
    expect(r0.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('strict typed consumer (importing through the barrel) is clean', () => {
    const r = run({ 'FullCalendar.vue': vue, 'index.ts': BARREL, 'Consumer.vue': OK });
    expect(r.out).toBe('');
    expect(r.ok).toBe(true);
  });

  for (const neg of NEGATIVES) {
    it(`negative fails for the right reason: ${neg.name}`, () => {
      const consumer = `<script setup lang="ts">\n${IMPORTS}\nvoid ref; void FullCalendar;\nvoid (null as FullCalendarHandle | EventContentArg | FullCalendarEventPointer | null);\n${neg.script ?? ''}\n</script>\n<template>\n  ${neg.template}\n</template>\n`;
      const r = run({ 'FullCalendar.vue': vue, 'index.ts': BARREL, 'Consumer.vue': consumer });
      expect(r.ok).toBe(false);
      expect(r.out).toMatch(neg.match);
      expect(r.out).not.toMatch(/TS2304|TS2614|TS2305|TS2307/);
    });
  }
});
