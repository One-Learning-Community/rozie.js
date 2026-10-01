/**
 * VUE-POPOVER-TYPED-SURFACE — typed public surface phase 1 (Task 17).
 * vue-tsc-checks compile(Popover.rozie): `@change` payload is boolean, the
 * `anchor` slot ctx is typed, handle verbs are typed. Negatives are pinned to
 * the specific vue-tsc message (no vacuous passes).
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
const SRC = readFileSync(resolve(ROOT, 'packages/ui/popover/src/Popover.rozie'), 'utf8');

function stubInternals(code: string): string {
  return code
    .replace(
      /^import \{[^}]*\} from '@floating-ui\/dom';$/m,
      'const computePosition: any = undefined, autoUpdate: any = undefined, offsetMiddleware: any = undefined, flip: any = undefined, shift: any = undefined, arrowMiddleware: any = undefined, size: any = undefined;',
    )
    .replace(/^import \{ buildMiddleware \} from '\.\/internal\/middleware';$/m, 'const buildMiddleware: any = undefined;');
}

const OK = `<script setup lang="ts">
import { ref } from 'vue';
import Popover, { type PopoverHandle } from './Popover.vue';
const h = ref<PopoverHandle | null>(null);
h.value?.show();
h.value?.hide();
h.value?.toggle();
h.value?.reposition();
</script>
<template>
  <Popover ref="h" @change="(open) => { const b: boolean = open; void b; }">
    <template #anchor="{ open, toggle, show, hide }">{{ (open satisfies boolean) }}{{ void toggle() }}{{ void show() }}{{ void hide() }}</template>
  </Popover>
</template>
`;

const NEGATIVES: Array<{ name: string; script?: string; template: string; match: RegExp }> = [
  {
    name: 'change payload is boolean, not number-like',
    template: `<Popover @change="(open) => open.toFixed()" />`,
    match: /Property 'toFixed' does not exist on type 'boolean'/,
  },
  {
    name: 'anchor slot open is boolean',
    template: `<Popover><template #anchor="{ open }">{{ open.toFixed() }}</template></Popover>`,
    match: /Property 'toFixed' does not exist on type 'boolean'/,
  },
  {
    name: 'handle show() takes no arguments',
    script: `const h = ref<PopoverHandle | null>(null);\nh.value?.show(1);`,
    template: `<Popover ref="h" />`,
    match: /Expected 0 arguments, but got 1/,
  },
];

function run(files: Record<string, string>): { ok: boolean; out: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-vue-popover-'));
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

describe('VUE-POPOVER-TYPED-SURFACE — change: boolean, typed anchor ctx, typed handle', () => {
  const r0 = compile(SRC, { target: 'vue', filename: 'Popover.rozie', sourceMap: false });
  const vue = stubInternals(r0.code);

  it('compiles without errors', () => {
    expect(r0.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('strict typed consumer is clean', () => {
    const r = run({ 'Popover.vue': vue, 'Consumer.vue': OK });
    expect(r.out).toBe('');
    expect(r.ok).toBe(true);
  });

  for (const neg of NEGATIVES) {
    it(`negative fails for the right reason: ${neg.name}`, () => {
      const consumer = `<script setup lang="ts">\nimport { ref } from 'vue';\nimport Popover, { type PopoverHandle } from './Popover.vue';\nvoid ref; void Popover;\nvoid (null as PopoverHandle | null);\n${neg.script ?? ''}\n</script>\n<template>\n  ${neg.template}\n</template>\n`;
      const r = run({ 'Popover.vue': vue, 'Consumer.vue': consumer });
      expect(r.ok).toBe(false);
      expect(r.out).toMatch(neg.match);
      expect(r.out).not.toMatch(/TS2304|TS2614/);
    });
  }
});
