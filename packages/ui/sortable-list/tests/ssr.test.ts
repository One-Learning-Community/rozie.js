/**
 * Server-rendered markup must not carry the spoken-instructions id. The id
 * comes from a page-global counter, so a server and a browser count
 * differently: an id rendered on the server would not match the one the
 * browser renders (a hydration mismatch, and rows described by an id that
 * isn't on the page). The id is assigned when the list mounts, so server
 * output has neither the `id` nor any `aria-describedby`, and two renders in
 * one process produce the same markup.
 *
 * Renders the generated React leaf with react-dom/server (resolved from the
 * leaf package, so it shares the leaf's React).
 */
// @vitest-environment node
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const LEAF = resolve(dirname(fileURLToPath(import.meta.url)), '../packages/react');
const leafRequire = createRequire(resolve(LEAF, 'package.json'));

describe('server rendering (React leaf)', () => {
  it('renders no instructions id and no aria-describedby, the same markup twice', async () => {
    const React = leafRequire('react');
    const { renderToString } = leafRequire('react-dom/server');
    const { default: SortableList } = await import('../packages/react/src/SortableList');
    const render = () =>
      renderToString(
        React.createElement(SortableList, {
          items: [{ id: 'a', label: 'Apple' }, { id: 'b', label: 'Banana' }],
          itemKey: 'id',
          listLabel: 'Fruit',
          children: ({ item }: { item: { label: string } }) => React.createElement('span', null, item.label),
        }),
      );
    const first = render();
    expect(first).toContain('Apple');
    expect(first).not.toMatch(/aria-describedby=/);
    expect(first).not.toMatch(/\sid="/);
    expect(render()).toBe(first);
  });
});
