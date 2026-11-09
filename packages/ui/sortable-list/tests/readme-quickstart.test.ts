/**
 * README quick-starts work against the real leaves.
 *
 * Each leaf README's "## Usage" snippet is read from the rendered README on
 * disk (what npm shows) and checked against that leaf's generated source:
 *
 *   - svelte:  compiles with the leaf's Svelte compiler; every `{#snippet}`
 *              name is a snippet prop the leaf reads (`children`, not `default`).
 *   - vue:     the SFC compiles with the leaf's compiler-sfc.
 *   - angular: every `<ng-template #ref>` is a ref the leaf's `@ContentChild`
 *              queries, and every `(output)` is a leaf output.
 *   - react / solid: the snippet is transpiled and run against a stand-in
 *              `SortableList` that calls the row callback with the context the
 *              leaf passes (a plain `item` value); the row text renders.
 *   - lit:     the tag the snippet queries is the leaf's `@customElement`, each
 *              property it sets is a public leaf property, each event it
 *              listens for is one the leaf dispatches, and it fills rows
 *              through `rozieSlots.default`, which the leaf calls per row.
 *
 * Also checked per README: the peer line names every framework peer in the
 * leaf's package.json, and the events table names each event the way that
 * framework binds it.
 *
 * Strict typechecks of the React / Solid / Lit snippets live in
 * tests/strict-conformance/sortable-list-readme-usage.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const leaf = (t: string, f: string) => readFileSync(resolve(PKG, 'packages', t, f), 'utf8');
const readme = (t: string) => leaf(t, 'README.md');

/** The first fenced code block under `## Usage`. */
function usage(t: string): string {
  const md = readme(t);
  const at = md.indexOf('\n## Usage\n');
  expect(at, `${t} README has a Usage section`).toBeGreaterThan(-1);
  const m = md.slice(at).match(/```[a-z]*\n([\s\S]*?)\n```/);
  expect(m, `${t} README Usage has a code block`).toBeTruthy();
  return m![1]!;
}

const leafRequire = (t: string) => createRequire(resolve(PKG, 'packages', t, 'package.json'));

