/**
 * `useSortableJS` runtime-helper contract.
 *
 * The helper is the cross-target bridge between SortableJS and Rozie's
 * reactive items array. Its contract collapses three fragile inline
 * handlers (`onUpdate`, `onAdd`, `onRemove`) into a single `onEnd`-driven
 * path and hardens against the SortableJS fallback-event quirks that
 * caused the duplicate-on-drop bug (`sortable-nested-solid-deeper` VR
 * spec):
 *
 *   1. Same-list reorder → `onCommit(reorderedArray)` + `onChange({ kind: 'reorder' })`.
 *   2. Cross-list source side → `onCommit(shorterArray)` + `onChange({ kind: 'remove' })`.
 *   3. Cross-list destination side → `onCommit(longerArray)` + `onChange({ kind: 'add' })`.
 *   4. Fragile event (e.item.remove throws) → `onCommit` STILL fires; no throw escapes.
 *   5. Fragile event (e.oldIndex null) → identity-match via `__rozieItem` stash locates the moved item.
 *   6. Destroy clears the SortableJS instance.
 *
 * We exercise the contract by mocking SortableJS itself (constructor +
 * fired events) rather than by leaning on the real SortableJS, because
 * SortableJS's HTML5 DnD path can't fire in happy-dom. The mock pretends
 * to be SortableJS, captures the helper-registered `onStart` + `onEnd`
 * callbacks, then synthesises `SortableEvent`-shaped objects for them.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We mock the SortableJS module BEFORE importing the helper so the
// helper's `new SortableJS(...)` call hits our fake.
vi.mock('sortablejs', () => {
  // Each `new SortableJS(...)` captures its options blob and exposes it
  // back to the test via the global registry below. We don't try to
  // reproduce SortableJS's drag detection — the test directly invokes
  // the helper-registered handlers with synthesised events.
  const constructed: Array<{
    listEl: HTMLElement;
    options: Record<string, unknown>;
    destroyed: boolean;
    optionCalls: Array<{ name: string; value: unknown }>;
  }> = [];
  // biome-ignore lint/style/useNamingConvention: matches SortableJS API
  class MockSortable {
    static get(el: unknown): unknown {
      return (el as { __mockSortable?: unknown } | null)?.__mockSortable;
    }
    constructor(listEl: HTMLElement, options: Record<string, unknown>) {
      const rec = { listEl, options, destroyed: false, optionCalls: [] };
      constructed.push(rec);
      // Expose THIS instance's options + destroy state via `(this as any).__rec`
      // so tests can fish them out from the returned `instance`.
      (this as unknown as { __rec: typeof rec }).__rec = rec;
    }
    destroy(): void {
      (this as unknown as { __rec: { destroyed: boolean } }).__rec.destroyed = true;
    }
    option(name: string, value: unknown): void {
      (this as unknown as { __rec: { optionCalls: Array<{ name: string; value: unknown }> } }).__rec.optionCalls.push({
        name,
        value,
      });
    }
  }
  return {
    default: MockSortable,
    __getConstructed: () => constructed,
    __reset: () => {
      constructed.length = 0;
    },
  };
});

// Late import so the mock is in place.
import { orderByKeys, reapplyOptions, useSortableJS, type SortableChange, type SortableDrag } from './useSortableJS.js';
// Late import of the mock helpers for inspection.
import * as SortableJSMock from 'sortablejs';

interface MockRec {
  listEl: HTMLElement;
  options: {
    onStart?: (e: unknown) => void;
    onEnd?: (e: unknown) => void;
  } & Record<string, unknown>;
  destroyed: boolean;
  optionCalls: Array<{ name: string; value: unknown }>;
}

function getLastConstructed(): MockRec {
  const arr = (SortableJSMock as unknown as { __getConstructed: () => MockRec[] }).__getConstructed();
  const rec = arr[arr.length - 1];
  if (!rec) throw new Error('SortableJS was not constructed');
  return rec;
}

function resetSortable(): void {
  (SortableJSMock as unknown as { __reset: () => void }).__reset();
}

/** Helper to build a list element with N children. Each child is a
 * `<div data-id="...">` so we can identity-match easily. */
function buildList(items: Array<{ id: string }>): HTMLElement {
  const el = document.createElement('div');
  for (const item of items) {
    const child = document.createElement('div');
    child.className = 'rozie-sortable-item';
    child.setAttribute('data-id', item.id);
    el.appendChild(child);
  }
  return el;
}

interface Item {
  id: string;
}

beforeEach(() => {
  resetSortable();
});

/** Drain queued microtasks so deferred `onCommit` / `afterCommit` /
 * `onChange` callbacks observable in tests. The helper defers these via
 * `queueMicrotask` to avoid disrupting SortableJS's internal `_onDrop`
 * sequencing — see useSortableJS.ts for the cross-instance
 * `Sortable.active` nulling hazard. */
async function flushMicrotasks(): Promise<void> {
  // `onEnd` runs in a task (setTimeout 0) scheduled after the commit.
  for (let i = 0; i < 6; i++) await Promise.resolve();
  // `onEnd` waits a timer, then a posted message.
  await new Promise((res) => setTimeout(res, 20));
}

