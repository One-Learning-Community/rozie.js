/**
 * R16 (typed-surface P1, Task 18 review) — Angular: `<types>` and the `<script>`
 * value import share the component module. The duplicated `<types>` specifier
 * is dropped; `output<DupInfo>` and the typed `current` handle still resolve
 * `Thing` (component AND consumer tsc-clean, no TS2300).
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

const CONSUMER = `import { Dup, type DupInfo, type Thing } from './Dup';
declare const c: Dup;
const n: number = c.current().x;
c.info.subscribe((p) => { const i: DupInfo = p; const t: Thing = p.thing; const x: number = t.x; void i; void x; });
void n;
`;

describe('R16 — Angular: <types> + <script> import of the same binding', () => {
  it('compiled component + typed consumer tsc clean (no TS2300)', () => {
    const r = compile(SRC, { target: 'angular', filename: 'Dup.rozie', sourceMap: false });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-angular-r16-'));
    try {
      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
      writeFileSync(join(tmpDir, 'Dup.ts'), r.code);
      writeFileSync(join(tmpDir, 'lib.ts'), LIB);
      writeFileSync(join(tmpDir, 'consumer.ts'), CONSUMER);
      let out = '';
      try {
        execFileSync(resolve(HERE, 'node_modules/.bin/tsc'), ['--noEmit', '-p', 'tsconfig.json'], { cwd: tmpDir, stdio: 'pipe' });
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
