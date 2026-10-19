/**
 * VUE-PAGINATION-TYPED-SURFACE — the Vue half of the consumer-side typed-surface
 * gate (quick 261018-vdu). vue-tsc-checks compile(Pagination.rozie) under the
 * strict consumer tsconfig: the `change` payload is `PaginationChangePayload`,
 * `update:modelValue` is a number, the four scoped slots' params are typed, and
 * the handle verbs are typed. Negatives are pinned to the specific vue-tsc
 * message (no vacuous passes).
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
const SRC = readFileSync(resolve(ROOT, 'packages/ui/pagination/src/Pagination.rozie'), 'utf8');
const HELPER = readFileSync(resolve(ROOT, 'packages/ui/pagination/src/internal/paginationItems.ts'), 'utf8');

/** Flatten the one vendored-helper import so the real helper typechecks too. */
const flatten = (code: string) => code.replace("'./internal/paginationItems'", "'./paginationItems'");

const OK = `<script setup lang="ts">
import { ref } from 'vue';
import Pagination, { type PaginationHandle, type PaginationChangePayload } from './Pagination.vue';
const h = ref<PaginationHandle | null>(null);
h.value?.goto(3);
h.value?.next();
h.value?.prev();
h.value?.first();
h.value?.last();
const page = ref(1);
function onChange(p: PaginationChangePayload) { const n: number = p.page; void n; }
</script>
<template>
  <Pagination
    ref="h"
    v-model:modelValue="page"
    :total="195"
    :pageSize="10"
    :siblingCount="2"
    :boundaryCount="1"
    :disabled="false"
    ariaLabel="Pages"
    class="c"
    @change="onChange"
    @update:modelValue="(n) => { const v: number = n; void v; }"
  >
    <template #item="{ page: p, selected, goto }">{{ ((p + 1) satisfies number) }}{{ (selected satisfies boolean) }}{{ void goto() }}</template>
    <template #ellipsis="{ index }">{{ ((index + 1) satisfies number) }}</template>
    <template #prevControl="{ disabled, goto, page: p }">{{ (disabled satisfies boolean) }}{{ ((p + 1) satisfies number) }}{{ void goto() }}</template>
    <template #nextControl="{ disabled, goto, page: p }">{{ (disabled satisfies boolean) }}{{ ((p + 1) satisfies number) }}{{ void goto() }}</template>
  </Pagination>
</template>
`;

const NEGATIVES: Array<{ name: string; script?: string; template: string; match: RegExp }> = [
  {
    name: 'change payload page is a number',
    template: `<Pagination @change="(p) => p.page.toUpperCase()" />`,
    match: /Property 'toUpperCase' does not exist on type 'number'/,
  },
  {
    name: 'update:modelValue payload is a number',
    template: `<Pagination @update:modelValue="(n) => n.toUpperCase()" />`,
    match: /Property 'toUpperCase' does not exist on type 'number'/,
  },
  {
    name: 'item slot page is a number',
    template: `<Pagination><template #item="{ page }">{{ page.toUpperCase() }}</template></Pagination>`,
    match: /Property 'toUpperCase' does not exist on type 'number'/,
  },
  {
    name: 'item slot goto takes no arguments',
    template: `<Pagination><template #item="{ goto }">{{ goto(1) }}</template></Pagination>`,
    match: /Expected 0 arguments, but got 1/,
  },
  {
    name: 'handle goto() takes a number',
    script: `const h = ref<PaginationHandle | null>(null);\nh.value?.goto('3');`,
    template: `<Pagination ref="h" />`,
    match: /Argument of type 'string' is not assignable to parameter of type 'number'/,
  },
  {
    name: 'handle next() takes no arguments',
    script: `const h = ref<PaginationHandle | null>(null);\nh.value?.next(1);`,
    template: `<Pagination ref="h" />`,
    match: /Expected 0 arguments, but got 1/,
  },
];

function run(files: Record<string, string>): { ok: boolean; out: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-vue-pagination-'));
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

describe('VUE-PAGINATION-TYPED-SURFACE — typed change payload, slot params, typed handle', () => {
  const r0 = compile(SRC, { target: 'vue', filename: 'Pagination.rozie', sourceMap: false });
  const vue = flatten(r0.code);
  const files = (consumer: string) => ({ 'Pagination.vue': vue, 'paginationItems.ts': HELPER, 'Consumer.vue': consumer });

  it('compiles without errors', () => {
    expect(r0.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('strict typed consumer is clean', () => {
    const r = run(files(OK));
    expect(r.out).toBe('');
    expect(r.ok).toBe(true);
  });

  for (const neg of NEGATIVES) {
    it(`negative fails for the right reason: ${neg.name}`, () => {
      const consumer = `<script setup lang="ts">\nimport { ref } from 'vue';\nimport Pagination, { type PaginationHandle } from './Pagination.vue';\nvoid ref; void Pagination;\nvoid (null as PaginationHandle | null);\n${neg.script ?? ''}\n</script>\n<template>\n  ${neg.template}\n</template>\n`;
      const r = run(files(consumer));
      expect(r.ok).toBe(false);
      expect(r.out).toMatch(neg.match);
      expect(r.out).not.toMatch(/TS2304|TS2614/);
    });
  }

  it('barrel parity: Pagination and its public types are importable from the leaf barrel (src/index.ts)', () => {
    const barrel = readFileSync(resolve(ROOT, 'packages/ui/pagination/packages/vue/src/index.ts'), 'utf8');
    const consumer = `<script setup lang="ts">\nimport { ref } from 'vue';\nimport { Pagination, type PaginationHandle, type PaginationChangePayload } from './index';\nconst h = ref<PaginationHandle | null>(null);\nh.value?.goto(2);\nconst p: PaginationChangePayload = { page: 1 };\nvoid p;\n</script>\n<template>\n  <Pagination ref="h" />\n</template>\n`;
    const r = run({ ...files(consumer), 'index.ts': barrel });
    expect(r.out).toBe('');
    expect(r.ok).toBe(true);
  });
});
