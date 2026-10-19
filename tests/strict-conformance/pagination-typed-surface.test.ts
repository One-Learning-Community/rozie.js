/**
 * PAGINATION-TYPED-SURFACE — the durable, consumer-side form of the pre-release
 * dist probe (quick 261018-vdu).
 *
 * `compile(Pagination.rozie)` for react/solid/lit, then a STRICT consumer sees:
 *   - the `change` event payload typed `PaginationChangePayload` (`{ page: number }`),
 *   - the model's change event typed `number`,
 *   - the four scoped slots' params typed (`page: number`, `selected: boolean`,
 *     `goto: () => void`, `index: number`, `disabled: boolean`),
 *   - typed handle verbs (`goto(page: number)`, zero-argument `next` / `prev` /
 *     `first` / `last`).
 * Negatives are `@ts-expect-error` (TS2578 if one stops erroring) AND a separate
 * run of each negative WITHOUT the directive pins the specific TS error, so a
 * negative can never pass vacuously. (vue / svelte / angular live in their own
 * harness dirs.)
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { compile } from '@rozie/core';
import { typecheckCompiled, totalErrors } from './strict-conformance.harness.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = readFileSync(resolve(ROOT, 'packages/ui/pagination/src/Pagination.rozie'), 'utf8');
const ITEMS = readFileSync(resolve(ROOT, 'packages/ui/pagination/src/internal/paginationItems.ts'), 'utf8');

/** Compile, and flatten the one vendored-helper import so the real helper typechecks too. */
function compiled(target: 'react' | 'solid' | 'lit'): string {
  const r = compile(SRC, { target, filename: 'Pagination.rozie', sourceMap: false });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return r.code.replace("'./internal/paginationItems'", "'./paginationItems'");
}

const REACT_PRELUDE = `import { useRef } from 'react';
import Pagination, { type PaginationHandle, type PaginationChangePayload } from './Pagination';
const h = useRef<PaginationHandle>(null);
`;
const REACT_OK = `${REACT_PRELUDE}
h.current?.goto(3);
h.current?.next();
h.current?.prev();
h.current?.first();
h.current?.last();
export const ok = (
  <Pagination
    ref={h}
    modelValue={1}
    onModelValueChange={(n) => { const v: number = n; void v; }}
    onChange={(p) => { const q: PaginationChangePayload = p; const n: number = p.page; void q; void n; }}
    total={195}
    pageSize={10}
    siblingCount={2}
    boundaryCount={1}
    disabled={false}
    ariaLabel="Pages"
    className="c"
    renderItem={({ page, selected, goto }) => { const n: number = page + 1; const s: boolean = selected; goto(); void n; void s; return null; }}
    renderEllipsis={({ index }) => { const n: number = index + 1; void n; return null; }}
    renderPrevControl={({ disabled, goto, page }) => { const d: boolean = disabled; const n: number = page + 1; goto(); void d; void n; return null; }}
    renderNextControl={({ disabled, goto, page }) => { const d: boolean = disabled; const n: number = page + 1; goto(); void d; void n; return null; }}
  />
);
`;
const REACT_NEG = {
  payload: { line: `export const bad = <Pagination onChange={(p) => p.page.toUpperCase()} />;`, match: /TS2339: Property 'toUpperCase' does not exist on type 'number'/ },
  model: { line: `export const bad = <Pagination onModelValueChange={(n) => n.toUpperCase()} />;`, match: /TS2339: Property 'toUpperCase' does not exist on type 'number'/ },
  slotParam: { line: `export const bad = <Pagination renderItem={({ page }) => { page.toUpperCase(); return null; }} />;`, match: /TS2339: Property 'toUpperCase' does not exist on type 'number'/ },
  slotGoto: { line: `export const bad = <Pagination renderItem={({ goto }) => { goto(1); return null; }} />;`, match: /TS2554: Expected 0 arguments, but got 1/ },
  verbArg: { line: `h.current?.goto('3');`, match: /TS2345: Argument of type 'string' is not assignable to parameter of type 'number'/ },
  verbArity: { line: `h.current?.next(1);`, match: /TS2554: Expected 0 arguments, but got 1/ },
};

