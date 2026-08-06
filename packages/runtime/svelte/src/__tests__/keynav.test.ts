// @vitest-environment happy-dom
//
// Plan 71-06 Task 1 — `keynav` (Svelte) behavior tests.
//
// Every case from the plan's `<behavior>` block, asserted against a REAL
// DOM tree (happy-dom — not IR-shape-only — per
// `feedback_snapshot_tests_cement_bugs` and SPEC §11's "behavior tests, not
// just snapshots" testing gate). Mirrors the React reference's
// `useKeynav.test.tsx` (Plan 71-04) / the Vue target-pair's
// `useKeynav.test.ts` (Plan 71-05) test-by-test.
//
// `keynav` is a PLAIN Svelte 5 action (a function of `(node, opts)`) — it
// does not require compiling a real `.svelte` component to exercise. The
// `Menu` harness below hand-builds the DOM a compiled Svelte `r-keynav`
// component would render (`data-rozie-keynav-item`/`data-rozie-keynav-active`/
// `id`/`tabindex` as attributes a REAL compiled component would stamp
// DECLARATIVELY — see `keynav.ts`'s module doc comment for why the action
// itself never writes those two markers) and manually re-renders them
// whenever `setActive` fires — plus manually calls `action.update(...)`
// after every simulated event, mimicking the reactive flush a real mounted
// Svelte component performs automatically once `opts.active` (the bare,
// tracked field — see `keynav.ts`) changes.
import { describe, expect, it, vi } from 'vitest';
import type { KeynavConfig, KeynavPageDetail } from '@rozie/runtime-keynav-core';
import { keynav, type KeynavActionOpts } from '../keynav.js';

interface Item {
  id: string;
  label: string;
  disabled?: boolean;
}

const ITEMS: Item[] = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Bravo', disabled: true },
  { id: 'c', label: 'Charlie' },
];

const BASE_CONFIG: KeynavConfig = {
  focusModel: 'tabindex',
  orientation: 'vertical',
  loop: false,
  typeahead: true,
  skipDisabled: true,
};

function mountMenu(opts: {
  config: KeynavConfig;
  onCommit: (i: number) => void;
  activeClass?: string;
  items?: Item[];
}) {
  const items = opts.items ?? ITEMS;
  const root = document.createElement('div');
  root.setAttribute('role', 'menu');
  root.setAttribute('tabindex', '-1');
  root.setAttribute('data-testid', 'root');
  document.body.appendChild(root);

  let active = 0;

  function render(): void {
    root.innerHTML = '';
    items.forEach((it, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'menuitem');
      btn.id = `menu-item-${i}`;
      btn.setAttribute('data-rozie-keynav-item', String(i));
      if (active === i) btn.setAttribute('data-rozie-keynav-active', '');
      if (opts.config.focusModel === 'tabindex') {
        btn.setAttribute('tabindex', active === i ? '0' : '-1');
      }
      if (it.disabled) btn.disabled = true;
      btn.textContent = it.label;
      root.appendChild(btn);
    });
  }
  render();

  function buildOpts(): KeynavActionOpts {
    return {
      config: opts.config,
      active,
      getSource: () => items,
      getActive: () => active,
      setActive: (i) => {
        active = i;
        render();
      },
      onCommit: opts.onCommit,
      ...(opts.activeClass !== undefined ? { activeClass: opts.activeClass } : {}),
    };
  }

  const action = keynav(root, buildOpts());

  return {
    root,
    // Simulates the reactive flush a real mounted Svelte component performs
    // automatically once `opts.active` changes (see `keynav.ts`'s module
    // doc comment) — the test calls this after every event that may have
    // moved `active`.
    sync: () => action.update(buildOpts()),
    unmount: () => {
      action.destroy();
      root.remove();
    },
  };
}

function isActive(el: Element): boolean {
  return el.getAttribute('data-rozie-keynav-active') === '';
}

function byText(root: HTMLElement, text: string): HTMLElement {
  const el = [...root.querySelectorAll('button')].find((b) => b.textContent === text);
  if (!el) throw new Error(`no button with text ${text}`);
  return el as HTMLElement;
}