/** Run a TSX snippet with a stand-in SortableList; return the rendered row text. */
function renderJsx(code: string, deps: Record<string, unknown>, stub: unknown): string {
  const out = ts.transpileModule(code, {
    compilerOptions: { jsx: ts.JsxEmit.React, jsxFactory: 'h', module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  type Node = string | number | null | undefined | boolean | Node[] | { children: Node[] };
  const text = (n: Node): string =>
    n == null || typeof n === 'boolean' ? '' : Array.isArray(n) ? n.map(text).join('') : typeof n === 'object' ? text(n.children) : String(n);
  const h = (type: unknown, props: Record<string, unknown> | null, ...children: Node[]): Node => {
    if (type === stub) {
      const p = props ?? {};
      const items = typeof p.items === 'function' ? (p.items as () => unknown[])() : (p.items as unknown[]);
      const row = (children[0] ?? p.children) as (ctx: unknown) => Node;
      expect(typeof row, 'the snippet renders rows with a callback').toBe('function');
      // The context every leaf passes: a plain item value, not an accessor.
      return { children: items.map((item, index) => row({ item, index, instructionsId: null })) };
    }
    return { children };
  };
  const mod = { exports: {} as Record<string, unknown> };
  const req = (id: string) => {
    if (!(id in deps)) throw new Error(`unexpected import ${id}`);
    return deps[id];
  };
  new Function('require', 'module', 'exports', 'h', out)(req, mod, mod.exports, h);
  const Demo = mod.exports.Demo as () => Node;
  expect(typeof Demo).toBe('function');
  return text(Demo());
}

describe('README quick-starts work against the leaf', () => {
  it('svelte: compiles, and fills the default slot with the `children` snippet', async () => {
    const code = usage('svelte');
    const { compile } = (await import(pathToFileURL(leafRequire('svelte').resolve('svelte/compiler')).href)) as typeof import('svelte/compiler');
    expect(() => compile(code, { filename: 'Demo.svelte' })).not.toThrow();
    const src = leaf('svelte', 'src/SortableList.svelte');
    const snippetProps = [...src.matchAll(/^\s+(\w+)\?: Snippet</gm)].map((m) => m[1]);
    const used = [...code.matchAll(/\{#snippet (\w+)\(/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const name of used) expect(snippetProps).toContain(name);
  });

  it('vue: the SFC compiles', async () => {
    const sfc = (await import(pathToFileURL(leafRequire('vue').resolve('vue/compiler-sfc')).href)) as typeof import('vue/compiler-sfc');
    const { descriptor, errors } = sfc.parse(usage('vue'), { filename: 'Demo.vue' });
    expect(errors).toEqual([]);
    expect(() => sfc.compileScript(descriptor, { id: 'demo', inlineTemplate: true })).not.toThrow();
  });

  it('angular: template refs and outputs are the ones the leaf declares', () => {
    const code = usage('angular');
    const src = leaf('angular', 'src/SortableList.ts');
    const contentRefs = [...src.matchAll(/@ContentChild\('(\w+)'/g)].map((m) => m[1]);
    const outputs = [...src.matchAll(/^\s+(\w+) = output</gm)].map((m) => m[1]);
    const refs = [...code.matchAll(/<ng-template #(\w+)/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) expect(contentRefs).toContain(r);
    for (const [, o] of code.matchAll(/\((\w+)\)="/g)) expect(outputs).toContain(o);
    // The forms snippet uses the same row template.
    const forms = readme('angular').split('\n## Angular forms\n')[1] ?? '';
    for (const [, r] of forms.matchAll(/<ng-template #(\w+)/g)) expect(contentRefs).toContain(r);
  });

  it('react: rows render the item', () => {
    expect(leaf('react', 'src/SortableList.tsx')).toMatch(/\(\{ item, index, instructionsId \}\)/);
    const stub = () => null;
    const text = renderJsx(usage('react'), {
      react: { useState: (v: unknown) => [v, () => {}] },
      '@rozie-ui/sortable-list-react': { SortableList: stub, default: stub },
    }, stub);
    expect(text).toContain('Apple');
    expect(text).toContain('Banana');
  });

  it('solid: rows render the item (passed as a plain value, not an accessor)', () => {
    expect(leaf('solid', 'src/SortableList.tsx')).toMatch(/\(\{ item, get index\(\)/);
    const stub = () => null;
    const text = renderJsx(usage('solid'), {
      'solid-js': { createSignal: (v: unknown) => [() => v, () => {}] },
      '@rozie-ui/sortable-list-solid': { SortableList: stub, default: stub },
    }, stub);
    expect(text).toContain('Apple');
    expect(text).toContain('Banana');
  });

  it('lit: right tag, real properties and events, and a row renderer', () => {
    const code = usage('lit');
    const src = leaf('lit', 'src/SortableList.ts');
    const tag = src.match(/@customElement\('([\w-]+)'\)/)![1];
    const queried = [...code.matchAll(/querySelector(?:<\w+>)?\('([\w-]+)'\)/g)].map((m) => m[1]);
    expect(queried.length).toBeGreaterThan(0);
    for (const q of queried) expect(q).toBe(tag);
    const props = new Set([
      ...[...src.matchAll(/@property\([^)]*\) (\w+)[?!]?:/g)].map((m) => m[1]),
      ...[...src.matchAll(/^\s+set (\w+)\(/gm)].map((m) => m[1]),
    ]);
    const set = [...code.matchAll(/\bel\.(\w+) =/g)].map((m) => m[1]);
    for (const p of set) expect([...props]).toContain(p);
    const events = new Set([
      ...[...src.matchAll(/new CustomEvent\("([\w-]+)"/g)].map((m) => m[1]),
      ...[...src.matchAll(/eventName: '([\w-]+)'/g)].map((m) => m[1]),
    ]);
    for (const [, e] of code.matchAll(/addEventListener\('([\w-]+)'/g)) expect([...events]).toContain(e);
    // Rows get content: the leaf tries `rozieSlots['default'](ctx)` first per row.
    expect(src).toMatch(/this\.rozieSlots\?\.\['default'\] !== undefined \? this\.rozieSlots\?\.\['default'\]!\(\{item: item/);
    expect(set).toContain('rozieSlots');
    expect(code).toMatch(/el\.rozieSlots = \{\s*default: \(\{ item \}\) =>/);
    expect(code).not.toContain('__rozieDefaultSlot__');
    expect(() => ts.transpileModule(code, { reportDiagnostics: true })).not.toThrow();
  });
});

describe('README install and events sections match the leaf', () => {
  const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const;

  for (const t of TARGETS) {
    it(`${t}: the peer line names every peer dependency`, () => {
      const pkg = JSON.parse(leaf(t, 'package.json')) as { peerDependencies: Record<string, string> };
      const line = readme(t).split('\n').find((l) => l.startsWith('Peer dependencies:')) ?? '';
      for (const name of Object.keys(pkg.peerDependencies)) expect(line).toContain(name);
    });
  }

  it('angular: @angular/forms is a peer (the leaf imports it)', () => {
    expect(leaf('angular', 'src/SortableList.ts')).toMatch(/from '@angular\/forms'/);
    const pkg = JSON.parse(leaf('angular', 'package.json')) as { peerDependencies: Record<string, string> };
    expect(pkg.peerDependencies['@angular/forms']).toBeTruthy();
  });

  const BINDING: Record<(typeof TARGETS)[number], { names: string[]; file: string }> = {
    react: { names: ['onReorder', 'onAdd', 'onRemove', 'onStart', 'onEnd', 'onItemsChange'], file: 'src/SortableList.d.ts' },
    vue: { names: ["'reorder'", "'add'", "'remove'", "'start'", "'end'", "'update:items'"], file: 'src/SortableList.vue' },
    svelte: { names: ['onreorder', 'onadd', 'onremove', 'onstart', 'onend'], file: 'src/SortableList.svelte' },
    angular: { names: ['reorder = output', 'add = output', 'remove = output', 'start = output', 'end = output', 'itemsChange = output'], file: 'src/SortableList.ts' },
    solid: { names: ['onReorder', 'onAdd', 'onRemove', 'onStart', 'onEnd', 'onItemsChange'], file: 'src/SortableList.tsx' },
    lit: { names: ['"reorder"', '"add"', '"remove"', '"start"', '"end"', "'items-change'"], file: 'src/SortableList.ts' },
  };
  const README_NAME: Record<(typeof TARGETS)[number], string[]> = {
    react: ['`onReorder`', '`onAdd`', '`onRemove`', '`onStart`', '`onEnd`', '`onItemsChange`'],
    vue: ['`@reorder`', '`@add`', '`@remove`', '`@start`', '`@end`', '`@update:items`'],
    svelte: ['`onreorder`', '`onadd`', '`onremove`', '`onstart`', '`onend`', '`bind:items`'],
    angular: ['`(reorder)`', '`(add)`', '`(remove)`', '`(start)`', '`(end)`', '`(itemsChange)`'],
    solid: ['`onReorder`', '`onAdd`', '`onRemove`', '`onStart`', '`onEnd`', '`onItemsChange`'],
    lit: ['`reorder`', '`add`', '`remove`', '`start`', '`end`', '`items-change`'],
  };
  for (const t of TARGETS) {
    it(`${t}: the events table uses the framework's binding names, and the leaf has them`, () => {
      const src = leaf(t, BINDING[t].file);
      for (const n of BINDING[t].names) expect(src).toContain(n);
      const md = readme(t);
      const events = md.slice(md.indexOf('\n## Events\n'), md.indexOf('\n## ', md.indexOf('\n## Events\n') + 3));
      for (const n of README_NAME[t]) expect(events).toContain(n);
      expect(events).toMatch(/payload/i);
    });
  }
});
