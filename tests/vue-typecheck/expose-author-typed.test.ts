/**
 * EXPOSE-AUTHOR-TYPED (Vue) — typed public surface P1, final fix wave I1.
 * The `<Name>Handle` of an opt-in component keeps author-typed verbs typed
 * (including an annotated `const` declarator). Shared fixture with
 * strict-conformance.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, symlinkSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(resolve(HERE, '../strict-conformance/__fixtures__/expose-author-typed/AuthorExpose.rozie'), 'utf8');

const CONSUMER = `<script setup lang="ts">
import { ref } from 'vue';
import AuthorExpose, { type AuthorExposeHandle } from './AuthorExpose.vue';
const r = ref<AuthorExposeHandle | null>(null);
function run(h: AuthorExposeHandle) {
  const s1: string = h.add(1);
  // @ts-expect-error — add takes a number
  h.add('x');
  const s2: string = h.sub(1);
  // @ts-expect-error — sub takes a number
  h.sub('x');
  const s3: string = h.mul(2);
  // @ts-expect-error — mul takes a number
  h.mul('x');
  const s4: number = h.half(4);
  // @ts-expect-error — half takes a number
  h.half('x');
  h.reset();
  // @ts-expect-error — reset takes no arguments
  h.reset(1);
  h.loose('anything', 2);
  h.twice('anything');
  return [s1, s2, s3, s4];
}
void run;
</script>
<template>
  <AuthorExpose ref="r" />
</template>
`;

describe('EXPOSE-AUTHOR-TYPED — Vue', () => {
  it('compiled SFC + typed consumer are vue-tsc clean', () => {
    const c = compile(SRC, { target: 'vue', filename: 'AuthorExpose.rozie', sourceMap: false });
    expect(c.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-vue-i1-'));
    try {
      copyFileSync(join(HERE, 'tsconfig.consumer.strict.json'), join(tmpDir, 'tsconfig.json'));
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
      writeFileSync(join(tmpDir, 'AuthorExpose.vue'), c.code);
      writeFileSync(join(tmpDir, 'Consumer.vue'), CONSUMER);
      let out = '';
      try {
        execFileSync(resolve(HERE, 'node_modules/.bin/vue-tsc'), ['--noEmit', '-p', 'tsconfig.json'], { cwd: tmpDir, stdio: 'pipe' });
      } catch (err) {
        const e = err as { stdout?: Buffer; stderr?: Buffer };
        out = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '');
      }
      expect(out).toBe('');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