function keydown(root: HTMLElement, key: string): void {
  root.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('keynav (Svelte, Plan 71-06 Task 1)', () => {
  it('ArrowDown moves active + stamps data-rozie-keynav-active on the next enabled item (skips disabled)', () => {
    const commit = vi.fn();
    const menu = mountMenu({ config: BASE_CONFIG, onCommit: commit });

    keydown(menu.root, 'ArrowDown');
    menu.sync();

    // Index 1 (Bravo) is disabled — skipDisabled lands on index 2 (Charlie).
    expect(isActive(byText(menu.root, 'Charlie'))).toBe(true);
    expect(isActive(byText(menu.root, 'Alpha'))).toBe(false);
    expect(isActive(byText(menu.root, 'Bravo'))).toBe(false);

    menu.unmount();
  });

  it('Home/End jump to first/last enabled; Enter invokes commit with the active index', () => {
    const commit = vi.fn();
    const menu = mountMenu({ config: BASE_CONFIG, onCommit: commit });

    keydown(menu.root, 'End');
    menu.sync();
    expect(isActive(byText(menu.root, 'Charlie'))).toBe(true);

    keydown(menu.root, 'Enter');
    menu.sync();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(2);

    keydown(menu.root, 'Home');
    menu.sync();
    expect(isActive(byText(menu.root, 'Alpha'))).toBe(true);

    menu.unmount();
  });

  it('typeahead: typing a label prefix jumps to the matching item', () => {
    const commit = vi.fn();
    const menu = mountMenu({ config: BASE_CONFIG, onCommit: commit });

    keydown(menu.root, 'c');
    menu.sync();

    expect(isActive(byText(menu.root, 'Charlie'))).toBe(true);

    menu.unmount();
  });

  it('r-keynav-active-class tokens are added to the active item and removed from the previous one', () => {
    const commit = vi.fn();
    const menu = mountMenu({ config: BASE_CONFIG, onCommit: commit, activeClass: 'is-active' });

    // The active-class effect fires on mount too (active starts at index 0).
    expect(byText(menu.root, 'Alpha').classList.contains('is-active')).toBe(true);

    keydown(menu.root, 'ArrowDown');
    menu.sync();
    expect(byText(menu.root, 'Charlie').classList.contains('is-active')).toBe(true);
    expect(byText(menu.root, 'Alpha').classList.contains('is-active')).toBe(false);

    keydown(menu.root, 'Home');
    menu.sync();
    expect(byText(menu.root, 'Alpha').classList.contains('is-active')).toBe(true);
    expect(byText(menu.root, 'Charlie').classList.contains('is-active')).toBe(false);

    menu.unmount();
  });

  it('tabindex model: the active item receives DOM focus + tabindex 0, others tabindex -1', () => {
    const commit = vi.fn();
    const menu = mountMenu({ config: BASE_CONFIG, onCommit: commit });

    keydown(menu.root, 'ArrowDown');
    menu.sync();
    const activeEl = byText(menu.root, 'Charlie');

    expect(activeEl.getAttribute('tabindex')).toBe('0');
    expect(byText(menu.root, 'Alpha').getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(activeEl);

    menu.unmount();
  });

  it('pointer activation: pointerdown on an item sets active + fires commit (bounds-checked marker parse)', () => {
    const commit = vi.fn();
    const menu = mountMenu({ config: BASE_CONFIG, onCommit: commit });

    byText(menu.root, 'Charlie').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    menu.sync();

    expect(commit).toHaveBeenCalledWith(2);
    expect(isActive(byText(menu.root, 'Charlie'))).toBe(true);

    menu.unmount();
  });

  it('activedescendant model: no DOM focus movement (focus stays where the author put it)', () => {
    const commit = vi.fn();
    const menu = mountMenu({
      config: { ...BASE_CONFIG, focusModel: 'activedescendant' },
      onCommit: commit,
    });
    menu.root.focus();

    keydown(menu.root, 'ArrowDown');
    menu.sync();

    expect(isActive(byText(menu.root, 'Charlie'))).toBe(true);
    expect(document.activeElement).toBe(menu.root);

    menu.unmount();
  });

  it('a malformed/out-of-range data-rozie-keynav-item marker is rejected, never coerced (T-71-06-01)', () => {
    const commit = vi.fn();
    const menu = mountMenu({ config: BASE_CONFIG, onCommit: commit });

    const rogue = document.createElement('button');
    rogue.setAttribute('data-rozie-keynav-item', '999');
    menu.root.appendChild(rogue);
    rogue.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    menu.sync();

    expect(commit).not.toHaveBeenCalled();

    menu.unmount();
  });
});

// ---------------------------------------------------------------------------
// Plan 260806-lz7 Task 1 — strict-containment focus guard. `mountScopedMenu`
// wires `getFocusScope` to a wrapper element that contains the keynav root
// PLUS a sibling "heading" (standing in for the date-picker drill heading),
// so cases (a)/(b) can distinguish "inside the component, outside the root"
// from "outside the component entirely." Mirrors the React reference's
// `ScopedMenu` harness (Plan 260806-lz7 Task 1) test-by-test.
// ---------------------------------------------------------------------------

function mountScopedMenu(opts: {
  config: KeynavConfig;
  onCommit: (i: number) => void;
  items?: Item[];
  /** Focuses the heading BEFORE the `keynav` action ever mounts — mirrors a
   * drill-continuity re-entry where focus already sits inside the
   * component, outside the root, at (re)attachment time. */
  focusHeadingBeforeMount?: boolean;
}) {
  const items = opts.items ?? ITEMS;
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-testid', 'wrapper');
  document.body.appendChild(wrapper);

  const heading = document.createElement('button');
  heading.type = 'button';
  heading.setAttribute('data-testid', 'heading');
  heading.textContent = 'Heading';
  wrapper.appendChild(heading);

  if (opts.focusHeadingBeforeMount) {
    heading.focus();
  }

  const root = document.createElement('div');
  root.setAttribute('role', 'menu');
  root.setAttribute('tabindex', '-1');
  root.setAttribute('data-testid', 'root');
  wrapper.appendChild(root);

  let active = 0;

  function render(): void {
    root.innerHTML = '';
    items.forEach((it, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'menuitem');
      btn.setAttribute('data-rozie-keynav-item', String(i));
      if (active === i) btn.setAttribute('data-rozie-keynav-active', '');
      btn.setAttribute('tabindex', active === i ? '0' : '-1');
      if (it.disabled) btn.disabled = true;
      btn.textContent = it.label;
      root.appendChild(btn);
    });
  }
  render();

  function buildOpts(): KeynavActionOpts {
    return {
      config: opts.config,
      active,
      getSource: () => items,
      getActive: () => active,
      setActive: (i) => {
        active = i;
        render();
      },
      onCommit: opts.onCommit,
      getFocusScope: () => [wrapper],
    };
  }

  const action = keynav(root, buildOpts());

  return {
    wrapper,
    heading,
    root,
    sync: () => action.update(buildOpts()),
    unmount: () => {
      action.destroy();
      wrapper.remove();
    },
  };
}

describe('keynav (Svelte) — strict-containment focus guard (Plan 260806-lz7 Task 1)', () => {
  it('case (c): a cold mount with nothing ever focused does not steal focus or scroll', () => {
    const commit = vi.fn();
    const menu = mountMenu({ config: BASE_CONFIG, onCommit: commit });

    expect(document.activeElement).toBe(document.body);
    expect(isActive(byText(menu.root, 'Alpha'))).toBe(true); // active-class/data marker IS unconditional
    expect(document.activeElement).not.toBe(byText(menu.root, 'Alpha')); // but DOM focus was NOT stolen

    menu.unmount();
  });

  it('case (a) — THE STRICTNESS CASE: mount while a real element OUTSIDE the component subtree holds focus does not steal focus', () => {
    const commit = vi.fn();
    const outside = document.createElement('button');
    outside.type = 'button';
    outside.textContent = 'Outside';
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    const menu = mountScopedMenu({ config: BASE_CONFIG, onCommit: commit });

    // A document-scoped predicate would let this steal focus (something IS
    // focused on the page); strict containment must not, because "outside"
    // is not inside the ScopedMenu's wrapper.
    expect(document.activeElement).toBe(outside);
    expect(document.activeElement).not.toBe(byText(menu.root, 'Alpha'));

    menu.unmount();
    outside.remove();
  });

  it('case (b): mount while focus is INSIDE the component but outside the keynav root DOES focus (drill-continuity shape)', () => {
    const commit = vi.fn();
    const menu = mountScopedMenu({
      config: BASE_CONFIG,
      onCommit: commit,
      focusHeadingBeforeMount: true,
    });

    expect(document.activeElement).toBe(byText(menu.root, 'Alpha'));

    menu.unmount();
  });

  it('case (d): after a guarded cold mount, an index change focuses unconditionally even though document focus is still at body', () => {
    const commit = vi.fn();
    const menu = mountMenu({ config: BASE_CONFIG, onCommit: commit });
    expect(document.activeElement).toBe(document.body); // guarded mount pass did not steal focus

    keydown(menu.root, 'ArrowDown'); // a genuine navigation pass
    menu.sync();

    // Bravo is disabled — skipDisabled lands on Charlie — and it IS focused,
    // unconditionally, even though document focus was still at body.
    expect(document.activeElement).toBe(byText(menu.root, 'Charlie'));

    menu.unmount();
  });

  it('compatibility: without getFocusScope, a real focus anywhere in the document still lets the guarded first pass focus (document-scoped fallback, never unconditional steal)', () => {
    const commit = vi.fn();
    const outside = document.createElement('button');
    outside.type = 'button';
    outside.textContent = 'Outside';
    document.body.appendChild(outside);
    outside.focus();

    // `mountMenu` (unlike `mountScopedMenu`) never passes `getFocusScope` —
    // this proves the field is additive and an un-regenerated leaf degrades
    // to the OLD document-scoped predicate, not to a hard rejection.
    const menu = mountMenu({ config: BASE_CONFIG, onCommit: commit });

    expect(document.activeElement).toBe(byText(menu.root, 'Alpha'));

    menu.unmount();
    outside.remove();
  });
});

// ---------------------------------------------------------------------------
// Plan 77-04 Task 2 — `onPage` + `gridColumns` + the deferred one-frame-late
// focus pass. A separate harness (`mountGridMenu`/`mountLateGrid`) keeps the
// pre-existing `mountMenu` cases above completely untouched (SPEC §7.4
// additive invariant). Mirrors the React reference's `GridMenu`/`LateGrid`
// harnesses (Plan 77-03 Task 1) test-by-test.
// ---------------------------------------------------------------------------

const GRID_ITEMS: Item[] = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
  { id: 'd', label: 'D' },
  { id: 'e', label: 'E' },
  { id: 'f', label: 'F' },
];

