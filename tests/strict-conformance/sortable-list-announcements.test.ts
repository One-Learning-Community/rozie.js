/**
 * SORTABLE-LIST-ANNOUNCEMENTS — a strict-TS consumer gets the `announcements`
 * prop's functions contextually typed (react / solid / lit; vue lives in
 * tests/vue-typecheck).
 *
 * `compile(SortableList.rozie)` per target, then a STRICT consumer:
 *   - passes an inline `{ moved: ({ label, position, total }) => … }` — the
 *     destructured context must be typed (no TS7031 implicit any);
 *   - imports `Announcements` / `AnnouncementContext` / `AnnouncementKind`
 *     from the component module AND from the leaf barrel.
 * Negatives pin the specific error (a typed `label` is a string; an unknown
 * kind is rejected). A premise case compiles the component with the old
 * `type: Object` prop and asserts the inline arrow FAILS with TS7031, so this
 * gate cannot pass vacuously.
 *
 * Only the consumer file's errors are counted: the emitted component body is
 * not a strict-clean target here (memory: no cosmetic tsc on emitted bodies).
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

/**
 * The emitted component (internals flattened next to it) and its internals —
 * or, for `react-dts`, the published `.d.ts` alone (what a React consumer of
 * the built package actually types against).
 */
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

const TYPES = `type Announcements, type AnnouncementContext, type AnnouncementKind`;

const JSX_OK = (from: string, name = 'SortableList') => `import { ${name === 'SortableList' ? 'default as SortableList' : name}, ${TYPES} } from '${from}';
const k: AnnouncementKind = 'moved';
const typed: Announcements = { lifted: (c: AnnouncementContext) => c.label + ' ' + String(c.position) + ' ' + String(c.total), liftEnded: () => null };
export const inline = (
  <SortableList
    items={[]}
    announcements={{ moved: ({ label, position, total }) => label + ' → ' + position + '/' + total, dropped: ({ label }) => label.toUpperCase(), atStart: () => '' }}
  />
);
export const viaConst = <SortableList items={[]} announcements={typed} />;
void k;
`;

const LIT_OK = (from: string) => `import { default as SortableList, ${TYPES} } from '${from}';
declare const el: SortableList;
const k: AnnouncementKind = 'moved';
const typed: Announcements = { lifted: (c: AnnouncementContext) => c.label + ' ' + String(c.position), liftEnded: () => null };
el.announcements = { moved: ({ label, position, total }) => label + ' → ' + position + '/' + total, dropped: ({ label }) => label.toUpperCase() };
el.announcements = typed;
el.announcements = null;
void k;
`;

const NEG: Record<Case, Array<{ name: string; line: string; match: RegExp }>> = {
  react: [
    { name: 'label is a string', line: `export const bad = <SortableList announcements={{ moved: ({ label }) => label.toFixed() }} />;`, match: /Property 'toFixed' does not exist on type 'string'/ },
    { name: 'unknown kind', line: `export const bad = <SortableList announcements={{ mvoed: () => 'x' }} />;`, match: /TS2561|TS2353/ },
  ],
  'react-dts': [
    { name: 'label is a string', line: `export const bad = <SortableList announcements={{ moved: ({ label }) => label.toFixed() }} />;`, match: /Property 'toFixed' does not exist on type 'string'/ },
    { name: 'unknown kind', line: `export const bad = <SortableList announcements={{ mvoed: () => 'x' }} />;`, match: /TS2561|TS2353/ },
  ],
  solid: [
    { name: 'label is a string', line: `export const bad = <SortableList announcements={{ moved: ({ label }) => label.toFixed() }} />;`, match: /Property 'toFixed' does not exist on type 'string'/ },
    { name: 'unknown kind', line: `export const bad = <SortableList announcements={{ mvoed: () => 'x' }} />;`, match: /TS2561|TS2353/ },
  ],
  lit: [
    { name: 'label is a string', line: `el.announcements = { moved: ({ label }) => label.toFixed() };`, match: /Property 'toFixed' does not exist on type 'string'/ },
    { name: 'unknown kind', line: `el.announcements = { mvoed: () => 'x' };`, match: /TS2561|TS2353/ },
  ],
};

const CASES: Array<{ kind: Case; target: T; consumer: string; nm: string }> = [
  { kind: 'react', target: 'react', consumer: 'Consumer.tsx', nm: 'packages/ui/sortable-list/packages/react' },
  { kind: 'react-dts', target: 'react', consumer: 'Consumer.tsx', nm: 'packages/ui/sortable-list/packages/react' },
  { kind: 'solid', target: 'solid', consumer: 'Consumer.tsx', nm: 'packages/ui/sortable-list/packages/solid' },
  { kind: 'lit', target: 'lit', consumer: 'Consumer.ts', nm: 'packages/ui/sortable-list/packages/lit' },
];

describe('SORTABLE-LIST-ANNOUNCEMENTS — strict consumer of the announcements prop (react/solid/lit)', () => {
  for (const c of CASES) {
    describe(c.kind, () => {
      const ok = c.target === 'lit' ? LIT_OK('./SortableList') : JSX_OK('./SortableList');
      const run = (consumer: string, source?: string, extra: Record<string, string> = {}) =>
        typecheckCompiled({ target: c.target, files: { ...files(c.kind, source), ...extra, [c.consumer]: consumer }, nodeModulesFrom: c.nm });

      it('inline announcements are contextually typed and the types are importable', () => {
        const { raw, inventory } = run(ok);
        expect(consumerErrors(inventory, c.consumer), raw).toBe(0);
      });

      (c.kind === 'react-dts' ? it.skip : it)('the types are importable from the leaf barrel (src/index.ts)', () => {
        const index = readFileSync(resolve(ROOT, c.nm, 'src/index.ts'), 'utf8');
        const consumer = c.target === 'lit' ? LIT_OK('./index') : JSX_OK('./index', 'SortableList');
        const { raw, inventory } = run(consumer, undefined, { 'index.ts': index });
        expect(consumerErrors(inventory, c.consumer), raw).toBe(0);
      });

      for (const neg of NEG[c.kind]) {
        it(`negative fails for the right reason: ${neg.name}`, () => {
          const { raw, inventory } = run(`${ok}\n${neg.line}\n`);
          expect(consumerErrors(inventory, c.consumer)).toBeGreaterThan(0);
          expect(raw).toMatch(neg.match);
          expect(raw).not.toMatch(/TS2304|TS2305|TS2614|Cannot find name/);
        });
      }

      // Premise (the gate is not vacuous): with the old `type: Object` prop
      // (`Record<string, unknown>` in the React .d.ts, `Record<string, any>` in
      // the bodies) the inline arrow's destructured context is an implicit any.
      it('premise: with the old `type: Object` prop the inline arrow is TS7031', () => {
        const old = SRC.replace('type: Announcements,', 'type: Object,');
        expect(old).not.toBe(SRC);
        const head = c.target === 'lit'
          ? `import SortableList from './SortableList';\ndeclare const el: SortableList;\n`
          : `import SortableList from './SortableList';\n`;
        const { raw, inventory } = run(`${head}${NEG[c.kind][0]!.line}\n`, old);
        expect(consumerErrors(inventory, c.consumer)).toBeGreaterThan(0);
        expect(raw).toMatch(/Consumer\.tsx?\(\d+,\d+\): error TS7031: Binding element 'label' implicitly has an 'any' type/);
      });
    });
  }
});
