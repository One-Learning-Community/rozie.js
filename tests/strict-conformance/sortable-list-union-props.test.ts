/**
 * SORTABLE-LIST-UNION-PROPS — `keyboardTrigger` and `orientation` are
 * string-literal unions for a strict-TS consumer (react / react .d.ts /
 * solid / lit), typed by the exported `SortableKeyboardTrigger` and
 * `SortableOrientation` aliases (audit B3).
 *
 * The valid values type-check and the aliases import from the component
 * module and the leaf barrel; a misspelt value is TS2322. A premise case
 * compiles the component with the old `type: String` props and shows the
 * misspelling went through, so this gate cannot pass vacuously.
 *
 * Only the consumer file's errors are counted (memory: no cosmetic tsc on
 * emitted bodies).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { compile } from '@rozie/core';
import { typecheckCompiled, type Inventory } from './strict-conformance.harness.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PKG = resolve(ROOT, 'packages/ui/sortable-list');
const SRC = readFileSync(resolve(PKG, 'src/SortableList.rozie'), 'utf8');
const INTERNALS = ['useSortableJS.ts', 'keyboardRegistry.ts', 'announcements.ts'];

type T = 'react' | 'solid' | 'lit';
type Case = T | 'react-dts';

function files(kind: Case, source = SRC): Record<string, string> {
  const target: T = kind === 'react-dts' ? 'react' : kind;
  const r = compile(source, { target, filename: 'SortableList.rozie', sourceMap: false });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  if (kind === 'react-dts') {
    expect(r.types).toBeTruthy();
    return { 'SortableList.d.ts': r.types! };
  }
  const out: Record<string, string> = {
    [target === 'lit' ? 'SortableList.ts' : 'SortableList.tsx']: r.code.replaceAll("'./internal/", "'./"),
  };
  for (const f of INTERNALS) out[f] = readFileSync(resolve(PKG, 'src/internal', f), 'utf8');
  return out;
}

const consumerErrors = (inv: Inventory, consumer: string) =>
  Object.entries(inv)
    .filter(([file]) => file.includes(consumer))
    .reduce((n, [, codes]) => n + Object.values(codes).reduce((s, c) => s + c, 0), 0);

const TYPES = 'type SortableKeyboardTrigger, type SortableOrientation';

const JSX_OK = (from: string) => `import { default as SortableList, ${TYPES} } from '${from}';
const trigger: SortableKeyboardTrigger = 'handle';
const dir: SortableOrientation = 'horizontal';
export const a = <SortableList items={[]} keyboardTrigger="handle" handle=".grip" orientation="horizontal" />;
export const b = <SortableList items={[]} keyboardTrigger={trigger} orientation={dir} />;
export const c = <SortableList items={[]} keyboardTrigger="row" orientation="vertical" />;
`;

const LIT_OK = (from: string) => `import { default as SortableList, ${TYPES} } from '${from}';
declare const el: SortableList;
const trigger: SortableKeyboardTrigger = 'handle';
const dir: SortableOrientation = 'horizontal';
el.keyboardTrigger = trigger;
el.orientation = dir;
el.keyboardTrigger = 'row';
el.orientation = 'vertical';
`;

// TS2820 is TS2322 with a "Did you mean" hint.
const TRIGGER_ERR = /error TS(2322|2820): Type '"hande"' is not assignable to type 'SortableKeyboardTrigger/;
const ORIENT_ERR = /error TS(2322|2820): Type '"horizonal"' is not assignable to type 'SortableOrientation/;
const NEG: Record<T, Array<{ name: string; line: string; match: RegExp }>> = {
  react: [
    { name: 'misspelt keyboardTrigger', line: `export const bad = <SortableList keyboardTrigger="hande" />;`, match: TRIGGER_ERR },
    { name: 'misspelt orientation', line: `export const bad2 = <SortableList orientation="horizonal" />;`, match: ORIENT_ERR },
  ],
  solid: [
    { name: 'misspelt keyboardTrigger', line: `export const bad = <SortableList keyboardTrigger="hande" />;`, match: TRIGGER_ERR },
    { name: 'misspelt orientation', line: `export const bad2 = <SortableList orientation="horizonal" />;`, match: ORIENT_ERR },
  ],
  lit: [
    { name: 'misspelt keyboardTrigger', line: `el.keyboardTrigger = 'hande';`, match: TRIGGER_ERR },
    { name: 'misspelt orientation', line: `el.orientation = 'horizonal';`, match: ORIENT_ERR },
  ],
};

const CASES: Array<{ kind: Case; target: T; consumer: string; nm: string }> = [
  { kind: 'react', target: 'react', consumer: 'Consumer.tsx', nm: 'packages/ui/sortable-list/packages/react' },
  { kind: 'react-dts', target: 'react', consumer: 'Consumer.tsx', nm: 'packages/ui/sortable-list/packages/react' },
  { kind: 'solid', target: 'solid', consumer: 'Consumer.tsx', nm: 'packages/ui/sortable-list/packages/solid' },
  { kind: 'lit', target: 'lit', consumer: 'Consumer.ts', nm: 'packages/ui/sortable-list/packages/lit' },
];

describe('SORTABLE-LIST-UNION-PROPS — keyboardTrigger / orientation are literal unions (react/solid/lit)', () => {
  for (const c of CASES) {
    describe(c.kind, () => {
      const ok = c.target === 'lit' ? LIT_OK('./SortableList') : JSX_OK('./SortableList');
      const run = (consumer: string, source?: string, extra: Record<string, string> = {}) =>
        typecheckCompiled({ target: c.target, files: { ...files(c.kind, source), ...extra, [c.consumer]: consumer }, nodeModulesFrom: c.nm });

      it('the valid values type-check and the aliases are importable', () => {
        const { raw, inventory } = run(ok);
        expect(consumerErrors(inventory, c.consumer), raw).toBe(0);
      });

      (c.kind === 'react-dts' ? it.skip : it)('the aliases are importable from the leaf barrel (src/index.ts)', () => {
        const index = readFileSync(resolve(ROOT, c.nm, 'src/index.ts'), 'utf8');
        const consumer = c.target === 'lit' ? LIT_OK('./index') : JSX_OK('./index');
        const { raw, inventory } = run(consumer, undefined, { 'index.ts': index });
        expect(consumerErrors(inventory, c.consumer), raw).toBe(0);
      });

      for (const neg of NEG[c.target]) {
        it(`negative fails for the right reason: ${neg.name}`, () => {
          const { raw, inventory } = run(`${ok}\n${neg.line}\n`);
          expect(consumerErrors(inventory, c.consumer)).toBeGreaterThan(0);
          expect(raw).toMatch(neg.match);
          expect(raw).not.toMatch(/TS2304|TS2305|TS2614|Cannot find name/);
        });
      }

      it('premise: with the old `type: String` props a misspelt value goes through', () => {
        const old = SRC.replace('type: SortableKeyboardTrigger,', 'type: String,').replace('type: SortableOrientation,', 'type: String,');
        expect(old).not.toBe(SRC);
        const head = c.target === 'lit'
          ? `import SortableList from './SortableList';\ndeclare const el: SortableList;\n`
          : `import SortableList from './SortableList';\n`;
        const lines = NEG[c.target].map((n) => n.line).join('\n');
        const { raw, inventory } = run(`${head}${lines}\n`, old);
        expect(consumerErrors(inventory, c.consumer), raw).toBe(0);
      });
    });
  }
});