// `orientation: 'both'` is what the 1D branch falls back to when `columns`
// is NOT supplied — deliberately reused for both the grid and no-grid cases
// below so the harness proves grid semantics are selected by `gridColumns`
// PRESENCE alone, not by anything in `config` itself.
const GRID_CONFIG: KeynavConfig = {
  focusModel: 'tabindex',
  orientation: 'both',
  loop: false,
  typeahead: false,
  skipDisabled: false,
};

function mountGridMenu(opts: {
  config: KeynavConfig;
  onCommit: (i: number) => void;
  /** `undefined` exercises the "no gridColumns" (1D) branch. */
  columns?: number;
  onPage?: (detail: KeynavPageDetail) => void;
  items?: Item[];
}) {
  const items = opts.items ?? GRID_ITEMS;
  const root = document.createElement('div');
  root.setAttribute('role', 'grid');
  root.setAttribute('tabindex', '-1');
  root.setAttribute('data-testid', 'root');
  document.body.appendChild(root);

  let active = 0;
  let columns = opts.columns;

  function render(): void {
    root.innerHTML = '';
    items.forEach((it, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'gridcell');
      btn.setAttribute('data-rozie-keynav-item', String(i));
      if (active === i) btn.setAttribute('data-rozie-keynav-active', '');
      if (opts.config.focusModel === 'tabindex') {
        btn.setAttribute('tabindex', active === i ? '0' : '-1');
      }
      btn.textContent = it.label;
      root.appendChild(btn);
    });
  }
  render();

  function buildOpts(): KeynavActionOpts {
    return {
      config: opts.config,
      active,
      getSource: () => items,
      getActive: () => active,
      setActive: (i) => {
        active = i;
        render();
      },
      onCommit: opts.onCommit,
      ...(columns !== undefined ? { gridColumns: () => columns! } : {}),
      ...(opts.onPage !== undefined ? { onPage: opts.onPage } : {}),
    };
  }

  const action = keynav(root, buildOpts());

  return {
    root,
    setColumns: (c: number) => {
      columns = c;
    },
    // Simulates the reactive flush a real mounted Svelte component performs
    // automatically once `opts.active` changes.
    sync: () => action.update(buildOpts()),
    unmount: () => {
      action.destroy();
      root.remove();
    },
  };
}

