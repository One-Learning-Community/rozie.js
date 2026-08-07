/**
 * Plan 71-07 Task 1 — `createKeynav` (Solid) behavior tests.
 *
 * Every case from the plan's `<behavior>` block, asserted against a REAL DOM
 * tree (not IR-shape-only — per `feedback_snapshot_tests_cement_bugs` and
 * SPEC §11's "behavior tests, not just snapshots" testing gate, and this
 * plan's own CRITICAL note: a prior Solid class bug hid behind
 * IR-snapshot-only tests). `buildMenu` below hand-builds the DOM tree a
 * compiled Solid `r-keynav` component would emit — `data-rozie-keynav-item`/
 * `data-rozie-keynav-active`/`tabIndex` as DECLARATIVE `createEffect`
 * bindings comparing the loop index to live `active()` state (mirrors what
 * the compiler emitter, Task 2, stamps via JSX; see `createKeynav.ts`'s
 * module doc comment for why the primitive itself never touches those two
 * attributes/properties). Mirrors the React/Vue references' `useKeynav.test`
 * test-by-test, using imperative DOM construction (no `@solidjs/testing-
 * library` dependency) — the same style `createOutsideClick.test.ts` in this
 * package already uses.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEffect, createRoot, createSignal, onMount } from 'solid-js';
import type { KeynavConfig, KeynavPageDetail } from '@rozie/runtime-keynav-core';
import { createKeynav } from '../createKeynav.js';

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

interface MenuHarness {
  root: HTMLElement;
  items: HTMLElement[];
  dispose: () => void;
}

/**
 * Hand-builds the REAL DOM tree a compiled Solid `r-keynav` component would
 * emit. `data-rozie-keynav-item`/`data-rozie-keynav-active`/`tabIndex` are
 * wired via a per-item `createEffect` reading `active()` — the DECLARATIVE
 * shape the compiler emitter (Task 2) stamps as JSX bindings, reproduced here
 * imperatively since this test constructs the DOM by hand rather than
 * through Solid's JSX/`render()` pipeline.
 */
function buildMenu(opts: {
  config: KeynavConfig;
  onCommit: (i: number) => void;
  activeClass?: string;
  items?: Item[];
}): MenuHarness {
  const items = opts.items ?? ITEMS;
  const root = document.createElement('div');
  root.setAttribute('role', 'menu');
  root.tabIndex = -1;
  document.body.appendChild(root);

  const itemEls: HTMLElement[] = items.map((it) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'menuitem');
    btn.textContent = it.label;
    if (it.disabled) btn.disabled = true;
    root.appendChild(btn);
    return btn;
  });

  let dispose: () => void = () => {};

  createRoot((d) => {
    dispose = d;
    const [active, setActive] = createSignal(0);

    itemEls.forEach((el, i) => {
      el.id = `menu-item-${i}`;
      createEffect(() => {
        el.setAttribute('data-rozie-keynav-item', String(i));
        if (active() === i) el.setAttribute('data-rozie-keynav-active', '');
        else el.removeAttribute('data-rozie-keynav-active');
        // `setAttribute` directly (not the `.tabIndex` IDL property) —
        // happy-dom's `tabIndex` setter fails to reflect `-1` to the content
        // attribute (a happy-dom quirk; real browsers reflect it per spec, and
        // this is what Solid's own compiled JSX setters emit).
        el.setAttribute('tabindex', active() === i ? '0' : '-1');
      });
    });

    createKeynav(() => root, {
      config: opts.config,
      getSource: () => items,
      getActive: () => active(),
      setActive,
      onCommit: opts.onCommit,
      ...(opts.activeClass !== undefined ? { activeClass: opts.activeClass } : {}),
    });
  });

  return { root, items: itemEls, dispose };
}

function isActive(el: HTMLElement): boolean {
  return el.getAttribute('data-rozie-keynav-active') === '';
}

function byLabel(items: HTMLElement[], label: string): HTMLElement {
  const el = items.find((it) => it.textContent === label);
  if (!el) throw new Error(`no item with label ${label}`);
  return el;
}

