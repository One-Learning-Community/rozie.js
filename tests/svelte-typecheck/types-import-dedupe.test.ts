/**
 * R16 (typed-surface P1, Task 18 review) — Svelte: the `<types>` block lands in
 * `<script module>` and the value import in the instance script; they are ONE
 * module. The duplicated `<types>` specifier is dropped, and the module-script
 * `DupInfo` plus the instance handle overloads must still resolve `Thing` under
 * svelte-check (component AND consumer).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, readFileSync, symlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = resolve(HERE, '../strict-conformance/__fixtures__/types-import-dedupe');
const SRC = readFileSync(resolve(FIX, 'Dup.rozie'), 'utf8');
const LIB = readFileSync(resolve(FIX, 'lib.ts'), 'utf8');

const CONSUMER = `<script lang="ts">
  import Dup, { type DupInfo, type Thing } from './Dup.svelte';
  let inst: ReturnType<typeof Dup> | undefined = $state();
  const n: number | undefined = inst?.current().x;
  void n;
  const onInfo = (p: DupInfo) => { const t: Thing = p.thing; const x: number = t.x; void x; };
</script>

<Dup bind:this={inst} oninfo={onInfo} />
`;

describe('R16 — Svelte: module-script types resolve the instance value import', () => {
  it('compiled component + typed consumer are svelte-check clean', () => {
    const r = compile(SRC, { target: 'svelte', filename: 'Dup.rozie', sourceMap: false });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-svelte-r16-'));
    try {
      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
      writeFileSync(join(tmpDir, 'Dup.svelte'), r.code);
      writeFileSync(join(tmpDir, 'lib.ts'), LIB);
      writeFileSync(join(tmpDir, 'Consumer.svelte'), CONSUMER);
      let out = '';
      try {
        execFileSync(resolve(HERE, 'node_modules/.bin/svelte-check'), ['--tsconfig', './tsconfig.json', '--threshold', 'error', '--output', 'human'], { cwd: tmpDir, stdio: 'pipe' });
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