const SOLID_PRELUDE = `import Pagination, { type PaginationHandle, type PaginationChangePayload } from './Pagination';
let h: PaginationHandle | undefined;
`;
const SOLID_OK = `${SOLID_PRELUDE}
h?.goto(3);
h?.next();
h?.prev();
h?.first();
h?.last();
export const ok = (
  <Pagination
    ref={(x) => { h = x; }}
    modelValue={1}
    onModelValueChange={(n) => { const v: number = n; void v; }}
    onChange={(p) => { const q: PaginationChangePayload = p; const n: number = p.page; void q; void n; }}
    total={195}
    pageSize={10}
    siblingCount={2}
    boundaryCount={1}
    disabled={false}
    ariaLabel="Pages"
    class="c"
    itemSlot={({ page, selected, goto }) => { const n: number = page + 1; const s: boolean = selected; goto(); return <b>{n}{String(s)}</b>; }}
    ellipsisSlot={({ index }) => { const n: number = index + 1; return <i>{n}</i>; }}
    prevControlSlot={({ disabled, goto, page }) => { const d: boolean = disabled; const n: number = page + 1; goto(); return <b>{String(d)}{n}</b>; }}
    nextControlSlot={({ disabled, goto, page }) => { const d: boolean = disabled; const n: number = page + 1; goto(); return <b>{String(d)}{n}</b>; }}
  />
);
`;
const SOLID_NEG = {
  payload: { line: `export const bad = <Pagination onChange={(p) => p.page.toUpperCase()} />;`, match: /TS2339: Property 'toUpperCase' does not exist on type 'number'/ },
  model: { line: `export const bad = <Pagination onModelValueChange={(n) => n.toUpperCase()} />;`, match: /TS2339: Property 'toUpperCase' does not exist on type 'number'/ },
  slotParam: { line: `export const bad = <Pagination itemSlot={({ page }) => { page.toUpperCase(); return <i /> }} />;`, match: /TS2339: Property 'toUpperCase' does not exist on type 'number'/ },
  slotGoto: { line: `export const bad = <Pagination itemSlot={({ goto }) => { goto(1); return <i /> }} />;`, match: /TS2554: Expected 0 arguments, but got 1/ },
  verbArg: { line: `h?.goto('3');`, match: /TS2345: Argument of type 'string' is not assignable to parameter of type 'number'/ },
  verbArity: { line: `h?.next(1);`, match: /TS2554: Expected 0 arguments, but got 1/ },
};

const LIT_PRELUDE = `import Pagination, { type PaginationChangePayload } from './Pagination';
declare const el: Pagination;
`;
const LIT_OK = `${LIT_PRELUDE}
el.addEventListener('change', (e) => { const q: PaginationChangePayload = e.detail; const n: number = e.detail.page; void q; void n; });
el.addEventListener('model-value-change', (e) => { const n: number = e.detail; void n; });
el.addEventListener('click', (e) => e.clientX.toFixed());
el.modelValue = 3;
el.total = 195;
el.pageSize = 10;
el.siblingCount = 2;
el.boundaryCount = 1;
el.disabled = false;
el.ariaLabel = 'Pages';
el.goto(3);
el.next();
el.prev();
el.first();
el.last();
el.item = ({ page, selected, goto }) => { const n: number = page + 1; const s: boolean = selected; goto(); return String(n) + String(s); };
el.ellipsis = ({ index }) => { const n: number = index + 1; return String(n); };
el.prevControl = ({ disabled, goto, page }) => { const d: boolean = disabled; const n: number = page + 1; goto(); return String(d) + String(n); };
el.nextControl = ({ disabled, goto, page }) => { const d: boolean = disabled; const n: number = page + 1; goto(); return String(d) + String(n); };
`;
const LIT_NEG = {
  payload: { line: `el.addEventListener('change', (e) => e.detail.page.toUpperCase());`, match: /TS2339: Property 'toUpperCase' does not exist on type 'number'/ },
  model: { line: `el.addEventListener('model-value-change', (e) => e.detail.toUpperCase());`, match: /TS2339: Property 'toUpperCase' does not exist on type 'number'/ },
  slotParam: { line: `el.item = ({ page }) => { page.toUpperCase(); return ''; };`, match: /TS2339: Property 'toUpperCase' does not exist on type 'number'/ },
  slotGoto: { line: `el.item = ({ goto }) => { goto(1); return ''; };`, match: /TS2554: Expected 0 arguments, but got 1/ },
  verbArg: { line: `el.goto('3');`, match: /TS2345: Argument of type 'string' is not assignable to parameter of type 'number'/ },
  verbArity: { line: `el.next(1);`, match: /TS2554: Expected 0 arguments, but got 1/ },
};

