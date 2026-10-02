/**
 * ANGULAR-COMBOBOX-TYPED-SURFACE — typed public surface (release-0.8.0 token-input wave).
 * tsc over compile(Combobox.rozie): `search` / `change` / `create` outputs typed,
 * every slot TemplateRef ctx typed, token-input inputs typed, handle verbs typed
 * (incl. `activeOption`). Negatives pinned to the specific TS error.
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
// Absolute filename: the <components> Popover specifier resolves via node_modules UPWARD from it.
const SRC_PATH = resolve(ROOT, 'packages/ui/combobox/src/Combobox.rozie');
const SRC = readFileSync(SRC_PATH, 'utf8');

/** Stub the vendored runtime helper (not part of the combobox surface). */
function stubInternals(code: string): string {
  return code.replace(/^import \{ groupOptions \} from '\.\/internal\/groupOptions';$/m, 'const groupOptions: any = undefined;');
}

/**
 * Ambient shims for the composed popover leaf + windowing engine, which this
 * harness does not install (an import-preserving shim keeps the SFC/module
 * shape intact — replacing an import with a `const` would push the remaining
 * `<script setup>` imports out of module position).
 */
const SHIMS = `declare module '@rozie-ui/popover-vue' { const C: any; export default C; }
declare module '@rozie-ui/popover-svelte' { const C: any; export default C; }
declare module '@rozie-ui/popover-angular' { export const Popover: any; }
declare module '@tanstack/virtual-core' { export const Virtualizer: any, elementScroll: any, observeElementRect: any, observeElementOffset: any, measureElement: any; }
`;

/**
 * CONSUMER-surface gate: only diagnostics in the consumer file count. The
 * emitted combobox body carries pre-existing strict-mode body errors (implicit
 * any / never[] inference in r-for rows and block builders) that are not part of
 * the typed public surface (no cosmetic tsc on emitted bodies).
 */
function consumerErrors(out: string, file: string): string {
  return out.split('\n').filter((l) => l.includes(file) && /error/i.test(l)).join('\n');
}


const PRELUDE = `import { Combobox, type ComboboxSearchPayload, type ComboboxChangePayload, type ComboboxCreatePayload, type ComboboxChipSlotCtx, type ComboboxOptionSlotCtx, type ComboboxQuerySlotCtx, type ComboboxGroupHeadingSlotCtx, type ComboboxGroupMoreSlotCtx, type ComboboxGroup } from './Combobox';
import type { TemplateRef, InputSignal } from '@angular/core';
declare const c: Combobox;
type CtxOf<T> = NonNullable<T> extends TemplateRef<infer C> ? C : never;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
declare const cp: ComboboxChangePayload;
`;

const OK = `${PRELUDE}
c.search.subscribe((p) => { const q: string = p.query; const x: ComboboxSearchPayload = p; void q; void x; });
c.change.subscribe((p) => { const s: boolean = p.selected; const t: string | undefined = p.text; void s; void t; });
c.create.subscribe((p) => { const q: string = p.query; const x: ComboboxCreatePayload = p; void q; void x; });
const picked: any = c.activeOption();
c.seedQuery('x');
c.pinOpen(true);
void picked;
declare const chip: CtxOf<Combobox['chipTpl']>; const chi: number = chip.index; chip.remove();
declare const opt: CtxOf<Combobox['optionTpl']>; const ob: boolean = opt.active && opt.selected && opt.disabled; const oi: number = opt.index;
declare const emp: CtxOf<Combobox['emptyTpl']>; const eq: string = emp.query;
declare const cre: CtxOf<Combobox['createTpl']>; const cq: string = cre.query;
declare const gh: CtxOf<Combobox['groupHeadingTpl']>; const gl: string = gh.group.label + gh.group.id;
declare const gm: CtxOf<Combobox['groupMoreTpl']>; const gmh: number = gm.hidden; gm.expand();
const s1: ComboboxChipSlotCtx = { option: null, remove: () => {}, index: 0 };
const s2: ComboboxOptionSlotCtx = { option: null, index: 0, active: true, selected: false, disabled: false };
const s3: ComboboxQuerySlotCtx = { query: '' };
const g: ComboboxGroup = { id: 'a', label: 'A' };
const s4: ComboboxGroupHeadingSlotCtx = { group: g };
const s5: ComboboxGroupMoreSlotCtx = { group: null, hidden: 1, expand: () => {} };
const blockIsBool: Equal<typeof c.block, InputSignal<boolean>> = true;
const hideIsBool: Equal<typeof c.hideEmpty, InputSignal<boolean>> = true;
const tabIsBool: Equal<typeof c.selectOnTab, InputSignal<boolean>> = true;
const focusIsBool: Equal<typeof c.disableOpenOnFocus, InputSignal<boolean>> = true;
const layoutIsString: Equal<typeof c.chipLayout, InputSignal<string>> = true;
const isEmail = (text: string): boolean => text.includes('@');
const v: ReturnType<typeof c.validate> = isEmail;
const d: ReturnType<typeof c.delimiters> = [',', ';'];
void cp; void chi; void ob; void oi; void eq; void cq; void gl; void gmh; void s1; void s2; void s3; void s4; void s5;
void blockIsBool; void hideIsBool; void tabIsBool; void focusIsBool; void layoutIsString; void v; void d;
`;

