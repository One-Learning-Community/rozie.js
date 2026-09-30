/**
 * VUE-TYPED-SURFACE — typed public surface phase 1 (Task 11).
 *
 * Compiles examples/TypedEvents.rozie to a Vue SFC, then vue-tsc-checks:
 *   - the component itself (TypedEvents.vue — `<types>` names used by the
 *     payload / slot types must resolve across the module `<script lang="ts">`
 *     and `<script setup>` blocks, no TS2304), and
 *   - a strict typed consumer (payloads, no-payload event, slot ctx, handle,
 *     importable `<types>` names) with @ts-expect-error negatives.
 * Plus separate expected-fail runs with matched messages (no vacuous passes).
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

const CONSUMER = `<script setup lang="ts">
import { ref } from 'vue';
import TypedEvents, { type PingPayload, type Count, type TypedEventsHandle } from './TypedEvents.vue';
const h = ref<TypedEventsHandle | null>(null);
const n: number | undefined = h.value?.getCount();
// @ts-expect-error — bump takes no arguments
h.value?.bump(1);
h.value?.jump(3);
h.value?.clear('anything');
function onPing(p: PingPayload) { return p.count.toFixed(); }
// @ts-expect-error — payload has no 'nope'
function bad(p: PingPayload) { return p.nope; }
const c0: Count = 1;
void n; void bad; void c0; void onPing;
</script>
<template>
  <TypedEvents ref="h" tone="info" @ping="onPing" @reset="() => {}" @select="(v) => v.toFixed()" @row-open="(r) => r.index.toFixed()">
    <template #row="{ count, tone }">{{ count.toFixed() }}{{ tone }}{{ (count satisfies Count) }}</template>
  </TypedEvents>
</template>
`;

// Each negative must fail for the RIGHT reason: matched against vue-tsc output.
const NEGATIVES: Array<{ name: string; template: string; match: RegExp }> = [
  {
    name: 'payload field that does not exist',
    template: `<TypedEvents @ping="(p) => p.nope" />`,
    match: /nope/,
  },
  {
    name: 'no-payload event handler requiring an argument',
    template: `<TypedEvents @reset="(x: number) => x" />`,
    match: /reset|not assignable|number/i,
  },
  {
    name: 'slot tone (string) assigned to number',
    template: `<TypedEvents><template #row="{ tone }">{{ (tone as string) satisfies number }}</template></TypedEvents>`,
    match: /string.*number|number.*string/i,
  },
];

function run(files: Record<string, string>): { ok: boolean; out: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-vue-typed-'));
  try {
    copyFileSync(join(HERE, 'tsconfig.consumer.strict.json'), join(tmpDir, 'tsconfig.json'));
    symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
    for (const [name, body] of Object.entries(files)) writeFileSync(join(tmpDir, name), body, 'utf8');
    try {
      execFileSync(resolve(HERE, 'node_modules/.bin/vue-tsc'), ['--noEmit', '-p', 'tsconfig.json'], {
        cwd: tmpDir,
        stdio: 'pipe',
      });
      return { ok: true, out: '' };
    } catch (err) {
      const e = err as { stdout?: Buffer; stderr?: Buffer };
      return { ok: false, out: (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '') };
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function compileTypedEvents(): string {
  const source = readFileSync(resolve(ROOT, 'examples/TypedEvents.rozie'), 'utf8');
  const result = compile(source, { target: 'vue', filename: 'TypedEvents.rozie', sourceMap: false });
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return result.code;
}

describe('VUE-TYPED-SURFACE — typed emits / <types> module block / typed handle', () => {
  const vue = compileTypedEvents();

  it('the component itself vue-tsc-checks clean (no TS2304 for <types> names)', () => {
    const r = run({ 'TypedEvents.vue': vue });
    expect(r.out).not.toMatch(/TS2304/);
    expect(r.out).toBe('');
    expect(r.ok).toBe(true);
  });

  it('strict typed consumer (payload, no-payload, slot ctx, handle, <types> names) is clean', () => {
    const r = run({ 'TypedEvents.vue': vue, 'Consumer.vue': CONSUMER });
    expect(r.out).toBe('');
    expect(r.ok).toBe(true);
  });

  for (const neg of NEGATIVES) {
    it(`negative fails for the right reason: ${neg.name}`, () => {
      const consumer = `<script setup lang="ts">\nimport TypedEvents from './TypedEvents.vue';\nvoid TypedEvents;\n</script>\n<template>\n  ${neg.template}\n</template>\n`;
      const r = run({ 'TypedEvents.vue': vue, 'Consumer.vue': consumer });
      expect(r.ok).toBe(false);
      expect(r.out).toMatch(neg.match);
      expect(r.out).not.toMatch(/TS2304|TS2614/);
    });
  }
});