describe('useSortableJS', () => {
  it('same-list reorder: onCommit fires with reordered array; onChange kind=reorder', async () => {
    const items: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const listEl = buildList(items);
    const commits: Item[][] = [];
    const changes: Array<SortableChange<Item>> = [];

    const handle = useSortableJS<Item>(listEl, {
      items: () => items,
      onCommit: (next) => {
        commits.push(next);
      },
      onChange: (info) => {
        changes.push(info);
      },
    });

    const rec = getLastConstructed();
    expect(typeof rec.options.onStart).toBe('function');
    expect(typeof rec.options.onEnd).toBe('function');

    // Simulate: drag children[0] → position 2. SortableJS itself moves the
    // DOM node first; we simulate that mutation.
    const dragged = listEl.children[0] as HTMLElement;
    rec.options.onStart?.({ item: dragged, oldIndex: 0, from: listEl, to: listEl });
    // SortableJS physically moves the node (append at end of position 2).
    listEl.appendChild(dragged); // now at index 2
    rec.options.onEnd?.({
      item: dragged,
      oldIndex: 0,
      newIndex: 2,
      from: listEl,
      to: listEl,
    });
    await flushMicrotasks();

    expect(commits.length).toBe(1);
    expect(commits[0]!.map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect(changes.length).toBe(1);
    expect(changes[0]!.kind).toBe('reorder');
    expect(changes[0]!.oldIndex).toBe(0);
    expect(changes[0]!.newIndex).toBe(2);
    expect(changes[0]!.item?.id).toBe('a');

    // Stash cleared in `finally`.
    expect((dragged as unknown as Record<string, unknown>).__rozieItem).toBeUndefined();

    handle.destroy();
  });

  it('cross-list source side: splices item OUT; onChange kind=remove', async () => {
    const sourceItems: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const sourceListEl = buildList(sourceItems);
    const destListEl = buildList([]);
    // The destination is a SortableList too (a drop into any other list is refused).
    useSortableJS<Item>(destListEl, { items: () => [], onCommit: () => {} });

    const commits: Item[][] = [];
    const changes: Array<SortableChange<Item>> = [];

    useSortableJS<Item>(sourceListEl, {
      items: () => sourceItems,
      onCommit: (next) => {
        commits.push(next);
      },
      onChange: (info) => {
        changes.push(info);
      },
    });

    const rec = getLastConstructed();
    // Simulate: drag children[1] (item 'b') out to dest list.
    const dragged = sourceListEl.children[1] as HTMLElement;
    rec.options.onStart?.({
      item: dragged,
      oldIndex: 1,
      from: sourceListEl,
      to: sourceListEl,
    });
    // SortableJS detaches dragged from sourceList and inserts into destList.
    destListEl.appendChild(dragged);
    // Source-side onEnd: e.from === sourceListEl, e.to === destListEl.
    rec.options.onEnd?.({
      item: dragged,
      oldIndex: 1,
      newIndex: 0,
      from: sourceListEl,
      to: destListEl,
    });
    await flushMicrotasks();

    expect(commits.length).toBe(1);
    expect(commits[0]!.map((x) => x.id)).toEqual(['a', 'c']);
    expect(changes[0]!.kind).toBe('remove');
    expect(changes[0]!.oldIndex).toBe(1);
    expect(changes[0]!.item?.id).toBe('b');
  });

  it('cross-list destination side: splices item IN at newIndex; onChange kind=add (fires from onAdd, not onEnd)', async () => {
    const destItems: Item[] = [{ id: 'x' }, { id: 'y' }];
    const sourceListEl = buildList([{ id: 'movedItem' }]);
    const destListEl = buildList(destItems);

    const commits: Item[][] = [];
    const changes: Array<SortableChange<Item>> = [];

    useSortableJS<Item>(destListEl, {
      items: () => destItems,
      onCommit: (next) => {
        commits.push(next);
      },
      onChange: (info) => {
        changes.push(info);
      },
    });

    const rec = getLastConstructed();
    // The destination list's `onStart` does NOT fire — the drag started in
    // the source list. We have to stash the item DATA on `e.item` manually
    // because the source list's onStart did that in the real flow.
    const dragged = sourceListEl.children[0] as HTMLElement;
    const movedData: Item = { id: 'movedItem' };
    (dragged as unknown as Record<string, unknown>).__rozieItem = movedData;
    // SortableJS moves dragged into destListEl at position 1.
    destListEl.insertBefore(dragged, destListEl.children[1] ?? null);
    // Destination side receives `onAdd` (not `onEnd`). `onEnd` only fires
    // on the source list in cross-list moves.
    (rec.options as { onAdd?: (e: unknown) => void }).onAdd?.({
      item: dragged,
      oldIndex: 0,
      newIndex: 1,
      from: sourceListEl,
      to: destListEl,
    });
    await flushMicrotasks();

    expect(commits.length).toBe(1);
    expect(commits[0]!.map((x) => x.id)).toEqual(['x', 'movedItem', 'y']);
    expect(changes[0]!.kind).toBe('add');
    expect(changes[0]!.newIndex).toBe(1);
    expect(changes[0]!.item?.id).toBe('movedItem');

    // Critical invariant: `__rozieItem` stash MUST remain readable on
    // `e.item` after the destination's onAdd fires — the source's later
    // onEnd still needs to read it (or at least: it shouldn't have been
    // cleared yet). Source-side `onEnd` clears in its own finally block.
    expect((dragged as unknown as Record<string, unknown>).__rozieItem).toBe(movedData);
  });

  it('fragile event (e.oldIndex is null) — identity-match via __rozieItem locates the moved item', async () => {
    const items: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const listEl = buildList(items);
    const commits: Item[][] = [];

    useSortableJS<Item>(listEl, {
      items: () => items,
      onCommit: (next) => {
        commits.push(next);
      },
    });

    const rec = getLastConstructed();
    const dragged = listEl.children[1] as HTMLElement;
    // Stash manually (simulating onStart having run with a valid oldIndex).
    (dragged as unknown as Record<string, unknown>).__rozieItem = items[1];
    // SortableJS has moved the row to the end of the list.
    listEl.appendChild(dragged);
    // Now fire onEnd with null oldIndex/newIndex.
    rec.options.onEnd?.({
      item: dragged,
      oldIndex: null,
      newIndex: null,
      from: listEl,
      to: listEl,
    });
    await flushMicrotasks();

    // With null indices and identity-match, we recover the source index
    // (1, since items[1] === stashedItem). With null newIndex, we append
    // to the end (length after removal = 2 → target idx 2).
    expect(commits.length).toBe(1);
    expect(commits[0]!.map((x) => x.id)).toEqual(['a', 'c', 'b']);
  });

  it('fragile event (DOM-restore throws): onCommit STILL fires; no throw escapes', async () => {
    const items: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const listEl = buildList(items);
    const commits: Item[][] = [];

    useSortableJS<Item>(listEl, {
      items: () => items,
      onCommit: (next) => {
        commits.push(next);
      },
    });

    const rec = getLastConstructed();
    const dragged = listEl.children[1] as HTMLElement;
    // Detach dragged so listEl.insertBefore(dragged, ref) with a real ref
    // doesn't actually fail — but to force the throw path, make insertBefore
    // throw via a property override.
    const origInsertBefore = listEl.insertBefore.bind(listEl);
    (listEl as unknown as { insertBefore: typeof listEl.insertBefore }).insertBefore = ((
      node: Node,
      ref: Node | null,
    ): Node => {
      // Throw on the first call only; otherwise delegate.
      throw new Error('synthetic insertBefore failure');
    }) as typeof listEl.insertBefore;

    rec.options.onStart?.({ item: dragged, oldIndex: 1, from: listEl, to: listEl });
    // SortableJS has moved the row to the end of the list.
    listEl.appendChild(dragged);
    // Even with insertBefore throwing, the model writeback MUST still happen.
    expect(() => {
      rec.options.onEnd?.({
        item: dragged,
        oldIndex: 1,
        newIndex: 2,
        from: listEl,
        to: listEl,
      });
    }).not.toThrow();
    await flushMicrotasks();
    // Restore the original method (avoids test pollution).
    (listEl as unknown as { insertBefore: typeof listEl.insertBefore }).insertBefore = origInsertBefore;

    expect(commits.length).toBe(1);
    expect(commits[0]!.map((x) => x.id)).toEqual(['a', 'c', 'b']);
  });

  it('destroy() tears down the SortableJS instance + helper exposes instance', () => {
    const items: Item[] = [{ id: 'a' }];
    const listEl = buildList(items);

    const handle = useSortableJS<Item>(listEl, {
      items: () => items,
      onCommit: () => {
        // ignore
      },
    });

    const rec = getLastConstructed();
    expect(rec.destroyed).toBe(false);
    handle.destroy();
    expect(rec.destroyed).toBe(true);
    // The exposed instance is the SortableJS object — calling .option on
    // it should forward to the underlying instance (so users can wire
    // $watch → instance.option('disabled', v) cleanly).
    handle.instance.option('disabled', true);
    expect(rec.optionCalls).toEqual([{ name: 'disabled', value: true }]);
  });

  it('afterCommit fires after onCommit on every commit (Lit $reconcileAfterDomMutation hook)', async () => {
    const items: Item[] = [{ id: 'a' }, { id: 'b' }];
    const listEl = buildList(items);
    const callOrder: string[] = [];

    useSortableJS<Item>(listEl, {
      items: () => items,
      onCommit: () => {
        callOrder.push('commit');
      },
      afterCommit: () => {
        callOrder.push('after');
      },
    });

    const rec = getLastConstructed();
    const dragged = listEl.children[0] as HTMLElement;
    rec.options.onStart?.({ item: dragged, oldIndex: 0, from: listEl, to: listEl });
    listEl.appendChild(dragged);
    rec.options.onEnd?.({
      item: dragged,
      oldIndex: 0,
      newIndex: 1,
      from: listEl,
      to: listEl,
    });
    await flushMicrotasks();

    expect(callOrder).toEqual(['commit', 'after']);
  });

  it('user-supplied options.onUpdate / options.onAdd / options.onRemove are silently ignored', () => {
    const items: Item[] = [{ id: 'a' }];
    const listEl = buildList(items);
    const userHandler = vi.fn();

    useSortableJS<Item>(listEl, {
      items: () => items,
      onCommit: () => {
        // ignore
      },
      options: {
        // These should be stripped — helper owns the event-handling path.
        onUpdate: userHandler,
        onAdd: userHandler,
        onRemove: userHandler,
        onStart: userHandler,
        onEnd: userHandler,
        onClone: userHandler,
        // Non-handler options should pass through.
        animation: 150,
        group: 'foo',
      } as unknown as SortableChange<Item>['kind'] extends never ? never : Record<string, unknown>,
    });

    const rec = getLastConstructed();
    // Non-handler options pass through verbatim.
    expect(rec.options.animation).toBe(150);
    expect(rec.options.group).toBe('foo');
    // User onUpdate / onRemove handlers are stripped — we collapse them into
    // the single handleCommit path.
    expect(rec.options.onUpdate).toBeUndefined();
    expect(rec.options.onRemove).toBeUndefined();
    // onStart / onEnd / onAdd / onClone ARE registered, but they are the
    // HELPER's, not the user's (the helper wires onEnd for source-side
    // commits, onAdd for cross-list destination commits, and onClone for
    // the clone-mode __rozieItem stash bridge).
    expect(typeof rec.options.onStart).toBe('function');
    expect(rec.options.onStart).not.toBe(userHandler);
    expect(typeof rec.options.onEnd).toBe('function');
    expect(rec.options.onEnd).not.toBe(userHandler);
    expect(typeof (rec.options as { onAdd?: unknown }).onAdd).toBe('function');
    expect((rec.options as { onAdd?: unknown }).onAdd).not.toBe(userHandler);
    expect(typeof (rec.options as { onClone?: unknown }).onClone).toBe(
      'function',
    );
    expect((rec.options as { onClone?: unknown }).onClone).not.toBe(
      userHandler,
    );
  });

  // ── clone-mode ────────────────────────────────────────────────────
  //
  // SortableJS clone mode (`group.pull === 'clone'`) keeps the original
  // DOM node in the source and clones it for transfer to the destination.
  // The helper:
  //   - registers `onClone` to bridge `__rozieItem` from original → clone
  //     so the destination's `onAdd` can recover the dragged item DATA
  //     off the cloned node (`e.item === clone` on the destination side).
  //   - short-circuits the source-side `onEnd` when `e.pullMode === 'clone'`
  //     so the source's items array stays unchanged and no spurious
  //     `kind: 'remove'` change is fired.
  // Together these make clone mode "the destination receives a copy; the
  // source keeps the original" without per-list bookkeeping in user code.

  it('clone mode: source-side `e.pullMode === "clone"` SHORT-CIRCUITS — source items array unchanged, no `kind: "remove"` change', async () => {
    const sourceItems: Item[] = [
      { id: 'btn' },
      { id: 'input' },
      { id: 'card' },
    ];
    const sourceListEl = buildList(sourceItems);
    const destListEl = buildList([]);
    // The destination is a SortableList too (a drop into any other list is refused).
    useSortableJS<Item>(destListEl, { items: () => [], onCommit: () => {} });

    const commits: Item[][] = [];
    const changes: Array<SortableChange<Item>> = [];

    useSortableJS<Item>(sourceListEl, {
      items: () => sourceItems,
      onCommit: (next) => {
        commits.push(next);
      },
      onChange: (info) => {
        changes.push(info);
      },
    });

    const rec = getLastConstructed();
    const dragged = sourceListEl.children[1] as HTMLElement;
    rec.options.onStart?.({
      item: dragged,
      oldIndex: 1,
      from: sourceListEl,
      to: sourceListEl,
    });
    // Source-side onEnd in clone mode: e.from === source, e.to === dest,
    // e.pullMode === 'clone'. The original node stayed in the source —
    // SortableJS does NOT move it. Per SortableJS docs: the cloned node is
    // what travels to the destination.
    rec.options.onEnd?.({
      item: dragged,
      oldIndex: 1,
      newIndex: 0,
      from: sourceListEl,
      to: destListEl,
      pullMode: 'clone',
    });
    await flushMicrotasks();

    // Source's onCommit MUST NOT have fired — nothing was removed.
    expect(commits.length).toBe(0);
    // No onChange either — the helper's contract is "fires per commit"
    // and there is no commit on the source side in clone mode.
    expect(changes.length).toBe(0);
    // The stash is cleaned up by the source's finally block as on any
    // other source-side onEnd.
    expect(
      (dragged as unknown as Record<string, unknown>).__rozieItem,
    ).toBeUndefined();
  });

  it('clone mode: `onClone` bridges __rozieItem from original to clone so destination `onAdd` recovers the item DATA', async () => {
    const destItems: Item[] = [{ id: 'x' }];
    const destListEl = buildList(destItems);

    const commits: Item[][] = [];
    const changes: Array<SortableChange<Item>> = [];

    useSortableJS<Item>(destListEl, {
      items: () => destItems,
      onCommit: (next) => {
        commits.push(next);
      },
      onChange: (info) => {
        changes.push(info);
      },
    });

    const rec = getLastConstructed();
    // `onClone` is a helper-owned handler — assert it was registered.
    expect(typeof (rec.options as { onClone?: unknown }).onClone).toBe(
      'function',
    );

    // Simulate the cross-list clone-mode flow from the destination's POV.
    // The source list (which we don't construct here) fired onStart and
    // stashed `__rozieItem` on `original`. SortableJS then cloned the
    // node; the helper's onClone bridged the stash from original → clone.
    const sourceListEl = buildList([{ id: 'palette-btn' }]);
    const original = sourceListEl.children[0] as HTMLElement;
    const clone = document.createElement('div');
    clone.setAttribute('data-id', 'palette-btn');
    const stashedData: Item = { id: 'palette-btn' };
    (original as unknown as Record<string, unknown>).__rozieItem = stashedData;
    // Fire the helper's onClone — bridges the stash.
    (
      rec.options as {
        onClone?: (e: { item: HTMLElement; clone: HTMLElement }) => void;
      }
    ).onClone?.({ item: original, clone });
    // Stash is now on BOTH original (still — onClone copies, doesn't move)
    // AND clone.
    expect(
      (original as unknown as Record<string, unknown>).__rozieItem,
    ).toBe(stashedData);
    expect(
      (clone as unknown as Record<string, unknown>).__rozieItem,
    ).toBe(stashedData);

    // SortableJS appends the CLONE (not the original) to the destination.
    destListEl.appendChild(clone);
    // Destination's onAdd fires with e.item === clone.
    (rec.options as { onAdd?: (e: unknown) => void }).onAdd?.({
      item: clone,
      oldIndex: 0,
      newIndex: 1,
      from: sourceListEl,
      to: destListEl,
      pullMode: 'clone',
    });
    await flushMicrotasks();

    // Destination's onCommit fires with the cloned item appended.
    expect(commits.length).toBe(1);
    expect(commits[0]!.map((x) => x.id)).toEqual(['x', 'palette-btn']);
    // onChange fires with kind: 'add' (this is the destination side).
    expect(changes.length).toBe(1);
    expect(changes[0]!.kind).toBe('add');
    expect(changes[0]!.item?.id).toBe('palette-btn');
  });

  it('clone mode: source-side onEnd USER CALLBACK still fires even though no commit happens', async () => {
    const sourceItems: Item[] = [{ id: 'a' }, { id: 'b' }];
    const sourceListEl = buildList(sourceItems);
    const destListEl = buildList([]);
    const endCalls: unknown[] = [];

    useSortableJS<Item>(sourceListEl, {
      items: () => sourceItems,
      onCommit: () => {
        // ignore
      },
      onEnd: (e) => endCalls.push(e),
    });

    const rec = getLastConstructed();
    const dragged = sourceListEl.children[0] as HTMLElement;
    rec.options.onStart?.({
      item: dragged,
      oldIndex: 0,
      from: sourceListEl,
      to: sourceListEl,
    });
    const endEv = {
      item: dragged,
      oldIndex: 0,
      newIndex: 0,
      from: sourceListEl,
      to: destListEl,
      pullMode: 'clone',
    };
    rec.options.onEnd?.(endEv);
    await flushMicrotasks();

    // The user's onEnd callback still fires from the finally block —
    // the drag DID end on the source side, even if no commit happened.
    // It carries the destination as `to`, for the caller to route.
    expect(endCalls.length).toBe(1);
    expect(endCalls[0]).toMatchObject({ item: sourceItems[0], el: dragged, from: sourceListEl, to: destListEl, oldIndex: 0, event: endEv });
  });

  it('onStart and onEnd user callbacks fire on the right events', async () => {
    const items: Item[] = [{ id: 'a' }, { id: 'b' }];
    const listEl = buildList(items);
    const startCalls: unknown[] = [];
    const endCalls: unknown[] = [];

    useSortableJS<Item>(listEl, {
      items: () => items,
      onCommit: () => {
        // ignore
      },
      onStart: (e) => startCalls.push(e),
      onEnd: (e) => endCalls.push(e),
    });

    const rec = getLastConstructed();
    const dragged = listEl.children[0] as HTMLElement;
    const startEv = { item: dragged, oldIndex: 0, from: listEl, to: listEl };
    rec.options.onStart?.(startEv);
    listEl.appendChild(dragged);
    const endEv = {
      item: dragged,
      oldIndex: 0,
      newIndex: 1,
      from: listEl,
      to: listEl,
    };
    rec.options.onEnd?.(endEv);
    await flushMicrotasks();

    expect(startCalls).toEqual([
      { item: items[0], el: dragged, from: listEl, to: listEl, oldIndex: 0, newIndex: 0, event: startEv },
    ]);
    expect(endCalls).toEqual([
      { item: items[0], el: dragged, from: listEl, to: listEl, oldIndex: 0, newIndex: 1, event: endEv },
    ]);
  });
});

describe('end: after the write, once per drag', () => {
  it('end fires after onCommit and onChange', async () => {
    const items: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const listEl = buildList(items);
    const order: string[] = [];
    const ends: Array<SortableDrag<Item>> = [];
    useSortableJS<Item>(listEl, {
      items: () => items,
      onCommit: () => order.push('commit'),
      onChange: () => order.push('change'),
      onEnd: (info) => {
        order.push('end');
        ends.push(info);
      },
    });
    const rec = getLastConstructed();
    const dragged = listEl.children[0] as HTMLElement;
    rec.options.onStart?.({ item: dragged, oldIndex: 0, oldDraggableIndex: 0, from: listEl, to: listEl });
    listEl.appendChild(dragged);
    rec.options.onEnd?.({
      item: dragged,
      oldIndex: 0,
      newIndex: 2,
      oldDraggableIndex: 0,
      newDraggableIndex: 2,
      from: listEl,
      to: listEl,
    });
    // Nothing reaches the consumer synchronously: `end` waits for the write.
    expect(order).toEqual([]);
    await flushMicrotasks();
    expect(order).toEqual(['commit', 'change', 'end']);
    expect(ends.length).toBe(1);
    expect(ends[0]!.item?.id).toBe('a');
    expect(ends[0]!.el).toBe(dragged);
    expect(ends[0]!.oldIndex).toBe(0);
    expect(ends[0]!.newIndex).toBe(2);
  });

  it('cross-list: end fires once, after both commits', async () => {
    const srcItems: Item[] = [{ id: 'a' }, { id: 'b' }];
    const dstItems: Item[] = [{ id: 'x' }, { id: 'y' }];
    const srcEl = buildList(srcItems);
    const dstEl = buildList(dstItems);
    const order: string[] = [];
    const ends: Array<SortableDrag<Item>> = [];
    useSortableJS<Item>(srcEl, {
      items: () => srcItems,
      onCommit: () => order.push('src:commit'),
      onChange: (c) => order.push('src:' + c.kind),
      onEnd: (info) => {
        order.push('src:end');
        ends.push(info);
      },
    });
    const src = getLastConstructed();
    useSortableJS<Item>(dstEl, {
      items: () => dstItems,
      onCommit: () => order.push('dst:commit'),
      onChange: (c) => order.push('dst:' + c.kind),
      onEnd: (info) => {
        order.push('dst:end');
        ends.push(info);
      },
    });
    const dst = getLastConstructed();
    const dragged = srcEl.children[0] as HTMLElement;
    src.options.onStart?.({ item: dragged, oldIndex: 0, oldDraggableIndex: 0, from: srcEl, to: srcEl });
    dstEl.insertBefore(dragged, dstEl.children[1] ?? null);
    const ev = {
      item: dragged,
      oldIndex: 0,
      newIndex: 1,
      oldDraggableIndex: 0,
      newDraggableIndex: 1,
      from: srcEl,
      to: dstEl,
    };
    // SortableJS order: the destination's onAdd, then the source's onEnd.
    (dst.options as { onAdd?: (e: unknown) => void }).onAdd?.(ev);
    src.options.onEnd?.(ev);
    await flushMicrotasks();
    expect(order).toEqual(['dst:commit', 'dst:add', 'src:commit', 'src:remove', 'src:end']);
    expect(ends.length).toBe(1);
    expect(ends[0]!.item?.id).toBe('a');
    expect(ends[0]!.from).toBe(srcEl);
    expect(ends[0]!.to).toBe(dstEl);
    expect(ends[0]!.oldIndex).toBe(0);
    expect(ends[0]!.newIndex).toBe(1);
  });

  it('drop in place writes nothing and emits no change', async () => {
    const items: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const listEl = buildList(items);
    const order: string[] = [];
    const ends: Array<SortableDrag<Item>> = [];
    useSortableJS<Item>(listEl, {
      items: () => items,
      onCommit: () => order.push('commit'),
      onChange: () => order.push('change'),
      onEnd: (info) => {
        order.push('end');
        ends.push(info);
      },
    });
    const rec = getLastConstructed();
    const dragged = listEl.children[1] as HTMLElement;
    rec.options.onStart?.({ item: dragged, oldIndex: 1, oldDraggableIndex: 1, from: listEl, to: listEl });
    rec.options.onEnd?.({
      item: dragged,
      oldIndex: 1,
      newIndex: 1,
      oldDraggableIndex: 1,
      newDraggableIndex: 1,
      from: listEl,
      to: listEl,
    });
    await flushMicrotasks();
    expect(order).toEqual(['end']);
    expect(ends[0]!.oldIndex).toBe(1);
    expect(ends[0]!.newIndex).toBe(1);
    expect(ends[0]!.item?.id).toBe('b');
  });

  it('a drop into a non-SortableList list is refused: the row goes back, nothing is written, end reports it in place', async () => {
    // Symmetric with a foreign row dropped in: items never disappear.
    const items: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const listEl = buildList(items);
    const foreign = document.createElement('ul');
    foreign.innerHTML = '<li>F1</li><li>F2</li>';
    const order: string[] = [];
    const ends: Array<SortableDrag<Item>> = [];
    useSortableJS<Item>(listEl, {
      items: () => items,
      onCommit: () => order.push('commit'),
      onChange: (c) => order.push(c.kind),
      onEnd: (info) => {
        order.push('end');
        ends.push(info);
      },
    });
    const rec = getLastConstructed();
    const dragged = listEl.children[1] as HTMLElement;
    rec.options.onStart?.({ item: dragged, oldIndex: 1, oldDraggableIndex: 1, from: listEl, to: listEl });
    foreign.insertBefore(dragged, foreign.children[0] ?? null);
    rec.options.onEnd?.({
      item: dragged,
      oldIndex: 1,
      newIndex: 0,
      oldDraggableIndex: 1,
      newDraggableIndex: 0,
      from: listEl,
      to: foreign,
    });
    await flushMicrotasks();
    expect(order).toEqual(['end']);
    expect(Array.from(listEl.children).map((c) => c.getAttribute('data-id'))).toEqual(['a', 'b', 'c']);
    expect(Array.from(foreign.children).map((c) => c.textContent)).toEqual(['F1', 'F2']);
    expect(ends.length).toBe(1);
    expect(ends[0]!.from).toBe(listEl);
    expect(ends[0]!.to).toBe(listEl);
    expect(ends[0]!.item?.id).toBe('b');
    expect(ends[0]!.oldIndex).toBe(1);
    expect(ends[0]!.newIndex).toBe(1);
  });

  it('a clone-mode drop into a non-SortableList list is refused: the original swaps back for the clone', async () => {
    const items: Item[] = [{ id: 'a' }, { id: 'b' }];
    const listEl = buildList(items);
    const foreign = document.createElement('ul');
    const order: string[] = [];
    const ends: Array<SortableDrag<Item>> = [];
    useSortableJS<Item>(listEl, {
      items: () => items,
      onCommit: () => order.push('commit'),
      onChange: (c) => order.push(c.kind),
      onEnd: (info) => {
        order.push('end');
        ends.push(info);
      },
    });
    const rec = getLastConstructed();
    const dragged = listEl.children[0] as HTMLElement;
    rec.options.onStart?.({ item: dragged, oldIndex: 0, oldDraggableIndex: 0, from: listEl, to: listEl });
    // SortableJS clone mode: the original travels, a clone stays in its place.
    const clone = dragged.cloneNode(true) as HTMLElement;
    listEl.insertBefore(clone, dragged);
    foreign.appendChild(dragged);
    rec.options.onEnd?.({
      item: dragged,
      clone,
      pullMode: 'clone',
      oldIndex: 0,
      newIndex: 0,
      oldDraggableIndex: 0,
      newDraggableIndex: 0,
      from: listEl,
      to: foreign,
    });
    await flushMicrotasks();
    expect(order).toEqual(['end']);
    expect(listEl.children[0]).toBe(dragged);
    expect(listEl.children.length).toBe(2);
    expect(clone.isConnected).toBe(false);
    expect(foreign.children.length).toBe(0);
    expect(ends[0]!.to).toBe(listEl);
    expect(ends[0]!.newIndex).toBe(0);
  });

  it('a row from a non-SortableList source goes back where it came from; nothing is written or emitted', async () => {
    const items: Item[] = [{ id: 'x' }];
    const listEl = buildList(items);
    const foreign = document.createElement('ul');
    foreign.innerHTML = '<li>A</li><li>B</li><li>C</li>';
    const order: string[] = [];
    useSortableJS<Item>(listEl, {
      items: () => items,
      onCommit: () => order.push('commit'),
      onChange: (c) => order.push(c.kind),
      onEnd: () => order.push('end'),
    });
    const rec = getLastConstructed();
    const dragged = foreign.children[1] as HTMLElement; // "B", no __rozieItem stash
    listEl.insertBefore(dragged, listEl.children[0] ?? null);
    (rec.options as { onAdd?: (e: unknown) => void }).onAdd?.({
      item: dragged,
      oldIndex: 1,
      newIndex: 0,
      from: foreign,
      to: listEl,
    });
    await flushMicrotasks();
    expect(order).toEqual([]);
    expect(Array.from(foreign.children).map((c) => c.textContent)).toEqual(['A', 'B', 'C']);
    expect(listEl.children.length).toBe(1);
  });

  it('a foreign row goes back at its original DOM position, past non-draggable header and footer children', async () => {
    // SortableJS's plain `oldIndex` counts every element child (not
    // <template>); `oldDraggableIndex` counts the `draggable` rows only.
    const items: Item[] = [{ id: 'x' }];
    const listEl = buildList(items);
    const foreign = document.createElement('ul');
    foreign.innerHTML = '<li class="hdr">H</li><li class="it">A</li><li class="it">B</li><li class="it">C</li><li class="hdr">F</li>';
    (foreign as unknown as { __mockSortable: unknown }).__mockSortable = { options: { draggable: '.it' } };
    useSortableJS<Item>(listEl, { items: () => items, onCommit: () => {} });
    const rec = getLastConstructed();
    const onAdd = (rec.options as { onAdd?: (e: unknown) => void }).onAdd!;
    const labels = () => Array.from(foreign.children).map((c) => c.textContent);
    for (const [label, oldIndex, oldDraggableIndex] of [
      ['A', 1, 0],
      ['B', 2, 1],
      ['C', 3, 2],
    ] as const) {
      const dragged = Array.from(foreign.children).find((c) => c.textContent === label) as HTMLElement;
      listEl.appendChild(dragged);
      onAdd({ item: dragged, oldIndex, newIndex: 1, oldDraggableIndex, newDraggableIndex: 1, from: foreign, to: listEl });
      await flushMicrotasks();
      expect(labels(), label).toEqual(['H', 'A', 'B', 'C', 'F']);
    }
    // Without the plain index (a fragile event), the draggable index is used.
    const b = foreign.children[2] as HTMLElement;
    listEl.appendChild(b);
    onAdd({ item: b, oldIndex: null, newIndex: 1, oldDraggableIndex: 1, from: foreign, to: listEl });
    await flushMicrotasks();
    expect(labels()).toEqual(['H', 'A', 'B', 'C', 'F']);
  });

  it('start and end indices are item-row indices (non-draggable header child)', async () => {
    const items: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const listEl = buildList(items);
    // A header element before the rows shifts SortableJS's plain indices by one.
    listEl.insertBefore(document.createElement('slot'), listEl.firstChild);
    const starts: Array<SortableDrag<Item>> = [];
    const ends: Array<SortableDrag<Item>> = [];
    useSortableJS<Item>(listEl, {
      items: () => items,
      onCommit: () => {},
      onStart: (info) => starts.push(info),
      onEnd: (info) => ends.push(info),
    });
    const rec = getLastConstructed();
    const dragged = listEl.children[1] as HTMLElement;
    rec.options.onStart?.({ item: dragged, oldIndex: 1, oldDraggableIndex: 0, from: listEl, to: listEl });
    listEl.appendChild(dragged);
    rec.options.onEnd?.({
      item: dragged,
      oldIndex: 1,
      newIndex: 3,
      oldDraggableIndex: 0,
      newDraggableIndex: 2,
      from: listEl,
      to: listEl,
    });
    await flushMicrotasks();
    expect(starts[0]!.oldIndex).toBe(0);
    expect(starts[0]!.item?.id).toBe('a');
    expect(ends[0]!.oldIndex).toBe(0);
    expect(ends[0]!.newIndex).toBe(2);
  });
});

describe('a custom options.draggable that leaves rows out', () => {
  it('start, change and end report the item-row index and the item actually dragged', async () => {
    const items: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const listEl = buildList(items);
    const starts: Array<SortableDrag<Item>> = [];
    const ends: Array<SortableDrag<Item>> = [];
    const changes: Array<SortableChange<Item>> = [];
    let committed: Item[] | null = null;
    useSortableJS<Item>(listEl, {
      items: () => items,
      onCommit: (next) => (committed = next),
      options: { draggable: '[data-id="a"], [data-id="c"]' },
      onStart: (info) => starts.push(info),
      onEnd: (info) => ends.push(info),
      onChange: (info) => changes.push(info),
    });
    const rec = getLastConstructed();
    // "c": plain index 2; draggable index 1 (b is not draggable).
    const dragged = listEl.children[2] as HTMLElement;
    rec.options.onStart?.({ item: dragged, oldIndex: 2, oldDraggableIndex: 1, from: listEl, to: listEl });
    expect(starts[0]!.item?.id).toBe('c');
    expect(starts[0]!.oldIndex).toBe(2);
    listEl.insertBefore(dragged, listEl.firstChild);
    rec.options.onEnd?.({ item: dragged, oldIndex: 2, newIndex: 0, oldDraggableIndex: 1, newDraggableIndex: 0, from: listEl, to: listEl });
    await flushMicrotasks();
    expect(committed!.map((i) => i.id)).toEqual(['c', 'a', 'b']);
    expect(changes[0]!.item?.id).toBe('c');
    expect([changes[0]!.oldIndex, changes[0]!.newIndex]).toEqual([2, 0]);
    expect(ends[0]!.item?.id).toBe('c');
    expect([ends[0]!.oldIndex, ends[0]!.newIndex]).toEqual([2, 0]);
  });

  it('a drop into another list lands at its item-row index there', async () => {
    const items: Item[] = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];
    const listEl = buildList(items);
    let committed: Item[] | null = null;
    useSortableJS<Item>(listEl, { items: () => items, onCommit: (next) => (committed = next), options: { draggable: '[data-id="x"]' } });
    const rec = getLastConstructed();
    const node = document.createElement('div');
    node.className = 'rozie-sortable-item';
    (node as unknown as { __rozieItem: Item }).__rozieItem = { id: 'n' };
    const from = buildList([]);
    // Dropped after "z": plain index 3, draggable index 1 (only "x" is draggable).
    listEl.appendChild(node);
    (rec.options as { onAdd?: (e: unknown) => void }).onAdd?.({ item: node, oldIndex: 0, newIndex: 3, newDraggableIndex: 1, from, to: listEl });
    await flushMicrotasks();
    expect(committed!.map((i) => i.id)).toEqual(['x', 'y', 'z', 'n']);
  });
});

