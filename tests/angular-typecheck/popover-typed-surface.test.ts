/**
 * ANGULAR-POPOVER-TYPED-SURFACE — typed public surface phase 1 (Task 17).
 * tsc-checks compile(Popover.rozie): `change` is `OutputEmitterRef<boolean>`,
 * the `anchor` template ctx is typed, handle verbs are typed. Negatives are
 * pinned to specific TS codes + messages.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, readFileSync, symlinkSync } from 'node:fs';
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

const PRELUDE = `import { Popover } from './Popover';
import type { TemplateRef, OutputEmitterRef } from '@angular/core';
declare const c: Popover;
type AnchorCtx = NonNullable<Popover['anchorTpl']> extends TemplateRef<infer C> ? C : never;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
`;

const OK = `${PRELUDE}
c.change.subscribe((open: boolean) => { const b: boolean = open; void b; });
c.show();
c.hide();
c.toggle();
c.reposition();
declare const ctx: AnchorCtx;
const o: boolean = ctx.open;
ctx.toggle();
ctx.show();
ctx.hide();
const changeIsBoolean: Equal<typeof c.change, OutputEmitterRef<boolean>> = true;
void o; void changeIsBoolean;
`;

const NEGATIVES: Array<{ name: string; body: string; match: RegExp }> = [
  {
    name: 'change payload is boolean',
    body: `c.change.subscribe((open) => open.toFixed());`,
    match: /TS2339: Property 'toFixed' does not exist on type 'boolean'/,
  },
  {
    name: 'anchor ctx open is boolean',
    body: `declare const ctx: AnchorCtx;\nctx.open.toFixed();`,
    match: /TS2339: Property 'toFixed' does not exist on type 'boolean'/,
  },
  {
    name: 'handle show() takes no arguments',
    body: `c.show(1);`,
    match: /TS2554: Expected 0 arguments, but got 1/,
  },
];

function tsc(files: Record<string, string>): { threw: boolean; output: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-angular-popover-'));
  try {
    for (const [name, code] of Object.entries(files)) writeFileSync(join(tmpDir, name), code, 'utf8');
    copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
    symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
    try {
      execFileSync(resolve(HERE, 'node_modules/.bin/tsc'), ['--noEmit', '-p', 'tsconfig.json'], { cwd: tmpDir, stdio: 'pipe' });
      return { threw: false, output: '' };
    } catch (err) {
      return {
        threw: true,
        output: ((err as { stdout?: Buffer }).stdout?.toString() ?? '') + ((err as { stderr?: Buffer }).stderr?.toString() ?? ''),
      };
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe('ANGULAR-POPOVER-TYPED-SURFACE — change: output<boolean>, typed anchor ctx, typed handle', () => {
  const r0 = compile(SRC, { target: 'angular', filename: 'Popover.rozie', sourceMap: false });
  const ng = stubInternals(r0.code);

  it('compiles without errors and emits output<boolean>', () => {
    expect(r0.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(ng).toMatch(/change = output<boolean>\(\);/);
  });

  it('typed consumer tsc-checks clean', () => {
    const r = tsc({ 'Popover.ts': ng, 'consumer.ts': OK });
    expect(r.threw, r.output).toBe(false);
  });

  for (const neg of NEGATIVES) {
    it(`negative fails for the right reason: ${neg.name}`, () => {
      const r = tsc({ 'Popover.ts': ng, 'consumer.ts': `${PRELUDE}\n${neg.body}\n` });
      expect(r.threw).toBe(true);
      expect(r.output).toMatch(neg.match);
      expect(r.output).not.toMatch(/TS2304|TS2614|TS2305|Cannot find name|has no exported member/);
    });
  }
});
