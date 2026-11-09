/**
 * SORTABLE-LIST-README-USAGE — the React / Solid / Lit README quick-starts
 * typecheck under strict TS against the compiled component.
 *
 * The "## Usage" snippet is read from each leaf's rendered README (what npm
 * shows). Its package import is pointed at the leaf barrel (src/index.ts)
 * next to `compile(SortableList.rozie)`. Only the snippet's own errors count
 * (memory: no cosmetic tsc on emitted bodies). Runtime checks of the same
 * snippets live in packages/ui/sortable-list/tests/readme-quickstart.test.ts.
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

function usage(t: T): string {
  const md = readFileSync(resolve(PKG, 'packages', t, 'README.md'), 'utf8');
  const m = md.slice(md.indexOf('\n## Usage\n')).match(/```[a-z]*\n([\s\S]*?)\n```/);
  expect(m).toBeTruthy();
  return m![1]!.replaceAll(`'@rozie-ui/sortable-list-${t}'`, `'./index'`);
}

const consumerErrors = (inv: Inventory, consumer: string) =>
  Object.entries(inv)
    .filter(([file]) => file.includes(consumer))
    .reduce((n, [, codes]) => n + Object.values(codes).reduce((s, c) => s + c, 0), 0);

describe('SORTABLE-LIST-README-USAGE — README quick-starts typecheck strictly', () => {
  for (const t of ['react', 'solid', 'lit'] as const) {
    it(t, () => {
      const r = compile(SRC, { target: t, filename: 'SortableList.rozie', sourceMap: false });
      expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      const nm = `packages/ui/sortable-list/packages/${t}`;
      const files: Record<string, string> = {
        [t === 'lit' ? 'SortableList.ts' : 'SortableList.tsx']: r.code.replaceAll("'./internal/", "'./"),
        'index.ts': readFileSync(resolve(ROOT, nm, 'src/index.ts'), 'utf8'),
      };
      for (const f of INTERNALS) files[f] = readFileSync(resolve(PKG, 'src/internal', f), 'utf8');
      const consumer = t === 'lit' ? 'Usage.ts' : 'Usage.tsx';
      files[consumer] = usage(t);
      const { raw, inventory } = typecheckCompiled({ target: t, files, nodeModulesFrom: nm });
      expect(consumerErrors(inventory, consumer), raw).toBe(0);
    });
  }
});