describe('createKeynav (Solid, Plan 71-07 Task 1)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('ArrowDown moves active + stamps data-rozie-keynav-active on the next enabled item (skips disabled)', () => {
    const commit = vi.fn();
    const { root, items, dispose } = buildMenu({ config: BASE_CONFIG, onCommit: commit });

    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    // Index 1 (Bravo) is disabled — skipDisabled lands on index 2 (Charlie).
    expect(isActive(byLabel(items, 'Charlie'))).toBe(true);
    expect(isActive(byLabel(items, 'Alpha'))).toBe(false);
    expect(isActive(byLabel(items, 'Bravo'))).toBe(false);

    dispose();
  });

  it('Home/End jump to first/last enabled; Enter invokes commit with the active index', () => {
    const commit = vi.fn();
    const { root, items, dispose } = buildMenu({ config: BASE_CONFIG, onCommit: commit });

    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(isActive(byLabel(items, 'Charlie'))).toBe(true);

    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(2);

    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(isActive(byLabel(items, 'Alpha'))).toBe(true);

    dispose();
  });

  it('typeahead: typing a label prefix jumps to the matching item', () => {
    const commit = vi.fn();
    const { root, items, dispose } = buildMenu({ config: BASE_CONFIG, onCommit: commit });

    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));

    expect(isActive(byLabel(items, 'Charlie'))).toBe(true);

    dispose();
  });

  it('loop wraps past the ends when .loop is set', () => {
    const commit = vi.fn();
    const { root, items, dispose } = buildMenu({
      config: { ...BASE_CONFIG, loop: true },
      onCommit: commit,
    });

    // Active starts at 0 (Alpha). ArrowUp with loop wraps to the last
    // enabled item (Charlie, skipping disabled Bravo).
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(isActive(byLabel(items, 'Charlie'))).toBe(true);

    dispose();
  });

  it('r-keynav-active-class tokens are added to the active item and removed from the previous one', () => {
    const commit = vi.fn();
    const { root, items, dispose } = buildMenu({
      config: BASE_CONFIG,
      onCommit: commit,
      activeClass: 'is-active',
    });

    // The active-class effect fires on mount too (active starts at index 0).
    expect(byLabel(items, 'Alpha').classList.contains('is-active')).toBe(true);

    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(byLabel(items, 'Charlie').classList.contains('is-active')).toBe(true);
    expect(byLabel(items, 'Alpha').classList.contains('is-active')).toBe(false);

    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(byLabel(items, 'Alpha').classList.contains('is-active')).toBe(true);
    expect(byLabel(items, 'Charlie').classList.contains('is-active')).toBe(false);

    dispose();
  });

  it('tabindex model: the active item receives DOM focus + tabIndex 0, others tabIndex -1', () => {
    const commit = vi.fn();
    const { root, items, dispose } = buildMenu({ config: BASE_CONFIG, onCommit: commit });

    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    const activeEl = byLabel(items, 'Charlie');

    expect(activeEl.getAttribute('tabindex')).toBe('0');
    expect(byLabel(items, 'Alpha').getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(activeEl);

    dispose();
  });

  it('pointer activation: pointerdown on an item sets active + fires commit (bounds-checked marker parse)', () => {
    const commit = vi.fn();
    const { items, dispose } = buildMenu({ config: BASE_CONFIG, onCommit: commit });

    byLabel(items, 'Charlie').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));

    expect(commit).toHaveBeenCalledWith(2);
    expect(isActive(byLabel(items, 'Charlie'))).toBe(true);

    dispose();
  });

  it('activedescendant model: no DOM focus movement (focus stays where the author put it)', () => {
    const commit = vi.fn();
    const { root, items, dispose } = buildMenu({
      config: { ...BASE_CONFIG, focusModel: 'activedescendant' },
      onCommit: commit,
    });
    root.focus();

    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(isActive(byLabel(items, 'Charlie'))).toBe(true);
    expect(document.activeElement).toBe(root);

    dispose();
  });
});

