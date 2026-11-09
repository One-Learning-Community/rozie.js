/**
 * VUE-SORTABLE-LIST-ANNOUNCEMENTS — the Vue half of the `announcements`
 * consumer gate (react/solid/lit: tests/strict-conformance). vue-tsc-checks
 * compile(SortableList.rozie) under the strict consumer tsconfig:
 *   - an inline `:announcements="{ moved: ({ label, position, total }) => … }"`
 *     has its context typed (no TS7031 implicit any);
 *   - `Announcements` / `AnnouncementContext` / `AnnouncementKind` import from
 *     the SFC and from the leaf barrel.
 * Negatives pin the specific error; a premise case compiles the old
 * `type: Object` prop and asserts the inline arrow was an implicit any.
 * Only Consumer.vue's errors count (the emitted body is not a strict target).
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
const PKG = resolve(ROOT, 'packages/ui/sortable-list');
const SRC = readFileSync(resolve(PKG, 'src/SortableList.rozie'), 'utf8');
const INTERNALS = ['useSortableJS.ts', 'keyboardRegistry.ts', 'announcements.ts'];

function files(consumer: string, source = SRC, extra: Record<string, string> = {}): Record<string, string> {
  const r = compile(source, { target: 'vue', filename: 'SortableList.rozie', sourceMap: false });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const out: Record<string, string> = { 'SortableList.vue': r.code.replaceAll("'./internal/", "'./"), ...extra, 'Consumer.vue': consumer };
  for (const f of INTERNALS) out[f] = readFileSync(resolve(PKG, 'src/internal', f), 'utf8');
  return out;
}

/** vue-tsc errors reported in Consumer.vue only. */
function consumerErrors(fs: Record<string, string>): string[] {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-vue-sortable-announcements-'));
  try {
    copyFileSync(join(HERE, 'tsconfig.consumer.strict.json'), join(tmpDir, 'tsconfig.json'));
    symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
    for (const [name, body] of Object.entries(fs)) writeFileSync(join(tmpDir, name), body, 'utf8');
    let out = '';
    try {
      execFileSync(resolve(HERE, 'node_modules/.bin/vue-tsc'), ['--noEmit', '-p', 'tsconfig.json'], { cwd: tmpDir, stdio: 'pipe' });
    } catch (err) {
      const e = err as { stdout?: Buffer; stderr?: Buffer };
      out = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '');
    }
    return out.split('\n').filter((l) => /Consumer\.vue\(\d+,\d+\): error/.test(l));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

const OK = (from: string) => `<script setup lang="ts">
import { ref } from 'vue';
import { SortableList, type Announcements, type AnnouncementContext, type AnnouncementKind } from '${from}';
const items = ref<string[]>([]);
const k: AnnouncementKind = 'moved';
const typed: Announcements = { lifted: (c: AnnouncementContext) => c.label + ' ' + String(c.position), liftEnded: () => null };
void k;
</script>
<template>
  <SortableList v-model:items="items" :announcements="typed" />
  <SortableList v-model:items="items" :announcements="{ moved: ({ label, position, total }) => label + ' → ' + position + '/' + total, dropped: ({ label }) => label.toUpperCase() }" />
</template>
`;

const NEG = (template: string, from = './SortableList.vue') => `<script setup lang="ts">
import SortableList from '${from}';
void SortableList;
</script>
<template>
  ${template}
</template>
`;

// The SFC has a default export only; the barrel names it.
const SFC_OK = OK('./SortableList.vue').replace(
  "import { SortableList, type Announcements, type AnnouncementContext, type AnnouncementKind } from './SortableList.vue';",
  "import SortableList, { type Announcements, type AnnouncementContext, type AnnouncementKind } from './SortableList.vue';",
);

describe('VUE-SORTABLE-LIST-ANNOUNCEMENTS — strict consumer of the announcements prop', () => {
  it('inline announcements are contextually typed and the types import from the SFC', () => {
    expect(consumerErrors(files(SFC_OK))).toEqual([]);
  });

  it('the types are importable from the leaf barrel (src/index.ts)', () => {
    const barrel = readFileSync(resolve(PKG, 'packages/vue/src/index.ts'), 'utf8');
    expect(consumerErrors(files(OK('./index'), SRC, { 'index.ts': barrel }))).toEqual([]);
  });

  it('negative: label is a string', () => {
    const errs = consumerErrors(files(NEG(`<SortableList :announcements="{ moved: ({ label }) => label.toFixed() }" />`)));
    expect(errs.join('\n')).toMatch(/Property 'toFixed' does not exist on type 'string'/);
  });

  it('negative: unknown kind', () => {
    const errs = consumerErrors(files(NEG(`<SortableList :announcements="{ mvoed: () => 'x' }" />`)));
    expect(errs.join('\n')).toMatch(/TS2561|TS2353/);
  });

  it('premise: with the old `type: Object` prop the inline arrow is TS7031', () => {
    const old = SRC.replace('type: Announcements,', 'type: Object,');
    expect(old).not.toBe(SRC);
    const errs = consumerErrors(files(NEG(`<SortableList :announcements="{ moved: ({ label }) => label.toFixed() }" />`), old));
    expect(errs.join('\n')).toMatch(/TS7031: Binding element 'label' implicitly has an 'any' type/);
  });
});