describe('end: after framework flushes', () => {
  it('a microtask, a timer and a posted message queued from inside onCommit all run before onEnd', async () => {
    const items: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const listEl = buildList(items);
    const order: string[] = [];
    useSortableJS<Item>(listEl, {
      items: () => items,
      onCommit: () => {
        order.push('commit');
        // A framework flushing its update in a microtask, and one flushing
        // it in a task (React's scheduler, outside a discrete event).
        queueMicrotask(() => order.push('flush:microtask'));
        setTimeout(() => order.push('flush:task'), 0);
        // React's scheduler posts its render as a MessageChannel message.
        const ch = new MessageChannel();
        ch.port1.onmessage = () => {
          order.push('flush:message');
          ch.port1.close();
        };
        ch.port2.postMessage(null);
      },
      onEnd: () => order.push('end'),
    });
    const rec = getLastConstructed();
    const dragged = listEl.children[0] as HTMLElement;
    rec.options.onStart?.({ item: dragged, oldIndex: 0, oldDraggableIndex: 0, from: listEl, to: listEl });
    listEl.appendChild(dragged);
    rec.options.onEnd?.({
      item: dragged,
      oldIndex: 0,
      newIndex: 2,
      oldDraggableIndex: 0,
      newDraggableIndex: 2,
      from: listEl,
      to: listEl,
    });
    await new Promise((res) => setTimeout(res, 30));
    expect(order).toContain('end');
    expect(order.indexOf('end')).toBe(order.length - 1);
    expect([...order].sort()).toEqual(['commit', 'end', 'flush:message', 'flush:microtask', 'flush:task']);
  });
});

