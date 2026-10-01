/**
 * R16 (typed-surface P1, Task 18 review) — Vue: the `<types>` block lands in the
 * module `<script lang="ts">` and the value import in `<script setup>`; they are
 * ONE module. The duplicated `<types>` specifier is dropped, and the module-script
 * types (`DupInfo`, `DupHandle`) must still resolve `Thing` through the setup
 * import under vue-tsc (component AND consumer).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, symlinkSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = resolve(HERE, '../strict-conformance/__fixtures__/types-import-dedupe');
const SRC = readFileSync(resolve(FIX, 'Dup.rozie'), 'utf8');
const LIB = readFileSync(resolve(FIX, 'lib.ts'), 'utf8');

const CONSUMER = `<script setup lang="ts">
import { ref } from 'vue';
import Dup, { type DupHandle, type DupInfo, type Thing } from './Dup.vue';
const h = ref<DupHandle | null>(null);
const n: number | undefined = h.value?.current().x;
void n;
const onInfo = (p: DupInfo) => { const t: Thing = p.thing; const x: number = t.x; void x; };
</script>
<template>
  <Dup ref="h" @info="onInfo" />
</template>
`;

describe('R16 — Vue: module-script types resolve the setup value import', () => {
  it('@vue/compiler-sfc compiles the SFC (the module script may not re-export a setup-only local)', async () => {
    const { parse, compileScript } = await import('vue/compiler-sfc');
    const r = compile(SRC, { target: 'vue', filename: 'Dup.rozie', sourceMap: false });
    const { descriptor, errors } = parse(r.code, { filename: 'Dup.vue' });
    expect(errors).toEqual([]);
    expect(() => compileScript(descriptor, { id: 'dup' })).not.toThrow();
  });

  it('compiled SFC + typed consumer are vue-tsc clean (no TS2300/TS2304)', () => {
    const r = compile(SRC, { target: 'vue', filename: 'Dup.rozie', sourceMap: false });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-vue-r16-'));
    try {
      copyFileSync(join(HERE, 'tsconfig.consumer.strict.json'), join(tmpDir, 'tsconfig.json'));
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
      writeFileSync(join(tmpDir, 'Dup.vue'), r.code);
      writeFileSync(join(tmpDir, 'lib.ts'), LIB);
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
