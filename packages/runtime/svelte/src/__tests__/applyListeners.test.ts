/**
 * Plan 15-04 Task 1 — applyListeners unit tests (Svelte 5 action runtime).
 *
 * Covers the Phase 15 D-11 lock: a Svelte 5 action attaching an
 * event-listener object to a node with diff-on-update + destroy-on-detach
 * lifecycle.
 *
 * The runtime-svelte package has no `happy-dom` / `jsdom` devDep, so this
 * test uses a fully-synthetic mock node implementing only the two
 * `addEventListener` / `removeEventListener` methods the action touches.
 * Pure vi.fn() spies + assertion — zero DOM-environment churn.
 *
 * SECURITY (T-15-V5-03) — prototype-pollution: `__proto__` / `constructor` /
 * `prototype` keys must be SKIPPED in both the initial attach and inside
 * `update(next)`.
 *
 * CLEANUP (T-15-V5-04) — listener leak: `destroy()` invokes every captured
 * disposer and clears the per-instance Map. A follow-up `update(...)` after
 * destroy must NOT re-fire removeEventListener (the Map is already empty).
 */
import { describe, it, expect, vi } from 'vitest';
import { applyListeners } from '../applyListeners.js';

interface MockNode {
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

function makeNode(): MockNode {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

describe('applyListeners (Svelte 5 action) — Plan 15-04 Task 1', () => {
  it('initial attach calls addEventListener per entry', () => {
    const node = makeNode();
    const click = vi.fn();
    const hover = vi.fn();
    const action = applyListeners(node as unknown as Element, { click, mouseenter: hover });

    expect(node.addEventListener).toHaveBeenCalledTimes(2);
    expect(node.addEventListener).toHaveBeenCalledWith('click', click);
    expect(node.addEventListener).toHaveBeenCalledWith('mouseenter', hover);
    expect(action.update).toBeTypeOf('function');
    expect(action.destroy).toBeTypeOf('function');
  });

  it('update({click: g}) where g !== prior calls removeEventListener then addEventListener', () => {
    const node = makeNode();
    const f = vi.fn();
    const g = vi.fn();
    const action = applyListeners(node as unknown as Element, { click: f });
    node.addEventListener.mockClear();

    action.update({ click: g });

    expect(node.removeEventListener).toHaveBeenCalledWith('click', f);
    expect(node.addEventListener).toHaveBeenCalledWith('click', g);
  });

  it('update({mouseenter: h}) on a prior {click: fn} removes click and adds mouseenter', () => {
    const node = makeNode();
    const click = vi.fn();
    const hover = vi.fn();
    const action = applyListeners(node as unknown as Element, { click });
    node.addEventListener.mockClear();

    action.update({ mouseenter: hover });

    expect(node.removeEventListener).toHaveBeenCalledWith('click', click);
    expect(node.addEventListener).toHaveBeenCalledWith('mouseenter', hover);
  });

  it('update({}) removes all listeners', () => {
    const node = makeNode();
    const click = vi.fn();
    const hover = vi.fn();
    const action = applyListeners(node as unknown as Element, { click, mouseenter: hover });

    action.update({});

    expect(node.removeEventListener).toHaveBeenCalledWith('click', click);
    expect(node.removeEventListener).toHaveBeenCalledWith('mouseenter', hover);
  });

  it('update(null) and update(undefined) remove all listeners (CR-03 null-safety)', () => {
    const node = makeNode();
    const click = vi.fn();
    const action = applyListeners(node as unknown as Element, { click });

    action.update(null);
    expect(node.removeEventListener).toHaveBeenCalledWith('click', click);

    // After update(null), all disposers gone — update(undefined) is a no-op.
    node.removeEventListener.mockClear();
    action.update(undefined);
    expect(node.removeEventListener).not.toHaveBeenCalled();
  });

  it('destroy() invokes removeEventListener for every captured listener', () => {
    const node = makeNode();
    const click = vi.fn();
    const hover = vi.fn();
    const action = applyListeners(node as unknown as Element, { click, mouseenter: hover });

    action.destroy();

    expect(node.removeEventListener).toHaveBeenCalledWith('click', click);
    expect(node.removeEventListener).toHaveBeenCalledWith('mouseenter', hover);
    expect(node.removeEventListener).toHaveBeenCalledTimes(2);
  });

  it('destroy() clears the disposers Map — a follow-up update does NOT re-fire removeEventListener', () => {
    const node = makeNode();
    const click = vi.fn();
    const action = applyListeners(node as unknown as Element, { click });

    action.destroy();
    expect(node.removeEventListener).toHaveBeenCalledTimes(1);

    node.removeEventListener.mockClear();
    // Map is empty — update({}) finds nothing to remove.
    action.update({});
    expect(node.removeEventListener).not.toHaveBeenCalled();
  });

  it('same-reference handler in update(...) is NOT removed+re-added (diff-by-reference)', () => {
    const node = makeNode();
    const click = vi.fn();
    const action = applyListeners(node as unknown as Element, { click });
    node.addEventListener.mockClear();
    node.removeEventListener.mockClear();

    // Pass the exact same handler reference — should be a no-op.
    action.update({ click });

    expect(node.addEventListener).not.toHaveBeenCalled();
    expect(node.removeEventListener).not.toHaveBeenCalled();
  });

  it('SECURITY: __proto__ key in initial attach is SKIPPED', () => {
    const node = makeNode();
    const fn = vi.fn();
    const malicious = JSON.parse('{ "__proto__": null, "click": null }') as Record<
      string,
      unknown
    >;
    malicious.click = fn;
    applyListeners(
      node as unknown as Element,
      malicious as Record<string, EventListener>,
    );

    expect(node.addEventListener).toHaveBeenCalledWith('click', fn);
    expect(node.addEventListener).not.toHaveBeenCalledWith(
      '__proto__',
      expect.anything(),
    );
  });

  it('SECURITY: constructor and prototype keys in update() are SKIPPED', () => {
    const node = makeNode();
    const fn = vi.fn();
    const action = applyListeners(node as unknown as Element, { click: fn });
    node.addEventListener.mockClear();

    action.update({
      constructor: 'evil',
      prototype: 'evil',
      click: fn,
    } as unknown as Record<string, EventListener>);

    // click handler is the same reference — no re-add. constructor/prototype
    // must NOT have triggered addEventListener.
    expect(node.addEventListener).not.toHaveBeenCalledWith(
      'constructor',
      expect.anything(),
    );
    expect(node.addEventListener).not.toHaveBeenCalledWith(
      'prototype',
      expect.anything(),
    );
  });

  it('accepts null/undefined as initial obj parameter (CR-03 null-safety)', () => {
    const nodeA = makeNode();
    const nodeB = makeNode();
    const actionA = applyListeners(nodeA as unknown as Element, null);
    const actionB = applyListeners(nodeB as unknown as Element, undefined);

    // No initial entries → no addEventListener calls.
    expect(nodeA.addEventListener).not.toHaveBeenCalled();
    expect(nodeB.addEventListener).not.toHaveBeenCalled();

    // update + destroy still well-defined.
    const fn = vi.fn();
    actionA.update({ click: fn });
    expect(nodeA.addEventListener).toHaveBeenCalledWith('click', fn);

    actionB.destroy(); // no-op (empty disposers Map) — must not throw.
    expect(nodeB.removeEventListener).not.toHaveBeenCalled();
  });
});
