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
import type { KeynavConfig } from '@rozie/runtime-keynav-core';
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
