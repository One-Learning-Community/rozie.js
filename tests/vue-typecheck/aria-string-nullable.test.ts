/**
 * EB-1 (quick 261019-9g1) — consumer-level vue-tsc strict witness: a nullable
 * String prop bound to any of the 12 plain-string ARIA attributes on an HTML
 * element typechecks in a strict consumer that compiles the emitted `.vue`
 * source. `@vue/runtime-dom` types these slots `string | undefined` (never
 * `| null`), so the emitter drops them with `(expr) ?? undefined`.
 *
 * Also covers the single-binding interpolated form (`aria-label="{{ x }}"`) and the
 * Numberish names aria-colspan / aria-rowspan / aria-posinset / aria-setsize
 * (add-ons B and C).
 *
 * Controls (binary / both-literal ternary / already `|| undefined`) must stay RAW:
 * wrapping any of them would be TS2869 "right operand of ?? is unreachable".
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, symlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));

const NAMES = [
  'aria-controls',
  'aria-describedby',
  'aria-details',
  'aria-errormessage',
  'aria-flowto',
  'aria-keyshortcuts',
  'aria-label',
  'aria-labelledby',
  'aria-owns',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
];

const SRC = `<rozie name="AriaStringNullable">
<props>
{
  label: { type: String, default: null },
  on: { type: Boolean, default: false },
  n: { type: Number, default: null },
}
</props>
<template>
<div>
${NAMES.map((n) => `  <div :${n}="$props.label"></div>`).join('\n')}
  <div aria-label="{{ $props.label }}"></div>
  <div :aria-colspan="$props.n"></div>
  <div :aria-rowspan="$props.n"></div>
  <div :aria-posinset="$props.n"></div>
  <div :aria-setsize="$props.n"></div>
  <div :aria-label="'Item ' + $props.label"></div>
  <div :aria-describedby="$props.on ? 'a' : 'b'"></div>
  <div :aria-labelledby="$props.label || undefined"></div>
</div>
</template>
</rozie>`;

const CONSUMER = `<script setup lang="ts">
import AriaStringNullable from './AriaStringNullable.vue';
</script>
<template>
  <AriaStringNullable label="x" />
</template>
`;

function run(files: Record<string, string>): { ok: boolean; out: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-vue-aria-string-'));
  try {
    copyFileSync(join(HERE, 'tsconfig.consumer.strict.json'), join(tmpDir, 'tsconfig.json'));
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

describe('VUE-ARIA-STRING-NULLABLE — nullable string ARIA bindings typecheck under strict vue-tsc', () => {
  const r0 = compile(SRC, { target: 'vue', filename: 'AriaStringNullable.rozie', sourceMap: false });

  it('compiles without errors', () => {
    expect(r0.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('all 12 nullable bindings plus the RAW controls typecheck (no TS2322, no TS2869)', () => {
    const r = run({ 'AriaStringNullable.vue': r0.code, 'Consumer.vue': CONSUMER });
    expect(r.out, r.out).toBe('');
    expect(r.ok).toBe(true);
  });
});