// Harness for the "item renders one frame late" cases — item 5 is only
// present once `reveal()` is called, standing in for a dataset swap (grid
// paging) whose landing element isn't in the DOM at `update()` time yet.
// UNLIKE `mountGridMenu`'s full-innerHTML-wipe render (fine for those cases
// — they never assert DOM-NODE-IDENTITY survival across a render), this
// harness reuses one persistent `<button>` per index (real Svelte's keyed
// `{#each}` never destroys/recreates a node whose key is unchanged) — so
// `reveal()` adding item 5 does NOT also blow away the ALREADY-focused item
// 0 node, which would falsely fail the "stale pass never steals focus" case
// for a reason unrelated to the code under test.
function mountLateGrid(opts: { onCommit: (i: number) => void }) {
  const root = document.createElement('div');
  root.setAttribute('role', 'grid');
  root.setAttribute('tabindex', '-1');
  root.setAttribute('data-testid', 'root');
  document.body.appendChild(root);

  let active = 0;
  let revealed = false;
  const nodes = new Map<number, HTMLButtonElement>();

  function render(): void {
    GRID_ITEMS.forEach((it, i) => {
      const shouldExist = !(i === 5 && !revealed);
      let btn = nodes.get(i);
      if (!shouldExist) {
        if (btn) {
          btn.remove();
          nodes.delete(i);
        }
        return;
      }
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('role', 'gridcell');
        btn.setAttribute('data-rozie-keynav-item', String(i));
        btn.textContent = it.label;
        nodes.set(i, btn);
        root.appendChild(btn);
      }
      if (active === i) {
        btn.setAttribute('data-rozie-keynav-active', '');
      } else {
        btn.removeAttribute('data-rozie-keynav-active');
      }
      btn.setAttribute('tabindex', active === i ? '0' : '-1');
    });
  }
  render();

  function buildOpts(): KeynavActionOpts {
    return {
      config: GRID_CONFIG,
      active,
      getSource: () => GRID_ITEMS,
      getActive: () => active,
      setActive: (i) => {
        active = i;
        render();
      },
      onCommit: opts.onCommit,
      gridColumns: () => 3,
    };
  }

  const action = keynav(root, buildOpts());

  return {
    root,
    reveal: () => {
      revealed = true;
      render();
    },
    sync: () => action.update(buildOpts()),
    unmount: () => {
      action.destroy();
      root.remove();
    },
  };
}

