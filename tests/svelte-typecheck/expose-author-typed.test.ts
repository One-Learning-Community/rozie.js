/**
 * EXPOSE-AUTHOR-TYPED (Svelte) — typed public surface P1, final fix wave I1.
 * Author-typed `$expose` verbs of an opt-in component keep their own types on
 * the instance surface: no `(...args: any[]) => any` overload above an
 * author-typed `export function`, and an authored `const` declarator
 * annotation is never replaced. Shared fixture with strict-conformance.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, readFileSync, symlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(resolve(HERE, '../strict-conformance/__fixtures__/expose-author-typed/AuthorExpose.rozie'), 'utf8');

const CONSUMER = `<script lang="ts">
  import AuthorExpose from './AuthorExpose.svelte';
  let h: ReturnType<typeof AuthorExpose> = $state()!;
  export function run() {
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
</script>

<AuthorExpose bind:this={h} />
`;

describe('EXPOSE-AUTHOR-TYPED — Svelte', () => {
  it('no untyped overload over author-typed verbs; authored declarator annotation kept', () => {
    const r = compile(SRC, { target: 'svelte', filename: 'AuthorExpose.rozie', sourceMap: false });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(r.code).not.toMatch(/export function add\(\.\.\.args: any\[\]\): any;/);
    expect(r.code).toMatch(/export const mul: \(by: number\) => string = /);
    expect(r.code).toMatch(/export function reset\(\): void;/);
    expect(r.code).toMatch(/export function loose\(\.\.\.args: any\[\]\): any;/);
  });
  it('component + consumer are svelte-check clean', () => {
    const r = compile(SRC, { target: 'svelte', filename: 'AuthorExpose.rozie', sourceMap: false });
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-svelte-i1-'));
    try {
      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
      writeFileSync(join(tmpDir, 'AuthorExpose.svelte'), r.code);
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