/** Mark a negative statement with @ts-expect-error (all negatives are top-level statements). */
const expectErr = (line: string) => `// @ts-expect-error — negative\n${line}`;

const CASES = [
  { target: 'react' as const, file: 'Pagination.tsx', consumer: 'Consumer.tsx', nm: 'packages/ui/pagination/packages/react', ok: REACT_OK, neg: REACT_NEG },
  { target: 'solid' as const, file: 'Pagination.tsx', consumer: 'Consumer.tsx', nm: 'packages/ui/pagination/packages/solid', ok: SOLID_OK, neg: SOLID_NEG },
  { target: 'lit' as const, file: 'Pagination.ts', consumer: 'Consumer.ts', nm: 'packages/ui/pagination/packages/lit', ok: LIT_OK, neg: LIT_NEG },
];

describe('PAGINATION-TYPED-SURFACE — typed change payload, slot params and handle (react/solid/lit)', () => {
  for (const c of CASES) {
    describe(c.target, () => {
      const code = compiled(c.target);
      const run = (consumerSrc: string) =>
        typecheckCompiled({
          target: c.target,
          files: { [c.file]: code, 'paginationItems.ts': ITEMS, [c.consumer]: consumerSrc },
          nodeModulesFrom: c.nm,
        });

      it('strict consumer with @ts-expect-error negatives is clean', () => {
        const withNegs =
          c.ok + '\n' + Object.values(c.neg).map((n, i) => expectErr(n.line).replace(/\bbad\b/, `bad${i}`)).join('\n') + '\n';
        const { raw, inventory } = run(withNegs);
        expect(totalErrors(inventory), raw).toBe(0);
      });

      for (const [name, neg] of Object.entries(c.neg)) {
        it(`negative (${name}) fails for the right reason when the directive is removed`, () => {
          const { raw, inventory } = run(`${c.ok}\n${neg.line.replace(/\bbad\b/, 'badX')}\n`);
          expect(totalErrors(inventory)).toBeGreaterThan(0);
          expect(raw).toMatch(neg.match);
          expect(raw).not.toMatch(/TS2304|TS2305|TS2614|Cannot find name/);
        });
      }
    });
  }
});

/**
 * Barrel parity: the package entry (`src/index.ts`, the committed leaf barrel)
 * must let a consumer name the public types — the handle and payload types on
 * React/Solid, and on Lit the payload type and the typed element.
 */
describe('PAGINATION-TYPED-SURFACE — leaf barrel re-exports the public types', () => {
  const BARREL_CONSUMERS = {
    react: `import { Pagination, type PaginationHandle, type PaginationChangePayload } from './index';\ndeclare const h: PaginationHandle;\nh.goto(2);\nconst p: PaginationChangePayload = { page: 1 };\nvoid Pagination; void p;\n`,
    solid: `import { Pagination, type PaginationHandle, type PaginationChangePayload } from './index';\ndeclare const h: PaginationHandle;\nh.goto(2);\nconst p: PaginationChangePayload = { page: 1 };\nvoid Pagination; void p;\n`,
    lit: `import { Pagination, type RoziePaginationEventMap, type PaginationChangePayload } from './index';\nconst e: RoziePaginationEventMap['change'] = new CustomEvent('change', { detail: { page: 1 } });\nconst p: PaginationChangePayload = e.detail;\ndeclare const el: Pagination;\nel.goto(2);\nvoid p;\n`,
  } as const;
  for (const c of CASES) {
    it(`${c.target}: public types importable from the barrel`, () => {
      const index = readFileSync(resolve(ROOT, c.nm, 'src/index.ts'), 'utf8');
      const { raw, inventory } = typecheckCompiled({
        target: c.target,
        files: { [c.file]: compiled(c.target), 'paginationItems.ts': ITEMS, 'index.ts': index, [c.consumer]: BARREL_CONSUMERS[c.target] },
        nodeModulesFrom: c.nm,
      });
      expect(totalErrors(inventory), raw).toBe(0);
    });
  }
});