describe('reapplyOptions: a live `options` change reaches SortableJS', () => {
  const fakeInstance = () => {
    const calls: Array<[string, unknown]> = [];
    return { calls, option: (name: string, value: unknown) => void calls.push([name, value]) };
  };

  it('sets each changed key, skips unchanged and helper-owned keys', () => {
    const inst = fakeInstance();
    const onEnd = () => {};
    const applied = reapplyOptions(
      inst,
      { sort: true, delay: 10, onEnd },
      { sort: false, delay: 10, onEnd: () => {}, onStart: () => {}, emptyInsertThreshold: 20 },
      {},
    );
    expect(inst.calls).toEqual([
      ['sort', false],
      ['emptyInsertThreshold', 20],
    ]);
    expect(applied).toEqual(['sort', 'emptyInsertThreshold']);
  });

  it('a value equal by content (a fresh inline object each render) is not reapplied', () => {
    const inst = fakeInstance();
    const fn = () => true;
    const applied = reapplyOptions(
      inst,
      { group: { name: 'zones', pull: false, put: ['a', 'b'] }, filter: fn, scroll: true },
      { group: { name: 'zones', pull: false, put: ['a', 'b'] }, filter: fn, scroll: true },
      {},
    );
    expect(applied).toEqual([]);
    expect(reapplyOptions(inst, { group: { name: 'zones', pull: false } }, { group: { name: 'zones', pull: true } }, {})).toEqual(['group']);
    expect(reapplyOptions(inst, { group: { name: 'zones' } }, { group: { name: 'zones', put: false } }, {})).toEqual(['group']);
  });

  it('a fresh function of the same content is applied (newest closure) but is not a change, and a runtime value wins over it', () => {
    const inst = fakeInstance();
    const pull1 = () => true;
    const pull2 = () => true;
    const refreshed: string[] = [];
    // React: an inline `options={{ group: { pull: (to, from) => … } }}` makes a
    // new function every render.
    const applied = reapplyOptions(
      inst,
      { group: { name: 'z', pull: pull1, put: true }, filter: pull1 },
      { group: { name: 'z', pull: pull2, put: true }, filter: pull2 },
      {},
      { refreshed: (k) => refreshed.push(k) },
    );
    expect(applied).toEqual([]);
    expect(refreshed).toEqual(['group', 'filter']);
    expect(inst.calls.map(([k]) => k)).toEqual(['group', 'filter']);
    // A runtime option('group', v) is in force: the re-render does not undo it.
    const kept = fakeInstance();
    const keepCalls: Array<[string, unknown]> = [];
    expect(
      reapplyOptions(
        kept,
        { group: { name: 'z', pull: pull1 } },
        { group: { name: 'z', pull: pull2 } },
        {},
        {
          keep: (k, prev) => {
            keepCalls.push([k, prev]);
            return k === 'group';
          },
        },
      ),
    ).toEqual([]);
    expect(kept.calls).toEqual([]);
    expect(keepCalls).toEqual([['group', { name: 'z', pull: pull1 }]]);
    // Content changes still apply over a runtime value (and are returned).
    expect(
      reapplyOptions(kept, { group: { name: 'z', pull: pull1 } }, { group: { name: 'y', pull: pull2 } }, {}, { keep: () => true }),
    ).toEqual(['group']);
  });

  it('a cyclic options object does not overflow the stack', () => {
    const inst = fakeInstance();
    const a: Record<string, unknown> = { name: 'z' };
    a.self = a;
    const b: Record<string, unknown> = { name: 'z' };
    b.self = b;
    expect(() => reapplyOptions(inst, { group: a }, { group: b }, {})).not.toThrow();
    expect(reapplyOptions(inst, { group: a }, { group: a }, {})).toEqual([]);
  });

  it('a key dropped from options goes back to its base value; one with no base is left alone', () => {
    const inst = fakeInstance();
    const applied = reapplyOptions(
      inst,
      { sort: false, disabled: true, delay: 50 },
      {},
      { sort: true, disabled: false },
    );
    expect(inst.calls).toEqual([
      ['sort', true],
      ['disabled', false],
    ]);
    expect(applied).toEqual(['sort', 'disabled']);
  });

  it('a key present in options wins over its base value', () => {
    const inst = fakeInstance();
    reapplyOptions(inst, {}, { animation: 0 }, { animation: 150 });
    expect(inst.calls).toEqual([['animation', 0]]);
    const again = fakeInstance();
    reapplyOptions(again, { animation: 150 }, {}, { animation: 150 });
    expect(again.calls).toEqual([]);
  });

  it('null / undefined options objects are empty', () => {
    const inst = fakeInstance();
    reapplyOptions(inst, null, { sort: false }, {});
    reapplyOptions(inst, { sort: false }, undefined, { sort: true });
    expect(inst.calls).toEqual([
      ['sort', false],
      ['sort', true],
    ]);
  });
});

