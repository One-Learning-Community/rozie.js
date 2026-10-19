/**
 * ANGULAR-PAGINATION-TYPED-SURFACE — the Angular half of the consumer-side
 * typed-surface gate (quick 261018-vdu). tsc-checks compile(Pagination.rozie):
 * the `modelValue` model is a `ModelSignal<number>`, the `change` output carries
 * a `PaginationChangePayload`, the four template contexts are typed and the
 * handle verbs are typed. Negatives are pinned to specific TS codes + messages.
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
const SRC = readFileSync(resolve(ROOT, 'packages/ui/pagination/src/Pagination.rozie'), 'utf8');
const HELPER = readFileSync(resolve(ROOT, 'packages/ui/pagination/src/internal/paginationItems.ts'), 'utf8');

/** Flatten the one vendored-helper import so the real helper typechecks too. */
const flatten = (code: string) => code.replace("'./internal/paginationItems'", "'./paginationItems'");

const PRELUDE = `import { Pagination, type PaginationChangePayload } from './Pagination';
import type { TemplateRef, ModelSignal } from '@angular/core';
declare const c: Pagination;
type CtxOf<T> = NonNullable<T> extends TemplateRef<infer C> ? C : never;
type ItemCtx = CtxOf<Pagination['itemTpl']>;
type EllipsisCtx = CtxOf<Pagination['ellipsisTpl']>;
type PrevCtx = CtxOf<Pagination['prevControlTpl']>;
type NextCtx = CtxOf<Pagination['nextControlTpl']>;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
`;

const OK = `${PRELUDE}
c.modelValue.subscribe((n: number) => { const v: number = n; void v; });
c.change.subscribe((p) => { const q: PaginationChangePayload = p; const n: number = p.page; void q; void n; });
c.goto(3);
c.next();
c.prev();
c.first();
c.last();
const cur: number = c.modelValue();
const modelIsNumber: Equal<typeof c.modelValue, ModelSignal<number>> = true;
declare const item: ItemCtx;
const ip: number = item.page + 1; const is: boolean = item.selected; item.goto();
declare const ell: EllipsisCtx;
const ei: number = ell.index + 1;
declare const prev: PrevCtx;
const pd: boolean = prev.disabled; const pp: number = prev.page + 1; prev.goto();
declare const next: NextCtx;
const nd: boolean = next.disabled; const np: number = next.page + 1; next.goto();
void cur; void modelIsNumber; void ip; void is; void ei; void pd; void pp; void nd; void np;
`;

const NEGATIVES: Array<{ name: string; body: string; match: RegExp }> = [
  {
    name: 'change payload page is a number',
    body: `c.change.subscribe((p) => p.page.toUpperCase());`,
    match: /TS2339: Property 'toUpperCase' does not exist on type 'number'/,
  },
  {
    name: 'modelValue change payload is a number',
    body: `c.modelValue.subscribe((n) => n.toUpperCase());`,
    match: /TS2339: Property 'toUpperCase' does not exist on type 'number'/,
  },
  {
    name: 'item ctx page is a number',
    body: `declare const item: ItemCtx;\nitem.page.toUpperCase();`,
    match: /TS2339: Property 'toUpperCase' does not exist on type 'number'/,
  },
  {
    name: 'item ctx goto takes no arguments',
    body: `declare const item: ItemCtx;\nitem.goto(1);`,
    match: /TS2554: Expected 0 arguments, but got 1/,
  },
  {
    name: 'handle goto() takes a number',
    body: `c.goto('3');`,
    match: /TS2345: Argument of type 'string' is not assignable to parameter of type 'number'/,
  },
  {
    name: 'handle next() takes no arguments',
    body: `c.next(1);`,
    match: /TS2554: Expected 0 arguments, but got 1/,
  },
];

function tsc(files: Record<string, string>): { threw: boolean; output: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-angular-pagination-'));
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

describe('ANGULAR-PAGINATION-TYPED-SURFACE — modelValue: ModelSignal<number>, typed change output, typed contexts and handle', () => {
  const r0 = compile(SRC, { target: 'angular', filename: 'Pagination.rozie', sourceMap: false });
  const ng = flatten(r0.code);
  const files = (consumer: string) => ({ 'Pagination.ts': ng, 'paginationItems.ts': HELPER, 'consumer.ts': consumer });

  it('compiles without errors', () => {
    expect(r0.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('typed consumer tsc-checks clean', () => {
    const r = tsc(files(OK));
    expect(r.threw, r.output).toBe(false);
  });

  for (const neg of NEGATIVES) {
    it(`negative fails for the right reason: ${neg.name}`, () => {
      const r = tsc(files(`${PRELUDE}\n${neg.body}\n`));
      expect(r.threw).toBe(true);
      expect(r.output).toMatch(neg.match);
      expect(r.output).not.toMatch(/TS2304|TS2614|TS2305|Cannot find name|has no exported member/);
    });
  }
});