// ---------------------------------------------------------------------------
// Plan 260806-lz7 Task 1 — strict-containment focus guard. `buildScopedMenu`
// wires `getFocusScope` to a wrapper element that contains the keynav root
// PLUS a sibling "heading" (standing in for the date-picker drill heading),
// so cases (a)/(b) can distinguish "inside the component, outside the root"
// from "outside the component entirely." Mirrors the React reference's
// `ScopedMenu` harness (Plan 260806-lz7 Task 1) test-by-test.
// ---------------------------------------------------------------------------

interface ScopedMenuHarness {
  wrapper: HTMLElement;
  heading: HTMLElement;
  items: HTMLElement[];
  dispose: () => void;
}

function buildScopedMenu(opts: {
  config: KeynavConfig;
  onCommit: (i: number) => void;
  items?: Item[];
  /** Focuses the heading BEFORE `createKeynav` ever runs — mirrors a
   * drill-continuity re-entry where focus already sits inside the
   * component, outside the root, at (re)attachment time. */
  focusHeadingBeforeMount?: boolean;
}): ScopedMenuHarness {
  const items = opts.items ?? ITEMS;
  const wrapper = document.createElement('div');
  document.body.appendChild(wrapper);
  const heading = document.createElement('button');
  heading.type = 'button';
  heading.textContent = 'Heading';
  wrapper.appendChild(heading);

  if (opts.focusHeadingBeforeMount) {
    heading.focus();
  }

  const root = document.createElement('div');
  root.setAttribute('role', 'menu');
  root.tabIndex = -1;
  wrapper.appendChild(root);

  const itemEls: HTMLElement[] = items.map((it) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'menuitem');
    btn.textContent = it.label;
    if (it.disabled) btn.disabled = true;
    root.appendChild(btn);
    return btn;
  });

  let dispose: () => void = () => {};

  createRoot((d) => {
    dispose = d;
    const [active, setActive] = createSignal(0);

    itemEls.forEach((el, i) => {
      createEffect(() => {
        el.setAttribute('data-rozie-keynav-item', String(i));
        if (active() === i) el.setAttribute('data-rozie-keynav-active', '');
        else el.removeAttribute('data-rozie-keynav-active');
        el.setAttribute('tabindex', active() === i ? '0' : '-1');
      });
    });

    createKeynav(() => root, {
      config: opts.config,
      getSource: () => items,
      getActive: () => active(),
      setActive,
      onCommit: opts.onCommit,
      getFocusScope: () => [wrapper],
    });
  });

  return { wrapper, heading, items: itemEls, dispose };
}

