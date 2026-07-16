/**
 * command-palette-portal-overlay phase — roziePortal unit tests (Svelte 5
 * action runtime).
 *
 * Mirrors applyListeners.test.ts's fully-synthetic mock-node convention (no
 * happy-dom/jsdom dependency) — a minimal fake DOM tree implementing only
 * the Node methods roziePortal touches (appendChild/insertBefore/
 * removeChild/parentNode/nextSibling/isConnected).
 */
import { describe, it, expect } from 'vitest';
import { roziePortal } from '../roziePortal.js';

interface FakeNode {
  children: FakeNode[];
  parentNode: FakeNode | null;
  isConnected: boolean;
  appendChild(child: FakeNode): void;
  insertBefore(child: FakeNode, ref: FakeNode | null): void;
  removeChild(child: FakeNode): void;
  readonly nextSibling: FakeNode | null;
}

function makeNode(name: string): FakeNode {
  const node: FakeNode = {
    children: [],
    parentNode: null,
    isConnected: true,
    appendChild(child: FakeNode) {
      if (child.parentNode) child.parentNode.removeChild(child);
      node.children.push(child);
      child.parentNode = node;
    },
    insertBefore(child: FakeNode, ref: FakeNode | null) {
      if (child.parentNode) child.parentNode.removeChild(child);
      const idx = ref ? node.children.indexOf(ref) : -1;
      if (idx === -1) node.children.push(child);
      else node.children.splice(idx, 0, child);
      child.parentNode = node;
    },
    removeChild(child: FakeNode) {
      const idx = node.children.indexOf(child);
      if (idx !== -1) node.children.splice(idx, 1);
      child.parentNode = null;
    },
    get nextSibling(): FakeNode | null {
      if (!node.parentNode) return null;
      const idx = node.parentNode.children.indexOf(node);
      return node.parentNode.children[idx + 1] ?? null;
    },
  };
  // Named for debug clarity only.
  (node as unknown as { name: string }).name = name;
  return node;
}

describe('roziePortal (Svelte 5 action) — command-palette-portal-overlay', () => {
  it('a truthy container on initial attach moves the node into it', () => {
    const parent = makeNode('parent');
    const sibling = makeNode('sibling');
    const node = makeNode('portalled');
    const container = makeNode('container');
    parent.appendChild(node);
    parent.appendChild(sibling);

    const action = roziePortal(node as unknown as Element, container as unknown as Element);

    expect(node.parentNode).toBe(container);
    expect(container.children).toContain(node);
    expect(action.update).toBeTypeOf('function');
    expect(action.destroy).toBeTypeOf('function');
  });

  it('a falsy container on initial attach is a no-op — the node stays in its natural position', () => {
    const parent = makeNode('parent');
    const node = makeNode('portalled');
    parent.appendChild(node);

    roziePortal(node as unknown as Element, null);

    expect(node.parentNode).toBe(parent);
  });

  it('update() moves the node when the container transitions falsy -> truthy', () => {
    const parent = makeNode('parent');
    const node = makeNode('portalled');
    const container = makeNode('container');
    parent.appendChild(node);

    const action = roziePortal(node as unknown as Element, null);
    expect(node.parentNode).toBe(parent);

    action.update(container as unknown as Element);
    expect(node.parentNode).toBe(container);
  });

  it('update() restores the node to its ORIGINAL anchor position when the container transitions truthy -> falsy', () => {
    const parent = makeNode('parent');
    const before = makeNode('before');
    const node = makeNode('portalled');
    const after = makeNode('after');
    const container = makeNode('container');
    parent.appendChild(before);
    parent.appendChild(node);
    parent.appendChild(after);

    const action = roziePortal(node as unknown as Element, container as unknown as Element);
    expect(node.parentNode).toBe(container);

    action.update(null);
    expect(node.parentNode).toBe(parent);
    // Restored BEFORE `after` — insertBefore(nextSibling) anchor, not appendChild.
    expect(parent.children.indexOf(node)).toBe(parent.children.indexOf(after) - 1);
  });

  it('destroy() removes the node from wherever it currently lives', () => {
    const parent = makeNode('parent');
    const node = makeNode('portalled');
    const container = makeNode('container');
    parent.appendChild(node);

    const action = roziePortal(node as unknown as Element, container as unknown as Element);
    expect(node.parentNode).toBe(container);

    action.destroy();
    expect(node.parentNode).toBeNull();
    expect(container.children).not.toContain(node);
  });
});
