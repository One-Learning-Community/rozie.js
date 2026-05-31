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
import { useSortableJS, type SortableChange } from './useSortableJS.js';
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
  await Promise.resolve();
  await Promise.resolve();
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
    expect(endCalls).toEqual([endEv]);
  });

  it('onStart and onEnd user callbacks fire on the right events', () => {
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

    expect(startCalls).toEqual([startEv]);
    expect(endCalls).toEqual([endEv]);
  });
});