describe('createKeynav (Solid) — strict-containment focus guard (Plan 260806-lz7 Task 1)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('case (c): a cold mount with nothing ever focused does not steal focus or scroll', () => {
    const commit = vi.fn();
    const { items, dispose } = buildMenu({ config: BASE_CONFIG, onCommit: commit });

    expect(document.activeElement).toBe(document.body);
    expect(isActive(byLabel(items, 'Alpha'))).toBe(true); // active-class/data marker IS unconditional
    expect(document.activeElement).not.toBe(byLabel(items, 'Alpha')); // but DOM focus was NOT stolen

    dispose();
  });

  it('case (a) — THE STRICTNESS CASE: mount while a real element OUTSIDE the component subtree holds focus does not steal focus', () => {
    const commit = vi.fn();
    const outside = document.createElement('button');
    outside.type = 'button';
    outside.textContent = 'Outside';
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    const { items, dispose } = buildScopedMenu({ config: BASE_CONFIG, onCommit: commit });

    // A document-scoped predicate would let this steal focus (something IS
    // focused on the page); strict containment must not, because "outside"
    // is not inside the ScopedMenu's wrapper.
    expect(document.activeElement).toBe(outside);
    expect(document.activeElement).not.toBe(byLabel(items, 'Alpha'));

    dispose();
  });

  it('case (b): mount while focus is INSIDE the component but outside the keynav root DOES focus (drill-continuity shape)', () => {
    const commit = vi.fn();
    const { items, dispose } = buildScopedMenu({
      config: BASE_CONFIG,
      onCommit: commit,
      focusHeadingBeforeMount: true,
    });

    expect(document.activeElement).toBe(byLabel(items, 'Alpha'));

    dispose();
  });

  it('case (d): after a guarded cold mount, an index change focuses unconditionally even though document focus is still at body', () => {
    const commit = vi.fn();
    const { root, items, dispose } = buildMenu({ config: BASE_CONFIG, onCommit: commit });
    expect(document.activeElement).toBe(document.body); // guarded mount pass did not steal focus

    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); // a genuine navigation pass

    // Bravo is disabled — skipDisabled lands on Charlie — and it IS focused,
    // unconditionally, even though document focus was still at body.
    expect(document.activeElement).toBe(byLabel(items, 'Charlie'));

    dispose();
  });

  it('compatibility: without getFocusScope, a real focus anywhere in the document still lets the guarded first pass focus (document-scoped fallback, never unconditional steal)', () => {
    const commit = vi.fn();
    const outside = document.createElement('button');
    outside.type = 'button';
    outside.textContent = 'Outside';
    document.body.appendChild(outside);
    outside.focus();

    // `buildMenu` (unlike `buildScopedMenu`) never passes `getFocusScope` —
    // this proves the field is additive and an un-regenerated leaf degrades
    // to the OLD document-scoped predicate, not to a hard rejection.
    const { items, dispose } = buildMenu({ config: BASE_CONFIG, onCommit: commit });

    expect(document.activeElement).toBe(byLabel(items, 'Alpha'));

    dispose();
  });

  // Found via this plan's own Docker VR run against @rozie-ui/date-picker —
  // see the React reference's identical test (`useKeynav.test.tsx`) for the
  // full rationale: a consumer may resolve its true mount-time active index
  // through an app-level effect that writes the active signal AFTER the
  // initial render (date-picker's `seedActiveDay`, deferred one
  // `requestAnimationFrame`), which looks IDENTICAL to a real navigation on
  // a plain value diff.
  it('an app-level (non-interaction) active-index write AFTER mount is still guarded — a value change alone is not evidence of a real navigation', () => {
    const commit = vi.fn();
    const root = document.createElement('div');
    root.setAttribute('role', 'menu');
    root.tabIndex = -1;
    document.body.appendChild(root);

    const itemEls: HTMLElement[] = ITEMS.map((it) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'menuitem');
      btn.textContent = it.label;
      if (it.disabled) btn.disabled = true;
      root.appendChild(btn);
      return btn;
    });

    let dispose: () => void = () => {};
    createRoot((d) => {
      dispose = d;
      const [active, setActive] = createSignal(0);

      itemEls.forEach((el, i) => {
        createEffect(() => {
          el.setAttribute('data-rozie-keynav-item', String(i));
          if (active() === i) el.setAttribute('data-rozie-keynav-active', '');
          else el.removeAttribute('data-rozie-keynav-active');
          el.setAttribute('tabindex', active() === i ? '0' : '-1');
        });
      });

      createKeynav(() => root, {
        config: BASE_CONFIG,
        getSource: () => ITEMS,
        getActive: () => active(),
        setActive,
        onCommit: commit,
      });

      // Mirrors date-picker's `seedActiveDay`: an APP-LEVEL onMount (never a
      // keydown/pointerdown/focusin) resolves the true active index after
      // the initial render.
      onMount(() => {
        setActive(2); // 'Charlie' — a DIFFERENT index than the initial 0.
      });
    });

    expect(byLabel(itemEls, 'Charlie').getAttribute('data-rozie-keynav-active')).toBe('');
    // The active-class/data marker DID move to Charlie — that's the app's
    // own state, unconditional per SPEC §9 — but DOM focus must NOT have
    // followed it, since nothing on the page was ever interacted with.
    expect(document.activeElement).toBe(document.body);
    expect(document.activeElement).not.toBe(byLabel(itemEls, 'Charlie'));

    dispose();
  });
});