const NEGATIVES: Array<{ name: string; body: string; match: RegExp }> = [
  { name: 'change payload selected is boolean', body: `c.change.subscribe((p) => p.selected.toUpperCase());`, match: /TS2339: Property 'toUpperCase' does not exist on type 'boolean'/ },
  { name: 'search payload query is string', body: `c.search.subscribe((p) => p.query.toPrecision());`, match: /Property 'toPrecision' does not exist on type 'string'/ },
  { name: 'change payload text is string | undefined', body: `const n: number = cp.text;\nvoid n;`, match: /TS2322: Type 'string \| undefined' is not assignable to type 'number'/ },
  { name: 'chip ctx index is number', body: `declare const chip: CtxOf<Combobox['chipTpl']>;\nchip.index.toUpperCase();`, match: /TS2339: Property 'toUpperCase' does not exist on type 'number'/ },
  { name: 'handle seedQuery takes a string', body: `c.seedQuery(1);`, match: /TS2345: Argument of type 'number' is not assignable to parameter of type 'string'/ },
  { name: 'unknown handle verb rejected', body: `c.openList();`, match: /TS2339: Property 'openList' does not exist on type 'Combobox'/ },
];

function tsc(files: Record<string, string>): { threw: boolean; output: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-angular-combobox-'));
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

describe('ANGULAR-COMBOBOX-TYPED-SURFACE — typed outputs, slot ctx, token-input inputs, typed handle', () => {
  const r0 = compile(SRC, { target: 'angular', filename: SRC_PATH, sourceMap: false });
  const ng = stubInternals(r0.code);

  it('compiles without errors; outputs carry the declared payload types', () => {
    expect(r0.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(ng).toMatch(/search = output<ComboboxSearchPayload>\(\);/);
    expect(ng).toMatch(/change = output<ComboboxChangePayload>\(\);/);
    expect(ng).toMatch(/create = output<ComboboxCreatePayload>\(\);/);
  });

  it('typed consumer tsc-checks clean', () => {
    const r = tsc({ 'shims.d.ts': SHIMS, 'Combobox.ts': ng, 'consumer.ts': OK });
    expect(consumerErrors(r.output, 'consumer.ts'), r.output).toBe('');
  });

  for (const neg of NEGATIVES) {
    it(`negative fails for the right reason: ${neg.name}`, () => {
      const r = tsc({ 'shims.d.ts': SHIMS, 'Combobox.ts': ng, 'consumer.ts': `${PRELUDE}\n${neg.body}\n` });
      const mine = consumerErrors(r.output, 'consumer.ts');
      expect(r.threw).toBe(true);
      expect(mine).toMatch(neg.match);
      expect(mine).not.toMatch(/TS2304|TS2614|TS2305|Cannot find name|has no exported member/);
    });
  }
});
