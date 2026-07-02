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
import { createEffect, createRoot, createSignal } from 'solid-js';
import type { KeynavConfig } from '@rozie/runtime-keynav-core';
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