// ---------------------------------------------------------------------------
// Plan 77-04 Task 3 — `onPage` + `gridColumns` + the deferred one-frame-late
// focus pass. A separate harness (`buildGridMenu`/`buildLateGrid`) keeps the
// pre-existing `buildMenu` cases above completely untouched (SPEC §7.4
// additive invariant). Mirrors the React reference's `GridMenu`/`LateGrid`
// harnesses (Plan 77-03 Task 1) test-by-test — REAL Solid signals/effects
// under the 'browser'-conditions vitest config (71-07's landmine fix), NOT
// the SSR stub: this suite is the honest behavioral evidence for Solid's
// Phase-77 controller, per the plan's own prohibition against claiming
// coverage an SSR-stub environment cannot provide.
// ---------------------------------------------------------------------------

const GRID_ITEMS: Item[] = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
  { id: 'd', label: 'D' },
  { id: 'e', label: 'E' },
  { id: 'f', label: 'F' },
];

// `orientation: 'both'` is what the 1D branch falls back to when
// `gridColumns` is NOT supplied — deliberately reused for both the grid and
// no-grid cases below so the harness proves grid semantics are selected by
// `gridColumns` PRESENCE alone, not by anything in `config` itself.
const GRID_CONFIG: KeynavConfig = {
  focusModel: 'tabindex',
  orientation: 'both',
  loop: false,
  typeahead: false,
  skipDisabled: false,
};

interface GridMenuHarness {
  root: HTMLElement;
  items: HTMLElement[];
  setColumns: (c: number) => void;
  dispose: () => void;
}

function buildGridMenu(opts: {
  config: KeynavConfig;
  onCommit: (i: number) => void;
  /** `undefined` exercises the "no gridColumns" (1D) branch. */
  columns?: number;
  onPage?: (detail: KeynavPageDetail) => void;
  items?: Item[];
}): GridMenuHarness {
  const items = opts.items ?? GRID_ITEMS;
  const root = document.createElement('div');
  root.setAttribute('role', 'grid');
  root.tabIndex = -1;
  document.body.appendChild(root);

  const itemEls: HTMLElement[] = items.map((it) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'gridcell');
    btn.textContent = it.label;
    root.appendChild(btn);
    return btn;
  });

  let dispose: () => void = () => {};
  let setColumns: (c: number) => void = () => {};

  createRoot((d) => {
    dispose = d;
    const [active, setActive] = createSignal(0);
    const [columns, setColumnsSignal] = createSignal(opts.columns ?? 0);
    setColumns = setColumnsSignal;

    itemEls.forEach((el, i) => {
      createEffect(() => {
        el.setAttribute('data-rozie-keynav-item', String(i));
        if (active() === i) el.setAttribute('data-rozie-keynav-active', '');
        else el.removeAttribute('data-rozie-keynav-active');
        el.setAttribute('tabindex', active() === i ? '0' : '-1');
      });
    });

    createKeynav(() => root, {
      config: opts.config,
      getSource: () => items,
      getActive: () => active(),
      setActive,
      onCommit: opts.onCommit,
      ...(opts.columns !== undefined ? { gridColumns: () => columns() } : {}),
      ...(opts.onPage !== undefined ? { onPage: opts.onPage } : {}),
    });
  });

  return { root, items: itemEls, setColumns, dispose };
}

interface LateGridHarness {
  root: HTMLElement;
  reveal: () => void;
  byLabel: (label: string) => HTMLElement;
  dispose: () => void;
}

/**
 * Harness for the "item renders one frame late" cases — item 5 is only
 * APPENDED to `root` once `reveal()` flips the `revealed` signal, standing
 * in for a dataset swap (grid paging) whose landing element isn't in the DOM
 * at effect time yet. Item 5's own attribute-binding `createEffect` is
 * registered from the start (mirrors a real compiled component's
 * declarative bindings existing regardless of DOM presence); only its DOM
 * ATTACHMENT is deferred.
 */