describe('orderByKeys: the imperative sort() order', () => {
  const items = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
  const keyOf = (item: { id: string }) => item.id;
  const ids = (list: Array<{ id: string }>) => list.map((i) => i.id).join(',');

  it('listed keys first in the given order, the rest after in their order', () => {
    expect(ids(orderByKeys(items, ['c', 'a', 'e'], keyOf))).toBe('c,a,e,b,d');
  });

  it('every item exactly once: unknown and repeated keys are ignored', () => {
    expect(ids(orderByKeys(items, ['zz', 'b', 'b', 'a'], keyOf))).toBe('b,a,c,d,e');
  });

  it('keys compare as strings (data-id)', () => {
    const nums = [10, 20, 30];
    expect(orderByKeys(nums, ['30', 10], (n) => n)).toEqual([30, 10, 20]);
  });

  it('items sharing a key stay together, in their order; each key is read once (no comparison sort)', () => {
    const dup = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }, { id: 'a', n: 3 }];
    expect(orderByKeys(dup, ['a'], (i) => i.id).map((i) => i.n)).toEqual([1, 3, 2]);
    const big = Array.from({ length: 5000 }, (_, i) => ({ id: String(i) }));
    const reversed = big.map((i) => i.id).reverse();
    let reads = 0;
    const out = orderByKeys(big, reversed, (item) => {
      reads++;
      return item.id;
    });
    // A sort would read keys in its comparator, O(n log n) times.
    expect(reads).toBe(big.length);
    expect(out[0]).toBe(big[big.length - 1]);
    expect(out.map((i) => i.id)).toEqual(reversed);
  });

  it('keeps the item values (identity), and an empty order keeps the list', () => {
    const out = orderByKeys(items, ['b'], keyOf);
    expect(out[0]).toBe(items[1]);
    expect(orderByKeys(items, [], keyOf)).toEqual(items);
  });
});
