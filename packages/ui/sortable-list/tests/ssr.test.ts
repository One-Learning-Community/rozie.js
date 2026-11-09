/**
 * Server-rendered markup must not carry the spoken-instructions id. The id
 * comes from a page-global counter, so a server and a browser count
 * differently: an id rendered on the server would not match the one the
 * browser renders (a hydration mismatch, and rows described by an id that
 * isn't on the page). The id is assigned when the list mounts, so server
 * output has neither the `id` nor any `aria-describedby`, and two renders in
 * one process produce the same markup.
 *
 * Renders the generated React, Vue, Svelte and Solid leaves with their own
 * server renderers (resolved from each leaf package, so a leaf shares its
 * framework instance). The Vue SFC, the Svelte component and the Solid TSX
 * are compiled here for the server (`vue/compiler-sfc` with `ssr: true`,
 * `svelte/compiler` with `generate: 'server'`, `babel-preset-solid` with
 * `generate: 'ssr'`) into a scratch folder inside the leaf package (removed
 * afterwards), so their bare imports resolve from the leaf. Angular and Lit
 * have no server render path in this repo.
 */
// @vitest-environment node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const PACKAGES = resolve(dirname(fileURLToPath(import.meta.url)), '../packages');
const leafRequire = (leaf: string) => createRequire(resolve(PACKAGES, leaf, 'package.json'));

const ITEMS = [{ id: 'a', label: 'Apple' }, { id: 'b', label: 'Banana' }];

/** The assertions every server render must meet. */
async function expectServerSafe(render: () => string | Promise<string>) {
  const first = await render();
  expect(first).toContain('Apple');
  expect(first).toContain('Banana');
  expect(first).toContain('role="listitem"');
  expect(first).not.toMatch(/aria-describedby=/);
  expect(first).not.toMatch(/\sid="/);
  expect(await render()).toBe(first);
}

const scratchDirs: string[] = [];
/** Write `code` as `name` in a scratch folder of `leaf`; `./internal/` imports point at the leaf's src. */
function scratch(leaf: string, name: string, code: string): string {
  const dir = resolve(PACKAGES, leaf, '.ssr-test');
  mkdirSync(dir, { recursive: true });
  if (!scratchDirs.includes(dir)) scratchDirs.push(dir);
  const file = resolve(dir, name);
  writeFileSync(file, code.replaceAll("'./internal/", "'../src/internal/").replaceAll('"./internal/', '"../src/internal/'));
  return file;
}

afterAll(() => {
  for (const d of scratchDirs) rmSync(d, { recursive: true, force: true });
});

describe('server rendering', () => {
  it('React leaf: no instructions id, no aria-describedby, the same markup twice', async () => {
    const req = leafRequire('react');
    const React = req('react');
    const { renderToString } = req('react-dom/server');
    const { default: SortableList } = await import('../packages/react/src/SortableList');
    await expectServerSafe(() =>
      renderToString(
        React.createElement(SortableList, {
          items: ITEMS,
          itemKey: 'id',
          listLabel: 'Fruit',
          children: ({ item }: { item: { label: string } }) => React.createElement('span', null, item.label),
        }),
      ),
    );
  });

  it('Vue leaf: no instructions id, no aria-describedby, the same markup twice', async () => {
    const req = leafRequire('vue');
    const sfc = req('vue/compiler-sfc');
    const filename = resolve(PACKAGES, 'vue/src/SortableList.vue');
    const { descriptor, errors } = sfc.parse(readFileSync(filename, 'utf8'), { filename });
    expect(errors).toEqual([]);
    const script = sfc.compileScript(descriptor, {
      id: 'ssr-test',
      inlineTemplate: true,
      templateOptions: { ssr: true, compilerOptions: { isTS: true } },
    });
    const file = scratch('vue', 'SortableList.ssr.ts', script.content);
    const { default: SortableList } = await import(/* @vite-ignore */ file);
    const { createSSRApp, h } = await import(/* @vite-ignore */ req.resolve('vue'));
    const { renderToString } = await import(/* @vite-ignore */ req.resolve('vue/server-renderer'));
    await expectServerSafe(() =>
      renderToString(
        createSSRApp({
          render: () =>
            h(
              SortableList,
              { items: ITEMS, itemKey: 'id', listLabel: 'Fruit' },
              { default: ({ item }: { item: { label: string } }) => h('span', item.label) },
            ),
        }),
      ),
    );
  });

  it('Solid leaf: no instructions id, no aria-describedby, the same markup twice', async () => {
    const req = leafRequire('solid');
    const babel = req('@babel/core');
    const filename = resolve(PACKAGES, 'solid/src/SortableList.tsx');
    const out = babel.transformSync(readFileSync(filename, 'utf8'), {
      filename,
      babelrc: false,
      configFile: false,
      presets: [
        [req.resolve('babel-preset-solid'), { generate: 'ssr', hydratable: true }],
        [req.resolve('@babel/preset-typescript'), { isTSX: true, allExtensions: true }],
      ],
    });
    const file = scratch('solid', 'SortableList.ssr.js', out.code);
    const { default: SortableList } = await import(/* @vite-ignore */ file);
    const web = await import(/* @vite-ignore */ resolve(dirname(req.resolve('solid-js/package.json')), 'web/dist/server.js'));
    await expectServerSafe(() =>
      web.renderToString(() =>
        web.createComponent(SortableList, {
          items: ITEMS,
          itemKey: 'id',
          listLabel: 'Fruit',
          children: ({ item }: { item: { label: string } }) => web.ssr(['<span>', '</span>'], web.escape(item.label)),
        }),
      ),
    );
  });

  it('Svelte leaf: no instructions id, no aria-describedby, the same markup twice', async () => {
    const req = leafRequire('svelte');
    const { compile } = await import(/* @vite-ignore */ req.resolve('svelte/compiler'));
    const filename = resolve(PACKAGES, 'svelte/src/SortableList.svelte');
    const out = compile(readFileSync(filename, 'utf8'), { filename, generate: 'server', dev: false });
    const file = scratch('svelte', 'SortableList.ssr.js', out.js.code);
    const { default: SortableList } = await import(/* @vite-ignore */ file);
    const { render } = await import(/* @vite-ignore */ resolve(dirname(req.resolve('svelte/package.json')), 'src/server/index.js'));
    const { createRawSnippet } = await import(/* @vite-ignore */ resolve(dirname(req.resolve('svelte/package.json')), 'src/index-server.js'));
    const children = createRawSnippet((ctx: () => { item: { label: string } }) => ({
      render: () => `<span>${ctx().item.label}</span>`,
    }));
    await expectServerSafe(() => render(SortableList, { props: { items: ITEMS, itemKey: 'id', listLabel: 'Fruit', children } }).body);
  });
});