function buildLateGrid(opts: { onCommit: (i: number) => void }): LateGridHarness {
  const root = document.createElement('div');
  root.setAttribute('role', 'grid');
  root.tabIndex = -1;
  document.body.appendChild(root);

  const itemEls: HTMLElement[] = GRID_ITEMS.map((it) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'gridcell');
    btn.textContent = it.label;
    return btn;
  });
  itemEls.slice(0, 5).forEach((el) => root.appendChild(el));

  let dispose: () => void = () => {};
  let revealImpl: () => void = () => {};

  createRoot((d) => {
    dispose = d;
    const [active, setActive] = createSignal(0);
    const [revealed, setRevealed] = createSignal(false);
    revealImpl = () => setRevealed(true);

    createEffect(() => {
      if (revealed() && !itemEls[5]!.isConnected) {
        root.appendChild(itemEls[5]!);
      }
    });

    itemEls.forEach((el, i) => {
      createEffect(() => {
        el.setAttribute('data-rozie-keynav-item', String(i));
        if (active() === i) el.setAttribute('data-rozie-keynav-active', '');
        else el.removeAttribute('data-rozie-keynav-active');
        el.setAttribute('tabindex', active() === i ? '0' : '-1');
      });
    });

    createKeynav(() => root, {
      config: GRID_CONFIG,
      getSource: () => GRID_ITEMS,
      getActive: () => active(),
      setActive,
      onCommit: opts.onCommit,
      gridColumns: () => 3,
    });
  });

  return {
    root,
    reveal: () => revealImpl(),
    byLabel: (label: string) => {
      const el = itemEls.find((it) => it.textContent === label);
      if (!el) throw new Error(`no item with label ${label}`);
      return el;
    },
    dispose,
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

describe('createKeynav (Solid) — grid config, @keynav-page, deferred focus (Plan 77-04 Task 3, REAL solid-js effects)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('a malformed/out-of-range data-rozie-keynav-item marker is rejected, never coerced (T-77-04-01)', () => {
    const commit = vi.fn();
    const { root, dispose } = buildGridMenu({ config: GRID_CONFIG, columns: 3, onCommit: commit });

    const rogue = document.createElement('button');
    rogue.setAttribute('data-rozie-keynav-item', '999');
    root.appendChild(rogue);
    rogue.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));

    expect(commit).not.toHaveBeenCalled();

    dispose();
  });

  it('grid: onPage receives a boundary detail when an arrow hits the edge (SPEC §4.1)', () => {
    const commit = vi.fn();
    const onPage = vi.fn();
    const { root, items, dispose } = buildGridMenu({
      config: GRID_CONFIG,
      columns: 3,
      onCommit: commit,
      onPage,
    });

    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); // active starts at 0 -> row-axis boundary

    expect(onPage).toHaveBeenCalledWith({ direction: -1, reason: 'boundary', axis: 'row' });
    // The machine never lands on a boundary key (SPEC §4.1) — active unmoved.
    expect(isActive(byLabel(items, 'A'))).toBe(true);

    dispose();
  });

  it('grid: ArrowDown moves active by the column-stride count', () => {
    const commit = vi.fn();
    const { root, items, dispose } = buildGridMenu({ config: GRID_CONFIG, columns: 3, onCommit: commit });

    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(isActive(byLabel(items, 'D'))).toBe(true);

    dispose();
  });

  it('grid: a dynamic columns() getter changes the stride between keydowns without re-instantiating the machine', () => {
    const commit = vi.fn();
    const { root, items, setColumns, dispose } = buildGridMenu({
      config: GRID_CONFIG,
      columns: 3,
      onCommit: commit,
    });

    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); // stride 3: 0 -> 3 (D)
    expect(isActive(byLabel(items, 'D'))).toBe(true);

    // A fresh columns VALUE lands via the SAME reactive-signal delegation the
    // emitted `gridColumns: () => cols()` closure relies on.
    setColumns(2);
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); // stride 2: 3 -> 5 (F)

    expect(isActive(byLabel(items, 'F'))).toBe(true);

    dispose();
  });

  it('no gridColumns: the config handed to the machine has no grid key — 1D arrow semantics (±1), onPage never fires', () => {
    const commit = vi.fn();
    const onPage = vi.fn();
    const { root, items, dispose } = buildGridMenu({ config: GRID_CONFIG, onCommit: commit, onPage });

    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); // 1D: ±1, NOT ±columns

    expect(isActive(byLabel(items, 'B'))).toBe(true);
    expect(onPage).not.toHaveBeenCalled();

    dispose();
  });

  it('grid: a one-frame-late item render still receives focus once it appears (T-77-03-03)', () => {
    const raf = stubRaf();
    try {
      const commit = vi.fn();
      const { root, reveal, byLabel: byLateLabel, dispose } = buildLateGrid({ onCommit: commit });

      root.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', ctrlKey: true, bubbles: true }),
      ); // grid corner -> index 5, not yet rendered
      expect(byLateLabel('F').isConnected).toBe(false);
      expect(raf.callbacks).toHaveLength(1);

      // The browser "paints" the newly-swapped dataset one frame later.
      reveal();
      const revealedEl = byLateLabel('F');
      expect(revealedEl.isConnected).toBe(true);
      expect(revealedEl.getAttribute('data-rozie-keynav-active')).toBe('');
      expect(document.activeElement).not.toBe(revealedEl);

      // Fire the deferred pass — the element exists now, so focus lands.
      raf.callbacks[0]!(0);
      expect(document.activeElement).toBe(revealedEl);

      dispose();
    } finally {
      raf.restore();
    }
  });

  it('grid: a stale deferred pass never steals focus after a newer navigation supersedes it (T-77-03-03)', () => {
    const raf = stubRaf();
    try {
      const commit = vi.fn();
      const { root, reveal, byLabel: byLateLabel, dispose } = buildLateGrid({ onCommit: commit });

      // First navigation lands on the not-yet-rendered index 5 — schedules a
      // deferred pass scoped to active === 5.
      root.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', ctrlKey: true, bubbles: true }),
      );
      expect(raf.callbacks).toHaveLength(1);
      const stalePass = raf.callbacks[0]!;

      // A second navigation (to an ALREADY-rendered item) supersedes it
      // before the deferred pass ever runs — Solid's `onCleanup` (inside the
      // effect) cancels the pending rAF automatically on the effect's next
      // run, but this fixture forces the STALE callback to fire anyway
      // (simulating a browser that already queued the frame) to prove the
      // value-guard inside the callback also holds.
      root.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Home', ctrlKey: true, bubbles: true }),
      );
      const aEl = byLateLabel('A');
      expect(aEl.getAttribute('data-rozie-keynav-active')).toBe('');
      expect(document.activeElement).toBe(aEl);

      reveal();

      // The stale pass (still scoped to the superseded active === 5) fires —
      // it must no-op, never stealing focus back from the current item.
      stalePass(0);
      expect(document.activeElement).toBe(aEl);

      dispose();
    } finally {
      raf.restore();
    }
  });
});