/** Stubs `requestAnimationFrame`/`cancelAnimationFrame` for manual, deterministic control. */
function stubRaf(): {
  callbacks: FrameRequestCallback[];
  cancelSpy: ReturnType<typeof vi.fn>;
  restore: () => void;
} {
  const callbacks: FrameRequestCallback[] = [];
  const rafSpy = vi.fn((cb: FrameRequestCallback) => {
    callbacks.push(cb);
    return callbacks.length;
  });
  const cancelSpy = vi.fn();
  vi.stubGlobal('requestAnimationFrame', rafSpy);
  vi.stubGlobal('cancelAnimationFrame', cancelSpy);
  return { callbacks, cancelSpy, restore: () => vi.unstubAllGlobals() };
}

describe('keynav (Svelte) — grid config, @keynav-page, deferred focus (Plan 77-04 Task 2)', () => {
  it('grid: onPage receives a boundary detail when an arrow hits the edge (SPEC §4.1)', () => {
    const commit = vi.fn();
    const onPage = vi.fn();
    const menu = mountGridMenu({ config: GRID_CONFIG, columns: 3, onCommit: commit, onPage });

    keydown(menu.root, 'ArrowLeft'); // active starts at 0 -> row-axis boundary
    menu.sync();

    expect(onPage).toHaveBeenCalledWith({ direction: -1, reason: 'boundary', axis: 'row' });
    // The machine never lands on a boundary key (SPEC §4.1) — active unmoved.
    expect(isActive(byText(menu.root, 'A'))).toBe(true);

    menu.unmount();
  });

  it('grid: ArrowDown moves active by the column-stride count', () => {
    const commit = vi.fn();
    const menu = mountGridMenu({ config: GRID_CONFIG, columns: 3, onCommit: commit });

    keydown(menu.root, 'ArrowDown');
    menu.sync();

    expect(isActive(byText(menu.root, 'D'))).toBe(true);

    menu.unmount();
  });

  it('grid: a dynamic columns() getter changes the stride between keydowns without re-instantiating the machine', () => {
    const commit = vi.fn();
    const menu = mountGridMenu({ config: GRID_CONFIG, columns: 3, onCommit: commit });

    keydown(menu.root, 'ArrowDown'); // stride 3: 0 -> 3 (D)
    menu.sync();
    expect(isActive(byText(menu.root, 'D'))).toBe(true);

    // A fresh columns VALUE lands via the SAME `currentOpts` delegation the
    // reactive-column-count case relies on in emitted code.
    menu.setColumns(2);
    menu.sync();
    keydown(menu.root, 'ArrowDown'); // stride 2: 3 -> 5 (F)
    menu.sync();

    expect(isActive(byText(menu.root, 'F'))).toBe(true);

    menu.unmount();
  });

  it('no gridColumns: the config handed to the machine has no grid key — 1D arrow semantics (±1), onPage never fires', () => {
    const commit = vi.fn();
    const onPage = vi.fn();
    const menu = mountGridMenu({ config: GRID_CONFIG, onCommit: commit, onPage });

    keydown(menu.root, 'ArrowDown'); // 1D: ±1, NOT ±columns
    menu.sync();

    expect(isActive(byText(menu.root, 'B'))).toBe(true);
    expect(onPage).not.toHaveBeenCalled();

    menu.unmount();
  });

  it('grid: a one-frame-late item render still receives focus once it appears (T-77-03-03)', () => {
    const raf = stubRaf();
    try {
      const commit = vi.fn();
      const menu = mountLateGrid({ onCommit: commit });

      menu.root.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', ctrlKey: true, bubbles: true }),
      );
      menu.sync(); // grid corner -> index 5, not yet rendered
      expect([...menu.root.querySelectorAll('button')].some((b) => b.textContent === 'F')).toBe(
        false,
      );
      expect(raf.callbacks).toHaveLength(1);

      // The browser "paints" the newly-swapped dataset one frame later.
      menu.reveal();
      const revealedEl = byText(menu.root, 'F');
      expect(revealedEl.getAttribute('data-rozie-keynav-active')).toBe('');
      expect(document.activeElement).not.toBe(revealedEl);

      // Fire the deferred pass — the element exists now, so focus lands.
      raf.callbacks[0]!(0);
      expect(document.activeElement).toBe(revealedEl);

      menu.unmount();
    } finally {
      raf.restore();
    }
  });

  it('grid: a stale deferred pass never steals focus after a newer navigation supersedes it (T-77-03-03)', () => {
    const raf = stubRaf();
    try {
      const commit = vi.fn();
      const menu = mountLateGrid({ onCommit: commit });

      // First navigation lands on the not-yet-rendered index 5 — schedules a
      // deferred pass scoped to active === 5.
      menu.root.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', ctrlKey: true, bubbles: true }),
      );
      menu.sync();
      expect(raf.callbacks).toHaveLength(1);
      const stalePass = raf.callbacks[0]!;

      // A second navigation (to an ALREADY-rendered item) supersedes it
      // before the deferred pass ever runs — `update()` itself cancels the
      // pending rAF, but this fixture forces the STALE callback to fire
      // anyway (simulating a browser that already queued the frame) to
      // prove the value-guard inside the callback also holds.
      menu.root.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Home', ctrlKey: true, bubbles: true }),
      );
      menu.sync();
      const aEl = byText(menu.root, 'A');
      expect(aEl.getAttribute('data-rozie-keynav-active')).toBe('');
      expect(document.activeElement).toBe(aEl);

      menu.reveal();

      // The stale pass (still scoped to the superseded active === 5) fires —
      // it must no-op, never stealing focus back from the current item.
      stalePass(0);
      expect(document.activeElement).toBe(aEl);

      menu.unmount();
    } finally {
      raf.restore();
    }
  });
});