// ---------------------------------------------------------------------------
// Quick task 260806-lz7 — drill-exit sibling-group race. Mirrors the React
// reference's `TwoGroupHarness` (`useKeynav.test.tsx`) test-by-test — see its
// doc comment for the full rationale. `buildTwoGroupHarness` wires ONE
// `createKeynav` attachment (group A, mirrors date-picker's persistent days
// grid) sharing `getFocusScope: () => [wrapper]` with a plain sibling
// element (`bItem`, mirrors a focused cell inside a SIBLING attachment —
// e.g. date-picker's months panel — that the SAME transition destroys); the
// sibling doesn't need its own `createKeynav` wiring, since what's under
// test is group A's own guarded pass reacting to the shared wrapper's
// same-tick focus loss, not the sibling's own keynav behavior.
// ---------------------------------------------------------------------------

interface TwoGroupHarness {
  wrapper: HTMLElement;
  itemsA: HTMLElement[];
  bItem: HTMLElement;
  setActiveA: (i: number) => void;
  removeB: () => void;
  dispose: () => void;
}

function buildTwoGroupHarness(): TwoGroupHarness {
  const wrapper = document.createElement('div');
  document.body.appendChild(wrapper);

  const rootA = document.createElement('div');
  rootA.setAttribute('role', 'menu');
  rootA.tabIndex = -1;
  wrapper.appendChild(rootA);

  const itemsA: HTMLElement[] = ITEMS.map((it) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = it.label;
    rootA.appendChild(btn);
    return btn;
  });

  const rootB = document.createElement('div');
  rootB.setAttribute('role', 'menu');
  wrapper.appendChild(rootB);
  const bItem = document.createElement('button');
  bItem.type = 'button';
  bItem.textContent = 'B-item';
  bItem.tabIndex = 0;
  rootB.appendChild(bItem);

  let dispose: () => void = () => {};
  let setActiveAImpl: (i: number) => void = () => {};

  createRoot((d) => {
    dispose = d;
    const [activeA, setActiveASignal] = createSignal(0);
    setActiveAImpl = setActiveASignal;

    itemsA.forEach((el, i) => {
      createEffect(() => {
        el.setAttribute('data-rozie-keynav-item', String(i));
        if (activeA() === i) el.setAttribute('data-rozie-keynav-active', '');
        else el.removeAttribute('data-rozie-keynav-active');
        el.setAttribute('tabindex', activeA() === i ? '0' : '-1');
      });
    });

    createKeynav(() => rootA, {
      config: BASE_CONFIG,
      getSource: () => ITEMS,
      getActive: () => activeA(),
      setActive: setActiveASignal,
      onCommit: () => {},
      getFocusScope: () => [wrapper],
    });
  });

  return {
    wrapper,
    itemsA,
    bItem,
    setActiveA: (i) => setActiveAImpl(i),
    removeB: () => rootB.remove(),
    dispose,
  };
}

describe('createKeynav (Solid) — drill-exit sibling-group race (Plan 260806-lz7)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it("a sibling group's focused item destroyed in the same transition, followed by a SEPARATELY rAF-deferred write for THIS group (mirroring date-picker's seedActiveDay), still focuses — even when the tracker's OWN internal expiry rAF is registered BEFORE the sibling's deferred-write rAF (the exact Solid drill-exit race, found via a real-Chromium Docker VR run)", () => {
    const raf = stubRaf();
    try {
      const { itemsA, bItem, setActiveA, removeB, dispose } = buildTwoGroupHarness();

      // Focus lands on the sibling's item (mirrors drilling into months —
      // established directly here since what's under test is group A's
      // reaction to the shared scope's focus loss, not how the sibling
      // itself acquired focus).
      bItem.focus();
      expect(document.activeElement).toBe(bItem);

      // The transition: the sibling's focused item is removed as part of a
      // real-Chromium-style same-tick DOM removal — dispatch the WHATWG
      // "unfocusing steps" `focusout` (relatedTarget null) BEFORE removal,
      // exactly like `focusGuard.test.ts`'s own `dispatchRemovalFocusOut`
      // (happy-dom does not fire this automatically). This registers the
      // tracker's OWN internal (chained) expiry rAF — callbacks[0].
      bItem.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
      removeB();
      expect(document.activeElement).toBe(document.body);
      expect(raf.callbacks.length).toBeGreaterThanOrEqual(1);
      const trackerExpiryLink1 = raf.callbacks[0]!;

      // Group A's OWN sibling deferred write — mirrors `seedActiveDay`'s
      // `requestAnimationFrame(() => { $data.activeDay = next })`,
      // registered strictly AFTER the tracker's own expiry rAF above
      // (matching the exact registration order this fix depends on).
      let deferredWriteRan = false;
      requestAnimationFrame(() => {
        deferredWriteRan = true;
        setActiveA(2);
      });
      const siblingDeferredWrite = raf.callbacks[raf.callbacks.length - 1]!;

      // Fire the tracker's own first chained expiry link — mirrors it
      // running BEFORE the sibling's deferred write in the SAME animation
      // frame (the race). With the fix, this must NOT clear the tracker
      // outright — it re-arms for a further frame.
      trackerExpiryLink1(0);

      // NOW the sibling's deferred write fires — group A's active index
      // resolves to 2 (Charlie), and its guarded pass must still see the
      // tracker as valid (the sibling's chain is still "within scope" via
      // the shared wrapper).
      siblingDeferredWrite(0);
      expect(deferredWriteRan).toBe(true);

      expect(document.activeElement).toBe(byLabel(itemsA, 'Charlie'));

      dispose();
    } finally {
      raf.restore();
    }
  });
});
